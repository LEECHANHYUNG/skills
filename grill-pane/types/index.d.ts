export type GrillOption = { label: string; description?: string }

export type GrillQuestion = {
  id: string
  title: string
  body: string
  recommended: string
  options?: GrillOption[]
}

export type GrillRound = { round: number; questions: GrillQuestion[] }

export type GrillAnswer =
  | { kind: 'recommended' }
  | { kind: 'option'; index: number }
  | { kind: 'text'; text: string }

export type GrillSession = {
  round: GrillRound
  answers: Record<string, GrillAnswer>
  isSubmitted: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'grill-pane': { session: Shaped<GrillSession | null> }
  }
}
