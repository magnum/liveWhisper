import { getStore } from '@netlify/blobs'
import { emptySnapshot, snapshotFromBody } from '../../server/sessionSnapshot.js'

const STORE = 'livewhisper'
const KEY = 'captions'
const HOLD_MS = 6000
const POLL_MS = 400

function store() {
  return getStore({ name: STORE, consistency: 'strong' })
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Netlify-CDN-Cache-Control': 'no-store',
    },
  })
}

async function readSnapshot(captions) {
  const stored = await captions.get(KEY, { type: 'json' })
  if (!stored || typeof stored !== 'object') return emptySnapshot()
  return snapshotFromBody(stored, Number(stored.updatedAt) || 0)
}

async function waitForNewer(captions, since) {
  const deadline = Date.now() + HOLD_MS
  let current = await readSnapshot(captions)
  while (current.updatedAt <= since && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
    current = await readSnapshot(captions)
  }
  return current
}

export default async function handler(request) {
  try {
    const captions = store()
    if (request.method === 'GET') {
      const since = Number(new URL(request.url).searchParams.get('since'))
      const current = await waitForNewer(captions, Number.isFinite(since) ? since : 0)
      return json(current)
    }

    if (request.method !== 'POST') {
      return json({ error: 'Metodo non consentito.' }, 405)
    }

    const raw = await request.text()
    if (raw.length > 20_000) return json({ error: 'Testo troppo lungo.' }, 400)
    const body = raw ? JSON.parse(raw) : {}
    const previous = await readSnapshot(captions)
    const next = snapshotFromBody(body, Math.max(Date.now(), previous.updatedAt + 1))
    await captions.setJSON(KEY, next)
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sessione non disponibile.'
    const status = error instanceof SyntaxError ? 400 : 500
    return json({ error: message }, status)
  }
}
