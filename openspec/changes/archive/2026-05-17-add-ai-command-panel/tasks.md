## 1. Provider 与桌面端基础能力

- [x] 1.1 扩展插件设置，支持声明桌面端 AI provider 配置（如 Claude Code、Codex、OpenCode 的可执行路径与基础参数）
- [x] 1.2 调整插件能力声明与初始化逻辑，使 AI Command Panel 仅在桌面端环境启用
- [x] 1.3 建立 provider adapter 与运行状态模型，为受控命令执行提供统一接口

## 2. AI Command Panel 视图

- [x] 2.1 在主视图中新增 AI Command Panel 页签与基础布局（provider 选择、prompt 输入、运行/停止、输出区）
- [x] 2.2 实现命令执行与输出展示，区分运行中、成功、失败、已停止等状态
- [x] 2.3 增加打开 AI Command Panel 的命令入口与必要的视图切换流程

## 3. 上下文附加与输出回写

- [x] 3.1 实现可选上下文来源收集，至少支持当前笔记、今日日记、今日任务
- [x] 3.2 将所选上下文注入 provider 执行载荷，保持显式选择而非自动全量注入
- [x] 3.3 为 AI 输出提供保存到 Memo、追加到 Journal、创建新笔记的显式操作

## 4. 验证与文档

- [x] 4.1 运行构建与基础校验，确认桌面端 AI 面板不破坏现有 Daily / Journal / Memo 工作流
- [x] 4.2 更新 README 或使用说明，补充 AI Command Panel 的桌面端前提、provider 配置和结果保存方式
