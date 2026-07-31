# 学习进度备份与 180 天自动清理

3DCV 首先把学习进度保存在浏览器 `localStorage`，用户使用 Google 登录后，才会把同一份
进度同步到 Firestore 的 `users/{uid}`。180 天策略只删除这个云端进度文档，不删除
Firebase Authentication 中的 Google 登录账户。

## 用户看到的行为

- 每次成功登录或云同步都会用 Firestore 服务器时间更新 `lastActiveAt`。
- 连续 180 天没有成功登录或同步后，云端进度和笔记才会进入删除范围。
- Review 页可随时下载 JSON 备份；文件包含 reviewed、wrong book、notes、SRS 和 activity。
- 导入支持新的带版本备份，也兼容本站以前直接导出的未版本化 JSON 文件。
- 旧的云文档必须先迁移并获得新的 180 天宽限期，不能直接删除。

## 免费的定时清理任务

`.github/workflows/cleanup-progress.yml` 每月 1 日运行一次
`tools/cleanup-stale-progress.mjs`。脚本通过 Firestore REST API 工作，不需要额外 npm
依赖，并把单次扫描和修改数量限制在 10,000 以内。

定时任务读取 GitHub repository variable `PROGRESS_CLEANUP_DRY_RUN`：

- `true`：只输出候选数量，不改动 Firestore。
- `false`：删除 `lastActiveAt` 早于 180 天截止时间的 `users/{uid}` 文档。

手动运行工作流时仍默认 `dry_run=true`。脚本在真实写入或删除前还要求
`CLEANUP_CONFIRM_PROJECT` 与 `FIREBASE_PROJECT_ID` 完全相同，避免误操作其他项目。
它从不调用 Firebase Authentication API。

工作流也会在独立的 `maintenance-heartbeat` 分支记录每月活动，避免长期没有代码提交时
GitHub 自动停用 public repository 的 schedule；不会污染 `main` 的提交历史。

## 一次性的 GitHub 与 Google Cloud 配置

不要把 service-account JSON key 存进仓库或 GitHub。使用 Google Workload Identity
Federation 生成短期 access token：

1. 在 Google Cloud 项目 `dcv-exam-qa` 创建一个只供清理任务使用的 service account。
2. 给它 Firestore 读取、更新、删除权限。内置角色可选 Cloud Datastore User
   (`roles/datastore.user`)；如果已有最小权限自定义角色，优先使用自定义角色。
3. 启用 IAM Service Account Credentials API。
4. 创建 Workload Identity Pool 和 GitHub OIDC provider，只允许仓库
   `c0nsTantin77/3dcv-exam-qa` 的默认分支使用。
5. 给该 GitHub external principal 在清理 service account 上授予 Workload Identity User
   (`roles/iam.workloadIdentityUser`)。
6. 在 GitHub 仓库 Settings → Secrets and variables → Actions → Variables 添加：
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`：provider 的完整 resource name。
   - `GCP_SERVICE_ACCOUNT`：service account 邮箱。
   - `PROGRESS_CLEANUP_DRY_RUN`：开始时必须填 `true`。

这三个值都使用 repository **Variables**；不需要长期密钥或 Firebase secret。

## 安全启用顺序

1. 先部署客户端，让活跃用户的文档开始写入 `lastActiveAt`。
2. 在 GitHub Actions 手动运行 **Clean up inactive progress**，选择
   `mode=migrate`、`dry_run=true`，检查 `legacyCandidates`。
3. 再以 `mode=migrate`、`dry_run=false` 运行一次。所有旧文档会获得新的服务器时间，
   从此重新计算完整的 180 天宽限期。
4. 以 `mode=cleanup`、`dry_run=true` 运行，确认 `expiredCandidates` 为 0 或符合预期。
5. 只有上述结果正确后，才把 `PROGRESS_CLEANUP_DRY_RUN` 改成 `false`，开启每月真实删除。

如果迁移输出 `changeLimitReached=true`，继续重复迁移，直到
`legacyCandidates` 为 0。不要跳过迁移直接启用删除。

## 本地 dry-run

本地运行需要由 Google Cloud CLI 生成的短期 OAuth access token。在 PowerShell 中：

```powershell
$env:FIREBASE_PROJECT_ID = "dcv-exam-qa"
$env:FIRESTORE_ACCESS_TOKEN = gcloud auth print-access-token
$env:CLEANUP_MODE = "cleanup"
$env:CLEANUP_DRY_RUN = "true"
node tools/cleanup-stale-progress.mjs
```

任何非 dry-run 操作还必须设置：

```powershell
$env:CLEANUP_CONFIRM_PROJECT = "dcv-exam-qa"
```

完成后可关闭当前终端，避免继续复用临时环境变量。
