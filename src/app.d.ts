import type { Session } from "@auth/sveltekit";

declare module "@auth/sveltekit" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      username?: string | null;
      roleId?: number | null;
    };
  }
}

declare global {
  namespace App {
    // Locals is augmented by @auth/sveltekit (adds auth(), signIn, signOut)
    interface PageData {
      session: Session | null;
    }
  }
}
