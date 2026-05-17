## 1. Journal 数据与设置

- [x] 1.1 在 `src/types.ts` 中新增 Journal 相关类型，并扩展插件设置以支持 `journalHeading`
- [x] 1.2 在 `src/settings.ts` 中提供 Journal 标题配置和默认值
- [x] 1.3 新增 Journal 区块读写模块，支持读取、创建和覆盖保存 Daily Note 中的 Journal 标题区块

## 2. 视图与命令集成

- [x] 2.1 在 `src/view.ts` 中新增 `journal` 页签和今日日记编辑界面
- [x] 2.2 将 Journal 页签接入默认视图、头部标签和相关交互流程
- [x] 2.3 在 `src/commands.ts` 中新增打开 Journal 视图的命令，并保留打开今日笔记的快捷入口

## 3. 活跃度展示与验证

- [x] 3.1 新增按日期范围读取 Journal 的能力，用于统计当前月份的日记活跃天数和今日是否有日记
- [x] 3.2 在首页或统计视图中展示 Journal 活跃信息
- [x] 3.3 运行构建或校验，确认 Journal 功能与现有 Todo / Memo 流程兼容
