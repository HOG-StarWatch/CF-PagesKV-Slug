export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    
    // --- 私有化配置开始 ---
    // 如果设置了 ADMIN_KEY，则开启私有化模式，创建链接需要鉴权
    // 若要取消私有化（公开服务），请在 Cloudflare 后台删除 ADMIN_KEY 环境变量，或将其注释掉
    if (env.ADMIN_KEY) {
        const authHeader = request.headers.get('X-Admin-Key');
        const urlKey = new URL(request.url).searchParams.get('key');
        
        // 我们也允许从 JSON body 中读取 key，但这需要先解析 body
        // 为了方便，我们先假设 body 还没读取，稍后读取时再检查（或者这里先不检查 body 里的 key）
        // 这里主要检查 header 和 url query
        
        // 注意：前端可能把 key 放在 body 里，所以我们稍后解析 body 时再做一次最终检查
        // 但如果 key 必须在 header/query 里，可以在这里拦截
        
        // 策略：我们允许 Header, Query, 或 Body 中的 key。
        // 由于 body 只能读一次，我们留到后面统一检查。
    }
    // --- 私有化配置结束 ---

    if (!env.LINKS) {
      return new Response(JSON.stringify({ error: "KV binding 'LINKS' not found." }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await request.json();
    const { url, slug: customSlug, password, expirationTime, key: bodyKey } = body;

    // --- 私有化鉴权 ---
    if (env.ADMIN_KEY) {
        const providedKey = request.headers.get('X-Admin-Key') || new URL(request.url).searchParams.get('key') || bodyKey;
        if (providedKey !== env.ADMIN_KEY) {
            return new Response(JSON.stringify({ error: "Unauthorized: Private instance. Please provide correct Admin Key." }), { 
                status: 401,
                headers: { "Content-Type": "application/json" }
            });
        }
    }
    // -----------------
    
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
        // 安全检查：Slug 只能包含字母、数字、下划线和连字符
        if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
            return new Response(JSON.stringify({ error: "自定义短链只能包含字母、数字、下划线和连字符" }), { 
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

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
        slug,
        password,
        createdAt: Date.now(),
        expiresAt: expirationTime || null
    };

    // 写入 KV
    // 使用 metadata 优化列表查询性能
    // 将关键信息写入 metadata，list 接口就无需读取 value
    const metadata = {
        url: url,
        createdAt: data.createdAt,
        clicks: 0 // 虽然我们移除了计数功能，但为了兼容旧结构或未来扩展，可以留个字段
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
    return new Response(JSON.stringify({ error: err.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
    });
  }
}
