<script setup>
import { computed, onMounted } from 'vue'
import input_text from '../components/input_text.vue'
import output_text from '../components/output_text.vue'
import { useSharedCaptions } from '../composables/useCaptionChannel'

const captions = useSharedCaptions()

const sourceLine = computed(() => captions.sourceText || '…')
const translationLine = computed(() => captions.translationText || '…')
const sourcePlaceholder = computed(() => !captions.sourceText)
const translationPlaceholder = computed(() => !captions.translationText)

onMounted(() => {
  document.title = 'LiveWhisper — ascolta'
})
</script>

<template>
  <div class="relative min-h-dvh bg-bg text-ink">
    <main
      class="mx-auto flex min-h-dvh w-[min(68rem,calc(100%-12vw))] flex-col justify-center py-[14vh]"
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
        :lang="captions.targetId"
        :placeholder="translationPlaceholder"
        :waiting="captions.waiting"
        :hint="false"
      />
    </main>
  </div>
</template>
