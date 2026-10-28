import { translateBody } from '../../server/translateApi.js'

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return json({ error: 'Metodo non consentito.' }, 405)
  }

  try {
    const raw = await request.text()
    if (raw.length > 20_000) return json({ error: 'Testo troppo lungo.' }, 400)
    const body = raw ? JSON.parse(raw) : {}
    const translation = await translateBody(body)
    return json({ translation })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Traduzione non riuscita.'
    return json({ error: message }, 400)
  }
}
