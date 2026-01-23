// 密码哈希工具函数 - 使用 SHA-256
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 统一错误响应
function errorResponse(status, message) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Content-Security-Policy": "default-src 'none'; base-uri 'none'"
        }
    });
}

// 速率限制检查
async function checkRateLimit(env, clientIP) {
    const rateLimitKey = `ratelimit:${clientIP}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 分钟窗口
    const maxRequests = 10; // 每分钟最多 10 次请求

    const currentData = await env.LINKS.get(rateLimitKey);

    if (!currentData) {
        // 第一次请求
        await env.LINKS.put(rateLimitKey, JSON.stringify({ count: 1, resetAt: now + windowMs }), { expirationTtl: 60 });
        return true;
    }

    let data;
    try {
        data = JSON.parse(currentData);
    } catch {
        data = { count: 0, resetAt: now + windowMs };
    }

    if (data.resetAt < now) {
        // 窗口已过期，重置计数
        await env.LINKS.put(rateLimitKey, JSON.stringify({ count: 1, resetAt: now + windowMs }), { expirationTtl: 60 });
        return true;
    }

    if (data.count >= maxRequests) {
        return false;
    }

    // 增加计数
    data.count++;
    await env.LINKS.put(rateLimitKey, JSON.stringify(data), { expirationTtl: 60 });
    return true;
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    // 速率限制检查
    // 优先从 CF-Connecting-IP 获取 IP（Cloudflare 专用），其次使用 CF-Pseudo-IPv4 或 CF-Ray
    const clientIP = request.headers.get('CF-Connecting-IP') ||
                       request.headers.get('CF-Pseudo-IPv4') ||
                       request.headers.get('CF-Ray')?.split('-')[0] ||
                       'unknown';

    // 公开服务模式下（无 ADMIN_KEY）才启用速率限制
    if (!env.ADMIN_KEY && !await checkRateLimit(env, clientIP)) {
      return errorResponse(429, "Too many requests. Please try again later.");
    }

    if (!env.LINKS) {
      return errorResponse(500, "KV binding 'LINKS' not found.");
    }

    const body = await request.json();
    const { url, slug: customSlug, password, expirationTime, key: bodyKey } = body;

    // --- 私有化鉴权 ---
    // 只允许从 Header 获取密钥，禁止 URL 参数传递（避免日志泄露）
    if (env.ADMIN_KEY) {
        const providedKey = request.headers.get('X-Admin-Key') || bodyKey;
        if (!providedKey || providedKey !== env.ADMIN_KEY) {
            return errorResponse(401, "Unauthorized: Invalid or missing Admin Key");
        }
    }
    // -----------------

    if (!url) {
      return errorResponse(400, "Missing 'url' field");
    }

    try {
      const parsedUrl = new URL(url);
      const currentOrigin = new URL(request.url).origin;

      // 检查 URL 协议是否为 http 或 https
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return errorResponse(400, "URL must use HTTP or HTTPS protocol");
      }

      if (parsedUrl.origin === currentOrigin) {
        return errorResponse(400, "Cannot shorten a URL from the same domain (recursive loop risk)");
      }
    } catch (e) {
      return errorResponse(400, "Invalid URL format");
    }

    // 生成或验证 Slug
    let slug = customSlug ? customSlug.trim() : null;

    // 保留关键词列表，禁止注册
    const RESERVED_SLUGS = [
        'api', 'admin', 'admin.html', 'index', 'index.html', 'favicon.ico', 'robots.txt', 'assets'
    ];

    if (slug) {
        // 安全检查：Slug 只能包含字母、数字、下划线和连字符，且长度限制
        if (slug.length > 64) {
            return errorResponse(400, "Slug must be 64 characters or less");
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
            return errorResponse(400, "Slug can only contain letters, numbers, underscores and hyphens");
        }

        if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
            return errorResponse(400, "This slug is reserved for system use");
        }

        // 检查自定义 Slug 是否已存在
        const existing = await env.LINKS.get(slug);
        if (existing) {
            return errorResponse(409, "Custom slug is already taken");
        }
    } else {
        // 生成随机 Slug - 使用加密安全的随机数生成器
        const generateSecureSlug = (length = 6) => {
            const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            const randomValues = new Uint32Array(length);
            crypto.getRandomValues(randomValues);
            let result = '';
            for (let i = 0; i < length; i++) {
                result += chars[randomValues[i] % chars.length];
            }
            return result;
        };

        slug = generateSecureSlug();
        let retries = 5;
        while (retries > 0) {
            const existing = await env.LINKS.get(slug);
            if (!existing) break;
            slug = generateSecureSlug();
            retries--;
        }

        if (retries === 0) {
            return errorResponse(503, "Failed to generate unique slug");
        }
    }

    // 哈希密码（如果设置了密码）
    const hashedPassword = password ? await hashPassword(password) : null;

    // 构建存储对象
    const data = {
        url,
        slug,
        password: hashedPassword,
        createdAt: Date.now(),
        expiresAt: expirationTime || null
    };

    // 写入 KV
    // 使用 metadata 优化列表查询性能
    // 将关键信息写入 metadata，list 接口就无需读取 value
    const metadata = {
        url: url,
        createdAt: data.createdAt,
        hasPassword: !!hashedPassword
    };

    const options = {
        metadata: metadata
    };
    
    if (expirationTime) {
        options.expiration = Math.floor(expirationTime / 1000);
    }

    await env.LINKS.put(slug, JSON.stringify(data), options);

    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return errorResponse(500, err.message);
  }
}
