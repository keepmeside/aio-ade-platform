// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MatchedText } from './ProjectComboboxRow'
import { rankProjectOptions } from './project-combobox-matching'
import type { NewWorkspaceProjectOption } from '@/lib/new-workspace-project-options'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
})

function markedText(): string {
  return Array.from(container.querySelectorAll('mark'))
    .map((mark) => mark.textContent ?? '')
    .join('')
}

describe('MatchedText', () => {
  it('underlines the matched run', () => {
    // Hits derived from the text: a hardcoded index list silently stops covering the whole run the
    // moment the fixture name changes length.
    const name = 'aio-ade'

    act(() => {
      root.render(<MatchedText text={name} hits={[...name].map((_, index) => index)} />)
    })

    expect(markedText()).toBe(name)
  })

  // Hits are UTF-16 offsets; rendering splits by code point. An astral glyph is
  // two code units but one rendered character, so every mark landed one glyph
  // late (and the last one fell off the end).
  it('aligns marks with the query when the name starts with an emoji', () => {
    const option: NewWorkspaceProjectOption = {
      kind: 'project',
      id: 'p1',
      projectId: 'p1',
      displayName: '🚀 aio-ade',
      badgeColor: '#111111',
      detail: '~/dev/aio-ade'
    }
    const [match] = rankProjectOptions([option], 'aio-ade', [])
    expect(match).toBeDefined()

    act(() => {
      root.render(<MatchedText text={option.displayName} hits={match!.nameHits} />)
    })

    expect(markedText()).toBe('aio-ade')
  })

  it('leaves text unmarked when there are no hits', () => {
    act(() => {
      root.render(<MatchedText text="🚀 aio-ade" hits={[]} />)
    })

    expect(container.querySelectorAll('mark')).toHaveLength(0)
    expect(container.textContent).toBe('🚀 aio-ade')
  })
})
