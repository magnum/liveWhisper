import { onBeforeUnmount, onMounted, reactive, watch } from 'vue'

const ENDPOINT = '/api/session'

export function useCaptionPublish(source) {
  let timer = 0
  let lastBody = ''

  function payload(overrides = {}) {
    return {
      listening: source.listening.value,
      sourceText: source.sourceText.value,
      translationText: source.largeText.value,
      sourceId: source.sourceId.value,
      targetId: source.targetId.value,
      live: source.live.value,
      waiting: source.waiting.value,
      ...overrides,
    }
  }

  async function send(body) {
    if (body === lastBody) return
    lastBody = body
    try {
      await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
    } catch {
      lastBody = ''
    }
  }

  function schedule() {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      timer = 0
      void send(JSON.stringify(payload()))
    }, 40)
  }

  function leave() {
    window.clearTimeout(timer)
    timer = 0
    const body = JSON.stringify(payload({ listening: false, live: false }))
    lastBody = body
    if (typeof navigator.sendBeacon === 'function') {
      const sent = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))
      if (sent) return
    }
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    })
  }

  watch(
    [
      source.listening,
      source.sourceText,
      source.largeText,
      source.sourceId,
      source.targetId,
      source.live,
      source.waiting,
    ],
    schedule,
  )

  onMounted(() => {
    window.addEventListener('pagehide', leave)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('pagehide', leave)
    leave()
  })
}

export function useSharedCaptions() {
  const captions = reactive({
    listening: false,
    sourceText: '',
    translationText: '',
    sourceId: 'it',
    targetId: 'en',
    live: false,
    waiting: false,
    connected: false,
  })

  let stream

  function apply(data) {
    captions.listening = Boolean(data.listening)
    captions.sourceText = typeof data.sourceText === 'string' ? data.sourceText : ''
    captions.translationText = typeof data.translationText === 'string' ? data.translationText : ''
    captions.sourceId = typeof data.sourceId === 'string' && data.sourceId ? data.sourceId : 'it'
    captions.targetId = typeof data.targetId === 'string' && data.targetId ? data.targetId : 'en'
    captions.live = Boolean(data.live)
    captions.waiting = Boolean(data.waiting)
    captions.connected = true
  }

  onMounted(() => {
    stream = new EventSource(ENDPOINT)
    stream.onopen = () => {
      captions.connected = true
    }
    stream.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (!data || typeof data !== 'object') return
        apply(data)
      } catch {
        // Un evento illeggibile non deve cancellare l'ultima didascalia buona.
      }
    }
    stream.onerror = () => {
      captions.connected = stream?.readyState === EventSource.OPEN
    }
  })

  onBeforeUnmount(() => {
    stream?.close()
  })

  return captions
}
