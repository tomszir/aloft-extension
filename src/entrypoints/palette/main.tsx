import { mountPalette } from './mount'

mountPalette(new URLSearchParams(location.search).get('host') === 'tab' ? 'tab' : 'overlay')
