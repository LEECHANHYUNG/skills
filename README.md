# skills

Claude Code에서 사용하는 개인 스킬 모음.

## 스킬 목록

| 스킬 | 설명 |
| --- | --- |
| [topdown-learning](./topdown-learning/SKILL.md) | 주제를 던지면 "동작하는 전체"에서 시작해 모르는 개념을 재귀적으로 파고들며 아하 모먼트에 도달하게 하는 탑다운 학습 스킬. Gabriel Petersson의 recursive gap filling 방식 기반. |

## 설치

스킬 원본은 이 레포에 두고, `~/.claude/skills/`에는 심링크만 연결한다. 레포에서 `git pull`만 하면 모든 컴퓨터의 스킬이 함께 갱신된다.

```bash
git clone https://github.com/LEECHANHYUNG/skills.git ~/Projects/skills

mkdir -p ~/.claude/skills
ln -s ~/Projects/skills/topdown-learning ~/.claude/skills/topdown-learning
```

연결 후 Claude Code 세션에서 `/reload-skills`를 실행하면 스킬이 등록된다.

## mod 목록

| mod | 설명 |
| --- | --- |
| [now](./now/hooks/register.tsx) | 지금 세션에서 무엇을 하고 있는지(현재 목표, 진행 단계, 다음 할 일, 응답 대기 여부) 패널에 정리해서 보여준다. `/now`로 패널을 열고 닫고, `/now refresh`로 요약을 즉시 갱신한다. |
| [grill-pane](./grill-pane/hooks/register.tsx) | grill-me(grilling) 라운드를 pane에 띄워 질문마다 선택지 버튼, 직접 입력 칸, [모두 추천대로]·[제출] 버튼으로 답하게 한다. 답은 `[grill-me 라운드 N 답변]` 메시지로 대화에 남는다. `/grill`로 마지막 라운드를 다시 연다. 마우스 클릭은 풀스크린 터미널(`"tui": "fullscreen"`)에서만 되고, pane은 터미널 폭 110열 이상에서 뜬다. |

### mod 설치

이 컴퓨터처럼 레포를 클론해 두었다면, `~/.claude/settings.json`의 `env`에 폴더를 등록해 레포에서 바로 불러온다. 레포를 고치면 바로 반영된다. 여러 개는 `:`로 잇는다.

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "~/Projects/skills/now:~/Projects/skills/grill-pane" } }
```

클론 없이 설치하려면 터미널 세션 프롬프트에서:

```
/plugin install now --marketplace LEECHANHYUNG/skills
/plugin install grill-pane --marketplace LEECHANHYUNG/skills
```

## 업데이트

```bash
git -C ~/Projects/skills pull
```

심링크로 연결되어 있으므로 pull만 하면 바로 반영된다.
