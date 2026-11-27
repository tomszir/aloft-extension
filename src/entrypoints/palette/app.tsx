import { createEffect, createMemo, createSignal, on, onCleanup } from 'solid-js'
import { actionEntries } from '../../app/action-entries'
import { useKeywords } from '../../app/use-keywords'
import { useSettings } from '../../app/use-settings'
import { useTheme } from '../../app/use-theme'
import { useZoomCorrection } from '../../app/use-zoom-correction'
import { availableActions } from '../../core/actions'
import { keywordHost } from '../../core/keywords'
import { EMPTY_LEARNED, learnedPages } from '../../core/learned'
import { dropIndex, moveIndex, pinnedRow } from '../../core/pinned'
import {
  applyInput,
  EMPTY_QUERY,
  enterKeyword,
  leaveChip,
  listedKeywords,
  offeredKeyword,
  type ParsedQuery,
  parseQuery,
  type QueryState,
  replayTyped,
} from '../../core/query'
import {
  type BookmarkEntry,
  buildSections,
  type ClosedEntry,
  flatten,
  type HistoryEntry,
  type Result,
  type TabEntry,
  tabResult,
} from '../../core/results'
import type { Settings } from '../../core/settings'
import { pageFavicon } from '../../platform/favicon'
import { loadLearned, savePick } from '../../platform/learned'
import type { HeldTyping, Submit } from '../../platform/messages'
import type { Disposition, HostTab } from '../../platform/open-result'
import {
  closeOverlay,
  closeTab,
  loadBookmarks,
  loadRecentHistory,
  loadRecentlyClosed,
  loadTabs,
  movePinned,
  openResult,
  openWhatsNew,
  runAction,
  searchBookmarks,
  searchHistory,
  takeTyped,
  unpin,
  watchTabs,
} from '../../platform/palette-api'
import { currentVersion, takeWhatsNewOffer } from '../../platform/whats-new'
import { type Move, Palette } from '../../ui/palette/palette'

// Long enough for the browser's searches; past it, Enter acts on what's shown.
const SUBMIT_WAIT_MS = 1000
// Enter pressed in the palette itself waits less: the person is watching.
const LIVE_ENTER_WAIT_MS = 300

function hashScheme(): 'light' | 'dark' | undefined {
  return location.hash === '#light' ? 'light' : location.hash === '#dark' ? 'dark' : undefined
}

/**
 * overlay: over a page, in a frame. tab: a tab Aloft opened because it
 * couldn't draw on the page (browser pages, the Web Store, the PDF viewer).
 * preview: a frame on the settings page, which shows real results but never
 * acts on them.
 */
export type Host = 'overlay' | 'tab' | 'preview'

export interface AppProps {
  host: Host
  hostTab: Promise<HostTab | undefined>
  /** As read before the first render, so it's drawn in the right theme. */
  settings: Settings
}

