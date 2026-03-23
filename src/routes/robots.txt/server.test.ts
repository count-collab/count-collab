import { afterEach, describe, expect, it, vi } from "vitest";

describe("GET /robots.txt", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it("returns Disallow: / when NOINDEX is true", async () => {
        vi.stubEnv("NOINDEX", "true");
        const { GET } = await import("./+server");

        const response = GET({} as never);
        const body = await response.text();

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("text/plain");
        expect(response.headers.get("cache-control")).toBe("public, max-age=86400");
        expect(body).toContain("Disallow: /");
    });

    it("returns empty Disallow when NOINDEX is not set", async () => {
        vi.stubEnv("NOINDEX", "");
        const { GET } = await import("./+server");

        const response = GET({} as never);
        const body = await response.text();

        expect(response.status).toBe(200);
        expect(body).toContain("Disallow:\n");
        expect(body).not.toContain("Disallow: /\n");
    });
});
