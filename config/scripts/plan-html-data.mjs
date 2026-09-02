/* Reads the roadmap and its phase files into the shape the published plan page renders.
 *
 * Separate from the renderer so the model can be asserted without parsing HTML: what the page must
 * never get wrong is the phase list, the dependency edges and the status counts, and those are all
 * decided here.
 *
 * Only `plan.md` and `phase-*.md` are read. The rest of the plan directory (decision log, feature
 * catalog, research, reports) is deliberately not published, so nothing here may depend on it. */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/u

/** Frontmatter is a flat `key: value` block; only scalars and one inline list are used. */
export function parseFrontmatter(text) {
  const match = FRONTMATTER_RE.exec(text)
  if (!match) {
    return { attributes: {}, body: text }
  }
  const attributes = {}
  for (const line of match[1].split(/\r?\n/u)) {
    const pair = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/u.exec(line.trim())
    if (!pair) {
      continue
    }
    const raw = pair[2].trim().replace(/^["']|["']$/gu, '')
    attributes[pair[1]] = /^\[.*\]$/u.test(raw)
      ? raw
          .slice(1, -1)
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
      : raw
  }
  return { attributes, body: text.slice(match[0].length) }
}

/** Splits a body into `## ` sections, keeping any preamble under an empty heading. */
export function splitSections(body) {
  const sections = []
  let heading = ''
  let lines = []
  const flush = () => {
    const markdown = lines.join('\n').trim()
    if (heading || markdown) {
      sections.push({ heading, markdown })
    }
  }
  for (const line of body.split(/\r?\n/u)) {
    const match = /^##\s+(.*)$/u.exec(line)
    if (match) {
      flush()
      heading = match[1].trim()
      lines = []
      continue
    }
    lines.push(line)
  }
  flush()
  return sections
}

function sectionText(sections, ...wanted) {
  const lowered = wanted.map((entry) => entry.toLowerCase())
  return (
    sections.find((section) =>
      lowered.some((entry) => section.heading.toLowerCase().startsWith(entry))
    )?.markdown ?? ''
  )
}

/* Strips HTML comments. They carry execution-order notes meant for whoever edits the plan, and one
 * of them would otherwise reach a reader as an invisible payload in the published page. */
function stripComments(markdown) {
  return markdown.replace(/<!--[\s\S]*?-->/gu, '').trim()
}

function phaseNumber(attributes, fileName) {
  const fromAttributes = Number.parseInt(String(attributes.phase ?? ''), 10)
  if (Number.isFinite(fromAttributes)) {
    return fromAttributes
  }
  return Number.parseInt(/phase-(\d+)/u.exec(fileName)?.[1] ?? '0', 10)
}

/** Success criteria as `{ text, done }`, so the page can show real progress per phase. */
function parseCriteria(markdown) {
  return [...markdown.matchAll(/^[-*]\s+\[([ xX])\]\s+(.*)$/gmu)].map((match) => ({
    done: match[1].toLowerCase() === 'x',
    text: match[2].trim()
  }))
}

export function readPhase(planDir, fileName) {
  const { attributes, body } = parseFrontmatter(readFileSync(join(planDir, fileName), 'utf8'))
  const sections = splitSections(stripComments(body))
  const criteria = parseCriteria(sectionText(sections, 'success criteria'))
  return {
    fileName,
    number: phaseNumber(attributes, fileName),
    title: attributes.title ?? fileName,
    status: attributes.status ?? 'unknown',
    priority: attributes.priority ?? '',
    effort: attributes.effort ?? '',
    dependencies: (Array.isArray(attributes.dependencies) ? attributes.dependencies : [])
      .map((entry) => Number.parseInt(entry, 10))
      .filter(Number.isFinite),
    overview: sectionText(sections, 'overview'),
    requirements: sectionText(sections, 'requirements'),
    steps: sectionText(sections, 'implementation steps'),
    risk: sectionText(sections, 'risk assessment'),
    criteria,
    sections: sections.filter((section) => section.heading && section.markdown)
  }
}

export function readPlanSources(planDir) {
  const phaseFiles = readdirSync(planDir)
    .filter((name) => /^phase-\d+.*\.md$/u.test(name))
    .sort()
  if (phaseFiles.length === 0) {
    throw new Error(`no phase-*.md files in ${planDir}`)
  }
  const { attributes, body } = parseFrontmatter(readFileSync(join(planDir, 'plan.md'), 'utf8'))
  const planSections = splitSections(stripComments(body))
  return {
    plan: {
      attributes,
      sections: planSections,
      title: /^#\s+(.*)$/mu.exec(body)?.[1]?.trim() ?? ''
    },
    phases: phaseFiles.map((name) => readPhase(planDir, name))
  }
}

/** Public http(s) links found anywhere in the sources, deduplicated, for the citation list. */
function collectSourceLinks(markdownBlocks) {
  const links = new Set()
  for (const block of markdownBlocks) {
    for (const [, url] of block.matchAll(/\]\((https?:\/\/[^)\s]+)\)/gu)) {
      links.add(url)
    }
    for (const [url] of block.matchAll(/(?<![(\w])https?:\/\/[^\s<>`)"']+/gu)) {
      links.add(url.replace(/[.,;]$/u, ''))
    }
  }
  return [...links].sort()
}

export function buildPlanModel(sources) {
  const { plan, phases } = sources
  const byStatus = {}
  for (const phase of phases) {
    const key = phase.status.startsWith('completed') ? 'completed' : phase.status
    byStatus[key] = (byStatus[key] ?? 0) + 1
  }
  const criteriaTotal = phases.reduce((sum, phase) => sum + phase.criteria.length, 0)
  const criteriaDone = phases.reduce(
    (sum, phase) => sum + phase.criteria.filter((entry) => entry.done).length,
    0
  )
  return {
    title: plan.title || 'Roadmap',
    goal: sectionText(plan.sections, 'mục tiêu', 'goal'),
    decisions: sectionText(plan.sections, 'quyết định', 'decision'),
    gates: sectionText(plan.sections, 'gate'),
    acceptance: sectionText(plan.sections, 'acceptance'),
    openQuestions: sectionText(plan.sections, 'câu hỏi', 'open question'),
    baseline: sectionText(plan.sections, 'repo baseline', 'baseline'),
    phases,
    stats: {
      phaseCount: phases.length,
      byStatus,
      criteriaTotal,
      criteriaDone,
      dependencyEdges: phases.reduce((sum, phase) => sum + phase.dependencies.length, 0)
    },
    sourceLinks: collectSourceLinks([
      ...plan.sections.map((section) => section.markdown),
      ...phases.flatMap((phase) => phase.sections.map((section) => section.markdown))
    ])
  }
}
