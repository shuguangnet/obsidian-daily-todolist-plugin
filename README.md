# Vault Atlas HQ Obsidian Plugin

Vault Atlas HQ 是一个面向 Obsidian 知识库主页的插件。它一边保留 Daily Note 待办、备忘录、日历和甘特图能力，一边把首页和统计页升级成整个 Vault 的总控台，用来展示目录分类、标签热度、链接枢纽、结构字段、最近更新和活跃趋势。

## 特性

- **知识库首页**：展示笔记总量、近 7 天活跃度、孤岛笔记、目录分布、标签热区、frontmatter 字段、链接枢纽和最近更新。
- **今日待办**：在今日 Daily Note 的 `## TodoList` 区块中添加、编辑、完成、取消完成和删除任务。
- **备忘录**：在今日 Daily Note 的 `## Memo` 区块中追加普通列表备忘录，并支持查看、打开来源和删除。
- **日历视图**：按月查看每日待办数量、完成数量和带排期任务数量，并可点击日期查看当天任务。
- **甘特图排期**：读取任务中的排期元数据，提供高级时间轴视图，并可渲染 / 插入 Mermaid gantt。
- **统计面板**：按当前月份统计 TodoList 与 Memo，同时补充 Vault 级别的标签、frontmatter、未解析链接、结构层级和新建笔记数据。
- **优先级标记**：添加任务时可选择优先级，并按设置页配置的颜色展示在任务卡片和甘特图任务条中。
- **定时通知与 webhook**：按设定时间自动汇总今日未完成任务、今日已完成、日记和备忘录，可通过 Obsidian Notice、系统通知或 webhook 推送到自动化平台。
- **命令面板**：支持打开今日视图、日历视图、甘特图视图、宽工作区视图、添加今日待办、打开今日笔记、插入甘特图到今日笔记。
- **设置页**：支持 Daily Notes 设置复用、标题名、插入位置、显示已完成、自动创建 Daily Note、默认视图、甘特图读取范围、优先级颜色以及通知/Webhook 配置。

## 任务语法

普通任务：

```markdown
- [ ] 写周报
- [x] 整理会议纪要
```

带排期任务：

```markdown
- [ ] 开发插件日历视图 [start:: 2026-05-17 09:30] [end:: 2026-05-20 18:00]
- [ ] 发布插件 [due:: 2026-05-21 10:00]
- [ ] 复盘 📅 2026-05-22 16:30
```

也兼容仅填写日期的排期字段，例如 `[start:: 2026-05-17]`。

带优先级任务：

```markdown
- [ ] 修复发布阻塞问题 [priority:: high]
- [ ] 整理素材 [priority:: low]
```

优先级名称和颜色可在插件设置页调整。插件只修改目标任务行或 `TodoList` 区块插入点，不会全局格式化笔记。

## 备忘录语法

备忘录保存在每日笔记的 `## Memo` 区块中，使用普通 Markdown 列表：

```markdown
## Memo

- 会议决定下周三发布内测版本
- 记得整理甘特图反馈
```

备忘录标题可在插件设置页调整。

## 视图说明

### 首页

首页是知识库控制面板。它会扫描整个 Vault 的 Markdown 笔记，展示总笔记数、最近活跃度、孤岛笔记、顶层目录分布、标签热区、frontmatter 字段、链接中枢、最近更新笔记以及适合继续整理的“沉睡笔记”，同时保留今日待办和备忘录作为快速操作入口。

### 今日视图

今日视图用于快速捕捉当天任务。添加任务时可以填写任务内容、开始时间、结束时间、到期时间和优先级。插件会把这些信息写回今日 Daily Note 的 `TodoList` 标题区块，仍然保持 Markdown 可读、可迁移。

### 备忘录视图

备忘录视图用于快速记录当天灵感、会议结论或临时备注。内容会写入今日 Daily Note 的 `Memo` 标题区块，支持 `Cmd/Ctrl + Enter` 快速添加。

### 日记视图

日记视图用于记录今日日志、复盘和思考。内容会写入今日 Daily Note 的 `Journal` 标题区块，保留自由文本书写空间。

### 日历视图

日历视图按月汇总 Daily Note 中的待办数量、完成数量和带排期任务数量。点击某一天可以查看该日期的任务列表。

### 统计视图

