import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Phase, Summary, Todo } from '../types'

const PANE = 'now'
const TITLE = '지금 하는 일'
// 도구를 이보다 적게 쓴 턴은 잡담으로 보고 요약을 건너뛴다.
const MIN_TOOL_CALLS = 2

// 저장 형태가 바뀌면 shape 태그를 올린다. 이전 버전이 남긴 값은 초기값으로 읽힌다.
const summary = atom({ plugin: 'now', key: 'summary' } as const, null, {
  shape: 'summary-1',
})
const todos = atom({ plugin: 'now', key: 'todos' } as const, [], {
  shape: 'todos-1',
})
const phase = atom({ plugin: 'now', key: 'phase' } as const, 'idle', {
  shape: 'phase-1',
})
const isSummarizing = atom(
  { plugin: 'now', key: 'isSummarizing' } as const,
  false,
  { shape: 'summarizing-1' },
)

const PROMPT = `지금까지의 이 세션 대화를 바탕으로, 사용자가 작업 흐름을 다시 잡을 수 있게 요약해줘.
아래 JSON 하나만 출력하고 다른 말은 쓰지 마. 모든 값은 한국어 한 문장, 60자 이내.
{"goal": "사용자가 지금 이루려는 목표", "progress": "지금까지 끝낸 것과 진행 중인 것", "next": "바로 다음에 할 일"}`

// 메인 루프의 현재 턴에서 호출된 도구 수. 리로드되면 0부터 다시 센다.
let toolCalls = 0

function parseSummary(text: string, now: number): Summary {
  const match = text.match(/\{[\s\S]*\}/)
  try {
    const raw = JSON.parse(match?.[0] ?? '') as Partial<Record<string, unknown>>
    const field = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
    return {
      goal: field(raw.goal),
      progress: field(raw.progress),
      next: field(raw.next),
      updatedAt: now,
    }
  } catch {
    // JSON이 깨져도 버리지 않고 목표 칸에 원문을 보여준다.
    return { goal: text.trim(), progress: '', next: '', updatedAt: now }
  }
}

async function summarize($: EngineInterface) {
  if (await read($, isSummarizing)) return
  await update($, isSummarizing, () => true)
  try {
    const r = await $.model.fork({ prompt: PROMPT })
    // 첫 턴 전이나 /clear 직후엔 요약할 대화가 없다. 투두와 상태만 보여준다.
    if (r.isAnswered) {
      const next = parseSummary(r.text, await $.clock.now())
      await update($, summary, () => next)
    }
  } finally {
    await update($, isSummarizing, () => false)
  }
}

function formatTime(ms: number) {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const PHASE_LABEL: Record<Phase, string> = {
  idle: '대기 없음',
  running: '작업 중',
  waiting: '사용자 응답 대기 중',
}

const TODO_MARK: Record<Todo['status'], string> = {
  completed: '[x]',
  in_progress: '[>]',
  pending: '[ ]',
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'now',
      description: '지금 하는 일 패널 열기/닫기 (/now refresh: 요약 즉시 갱신)',
    })
    void $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('command.run', { command: 'now' }, async ($, e) => {
    if (e.args.trim() === 'refresh') {
      void $.clock.after(0, () => void summarize($))
      return { text: '요약을 새로 만드는 중이에요.' }
    }
    const panes = await $.ui.panes()
    if (panes.some(p => p.id === PANE)) {
      await $.ui.close({ id: PANE })
      return { text: '패널을 닫았어요.' }
    }
    await $.ui.open({ id: PANE, title: TITLE })
    void $.clock.after(0, () => void summarize($))
    return { text: '패널을 열고 요약을 새로 만드는 중이에요.' }
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      toolCalls = 0
      await update($, phase, () => 'running')
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    // 서브에이전트의 도구 호출은 세지 않는다.
    if (e.agentId !== undefined) return next(e)
    toolCalls += 1

    if (e.tool === 'AskUserQuestion') {
      await update($, phase, () => 'waiting')
      const ran = await next(e)
      await update($, phase, () => 'running')
      return ran
    }

    if (e.tool === 'TodoWrite') {
      const ran = await next(e)
      if (ran.result && !ran.isError) {
        const list = ran.result.newTodos.map(t => ({
          content: t.status === 'in_progress' ? t.activeForm : t.content,
          status: t.status,
        }))
        await update($, todos, () => list)
      }
      return ran
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)

    const endsWithQuestion = /[?？]\s*$/.test(e.answer.trim())
    await update($, phase, () => (endsWithQuestion ? 'waiting' : 'idle'))
    // fork는 턴이 끝난 뒤에만 가능하고 시간이 걸리니 훅 밖에서 돌린다.
    if (toolCalls >= MIN_TOOL_CALLS && !e.isAborted) {
      void $.clock.after(0, () => void summarize($))
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const s = await read($, summary)
    const list = await read($, todos)
    const p = await read($, phase)
    const busy = await read($, isSummarizing)

    const section = (label: string, body: string) => (
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>{label}</Text>
        <Text dimColor={body === ''}>{body === '' ? '-' : body}</Text>
      </Box>
    )

    return (
      <Box flexDirection="column">
        {section('현재 목표', s?.goal ?? '')}
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>진행 단계</Text>
          {list.length > 0 ? (
            list.map(t => (
              <Text dimColor={t.status === 'completed'}>
                {TODO_MARK[t.status]} {t.content}
              </Text>
            ))
          ) : (
            <Text dimColor={!s?.progress}>{s?.progress || '-'}</Text>
          )}
        </Box>
        {section('다음 할 일', s?.next ?? '')}
        <Text bold={p === 'waiting'}>상태: {PHASE_LABEL[p]}</Text>
        <Text dimColor>
          {s ? `갱신 ${formatTime(s.updatedAt)}` : '아직 요약 없음'}
          {busy ? ' · 요약 중…' : ''}
        </Text>
      </Box>
    )
  })
}
