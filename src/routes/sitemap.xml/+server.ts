import { slugify } from "$lib/counter";
import { buildInfo } from "$lib/server/build-info.generated";
import { listPublicCounterSitemapEntries } from "$lib/server/counters";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
  const origin = url.origin;
  const counters = await listPublicCounterSitemapEntries();

  const counterEntries = counters
    .map((c) => {
      const slug = slugify(c.title);
      const path = slug ? `/c/${c.id}/${slug}` : `/c/${c.id}`;
      const lastmod = c.updatedAt
        ? `<lastmod>${c.updatedAt.toISOString().replace(/\.\d{3}Z$/, "Z")}</lastmod>`
        : "";
      return `<url><loc>${origin}${path}</loc>${lastmod}</url>`;
    })
    .join("\n  ");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${origin}/</loc><lastmod>${buildInfo.buildTime}</lastmod></url>
  <url><loc>${origin}/home</loc><lastmod>${buildInfo.buildTime}</lastmod></url>
  <url><loc>${origin}/counters</loc><lastmod>${buildInfo.buildTime}</lastmod></url>
  <url><loc>${origin}/dashboards</loc><lastmod>${buildInfo.buildTime}</lastmod></url>
  <url><loc>${origin}/features</loc><lastmod>${buildInfo.buildTime}</lastmod></url>
  <url><loc>${origin}/use-cases</loc><lastmod>${buildInfo.buildTime}</lastmod></url>
  <url><loc>${origin}/how-it-works</loc><lastmod>${buildInfo.buildTime}</lastmod></url>
  <url><loc>${origin}/faq</loc><lastmod>${buildInfo.buildTime}</lastmod></url>
  ${counterEntries}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
