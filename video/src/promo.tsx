import sora from '@fontsource-variable/sora/files/sora-latin-wght-normal.woff2'
import { loadFont } from '@remotion/fonts'
import type { CSSProperties, ReactNode } from 'react'
import {
  AbsoluteFill,
  Img,
  interpolate,
  Series,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import logo from '../../assets/brand/logo.svg'
import manifest from '../public/frames/manifest.json'

export const FPS = 30

// Bundled with the video rather than fetched, like the store screenshots.
void loadFont({ family: 'Sora', url: sora, weight: '100 900' })

interface Crop {
  x: number
  y: number
  width: number
  height: number
}

interface SceneFrames {
  crop: Crop
  frames: string[]
}

const scenes: Record<string, SceneFrames | undefined> = manifest.scenes
const viewport = manifest.viewport

function sceneFrames(name: string): SceneFrames {
  const scene = scenes[name]
  if (!scene) throw new Error(`no frames for "${name}"; run pnpm video:frames`)
  return scene
}

// The same navy, glows and type as the store screenshots, so the listing's
// video and images read as one set.
const COLORS = { text: '#FFFFFF', muted: '#C9D6F5', key: 'rgba(255,255,255,.12)' }

// The glows drift slowly, so held shots don't look frozen.
function Background() {
  const frame = useCurrentFrame()
  const drift = Math.sin(frame / 90) * 4
  return (
    <AbsoluteFill
      style={{
        background: [
          `radial-gradient(60% 55% at 50% ${62 + drift}%, rgba(47,111,235,.55) 0%, rgba(47,111,235,0) 70%)`,
          `radial-gradient(45% 50% at ${12 + drift}% 8%, rgba(124,92,255,.35) 0%, rgba(124,92,255,0) 70%)`,
          `radial-gradient(45% 50% at ${90 - drift}% 4%, rgba(56,189,248,.28) 0%, rgba(56,189,248,0) 70%)`,
          'linear-gradient(180deg, #0B1230 0%, #0A1A45 100%)',
        ].join(','),
      }}
    />
  )
}

/** Fades a scene in and out at its edges, so cuts become dissolves. */
function Scene(props: { duration: number; children: ReactNode }) {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 10, props.duration - 10, props.duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  return (
    <AbsoluteFill style={{ opacity, fontFamily: 'Sora, sans-serif' }}>
      {props.children}
    </AbsoluteFill>
  )
}

function useRise(delay = 0) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const progress = spring({ frame: frame - delay, fps, config: { damping: 200 } })
  return { opacity: progress, transform: `translateY(${(1 - progress) * 28}px)` }
}

function Key(props: { children: ReactNode; pressAt?: number }) {
  const frame = useCurrentFrame()
  const press =
    props.pressAt === undefined
      ? 0
      : interpolate(frame, [props.pressAt, props.pressAt + 3, props.pressAt + 9], [0, 1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 44,
        height: 44,
        padding: '0 12px',
        margin: '0 4px',
        boxSizing: 'border-box',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,.22)',
        background: press > 0 ? `rgba(47,111,235,${0.25 + press * 0.6})` : COLORS.key,
        color: COLORS.text,
        fontSize: 22,
        fontWeight: 600,
        transform: `translateY(${press * 3}px)`,
        boxShadow: `0 ${4 - press * 3}px 0 rgba(0,0,0,.35)`,
        verticalAlign: 'middle',
      }}
    >
      {props.children}
    </span>
  )
}

function Header(props: { title: string; children: ReactNode }) {
  const title = useRise(0)
  const text = useRise(6)
  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18,
        textAlign: 'center',
        color: COLORS.text,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: 64,
          fontWeight: 650,
          lineHeight: 1.1,
          letterSpacing: '-0.03em',
          ...title,
        }}
      >
        {props.title}
      </h1>
      <p style={{ margin: 0, fontSize: 28, lineHeight: 1.4, color: COLORS.muted, ...text }}>
        {props.children}
      </p>
    </div>
  )
}

const SCALE = 1.7
const SHOT_TOP = 236

/**
 * The scene's stills, cropped to the palette and stepped through on schedule:
 * still `i` shows from frame `at[i]`, dissolving in over `fade` frames (0 for
 * keystrokes, which change instantly in the real thing too).
 */
