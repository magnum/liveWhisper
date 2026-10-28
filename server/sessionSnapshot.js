function asCaption(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u001F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000)
}

function asLang(value, fallback) {
  if (typeof value !== 'string') return fallback
  const clean = value.trim()
  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(clean)) return fallback
  return clean
}

export function emptySnapshot() {
  return {
    listening: false,
    sourceText: '',
    translationText: '',
    sourceId: 'it',
    targetId: 'en',
    live: false,
    waiting: false,
    updatedAt: 0,
  }
}

export function snapshotFromBody(body, updatedAt) {
  const source = body && typeof body === 'object' ? body : {}
  return {
    listening: Boolean(source.listening),
    sourceText: asCaption(source.sourceText),
    translationText: asCaption(source.translationText),
    sourceId: asLang(source.sourceId, 'it'),
    targetId: asLang(source.targetId, 'en'),
    live: Boolean(source.live),
    waiting: Boolean(source.waiting),
    updatedAt,
  }
}
