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

// 生成 CSRF Token
function generateCSRFToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet(context) {
    const { env, request } = context;
    const url = new URL(request.url);
    const key = request.headers.get('X-Admin-Key');

    // 只允许从 Header 获取密钥
    if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
        return errorResponse(401, "Unauthorized: Invalid or missing Admin Key");
    }

    const cursor = url.searchParams.get('cursor');
    const limit = 100; // Cloudflare list limit is 1000

    try {
        const list = await env.LINKS.list({ limit, cursor });
        const keys = list.keys;

        // 优化：优先使用 Metadata
        const details = await Promise.all(keys.map(async (k) => {
            // 如果有 metadata，直接使用，节省一次 KV 读取
            if (k.metadata) {
                return {
                    slug: k.name,
                    url: k.metadata.url || 'Unknown',
                    created: k.metadata.createdAt,
                    expiration: k.expiration,
                    hasPassword: k.metadata.hasPassword || false
                };
            }

            // Fallback: 旧数据没有 metadata，必须读取 Value
            const val = await env.LINKS.get(k.name);
            if (val === null || val === undefined) return null;

            let data = {};
            try {
                data = JSON.parse(val);
                if (typeof data === 'string') data = { url: data };
            } catch {
                data = { url: val };
            }
            return {
                slug: k.name,
                url: data?.url || '',
                created: data?.createdAt,
                expiration: k.expiration,
                hasPassword: !!data?.password
            };
        }));

        const finalDetails = details.filter(item => item !== null);

        // 生成并返回 CSRF Token
        const csrfToken = generateCSRFToken();
        // 存储 CSRF Token 到 KV (有效期 1 小时)
        await env.LINKS.put(`csrf:${csrfToken}`, 'valid', { expirationTtl: 3600 });

        return new Response(JSON.stringify({
            links: finalDetails,
            cursor: list.cursor,
            list_complete: list.list_complete,
            csrfToken
        }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (err) {
        return errorResponse(500, err.message);
    }
}
