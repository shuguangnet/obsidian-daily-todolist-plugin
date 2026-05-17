## Context

当前插件已经提供 Today、Journal、Memo、Calendar、Gantt、Stats 等视图，并基于 Daily Note 与 Vault 分析形成日常工作流。但所有 AI 协作仍然依赖插件外部：用户需要在独立终端中运行 Claude Code、Codex 或 OpenCode，再手动把结果带回 Obsidian。为了在不引入完整终端模拟复杂度的前提下验证“Obsidian 内 AI 工作台”的方向，需要先做一个受控的 AI Command Panel。

该功能的关键约束：
- 首版仅做一次性命令执行，不承诺完整 TTY / shell 兼容。
- 必须以桌面端为前提，移动端不在范围内。
- 需要允许用户配置 provider 可执行路径、默认工作目录和基础参数。
- 执行结果需要能回写到现有 Journal、Memo 和新建笔记工作流中。
- 不在本次范围内实现复杂拖拽编排、多 session、真正终端模拟或 shell 自由执行。

## Goals / Non-Goals

**Goals:**
- 在插件内新增 AI Command Panel 视图，支持选择 provider、输入 prompt、运行和停止命令。
- 支持为命令附加 Obsidian 上下文，例如当前笔记、今日日记、今日任务。
- 支持展示标准输出 / 错误输出，并将结果保存到 Memo、Journal 或新笔记。
- 为 provider 配置建立最小但可扩展的适配层，兼容 Claude Code、Codex、OpenCode。

**Non-Goals:**
- 不实现完整终端仿真或 PTY 交互。
- 不提供任意 shell 命令执行工作台。
- 不实现拖拽式 context tray、多会话编排或高级 Agent orchestration。
- 不在本次变更中承诺移动端可用性。

## Decisions

### 1. 首版采用受控命令面板，而不采用真正终端
AI Command Panel 只暴露受控输入：provider、prompt、上下文来源与运行按钮。执行层以预定义 provider adapter 方式调用本地 CLI，输出以日志面板展示。

备选方案：
- 真终端模拟：交互能力更强，但 PTY、焦点、快捷键、滚动与兼容性成本太高。
- 外部终端桥接：实现更稳，但无法提供“在 Obsidian 内完成”的核心体验。

### 2. Provider 适配层独立于 UI
执行层将抽象为 provider adapter，每个 provider 负责：可执行路径、参数模板、工作目录、环境变量、输出处理与可停止执行。UI 不直接拼接命令细节。

备选方案：
- 在视图层直接拼接 `child_process` 调用：实现快，但难以扩展多个 provider，也不利于后续增加运行状态控制。

### 3. 上下文注入采用显式选择，而非自动全量塞入
用户需要明确勾选附加来源，例如“当前笔记”“今日日记”“今日任务”。系统负责把这些来源整理成结构化文本，附加到 prompt 或输入载荷中。

备选方案：
- 自动附加所有上下文：实现简单，但容易造成 prompt 过长、内容污染和意外泄露。

### 4. 输出回写先聚焦三个目标
首版仅支持：
- 保存为 Memo
- 追加到 Journal
- 创建新笔记

这三种回写目标已经与现有插件能力天然衔接，可验证 AI 工作结果在知识库中的沉淀路径。

### 5. 桌面端能力显式声明
由于该功能依赖本地 CLI 和进程执行，插件应在产品设计上转向桌面端优先，必要时通过 manifest 声明为 desktop-only。

## Risks / Trade-offs

- [不同用户机器上的 provider 安装路径不一致] → 通过设置页提供可执行路径与测试连接入口。
- [CLI 输出可能是流式、很长或包含错误信息] → 日志面板支持滚动输出，并明确区分 stdout / stderr。
- [受控命令面板不能覆盖交互式 TUI 场景] → 在 proposal 中明确首版边界，只验证一次性调用工作流。
- [将 AI 输出回写到 Vault 可能引入噪音内容] → 保存动作显式由用户触发，不自动写入笔记。
- [桌面端专用能力会缩小插件适用范围] → 用 AI Workspace 作为高级功能模块，不影响原有 Daily Note 核心体验。
