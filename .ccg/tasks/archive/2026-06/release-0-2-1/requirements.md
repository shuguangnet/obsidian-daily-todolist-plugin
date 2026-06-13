# 发布 0.2.1

## 需求

- 发布插件版本 `0.2.1`。
- 添加中文说明，解释日历中为历史日期添加每日待办的使用方式。

## 实现范围

- 更新 `package.json`、`package-lock.json`、`manifest.json`、`versions.json`。
- 更新 `README.md` 中文说明。
- 构建验证通过后提交、打 tag 并推送到 GitHub。

## 环境限制

- `.ccg/spec/` 不存在。
- `~/.claude/bin/codeagent-wrapper` 不存在，无法执行 AGENTS.md 要求的 Gemini + Claude 外部模型分析/审查。
