export async function onRequestGet(context) {
    const { env, request } = context;
    const url = new URL(request.url);
    const key = url.searchParams.get('key') || request.headers.get('X-Admin-Key');
    
    if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { 
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
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
                    clicks: k.metadata.clicks || 0, // 这里的 clicks 可能是 0，因为我们不再更新它
                    created: k.metadata.createdAt,
                    expiration: k.expiration
                };
            }

            // Fallback: 旧数据没有 metadata，必须读取 Value
            // 这会导致 N+1 问题，建议迁移旧数据或接受旧数据加载慢
            const val = await env.LINKS.get(k.name);
            if (val === null) return null;

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
                clicks: data?.clicks || 0,
                created: data?.createdAt,
                expiration: k.expiration
            };
        }));

        const finalDetails = details.filter(item => item !== null);

        return new Response(JSON.stringify({ 
            links: finalDetails, 
            cursor: list.cursor, 
            list_complete: list.list_complete 
        }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
            status: 500, 
            headers: { "Content-Type": "application/json" }
        });
    }
}
