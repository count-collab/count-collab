import type { RequestHandler } from "./$types";

const noindex = process.env.NOINDEX === "true";

const DISALLOW_ALL = `User-agent: *
Disallow: /
`;

const ALLOW_ALL = `User-agent: *
Disallow:
`;

export const GET: RequestHandler = ({ url }) => {
  const body =
    (noindex ? DISALLOW_ALL : ALLOW_ALL) +
    `Sitemap: ${url.origin}/sitemap.xml\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=86400",
    },
  });
};
