/**
 * Regression: a worktree created through the local runtime must appear in the
 * sidebar even while another runtime environment is active.
 */

import { test, expect } from './helpers/orca-app'
import { LocalRuntimeRpcClient } from './helpers/local-runtime-rpc-client'
import { waitForSessionReady, waitForActiveWorktree } from './helpers/store'

test.describe('worktree visibility with a remote runtime active', () => {
  test('a runtime-created local worktree appears while a remote runtime is active', async ({
    orcaPage,
    electronApp
  }) => {
    await waitForSessionReady(orcaPage)
    await waitForActiveWorktree(orcaPage)

    const repoId = await orcaPage.evaluate(() => {
      const repos = window.__store?.getState().repos ?? []
      const target = repos.find(
        (repo) => (repo.executionHostId ?? 'local') === 'local' && !repo.connectionId
      )
      if (!target) {
        throw new Error('expected a seeded local-host repo')
      }
      return target.id
    })

    const userDataPath = await electronApp.evaluate(({ app }) => app.getPath('userData'))
    const client = new LocalRuntimeRpcClient(userDataPath)
    const createViaRuntime = async (name: string): Promise<string> => {
      const response = await client.call<{ worktree: { id: string } }>('worktree.create', {
        repo: `id:${repoId}`,
        name,
        noParent: true,
        activate: false
      })
      return response.result.worktree.id
    }
    const worktreeRow = (worktreeId: string) =>
      orcaPage.locator(`[data-worktree-id=${JSON.stringify(worktreeId)}]`).first()

    const controlId = await createViaRuntime(`wt-control-${Date.now()}`)
    await expect(worktreeRow(controlId)).toBeVisible({ timeout: 15_000 })

    await orcaPage.evaluate(() => {
      window.__store?.setState((current) => ({
        settings: { ...current.settings, activeRuntimeEnvironmentId: 'e2e-fake-runtime' }
      }))
    })

    const targetId = await createViaRuntime(`wt-runtime-active-${Date.now()}`)
    await expect(
      worktreeRow(targetId),
      'a local runtime-created worktree must appear while a remote runtime is active'
    ).toBeVisible({ timeout: 15_000 })
  })
})
