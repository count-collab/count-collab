import { json } from "@sveltejs/kit";

export type TeamLimitCode =
  | "team_limit"
  | "member_limit"
  | "pending_team_limit"
  | "pending_recipient_limit"
  | "daily_invitation_limit"
  | "invitation_cooldown";

/** A team/invitation cap was hit; `status` is the HTTP status routes should answer with. */
export class TeamLimitError extends Error {
  readonly status: 409 | 429;
  readonly code: TeamLimitCode;
  readonly retryAfter?: number;

  constructor(
    code: TeamLimitCode,
    status: 409 | 429,
    message: string,
    retryAfter?: number,
  ) {
    super(message);
    this.name = "TeamLimitError";
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export type BlockingTeam = { id: string; name: string; memberCount: number };

/** The user is the only owner of teams that still have other members. */
export class SoleTeamOwnerError extends Error {
  readonly teams: BlockingTeam[];

  constructor(blockingTeams: BlockingTeam[]) {
    super("Transfer ownership of your teams before deleting this account");
    this.name = "SoleTeamOwnerError";
    this.teams = blockingTeams;
  }
}

export function teamLimitResponse(err: TeamLimitError): Response {
  return json(
    { error: err.message, code: err.code },
    {
      status: err.status,
      headers: err.retryAfter ? { "Retry-After": String(err.retryAfter) } : {},
    },
  );
}

/** One body for every invite outcome so callers can't probe which usernames exist. */
export function inviteAcceptedResponse(): Response {
  return json({ ok: true });
}
