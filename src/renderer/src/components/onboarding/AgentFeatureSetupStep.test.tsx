import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AgentFeatureSetupStep } from './AgentFeatureSetupStep'

describe('AgentFeatureSetupStep', () => {
  it('renders the agent feature setup checklist', () => {
    const html = renderToStaticMarkup(
      <AgentFeatureSetupStep
        featureSetup={{
          browserUse: true,
          computerUse: true
        }}
        onFeatureSetupChange={vi.fn()}
        setupBusyLabel={null}
        onStartFeatureSetup={vi.fn()}
      />
    )

    expect(html).toContain('Agent Browser Use')
    expect(html).toContain('Computer Use')
    expect(html).not.toContain('Linear agent skill')
    expect(html).toContain('Set Up Features')
    expect(html).toContain('role="checkbox"')
  })
})
