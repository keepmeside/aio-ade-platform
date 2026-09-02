import { expect, test } from './helpers/aio-ade-app'
import { openFileExplorer } from './helpers/file-explorer'
import { pressShortcut } from './helpers/shortcuts'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

test('Explorer-opened Markdown accepts the find shortcut without a document click', async ({
  aioAdePage
}) => {
  await waitForSessionReady(aioAdePage)
  await waitForActiveWorktree(aioAdePage)
  await openFileExplorer(aioAdePage)

  const readmeRow = aioAdePage.locator('[data-file-explorer-row]').filter({ hasText: 'README.md' })
  await expect(readmeRow).toBeVisible({ timeout: 10_000 })
  await readmeRow.focus()
  await readmeRow.click()

  await expect(aioAdePage.locator('.rich-markdown-editor')).toBeVisible({ timeout: 25_000 })
  await pressShortcut(aioAdePage, 'f')

  await expect(
    aioAdePage.getByRole('textbox', { name: 'Find in rich markdown editor' })
  ).toBeVisible()
})
