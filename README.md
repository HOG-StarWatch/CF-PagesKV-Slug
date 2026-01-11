# CloudLink - 智能短链生成服务

 ![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-orange.svg) ![KV Storage](https://img.shields.io/badge/Storage-KV-yellow.svg)

CloudLink 是一个基于 **Cloudflare Pages** 和 **KV Storage** 构建的现代化、无服务器短链接生成平台。它轻量、快速且无需自行维护服务器，支持自定义短链、密码保护、访问统计、二维码生成等丰富功能。

## ✨ 核心特性

- **🚀 极速部署**：基于 Cloudflare 边缘网络，全球访问低延迟。
- **🔗 智能短链**：支持随机生成或自定义短链后缀。
- **🔒 安全保护**：支持为链接设置访问密码。
- **⏱️ 有效期管理**：支持自定义过期时间（1天/3天/7天/30天或指定日期）。
- **🔢 访问控制**：支持设置最大访问次数，达到限制自动销毁。
- **📱 二维码生成**：生成短链的同时生成二维码，支持自定义前景色和背景色。
- **🛡️ 管理后台**：内置强大的管理面板，支持批量管理、查看点击统计。
- **🎨 现代 UI**：响应式设计，支持深色模式 (Dark Mode)，体验流畅。

## 🛠️ 技术栈

- **前端**：HTML5, CSS3 (Modern Features), Vanilla JS
- **后端**：Cloudflare Pages Functions (Serverless)
- **存储**：Cloudflare Workers KV
- **工具**：Wrangler CLI

## 🚀 快速开始

### 1. 准备工作

确保你已经安装了 [Node.js](https://nodejs.org/) 和 [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)。

```bash
npm install -g wrangler
```

### 2. 克隆项目

```bash
git clone https://github.com/HOG-StarWatch/CF-PagesKV-Slug.git
cd CF-PagesKV-Slug
npm install
```

### 3. 配置 Cloudflare KV

你需要创建一个 KV Namespace 来存储短链数据。

```bash
# 创建生产环境 KV
npx wrangler kv:namespace create LINKS

# 创建预览环境 KV (可选)
npx wrangler kv:namespace create LINKS --preview
```

执行上述命令后，会得到 `id`，请将其填入项目根目录的 `wrangler.toml` 文件中：

```toml
[[kv_namespaces]]
binding = "LINKS"
id = "你的_PRODUCTION_KV_ID"
preview_id = "你的_PREVIEW_KV_ID"
```

### 4. 配置管理员密钥

为了保护管理后台，请在 `wrangler.toml` 中设置 `ADMIN_KEY`：

```toml
[vars]
ADMIN_KEY = "你的管理员密码"
```

> ⚠️ **安全提示**：在生产环境中，建议通过 Cloudflare Dashboard 的 **Settings -> Environment Variables** 进行配置，不要将密钥直接提交到代码仓库。

### 5. 本地开发

```bash
npm run dev
```
启动后访问 `http://localhost:8788` 即可预览。

### 6. 部署上线

```bash
npm run deploy
```

## 📖 使用指南

### 生成短链
1. 访问首页。
2. 输入原始长链接。
3. 点击“⚙️ 高级设置”可配置：
   - **自定义后缀**：如 `my-link`。
   - **访问密码**：设置后访问需验证。
   - **访问次数**：如 `10` 次后失效。
   - **过期时间**：选择快捷时间（1/3/7/30天）或指定日期。
   - **二维码样式**：自定义二维码颜色。
4. 点击“立即生成”。

### 管理后台
1. 访问 `/admin.html`。
2. 输入配置的 `ADMIN_KEY` 登录。
3. 你可以：
   - 查看所有短链及其原始链接、点击数、创建时间。
   - 单个或批量删除短链。
   - 导出或搜索数据（即将推出）。

## 📚 API 文档

### 创建短链
- **Endpoint**: `/api/create`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "url": "https://example.com",
    "slug": "custom-slug",       // 可选
    "password": "123",           // 可选
    "maxClicks": 100,            // 可选
    "expirationTime": 1735689600000 // 可选 (毫秒时间戳)
  }
  ```

### 删除短链 (需鉴权)
- **Endpoint**: `/api/delete`
- **Method**: `POST`
- **Headers**: `X-Admin-Key: 你的管理员密码`
- **Body**:
  ```json
  {
    "slugs": ["slug1", "slug2"]
  }
  ```