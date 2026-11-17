# 从视频判读交给复盘

用同一份时间轴交接。时间为相对上传文件起点的秒数。多文件各有各的零点。时段用 `start_s`、`end_s`，单一时刻可相等；时间未知填 `null`。局内倒计时另外记。按实际材料选填，仅需文字时沿用同样的信息顺序。

| 字段 | 含义 |
| --- | --- |
| `source`、`player` | 片名或可识别的素材名称；玩家名或用户指定的视角。回放里给被观察者名牌。 |
| `player_team` | 玩家队伍色：`blue` / `red` / `unknown`。以左下角 HUD（`hud` 区域）为准；本人颜色即我方。 |
| `rounds[]` | 回合 ID、时段、地图、模式、目标阶段、己方攻防职责。换边更新职责，对称模式记录局部目标状态。 |
| `lineups[]`、`swaps[]` | 每个阵容快照只放该时段的英雄，允许部分已知。换人另存所属队、旧英雄最后确认和新英雄首次确认两个边界。 |
| `teams` | 身份阶段可用：`{ blue:[], red:[], allies:[], enemies:[], teamKnown }`。先按颜色读英雄条（`bars`），再按 `player_team` 映射成 allies/enemies。每边最多 5 人。 |
| `evidence[]` | 本片内唯一 ID、时段、来源、事实或推断。来源可为画面、音轨、玩家说明、回放元数据、既有复盘。对决策重要时写当事人当时能看到/听到什么。 |
| `fights[]` | 每波 ID、回合 ID、时段、目标、双方可见动作、结果与引用的证据 ID。缺一侧画面时保留已知一侧。 |
| `playstyle` | 双方按阶段的实际打法与对应团战或证据 ID。 |

区域词表（裁剪标签）：`weapon` 武器/双手/准星；`abilities` 技能栏；`hud` 左下角玩家 ID；`bars` 顶部双方英雄条；`full` 整帧地图与目标。玩家英雄只允许引用 `weapon`/`abilities`。

## 项目问答中怎样记录换人与关键动作

《守望先锋坦克教学》记录的是国王大道 A 点进攻温斯顿。旧点评记载己方为温斯顿、源氏、黑百合（后换卡西迪）、安娜、雾子，敌方为西格玛、死神、西拉、巴蒂斯特、朱诺。该记录没有给出确切换人秒数。实际判读另一局时，从那局画面重新建立双方阵容。

| 旧点评中的录像时间 | 可交接的信息 | 复盘时回看什么 |
| --- | --- | --- |
| 00:08、00:16 | 温斯顿首次跳到雕像，随后转二楼 | 逐个记录落点和离开路径，查队友射线及对方高台变化，再判断这两跳起什么作用。 |
| 01:07–01:11 | 温斯顿在二楼处理西拉 | 回看目标血线、击杀归属和追击后的站位。队友是否同时进场需要独立证据。 |
| 01:49–01:53 | 西格玛开大后温斯顿阵亡；旧点评记载其阵亡时原始暴怒为 94% | 查敌方施法起点、玩家被抬起前的跳跃图标和可达落点。阵亡时的读数只说明该时刻。 |
| 02:15 | 旧点评记载己方拿下 A 点 | 记录为阶段结果；整局胜负另取画面。 |

下面演示其中一段的最小交接。示例保留旧点评来源，供后续定位原片。
```json
{
  "source": "国王大道 A 点片段",
  "player": "上传者",
  "rounds": [{"id": "R1", "map": "国王大道", "mode": "混合", "objective": "A 点", "side": "进攻", "evidence_ids": ["E1"]}],
  "lineups": [{"round_id": "R1", "player_hero": "温斯顿", "scope": "早段阵容", "allies": ["温斯顿", "源氏", "黑百合", "安娜", "雾子"], "enemies": ["西格玛", "死神", "西拉", "巴蒂斯特", "朱诺"], "evidence_ids": ["E1"]}],
  "swaps": [{"round_id": "R1", "team": "ally", "from": "黑百合", "to": "卡西迪", "last_old_s": null, "first_new_s": null, "evidence_ids": ["E1"]}],
  "evidence": [
    {"id": "E1", "start_s": null, "end_s": null, "source_kind": "既有复盘", "detail": "上一轮复盘给出的阵容、换人和攻防。"},
    {"id": "E2", "start_s": 67, "end_s": 71, "source_kind": "既有复盘", "detail": "温斯顿在二楼处理西拉。"}
  ],
  "fights": [{"id": "F1", "round_id": "R1", "start_s": 67, "end_s": 71, "scope": "团战中的决策片段", "ally_action": "温斯顿在二楼攻击西拉", "enemy_response": null, "evidence_ids": ["E2"]}],
  "playstyle": [{"scope": "玩家片段", "detail": "温斯顿利用二楼给敌方输出施压", "evidence_ids": ["E2"]}]
}
```

游戏机制影响判读时，可按录像版本查询对应资料。暴雪对国王大道的说明区分了占点和随后的运载阶段，英雄页分别列出回声的复制和 D.Va 的离舱、呼叫机甲。把这些规则与本局的目标提示和角色名牌对应起来。[地图与混合模式](https://overwatch.blizzard.com/en-us/news/20119626/) · [回声](https://overwatch.blizzard.com/en-us/heroes/echo/) · [D.Va](https://overwatch.blizzard.com/en-us/heroes/dva/)

## 本地抽帧

在技能目录执行，最后一个路径是新的临时输出目录。先浏览概览，再对关键区间加密。JPEG 保留原始画面尺寸，`frames.csv` 的 `video_s` 是所选源帧在录像时间轴的显示时刻。变量帧率素材按时间取样。

```bash
python3 scripts/sample_frames.py match.mp4 /tmp/ow-overview --step 5
python3 scripts/sample_frames.py match.mp4 /tmp/ow-fight --start 107 --end 114 --step 0.25
```

把看清楚的画面内容写入证据。跨采样间隔发生的事件用前后帧界定，必要时回到原视频或重采。
