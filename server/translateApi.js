const MEMORY_URL = 'https://api.mymemory.translated.net/get'
const MEMORY_LIMIT = 420

export function sendJson(response, status, payload) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

export function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let settled = false

    const fail = (error) => {
      if (settled) return
      settled = true
      reject(error)
    }

    const succeed = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    request.on('data', (chunk) => {
      size += chunk.length
      if (size > 20_000) {
        fail(new Error('Testo troppo lungo.'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })

    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        succeed(raw ? JSON.parse(raw) : {})
      } catch {
        fail(new Error('Richiesta non valida.'))
      }
    })

    request.on('error', fail)
  })
}

function chunkText(text, limit) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= limit) return [clean]

  const sentences = clean.split(/(?<=[.!?。！？])\s+/)
  const chunks = []
  let current = ''

  for (const sentence of sentences) {
    const piece = sentence.trim()
    if (!piece) continue
    if (piece.length > limit) {
      if (current) chunks.push(current)
      for (let index = 0; index < piece.length; index += limit) {
        chunks.push(piece.slice(index, index + limit))
      }
      current = ''
      continue
    }
    if (`${current} ${piece}`.trim().length > limit) {
      if (current) chunks.push(current)
      current = piece
      continue
    }
    current = current ? `${current} ${piece}` : piece
  }

  if (current) chunks.push(current)
  return chunks
}

function decodeHtml(value) {
  return value
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

async function translateMyMemory(text, source, target) {
  const parts = []

  for (const chunk of chunkText(text, MEMORY_LIMIT)) {
    const url = new URL(MEMORY_URL)
    url.searchParams.set('q', chunk)
    url.searchParams.set('langpair', `${source}|${target}`)

    const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) {
      throw new Error('MyMemory non risponde. Riprovo alla prossima frase.')
    }

    const data = await response.json()
    const translated = data?.responseData?.translatedText
    if (!translated || String(translated).includes('MYMEMORY WARNING')) {
      throw new Error(
        'MyMemory ha raggiunto il limite gratuito di oggi. Usa la traduzione sul dispositivo oppure DeepL.',
      )
    }
    parts.push(decodeHtml(String(translated)))
  }

  return parts.join(' ')
}

async function translateDeepL(text, source, target, key) {
  const authKey = String(key ?? '').trim()
  if (!authKey) {
    throw new Error('Incolla la chiave API di DeepL per usare questo motore.')
  }

  const endpoint = authKey.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate'
  const form = new URLSearchParams()
  form.set('text', text)
  form.set('source_lang', source)
  form.set('target_lang', target)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${authKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
    signal: AbortSignal.timeout(8000),
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'DeepL ha rifiutato la richiesta. Controlla la chiave API.')
  }

  const translated = data.translations?.[0]?.text
  if (!translated) throw new Error('DeepL non ha restituito una traduzione.')
  return translated
}

export async function translateBody(body) {
  const text = String(body.text ?? '').trim()
  if (!text) throw new Error('Nessun testo da tradurre.')

  switch (body.provider) {
    case 'mymemory':
      return translateMyMemory(text, body.source, body.target)
    case 'deepl':
      return translateDeepL(text, body.source, body.target, body.deeplKey)
    default:
      throw new Error('Motore di traduzione sconosciuto.')
  }
}

export function attachTranslationApi(middlewares) {
  middlewares.use('/api/translate', async (request, response, next) => {
    if (request.method === 'OPTIONS') {
      response.statusCode = 204
      response.end()
      return
    }
    if (request.method !== 'POST') {
      next()
      return
    }

    try {
      const body = await readBody(request)
      const translation = await translateBody(body)
      sendJson(response, 200, { translation })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Traduzione non riuscita.'
      sendJson(response, 400, { error: message })
    }
  })
}
