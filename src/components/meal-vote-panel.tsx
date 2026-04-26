import type { MealVoteValue } from "@prisma/client";

import { voteMealAction } from "@/app/vote-actions";
import {
  summarizeVotes,
  voteLabel,
  type MealVoteWithUser,
} from "@/lib/votes";

const voteStyles: Record<MealVoteValue, string> = {
  NO: "border-[var(--tomato)] text-[var(--tomato-dark)]",
  OKAY: "border-[var(--brass)] text-[var(--muted-ink)]",
  WANT: "border-[var(--herb)] text-[var(--herb-dark)]",
};

export function MealVoteSummary({
  currentUserId,
  votes,
}: {
  currentUserId?: string;
  votes: MealVoteWithUser[];
}) {
  const summary = summarizeVotes(votes, currentUserId);

  return (
    <div className="flex flex-wrap gap-2">
      {(["WANT", "OKAY", "NO"] as MealVoteValue[]).map((value) => (
        <span
          className={`border-l-2 bg-[rgba(255,253,245,0.5)] px-2 py-1 text-xs font-black uppercase tracking-[0.12em] ${voteStyles[value]}`}
          key={value}
        >
          {voteLabel(value)} {summary.counts[value]}
        </span>
      ))}
    </div>
  );
}

export function MealVotePanel({
  currentUserId,
  mealId,
  votes,
}: {
  currentUserId: string;
  mealId: string;
  votes: MealVoteWithUser[];
}) {
  const summary = summarizeVotes(votes, currentUserId);

  return (
    <div className="ka-panel">
      <h3 className="recipe-display text-2xl font-semibold text-[var(--ink)]">
        Family vote
      </h3>
      <MealVoteSummary currentUserId={currentUserId} votes={votes} />
      <form action={voteMealAction} className="mt-4 space-y-3">
        <input name="mealId" type="hidden" value={mealId} />
        <div className="grid gap-2 sm:grid-cols-3">
          {(["WANT", "OKAY", "NO"] as MealVoteValue[]).map((value) => (
            <label
              className="flex min-h-11 cursor-pointer items-center gap-2 border border-[var(--line)] bg-[rgba(255,253,245,0.42)] px-3 text-sm font-black text-[var(--ink)]"
              key={value}
            >
              <input
                className="size-4 accent-[var(--herb)]"
                defaultChecked={summary.currentUserVote?.vote === value}
                name="vote"
                required
                type="radio"
                value={value}
              />
              {voteLabel(value)}
            </label>
          ))}
        </div>
        <label className="block">
          <span className="ka-label">Comment</span>
          <textarea
            className="ka-textarea mt-1 min-h-20 text-sm"
            defaultValue={summary.currentUserVote?.comment ?? ""}
            name="comment"
            placeholder="Optional: why this does or does not sound good."
          />
        </label>
        <button className="ka-button w-full">
          Save vote
        </button>
      </form>
      {summary.comments.length ? (
        <div className="mt-5 divide-y divide-[var(--line)]">
          {summary.comments.map((comment) => (
            <div className="py-3 first:pt-0 last:pb-0" key={`${comment.label}-${comment.comment}`}>
              <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--herb-dark)]">
                {comment.label} / {voteLabel(comment.vote)}
              </div>
              <p className="mt-1 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
                {comment.comment}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
