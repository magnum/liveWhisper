<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import input_text from '../components/input_text.vue'
import output_text from '../components/output_text.vue'
import { useSharedCaptions } from '../composables/useCaptionChannel'
import { useListenerTranslation } from '../composables/useListenerTranslation'
import { LANGUAGES } from '../lib/languages'

const STORAGE = 'detta.listen'

const captions = useSharedCaptions()
const targetId = ref(readStored())
const { text, lang, waiting, note, needsDownload, prepare } = useListenerTranslation(captions, targetId)

const sourceLine = computed(() => captions.sourceText || '…')
const translationLine = computed(() => text.value || '…')
const sourcePlaceholder = computed(() => !captions.sourceText)
const translationPlaceholder = computed(() => !text.value)

watch(targetId, (value) => {
  if (value) localStorage.setItem(STORAGE, value)
})

watch(
  () => captions.connected,
  (connected) => {
    if (!connected || targetId.value) return
    targetId.value = captions.targetId
  },
)

onMounted(() => {
  document.title = 'LiveWhisper — ascolta'
})

function readStored() {
  const stored = localStorage.getItem(STORAGE)
  return LANGUAGES.some((language) => language.id === stored) ? stored : ''
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-bg text-ink">
    <header class="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 px-[6vw] pt-4">
      <button
        v-if="needsDownload"
        class="rounded-full border border-line px-3 py-1.5 text-sm text-ink"
        type="button"
        @click="prepare"
      >
        Scarica la lingua
      </button>
      <p v-else-if="note" class="text-sm text-mute">{{ note }}</p>
      <label class="flex items-center gap-2 text-sm text-mute">
        <span>Traduci in</span>
        <select v-model="targetId" class="bg-transparent text-ink" aria-label="Lingua della traduzione">
          <option v-if="!targetId" disabled value="">…</option>
          <option v-for="language in LANGUAGES" :key="language.id" :value="language.id">
            {{ language.label }}
          </option>
        </select>
      </label>
    </header>

    <main
      class="mx-auto flex w-[min(68rem,calc(100%-12vw))] flex-1 flex-col justify-center py-[8vh]"
    >
      <input_text
        :text="sourceLine"
        :lang="captions.sourceId"
        :placeholder="sourcePlaceholder"
        :live="captions.live && !sourcePlaceholder"
      />
      <div class="my-[clamp(1.1rem,2.4vh,2rem)] h-px w-16 bg-line" aria-hidden="true"></div>
      <output_text
        :text="translationLine"
        :lang="lang"
        :placeholder="translationPlaceholder"
        :waiting="waiting"
        :hint="false"
      />
    </main>
  </div>
</template>