export function App(props: AppProps) {
  const { settings } = useSettings(props.settings)
  const { keywords, ready: keywordsReady } = useKeywords()
  // The settings page shows the preview in light or dark through the hash.
  const [previewScheme, setPreviewScheme] = createSignal(hashScheme())
  if (props.host === 'preview') {
    const onHash = () => setPreviewScheme(hashScheme())
    window.addEventListener('hashchange', onHash)
    onCleanup(() => window.removeEventListener('hashchange', onHash))
  }
  useTheme(settings, document.documentElement, () =>
    props.host === 'preview' ? previewScheme() : undefined,
  )
  if (props.host === 'overlay') useZoomCorrection(props.hostTab.then((tab) => tab?.id))

  const [hostTab, setHostTab] = createSignal<HostTab>()
  const [tabs, setTabs] = createSignal<TabEntry[]>([])
  const [closed, setClosed] = createSignal<ClosedEntry[]>([])
  const [history, setHistory] = createSignal<HistoryEntry[]>([])
  const [recentHistory, setRecentHistory] = createSignal<HistoryEntry[]>([])
  const [bookmarks, setBookmarks] = createSignal<BookmarkEntry[]>([])
  const [learned, setLearned] = createSignal(EMPTY_LEARNED)
  void props.hostTab.then(setHostTab)
  // Tab events come in bursts; only the newest read may land, or an older
  // one could bring back a tab that was just closed.
  let tabsRead = 0
  const readTabs = () => {
    const id = ++tabsRead
    return loadTabs().then((next) => {
      if (id === tabsRead) setTabs(next)
    })
  }
  const reloadTabs = () => void readTabs()
  // Pins move, hibernate and wake while Aloft is open; keep the row truthful.
  onCleanup(watchTabs(reloadTabs))
  void loadRecentlyClosed().then(setClosed)
  // What's read once on opening, and what an Enter typed before the palette
  // was ready waits for. Recent history and learned picks are read once
  // because the browser's own searches match whole words only, so these are
  // what initials and typos are matched against.
  const [opened, setOpened] = createSignal(false)
  void Promise.allSettled([
    readTabs(),
    loadRecentHistory().then(setRecentHistory),
    loadLearned().then(setLearned),
  ]).then(() => setOpened(true))
  // Reading every bookmark keeps the browser busy for long enough with a
  // large library (about 95 ms for 20,000) to delay the palette appearing, so
  // it waits until the palette has faded in; the browser's own word search
  // covers what's typed until then.
  const [allBookmarks, setAllBookmarks] = createSignal<BookmarkEntry[]>()
  const bookmarksTimer = setTimeout(() => {
    if (settings().sources.bookmarks) void loadBookmarks().then(setAllBookmarks)
  }, 150)
  onCleanup(() => clearTimeout(bookmarksTimer))

  // After an update, the footer mentions what's new the first time Aloft opens,
  // unless that's switched off. The preview leaves it out: it's on the very
  // page the link goes to.
  const [updated, setUpdated] = createSignal(false)
  if (props.host !== 'preview' && props.settings.whatsNewInAloft)
    void takeWhatsNewOffer(Date.now()).then(setUpdated)

  const [query, setQuery] = createSignal<QueryState>(EMPTY_QUERY)
  if (props.host === 'overlay') {
    // What was typed while the palette loaded was held on the page (see
    // prepareInPage), and so is a key that reaches the page after focus left
    // the frame. It's asked for on opening and whenever focus comes back.
    const takeHeld = async () => {
      const tab = await props.hostTab
      if (tab === undefined) return
      const { text, submit } = await takeTyped(tab.id).catch((): HeldTyping => ({ text: '' }))
      if (text === '') return
      // Read with the stored keywords, so "yt " typed early still makes its chip.
      await keywordsReady
      setQuery((q) => replayTyped(q, text, keywords()))
      if (submit) submitWhenSettled(submit)
    }
    const onFocus = () => void takeHeld()
    onFocus()
    window.addEventListener('focus', onFocus)
    onCleanup(() => window.removeEventListener('focus', onFocus))
  }
  const parsed = createMemo(() => parseQuery(query().text, query().chip))
  const offered = createMemo(() => offeredKeyword(query(), keywords()))
  const listed = createMemo(() => listedKeywords(query(), keywords()))

  // The query whose browser searches have landed, so its results are whole.
  const [settled, setSettled] = createSignal<ParsedQuery>()

  // Each keystroke starts a lookup; only the latest one may land, or a slow
  // early query could overwrite the results for what was typed after it.
  let lookup = 0
  createEffect(
    on(parsed, async (q) => {
      const id = ++lookup
      const searchable = q.kind === 'text' || (q.kind === 'keyword' && q.text !== '')
      if (!searchable) {
        setHistory([])
        setBookmarks([])
        setSettled(q)
        return
      }
      const { sources } = settings()
      const [h, b] = await Promise.all([
        // The site's name narrows the browser's own search to its pages.
        sources.history
          ? searchHistory(q.kind === 'keyword' ? `${keywordHost(q.keyword)} ${q.text}` : q.text)
          : [],
        // Once every bookmark is here, asking the browser again only costs time.
        sources.bookmarks && q.kind === 'text' && !allBookmarks() ? searchBookmarks(q.text) : [],
      ])
      if (id !== lookup) return
      setHistory(h)
      setBookmarks(b)
      setSettled(q)
    }),
  )

  const pinShortcuts = createMemo(() => {
    const windowId = hostTab()?.windowId
    if (!settings().pinned.showInAloft || windowId === undefined) return []
    return pinnedRow(tabs(), windowId)
  })
  // Like the canvas: the row belongs to the empty palette; typing hands the
  // space to results, while Alt+1–9 keeps working.
  const pins = createMemo(() => (parsed().kind === 'empty' ? pinShortcuts() : []))

  const actions = createMemo(() => {
    const host = hostTab()
    const inWindow = tabs().filter((t) => t.windowId === host?.windowId && t.tabId !== host?.id)
    return actionEntries(
      availableActions({
        overPage: props.host === 'overlay',
        hostPinned: tabs().some((t) => t.tabId === host?.id && t.pinned),
        otherTabsInWindow: inWindow.length,
        otherUnpinnedTabs: inWindow.filter((t) => !t.pinned).length,
        hasRecentlyClosed: closed().length > 0,
      }),
    )
  })

  const learning = () => settings().learnFromPicks
  const learnedForQuery = createMemo(() => {
    const q = parsed()
    return learning() && q.kind === 'text' ? learnedPages(learned(), q.text, Date.now()) : []
  })

  const sections = createMemo(() =>
    buildSections(
      parsed(),
      {
        tabs: tabs(),
        history: [...history(), ...recentHistory()],
        bookmarks: allBookmarks() ?? bookmarks(),
        closed: closed(),
        actions: actions(),
      },
      {
        sources: settings().sources,
        hostTabId: hostTab()?.id,
        pinnedRowShown: pins().length > 0,
        offeredKeyword: offered(),
        listedKeywords: listed(),
        learned: learnedForQuery(),
        now: Date.now(),
      },
    ),
  )
  const results = createMemo(() => flatten(sections()))

  const [activeId, setActiveId] = createSignal<string>()
  // A new query always starts at the top, where the best match is.
  createEffect(on(query, () => setActiveId(undefined)))
  const effectiveActiveId = createMemo(() => {
    const list = results()
    const id = activeId()
    return list.some((r) => r.id === id) ? id : list[0]?.id
  })

  const move = (direction: Move) => {
    const list = results()
    if (list.length === 0) return
    const current = list.findIndex((r) => r.id === effectiveActiveId())
    const next =
      direction === 'first'
        ? 0
        : direction === 'last'
          ? list.length - 1
          : (current + (direction === 'next' ? 1 : -1) + list.length) % list.length
    setActiveId(list[next]?.id)
  }

  async function close(): Promise<void> {
    const tab = hostTab() ?? (await props.hostTab)
    if (tab === undefined) return
    await (props.host === 'overlay' ? closeOverlay(tab.id) : closeTab(tab.id))
  }

  // Esc in the settings preview only clears: there's nothing to close.
  async function dismiss(): Promise<void> {
    if (props.host === 'preview') setQuery(EMPTY_QUERY)
    else await close()
  }

  // The selection moves to the row after the closed one, as in a list you're
  // working down, and the list catches up through the tab events it watches.
  async function closeResultTab(result: Extract<Result, { kind: 'tab' }>): Promise<void> {
    const list = results()
    const at = list.findIndex((r) => r.id === result.id)
    setActiveId((list[at + 1] ?? list[at - 1])?.id)
    setTabs((current) => current.filter((t) => t.tabId !== result.tabId))
    await closeTab(result.tabId)
    // It's now the most recently closed tab, for "Reopen closed tab".
    setClosed(await loadRecentlyClosed())
  }

  async function showWhatsNew(): Promise<void> {
    const host = hostTab() ?? (await props.hostTab)
    if (host === undefined) return
    await openWhatsNew(host)
    await close()
  }

  // One result at a time: a second Enter while the first is still opening
  // would open it again.
  let acting = false
  async function activate(result: Result, shift: boolean): Promise<void> {
    if (result.kind === 'keyword') {
      setQuery(enterKeyword(result.keyword))
      return
    }
    if (props.host === 'preview' || acting) return
    acting = true
    setSubmitting(undefined)
    try {
      await open(result, shift)
    } catch {
      // A page the browser wouldn't open; the palette shouldn't stay stuck.
      await close().catch(() => undefined)
    } finally {
      acting = false
    }
  }

  async function open(result: Result, shift: boolean): Promise<void> {
    const host = hostTab() ?? (await props.hostTab)
    if (host === undefined) return
    if (result.kind === 'action') {
      await runAction(result.action, { host, lastClosed: closed()[0] })
      await close()
      return
    }
    const preferred = settings().enterOpensIn
    const flipped: Disposition = preferred === 'new-tab' ? 'current-tab' : 'new-tab'
    // As its own tab, the palette already is the new tab.
    const disposition: Disposition =
      props.host === 'overlay' ? (shift ? flipped : preferred) : 'current-tab'

    const q = parsed()
    const learnable =
      learning() &&
      q.kind === 'text' &&
      (result.kind === 'tab' || result.kind === 'history' || result.kind === 'bookmark')
    // Saved alongside opening, not before it, so remembering never slows Enter.
    const [, replaced] = await Promise.all([
      learnable ? savePick(q.text, { url: result.url, title: result.title }) : undefined,
      openResult(result, disposition, {
        host,
        openTabs: tabs(),
        switchToOpenTabs: settings().switchToOpenTabs,
      }),
    ])
    // A page loading in the host tab replaces the palette; anything else
    // (switching tabs, a new tab, the same page) would leave it behind.
    if (!replaced) await close()
  }

  // Enter typed with the held text runs once the results for that text are
  // whole, so it opens what the palette would have shown on its top row. A
  // search that never answers doesn't keep it waiting for long.
  const [submitting, setSubmitting] = createSignal<Submit>()
  const [waitedOut, setWaitedOut] = createSignal(false)
  let submitTimer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(submitTimer))
  function submitWhenSettled(submit: Submit, wait = SUBMIT_WAIT_MS): void {
    clearTimeout(submitTimer)
    setWaitedOut(false)
    setSubmitting(submit)
    submitTimer = setTimeout(() => setWaitedOut(true), wait)
  }
  // Typing on changes what Enter was for; it waits for the next one.
  createEffect(on(query, () => setSubmitting(undefined), { defer: true }))
  const settledNow = () => opened() && settled() === parsed()
  createEffect(() => {
    const submit = submitting()
    if (!submit || !(settledNow() || waitedOut())) return
    setSubmitting(undefined)
    const top = results()[0]
    if (top) void activate(top, submit === 'shift-enter')
  })

  return (
    <Palette
      position={settings().appearance.position}
      query={query().text}
      chip={query().chip}
      sections={sections()}
      activeId={effectiveActiveId()}
      favicon={pageFavicon}
      onQuery={(text) => setQuery(applyInput(query(), text, keywords()))}
      onTab={() => {
        const active = results().find((r) => r.id === effectiveActiveId())
        const keyword = active?.kind === 'keyword' ? active.keyword : offered()
        if (keyword) setQuery(enterKeyword(keyword))
        return keyword !== undefined
      }}
      onLeaveChip={() => setQuery(leaveChip(query()))}
      onMove={move}
      onHover={setActiveId}
      onActivate={(result, shift) => {
        // Enter on the top row before the searches for this text have
        // answered waits for them, briefly, so it opens what the finished
        // list puts first rather than whatever arrived first.
        if (activeId() === undefined && !settledNow()) {
          submitWhenSettled(shift ? 'shift-enter' : 'enter', LIVE_ENTER_WAIT_MS)
          return
        }
        void activate(result, shift)
      }}
      onCloseTab={props.host === 'preview' ? undefined : (result) => void closeResultTab(result)}
      hostWindowId={hostTab()?.windowId}
      onClose={() => void dismiss()}
      enterOpensIn={
        props.host === 'overlay' || props.host === 'preview' ? settings().enterOpensIn : undefined
      }
      autofocus={props.host !== 'preview'}
      pins={pins()}
      pinShortcuts={pinShortcuts()}
      onOpenPin={(pin) => void activate(tabResult(pin), false)}
      onMovePin={(pin, direction) => {
        if (props.host === 'preview') return
        const index = moveIndex(pinShortcuts(), pin.tabId, direction)
        if (index !== undefined) void movePinned(pin.tabId, index)
      }}
      onReorderPin={
        // The preview never acts on what it shows, so its pins stay put.
        props.host === 'preview'
          ? undefined
          : (pin, position) => {
              const index = dropIndex(pinShortcuts(), position)
              if (index !== undefined) void movePinned(pin.tabId, index)
            }
      }
      onUnpin={(pin) => {
        if (props.host !== 'preview') void unpin(pin.tabId)
      }}
      whatsNew={updated() ? currentVersion() : undefined}
      onWhatsNew={() => void showWhatsNew()}
    />
  )
}
