# CloudLink - 智能短链生成服务

![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-orange.svg) ![KV Storage](https://img.shields.io/badge/Storage-KV-yellow.svg)

CloudLink 是一个基于 **Cloudflare Pages** 和 **KV Storage** 构建的现代化、无服务器短链接生成平台。它轻量、快速且无需自行维护服务器，支持自定义短链、密码保护、访问统计、二维码生成等丰富功能。

## ✨ 核心特性

- **🚀 极速部署**：基于 Cloudflare 边缘网络，全球访问低延迟。
- **🔗 智能短链**：支持随机生成或自定义短链后缀（仅限字母、数字、下划线、连字符，最多 64 字符）。
- **🔒 安全保护**：支持为链接设置访问密码（SHA-256 哈希存储）；管理后台防 XSS 攻击；API 接口鉴权。
- **🛡️ 管理鉴权**：敏感操作全部依赖管理员密钥验证，防止未授权访问。
- **⏱️ 有效期管理**：支持自定义过期时间（1天/3天/7天/30天或指定日期）。
- **🚦 速率限制**：公开服务模式下每个 IP 每分钟最多 10 次请求（可配置）。
- **📱 二维码生成**：生成短链的同时生成二维码，支持自定义前景色和背景色。
- **🛡️ 管理后台**：内置强大的管理面板，支持批量管理、查看链接状态。
- **🎨 现代 UI**：响应式设计，支持深色模式 (Dark Mode)，体验流畅。

## 🔒 安全特性

- **密码哈希**：使用 SHA-256 哈希存储访问密码，数据库中不存储明文
- **鉴权安全**：仅允许通过 HTTP Header 传递管理员密钥，避免 URL 参数泄露
- **管理密钥校验**：所有管理操作需携带管理员密钥 Header
- **CSP 响应头**：Content-Security-Policy 防止 XSS 攻击
- **URL 验证**：仅允许 http/https 协议，防止恶意 URL
- **递归防护**：禁止短链指向同域名的 URL
- **Slug 验证**：严格验证格式，禁止保留关键词
- **过期验证**：自动检查并拒绝访问已过期的短链

## 🛠️ 技术栈

- **前端**：HTML5, CSS3 (Modern Features), Vanilla JavaScript
- **后端**：Cloudflare Pages Functions (Serverless)
- **存储**：Cloudflare Workers KV
- **工具**：Wrangler CLI

## 🚀 部署指南 (推荐)

最简单的方式是通过 **Cloudflare Pages** 直接连接你的 Git 仓库进行部署。

### 1. 准备仓库
Fork 本仓库或将其上传到你的 GitHub/GitLab 账户。

### 2. 创建 Cloudflare Pages 项目
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 进入 **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**。
3. 选择你的仓库，点击 **Begin setup**。

### 3. 配置构建设置
- **Project name**: 自定义你的项目名称（如 `my-slug`）。
- **Production branch**: `main` (或 master)。
- **Framework preset**: `None` (或者选 Cloudflare Pages)。
- **Build command**: `npm install` (可选，如果不需要构建过程可留空)
- **Build output directory**: `public`。

### 4. 配置环境变量与 KV (关键步骤)
在部署完成前或完成后，进入项目的 **Settings** 页面进行配置：

#### A. 环境变量 (Environment variables)
进入 **Settings** -> **Environment variables**，添加变量：
- **Variable name**: `ADMIN_KEY`
- **Value**: 设置一个强密码（用于管理后台登录和 API 鉴权）
- **说明**: 留空则开启公开模式，任何人都可以创建短链

#### B. KV 命名空间绑定 (KV Namespace bindings)
进入 **Settings** -> **Functions** -> **KV Namespace bindings**，点击 **Add binding**：
- **Variable name**: `LINKS` (必须大写，完全一致)
- **KV Namespace**: 选择一个现有的 KV 空间，或者点击 "Create new KV namespace" 创建一个新的（如 `slug-db`）。

### 5. 完成部署
保存所有设置后，前往 **Deployments** 选项卡，点击 **Create deployment** (或 Retry deployment) 触发重新构建。部署完成后即可访问。

## 💻 本地开发

如果你想在本地运行和调试：

### 1. 安装依赖
```bash
npm install
```

### 2. 创建本地 KV 命名空间
```bash
npx wrangler kv:namespace create LINKS
# 记录下输出的 ID，但在本地开发时主要使用 .dev.vars 或本地模拟
```

### 3. 配置本地环境
在项目根目录创建 `.dev.vars` 文件（不要提交到 Git）：
```env
ADMIN_KEY=your_local_secret_password
```
参考 `.dev.vars.example` 文件了解更多配置选项。

### 4. 启动开发服务器
```bash
npm run dev
```
访问 `http://localhost:8788`。

## 📖 使用指南

### 生成短链
1. 访问首页。
2. 输入原始长链接。
3. 点击"⚙️ 高级设置"可配置：
   - **自定义后缀**：如 `my-link`。
   - **访问密码**：设置后访问需验证。
   - **过期时间**：选择快捷时间（1/3/7/30天）或指定日期。
   - **二维码样式**：自定义前景色和背景色。
4. 点击"立即生成"。

### 管理后台
访问 `/admin.html`，输入你在环境变量中设置的 `ADMIN_KEY` 即可登录后台。
- 查看所有短链列表。
- 查看每个短链的状态（公开/密码保护/已过期）。
- 删除或批量删除短链。

### API 调用

如果你想通过 API 创建短链，需要携带鉴权 Header：
- **Header**: `X-Admin-Key: 你的ADMIN_KEY`
- **公开模式**：如果未设置 `ADMIN_KEY`，则无需鉴权，但受速率限制（10 次/分钟）

## 🔄 升级说明

### 从旧版本升级

如果你是从旧版本升级，请注意：
- 旧数据（纯字符串 URL）会自动兼容
- 密码从明文存储迁移到 SHA-256 哈希存储（旧密码需重新设置）
- 点击计数功能已移除以提高性能

## 📄 许可证
MIT License

## 🤝 贡献
欢迎提交 Issue 和 Pull Request！
