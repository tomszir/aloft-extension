import { DEMO_VERSION } from '../version'

// The demo was never updated from anything, so there's no news to offer.
export const takeWhatsNewOffer = async (_now: number): Promise<boolean> => false
export const currentVersion = (): string => DEMO_VERSION
