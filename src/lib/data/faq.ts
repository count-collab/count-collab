export interface FaqItem {
  question: string;
  answer: string;
}

export const faqItems: FaqItem[] = [
  {
    question: "What is Count Collab?",
    answer:
      "Count Collab is a free, collaborative counter platform. Create counters with different visibility and update permissions, then share them with the people who should access them. Counter state is shared live.",
  },
  {
    question: "Is Count Collab free?",
    answer:
      "Yes, Count Collab is completely free to use. Create unlimited public counters, share them with anyone, and collaborate in real time at no cost.",
  },
  {
    question: "Do I need an account to use Count Collab?",
    answer:
      "No account is required to create or use public counters. Anyone can view and change a public counter; anyone can view a public read-only counter, but only members with counting access can change it. Private counters are accessible to members, with counting access needed to change the count, or to anyone with a valid private share-token link. Link holders do not need to sign in. Counters can be configured to count up or down. Signing up unlocks additional features like private counters, member roles, dashboards, teams, and the ability to manage who can access your counters.",
  },
  {
    question: "How does real-time sync work?",
    answer:
      "Count Collab shares counter state live across connected devices. When someone makes an allowed update, other people viewing the counter see the shared state without refreshing.",
  },
  {
    question: "Can I make a counter private?",
    answer:
      "Yes. Count Collab offers three visibility modes: public (anyone can view and change the count), public read-only (anyone can view, but only members with counting access can change it), and private (members can access it, with counting access needed to change the count; anyone with a valid private share-token link can also view and change it without signing in). Counters can be configured to count up or down.",
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
      "Multiple people can use the same counter, and its shared state updates live. Accepted changes may be rate-limited. Public and public read-only counters have platform cooldowns of 30 seconds for guests and 5 seconds for signed-in users; configured counter cooldowns may also apply.",
  },
  {
    question: "Is there a cooldown between counter updates?",
    answer:
      "Public and public read-only counters have platform cooldowns of 30 seconds for guests and 5 seconds for signed-in users. Private counters do not use those platform cooldowns; their configured counter cooldown may apply.",
  },
];
