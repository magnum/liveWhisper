export const LANGUAGES = [
  {
    id: 'it',
    label: 'Italiano',
    speech: 'it-IT',
    memory: 'it',
    deeplSource: 'IT',
    deeplTarget: 'IT',
    sample:
      'Buongiorno a tutti. Oggi vediamo un problema passo per passo, e alla fine lo risolviamo insieme.',
  },
  {
    id: 'en',
    label: 'Inglese',
    speech: 'en-US',
    memory: 'en',
    deeplSource: 'EN',
    deeplTarget: 'EN-US',
    sample:
      'Good morning everyone. Today we will walk through a problem step by step, and then solve it together.',
  },
  {
    id: 'fr',
    label: 'Francese',
    speech: 'fr-FR',
    memory: 'fr',
    deeplSource: 'FR',
    deeplTarget: 'FR',
    sample:
      'Bonjour à toutes et à tous. Aujourd’hui nous voyons un problème pas à pas, puis nous le résolvons ensemble.',
  },
  {
    id: 'es',
    label: 'Spagnolo',
    speech: 'es-ES',
    memory: 'es',
    deeplSource: 'ES',
    deeplTarget: 'ES',
    sample:
      'Buenos días a todos. Hoy vemos un problema paso a paso y al final lo resolvemos juntos.',
  },
  {
    id: 'de',
    label: 'Tedesco',
    speech: 'de-DE',
    memory: 'de',
    deeplSource: 'DE',
    deeplTarget: 'DE',
    sample:
      'Guten Morgen zusammen. Heute gehen wir eine Aufgabe Schritt für Schritt durch und lösen sie am Ende gemeinsam.',
  },
  {
    id: 'pt',
    label: 'Portoghese',
    speech: 'pt-PT',
    memory: 'pt',
    deeplSource: 'PT',
    deeplTarget: 'PT-PT',
    sample:
      'Bom dia a todos. Hoje vemos um problema passo a passo e no fim resolvemo-lo juntos.',
  },
  {
    id: 'zh',
    label: 'Cinese',
    speech: 'zh-CN',
    memory: 'zh-CN',
    deeplSource: 'ZH',
    deeplTarget: 'ZH',
    sample: '大家早上好。今天我们一步一步看一道题，最后一起把它解出来。',
  },
  {
    id: 'ar',
    label: 'Arabo',
    speech: 'ar-SA',
    memory: 'ar',
    deeplSource: 'AR',
    deeplTarget: 'AR',
    sample: 'صباح الخير جميعًا. اليوم نرى مسألة خطوة بخطوة، ثم نحلها معًا.',
  },
  {
    id: 'ru',
    label: 'Russo',
    speech: 'ru-RU',
    memory: 'ru',
    deeplSource: 'RU',
    deeplTarget: 'RU',
    sample:
      'Доброе утро. Сегодня мы разберём задачу шаг за шагом, а в конце решим её вместе.',
  },
  {
    id: 'uk',
    label: 'Ucraino',
    speech: 'uk-UA',
    memory: 'uk',
    deeplSource: 'UK',
    deeplTarget: 'UK',
    sample:
      'Доброго ранку. Сьогодні розберемо задачу крок за кроком, а наприкінці розв’яжемо її разом.',
  },
  {
    id: 'ro',
    label: 'Rumeno',
    speech: 'ro-RO',
    memory: 'ro',
    deeplSource: 'RO',
    deeplTarget: 'RO',
    sample:
      'Bună dimineața tuturor. Astăzi vedem o problemă pas cu pas, iar la final o rezolvăm împreună.',
  },
  {
    id: 'pl',
    label: 'Polacco',
    speech: 'pl-PL',
    memory: 'pl',
    deeplSource: 'PL',
    deeplTarget: 'PL',
    sample:
      'Dzień dobry wszystkim. Dziś przechodzimy zadanie krok po kroku, a na końcu rozwiązujemy je razem.',
  },
  {
    id: 'tr',
    label: 'Turco',
    speech: 'tr-TR',
    memory: 'tr',
    deeplSource: 'TR',
    deeplTarget: 'TR',
    sample:
      'Herkese günaydın. Bugün bir soruyu adım adım göreceğiz ve sonunda birlikte çözeceğiz.',
  },
  {
    id: 'ja',
    label: 'Giapponese',
    speech: 'ja-JP',
    memory: 'ja',
    deeplSource: 'JA',
    deeplTarget: 'JA',
    sample: '皆さん、おはようございます。今日は問題を一つずつ見て、最後に一緒に解きます。',
  },
  {
    id: 'ko',
    label: 'Coreano',
    speech: 'ko-KR',
    memory: 'ko',
    deeplSource: 'KO',
    deeplTarget: 'KO',
    sample: '모두 좋은 아침입니다. 오늘은 문제를 단계별로 보고, 마지막에 함께 풀어 봅니다.',
  },
  {
    id: 'nl',
    label: 'Olandese',
    speech: 'nl-NL',
    memory: 'nl',
    deeplSource: 'NL',
    deeplTarget: 'NL',
    sample:
      'Goedemorgen allemaal. Vandaag bekijken we een opgave stap voor stap en lossen we die daarna samen op.',
  },
  {
    id: 'el',
    label: 'Greco',
    speech: 'el-GR',
    memory: 'el',
    deeplSource: 'EL',
    deeplTarget: 'EL',
    sample:
      'Καλημέρα σε όλους. Σήμερα βλέπουμε ένα πρόβλημα βήμα βήμα και στο τέλος το λύνουμε μαζί.',
  },
  {
    id: 'sv',
    label: 'Svedese',
    speech: 'sv-SE',
    memory: 'sv',
    deeplSource: 'SV',
    deeplTarget: 'SV',
    sample:
      'God morgon allihop. I dag går vi igenom ett problem steg för steg och löser det tillsammans till slut.',
  },
]

const byId = new Map(LANGUAGES.map((language) => [language.id, language]))

export function findLanguage(id) {
  return byId.get(id) ?? LANGUAGES[0]
}
