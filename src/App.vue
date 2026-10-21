<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useLecture } from './composables/useLecture'
import { LANGUAGES } from './lib/languages'

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
} = useLecture()

const clean = ref(false)
const pointerNearTop = ref(true)
const fullscreen = ref(false)

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

const controlButton =
  'rounded-full border border-line px-3 py-1.5 text-sm text-ink transition hover:border-ink disabled:hover:border-line'

onMounted(() => {
  document.addEventListener('mousemove', onPointerMove)
  document.addEventListener('fullscreenchange', onFullscreenChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onPointerMove)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
})

function onPointerMove(event) {
  pointerNearTop.value = event.clientY < 160
}

function onFullscreenChange() {
  fullscreen.value = document.fullscreenElement != null
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
</script>

<template>
  <div class="relative min-h-dvh bg-bg text-ink" @mousemove="onPointerMove">
    <header
      class="absolute inset-x-0 top-0 z-10 border-b border-line/80 bg-bg/92 px-[6vw] pt-4 pb-3 backdrop-blur-sm transition duration-200"
      :class="showControls ? 'opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'"
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

    <main
      class="mx-auto flex min-h-dvh w-[min(68rem,calc(100%-12vw))] flex-col justify-center py-[14vh]"
      :style="{ '--scale': String(scale) }"
    >
      <p class="caption-source" :class="{ 'is-placeholder': sourcePlaceholder }" :lang="sourceId">
        {{ sourceLine }}<span v-if="live && !sourcePlaceholder" class="caret" aria-hidden="true"></span>
      </p>

      <div class="my-[clamp(1.1rem,2.4vh,2rem)] h-px w-16 bg-line" aria-hidden="true"></div>

      <p v-if="waiting && largeText" class="mb-3 text-xs tracking-[0.16em] text-mute uppercase">
        Frase precedente
      </p>
      <p
        class="caption-translation"
        :class="{
          'is-placeholder': translationPlaceholder,
          'opacity-55': waiting && !translationPlaceholder,
        }"
        :lang="targetId"
        aria-live="polite"
      >
        {{ translationLine }}
      </p>

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

    <footer
      v-if="showControls"
      class="pointer-events-none absolute inset-x-0 bottom-0 px-[6vw] pb-4"
    >
      <details class="pointer-events-auto max-w-2xl text-sm text-mute">
        <summary class="cursor-pointer">Come resta veloce</summary>
        <p class="mt-2 max-w-xl leading-relaxed">
          Chrome trascrive mentre parli e aggiorna la riga piccola prima che la frase sia chiusa.
          Con il motore automatico la traduzione gira sul computer, quindi non aspetta un server.
          Whisper è più preciso in un’aula rumorosa, ma lavora a blocchi e aggiunge uno o due secondi.
          Tieni questa scheda in primo piano. Spazio avvia e ferma l’ascolto.
        </p>
      </details>
    </footer>
  </div>
</template>
