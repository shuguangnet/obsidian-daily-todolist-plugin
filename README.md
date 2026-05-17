# Daily TodoList Obsidian Plugin

Daily TodoList 是一个以 Daily Note Markdown 为唯一数据源的 Obsidian 待办插件。它在每日笔记的指定标题区块中管理 checkbox，并提供今日视图、月历汇总、高级时间轴甘特图和 Mermaid 甘特图导出。

## 特性

- **今日待办**：在今日 Daily Note 的 `## TodoList` 区块中添加、编辑、完成、取消完成和删除任务。
- **日历视图**：按月查看每日待办数量、完成数量和带排期任务数量，并可点击日期查看当天任务。
- **甘特图排期**：读取任务中的排期元数据，提供高级时间轴视图，并可渲染 / 插入 Mermaid gantt。
- **优先级标记**：添加任务时可选择优先级，并按设置页配置的颜色展示在任务卡片和甘特图任务条中。
- **命令面板**：支持打开今日视图、日历视图、甘特图视图、添加今日待办、打开今日笔记、插入甘特图到今日笔记。
- **设置页**：支持 Daily Notes 设置复用、标题名、插入位置、显示已完成、自动创建 Daily Note、默认视图、甘特图读取范围和优先级颜色。

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

## 视图说明

### 今日视图

今日视图用于快速捕捉当天任务。添加任务时可以填写任务内容、开始时间、结束时间、到期时间和优先级。插件会把这些信息写回今日 Daily Note 的 `TodoList` 标题区块，仍然保持 Markdown 可读、可迁移。

### 日历视图

日历视图按月汇总 Daily Note 中的待办数量、完成数量和带排期任务数量。点击某一天可以查看该日期的任务列表。

### 甘特图视图

甘特图视图会读取设置范围内的 Daily Note，并把带有 `[start::]`、`[end::]`、`[due::]` 或 `📅` 的任务展示为时间轴任务条。新版时间轴包含：

- 排期范围概览和任务统计。
- 月份 / 日期双层刻度。
- Today 当前日期标记线。
- 按优先级颜色渲染的任务条。
- 已完成任务弱化展示，逾期任务突出提示。
- 可一键渲染 Mermaid 甘特图预览。

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

3. 在 Obsidian Community plugins 中重新加载并启用 `Daily TodoList`。

## 命令

| 命令 | 说明 |
|------|------|
| `Open Daily TodoList view` | 打开插件侧边栏 |
| `Add todo to today` | 通过弹窗添加今日任务 |
| `Open Daily TodoList calendar` | 打开日历页签 |
| `Open Daily TodoList gantt` | 打开甘特图页签 |
| `Insert Daily TodoList gantt to today note` | 将当前范围的 Mermaid 甘特图插入今日笔记 |
| `Open today daily note` | 打开今日 Daily Note |

## 目录结构

```text
obsidian-daily-todolist-plugin/
├── manifest.json
├── styles.css
├── src/calendar.ts
├── src/commands.ts
├── src/daily-note.ts
├── src/main.ts
├── src/markdown-tasks.ts
├── src/schedule.ts
├── src/settings.ts
├── src/task-format.ts
├── src/types.ts
└── src/view.ts
```

## 相关文档

- [设计文档](DESIGN.md)
