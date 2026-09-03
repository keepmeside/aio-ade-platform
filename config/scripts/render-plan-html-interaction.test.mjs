// @vitest-environment happy-dom

import { join, resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildPlanModel, readPlanSources } from './plan-html-data.mjs'
import { renderPlanHtml } from './render-plan-html.mjs'

/* Drives the published page instead of asserting on its markup.
 *
 * The structural checks elsewhere prove a dialog element and a filter exist; they cannot tell whether
 * clicking a card opens the dialog, whether the filter narrows anything, or whether closing puts the
 * borrowed phase body back. The phase criterion is about a reader being able to use the page offline,
 * so the behaviour is what has to hold. */

/* `import.meta.dirname` rather than a URL: under happy-dom `import.meta.url` is not a file: URL, so
 * relative resolution collapses to the filesystem root. */
const PLAN_DIR = join(
  resolve(import.meta.dirname, '../..'),
  'plans/260730-0117-aio-ide-rebrand-and-integration'
)

function loadPage() {
  const html = renderPlanHtml(buildPlanModel(readPlanSources(PLAN_DIR)), {
    generatedAt: '2026-09-02'
  })
  document.documentElement.innerHTML = html.slice(html.indexOf('<html'))
  // happy-dom does not run inline scripts injected through innerHTML, so run the page's own script.
  const source = [...document.querySelectorAll('script')]
    .map((script) => script.textContent ?? '')
    .join('\n')
  new Function(source)()
}

function cards() {
  return [...document.querySelectorAll('.card')]
}

function visibleCards() {
  return cards().filter((card) => !card.parentElement.hidden)
}

function setSearch(value) {
  const search = document.getElementById('phase-search')
  search.value = value
  search.dispatchEvent(new Event('input'))
}

describe('the published plan page, driven', () => {
  beforeAll(() => {
    loadPage()
  })

  it('starts with every phase visible and says so in a live region', () => {
    expect(cards()).toHaveLength(12)
    expect(visibleCards()).toHaveLength(12)
    expect(document.getElementById('filter-status').textContent).toBe('12 / 12 phase hiển thị')
  })

  it('opens a phase into the dialog and titles it', () => {
    const dialog = document.getElementById('phase-dialog')
    expect(dialog.hasAttribute('open')).toBe(false)

    cards()
      .find((card) => card.dataset.phase === '5')
      .click()

    expect(dialog.hasAttribute('open')).toBe(true)
    expect(document.getElementById('phase-dialog-title').textContent).toContain('Phase 05')
    const body = document.getElementById('phase-dialog-body')
    expect(body.querySelector('#phase-detail-5')).not.toBeNull()
    expect(body.textContent).toContain('Success criteria')
  })

  it('returns the borrowed phase body to the page when the dialog closes', () => {
    document.getElementById('phase-dialog').querySelector('.close').click()

    const detail = document.getElementById('phase-detail-5')
    expect(detail.hidden).toBe(true)
    expect(detail.closest('#phase-dialog')).toBeNull()
    expect(detail.closest('#phase-details')).not.toBeNull()
  })

  it('narrows the grid by free text and reports the count', () => {
    setSearch('Tauri')

    expect(visibleCards().length).toBeGreaterThan(0)
    expect(visibleCards().length).toBeLessThan(12)
    expect(document.getElementById('filter-status').textContent).toMatch(/^\d+ \/ 12 /u)

    setSearch('')
    expect(visibleCards()).toHaveLength(12)
  })

  it('searches phase bodies, not just card labels', () => {
    // A term that appears in a phase body and in no card label.
    setSearch('webkit2gtk')

    expect(visibleCards().length).toBeGreaterThan(0)
    expect(visibleCards().length).toBeLessThan(12)

    setSearch('')
  })

  it('filters by status through the chips and clears again', () => {
    const completed = [...document.querySelectorAll('.chip')].find(
      (chip) => chip.dataset.status === 'completed'
    )

    completed.click()
    expect(completed.getAttribute('aria-pressed')).toBe('true')
    expect(visibleCards().length).toBeGreaterThan(0)
    expect(visibleCards().length).toBeLessThan(12)
    expect(visibleCards().every((card) => card.dataset.status === 'completed')).toBe(true)

    completed.click()
    expect(completed.getAttribute('aria-pressed')).toBe('false')
    expect(visibleCards()).toHaveLength(12)
  })
})
