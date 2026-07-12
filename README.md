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

## 업데이트

```bash
git -C ~/Projects/skills pull
```

심링크로 연결되어 있으므로 pull만 하면 바로 반영된다.
