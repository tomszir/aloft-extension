import { mountPalette } from './mount'

const host = new URLSearchParams(location.search).get('host')
mountPalette(host === 'tab' || host === 'preview' ? host : 'overlay')
