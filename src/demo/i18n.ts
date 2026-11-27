import messages from 'virtual:aloft-messages'

// The demo build points `#i18n` here: there's no browser.i18n on a web page,
// so the messages are bundled instead, read the way @wxt-dev/i18n reads them.

/** Keys of src/demo/locales/en.yml; i18n.test.ts checks the two agree. */
export const DEMO_KEYS = [
  'demoLabel',
  'tourLabel',
  'tourStepCount',
  'tourNext',
  'tourSkip',
  'tourFinish',
  'tourStepDone',
  'tourSearchTitle',
  'tourSearchBody',
  'tourPinTitle',
  'tourPinBody',
  'tourPinBodyTouch',
  'tourActionsTitle',
  'tourActionsBody',
  'tourSiteTitle',
  'tourSiteBody',
  'tourThemeTitle',
  'tourThemeBody',
  'tourThemePicker',
  'wouldSwitch',
  'wouldOpenNewTab',
  'wouldOpenHere',
  'wouldSearch',
  'wouldReopen',
  'wouldRun',
] as const

export type DemoKey = (typeof DEMO_KEYS)[number]

/** `$1`… replaced by `substitutions`; without them the placeholders stay, for callers that fill them with markup. */
function message(key: string, substitutions?: readonly string[]): string {
  const text = messages[key.replaceAll('.', '_')] ?? ''
  if (!substitutions) return text
  return text.replace(/\$(\d)/g, (_, n: string) => substitutions[Number(n) - 1] ?? '')
}

/** Same calls as @wxt-dev/i18n's `t`: a substitution array, and a count for plurals. */
function translate(key: string, ...args: unknown[]): string {
  let substitutions: string[] | undefined
  let count: number | undefined
  for (const arg of args) {
    if (typeof arg === 'number') count = arg
    else if (Array.isArray(arg)) substitutions = arg.map(String)
  }
  if (count !== undefined && substitutions === undefined) substitutions = [String(count)]
  const text = message(key, substitutions)
  if (count === undefined) return text
  const forms = text.split(' | ')
  if (forms.length === 2) return forms[count === 1 ? 0 : 1] ?? text
  if (forms.length === 3) return forms[count === 0 || count === 1 ? count : 2] ?? text
  return text
}

export const i18n = { t: translate }

/** The demo's own strings. */
export const t = (key: DemoKey, substitutions?: readonly string[]): string =>
  message(key, substitutions)
