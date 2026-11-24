import { Composition } from 'remotion'
import { FPS, Promo, promoDuration } from './promo'

export function Root() {
  return (
    <Composition
      id="Promo"
      component={Promo}
      width={1920}
      height={1080}
      fps={FPS}
      durationInFrames={promoDuration}
    />
  )
}
