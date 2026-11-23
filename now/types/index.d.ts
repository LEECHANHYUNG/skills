export type Summary = {
  goal: string
  progress: string
  next: string
  updatedAt: number
}

export type Todo = {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
}

export type Phase = 'idle' | 'running' | 'waiting'

declare module 'claude-code' {
  interface PluginState {
    now: {
      summary: Shaped<Summary | null>
      todos: Shaped<Todo[]>
      phase: Shaped<Phase>
      isSummarizing: Shaped<boolean>
    }
  }
}
