# 每日待办支持历史日期添加

## 需求

- 用户可以在日历页选中任意日期后，为该日期添加待办。
- 如果目标日期的 Daily Note 不存在，添加时遵循现有 `autoCreateDailyNote` 设置自动创建或提示不存在。
- 今日页“添加到今日”的现有行为保持不变。

## 实现边界

- 不引入新的存储，仍写入对应日期 Daily Note 的 TodoList 标题区块。
- 不改变任务排期字段格式，继续使用 `formatTaskInput` 与现有开始/结束/到期/优先级输入。
- 日历页选中日期的任务列表应在添加后刷新，并更新月历统计缓存。

## 环境限制

- `.ccg/spec/` 不存在。
- `~/.claude/bin/codeagent-wrapper` 不存在，无法执行 AGENTS.md 要求的 Gemini + Claude 外部模型分析；本任务以本地代码分析和构建验证替代。
