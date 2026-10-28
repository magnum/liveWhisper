import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { findLanguage } from '../lib/languages'
import { resolveEngine, showEnginePicker } from '../lib/translationMode'
import { translateOnline } from '../lib/translateOnline'

const STORAGE = {
  source: 'detta.source',
  target: 'detta.target',
  engine: 'detta.engine',
  scale: 'detta.scale',
  deepl: 'detta.deepl',
}

const ENGINE_PREFS = ['auto', 'device', 'mymemory', 'deepl']

function readEnginePref() {
  const stored = localStorage.getItem(STORAGE.engine)
  return ENGINE_PREFS.includes(stored) ? stored : 'device'
}

function normalize(value) {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
}

function present(text, locale) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  return clean.charAt(0).toLocaleUpperCase(locale) + clean.slice(1)
}

function textsMatch(anchor, source) {
  const left = normalize(anchor)
  const right = normalize(source)
  if (!left || !right) return false
  return left === right || right.startsWith(left) || left.startsWith(right)
}

function recognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

export function useLecture() {
  const sourceId = ref(localStorage.getItem(STORAGE.source) || 'it')
  const targetId = ref(localStorage.getItem(STORAGE.target) || 'en')
  const enginePref = ref(readEnginePref())
  const scale = ref(clampScale(Number(localStorage.getItem(STORAGE.scale)) || 1))
  const deeplKey = ref(localStorage.getItem(STORAGE.deepl) || '')

  const listening = ref(false)
  const supported = ref(true)
  const error = ref('')
  const sourceText = ref('')
  const translationText = ref('')
  const translationAnchor = ref('')
  const heldTranslation = ref('')
  const live = ref(false)
  const activeEngine = ref('')
  const deviceState = ref('unknown')
  const downloadProgress = ref(null)
  const history = ref([])

  const cache = new Map()
  let recognizer = null
  let restartTimer = 0
  let draftTimer = 0
  let requestSerial = 0
  let pendingJob = null
  let pumping = false
  let translator = null
  let translatorPair = ''
  let creating = null
  let availabilityToken = 0
  let dangling = ''

  const sourceLanguage = computed(() => findLanguage(sourceId.value))
  const targetLanguage = computed(() => findLanguage(targetId.value))

  const waiting = computed(() => {
    if (!sourceText.value || !heldTranslation.value) return false
    return !textsMatch(translationAnchor.value, sourceText.value)
  })

  const largeText = computed(() => {
    if (sourceText.value && textsMatch(translationAnchor.value, sourceText.value)) {
      return translationText.value
    }
    if (sourceText.value) return heldTranslation.value
    return ''
  })

  const statusLine = computed(() => {
    if (!supported.value) {
      return 'Apri questa pagina in Chrome o Edge: sono gli unici con il riconoscimento vocale continuo.'
    }
    if (sourceId.value === targetId.value) return 'Scegli due lingue diverse.'
    if (deviceState.value === 'downloading') {
      const percent =
        downloadProgress.value == null ? '' : ` ${Math.round(downloadProgress.value * 100)}%`
      if (!showEnginePicker) return `Scarico il modello di traduzione di Chrome${percent}.`
      return `Scarico il modello di traduzione${percent}. Intanto traduco in rete.`
    }
    if (listening.value && chosenEngine() === 'device') {
      return 'In ascolto. Traduzione sul dispositivo, quasi immediata.'
    }
    if (listening.value && chosenEngine() === 'deepl') return 'In ascolto. Traduzione con DeepL.'
    if (listening.value && chosenEngine() === 'mymemory') return 'In ascolto. Traduzione in rete.'
    if (listening.value) return 'In ascolto.'
    if (chosenEngine() === 'deepl') return 'DeepL è più curato e aggiunge un piccolo ritardo di rete.'
    if (deviceState.value === 'ready') return 'Modello pronto sul dispositivo: è il percorso più rapido.'
    if (deviceState.value === 'downloadable') {
      return 'Premi Ascolta: Chrome scarica il modello una volta, poi traduce senza rete.'
    }
    if (deviceState.value === 'unavailable' && chosenEngine() !== 'mymemory') {
      if (!showEnginePicker) return 'La traduzione di Chrome non è disponibile in questo browser.'
      return 'Traduzione sul dispositivo non disponibile qui. Userò MyMemory.'
    }
    return 'Premi Ascolta e parla. La frase compare sopra, la traduzione sotto.'
  })

  watch(sourceId, (value) => localStorage.setItem(STORAGE.source, value))
  watch(targetId, (value) => localStorage.setItem(STORAGE.target, value))
  watch(enginePref, (value) => localStorage.setItem(STORAGE.engine, value))
  watch(scale, (value) => localStorage.setItem(STORAGE.scale, String(value)))
  watch(deeplKey, (value) => localStorage.setItem(STORAGE.deepl, value))

  watch([sourceId, targetId], () => {
    cache.clear()
    void refreshDeviceAvailability()
    retranslateCurrent()
    if (listening.value) restartRecognizer()
  })

  watch(enginePref, () => {
    cache.clear()
    void refreshDeviceAvailability()
    retranslateCurrent()
  })

  onMounted(() => {
    supported.value = recognitionCtor() != null
    void refreshDeviceAvailability()
    window.addEventListener('keydown', onKeydown)
  })

  onBeforeUnmount(() => {
    listening.value = false
    window.clearTimeout(restartTimer)
    window.clearTimeout(draftTimer)
    window.removeEventListener('keydown', onKeydown)
    try {
      recognizer?.abort()
    } catch {
      // The recognizer may already be stopped.
    }
  })

  function onKeydown(event) {
    const target = event.target
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      return
    }
    if (event.code !== 'Space') return
    event.preventDefault()
    if (listening.value) stop()
    else void start()
  }

  function swapLanguages() {
    const nextSource = targetId.value
    targetId.value = sourceId.value
    sourceId.value = nextSource
  }

  function setScale(next) {
    scale.value = clampScale(next)
  }

  function clearCaptions() {
    window.clearTimeout(draftTimer)
    requestSerial += 1
    pendingJob = null
    dangling = ''
    sourceText.value = ''
    translationText.value = ''
    translationAnchor.value = ''
    heldTranslation.value = ''
    live.value = false
    history.value = []
    error.value = ''
  }

  async function start() {
    error.value = ''
    if (!supported.value) return
    listening.value = true
    primeDevice()
    startRecognizer()
  }

  function stop() {
    listening.value = false
    window.clearTimeout(restartTimer)
    window.clearTimeout(draftTimer)
    try {
      recognizer?.stop()
    } catch {
      // stop() throws if recognition was already idle.
    }
    if (!recognizer) finishUtterance()
  }

  function preview() {
    const sample = sourceLanguage.value.sample
    live.value = false
    sourceText.value = sample
    primeDevice()
    requestTranslation(sample, true)
  }

  function primeDevice() {
    const engine = chosenEngine()
    if (engine === 'mymemory' || engine === 'deepl') return
    if (sourceId.value === targetId.value) return
    if (deviceState.value === 'unavailable') return
    if (translator && translatorPair === currentPair()) return
    void createTranslator()
  }

  function restartRecognizer() {
    window.clearTimeout(restartTimer)
    try {
      recognizer?.stop()
    } catch {
      startRecognizer()
    }
  }

  function startRecognizer() {
    const Ctor = recognitionCtor()
    if (!Ctor || !listening.value) return

    if (!recognizer) {
      recognizer = new Ctor()
      recognizer.continuous = true
      recognizer.interimResults = true
      recognizer.maxAlternatives = 1
      recognizer.onresult = onSpeechResult
      recognizer.onerror = onSpeechError
      recognizer.onend = onSpeechEnd
    }

    recognizer.lang = sourceLanguage.value.speech
    try {
      recognizer.start()
    } catch {
      // InvalidStateError: a start() is already in progress.
    }
  }

  function onSpeechResult(event) {
    let interim = ''
    const finals = []

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const piece = event.results[index][0].transcript
      if (event.results[index].isFinal) finals.push(piece)
      else interim += piece
    }

    if (error.value.startsWith('Il riconoscimento')) error.value = ''

    const draft = interim.trim()
    const heard = [...finals, draft].filter(Boolean).join(' ')
    if (dangling && heard && !sameDraft(dangling, heard)) {
      commitPhrase(dangling)
    } else if (dangling && heard) {
      dangling = ''
    }

    for (const phrase of finals) {
      if (phrase.trim()) commitPhrase(phrase)
    }

    if (!draft) return

    live.value = true
    sourceText.value = present(draft, sourceLanguage.value.speech)
    scheduleDraft(sourceText.value)
  }

  function onSpeechError(event) {
    if (event.error === 'aborted' || event.error === 'no-speech') return
    if (event.error === 'not-allowed') {
      listening.value = false
      error.value = 'Permesso del microfono negato. Consenti il microfono per questo sito e riprova.'
      return
    }
    if (event.error === 'audio-capture') {
      listening.value = false
      error.value = 'Non trovo un microfono. Collegalo e premi Ascolta di nuovo.'
      return
    }
    if (event.error === 'network') {
      error.value = 'Il riconoscimento di Chrome non risponde. Controlla la rete: l’audio viene trascritto da Google.'
    }
  }

  function onSpeechEnd() {
    if (!listening.value) {
      finishUtterance()
      return
    }
    if (live.value && sourceText.value) dangling = sourceText.value
    // Chrome chiude la sessione da solo, anche a metà frase. La riapro senza
    // buttare via le parole già mostrate.
    window.clearTimeout(restartTimer)
    restartTimer = window.setTimeout(() => {
      if (listening.value) startRecognizer()
    }, 200)
  }

  function finishUtterance() {
    const draft = dangling || (live.value ? sourceText.value : '')
    dangling = ''
    if (draft) commitPhrase(draft)
  }

  function retranslateCurrent() {
    if (!sourceText.value) return
    requestTranslation(sourceText.value, !live.value)
  }

  function commitPhrase(phrase) {
    window.clearTimeout(draftTimer)
    dangling = ''
    const text = present(phrase, sourceLanguage.value.speech)
    if (!text) return
    live.value = false
    sourceText.value = text
    requestTranslation(text, true)
  }

  function scheduleDraft(text) {
    window.clearTimeout(draftTimer)
    draftTimer = window.setTimeout(() => {
      if (live.value && sourceText.value === text) requestTranslation(text, false)
    }, draftDelay())
  }

  function draftDelay() {
    const engine = chosenEngine()
    if (engine === 'deepl') return 420
    if (engine === 'mymemory') return 320
    if (deviceState.value === 'ready') return 80
    return 320
  }

  function requestTranslation(text, commit) {
    if (!text || sourceId.value === targetId.value) {
      applyTranslation({ text, commit, serial: requestSerial }, text)
      return
    }

    const cached = cache.get(cacheKey(text))
    if (cached) {
      requestSerial += 1
      pendingJob = null
      applyTranslation({ text, commit, serial: requestSerial }, cached)
      return
    }

    requestSerial += 1
    pendingJob = { text, commit, serial: requestSerial }
    void pump()
  }

  async function pump() {
    if (pumping) return
    pumping = true
    while (pendingJob) {
      const job = pendingJob
      pendingJob = null
      try {
        const translated = await runTranslation(job.text)
        if (job.serial === requestSerial) applyTranslation(job, translated)
      } catch (caught) {
        if (job.serial !== requestSerial) continue
        if (caught instanceof DOMException && caught.name === 'AbortError') continue
        error.value = caught instanceof Error ? caught.message : 'Traduzione non riuscita.'
      }
    }
    pumping = false
  }

  function applyTranslation(job, translated) {
    const clean = String(translated ?? '').replace(/\s+/g, ' ').trim()
    if (!clean) return
    cache.set(cacheKey(job.text), clean)
    if (cache.size > 300) {
      const oldest = cache.keys().next().value
      if (oldest) cache.delete(oldest)
    }
    translationAnchor.value = job.text
    translationText.value = clean
    if (job.commit) {
      heldTranslation.value = clean
      remember(job.text, clean)
    }
    if (error.value.startsWith('MyMemory') || error.value.startsWith('DeepL') || error.value.startsWith('Traduzione')) {
      error.value = ''
    }
  }

  function remember(source, translation) {
    const current = history.value[0]
    if (current && normalize(current.source) === normalize(source)) {
      current.translation = translation
      return
    }
    history.value = [{ source, translation }, ...history.value].slice(0, 10)
  }

  function chosenEngine() {
    return resolveEngine(enginePref.value)
  }

  async function runTranslation(text) {
    switch (chosenEngine()) {
      case 'auto':
        return translateAuto(text)
      case 'device':
        return showEnginePicker ? translateDeviceFirst(text) : translateWithChrome(text)
      case 'mymemory':
        return translateWithMemory(text)
      case 'deepl':
        return translateWithDeepL(text)
      default: {
        const unknown = chosenEngine()
        throw new Error(`Motore sconosciuto: ${unknown}`)
      }
    }
  }

  async function translateWithChrome(text) {
    const local = await translateWithDevice(text)
    if (local) return local
    if (
      deviceState.value === 'downloading' ||
      deviceState.value === 'downloadable' ||
      deviceState.value === 'unknown'
    ) {
      return ''
    }
    throw new Error('La traduzione di Chrome non è disponibile per queste lingue. Apri la pagina in Chrome aggiornato.')
  }

  async function translateAuto(text) {
    try {
      const local = await translateWithDevice(text)
      if (local) return local
    } catch {
      // Se il modello locale non risponde, la frase passa dalla rete.
    }
    return translateWithMemory(text)
  }

  async function translateDeviceFirst(text) {
    try {
      const local = await translateWithDevice(text)
      if (local) return local
    } catch {
      // Se il modello locale non risponde, la frase passa dalla rete.
    }
    return translateWithMemory(text)
  }

  async function translateWithDevice(text) {
    if (deviceState.value !== 'ready' || !translator) return ''
    const translated = await translator.translate(text)
    activeEngine.value = 'device'
    return typeof translated === 'string' ? translated : String(translated ?? '')
  }

  function translateWithMemory(text) {
    activeEngine.value = 'mymemory'
    return translateOnline({
      provider: 'mymemory',
      text,
      source: sourceLanguage.value.memory,
      target: targetLanguage.value.memory,
    })
  }

  function translateWithDeepL(text) {
    activeEngine.value = 'deepl'
    return translateOnline({
      provider: 'deepl',
      text,
      source: sourceLanguage.value.deeplSource,
      target: targetLanguage.value.deeplTarget,
      deeplKey: deeplKey.value,
    })
  }

  async function refreshDeviceAvailability() {
    const token = ++availabilityToken
    dropTranslator()

    if (sourceId.value === targetId.value || chosenEngine() === 'mymemory' || chosenEngine() === 'deepl') {
      deviceState.value = 'unavailable'
      downloadProgress.value = null
      return
    }
    const TranslatorApi = globalThis.Translator
    if (!TranslatorApi) {
      deviceState.value = 'unavailable'
      downloadProgress.value = null
      return
    }

    try {
      const status = await TranslatorApi.availability({
        sourceLanguage: sourceId.value,
        targetLanguage: targetId.value,
      })
      if (token !== availabilityToken) return
      if (status === 'unavailable') {
        deviceState.value = 'unavailable'
        return
      }
      if (status === 'available') {
        await createTranslator(token)
        return
      }
      deviceState.value = status
    } catch {
      if (token !== availabilityToken) return
      deviceState.value = 'unavailable'
    }
  }

  async function createTranslator(token = availabilityToken) {
    const TranslatorApi = globalThis.Translator
    if (!TranslatorApi) {
      deviceState.value = 'unavailable'
      return
    }

    const pair = currentPair()
    if (translator && translatorPair === pair) {
      deviceState.value = 'ready'
      return
    }
    if (creating && translatorPair === pair) return creating

    const options = {
      sourceLanguage: sourceId.value,
      targetLanguage: targetId.value,
    }
    translatorPair = pair
    const pending = TranslatorApi.create({
      ...options,
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', (event) => {
          if (token !== availabilityToken) return
          downloadProgress.value = progressFraction(event)
          deviceState.value = 'downloading'
        })
      },
    })
    creating = pending

    try {
      const instance = await pending
      if (token !== availabilityToken || translatorPair !== pair) return
      translator = instance
      deviceState.value = 'ready'
      downloadProgress.value = null
      retranslateCurrent()
    } catch (caught) {
      if (token !== availabilityToken) return
      translator = null
      translatorPair = ''
      if (caught instanceof DOMException && caught.name === 'NotAllowedError') {
        deviceState.value = 'downloadable'
        return
      }
      deviceState.value = 'unavailable'
    } finally {
      if (creating === pending) creating = null
    }
  }

  function dropTranslator() {
    if (translator && typeof translator.destroy === 'function') translator.destroy()
    translator = null
    translatorPair = ''
    creating = null
    downloadProgress.value = null
  }

  function currentPair() {
    return `${sourceId.value}|${targetId.value}`
  }

  function cacheKey(text) {
    return `${engineCacheId()}|${currentPair()}|${normalize(text)}`
  }

  function engineCacheId() {
    const engine = chosenEngine()
    if (engine === 'deepl') return 'deepl'
    if (engine === 'mymemory') return 'mymemory'
    return 'device'
  }

  return {
    sourceId,
    targetId,
    enginePref,
    scale,
    deeplKey,
    listening,
    supported,
    error,
    sourceText,
    largeText,
    waiting,
    live,
    history,
    deviceState,
    downloadProgress,
    statusLine,
    start,
    stop,
    preview,
    clearCaptions,
    swapLanguages,
    setScale,
  }
}

function clampScale(value) {
  if (!Number.isFinite(value)) return 1
  return Math.min(1.45, Math.max(0.8, Math.round(value * 100) / 100))
}

function sameDraft(previous, next) {
  const left = normalize(previous)
  const right = normalize(next)
  if (!left || !right) return false
  return right.includes(left.slice(0, 24)) || left.includes(right)
}

function progressFraction(event) {
  const loaded = Number(event.loaded)
  const total = Number(event.total)
  if (!Number.isFinite(loaded)) return null
  const fraction = loaded > 1 && Number.isFinite(total) && total > 0 ? loaded / total : loaded
  return Math.max(0, Math.min(1, fraction))
}
