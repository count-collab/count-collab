import { logger } from "./logger";

interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
}

interface RequestRecord {
    timestamps: number[];
}

interface IPRecord {
    [route: string]: RequestRecord;
}

const ipStore = new Map<string, IPRecord>();
const counterAbuseStore = new Map<string, Record<string, number>>();

/**
 * Default rate limiting configuration for different routes
 */
export const RATE_LIMIT_CONFIG = {
    "/create": {
        windowMs: 60 * 1000, // 1 minute window
        maxRequests: 5,
    },
    "/c/[id]": {
        windowMs: 60 * 1000,
        maxRequests: 1, // 1 increment per minute
    },
};

/**
 * Get IP address from request, handling X-Forwarded-For headers
 */
export function getClientIp(request: Request): string {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
        return forwardedFor.split(",")[0].trim();
    }

    const xRealIp = request.headers.get("x-real-ip");
    if (xRealIp) {
        return xRealIp;
    }

    // Fallback for local connections
    return "127.0.0.1";
}

/**
 * Check if IP is rate limited for a given route using sliding window algorithm.
 * Returns null if request is allowed, or object with retry info if limited.
 */
export function checkRateLimit(
    ip: string,
    route: string,
    config: RateLimitConfig,
): { retryAfter: number } | null {
    const now = Date.now();
    const routeKey = route;
    const windowStart = now - config.windowMs;

    // Initialize IP record if needed
    if (!ipStore.has(ip)) {
        ipStore.set(ip, {});
    }

    const ipRecord = ipStore.get(ip);
    if (!ipRecord) {
        return null;
    }

    // Initialize route record if needed
    if (!ipRecord[routeKey]) {
        ipRecord[routeKey] = {
            timestamps: [],
        };
    }

    const record = ipRecord[routeKey];

    // Remove timestamps outside the sliding window
    record.timestamps = record.timestamps.filter(
        (timestamp) => timestamp > windowStart,
    );

    // Check if over limit
    if (record.timestamps.length >= config.maxRequests) {
        const oldestTimestamp = record.timestamps[0];
        const retryAfterMs = oldestTimestamp + config.windowMs - now;
        const retryAfter = Math.ceil(retryAfterMs / 1000);

        logger.warn("Rate limit exceeded", {
            ip,
            route,
            count: record.timestamps.length,
            limit: config.maxRequests,
            retryAfter,
        });

        return { retryAfter };
    }

    // Add current timestamp
    record.timestamps.push(now);
    return null;
}

/**
 * Track counter increments for abuse detection
 */
export function trackCounterIncrement(ip: string, counterId: string): void {
    if (!counterAbuseStore.has(ip)) {
        counterAbuseStore.set(ip, {});
    }

    const ipCounters = counterAbuseStore.get(ip);
    if (!ipCounters) {
        return;
    }

    ipCounters[counterId] = (ipCounters[counterId] ?? 0) + 1;

    // Check for abuse pattern (many increments to same counter)
    if (ipCounters[counterId] > 20) {
        logger.warn("Abuse signal: Rapid counter increments detected", {
            ip,
            counterId,
            incrementCount: ipCounters[counterId],
        });
    }
}

/**
 * Cleanup old records periodically to prevent memory leak
 */
export function cleanupOldRecords(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    // Cleanup IP store
    for (const [ip, routes] of ipStore.entries()) {
        let hasActiveRoute = false;

        for (const [route, record] of Object.entries(routes)) {
            // Remove timestamps older than maxAge
            record.timestamps = record.timestamps.filter(
                (timestamp) => now - timestamp < maxAge,
            );

            // Keep route if it has recent activity
            if (record.timestamps.length > 0) {
                hasActiveRoute = true;
            } else {
                delete routes[route];
            }
        }

        if (!hasActiveRoute) {
            ipStore.delete(ip);
        }
    }

    // Cleanup counter abuse store
    for (const [ip] of counterAbuseStore.entries()) {
        if (!ipStore.has(ip)) {
            counterAbuseStore.delete(ip);
        }
    }

    logger.debug("Rate limiter: Cleaned up old records", {
        activeIPs: ipStore.size,
    });
}

// Schedule cleanup every 5 minutes
setInterval(cleanupOldRecords, 5 * 60 * 1000);
