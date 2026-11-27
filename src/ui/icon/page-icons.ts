// The icons only Aloft's own pages draw, kept out of the palette's bundle.
// Imported for its effect by the components that draw them.
import { addIcons } from './icons'

addIcons(
  import.meta.glob<string>(
    [
      './svg/arrow-left.svg',
      './svg/at-sign.svg',
      './svg/check.svg',
      './svg/external-link.svg',
      './svg/layers.svg',
      './svg/list.svg',
      './svg/monitor.svg',
      './svg/moon.svg',
      './svg/palette.svg',
      './svg/pencil.svg',
      './svg/shield-check.svg',
      './svg/sparkles.svg',
      './svg/sun.svg',
      './svg/trash-2.svg',
      './svg/upload.svg',
      './svg/x.svg',
    ],
    { query: '?raw', import: 'default', eager: true },
  ),
)
