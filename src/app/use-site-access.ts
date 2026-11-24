import { type Accessor, createSignal, onCleanup } from 'solid-js'
import { hasSiteAccess, requestSiteAccess, watchSiteAccess } from '../platform/permissions'
import type { AccessState } from '../ui/onboarding/onboarding'

export interface SiteAccessHandle {
  access: Accessor<AccessState>
  /** Must run from a click: the browser only shows the prompt for a user gesture. */
  request: () => void
}

export function useSiteAccess(): SiteAccessHandle {
  const [access, setAccess] = createSignal<AccessState>('unknown')
  void hasSiteAccess().then((granted) => setAccess(granted ? 'granted' : 'not-asked'))
  // Also catches access granted or revoked on the browser's own pages.
  onCleanup(watchSiteAccess((granted) => setAccess(granted ? 'granted' : 'not-asked')))
  return {
    access,
    request: () => void requestSiteAccess().then((ok) => setAccess(ok ? 'granted' : 'denied')),
  }
}
