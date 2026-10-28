import os from 'node:os'
import { emptySnapshot, snapshotFromBody } from './sessionSnapshot.js'
import { readBody, sendJson } from './translateApi.js'

const waiters = new Set()
let snapshot = emptySnapshot()
let clock = 0

function nextStamp() {
  const now = Date.now()
  clock = now > clock ? now : clock + 1
  return clock
}

function publish(body) {
  snapshot = snapshotFromBody(body, nextStamp())
  for (const waiter of [...waiters]) waiter()
}

function sinceFrom(request) {
  const raw = request.url ?? ''
  const query = raw.includes('?') ? raw.slice(raw.indexOf('?')) : ''
  const since = Number(new URLSearchParams(query).get('since'))
  return Number.isFinite(since) ? since : 0
}

// Una funzione Netlify non può tenere aperto un flusso per tutta la lezione.
// Chi ascolta aspetta al massimo qualche secondo, poi ripete la richiesta.
function waitForNewer(since, response) {
  if (snapshot.updatedAt > since) return Promise.resolve(true)
  return new Promise((resolve) => {
    let settled = false
    const finish = (open) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      waiters.delete(wake)
      response.removeListener('close', onClose)
      resolve(open)
    }
    const wake = () => finish(true)
    const onClose = () => finish(false)
    const timer = setTimeout(() => finish(true), 6000)
    waiters.add(wake)
    response.on('close', onClose)
  })
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
        const open = await waitForNewer(sinceFrom(request), response)
        if (!open || response.writableEnded) return
        sendJson(response, 200, snapshot)
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
