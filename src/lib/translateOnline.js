export async function translateOnline(payload, signal) {
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Traduzione non riuscita.')
  }
  return String(data.translation ?? '').trim()
}
