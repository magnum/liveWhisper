import os from 'node:os'
import { readBody, sendJson } from './translateApi.js'

const clients = new Set()

let snapshot = {
  listening: false,
  sourceText: '',
  translationText: '',
  sourceId: 'it',
  targetId: 'en',
  live: false,
  waiting: false,
}

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

function publish(body) {
  snapshot = {
    listening: Boolean(body.listening),
    sourceText: asCaption(body.sourceText),
    translationText: asCaption(body.translationText),
    sourceId: asLang(body.sourceId, 'it'),
    targetId: asLang(body.targetId, 'en'),
    live: Boolean(body.live),
    waiting: Boolean(body.waiting),
  }

  const chunk = `data: ${JSON.stringify(snapshot)}\n\n`
  for (const client of clients) {
    try {
      client.write(chunk)
    } catch {
      clients.delete(client)
    }
  }
}

function openStream(request, response) {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  request.socket?.setTimeout(0)
  response.write(`retry: 2000\ndata: ${JSON.stringify(snapshot)}\n\n`)
  clients.add(response)

  const beat = setInterval(() => {
    if (response.writableEnded) {
      close()
      return
    }
    response.write(': ping\n\n')
  }, 15000)

  let closed = false
  function close() {
    if (closed) return
    closed = true
    clearInterval(beat)
    clients.delete(response)
  }

  request.on('close', close)
  response.on('close', close)
}

function rankAddress(item) {
  const virtual =
    item.name.startsWith('utun') ||
    item.name.startsWith('awdl') ||
    item.name.startsWith('llw') ||
    item.name.startsWith('bridge') ||
    item.name.startsWith('vmnet')
  let score = virtual ? 10 : 0
  if (item.address.startsWith('192.168.')) return score
  if (item.address.startsWith('10.')) return score + 1
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(item.address)) return score + 2
  return score + 3
}

function lanIPv4() {
  const found = []
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      const isV4 = entry.family === 'IPv4' || entry.family === 4
      if (!isV4 || entry.internal) continue
      found.push({ name, address: entry.address })
    }
  }
  found.sort((left, right) => rankAddress(left) - rankAddress(right))
  return found[0]?.address ?? ''
}

function isLoopback(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === ''
}

// Un telefono non apre localhost: se la pagina è sul computer dello speaker, il QR usa l'indirizzo di rete.
export function listenUrlFor(request, getPort) {
  const forwarded = request.headers['x-forwarded-proto']
  const proto = forwarded === 'https' ? 'https' : 'http'
  const hostHeader = String(request.headers.host ?? '')
  const hostname = hostHeader.replace(/:\d+$/, '').replace(/^\[|\]$/g, '')
  if (hostHeader && !isLoopback(hostname)) return `${proto}://${hostHeader}/listen`
  const lan = lanIPv4()
  const port = getPort()
  if (lan) return `http://${lan}:${port}/listen`
  if (hostHeader) return `${proto}://${hostHeader}/listen`
  return `http://localhost:${port}/listen`
}

export function attachSessionApi(middlewares, { getPort }) {
  middlewares.use('/api/listen-url', (request, response, next) => {
    if (request.method !== 'GET') {
      next()
      return
    }
    sendJson(response, 200, { url: listenUrlFor(request, getPort) })
  })

  middlewares.use('/api/session', async (request, response, next) => {
    try {
      if (request.method === 'GET') {
        openStream(request, response)
        return
      }
      if (request.method !== 'POST') {
        next()
        return
      }
      const body = await readBody(request)
      publish(body)
      response.statusCode = 204
      response.end()
    } catch (error) {
      if (response.headersSent) return
      const message = error instanceof Error ? error.message : 'Richiesta non valida.'
      sendJson(response, 400, { error: message })
    }
  })
}
