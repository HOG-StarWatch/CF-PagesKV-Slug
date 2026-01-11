export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    
    if (!env.LINKS) {
      return new Response(JSON.stringify({ error: "KV binding 'LINKS' not found." }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await request.json();
    const { url, slug: customSlug, password, expirationTime, maxClicks } = body;
    
    if (!url) {
      return new Response(JSON.stringify({ error: "Missing 'url' field" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    try {
      const parsedUrl = new URL(url);
      const currentOrigin = new URL(request.url).origin;
      if (parsedUrl.origin === currentOrigin) {
        return new Response(JSON.stringify({ error: "Cannot shorten a URL from the same domain (recursive loop risk)" }), { 
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid URL format" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 生成或验证 Slug
    let slug = customSlug ? customSlug.trim() : null;

    // 保留关键词列表，禁止注册
    const RESERVED_SLUGS = [
        'api', 'admin', 'admin.html', 'index', 'index.html', 'favicon.ico', 'robots.txt', 'assets'
    ];

    if (slug) {
        if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
            return new Response(JSON.stringify({ error: "此短链为系统保留，不可使用" }), { 
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        // 检查自定义 Slug 是否已存在
        const existing = await env.LINKS.get(slug);
        if (existing) {
            return new Response(JSON.stringify({ error: "自定义短链已被占用" }), { 
                status: 409,
                headers: { "Content-Type": "application/json" }
            });
        }
    } else {
        // 生成随机 Slug
        const generateSlug = (length = 6) => {
            const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = '';
            for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        };

        slug = generateSlug();
        let retries = 5;
        while (retries > 0) {
            const existing = await env.LINKS.get(slug);
            if (!existing) break;
            slug = generateSlug();
            retries--;
        }

        if (retries === 0) {
            return new Response(JSON.stringify({ error: "Failed to generate unique slug" }), { 
                status: 503,
                headers: { "Content-Type": "application/json" }
            });
        }
    }

    // 构建存储对象
    const data = {
        url,
        password: password || null,
        maxClicks: maxClicks ? parseInt(maxClicks) : null,
        clicks: 0,
        createdAt: Date.now()
    };

    const options = {};
    
    // 处理过期时间 (expirationTime 应为 Unix Timestamp 秒，或者过期分钟数？通常前端传具体时间戳或相对时间)
    // 这里假设前端传的是 "2024-12-31T23:59" 格式的字符串或者分钟数，为了通用，我们假设前端传的是 *过期时间的时间戳(毫秒)* 或者 *null*
    if (expirationTime) {
        // Cloudflare KV expiration takes seconds
        const expireAtSeconds = Math.floor(new Date(expirationTime).getTime() / 1000);
        // KV 要求过期时间至少在 60 秒以后
        if (expireAtSeconds > Math.floor(Date.now() / 1000) + 60) {
             options.expiration = expireAtSeconds;
             data.expiresAt = expireAtSeconds * 1000;
        }
    }

    await env.LINKS.put(slug, JSON.stringify(data), options);

    return new Response(JSON.stringify({ slug, url }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
    });
  }
}
