import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const PANE = {
  plugin: 'grill-pane',
  component: 'Pane',
  requestId: 'grill-pane',
  props: {
    title: 'grill-me 라운드 1',
    isFocused: true,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const ROUND = {
  round: 1,
  questions: [
    {
      id: 'Q1',
      title: '목표',
      body: '무엇을 하고 싶나요?',
      recommended: '(a)를 추천',
      options: [{ label: '생성형 UI' }, { label: '디자인 참고' }],
    },
    { id: 'Q2', title: '범위', body: 'grill-me에만?', recommended: '네' },
  ],
}

function engine(on: On, sent: string[], placed = true, isHanging = false) {
  on('tool.register', () => ({ value: { tool: 'mcp__grill-pane__grill_round' } }))
  on('command.register', () => ({ value: { command: 'grill' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.open', () => ({
    value: placed ? { isPlaced: true as const } : { isPlaced: false as const, reason: 'too narrow' },
  }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('prompt.submit', (_, e) => {
    sent.push(e.text)
    // A submitted prompt settles only when its own turn ends: hanging stands for that.
    return isHanging ? new Promise<never>(() => {}) : { text: e.text }
  })
}

test('라운드를 받아 pane을 띄우고, 클릭한 답을 텍스트로 보낸다', async ($, on) => {
  const sent: string[] = []
  engine(on, sent)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ran = await $.tool.call({ tool: 'mcp__grill-pane__grill_round', ...ROUND })
  expect(String(ran.result)).toContain('한 줄만 쓰고 턴을 끝내라')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /Q1 · 목표/ }))?.text).toContain('목표')

  await ui.press({ key: 'Q1-opt-1' })
  await ui.press({ key: 'Q2-rec' })
  await ui.press({ key: 'submit' })

  expect(sent).toEqual(['[grill-me 라운드 1 답변]\nQ1 목표: (b) 디자인 참고\nQ2 범위: 추천대로'])
  await ui.unmount()
})

test('모두 추천대로는 한 번에 제출한다', async ($, on) => {
  const sent: string[] = []
  engine(on, sent)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__grill-pane__grill_round', ...ROUND })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'accept-all' })

  expect(sent).toEqual(['[grill-me 라운드 1 답변]\nQ1 목표: 추천대로\nQ2 범위: 추천대로'])
  await ui.unmount()
})

test('답이 빠지면 제출하지 않는다', async ($, on) => {
  const sent: string[] = []
  engine(on, sent)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__grill-pane__grill_round', ...ROUND })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'Q1-rec' })
  await ui.press({ key: 'submit' })

  expect(sent).toEqual([])
  await ui.unmount()
})

test('pane을 못 띄우면 텍스트로 물으라고 돌려준다', async ($, on) => {
  const sent: string[] = []
  engine(on, sent, false)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ran = await $.tool.call({ tool: 'mcp__grill-pane__grill_round', ...ROUND })
  expect(String(ran.result)).toContain('채팅 텍스트로')
})

test('제출 버튼은 보낸 프롬프트의 턴이 끝나기를 기다리지 않는다', async ($, on) => {
  const sent: string[] = []
  engine(on, sent, true, true)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__grill-pane__grill_round', ...ROUND })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'accept-all' })

  expect(sent).toHaveLength(1)
  await ui.unmount()
})
