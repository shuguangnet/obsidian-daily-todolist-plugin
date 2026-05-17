# Vault Atlas HQ Obsidian Plugin 设计文档

## 设计概述

### 目标

- 提供一个可作为 Obsidian 知识库主页使用的侧边栏总控台。
- 扫描 Vault 级别的目录、标签、链接、frontmatter 和活跃度，用于分类和统计展示。
- 以 Daily Note Markdown checkbox 作为日常执行层的数据源，保留今日待办、备忘录、月历和甘特图。
- 保持实现轻量，不引入 React 或外部运行时依赖。

### 非目标

- 不实现跨日自动 rollover。
- 不深度解析 Tasks 插件全部语法。
- 不维护独立数据库或状态文件。
- 不实现拖拽排序和复杂项目管理字段。

## 架构设计

```text
Obsidian Commands / Ribbon
          │
          ▼
DailyTodoListPlugin
          │
          ├── DailyTodoListView
          │     ├── Vault Atlas 首页
          │     ├── 今日任务 CRUD
          │     ├── 日历汇总
          │     └── Mermaid 甘特图预览
          │
          ├── daily-note.ts      Daily Note 路径解析、创建、打开
          ├── markdown-tasks.ts  TodoList 标题区块解析与最小化写入
          ├── calendar.ts        月历网格与每日统计
          └── schedule.ts        排期元数据解析与 Mermaid gantt 生成
          └── vault-analytics.ts Vault 全局分类与统计分析
```

## 核心组件

- **DailyTodoListPlugin**：插件入口，加载设置、注册视图、命令和设置页。
- **DailyTodoListView**：侧边栏主视图，包含知识库首页、今日、备忘录、日历、甘特图和统计页签。
- **AddTodoModal**：命令面板添加今日待办的输入弹窗。
- **DailyTodoListSettingTab**：插件设置页。
- **markdown-tasks.ts**：只在指定标题区块内解析和修改 checkbox 行。
- **schedule.ts**：解析 `[start::]`、`[end::]`、`[due::]`、`[priority::]` 和 `📅` 元数据，并生成 Mermaid 甘特图。
- **calendar.ts**：按月份读取 Daily Note 汇总每日任务数量。
- **vault-analytics.ts**：扫描 Vault 内 Markdown 文件，聚合目录、标签、frontmatter、链接、字数和最近活跃度。

## 数据模型

任务仍保存在 Daily Note 中：

```markdown
## TodoList

- [ ] 开发日历视图 [start:: 2026-05-17 09:30] [end:: 2026-05-20 18:00] [priority:: high]
- [ ] 发布插件 [due:: 2026-05-21 10:00] [priority:: medium]
```

运行时派生字段：

- `displayText`：移除排期和优先级元数据后的展示文本。
- `startDate` / `endDate` / `dueDate`：排期信息，支持 `YYYY-MM-DD` 和 `YYYY-MM-DD HH:mm`。
- `priority`：任务优先级，匹配设置中的 `priorityOptions.id` 或旧任务中的标签文本。
- `date` / `filePath`：任务来源 Daily Note。

## 设计决策

| 日期 | 决策 | 理由 | 影响 |
|------|------|------|------|
| 2026-05-17 | 使用 Daily Note Markdown 作为唯一数据源 | 避免同步和数据迁移问题 | 性能取决于读取的日期范围 |
| 2026-05-17 | 使用 Obsidian DOM helper 构建 UI | 保持插件简单、无前端框架依赖 | UI 复杂度受限 |
| 2026-05-17 | 使用内联字段保存排期 | 与 Obsidian / Dataview 风格兼容 | 需要用户按约定书写日期 |
| 2026-05-17 | 甘特图使用 Mermaid 渲染 | Obsidian 原生支持 Markdown 代码块渲染 | 不实现自定义拖拽甘特编辑 |
| 2026-05-17 | 使用内联字段保存优先级 | 继续保持 Markdown 可读和可迁移 | 优先级颜色由插件设置负责展示 |
| 2026-05-17 | 首页统计基于 Vault 实时扫描 | 保证知识库总览不依赖额外索引数据库 | 大型 Vault 下刷新成本随笔记数增长 |

## 安全考量

- 所有路径均为 Vault 相对路径，并通过 `normalizePath` 处理。
- 插件不访问 Vault 外部文件。
- 任务文本以 DOM `text` 写入 UI，不使用 HTML 注入。
- Markdown 写入只修改目标标题区块或目标任务行，避免全局重排用户笔记。
- toggle/delete 使用 `line + raw` 校验，任务行变化时提示刷新。

## 已知限制

- 月历和甘特图通过读取日期范围内的 Daily Note 汇总，范围过大时可能变慢。
- 甘特图是预览和插入 Markdown，不支持拖拽编辑排期。
- 仅解析简单 checkbox：`- [ ]`、`- [x]`、`* [ ]`、`* [x]`。

## 变更历史

### 2026-05-17 - 优先级

- 新增任务优先级元数据解析和写入。
- 设置页支持调整默认优先级名称和颜色。
- 添加任务弹窗和侧边栏快速捕捉支持选择优先级。

### 2026-05-17 - 日历与甘特图

- 新增日历页签，支持查看每日日待办统计和指定日期任务。
- 新增甘特图页签，支持读取排期元数据并渲染 Mermaid gantt。
- 新增插入甘特图到今日笔记命令。

### 2026-05-17 - 初始版本

- 创建最小可用 Obsidian Daily TodoList 插件。

### 2026-05-17 - Vault Atlas 首页

- 新增 Vault 级别的数据扫描模块，统计目录、标签、frontmatter、链接和活跃度。
- 首页升级为知识库总控台，展示分类榜单、活跃图、最近更新和沉睡笔记。
- 统计页新增 Vault 级指标，支持从“任务管理”扩展到“知识库运营”视角。
