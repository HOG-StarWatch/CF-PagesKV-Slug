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
        
        // Fetch details for each key (parallel)
        // Note: For large datasets this might be slow, but for a simple panel it's fine.
        // We only fetch metadata if we stored it in metadata, but we stored it in the value.
        // Reading all values is expensive.
        // Optimization: create.js should ideally store metadata (url, clicks, etc.) in KV metadata field.
        // But the current implementation stores everything in the value.
        // So we MUST read the value to get the URL.
        
        const details = (await Promise.all(keys.map(async (k) => {
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
        }))).filter(item => item !== null);

        return new Response(JSON.stringify({ 
            links: details, 
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
