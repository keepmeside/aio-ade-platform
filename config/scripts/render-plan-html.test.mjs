import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildPlanModel,
  parseFrontmatter,
  readPlanSources,
  splitSections
} from './plan-html-data.mjs'
import { renderPlanHtml } from './render-plan-html.mjs'
import { findPlanHtmlPublicationViolations } from './plan-html-publish-guard.mjs'

const PLAN_DIR = join(
  resolve(import.meta.dirname, '../..'),
  'plans/260730-0117-aio-ide-rebrand-and-integration'
)

describe('frontmatter and sections', () => {
  it('reads scalars and the inline dependency list', () => {
    const { attributes, body } = parseFrontmatter(
      '---\nphase: 12\ntitle: "Post-flip CI"\ndependencies: [8]\n---\n# Heading\ntext\n'
    )

    expect(attributes).toEqual({ phase: '12', title: 'Post-flip CI', dependencies: ['8'] })
    expect(body).toBe('# Heading\ntext\n')
  })

  it('treats a body with no frontmatter as all body', () => {
    expect(parseFrontmatter('# Just a heading\n')).toEqual({
      attributes: {},
      body: '# Just a heading\n'
    })
  })

  it('keeps preamble before the first heading and splits on level two only', () => {
    const sections = splitSections('lead in\n\n## One\na\n\n### Nested\nb\n\n## Two\nc\n')

    expect(sections.map((section) => section.heading)).toEqual(['', 'One', 'Two'])
    expect(sections[1].markdown).toContain('### Nested')
  })
})

describe('the model built from this repository plan', () => {
  const model = buildPlanModel(readPlanSources(PLAN_DIR))

  it('finds every phase file and orders phases by number', () => {
    expect(model.phases).toHaveLength(12)
    expect(model.phases.map((phase) => phase.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12
    ])
  })

  // The whole reason the page is generated: a hand-maintained artifact went stale and still looked
  // authoritative. If the model silently loses a phase or an edge, the page is wrong the same way.
  it('reads dependency edges from frontmatter rather than file order', () => {
    const byNumber = new Map(model.phases.map((phase) => [phase.number, phase]))

    expect(byNumber.get(1).dependencies).toEqual([])
    expect(byNumber.get(12).dependencies).toEqual([8])
    expect(byNumber.get(6).dependencies).toContain(12)
    expect(model.stats.dependencyEdges).toBeGreaterThan(0)
  })

  it('counts a decorated completed status as completed', () => {
    const phase3 = model.phases.find((phase) => phase.number === 3)

    expect(phase3.status.startsWith('completed')).toBe(true)
    expect(model.stats.byStatus.completed).toBeGreaterThanOrEqual(5)
  })

  it('extracts success criteria with their checked state', () => {
    const phase5 = model.phases.find((phase) => phase.number === 5)

    expect(phase5.criteria.length).toBeGreaterThan(0)
    expect(phase5.criteria.every((entry) => entry.done)).toBe(true)
    expect(model.stats.criteriaDone).toBeLessThanOrEqual(model.stats.criteriaTotal)
  })

  it('carries the plan-level narrative sections the page renders', () => {
    for (const key of ['goal', 'decisions', 'gates', 'acceptance', 'openQuestions', 'baseline']) {
      expect(model[key], key).not.toBe('')
    }
  })
})

describe('the rendered page', () => {
  const model = buildPlanModel(readPlanSources(PLAN_DIR))
  const html = renderPlanHtml(model, { generatedAt: '2026-09-02' })

  it('is publishable under the guard that gates the Pages workflow', () => {
    expect(findPlanHtmlPublicationViolations(html)).toEqual([])
  })

  it('embeds each phase body exactly once and lets the dialog borrow it', () => {
    expect(html.match(/id="phase-detail-\d+"/gu)).toHaveLength(12)
    expect(html).not.toContain('application/json')
    expect(html).toContain('dialogBody.replaceChildren(detail)')
  })

  it('stays reachable without scripting, a pointer, or motion', () => {
    expect(html).toContain('.phase-detail[hidden] { display: block !important; }')
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain('prefers-reduced-motion')
    expect(html).toContain('@media (max-width: 30rem)')
    expect(html).toContain('role="status"')
    // Chips are real buttons carrying their own pressed state, not styled divs.
    expect(html.match(/class="chip" data-status="\w+" aria-pressed="false"/gu)).toHaveLength(3)
  })

  it('describes the dependency diagram for a reader who cannot see it', () => {
    expect(html).toContain('role="img"')
    expect(html).toContain('<title id="diagram-title">')
    expect(html).toContain('<desc id="diagram-desc">')
  })

  it('shows references to unpublished plan documents without linking them', () => {
    expect(html).toContain('class="internal-ref"')
    expect(html).not.toMatch(/<a href="decisions\.md"/u)
    expect(html).not.toMatch(/<a href="research\//u)
  })

  it('keeps the published repository URL as a live link', () => {
    expect(html).toContain('https://github.com/keepmeside/aio-ade-platform')
  })

  it('is deterministic for a fixed generation date', () => {
    expect(renderPlanHtml(model, { generatedAt: '2026-09-02' })).toBe(html)
  })
})

describe('the checked-in artifact', () => {
  // plan.html is generated in CI and deliberately untracked, so it may be absent or stale here.
  it('matches a fresh render when it exists', () => {
    let onDisk
    try {
      onDisk = readFileSync(join(PLAN_DIR, 'plan.html'), 'utf8')
    } catch {
      return
    }

    expect(findPlanHtmlPublicationViolations(onDisk)).toEqual([])
  })
})
