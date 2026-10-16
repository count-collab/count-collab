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
      "No account is required to create or use public counters. However, signing up unlocks additional features like private counters, member roles, dashboards, teams, and the ability to manage who can access your counters.",
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
    question: "What are teams?",
    answer:
      "Teams let you share many counters and dashboards with the same group of people at once. Instead of inviting everyone to each counter individually, you create a team, add your members once, and every counter and dashboard owned by the team is automatically available to them. Teams require a free account.",
  },
  {
    question: "How do roles work in a team?",
    answer:
      "Team members have the same roles as counters — viewer, incrementer, editor, and admin — plus owner. A member's team role applies to every counter and dashboard the team owns: viewers can watch, incrementers can count, editors can create and edit team counters and dashboards, admins manage members, and owners have full control including deleting the team. Teams can have multiple owners.",
  },
  {
    question: "How do I add people to a team?",
    answer:
      "Team admins can invite people by their username, and the invitation shows up in their notifications. Alternatively, enable a join link and share it — anyone with an account who opens it joins with the role you picked (up to editor). You can reset the link at any time to stop it from working.",
  },
  {
    question: "Can I move my existing counters into a team?",
    answer:
      "Yes. You can move counters and dashboards you own into any team where you are an editor or higher, or create them directly in a team. When moving a dashboard, you can bring the counters on it along. Team counters start out private, and team pages are only visible to team members.",
  },
  {
    question: "Can multiple people update the same counter at once?",
    answer:
      "Absolutely — that is the core feature of Count Collab. Any number of people can increment or decrement a counter simultaneously, and every change syncs in real time across all devices.",
  },
  {
    question: "Is there a cooldown between counter updates?",
    answer:
      "Yes. To prevent spam, there is a short cooldown between increments. Guest users (no account) have a 30-second cooldown, while signed-in users enjoy a shorter 5-second cooldown.",
  },
];
