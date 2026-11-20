import { describe, expect, it } from 'vitest'
import { previewWorkspace, summarizeDocuments } from './fixtures'

describe('summarizeDocuments', () => {
  it('derives each count from the preview fixture', () => {
    expect(summarizeDocuments(previewWorkspace.documents)).toEqual({
      total: 3,
      ready: 2,
      indexing: 1,
    })
  })

  it('handles an empty fixture', () => {
    expect(summarizeDocuments([])).toEqual({ total: 0, ready: 0, indexing: 0 })
  })
})
