import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { GrillAnswer, GrillQuestion, GrillRound, GrillSession } from '../types'

const PANE = 'grill-pane'
const TOOL = 'grill_round'
const LETTERS = 'abcdefghij'

// Bump the shape tag when GrillSession changes: an older stored value is then
// declined instead of being read with the wrong fields after a reload.
const session = atom({ plugin: 'grill-pane', key: 'session' } as const, null, {
  shape: 'session-1',
})

const TOOL_DESCRIPTION = `grill-me(grilling) 라운드를 사용자 터미널의 pane에 띄워 마우스 클릭으로 답을 받는다.

규칙:
- grilling 스킬로 라운드를 물을 때는 질문을 채팅 텍스트로 쓰지 말고 이 도구를 부른다.
- 도구를 부른 뒤에는 "pane에서 답해 주세요" 한 줄만 쓰고 턴을 끝낸다. 질문을 채팅에 다시 쓰지 않는다. 사용자의 답은 다음 사용자 메시지로 "[grill-me 라운드 N 답변]" 형식으로 온다.
- 결과가 "pane을 띄우지 못했다"고 하면 같은 라운드를 평소처럼 채팅 텍스트로 묻는다.
- 질문 앞의 설명(확인한 사실, 정해진 것)은 도구를 부르기 전에 채팅에 짧게 쓴다.

필드:
- round: 라운드 번호(1부터).
- questions[].id: "Q1", "Q2" 같은 짧은 id.
- questions[].title: 질문 제목(한 줄).
- questions[].body: 질문 본문. 여러 문단 가능.
- questions[].recommended: 추천 답과 이유. "추천대로"를 누르면 이걸 받아들인다는 뜻이 되게 쓴다.
- questions[].options: 선택지(없으면 생략). label은 짧게, description은 한 줄.`

