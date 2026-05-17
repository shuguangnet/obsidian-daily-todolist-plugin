## Why

当前插件的大部分价值已经不再局限于右侧窄栏：首页统计、甘特图、Journal 和 AI Command Panel 在宽屏空间下会明显更好用。为了让 Vault Atlas HQ 真正成为工作台，而不是只能挤在侧边栏里的工具，需要补齐一个宽工作区模式，使插件能在主区域获得更大的展示与交互空间。

## What Changes

- 新增宽工作区模式，使 Vault Atlas HQ 可以在主编辑区或更宽的叶子中打开，而不是只依赖右侧窄栏。
- 为宽工作区模式提供专门的布局适配，让 Home、Stats、Gantt、AI Command Panel 等页面在大宽度下重排信息。
- 增加用户可感知的进入方式，例如命令入口或显式的宽屏打开动作。
- 为不同内容密度的页面增加响应式展示规则，避免直接把侧栏样式简单拉伸。
- 保持现有侧栏模式可继续使用，不以宽工作区模式替代原有窄栏入口。

## Capabilities

### New Capabilities
- `wide-workspace-mode`: 允许用户以宽工作区方式打开 Vault Atlas HQ，并在更大可视空间中使用插件。
- `responsive-dashboard-layout`: 为 Home、Stats、Gantt、AI Command Panel 等页面提供宽屏布局适配能力。

### Modified Capabilities
<!-- 无 -->

## Impact

- 受影响代码主要包括主视图打开逻辑、页签布局、样式系统和命令入口。
- 可能需要扩展 `activateView` 的打开策略，并在 `styles.css` 中增加宽屏断点与大布局规则。
- 不在本次范围内实现真正浏览器式全屏、自动隐藏 Obsidian 其他面板或演示模式。
