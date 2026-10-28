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
  live: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <p class="caption-source" :class="{ 'is-placeholder': placeholder }" :lang="lang || undefined" dir="auto">
    {{ text }}<span v-if="live && !placeholder" class="caret" aria-hidden="true"></span>
  </p>
</template>
