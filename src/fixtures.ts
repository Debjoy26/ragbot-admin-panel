export const previewWorkspace = {
  bot: 'Website support',
  documents: [
    { id: 'sample-01', title: 'Getting started', status: 'Ready' },
    { id: 'sample-02', title: 'Support policies', status: 'Ready' },
    { id: 'sample-03', title: 'Product FAQ', status: 'Indexing' },
  ],
} as const

export function summarizeDocuments(
  documents: readonly { status: 'Ready' | 'Indexing' }[],
) {
  return {
    total: documents.length,
    ready: documents.filter((document) => document.status === 'Ready').length,
    indexing: documents.filter((document) => document.status === 'Indexing').length,
  }
}
