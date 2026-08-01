import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { useAppStore } from '@/store'
import { BrowserAction } from './FeatureWallBrowserAction'

describe('BrowserAction', () => {
  it('offers the built-in browser action without a removed skill-install CTA', () => {
    useAppStore.setState({
      activeWorktreeId: null,
      worktreesByRepo: {}
    })

    const markup = renderToStaticMarkup(<BrowserAction done={false} />)

    expect(markup).toContain('Try it out')
    expect(markup).not.toContain('Install Browser Skill')
  })
})
