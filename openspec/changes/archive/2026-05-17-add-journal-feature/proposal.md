## Why

当前插件已经围绕 Daily Note 提供 TodoList、Memo、日历、甘特图和知识库总览能力，但缺少一个用于记录完整当日内容的“日记”层。用户只能用零散的 Memo 记碎片，无法在同一工作流里沉淀成段复盘、进展记录和当日总结，因此需要补齐一个与 Todo / Memo 并列、但语义更完整的 Journal 能力。

## What Changes

- 新增 Journal 数据能力，在 Daily Note 的指定标题区块中读取和写入整段日记内容。
- 新增独立的“日记”页签，用于查看和编辑今日日记，并提供打开今日笔记的快捷入口。
- 为 Journal 增加可配置标题名，保持与现有 TodoList / Memo 的区块化写入模式一致。
- 在首页或统计视图中增加基础 Journal 活跃信息，让用户可以感知当月日记记录情况。
- 新增与 Journal 相关的命令入口，支持快速打开日记视图或今日笔记中的日记内容。

## Capabilities

### New Capabilities
- `daily-journal`: 在 Daily Note 中管理 Journal 标题区块，支持今日日记编辑、读取和保存。
- `journal-activity-summary`: 在首页或统计视图中展示 Journal 基础活跃信息，帮助用户感知日记记录情况。

### Modified Capabilities
<!-- 无 -->

## Impact

- 受影响代码主要包括 `src/view.ts`、`src/settings.ts`、`src/types.ts`、`src/commands.ts`，以及新增的 Journal 区块解析/写入模块。
- 受影响 UI 包括侧边栏页签、设置页、首页或统计页卡片。
- 不引入新的外部依赖，也不改变现有 Daily Note 作为唯一数据源的架构。