统计视图按当前月份聚合 TodoList、Memo 和 Journal 数据，同时叠加整个 Vault 的标签数、frontmatter 覆盖率、未解析链接、平均篇幅、目录层级分布、链接中枢和新建笔记清单。

### 甘特图视图

甘特图视图会读取设置范围内的 Daily Note，并把带有 `[start::]`、`[end::]`、`[due::]` 或 `📅` 的任务展示为时间轴任务条。新版时间轴包含：

- 排期范围概览和任务统计。
- 月份 / 日期双层刻度。
- Today 当前日期标记线。
- 按优先级颜色渲染的任务条。
- 已完成任务弱化展示，逾期任务突出提示。
- 可一键渲染 Mermaid 甘特图预览。

## 通知与 Webhook

插件会按设置页中的 `通知时间` 轮询当前时间；当时间命中且仍处于 `补发窗口（分钟）` 内时，会自动生成今日摘要。摘要可包含：

- 今日未完成待办
- 今日已完成待办
- 今日日记
- 今日备忘录

支持的通知通道：

- `Obsidian 内提醒`：在应用内显示 Notice
- `系统通知`：使用浏览器 Notification API
- `webhook`：以 JSON 形式发送到你的自动化系统

常见 webhook 场景：

- 发到 n8n / Make / Zapier，再转企业微信、飞书、Telegram
- 发到自建服务，写入数据库或日志
- 发到机器人网关，推送“晚间复盘”摘要

Webhook 会发送结构化 JSON，核心字段包括：

```json
{
  "plugin": "obsidian-daily-todolist",
  "pluginName": "Vault Atlas HQ",
  "reason": "scheduled",
  "slot": "21:30",
  "date": "2026-05-18",
  "filePath": "Daily Notes/2026-05-18.md",
  "summary": {
    "pendingCount": 3,
    "completedCount": 5,
    "memoCount": 2,
    "hasJournal": true
  },
  "blocks": {
    "pending": [],
    "completed": [],
    "journal": "....",
    "memos": []
  },
  "text": "# 2026-05-18 Daily Digest ..."
}
```

如果配置了 `Webhook Secret`，插件会额外发送请求头 `x-dtl-secret`。`自定义请求头` 支持直接填写 JSON，例如：

```json
{"Authorization":"Bearer your-token"}
```

### 宽工作区模式

宽工作区模式用于把 Vault Atlas HQ 打开到主工作区，而不是只占用右侧窄栏。它更适合这些场景：

- 查看首页统计和多卡片总览
- 阅读更长的甘特图时间轴
- 以更大的空间完成 Journal / Memo / Stats 工作流

默认命令仍然保持右侧栏打开行为；如果你想进入更宽的工作区，请使用 `Open Vault Atlas HQ in wide workspace` 命令，或在首页点击“宽屏打开”。

## 使用方法

1. 构建插件：

```bash
npm install
npm run build
```

2. 将 `main.js`、`manifest.json`、`styles.css` 放入 Vault 插件目录：

```text
.obsidian/plugins/obsidian-daily-todolist/
```

3. 在 Obsidian Community plugins 中重新加载并启用 `Vault Atlas HQ`。

## 命令

| 命令 | 说明 |
|------|------|
| `Open Daily TodoList view` | 打开插件侧边栏 |
| `Open Vault Atlas HQ in wide workspace` | 在主工作区打开更宽的 Vault Atlas HQ 视图 |
| `Add todo to today` | 通过弹窗添加今日任务 |
| `Open Vault Atlas calendar` | 打开日历页签 |
| `Open Vault Atlas journal` | 打开日记页签 |
| `Open Vault Atlas gantt` | 打开甘特图页签 |
| `Insert Daily TodoList gantt to today note` | 将当前范围的 Mermaid 甘特图插入今日笔记 |
| `Open today daily note` | 打开今日 Daily Note |
| `Send daily digest now` | 立即发送一份今日摘要，便于手动触发 |
| `Send test webhook` | 立即向 webhook URL 发送一次测试摘要 |

## 目录结构

```text
obsidian-daily-todolist-plugin/
├── manifest.json
├── styles.css
├── src/calendar.ts
├── src/commands.ts
├── src/daily-note.ts
├── src/journal.ts
├── src/main.ts
├── src/markdown-tasks.ts
├── src/memos.ts
├── src/schedule.ts
├── src/settings.ts
├── src/task-format.ts
├── src/types.ts
└── src/view.ts
```

## 相关文档

- [设计文档](DESIGN.md)
