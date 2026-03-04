import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { counters, type NewCounter } from "../src/lib/db/schema";

const COUNTER_TOTAL = 50;

async function seedCounters() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error(
            "Error: DATABASE_URL environment variable is not set. Please configure it in your .env file.",
        );
        process.exitCode = 1;
        return;
    }
    const queryClient = postgres(databaseUrl);
    const db = drizzle(queryClient);

    const countersToCreate: NewCounter[] = Array.from(
        { length: COUNTER_TOTAL },
        (_, index) => {
            const counterNumber = String(index + 1).padStart(2, "0");
            let count = 0;
            const rand = Math.random();
            if (rand < 0.2) {
                count = Math.floor(Math.random() * 1000) + 100; // 100-1100
            } else if (rand < 0.5) {
                count = Math.floor(Math.random() * 90) + 10; // 10-100
            } else {
                count = Math.floor(Math.random() * 10); // 0-9
            }

            return {
                title: `Seed Counter ${counterNumber}`,
                description: "Auto-generated counter for local testing",
                count,
                isPublic: 1,
            };
        },
    );

    try {
        const insertedCounters = await db
            .insert(counters)
            .values(countersToCreate)
            .returning({ id: counters.id });

        console.info(`Created ${insertedCounters.length} counters.`);
    } catch (error) {
        console.error("Failed to seed counters:", error);
        process.exitCode = 1;
    } finally {
        await queryClient.end({ timeout: 5 });
    }
}

void seedCounters();