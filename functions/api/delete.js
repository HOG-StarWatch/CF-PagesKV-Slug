export async function onRequestPost(context) {
    const { env, request } = context;
    const url = new URL(request.url);
    const key = url.searchParams.get('key') || request.headers.get('X-Admin-Key');

    if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { 
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
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
            return new Response(JSON.stringify({ error: "Missing slug or slugs" }), { status: 400 });
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
