# Skills

Agent skills used by overwatch-guide. Runtime injection goes through `server/skills.mjs` and the generated `shared/skills-manifest.mjs`.

## Overwatch stages

| Stage | Skill |
| --- | --- |
| distill / version | `overwatch-knowledge-distiller` |
| read-match | `overwatch-read-match` |
| fight / coach | `overwatch-kb-review` (+ `COACH_SKILL` for coach) |

## Engineering

Matt Pocock engineering skills under `engineering/` (`tdd`, `improve-codebase-architecture`, `to-issues`, `zoom-out`) guide how we change this repo. They are not injected into the vision/text model calls.

## Regenerate manifest

```bash
node scripts/skills-manifest.mjs
```
