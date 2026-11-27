declare const __ALOFT_VERSION__: string | undefined

/** The Aloft version the demo was built from, set by the demo build. */
export const DEMO_VERSION: string =
  typeof __ALOFT_VERSION__ === 'string' ? __ALOFT_VERSION__ : 'dev'
