export interface FaqItem {
    question: string;
    answer: string;
}

export const faqItems: FaqItem[] = [
    {
        question: "What is Count Collab?",
        answer:
            "Count Collab is a free, real-time collaborative counter platform. Create a counter, share its unique link, and let anyone increment or decrement it instantly — all changes sync across every device in real time.",
    },
    {
        question: "Is Count Collab free?",
        answer:
            "Yes, Count Collab is completely free to use. Create unlimited public counters, share them with anyone, and collaborate in real time at no cost.",
    },
    {
        question: "Do I need an account to use Count Collab?",
        answer:
            "No account is required to create or use public counters. However, signing up unlocks additional features like private counters, member roles, dashboards, and the ability to manage who can access your counters.",
    },
    {
        question: "How does real-time sync work?",
        answer:
            "Count Collab uses WebSocket technology (Socket.IO) to push every change instantly to all connected devices. When someone increments a counter, every other person viewing it sees the update immediately — no refresh needed.",
    },
    {
        question: "Can I make a counter private?",
        answer:
            "Yes. Count Collab offers three visibility modes: public (anyone can view and increment), public read-only (anyone can view but only members can increment), and private (only invited members can access the counter).",
    },
    {
        question: "What are dashboards?",
        answer:
            "Dashboards let you group multiple counters into a single organized view. Create a dashboard, add counters to it, and share the dashboard link so your team can monitor everything in one place.",
    },
    {
        question: "Can multiple people update the same counter at once?",
        answer:
            "Absolutely — that is the core feature of Count Collab. Any number of people can increment or decrement a counter simultaneously, and every change syncs in real time across all devices.",
    },
];
