import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { SettingRow } from './setting-row'

describe('SettingRow', () => {
  it('names its control by its label', () => {
    render(() => (
      <SettingRow label="Density" labelId="density" description="How tall rows are">
        <fieldset aria-labelledby="density" />
      </SettingRow>
    ))
    expect(screen.getByRole('group', { name: 'Density' })).toBeTruthy()
    expect(screen.getByText('How tall rows are')).toBeTruthy()
  })
})
