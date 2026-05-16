# Daily TodoList Obsidian Plugin

Daily TodoList 是一个以 Daily Note Markdown 为唯一数据源的 Obsidian 待办插件。它在每日笔记的指定标题区块中管理 checkbox，并提供今日视图、月历汇总和 Mermaid 甘特图排期视图。

## 特性

- **今日待办**：在今日 Daily Note 的 `## TodoList` 区块中添加、完成、取消完成和删除任务。
- **日历视图**：按月查看每日待办数量、完成数量和带排期任务数量，并可点击日期查看当天任务。
- **甘特图排期**：读取任务中的排期元数据并渲染 Mermaid gantt。
- **命令面板**：支持打开今日视图、日历视图、甘特图视图、添加今日待办、打开今日笔记、插入甘特图到今日笔记。
- **设置页**：支持 Daily Notes 设置复用、标题名、插入位置、显示已完成、自动创建 Daily Note、默认视图和甘特图读取范围。

## 任务语法

普通任务：

```markdown
- [ ] 写周报
- [x] 整理会议纪要
```

带排期任务：

```markdown
- [ ] 开发插件日历视图 [start:: 2026-05-17] [end:: 2026-05-20]
- [ ] 发布插件 [due:: 2026-05-21]
- [ ] 复盘 📅 2026-05-22
```

插件只修改目标任务行或 `TodoList` 区块插入点，不会全局格式化笔记。

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
├── src/types.ts
└── src/view.ts
```

## 相关文档

- [设计文档](DESIGN.md)
