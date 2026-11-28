import { expect, it } from 'vitest'

// Each Vitest project stands for one build, and code behind
// import.meta.env.FIREFOX has to see that build's value, not a truthy string.
it('sees the build target its test project stands for', ({ task }) => {
  expect(import.meta.env.FIREFOX).toBe(task.file.projectName === 'firefox')
  expect(import.meta.env.CHROME).toBe(task.file.projectName === 'chromium')
})
