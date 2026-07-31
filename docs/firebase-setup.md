# 3DCV 网站 Firebase 配置

本网站必须使用一个新的、独立的 Firebase 项目。不要使用 I2DL 的
`i2dl-c79f8`：两个网站的登录账户、学习进度、在线连接和用量应该完全隔离。

网站采用 localStorage-first 设计：所有访客都能在浏览器本地使用学习功能，只有
主动 Google 登录的人才会在 Firestore 创建 `users/{uid}` 进度文档。绿色在线人数
来自 Realtime Database `/presence`，不代表登录账户数，也不代表 Firestore 用户数。

## 1. 新建独立 Firebase 项目和 Web App

1. 打开 [Firebase Console](https://console.firebase.google.com/)，点击“创建项目”。
2. 本站使用项目名和项目 ID `dcv-exam-qa`。
3. 项目创建完成后，点击 Web 图标 `</>` 注册 Web App。
4. Hosting 不需要启用，网站继续由 GitHub Pages 托管。
5. 复制控制台给出的 `firebaseConfig`。

把其中的值填入 `src/lib/config.ts`：

```ts
firebase: {
  apiKey: "...",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "...",
  appId: "...",
  databaseURL: "https://YOUR_DATABASE.REGION.firebasedatabase.app",
},
```

Web 配置用于标识 Firebase 项目，不是服务账号私钥。绝对不要提交服务账号 JSON、
私钥或 Google Cloud access token。

## 2. 配置 Google Authentication

1. Firebase Console → Authentication → Get started。
2. Sign-in method → Google → Enable，选择支持邮箱并保存。
3. Authentication → Settings → Authorized domains，添加：
   `c0nstantin77.github.io`。
4. 本地调试需要 `localhost`；如果列表中没有，请手动添加。

## 3. 配置 Firestore 学习进度

1. Firebase Console → Firestore Database → Create database。
2. 选择离主要用户较近的欧洲区域；创建后区域不能修改。
3. 可从 Production/Locked 模式开始。
4. 发布仓库内 `firestore.rules`。它只允许登录用户读写自己的
   `users/{uid}` 文档，并要求 `lastActiveAt` 使用服务器时间。

`lastActiveAt` 和 `retentionPolicyVersion` 参考 I2DL 的保留策略设计，方便将来对
长期不活跃的云进度做 180 天清理。当前仓库不会自动删除任何文档；启用清理任务前
必须先做 dry-run 和旧文档迁移，不能把“进度文档数量”称为“网站用户数”。

## 4. 配置 Realtime Database 在线人数

1. Firebase Console → Realtime Database → Create database。
2. 选择欧洲区域并完成创建。
3. 回到项目设置中的 Web App，重新复制配置；创建 RTDB 后配置会多出正确的
   `databaseURL`，把它填入 `src/lib/config.ts`。
4. 发布仓库内 `database.rules.json`。

在线逻辑为：每个打开的标签页写入一个随机连接节点；服务器端
`onDisconnect()` 在断线时删除；页面每 60 秒更新服务器时间，并只统计最近 5 分钟
仍有心跳的节点。这样即使某次断线清理失败，旧记录也不会长期抬高在线人数。

这里统计的是“活跃页面连接数”：同一个人打开两个标签页会算两个连接。

## 5. 使用 Firebase CLI 发布规则

安装 CLI 后，在仓库根目录运行：

```bash
npm install -g firebase-tools
firebase login
firebase use --add YOUR_PROJECT_ID
firebase deploy --only firestore:rules,database
```

`firebase use --add` 会生成 `.firebaserc`。发布前检查其中的项目 ID，确认它不是
`i2dl-c79f8`。

也可以分别在 Firebase Console 的 Firestore Rules 和 Realtime Database Rules
页面粘贴对应规则并点击 Publish。

## 6. 本地与线上验证

```bash
npm run check
npm run build
npm run dev
```

打开 `http://localhost:4321/3dcv-exam-qa/`：

1. 页面最上方应显示绿色“only one”横幅。
2. 再开一个无痕窗口，两个窗口都应显示“1 other person”。
3. 关闭无痕窗口后，人数应下降；异常断线最多约 5 分钟后不再计数。
4. Google 登录后，在 Firestore Data 中应出现且只出现当前 UID 的
   `users/{uid}` 文档。

最后推送到 `main`，GitHub Actions 会重新部署 GitHub Pages。

## 7. 用量和安全建议

- Realtime Database 只公开无个人信息的 `/presence`；其他路径默认拒绝访问。
- Firestore 不允许匿名访客读写进度。
- 在线人数、Firebase Authentication 账户、Firestore 进度文档和 GA4 访客是四个
  不同指标，不能相加或互相替代。
- 如果公开流量明显增加，再配置 Firebase App Check；先在未强制模式验证请求，
  确认正常后再开启 enforcement，避免把真实访客一起拦截。
