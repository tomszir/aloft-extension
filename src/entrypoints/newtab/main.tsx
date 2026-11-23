import { i18n } from '#i18n'
import { mountPalette } from '../palette/mount'

// Ctrl+T normally reopens Aloft over the previous tab and closes this one
// (see platform/newtab-intercept.ts). It stays only when that isn't possible,
// and then it's the palette itself.
document.title = i18n.t('newTabTitle')
mountPalette('newtab')
