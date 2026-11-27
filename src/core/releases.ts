import text from '../../CHANGELOG.md?raw'
import { parseChangelog } from './changelog'

/** Every release's notes, newest first, as bundled into the build. */
export const RELEASES = parseChangelog(text)
