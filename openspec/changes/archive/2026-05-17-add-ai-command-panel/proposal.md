## Why

当前插件已经覆盖 Daily Note 的 Todo、Memo、Journal 与 Vault 级分析，但所有智能协作仍然发生在 Obsidian 之外。为了让用户在知识库上下文中直接调用本地 AI CLI，并把输出回流到 Memo、Journal、Todo 或正式笔记，需要先提供一个受控的 AI Command Panel，而不是一步到位做完整终端仿真。

## What Changes

- 新增 AI Command Panel 视图，用于在插件内选择 provider、输入 prompt、运行一次性命令并查看输出。
- 支持配置并调用本地 AI CLI provider，例如 Claude Code、Codex、OpenCode。
- 支持从当前笔记、今日日记、今日任务等来源收集上下文，并注入到命令执行流程。
- 支持将 AI 输出保存到 Memo、Journal 或新建笔记，形成“调用 → 结果沉淀”的闭环。
- **BREAKING** 将插件定位收敛为桌面端优先能力，AI Command Panel 首版仅面向桌面环境设计。

## Capabilities

### New Capabilities
- `ai-command-panel`: 在插件内提供受控 AI CLI 命令面板，支持选择 provider、执行命令、查看输出和停止运行。
- `ai-context-attachment`: 支持从 Obsidian 当前上下文收集输入素材，并将其作为 AI 命令执行上下文。
- `ai-output-capture`: 支持将 AI 执行结果保存到 Memo、Journal 或新建笔记。

### Modified Capabilities
<!-- 无 -->

## Impact

- 受影响代码将包括主视图结构、设置模型、命令注册、进程执行层以及输出保存路径。
- 可能需要引入桌面端能力声明、provider 配置和运行状态管理。
- 不在本次范围内实现完整终端模拟、TTY 兼容交互、多会话拖拽编排或真实 shell 工作台。
