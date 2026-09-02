import { describe, expect, it } from 'vitest'
import { isRuntimeProviderSearchQueryWithinLimit } from './runtime-provider-search-bounds'

describe('runtime provider search bounds', () => {
  it('accepts absent provider queries and small text', () => {
    // Limit derived from the query so a rename of the project key cannot silently push an
    // "at the limit passes" case over a hardcoded byte budget. ASCII, so length === bytes.
    const atLimitQuery = 'project = AIO_ADE'

    expect(isRuntimeProviderSearchQueryWithinLimit(undefined)).toBe(true)
    expect(isRuntimeProviderSearchQueryWithinLimit(null)).toBe(true)
    expect(isRuntimeProviderSearchQueryWithinLimit(atLimitQuery, atLimitQuery.length)).toBe(true)
    expect(isRuntimeProviderSearchQueryWithinLimit(atLimitQuery, atLimitQuery.length - 1)).toBe(
      false
    )
  })

  it('measures pasted provider search text as UTF-8 bytes', () => {
    expect(isRuntimeProviderSearchQueryWithinLimit('😀', 3)).toBe(false)
  })

  it('rejects oversized pasted provider search queries', () => {
    expect(isRuntimeProviderSearchQueryWithinLimit('x'.repeat(9 * 1024))).toBe(false)
  })
})
