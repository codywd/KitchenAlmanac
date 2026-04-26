import { describe, expect, it } from "vitest";

import { summarizeVotes, voteLabel, type MealVoteWithUser } from "./votes";

const votes: MealVoteWithUser[] = [
  {
    comment: "This sounds great.",
    user: {
      email: "one@example.local",
      name: "One",
    },
    userId: "user_1",
    vote: "WANT",
  },
  {
    comment: null,
    user: {
      email: "two@example.local",
      name: null,
    },
    userId: "user_2",
    vote: "OKAY",
  },
  {
    comment: "Too spicy.",
    user: {
      email: "three@example.local",
      name: "Three",
    },
    userId: "user_3",
    vote: "NO",
  },
];

describe("meal vote helpers", () => {
  it("summarizes family votes and tracks the current user vote", () => {
    const summary = summarizeVotes(votes, "user_3");

    expect(summary.counts).toEqual({
      NO: 1,
      OKAY: 1,
      WANT: 1,
    });
    expect(summary.total).toBe(3);
    expect(summary.currentUserVote?.vote).toBe("NO");
    expect(summary.comments).toEqual([
      {
        comment: "This sounds great.",
        label: "One",
        vote: "WANT",
      },
      {
        comment: "Too spicy.",
        label: "Three",
        vote: "NO",
      },
    ]);
  });

  it("formats vote labels for UI", () => {
    expect(voteLabel("WANT")).toBe("Want");
    expect(voteLabel("OKAY")).toBe("Okay");
    expect(voteLabel("NO")).toBe("No");
  });
});
