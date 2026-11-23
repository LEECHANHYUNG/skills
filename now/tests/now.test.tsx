import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'now',
  component: 'Pane',
  requestId: 'now',
  props: {
    title: '지금 하는 일',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const

test('TodoWrite 결과가 진행 단계에 보인다', async ($, on) => {
  on('turn.start', (_, e) => e)
  on('tool.call', () => ({
    result: {
      oldTodos: [],
      newTodos: [
        { content: '파일 작성', status: 'completed', activeForm: '파일 작성 중' },
        { content: '테스트', status: 'in_progress', activeForm: '테스트 실행 중' },
      ],
    },
  }))

  await $.turn.start({ text: '만들어줘', turnId: 't1' })
  await $.tool.call({ tool: 'TodoWrite', todos: [] })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /\[x\]/ }))?.text).toBe('[x] 파일 작성')
    expect((await ui.find({ type: 'Text', text: /\[>\]/ }))?.text).toBe(
      '[>] 테스트 실행 중',
    )
    await ui.unmount()
  }
})

test('질문으로 끝난 턴은 응답 대기, 도구를 쓴 턴은 요약을 만든다', async ($, on) => {
  on('turn.start', (_, e) => e)
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  // 타이머는 즉시 실행된 것으로 친다.
  on('clock.after', () => ({ value: {} }))
  on('clock.now', () => ({ value: 0 }))
  on('model.fork', () => ({
    value: {
      isAnswered: true,
      text: '{"goal": "now mod 만들기", "progress": "파일 작성 완료", "next": "테스트 실행"}',
      usage: {},
    },
  }))

  await $.turn.start({ text: '만들어줘', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Bash', command: 'pwd' })
  await $.turn.complete({
    answer: '이대로 진행할까요?',
    reason: 'answer',
    durationMs: 10,
    isAborted: false,
    turnId: 't1',
  })
  // 요약은 훅 밖에서 비동기로 돈다. 한 틱 기다려 끝나게 한다.
  await new Promise(r => setTimeout(r, 20))

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /사용자 응답 대기 중/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /now mod/ }))?.text).toBe('now mod 만들기')
    expect((await ui.find({ type: 'Text', text: /테스트 실행/ }))?.text).toBe('테스트 실행')
    await ui.unmount()
  }
})
