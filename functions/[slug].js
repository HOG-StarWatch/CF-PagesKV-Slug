// 密码哈希工具函数 - 使用 SHA-256
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet(context) {
    return handleRequest(context);
}

export async function onRequestPost(context) {
    return handleRequest(context);
}

async function handleRequest(context) {
    const { params, env, request } = context;
    const slug = params.slug;

    if (!env.LINKS) {
        return new Response("KV binding 'LINKS' not configured", { status: 500 });
    }

    const value = await env.LINKS.get(slug);

    if (!value) {
        // 短链不存在，尝试加载静态资源
        const asset = await context.next();
        if (asset.status === 404) {
             return new Response("Short URL not found", { status: 404 });
        }
        return asset;
    }

    let data;
    try {
        data = JSON.parse(value);
        // 兼容旧数据格式（纯字符串 URL）
        if (typeof data === 'string') {
            data = { url: data, clicks: 0, createdAt: Date.now() };
        }
    } catch (e) {
        // 如果解析失败，假定是旧格式
        data = { url: value, clicks: 0, createdAt: Date.now() };
    }

    // 检查链接是否过期
    if (data.expiresAt) {
        const expirationTime = data.expiresAt;
        const currentTime = Date.now();

        // expirationAt 是毫秒时间戳，比较
        if (currentTime > expirationTime) {
            return new Response("This short URL has expired", { status: 410 });
        }
    }

    // 检查密码（使用 SHA-256 哈希验证）
    if (data.password) {
        let providedPassword = null;

        if (request.method === 'POST') {
            const formData = await request.formData();
            providedPassword = formData.get('password');
        }

        // 哈希用户提供的密码并与存储的哈希比较
        if (providedPassword) {
            const hashedPassword = await hashPassword(providedPassword);
            if (hashedPassword !== data.password) {
                // 返回输入密码页面
                const errorMsg = '<p style="color: #ff4d4f;">密码错误，请重试</p>';
                return new Response(renderPasswordPage(slug, errorMsg), {
                    headers: {
                        "Content-Type": "text/html;charset=UTF-8",
                        "Content-Security-Policy": "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: https:; connect-src 'self'"
                    }
                });
            }
        } else {
            // 未提供密码，显示密码输入页面
            return new Response(renderPasswordPage(slug, ''), {
                headers: {
                    "Content-Type": "text/html;charset=UTF-8",
                    "Content-Security-Policy": "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: https:; connect-src 'self'"
                }
            });
        }
    }

    return Response.redirect(data.url, 302);
}

function renderPasswordPage(slug, errorMsg) {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>请输入访问密码</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔒</text></svg>">
    <style>
        :root {
            --primary: #4f46e5;
            --primary-hover: #4338ca;
            --bg-gradient: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            --card-bg: rgba(255, 255, 255, 0.95);
            --text-main: #1f2937;
            --text-sub: #6b7280;
            --border: #e5e7eb;
            --shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        }

        @media (prefers-color-scheme: dark) {
            :root {
                --primary: #6366f1;
                --primary-hover: #818cf8;
                --bg-gradient: linear-gradient(135deg, #111827 0%, #1f2937 100%);
                --card-bg: rgba(31, 41, 55, 0.95);
                --text-main: #f9fafb;
                --text-sub: #9ca3af;
                --border: #374151;
                --shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
            }
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: var(--bg-gradient);
            color: var(--text-main);
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
        }
        
        .container {
            background: var(--card-bg);
            padding: 2.5rem;
            border-radius: 16px;
            box-shadow: var(--shadow);
            width: 100%;
            max-width: 400px;
            text-align: center;
            backdrop-filter: blur(10px);
            border: 1px solid var(--border);
        }

        h1 {
            margin-top: 0;
            color: var(--text-main);
            font-size: 1.5rem;
        }
        
        p {
            color: var(--text-sub);
            margin-bottom: 1.5rem;
        }

        input {
            width: 100%;
            padding: 0.75rem 1rem;
            margin-bottom: 1rem;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--card-bg);
            color: var(--text-main);
            font-size: 1rem;
            box-sizing: border-box;
        }

        input:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }

        button {
            width: 100%;
            padding: 0.75rem;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            cursor: pointer;
            transition: background 0.2s;
            font-weight: 500;
        }

        button:hover {
            background: var(--primary-hover);
        }
        
        .error-msg {
            color: #ef4444;
            background: rgba(239, 68, 68, 0.1);
            padding: 0.75rem;
            border-radius: 8px;
            margin-bottom: 1rem;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div style="font-size: 3rem; margin-bottom: 1rem;">🔒</div>
        <h1>访问受限</h1>
        <p>此链接受密码保护，请输入密码继续。</p>
        ${errorMsg ? `<div class="error-msg">⚠️ 密码错误，请重试</div>` : ''}
        <form method="POST">
            <input type="password" name="password" placeholder="请输入访问密码" required autofocus>
            <button type="submit">验证并访问</button>
        </form>
    </div>
</body>
</html>
    `;
}
