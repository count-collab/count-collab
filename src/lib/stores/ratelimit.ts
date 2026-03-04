import { writable } from "svelte/store";

interface RateLimitStatus {
    isLimited: boolean;
    retryAfterSeconds: number;
    route: string | null;
}

function createRateLimitStore() {
    const { subscribe, set, update } = writable<RateLimitStatus>({
        isLimited: false,
        retryAfterSeconds: 0,
        route: null,
    });

    return {
        subscribe,
        setLimit: (route: string, retryAfterSeconds: number) => {
            set({
                isLimited: true,
                retryAfterSeconds,
                route,
            });

            // Start countdown
            const interval = setInterval(() => {
                update((state) => {
                    const newSeconds = state.retryAfterSeconds - 1;
                    if (newSeconds <= 0) {
                        clearInterval(interval);
                        return {
                            isLimited: false,
                            retryAfterSeconds: 0,
                            route: null,
                        };
                    }
                    return {
                        ...state,
                        retryAfterSeconds: newSeconds,
                    };
                });
            }, 1000);
        },
        reset: () => {
            set({
                isLimited: false,
                retryAfterSeconds: 0,
                route: null,
            });
        },
    };
}

export const rateLimit = createRateLimitStore();
