# overwatch-knowledge-distiller

将守望先锋教学视频拆成可追溯的知识卡，用于 overwatch-guide 的教学知识库与后续对局复盘。

## 包含什么

```text
overwatch-knowledge-distiller/
├── SKILL.md                          # Agent 入口与完整工作流程
├── README.md
├── requirements.txt                  # 仅可选校验器需要
├── references/
│   ├── taxonomy.md                   # 五类定义、拆分、归类与历史职业
│   └── evidence-and-versioning.md     # 来源证据、官方核验、版本更新
├── assets/
│   ├── teaching-card.template.md
│   ├── version-card.template.md
│   ├── output.template.md
│   └── bundle.schema.json            # JSON Schema 2020-12
├── examples/
│   ├── demo.cards.md                 # 人工编写的格式演示，不是视频蒸馏
│   └── demo.bundle.json
├── scripts/
│   └── validate_bundle.py            # 结构与引用一致性检查，无网络操作
└── tests/
    └── test_validator.py
```

## 使用

把整个目录放入宿主 Agent 支持的 skills 目录，保持目录名与 SKILL.md 的 name 一致。具体加载路径取决于宿主；不假定所有产品都使用同一个安装目录。

也可以让能够读文件的 Agent 直接读取 SKILL.md 并按其操作。不支持 skill 自动发现的宿主不会因为有该目录就自动获得能力。本包没有把 skill 自动安装到任何账号、应用或项目。

示例请求：

> 使用 overwatch-knowledge-distiller 处理我提供的教学视频。按知识单元分别分类，一个视频允许多个分类。输出可追溯知识卡、原视频时间戳和当前版本差异。只有实际读取的内容才能入卡；规则不明或无法访问的部分列为待处理。

处理历史教学时：

> 保留这段教学的原版本语境。对机制、威能、数值和地图相关内容查官方当前资料，生成版本卡，并说明哪些教学条件需要更新，不覆盖作者原结论。

## 分类设计

四类教学：重装／具体英雄、输出／具体英雄、辅助／具体英雄、综合／主题。

第五类：版本／官方事实，覆盖英雄、地图、机制、模式与威能。一个教学观点和其依赖的机制事实分别建卡，用 depends_on_cards 关联。

一张卡只有一个主分类；一段视频可以生成多张、跨多个分类的卡。仅出现某个英雄不构成该英雄的教学。没有某类有效内容时不凑数。

## 宿主需要提供的能力

读取实际视频或字幕，必要时定位关键画面；核验当前版本时访问网页。无音频读取能力时不补造语音讲解，无正文时不拿标题/简介当作教学内容。

本包不包含视频下载器、转写模型、账号登录工具、爬虫或自动入库服务。脚本只验收 Agent 产出的结构化数据。

## 校验

在本目录运行：

```bash
python -m pip install -r requirements.txt
python scripts/validate_bundle.py examples/demo.bundle.json
python -m unittest discover -s tests -v
```

生产导出前可运行：

```bash
python scripts/validate_bundle.py output/my-run/bundle.json --production
```

默认检查允许明确标为 demo 的示例；--production 会拒绝所有虚构来源和 demo 卡片，但允许保留 draft / needs_review 等真实待审核内容。它不是“所有卡都可发布”的检查开关。

检查包括：Schema、重复ID、来源/证据/版本依赖引用、时间戳覆盖范围、主体角色与分类一致性、官方事实来源、缺失版本范围、核心模型推论被误标 ready、循环派生等。

**通过脚本不代表视频内容、战术结论或当前版本已经真实核验。** 相应审核仍由执行分析的 Agent 或人完成。

## 状态与检索

ready 仅表示来源支撑与结构审核已通过。用于当前版本复盘时，还需要检查目标规则匹配与版本状态。demo、conflict、被 supersedes 替代的卡不得作为当前生产教学答案。

所有引用的版本卡应把快照包含在同一个 bundle 中，便于验证。其他外部卡片关系可以用 external_card_ids 声明；不能用这个字段绕过版本依赖核验。

## 重要边界

示例中的虚构讲解只用于理解格式，没有引用老王、Guxue 或用户前面对局。正式运行时，时间戳、作者观点、截图和官方事实必须来自实际读取的来源。

本包没有预装当前英雄名单、英雄总数或完整版本数值；执行时依据用户目标和官方资料核验，避免随游戏更新失效。

外部格式依据与官方资料入口见 references/evidence-and-versioning.md。
