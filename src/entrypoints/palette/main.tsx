import { mountPalette } from './mount'

const host = new URLSearchParams(location.search).get('host')
void mountPalette(host === 'tab' || host === 'preview' ? host : 'overlay')
