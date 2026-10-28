<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import QRCode from 'qrcode'
import input_text from '../components/input_text.vue'
import output_text from '../components/output_text.vue'
import { useCaptionPublish } from '../composables/useCaptionChannel'
import { useLecture } from '../composables/useLecture'
import { LANGUAGES } from '../lib/languages'

const lecture = useLecture()
useCaptionPublish(lecture)

const {
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
} = lecture

const clean = ref(false)
const pointerNearTop = ref(true)
const fullscreen = ref(false)
const shareReady = ref(false)
const shareOpen = ref(false)
const listenUrl = ref('')
const qrSrc = ref('')
const shareDialog = ref(null)
const headerEl = ref(null)
const headerHeight = ref(0)
let headerObserver

const showControls = computed(() => !clean.value || pointerNearTop.value || Boolean(error.value))

const sourceLine = computed(() => {
  if (sourceText.value) return sourceText.value
  if (listening.value) return 'Ti ascolto…'
  return 'Qui compare quello che dici'
})

const translationLine = computed(() => {
  if (largeText.value) return largeText.value
  if (listening.value || sourceText.value) return '…'
  return 'Qui compare la traduzione'
})

const sourcePlaceholder = computed(() => !sourceText.value)
const translationPlaceholder = computed(() => !largeText.value)

const downloadWidth = computed(() => {
  if (downloadProgress.value == null) return undefined
  return { width: `${Math.round(downloadProgress.value * 100)}%` }
})

const captionFrame = computed(() => {
  const frame = { '--scale': String(scale.value) }
  if (showControls.value) {
    frame.paddingTop = `${headerHeight.value + 20}px`
    frame.paddingBottom = '4.5rem'
    return frame
  }
  frame.paddingTop = '14vh'
  frame.paddingBottom = '14vh'
  return frame
})

const shareNeedsLan = computed(() => {
  if (!listenUrl.value) return false
  try {
    const host = new URL(listenUrl.value).hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
  } catch {
    return false
  }
})

const controlButton =
  'rounded-full border border-line px-3 py-1.5 text-sm text-ink transition hover:border-ink disabled:hover:border-line'

watch(listening, (active) => {
  if (!active) return
  shareReady.value = true
  void ensureQr()
})

watch(shareOpen, (open) => {
  if (!open) return
  void ensureQr()
  void nextTick(() => {
    shareDialog.value?.focus()
  })
})

function measureHeader() {
  headerHeight.value = headerEl.value?.offsetHeight ?? 0
}

onMounted(() => {
  document.addEventListener('mousemove', onPointerMove)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('keydown', onEscape)
  measureHeader()
  headerObserver = new ResizeObserver(measureHeader)
  if (headerEl.value) headerObserver.observe(headerEl.value)
})

onBeforeUnmount(() => {
  headerObserver?.disconnect()
  document.removeEventListener('mousemove', onPointerMove)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener('keydown', onEscape)
})

function onPointerMove(event) {
  pointerNearTop.value = event.clientY < 160
}

function onFullscreenChange() {
  fullscreen.value = document.fullscreenElement != null
}

function onEscape(event) {
  if (event.key !== 'Escape' || !shareOpen.value) return
  shareOpen.value = false
}

function toggleListen() {
  if (listening.value) stop()
  else start()
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen()
    return
  }
  document.documentElement.requestFullscreen()
}

function toggleShare() {
  shareOpen.value = !shareOpen.value
}

async function ensureQr() {
  if (qrSrc.value) return
  let url = `${window.location.origin}/listen`
  try {
    const response = await fetch('/api/listen-url')
    if (response.ok) {
      const data = await response.json()
      if (typeof data.url === 'string' && data.url.endsWith('/listen')) url = data.url
    }
  } catch {
    // Se il server non risponde, il codice usa l'indirizzo di questa pagina.
  }
  listenUrl.value = url
  try {
    qrSrc.value = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'Q',
      margin: 1,
      width: 512,
      color: { dark: '#10110e', light: '#f4efe6' },
    })
  } catch {
    qrSrc.value = ''
  }
}
</script>

