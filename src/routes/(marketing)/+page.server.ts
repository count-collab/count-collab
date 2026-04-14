import { redirect } from "@sveltejs/kit";
import {
    getCounterCount,
    getGlobalCounterSum,
    listPublicCounters,
} from "$lib/server/counters";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent, url }) => {
    const { session } = await parent();

    if (session?.user && !url.searchParams.has("landing")) {
        redirect(303, "/home");
    }

    const [popularResult, globalSum, counterCount] = await Promise.all([
        listPublicCounters(6),
        getGlobalCounterSum(),
        getCounterCount(),
    ]);

    return {
        popularCounters: popularResult.items,
        globalSum,
        counterCount,
    };
};
