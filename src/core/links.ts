// Where Aloft points people for more: plain links they choose to open. Aloft
// itself never fetches them.
const REPOSITORY = 'https://github.com/tomszir/aloft-extension'

export const LINKS = {
  source: REPOSITORY,
  privacy: `${REPOSITORY}/blob/main/PRIVACY.md`,
  permissions: `${REPOSITORY}/blob/main/docs/permissions.md`,
  author: 'https://tomszir.com',
} as const

/** Who made Aloft, as credited on the settings page: a name, so not translated. */
export const AUTHOR = 'tomszir'
