type Screen = {
  readonly path: string
  readonly label: string
  readonly summary: string
  readonly availability: string
}

export const groups = [
  {
    label: 'Workspace',
    screens: [
      { path: 'settings', label: 'Bot settings', summary: 'Manage the bot’s appearance, instructions, and contact details.', availability: 'Settings will be available after the tenant connection is set up.' },
      { path: 'conversations', label: 'Conversations', summary: 'Review conversations and their sources.', availability: 'Conversation records will appear after the tenant connection is set up.' },
      { path: 'usage', label: 'Usage', summary: 'Review daily activity and estimated costs.', availability: 'Usage reports will appear after the tenant connection is set up.' },
      { path: 'members', label: 'Members', summary: 'Review workspace membership and roles.', availability: 'The member list will be available after the tenant connection is set up.' },
    ],
  },
  {
    label: 'Knowledge',
    screens: [
      { path: 'knowledge/documents', label: 'Documents', summary: 'Manage the files your bot can use to answer questions.', availability: 'Document management will be available after the tenant connection is set up.' },
      { path: 'knowledge/indexing', label: 'Indexing status', summary: 'Check indexing progress and see which versions are active.', availability: 'Indexing status will appear after the tenant connection is set up.' },
      { path: 'knowledge/gaps', label: 'Knowledge gaps', summary: 'Review recurring questions that need better coverage.', availability: 'The knowledge gap report will appear after the tenant connection is set up.' },
    ],
  },
  {
    label: 'Administration',
    screens: [
      { path: 'widget', label: 'Widget installation', summary: 'Find the public information needed to install your bot.', availability: 'The installation snippet requires the deployment’s public configuration.' },
      { path: 'subscription', label: 'Subscription', summary: 'View plan and subscription status.', availability: 'Subscription information is currently unavailable.' },
      { path: 'account', label: 'Account', summary: 'Manage your session and sign-in security.', availability: 'Account details will be available once sign-in is connected.' },
    ],
  },
] as const satisfies readonly { readonly label: string; readonly screens: readonly Screen[] }[]

export const screens: readonly Screen[] = groups.flatMap<Screen>((group) => group.screens)
