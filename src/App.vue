<script setup>
import ListenView from './views/ListenView.vue'
import SpeakerView from './views/SpeakerView.vue'

const path = window.location.pathname.replace(/\/+$/, '') || '/'
const listen = path === '/listen'
</script>

<template>
  <ListenView v-if="listen" />
  <SpeakerView v-else />
</template>
