# ADR 0001：v2 API 与旧路径并存

## 状态

已接受（2026-11-17）

## 背景

上传包已有 `/api` 下的教学导入、窗口观察与教练成文；改造引入 `/api/v2`、bundle/handoff 契约与 IndexedDB 新库表，但不能打断玩家既有录像、隐藏卡与历史报告。

## 决策

- 新数据结构与校验走 v2 路由与 `shared/contracts`；旧接口与 `matches` / `shelf` / `cards` / `hidden` 读取路径保持不变。
- IndexedDB 自 v3 增量升级到 v4，仅追加对象仓库，不重写旧表。
- 历史报告按生成时的格式打开；主动重分析开新任务，不静默迁移旧 job。

## 后果

- 需维护双轨测试：旧 `validation.test.mjs` 与新的契约测试。
- 前端逐步替换 `linkTimes()` 为类型化引用，旧页在过渡期仍可工作。