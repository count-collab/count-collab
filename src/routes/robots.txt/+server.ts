import type { RequestHandler } from "./$types";

const noindex = process.env.NOINDEX === "true";

const DISALLOW_ALL = `User-agent: *
Disallow: /
`;

const ALLOW_ALL = `User-agent: *
Disallow:
`;

export const GET: RequestHandler = () => {
  return new Response(noindex ? DISALLOW_ALL : ALLOW_ALL, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=86400",
    },
  });
};
