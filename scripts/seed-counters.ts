import { eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  counterHistory,
  counters,
  type NewCounter,
  type NewCounterHistory,
  type NewUser,
  users,
} from "../src/lib/db/schema";

// Prefix to identify seed users for cleanup
const SEED_EMAIL_DOMAIN = "seed.countcollab.local";

const SEED_USERS: NewUser[] = [
  {
    name: "Alice Chen",
    email: `alice@${SEED_EMAIL_DOMAIN}`,
    username: "alice_chen",
    image: "https://api.dicebear.com/9.x/avataaars/svg?seed=alice",
  },
  {
    name: "Bob Martinez",
    email: `bob@${SEED_EMAIL_DOMAIN}`,
    username: "bob_martinez",
    image: "https://api.dicebear.com/9.x/avataaars/svg?seed=bob",
  },
  {
    name: "Charlie Okafor",
    email: `charlie@${SEED_EMAIL_DOMAIN}`,
    username: "charlie_o",
    image: "https://api.dicebear.com/9.x/avataaars/svg?seed=charlie",
  },
  {
    name: "Dana Kim",
    email: `dana@${SEED_EMAIL_DOMAIN}`,
    username: "dana_kim",
    image: "https://api.dicebear.com/9.x/avataaars/svg?seed=dana",
  },
  {
    name: "Eli Johansson",
    email: `eli@${SEED_EMAIL_DOMAIN}`,
    username: "eli_j",
    image: "https://api.dicebear.com/9.x/avataaars/svg?seed=eli",
  },
  {
    name: "Faye Nguyen",
    email: `faye@${SEED_EMAIL_DOMAIN}`,
    username: "faye_nguyen",
    image: "https://api.dicebear.com/9.x/avataaars/svg?seed=faye",
  },
  {
    name: "Gus Petrov",
    email: `gus@${SEED_EMAIL_DOMAIN}`,
    username: "gus_p",
    image: "https://api.dicebear.com/9.x/avataaars/svg?seed=gus",
  },
  {
    name: "Hana Tanaka",
    email: `hana@${SEED_EMAIL_DOMAIN}`,
    username: "hana_t",
    image: "https://api.dicebear.com/9.x/avataaars/svg?seed=hana",
  },
  {
    name: "Ivan Müller",
    email: `ivan@${SEED_EMAIL_DOMAIN}`,
    username: "ivan_m",
    image: "https://api.dicebear.com/9.x/avataaars/svg?seed=ivan",
  },
  {
    name: "Jess Okonkwo",
    email: `jess@${SEED_EMAIL_DOMAIN}`,
    username: "jess_oko",
    image: "https://api.dicebear.com/9.x/avataaars/svg?seed=jess",
  },
];

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
    count: 1850,
  },
  {
    title: "Bugs Squashed This Sprint",
    description: "Keeping score of resolved bugs during the current sprint.",
    count: 23,
  },
  {
    title: "Pull Requests Merged",
    description: "Total PRs merged into main across all repos.",
    count: 4700,
  },
  {
    title: "Books Read in 2026",
    description:
      "Community reading challenge — one increment per finished book.",
    count: 310,
  },

  // Community & fun
  {
    title: "Times Someone Said 'It Works on My Machine'",
    description: "The classic excuse, tallied for posterity.",
    count: 2200,
  },
  {
    title: "High Fives Given",
    description: "Spread positivity. Tap to record a high five.",
    count: 10000,
  },
  {
    title: "Dad Jokes Told",
    description: "Every groan-worthy joke deserves to be counted.",
    count: 580,
  },
  {
    title: "Sunset Photos Shared",
    description: "Beautiful skies captured and shared by the community.",
    count: 63,
  },
  {
    title: "Plants Watered",
    description: "A gentle reminder tracker — did you water your plants today?",
    count: 1400,
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
    count: 5,
  },
  {
    title: "Meditation Sessions",
    description: "Collective mindfulness minutes, one session at a time.",
    count: 750,
  },
  {
    title: "Push-ups Challenge",
    description: "Team push-up challenge — total reps across all participants.",
    count: 8500,
  },
  {
    title: "Steps Walked (in thousands)",
    description: "Combined daily steps for the walking group.",
    count: 3200,
  },

  // Office & work
  {
    title: "Meetings That Could Have Been Emails",
    description: "We've all been there. Increment freely.",
    count: 2700,
  },
  {
    title: "Deploys This Month",
    description: "Tracking how many times we ship to production.",
    count: 31,
  },
  {
    title: "Slack Messages Sent",
    description: "Approximate message volume in #general this week.",
    count: 7400,
  },
  {
    title: "Whiteboard Markers Dried Out",
    description: "RIP to every marker that gave its last ink.",
    count: 17,
  },
  {
    title: "Standup Meetings Held",
    description: "Daily standups completed by the engineering team.",
    count: 950,
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
    count: 5600,
  },
  {
    title: "New Words Learned",
    description: "Vocabulary challenge — add one for every new word you learn.",
    count: 1100,
  },
  {
    title: "Open Source Contributions",
    description: "PRs, issues, and docs contributed to OSS projects.",
    count: 420,
  },
  {
    title: "Blog Posts Published",
    description: "Collective writing output from the content team.",
    count: 185,
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
    count: 3300,
  },
  {
    title: "Compliments Given",
    description: "Brighten someone's day and increment this counter.",
    count: 6100,
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
    count: 0,
  },
  {
    title: "New Recipes Tried",
    description: "Cooking adventures — one increment per new recipe.",
    count: 12,
  },
  {
    title: "Houseplants in the Office",
    description: "Census of all green friends on our desks.",
    count: 0,
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

  // Negative counters (decrement only)
  {
    title: "Sprint Burndown Remaining",
    description: "Story points left in the sprint — decrement as work is done.",
    count: -34,
    counterMode: "decrement_only",
  },
  {
    title: "Countdown to Launch",
    description: "Days remaining until product launch. Decrement daily.",
    count: -120,
    counterMode: "decrement_only",
  },
  {
    title: "Budget Remaining (units)",
    description: "Track remaining budget allocations for the quarter.",
    count: -870,
    counterMode: "decrement_only",
  },
  {
    title: "Inventory Drawdown",
    description: "Items pulled from warehouse stock this month.",
    count: -215,
    counterMode: "decrement_only",
  },
  {
    title: "Technical Debt Score",
    description: "Points of tech debt reduced — every refactor helps.",
    count: -45,
    counterMode: "decrement_only",
  },

  // V-shaped counters: go negative then recover to positive (bidirectional)
  {
    title: "Net Promoter Score",
    description:
      "Customer satisfaction tracker — dipped negative after the outage, slowly recovering.",
    count: 18,
    counterMode: "both",
  },
  {
    title: "Office Mood Index",
    description:
      "Team morale thermometer. Went below zero during crunch, now on the rebound.",
    count: 7,
    counterMode: "both",
  },
  {
    title: "Profit / Loss Tracker",
    description:
      "Monthly P&L swings — started in the red, clawed back to green.",
    count: 42,
    counterMode: "both",
  },
  {
    title: "Karma Points",
    description:
      "Community reputation. Lost some after a controversial PR, earned it back.",
    count: 130,
    counterMode: "both",
  },
  {
    title: "Goal Difference",
    description:
      "Football league goal diff — rough start, strong second half of the season.",
    count: 5,
    counterMode: "both",
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
    // ── Clean up previous seed data ────────────────────────────────
    const deletedOld = await db
      .delete(counters)
      .where(eq(counters.ownerId, ""))
      .returning({ id: counters.id });

    const deletedLegacy = await db
      .delete(counters)
      .where(
        eq(counters.description, "Auto-generated counter for local testing"),
      )
      .returning({ id: counters.id });

    // Delete previous seed users (cascades to their sessions/accounts)
    const deletedUsers = await db
      .delete(users)
      .where(like(users.email, `%@${SEED_EMAIL_DOMAIN}`))
      .returning({ id: users.id });

    console.info(
      `Cleaned up ${deletedOld.length + deletedLegacy.length} old seed counters, ${deletedUsers.length} old seed users.`,
    );

    // ── Create mock users ──────────────────────────────────────────
    const insertedUsers = await db
      .insert(users)
      .values(SEED_USERS)
      .returning({ id: users.id });

    const userIds = insertedUsers.map((u) => u.id);
    console.info(`Created ${userIds.length} mock users.`);

    function randomUserId(): string {
      return userIds[Math.floor(Math.random() * userIds.length)];
    }

    // ── Create counters ────────────────────────────────────────────
    const now = Date.now();
    const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    // Assign each counter a random creation date spread over the last 2 years
    const counterCreationDates: Date[] = SEED_COUNTERS.map(() => {
      const ageMs = TWO_YEARS_MS * (0.05 + Math.random() * 0.95); // 5%-100% of 2 years ago
      return new Date(now - ageMs);
    });

    const countersToCreate: NewCounter[] = SEED_COUNTERS.map((c, i) => ({
      ...c,
      count: 0,
      isPublic: 1,
      counterMode: c.counterMode ?? "increment_only",
      ownerId: randomUserId(),
      createdAt: counterCreationDates[i],
      updatedAt: counterCreationDates[i],
    }));

    const insertedCounters = await db
      .insert(counters)
      .values(countersToCreate)
      .returning({ id: counters.id });

    console.info(`Created ${insertedCounters.length} counters.`);

    // Generate realistic counter history based on each counter's creation date
    const historyRows: NewCounterHistory[] = [];
    const finalCounts: { id: string; count: number }[] = [];

    for (let i = 0; i < insertedCounters.length; i++) {
      const counterId = insertedCounters[i].id;
      const targetCount = SEED_COUNTERS[i].count ?? 0;
      const mode = SEED_COUNTERS[i].counterMode ?? "increment_only";

      if (targetCount === 0) continue;

      // History starts from the counter's creation date
      const startTime = counterCreationDates[i].getTime();

      // Build a list of "active days" with gaps (some days have activity, some don't)
      const historySpanMs = now - startTime;
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

      // Build the sequence of value changes depending on counter mode
      const steps: number[] = []; // each entry is +1 or -1

      if (mode === "both" && targetCount > 0) {
        // V-shaped: go negative first, then recover past zero to the target
        // Pick a negative trough between -20% and -60% of the total swing
        const totalSwing = Math.abs(targetCount);
        const troughDepth = Math.max(
          5,
          Math.floor(totalSwing * (0.2 + Math.random() * 0.4)),
        );

        // Phase 1: descend to the trough
        for (let s = 0; s < troughDepth; s++) steps.push(-1);
        // Phase 2: climb back from trough to the target
        const climbSteps = troughDepth + targetCount;
        for (let s = 0; s < climbSteps; s++) steps.push(+1);
      } else if (mode === "decrement_only" || targetCount < 0) {
        // Pure negative: decrement by 1 for each step
        const numEntries = Math.abs(targetCount);
        for (let s = 0; s < numEntries; s++) steps.push(-1);
      } else {
        // Pure positive: increment by 1 for each step
        const numEntries = targetCount;
        for (let s = 0; s < numEntries; s++) steps.push(+1);
      }

      // Distribute steps across active days
      const entriesPerDay: number[] = new Array(activeDays.length).fill(0);

      // For V-shaped counters, preserve chronological ordering by distributing
      // steps sequentially across days (first half descend, second half ascend)
      if (mode === "both" && targetCount > 0) {
        for (let e = 0; e < steps.length; e++) {
          // Spread across all active days proportionally
          const dayIdx = Math.min(
            Math.floor((e / steps.length) * activeDays.length),
            activeDays.length - 1,
          );
          entriesPerDay[dayIdx]++;
        }
      } else {
        for (let e = 0; e < steps.length; e++) {
          // Weighted toward later days (counters tend to get busier over time)
          const idx = Math.floor(Math.random() ** 0.8 * activeDays.length);
          entriesPerDay[idx]++;
        }
      }

      // Generate history rows in chronological order
      let currentValue = 0;
      let stepIdx = 0;

      for (let d = 0; d < activeDays.length; d++) {
        const dayOffset = activeDays[d];
        const dayStart = startTime + dayOffset * ONE_DAY_MS;

        for (let e = 0; e < entriesPerDay[d]; e++) {
          const previousValue = currentValue;
          currentValue += steps[stepIdx++];

          // Random time within the day (spread across waking hours 7am-11pm)
          const hourOffset = 7 + Math.random() * 16; // 7:00 - 23:00
          const changedAt = new Date(dayStart + hourOffset * 3600_000);

          historyRows.push({
            counterId,
            previousValue,
            newValue: currentValue,
            changedBy: randomUserId(),
            changedAt,
          });
        }
      }

      finalCounts.push({ id: counterId, count: currentValue });
    }

    // Insert history in batches to avoid exceeding query parameter limits
    const BATCH_SIZE = 500;
    for (let offset = 0; offset < historyRows.length; offset += BATCH_SIZE) {
      const batch = historyRows.slice(offset, offset + BATCH_SIZE);
      await db.insert(counterHistory).values(batch);
    }

    // Update each counter's count to match the actual history
    for (const { id, count } of finalCounts) {
      await db.update(counters).set({ count }).where(eq(counters.id, id));
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