const INPUT_SCHEMA = {
  type: 'object',
  required: ['round', 'questions'],
  properties: {
    round: { type: 'integer', minimum: 1 },
    questions: {
      type: 'array',
      minItems: 1,
      maxItems: 10,
      items: {
        type: 'object',
        required: ['id', 'title', 'body', 'recommended'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'string' },
          recommended: { type: 'string' },
          options: {
            type: 'array',
            maxItems: LETTERS.length,
            items: {
              type: 'object',
              required: ['label'],
              properties: {
                label: { type: 'string' },
                description: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
} as const

function parseRound(input: Record<string, unknown>): GrillRound | string {
  const round = input.round
  const questions = input.questions
  if (typeof round !== 'number' || !Array.isArray(questions) || questions.length === 0) {
    return 'round(숫자)와 questions(1개 이상)가 필요하다.'
  }
  const parsed: GrillQuestion[] = []
  for (const q of questions) {
    if (typeof q !== 'object' || q === null) return 'questions 항목은 객체여야 한다.'
    const { id, title, body, recommended, options } = q as Record<string, unknown>
    if (typeof id !== 'string' || typeof title !== 'string' || typeof body !== 'string' || typeof recommended !== 'string') {
      return 'questions 항목마다 id, title, body, recommended 문자열이 필요하다.'
    }
    const opts = Array.isArray(options)
      ? options
          .filter((o): o is Record<string, unknown> => typeof o === 'object' && o !== null && typeof (o as Record<string, unknown>).label === 'string')
          .slice(0, LETTERS.length)
          .map(o => ({
            label: o.label as string,
            ...(typeof o.description === 'string' ? { description: o.description } : {}),
          }))
      : []
    parsed.push({ id, title, body, recommended, options: opts })
  }
  return { round, questions: parsed }
}

function describeAnswer(q: GrillQuestion, a: GrillAnswer): string {
  if (a.kind === 'recommended') return '추천대로'
  if (a.kind === 'option') {
    const opt = q.options?.[a.index]
    return `(${LETTERS[a.index]}) ${opt?.label ?? ''}`.trim()
  }
  return `직접 입력 "${a.text}"`
}

export function formatAnswers(s: GrillSession): string {
  const lines = s.round.questions.map(q => {
    const a = s.answers[q.id]
    return `${q.id} ${q.title}: ${a ? describeAnswer(q, a) : '(답 없음)'}`
  })
  return [`[grill-me 라운드 ${s.round.round} 답변]`, ...lines].join('\n')
}

function isSame(a: GrillAnswer | undefined, b: GrillAnswer): boolean {
  if (!a || a.kind !== b.kind) return false
  if (a.kind === 'option' && b.kind === 'option') return a.index === b.index
  return true
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: TOOL,
      description: TOOL_DESCRIPTION,
      inputSchema: INPUT_SCHEMA,
      isDeferred: false,
    })
    await $.command.register({
      name: 'grill',
      description: '마지막 grill-me 라운드 pane을 다시 연다',
    })
    return next(e)
  })

  on('tool.run', { tool: 'mcp__grill-pane__grill_round' }, async ($, e) => {
    // The tool's own arguments sit flat on `e`, beside `tool` and `tool_use_id`.
    const parsed = parseRound(e as unknown as Record<string, unknown>)
    if (typeof parsed === 'string') return { deny: parsed }

    await update($, session, () => ({ round: parsed, answers: {}, isSubmitted: false }))
    const opened = await $.ui.open({
      id: PANE,
      title: `grill-me 라운드 ${parsed.round}`,
      focus: true,
      closeOnEscape: true,
      holdToasts: true,
    })
    if (!opened.isPlaced) {
      return {
        result:
          'pane을 띄우지 못했다(터미널 폭이 좁거나 이 화면은 pane을 그리지 못한다). 같은 라운드를 채팅 텍스트로 다시 물어라.',
      }
    }
    return {
      result: 'pane에 라운드를 띄웠다. "pane에서 답해 주세요" 한 줄만 쓰고 턴을 끝내라. 답은 다음 사용자 메시지로 온다.',
    }
  })

  on('command.run', { command: 'grill' }, async $ => {
    const s = await read($, session)
    if (!s) return { text: '다시 열 grill-me 라운드가 없어요.' }
    await $.ui.open({
      id: PANE,
      title: `grill-me 라운드 ${s.round.round}`,
      focus: true,
      closeOnEscape: true,
      holdToasts: true,
    })
    return { text: `grill-me 라운드 ${s.round.round} pane을 다시 열었어요.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const s = await read($, session)
    if (!s) return <Text dimColor>열린 grill-me 라운드가 없어요.</Text>

    const setAnswer = (id: string, a: GrillAnswer | undefined) =>
      update($, session, cur => {
        if (!cur) return cur
        const answers = { ...cur.answers }
        if (a) answers[id] = a
        else delete answers[id]
        return { ...cur, answers }
      })

    // Reads the stored session at press time: the closure's `s` can lag one
    // redraw behind a keystroke typed just before the click.
    const submit = async (override?: Record<string, GrillAnswer>) => {
      const cur = await read($, session)
      if (!cur) return
      const final = override ? { ...cur, answers: override } : cur
      const missing = final.round.questions.filter(q => !final.answers[q.id]).map(q => q.id)
      if (missing.length > 0) {
        $.ui.toast(`아직 답하지 않은 질문: ${missing.join(', ')}`)
        return
      }
      await update($, session, () => ({ ...final, isSubmitted: true }))
      await $.ui.close({ id: PANE })
      await $.prompt.submit({ text: formatAnswers(final) }).catch(() => {
        $.ui.toast('답을 보내지 못했어요. /grill로 다시 열어 제출해 주세요.')
      })
    }

    const acceptAll = () => {
      const answers: Record<string, GrillAnswer> = {}
      for (const q of s.round.questions) answers[q.id] = { kind: 'recommended' }
      return submit(answers)
    }

    return (
      <Box flexDirection="column" gap={1}>
        {s.isSubmitted && <Text dimColor>이 라운드는 이미 제출했어요. 다시 제출하면 답이 한 번 더 갑니다.</Text>}
        <Box flexDirection="row" gap={2} flexWrap="wrap">
          <Button key="accept-all" variant="primary" onPress={acceptAll}>
            모두 추천대로
          </Button>
          <Button key="submit" onPress={() => submit()}>
            제출
          </Button>
        </Box>
        {s.round.questions.map(q => {
          const a = s.answers[q.id]
          const mark = (isOn: boolean) => (isOn ? '● ' : '○ ')
          return (
            <Box key={`q-${q.id}`} flexDirection="column">
              <Text bold>
                {q.id} · {q.title}
              </Text>
              <Text>{q.body}</Text>
              <Text color="green">➡️ 추천: {q.recommended}</Text>
              <Box flexDirection="column" marginTop={1}>
                <Button
                  key={`${q.id}-rec`}
                  plain
                  dimColor={!isSame(a, { kind: 'recommended' })}
                  onPress={() => setAnswer(q.id, { kind: 'recommended' })}
                >
                  {mark(isSame(a, { kind: 'recommended' }))}추천대로
                </Button>
                {(q.options ?? []).map((o, i) => (
                  <Button
                    key={`${q.id}-opt-${i}`}
                    plain
                    dimColor={!isSame(a, { kind: 'option', index: i })}
                    onPress={() => setAnswer(q.id, { kind: 'option', index: i })}
                  >
                    {mark(isSame(a, { kind: 'option', index: i }))}({LETTERS[i]}) {o.label}
                    {o.description ? <Text dimColor> · {o.description}</Text> : ''}
                  </Button>
                ))}
              </Box>
              <Input
                key={`${q.id}-text`}
                placeholder="직접 입력 후 Enter"
                value={a?.kind === 'text' ? a.text : ''}
                onInput={value => setAnswer(q.id, value.trim() ? { kind: 'text', text: value } : undefined)}
                onSubmit={value => setAnswer(q.id, value.trim() ? { kind: 'text', text: value } : undefined)}
              />
            </Box>
          )
        })}
        <Box flexDirection="row" gap={2} flexWrap="wrap">
          <Button key="accept-all-bottom" variant="primary" onPress={acceptAll}>
            모두 추천대로
          </Button>
          <Button key="submit-bottom" onPress={() => submit()}>
            제출
          </Button>
        </Box>
      </Box>
    )
  })
}
