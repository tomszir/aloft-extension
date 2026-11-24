import { i18n } from '#i18n'
import { newTabStays, takeFocusFromAddressBar } from '../../platform/newtab-page'
import { mountPalette } from '../palette/mount'

// Ctrl+T normally reopens Aloft over the previous tab and closes this one
// (see platform/newtab-intercept.ts). It stays only when that isn't possible,
// and then it's the palette itself, drawn only once that's known so a tab
// about to close doesn't flash it.
document.title = i18n.t('newTabTitle')
void newTabStays().then(() => {
  if (!takeFocusFromAddressBar()) mountPalette('newtab')
})