<template>
  <div class="relative min-h-dvh bg-bg text-ink" @mousemove="onPointerMove">
    <header
      ref="headerEl"
      class="absolute inset-x-0 top-0 z-10 border-b border-line/80 bg-bg/92 pt-4 pb-3 backdrop-blur-sm transition duration-200"
      :class="[
        showControls ? 'opacity-100' : 'pointer-events-none -translate-y-2 opacity-0',
        shareReady ? 'pr-[calc(6vw+7.5rem)] pl-[6vw]' : 'px-[6vw]',
      ]"
    >
      <div class="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div class="mr-2 flex items-center gap-2.5">
          <span
            class="size-2.5 rounded-full"
            :class="listening ? 'bg-live' : 'bg-line'"
            aria-hidden="true"
          ></span>
          <div class="leading-tight">
            <p class="text-sm font-semibold">LiveWhisper</p>
            <p class="text-xs text-mute">traduzione in aula</p>
          </div>
        </div>

        <button
          class="rounded-full px-4 py-1.5 text-sm font-semibold transition"
          :class="
            listening
              ? 'border border-live bg-transparent text-live'
              : 'border border-ink bg-ink text-bg'
          "
          type="button"
          :disabled="!supported"
          @click="toggleListen"
        >
          {{ listening ? 'Stop' : 'Ascolta' }}
        </button>
        <button :class="controlButton" type="button" @click="preview">Prova</button>
        <button
          :class="controlButton"
          type="button"
          :disabled="!sourceText && history.length === 0"
          @click="clearCaptions"
        >
          Pulisci
        </button>

        <label class="flex items-center gap-2 text-sm text-mute">
          <span>Lingua 1</span>
          <select v-model="sourceId" class="bg-transparent text-ink" aria-label="Lingua che parli">
            <option v-for="language in LANGUAGES" :key="language.id" :value="language.id">
              {{ language.label }}
            </option>
          </select>
        </label>

        <button
          class="text-mute transition hover:text-ink"
          type="button"
          aria-label="Scambia le lingue"
          @click="swapLanguages"
        >
          →
        </button>

        <label class="flex items-center gap-2 text-sm text-mute">
          <span>Lingua 2</span>
          <select v-model="targetId" class="bg-transparent text-ink" aria-label="Lingua della traduzione">
            <option v-for="language in LANGUAGES" :key="language.id" :value="language.id">
              {{ language.label }}
            </option>
          </select>
        </label>

        <label class="flex items-center gap-2 text-sm text-mute">
          <span>Motore</span>
          <select v-model="enginePref" class="bg-transparent text-ink" aria-label="Motore di traduzione">
            <option value="auto">Automatico</option>
            <option value="device">Sul dispositivo</option>
            <option value="mymemory">MyMemory</option>
            <option value="deepl">DeepL</option>
          </select>
        </label>

        <div class="flex overflow-hidden rounded-full border border-line" aria-label="Dimensione del testo">
          <button class="px-2.5 py-1 text-sm hover:bg-white/5" type="button" @click="setScale(scale - 0.1)">
            A−
          </button>
          <button
            class="border-l border-line px-2.5 py-1 text-sm hover:bg-white/5"
            type="button"
            @click="setScale(scale + 0.1)"
          >
            A+
          </button>
        </div>

        <button :class="controlButton" type="button" @click="toggleFullscreen">
          {{ fullscreen ? 'Esci' : 'Intero' }}
        </button>
        <button :class="controlButton" type="button" @click="clean = true">Pulisci schermo</button>
      </div>

      <label v-if="enginePref === 'deepl'" class="mt-3 flex max-w-md flex-col gap-1 text-xs text-mute">
        Chiave DeepL
        <input
          v-model="deeplKey"
          class="border-b border-line bg-transparent py-1 text-sm text-ink outline-none"
          type="password"
          autocomplete="off"
          spellcheck="false"
          placeholder="Resta solo in questo browser"
        />
      </label>

      <p class="mt-3 min-h-5 text-sm" :class="error ? 'text-danger' : 'text-mute'" role="status">
        {{ error || statusLine }}
      </p>

      <div
        v-if="deviceState === 'downloading'"
        class="progress mt-2 h-0.5 overflow-hidden bg-line"
        :class="{ 'is-unknown': downloadProgress == null }"
        aria-hidden="true"
      >
        <span :style="downloadWidth"></span>
      </div>
    </header>

    <button
      v-if="clean && !showControls"
      class="absolute top-3 left-[6vw] z-10 text-xs tracking-wide text-mute uppercase"
      type="button"
      @click="clean = false"
    >
      Mostra comandi
    </button>

    <button
      v-if="shareReady"
      class="fixed top-4 right-[6vw] z-50 rounded-full border px-4 py-1.5 text-sm font-semibold transition"
      :class="shareOpen ? 'border-live bg-live text-bg' : 'border-live bg-bg/92 text-live backdrop-blur-sm'"
      type="button"
      :aria-expanded="shareOpen"
      :aria-pressed="shareOpen"
      @click="toggleShare"
    >
      Share
    </button>

    <main
      class="mx-auto flex min-h-dvh w-[min(68rem,calc(100%-12vw))] flex-col justify-center"
      :style="captionFrame"
    >
      <input_text
        :text="sourceLine"
        :lang="sourceId"
        :placeholder="sourcePlaceholder"
        :live="live && !sourcePlaceholder"
      />

      <div class="my-[clamp(1.1rem,2.4vh,2rem)] h-px w-16 bg-line" aria-hidden="true"></div>

      <output_text
        :text="translationLine"
        :lang="targetId"
        :placeholder="translationPlaceholder"
        :waiting="waiting"
      />

      <details v-if="history.length > 1 && showControls" class="mt-10 max-w-xl text-mute">
        <summary class="cursor-pointer text-sm">Ultime frasi</summary>
        <ol class="mt-3 space-y-3">
          <li v-for="(item, index) in history.slice(1)" :key="`${item.source}-${index}`">
            <span class="block text-sm">{{ item.source }}</span>
            <strong class="mt-0.5 block text-base font-medium text-ink">{{ item.translation }}</strong>
          </li>
        </ol>
      </details>
    </main>

    <footer v-if="showControls" class="pointer-events-none absolute inset-x-0 bottom-0 px-[6vw] pb-4">
      <details class="pointer-events-auto max-w-2xl text-sm text-mute">
        <summary class="cursor-pointer">Come resta veloce</summary>
        <p class="mt-2 max-w-xl leading-relaxed">
          Chrome trascrive mentre parli e aggiorna la riga piccola prima che la frase sia chiusa.
          Con il motore automatico la traduzione gira sul computer, quindi non aspetta un server.
          Whisper è più preciso in un’aula rumorosa, ma lavora a blocchi e aggiunge uno o due secondi.
          Tieni questa scheda in primo piano. Spazio avvia e ferma l’ascolto. Share resta disponibile
          dopo l’avvio e mostra un codice: chi lo inquadra vede solo il testo e la traduzione.
        </p>
      </details>
    </footer>

    <div
      v-if="shareOpen"
      ref="shareDialog"
      class="fixed inset-0 z-40 flex items-center justify-center bg-bg/80 px-6 backdrop-blur-sm outline-none"
      role="dialog"
      aria-modal="true"
      aria-label="Condividi la traduzione"
      tabindex="-1"
      @click.self="shareOpen = false"
    >
      <div class="flex w-[min(28rem,calc(100%-1rem))] flex-col items-center gap-5 border border-line bg-bg px-8 py-8">
        <img
          v-if="qrSrc"
          class="aspect-square w-[min(72vw,22rem)]"
          :src="qrSrc"
          alt="Codice QR per aprire la traduzione"
        />
        <p v-else class="text-sm text-mute">Preparo il codice…</p>
        <p class="text-center text-sm break-all text-ink">{{ listenUrl }}</p>
        <p v-if="shareNeedsLan" class="text-center text-xs leading-relaxed text-mute">
          Questo indirizzo è solo su questo computer. Riapri LiveWhisper dall’indirizzo di rete, poi mostra di nuovo il codice.
        </p>
      </div>
    </div>
  </div>
</template>
