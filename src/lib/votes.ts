import type { MealVoteValue } from "@prisma/client";

export const voteValues = ["WANT", "OKAY", "NO"] as const;

export type MealVoteWithUser = {
  comment: string | null;
  userId: string;
  vote: MealVoteValue;
  user: {
    email: string;
    name: string | null;
  };
};

export function voteLabel(value: MealVoteValue) {
  if (value === "WANT") {
    return "Want";
  }

  if (value === "OKAY") {
    return "Okay";
  }

  return "No";
}

export function summarizeVotes(votes: MealVoteWithUser[], currentUserId?: string) {
  const counts: Record<MealVoteValue, number> = {
    NO: 0,
    OKAY: 0,
    WANT: 0,
  };

  for (const vote of votes) {
    counts[vote.vote] += 1;
  }

  return {
    comments: votes
      .filter((vote) => vote.comment?.trim())
      .map((vote) => ({
        comment: vote.comment!.trim(),
        label: vote.user.name ?? vote.user.email,
        vote: vote.vote,
      })),
    counts,
    currentUserVote: votes.find((vote) => vote.userId === currentUserId) ?? null,
    total: votes.length,
  };
}
