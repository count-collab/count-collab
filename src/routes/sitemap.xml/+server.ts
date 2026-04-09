import { buildInfo } from "$lib/server/build-info.generated";
import { listPublicCounterSitemapEntries } from "$lib/server/counters";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
    const origin = url.origin;
    const counters = await listPublicCounterSitemapEntries();

    const counterEntries = counters
        .map((c) => {
            const lastmod = c.updatedAt
                ? `<lastmod>${c.updatedAt.toISOString()}</lastmod>`
                : "";
            return `<url><loc>${origin}/c/${c.id}</loc>${lastmod}</url>`;
        })
        .join("\n  ");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${origin}/</loc><lastmod>${buildInfo.buildTime}</lastmod></url>
  <url><loc>${origin}/counters</loc><lastmod>${buildInfo.buildTime}</lastmod></url>
  ${counterEntries}
</urlset>`;

    return new Response(xml, {
        headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
        },
    });
};
