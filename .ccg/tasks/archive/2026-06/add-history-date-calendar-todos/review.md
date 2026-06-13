# Review

## External Review

- Gemini / Claude 双模型审查未执行：当前环境缺少 `~/.claude/bin/codeagent-wrapper`。
- 已用本地 diff 审查与构建验证替代。

## Critical

- 无。

## Warning

- `npm audit --audit-level=high` 报告现有 dev 依赖 `esbuild <=0.28.0` 高危；`npm audit --omit=dev --audit-level=high` 为 0。修复需要 `npm audit fix --force` 并升级到 `esbuild@0.28.1`，属于本次需求之外的构建依赖升级，未处理。

## Info

- `npm run build` 通过。
- 日历页选中日期会展示待办捕捉表单，提交时写入对应日期 Daily Note。
- 不存在的历史 Daily Note 会复用现有 `autoCreateDailyNote` 开关决定是否创建。
- 今日页仍通过同一表单默认写入今日 Daily Note。
