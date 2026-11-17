# ADR 0003：双时间轴引用

## 状态

已接受（2026-11-17）

## 背景

本局与教学材料可能同时显示 `01:20`，若共用一套时间链接，玩家会跳到错误素材。

## 决策

- **本局引用**：`match_id`、`clip_id`、`evidence_id`、`start_s` / `end_s`，点击定位当前播放器。
- **教学引用**：`bundle_id`、`card_id`、`revision`、`claim_id`，再解析到 `source_id` 与原课字幕/时段。
- 复盘输出 `citations[]` 使用 `kind: "match" | "teaching"`，UI 与 Markdown 导出共用同一结构。

## 后果

- `validateFightReview` 校验引用形态；`review/fight` 越界引用须在本步修复。
- 报告渲染需分派两种跳转处理器，替代单一的 `linkTimes()`。