import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  counterHistory,
  counters,
  type NewCounter,
  type NewCounterHistory,
} from "../src/lib/db/schema";

const SEED_COUNTERS: Omit<NewCounter, "isPublic">[] = [
  // High-traffic popular counters
  {
    title: "Days Without a Production Incident",
    description: "Tracking our uptime streak. Resets on every outage.",
    count: 42,
  },
  {
    title: "Office Coffee Cups",
    description: "How many cups of coffee the team drinks per week.",
    count: 387,
  },
  {
    title: "Bugs Squashed This Sprint",
    description: "Keeping score of resolved bugs during the current sprint.",
    count: 23,
  },
  {
    title: "Pull Requests Merged",
    description: "Total PRs merged into main across all repos.",
    count: 1204,
  },
  {
    title: "Books Read in 2026",
    description:
      "Community reading challenge — one increment per finished book.",
    count: 89,
  },

  // Community & fun
  {
    title: "Times Someone Said 'It Works on My Machine'",
    description: "The classic excuse, tallied for posterity.",
    count: 571,
  },
  {
    title: "High Fives Given",
    description: "Spread positivity. Tap to record a high five.",
    count: 2048,
  },
  {
    title: "Dad Jokes Told",
    description: "Every groan-worthy joke deserves to be counted.",
    count: 156,
  },
  {
    title: "Sunset Photos Shared",
    description: "Beautiful skies captured and shared by the community.",
    count: 63,
  },
  {
    title: "Plants Watered",
    description: "A gentle reminder tracker — did you water your plants today?",
    count: 312,
  },

  // Fitness & wellness
  {
    title: "Morning Runs Completed",
    description: "Track every early morning jog. Rise and grind!",
    count: 74,
  },
  {
    title: "Glasses of Water Today",
    description: "Stay hydrated! Increment for every glass you drink.",
    count: 8,
  },
  {
    title: "Meditation Sessions",
    description: "Collective mindfulness minutes, one session at a time.",
    count: 201,
  },
  {
    title: "Push-ups Challenge",
    description: "Team push-up challenge — total reps across all participants.",
    count: 4500,
  },
  {
    title: "Steps Walked (in thousands)",
    description: "Combined daily steps for the walking group.",
    count: 892,
  },

  // Office & work
  {
    title: "Meetings That Could Have Been Emails",
    description: "We've all been there. Increment freely.",
    count: 743,
  },
  {
    title: "Deploys This Month",
    description: "Tracking how many times we ship to production.",
    count: 31,
  },
  {
    title: "Slack Messages Sent",
    description: "Approximate message volume in #general this week.",
    count: 2891,
  },
  {
    title: "Whiteboard Markers Dried Out",
    description: "RIP to every marker that gave its last ink.",
    count: 17,
  },
  {
    title: "Standup Meetings Held",
    description: "Daily standups completed by the engineering team.",
    count: 220,
  },

  // Events & milestones
  {
    title: "Concert Attendees",
    description: "Headcount for the upcoming community concert event.",
    count: 134,
  },
  {
    title: "Volunteers Signed Up",
    description: "People who registered to help at the charity run.",
    count: 56,
  },
  {
    title: "Pizza Slices at Friday Lunch",
    description: "Total slices consumed at last Friday's team lunch.",
    count: 97,
  },
  {
    title: "Game Night Wins",
    description: "Scoreboard for weekly board game night victories.",
    count: 38,
  },
  {
    title: "Countries Visited",
    description: "Combined travel log — places our team has explored.",
    count: 47,
  },

  // Learning & growth
  {
    title: "Tutorial Videos Watched",
    description: "Online courses and tutorials completed by the study group.",
    count: 163,
  },
  {
    title: "New Words Learned",
    description: "Vocabulary challenge — add one for every new word you learn.",
    count: 284,
  },
  {
    title: "Open Source Contributions",
    description: "PRs, issues, and docs contributed to OSS projects.",
    count: 109,
  },
  {
    title: "Blog Posts Published",
    description: "Collective writing output from the content team.",
    count: 42,
  },
  {
    title: "Coding Streak (Days)",
    description: "Consecutive days with at least one commit.",
    count: 18,
  },

  // Random & niche
  {
    title: "Times the Build Broke",
    description: "CI failures that blocked the pipeline. Aim for zero.",
    count: 33,
  },
  {
    title: "Cups of Tea This Week",
    description: "For the tea lovers — tracking weekly consumption.",
    count: 52,
  },
  {
    title: "Typos Found in Docs",
    description: "Documentation review tracker. Every typo counts.",
    count: 71,
  },
  {
    title: "Compliments Given",
    description: "Brighten someone's day and increment this counter.",
    count: 445,
  },
  {
    title: "Rainy Days This Year",
    description: "Weather log for our city — increment when it rains.",
    count: 28,
  },

  // Low-count fresh counters
  {
    title: "Pomodoro Sessions Today",
    description: "Focus timer completions for today's work session.",
    count: 3,
  },
  {
    title: "New Recipes Tried",
    description: "Cooking adventures — one increment per new recipe.",
    count: 12,
  },
  {
    title: "Houseplants in the Office",
    description: "Census of all green friends on our desks.",
    count: 9,
  },
  {
    title: "Parking Lot Ideas",
    description: "Ideas tabled for later discussion. We'll get to them!",
    count: 14,
  },
  {
    title: "Team Lunch Outings",
    description: "Number of times the team went out for lunch together.",
    count: 7,
  },
];

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

  try {
    // Delete old seed counters (those with no owner)
    const deleted = await db
      .delete(counters)
      .where(eq(counters.ownerId, ""))
      .returning({ id: counters.id });

    // Also delete counters that look like old seeds
    const deletedNull = await db
      .delete(counters)
      .where(
        eq(counters.description, "Auto-generated counter for local testing"),
      )
      .returning({ id: counters.id });

    console.info(
      `Cleaned up ${deleted.length + deletedNull.length} old seed counters.`,
    );

    const countersToCreate: NewCounter[] = SEED_COUNTERS.map((c) => ({
      ...c,
      isPublic: 1,
      ownerId: null,
    }));

    const insertedCounters = await db
      .insert(counters)
      .values(countersToCreate)
      .returning({ id: counters.id });

    console.info(`Created ${insertedCounters.length} counters.`);

    // Generate realistic counter history spanning up to 2 years
    const historyRows: NewCounterHistory[] = [];
    const now = Date.now();
    const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    for (let i = 0; i < insertedCounters.length; i++) {
      const counterId = insertedCounters[i].id;
      const targetCount = SEED_COUNTERS[i].count ?? 0;

      if (targetCount <= 0) continue;

      // Each counter gets a random start point within the last 2 years
      const historySpanMs = TWO_YEARS_MS * (0.3 + Math.random() * 0.7); // 30%-100% of 2 years
      const startTime = now - historySpanMs;

      // Build a list of "active days" with gaps (some days have activity, some don't)
      const totalDays = Math.ceil(historySpanMs / ONE_DAY_MS);
      const activeDays: number[] = []; // day offsets from start

      for (let day = 0; day < totalDays; day++) {
        // ~60% chance of activity on any given day, creating natural gaps
        // Occasionally skip longer stretches (up to a week)
        if (Math.random() < 0.15) {
          // 15% chance to skip 2-7 days
          day += Math.floor(Math.random() * 6) + 1;
          continue;
        }
        if (Math.random() < 0.6) {
          activeDays.push(day);
        }
      }

      // Ensure at least a few active days
      if (activeDays.length < 3) {
        activeDays.push(0, Math.floor(totalDays / 2), totalDays - 1);
      }

      // Decide how many history entries (capped to keep seeding fast)
      const numEntries = Math.min(targetCount, 150);

      // Distribute entries across active days (some days get multiple increments)
      const entriesPerDay: number[] = new Array(activeDays.length).fill(0);
      for (let e = 0; e < numEntries; e++) {
        // Weighted toward later days (counters tend to get busier over time)
        const idx = Math.floor(Math.random() ** 0.8 * activeDays.length);
        entriesPerDay[idx]++;
      }

      // Distribute the target count across entries
      const baseIncrement = Math.floor(targetCount / numEntries);
      let remainder = targetCount - baseIncrement * numEntries;
      let currentValue = 0;

      for (let d = 0; d < activeDays.length; d++) {
        const dayOffset = activeDays[d];
        const dayStart = startTime + dayOffset * ONE_DAY_MS;

        for (let e = 0; e < entriesPerDay[d]; e++) {
          const increment = baseIncrement + (remainder > 0 ? 1 : 0);
          if (remainder > 0) remainder--;

          const previousValue = currentValue;
          currentValue += increment;

          // Random time within the day (spread across waking hours 7am-11pm)
          const hourOffset = 7 + Math.random() * 16; // 7:00 - 23:00
          const changedAt = new Date(dayStart + hourOffset * 3600_000);

          historyRows.push({
            counterId,
            previousValue,
            newValue: currentValue,
            changedBy: null,
            changedAt,
          });
        }
      }
    }

    // Insert history in batches to avoid exceeding query parameter limits
    const BATCH_SIZE = 500;
    for (let offset = 0; offset < historyRows.length; offset += BATCH_SIZE) {
      const batch = historyRows.slice(offset, offset + BATCH_SIZE);
      await db.insert(counterHistory).values(batch);
    }

    console.info(
      `Created ${historyRows.length} counter history entries across ${insertedCounters.length} counters.`,
    );
  } catch (error) {
    console.error("Failed to seed counters:", error);
    process.exitCode = 1;
  } finally {
    await queryClient.end({ timeout: 5 });
  }
}

void seedCounters();
