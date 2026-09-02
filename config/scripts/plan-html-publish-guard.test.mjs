import { describe, expect, it } from 'vitest'
import { findPlanHtmlPublicationViolations } from './plan-html-publish-guard.mjs'

const SELF_REPO = 'keepmeside/aio-ade-platform'

function check(body, options = {}) {
  return findPlanHtmlPublicationViolations(
    `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>t</title></head><body>${body}</body></html>`,
    { selfRepo: SELF_REPO, ...options }
  )
}

function rules(body, options) {
  return check(body, options).map((violation) => violation.rule)
}

describe('own-repository citations', () => {
  // The pre-flip guard blocked this URL because the repo was private. After the
  // flip it is a public address and the plan's own baseline table cites it, so
  // blocking it would fail every deploy of an otherwise correct artifact.
  it('allows links to the repository being published', () => {
    expect(rules('<a href="https://github.com/keepmeside/aio-ade-platform">repo</a>')).toEqual([])
  })

  it('allows deep links and .git suffixes on the same repository', () => {
    expect(
      rules(
        '<a href="https://github.com/keepmeside/aio-ade-platform/blob/main/LICENSE">license</a>' +
          '<a href="https://github.com/keepmeside/aio-ade-platform.git">clone</a>'
      )
    ).toEqual([])
  })

  it('reads the published repository from the environment so a rename cannot rot it', () => {
    const body = '<a href="https://github.com/other-owner/internal-tools">elsewhere</a>'

    expect(rules(body, { selfRepo: 'other-owner/internal-tools' })).toEqual([])
    expect(rules(body)).toContain('third-party-private-path')
  })

  it('does not treat a different repository sharing our owner prefix as ours', () => {
    expect(
      rules('<a href="https://github.com/keepmeside/aio-ade-platform-internal">x</a>')
    ).toContain('third-party-private-path')
  })
})

describe('third-party private and internal targets', () => {
  it('still refuses a private or internal third-party repository path', () => {
    expect(rules('<a href="https://github.com/acme/internal-runbook">runbook</a>')).toContain(
      'third-party-private-path'
    )
    expect(rules('<a href="https://github.com/acme/private">vault</a>')).toContain(
      'third-party-private-path'
    )
  })

  it('refuses hosts that only resolve inside a network', () => {
    for (const url of [
      'http://localhost:5173/plan.html',
      'http://127.0.0.1:8080/x',
      'https://10.1.2.3/x',
      'https://192.168.0.9/x',
      'https://172.16.4.4/x',
      'https://wiki.internal/x',
      'https://build.corp/x',
      'https://nas.local/x'
    ]) {
      expect(rules(`<a href="${url}">x</a>`), url).toContain('non-public-host')
    }
  })

  it('accepts ordinary public documentation hosts', () => {
    expect(
      rules(
        '<a href="https://github.com/excalidraw/excalidraw">excalidraw</a>' +
          '<a href="https://tldraw.dev/community/license">tldraw</a>'
      )
    ).toEqual([])
  })
})

describe('self-containment', () => {
  it('refuses a stylesheet, script, image or font fetched over the network', () => {
    expect(rules('<script src="https://cdn.example.com/app.js"></script>')).toContain(
      'external-asset'
    )
    expect(rules('<link rel="stylesheet" href="https://fonts.example.com/inter.css">')).toContain(
      'external-asset'
    )
    expect(rules('<img src="https://example.com/diagram.png" alt="d">')).toContain('external-asset')
    expect(rules('<style>@import url("https://fonts.example.com/i.css");</style>')).toContain(
      'external-asset'
    )
    expect(rules('<style>body{background:url(https://example.com/bg.png)}</style>')).toContain(
      'external-asset'
    )
  })

  it('allows inline data URIs and in-document fragments', () => {
    expect(
      rules(
        '<img src="data:image/svg+xml,%3Csvg%2F%3E" alt="i"><a href="#phase-05">jump</a>' +
          '<a href="mailto:owner@example.com">mail</a>'
      )
    ).toEqual([])
  })

  it('allows a non-fetching link relation to a public URL', () => {
    expect(rules('<link rel="canonical" href="https://keepmeside.github.io/x/">')).toEqual([])
  })
})

describe('links to content that is not in the artifact', () => {
  // Only index.html reaches _site, so a relative link is a dead end for every
  // reader — and for plan.html specifically it would point at plan-internal
  // markdown that was deliberately left out of the repository.
  it('refuses relative and absolute filesystem links', () => {
    for (const href of [
      'decisions.md',
      './phase-05-rebrand-orca-to-aio-ide.md',
      '../research/baseline/local-verification-baseline.md',
      '/plans/260730-0117-aio-ide-rebrand-and-integration/plan.md',
      'file:///home/stackops/devops-learning/aio-ade-platform/plans/plan.md'
    ]) {
      expect(rules(`<a href="${href}">x</a>`), href).toContain('unpublished-local-link')
    }
  })

  it('names the offending target so the failure is actionable', () => {
    const [violation] = check('<a href="decisions.md">decisions</a>')

    expect(violation.rule).toBe('unpublished-local-link')
    expect(violation.target).toBe('decisions.md')
  })

  it('reports every distinct violation rather than stopping at the first', () => {
    const found = rules(
      '<a href="decisions.md">a</a><script src="https://cdn.example.com/a.js"></script>' +
        '<a href="http://localhost:1234/b">b</a>'
    )

    expect(new Set(found)).toEqual(
      new Set(['unpublished-local-link', 'external-asset', 'non-public-host'])
    )
  })
})

describe('the artifact this repository actually publishes', () => {
  it('passes the generated plan artifact', async () => {
    const { readFileSync, existsSync } = await import('node:fs')
    const { join, resolve } = await import('node:path')
    const planHtml = join(
      resolve(import.meta.dirname, '../..'),
      'plans/260730-0117-aio-ide-rebrand-and-integration/plan.html'
    )

    // plans/ is untracked by decision, so a CI checkout may not have it.
    if (!existsSync(planHtml)) {
      return
    }

    expect(
      findPlanHtmlPublicationViolations(readFileSync(planHtml, 'utf8'), { selfRepo: SELF_REPO })
    ).toEqual([])
  })
})
