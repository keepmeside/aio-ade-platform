import { test, expect } from './helpers/aio-ade-app'
import { getStoreState, waitForSessionReady } from './helpers/store'

test.describe('usage overview', () => {
  test.beforeEach(async ({ aioAdePage }) => {
    await waitForSessionReady(aioAdePage)
  })

  test('Stats & Usage opens on the combined overview with provider controls', async ({
    aioAdePage
  }) => {
    await aioAdePage.evaluate(() => {
      const state = window.__store!.getState()
      state.openSettingsPage()
    })

    await expect
      .poll(async () => getStoreState<string>(aioAdePage, 'activeView'), { timeout: 5_000 })
      .toBe('settings')
    await aioAdePage.getByRole('button', { name: 'Stats & Usage' }).click()
    await expect(aioAdePage.getByRole('heading', { name: 'Usage Analytics' })).toBeVisible()
    const providerDropdown = aioAdePage.getByTestId('usage-provider-select')
    await expect(providerDropdown).toHaveAttribute(
      'aria-label',
      'Usage analytics provider: Overview'
    )
    await expect(aioAdePage.getByTestId('usage-overview-pane')).toBeVisible()
    await expect(aioAdePage.getByRole('heading', { name: 'Usage Overview' })).toBeVisible()
    await expect(aioAdePage.getByRole('heading', { name: 'Providers' })).toBeVisible()
    // Why: the native roster is Claude + Codex (phase 04 narrowed it); OpenCode
    // remains only as passive detection/usage history, with no Enable control.
    await expect(aioAdePage.getByRole('button', { name: 'Enable Claude' })).toBeVisible()
    await expect(aioAdePage.getByRole('button', { name: 'Enable Codex' })).toBeVisible()

    await providerDropdown.click()
    await aioAdePage.getByRole('menuitem', { name: 'Codex', exact: true }).click()
    await expect(aioAdePage.getByRole('heading', { name: 'Codex Usage Tracking' })).toBeVisible()
    await expect(providerDropdown).toHaveAttribute('aria-label', 'Usage analytics provider: Codex')
  })
})
