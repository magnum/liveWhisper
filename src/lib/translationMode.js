// Il selettore del motore resta nel template. Finché è spento, la lezione usa solo il traduttore di Chrome.
export const showEnginePicker = false

export function resolveEngine(pref) {
  if (!showEnginePicker) return 'device'
  return pref
}
