import { redirect } from "@sveltejs/kit";
import {
    getCounterCount,
    getGlobalCounterSum,
    listPublicCounters,
} from "$lib/server/counters";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ depends, parent, url }) => {
    const { session } = await parent();

    if (session?.user && !url.searchParams.has("landing")) {
        redirect(303, "/home");
    }

    depends("counters:list");

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