function Shot(props: { scene: string; at: readonly number[]; fade?: number }) {
  const frame = useCurrentFrame()
  const { crop, frames } = sceneFrames(props.scene)
  const rise = useRise(4)
  let current = 0
  props.at.forEach((start, i) => {
    if (frame >= start) current = i
  })
  const start = props.at[current] ?? 0
  const fade = props.fade ?? 0
  const incoming =
    fade === 0
      ? 1
      : interpolate(frame, [start, start + fade], [0, 1], { extrapolateRight: 'clamp' })
  const px = (n: number) => Math.round(n * SCALE)
  const card: CSSProperties = {
    position: 'absolute',
    top: SHOT_TOP,
    left: '50%',
    width: px(crop.width),
    height: px(crop.height),
    marginLeft: -px(crop.width) / 2,
    overflow: 'hidden',
    borderRadius: 26,
    boxShadow: '0 50px 120px rgba(2,6,23,.7), 0 0 0 1px rgba(255,255,255,.12)',
    ...rise,
  }
  return (
    <div style={card}>
      {frames.map((name, i) => {
        const opacity = i === current ? incoming : i === current - 1 ? 1 : 0
        return (
          <Img
            key={name}
            src={staticFile(`frames/${name}`)}
            style={{
              position: 'absolute',
              left: -px(crop.x),
              top: -px(crop.y),
              width: px(viewport.width),
              height: px(viewport.height),
              opacity,
              zIndex: i === current ? 2 : 1,
            }}
          />
        )
      })}
    </div>
  )
}

function Brand(props: { tagline: string; footer?: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 120 } })
  const name = useRise(8)
  const tagline = useRise(16)
  const footer = useRise(26)
  return (
    <AbsoluteFill
      style={{ alignItems: 'center', justifyContent: 'center', gap: 28, color: COLORS.text }}
    >
      <Img
        src={logo}
        style={{
          width: 168,
          height: 168,
          transform: `scale(${0.6 + pop * 0.4})`,
          opacity: pop,
          filter: 'drop-shadow(0 24px 60px rgba(47,111,235,.55))',
        }}
      />
      <div
        style={{ fontSize: 104, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, ...name }}
      >
        Aloft
      </div>
      <div style={{ fontSize: 34, color: COLORS.muted, ...tagline }}>{props.tagline}</div>
      {props.footer ? (
        <div style={{ marginTop: 24, fontSize: 26, color: COLORS.muted, ...footer }}>
          {props.footer}
        </div>
      ) : null}
    </AbsoluteFill>
  )
}

/** Still `i` at `start + i * step`, for keystrokes. */
const steps = (count: number, start: number, step: number) =>
  Array.from({ length: count }, (_, i) => start + i * step)

const TIMING = {
  intro: 75,
  open: 120,
  search: 150,
  actions: 120,
  themes: 165,
  outro: 120,
}

export const promoDuration = Object.values(TIMING).reduce((a, b) => a + b, 0)

const OPEN_AT = 40

export function Promo() {
  const search = sceneFrames('search').frames.length
  const actions = sceneFrames('actions').frames.length
  const themes = sceneFrames('themes').frames.length
  return (
    <AbsoluteFill>
      <Background />
      <Series>
        <Series.Sequence durationInFrames={TIMING.intro}>
          <Scene duration={TIMING.intro}>
            <Brand tagline="A command bar that floats over the page you’re on" />
          </Scene>
        </Series.Sequence>
        <Series.Sequence durationInFrames={TIMING.open}>
          <Scene duration={TIMING.open}>
            <Header title="Opens over any page">
              Press <Key pressAt={OPEN_AT - 4}>Alt</Key>
              <Key pressAt={OPEN_AT - 4}>Q</Key> or <Key>Ctrl</Key>
              <Key>T</Key> and keep your place
            </Header>
            <Shot scene="open" at={[0, OPEN_AT]} fade={6} />
          </Scene>
        </Series.Sequence>
        <Series.Sequence durationInFrames={TIMING.search}>
          <Scene duration={TIMING.search}>
            <Header title="One search for everything">
              Open tabs, history, bookmarks and recently closed tabs, best match first
            </Header>
            {/* Typing, then a pause before ↓ moves the selection. */}
            <Shot scene="search" at={[...steps(search - 1, 18, 5), 18 + (search - 1) * 5 + 30]} />
          </Scene>
        </Series.Sequence>
        <Series.Sequence durationInFrames={TIMING.actions}>
          <Scene duration={TIMING.actions}>
            <Header title="Type > to act on the tab">
              Pin, duplicate, move or close tabs without reaching for the mouse
            </Header>
            <Shot scene="actions" at={[0, ...steps(actions - 1, 34, 6)]} />
          </Scene>
        </Series.Sequence>
        <Series.Sequence durationInFrames={TIMING.themes}>
          <Scene duration={TIMING.themes}>
            <Header title="Made to match your browser">
              Six themes, light and dark, previewed live in settings
            </Header>
            <Shot scene="themes" at={steps(themes, 0, 24)} fade={8} />
          </Scene>
        </Series.Sequence>
        <Series.Sequence durationInFrames={TIMING.outro}>
          <Scene duration={TIMING.outro}>
            <Brand
              tagline="For Helium and every Chromium browser"
              footer="Private by design · open source on GitHub"
            />
          </Scene>
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  )
}
