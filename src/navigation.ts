import type { TenantRole } from './client-auth'

type Screen = {
  readonly path: string
  readonly label: string
  readonly summary: string
  readonly availability: string
  readonly allowedRoles?: readonly TenantRole[]
}

export const groups = [
  {
    label: 'Workspace',
      screens: [
        { path: 'settings', label: 'Bot settings', summary: 'Manage the bot’s appearance, instructions, and contact details.', availability: 'Settings load server-authoritative values with stale-version protection.' },
        { path: 'conversations', label: 'Conversations', summary: 'Review conversations and their sources.', availability: 'Conversation records are limited to rows your role is granted.' },
        { path: 'usage', label: 'Usage', summary: 'Review daily activity and estimated costs.', availability: 'Usage aggregates are limited to 92-day ranges.' },
        { path: 'members', label: 'Members', allowedRoles: ['owner', 'admin'], summary: 'Review workspace membership and roles.', availability: 'The member list is read-only. Invitations and role changes need a reviewed contract.' },
    ],
  },
    {
      label: 'Knowledge',
      screens: [
        { path: 'knowledge/documents', label: 'Documents', summary: 'Manage the files your bot can use to answer questions.', availability: 'Document management uses the approved tenant RPCs and Storage policies.' },
        { path: 'knowledge/indexing', label: 'Indexing status', summary: 'Check indexing progress and see which versions are active.', availability: 'Indexing status reads job summaries and safe version progress.' },
        { path: 'knowledge/gaps', label: 'Knowledge gaps', summary: 'Review recurring questions that need better coverage.', availability: 'Knowledge-gap review uses the approved report plus the Markdown document pipeline. New content is retrievable only after backend activation.' },
    ],
  },
  {
    label: 'Administration',
      screens: [
        { path: 'widget', label: 'Widget installation', summary: 'Find the public information needed to install your bot.', availability: 'The installation snippet uses only public embed values. Identifier rotation needs an A5 backend contract.' },
        { path: 'subscription', label: 'Subscription', summary: 'View plan and subscription status.', availability: 'Subscription display is an A6 integration. No enforcement is claimed until the provider contract exists.' },
      { path: 'account', label: 'Account', summary: 'Review your workspace session.', availability: 'Use Sign out in the workspace header to end this session.' },
    ],
  },
] as const satisfies readonly { readonly label: string; readonly screens: readonly Screen[] }[]

export const screens: readonly Screen[] = groups.flatMap<Screen>((group) => group.screens)

export function canOpenScreen(screen: Screen, role: TenantRole) {
  return !screen.allowedRoles || screen.allowedRoles.includes(role)
}
