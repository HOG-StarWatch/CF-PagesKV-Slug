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

export async function onRequestPost(context) {
    const { env, request } = context;
    const key = request.headers.get('X-Admin-Key');

    // 只允许从 Header 获取密钥
    if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
        return errorResponse(401, "Unauthorized: Invalid or missing Admin Key");
    }

    try {
        const body = await request.json();
        const { slug, slugs } = body;

        if (slugs && Array.isArray(slugs)) {
            // Batch delete
            // KV doesn't support true batch delete in one API call, so we iterate
            // But we can do it in parallel
            await Promise.all(slugs.map(s => env.LINKS.delete(s)));
        } else if (slug) {
            // Single delete
            await env.LINKS.delete(slug);
        } else {
            return errorResponse(400, "Missing slug or slugs");
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: {
                "Content-Type": "application/json",
                "Content-Security-Policy": "default-src 'none'; base-uri 'none'"
            }
        });
    } catch (err) {
        return errorResponse(500, err.message);
    }
}
