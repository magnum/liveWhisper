import { computed, onBeforeUnmount, ref, watch } from 'vue'

function matches(anchor, source) {
  const left = anchor.replace(/\s+/g, ' ').trim().toLowerCase()
  const right = source.replace(/\s+/g, ' ').trim().toLowerCase()
  if (!left || !right) return false
  return left === right || right.startsWith(left) || left.startsWith(right)
}

function progressFraction(event) {
  const loaded = Number(event.loaded)
  const total = Number(event.total)
  if (!Number.isFinite(loaded)) return null
  const fraction = loaded > 1 && Number.isFinite(total) && total > 0 ? loaded / total : loaded
  return Math.max(0, Math.min(1, fraction))
}

export function useListenerTranslation(captions, targetId) {
  const localText = ref('')
  const localAnchor = ref('')
  const state = ref('idle')
  const progress = ref(null)

  let translator = null
  let pair = ''
  let token = 0
  let serial = 0
  let timer = 0

  const mode = computed(() => {
    if (!targetId.value || targetId.value === captions.targetId) return 'speaker'
    if (targetId.value === captions.sourceId) return 'source'
    return 'local'
  })

  const text = computed(() => {
    if (mode.value === 'source') return captions.sourceText
    if (mode.value === 'speaker') return captions.translationText
    if (localText.value) return localText.value
    return captions.translationText
  })

  const lang = computed(() => {
    if (mode.value === 'source') return captions.sourceId
    if (mode.value === 'local' && localText.value) return targetId.value
    return captions.targetId
  })

  const waiting = computed(() => {
    if (mode.value === 'speaker') return captions.waiting
    if (mode.value !== 'local' || !localText.value) return false
    return !matches(localAnchor.value, captions.sourceText)
  })

  const note = computed(() => {
    if (mode.value !== 'local') return ''
    if (state.value === 'downloading') {
      const percent = progress.value == null ? '' : ` ${Math.round(progress.value * 100)}%`
      return `Scarico il modello di Chrome${percent}.`
    }
    if (state.value === 'downloadable') return 'Serve un tap per scaricare questa lingua.'
    if (state.value === 'unavailable') return 'Chrome non traduce questa coppia di lingue su questo telefono.'
    return ''
  })

  watch(
    () => [captions.sourceId, targetId.value],
    () => {
      window.clearTimeout(timer)
      serial += 1
      localText.value = ''
      localAnchor.value = ''
      if (mode.value === 'local') prepare()
      else drop()
    },
    { immediate: true },
  )

  watch(
    () => captions.sourceText,
    (value) => {
      if (mode.value !== 'local') return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        void translate(value)
      }, state.value === 'ready' ? 80 : 240)
    },
  )

  onBeforeUnmount(() => {
    window.clearTimeout(timer)
    serial += 1
    drop()
  })

  function prepare() {
    const source = captions.sourceId
    const target = targetId.value
    if (!source || !target || source === target) return

    const TranslatorApi = globalThis.Translator
    if (!TranslatorApi) {
      state.value = 'unavailable'
      progress.value = null
      return
    }

    const key = `${source}|${target}`
    if (translator && pair === key && state.value === 'ready') {
      void translate(captions.sourceText)
      return
    }

    drop()
    const myToken = ++token
    pair = key
    state.value = 'downloadable'
    const pending = TranslatorApi.create({
      sourceLanguage: source,
      targetLanguage: target,
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', (event) => {
          if (myToken !== token) return
          progress.value = progressFraction(event)
          state.value = 'downloading'
        })
      },
    })

    void pending
      .then((instance) => {
        if (myToken !== token) {
          if (typeof instance.destroy === 'function') instance.destroy()
          return
        }
        translator = instance
        state.value = 'ready'
        progress.value = null
        void translate(captions.sourceText)
      })
      .catch((caught) => {
        if (myToken !== token) return
        translator = null
        pair = ''
        progress.value = null
        state.value = caught instanceof DOMException && caught.name === 'NotAllowedError' ? 'downloadable' : 'unavailable'
      })
  }

  async function translate(value) {
    const clean = String(value ?? '').replace(/\s+/g, ' ').trim()
    if (!clean || !translator || state.value !== 'ready') return
    const job = ++serial
    try {
      const translated = await translator.translate(clean)
      if (job !== serial) return
      const next = String(translated ?? '').replace(/\s+/g, ' ').trim()
      if (!next) return
      localText.value = next
      localAnchor.value = clean
    } catch {
      // La frase successiva riprova. L'ultima traduzione buona resta visibile.
    }
  }

  function drop() {
    token += 1
    if (translator && typeof translator.destroy === 'function') translator.destroy()
    translator = null
    pair = ''
    progress.value = null
    if (state.value !== 'unavailable') state.value = 'idle'
  }

  return {
    text,
    lang,
    waiting,
    note,
    needsDownload: computed(() => mode.value === 'local' && state.value === 'downloadable'),
    prepare,
  }
}
