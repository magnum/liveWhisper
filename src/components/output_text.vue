<script setup>
defineProps({
  text: {
    type: String,
    required: true,
  },
  lang: {
    type: String,
    default: '',
  },
  placeholder: {
    type: Boolean,
    default: false,
  },
  waiting: {
    type: Boolean,
    default: false,
  },
  hint: {
    type: Boolean,
    default: true,
  },
})
</script>

<template>
  <div>
    <p v-if="hint && waiting && !placeholder" class="mb-3 text-xs tracking-[0.16em] text-mute uppercase">
      Frase precedente
    </p>
    <p
      class="caption-translation"
      :class="{
        'is-placeholder': placeholder,
        'opacity-55': waiting && !placeholder,
      }"
      :lang="lang || undefined"
      dir="auto"
      aria-live="polite"
    >
      {{ text }}
    </p>
  </div>
</template>
