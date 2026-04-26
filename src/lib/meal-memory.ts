import type {
  MealFeedbackStatus,
  MealOutcomeStatus,
  MealVoteValue,
} from "@prisma/client";

export type MealMemoryVote = {
  comment: string | null;
  user: {
    email: string;
    name: string | null;
  };
  userId: string;
  vote: MealVoteValue;
};

export type MealMemoryMeal = {
  actualCostCents: number | null;
  costEstimateCents: number | null;
  cuisine: string | null;
  date: string;
  feedbackReason: string | null;
  feedbackStatus: MealFeedbackStatus;
  feedbackTweaks: string | null;
  id: string;
  leftoverNotes: string | null;
  name: string;
  outcomeNotes: string | null;
  outcomeStatus: MealOutcomeStatus;
  votes: MealMemoryVote[];
  weekId: string;
};

export type MealMemoryRejectedMeal = {
  active: boolean;
  mealName: string;
  patternToAvoid: string;
  reason: string;
  rejectedAt: string;
};

export type MealMemoryInput = {
  meals: MealMemoryMeal[];
  rejectedMeals: MealMemoryRejectedMeal[];
};

export type MealMemoryStats = {
  activeRejectedPatterns: number;
  actualCostCents: number | null;
  cookedDinners: number;
  leftoverDinners: number;
  likedMeals: number;
  mealsReviewed: number;
  noVotes: number;
  replacedDinners: number;
  skippedDinners: number;
  totalVotes: number;
  unclosedDinners: number;
  wantVotes: number;
};

export type MealMemoryVoteCounts = {
  noVotes: number;
  okayVotes: number;
  wantVotes: number;
};

export type MealMemoryTopWantedMeal = MealMemoryVoteCounts & {
  commentCount: number;
  costEstimateCents: number | null;
  cuisine: string | null;
  lastServedDate: string;
  mealId: string;
  mealName: string;
  score: number;
  weekId: string;
};

export type MealMemoryRepeatCandidate = MealMemoryVoteCounts & {
  lastServedDate: string;
  mealId: string;
  mealName: string;
  reason: string;
  score: number;
  weekId: string;
};

export type MealMemoryAvoidSignal = {
  lastServedDate: string | null;
  mealId: string | null;
  mealName: string;
  patternToAvoid: string | null;
  reason: string;
  source: "feedback" | "rejected-pattern" | "vote";
  strength: number;
};

export type MealMemoryMemberPattern = {
  comments: number;
  label: string;
  no: number;
  okay: number;
  total: number;
  want: number;
};

export type MealMemoryCommentTheme = {
  commentCount: number;
  comments: Array<{
    label: string;
    mealName: string;
    text: string;
  }>;
  theme: string;
};

export type MealMemoryWorkedWellMeal = {
  feedbackReason: string | null;
  feedbackStatus: MealFeedbackStatus;
  feedbackTweaks: string | null;
  lastServedDate: string;
  mealId: string;
  mealName: string;
  weekId: string;
};

export type MealMemoryDashboard = {
  avoidSignals: MealMemoryAvoidSignal[];
  commentThemes: MealMemoryCommentTheme[];
  memberPatterns: MealMemoryMemberPattern[];
  repeatCandidates: MealMemoryRepeatCandidate[];
  stats: MealMemoryStats;
  topWantedMeals: MealMemoryTopWantedMeal[];
  workedWellMeals: MealMemoryWorkedWellMeal[];
};

function personLabel(person: { email: string; name: string | null }) {
  return person.name?.trim() || person.email;
}

function countVotes(votes: MealMemoryVote[]): MealMemoryVoteCounts {
  return {
    noVotes: votes.filter((vote) => vote.vote === "NO").length,
    okayVotes: votes.filter((vote) => vote.vote === "OKAY").length,
    wantVotes: votes.filter((vote) => vote.vote === "WANT").length,
  };
}

function voteNoun(count: number) {
  return count === 1 ? "vote" : "votes";
}

function familyMemberNoun(count: number) {
  return count === 1 ? "family member" : "family members";
}

function repeatReason(meal: MealMemoryMeal, counts: MealMemoryVoteCounts) {
  if (meal.feedbackStatus === "LIKED") {
    if (counts.wantVotes > 0) {
      return `Liked meal with ${counts.wantVotes} Want ${voteNoun(
        counts.wantVotes,
      )}.`;
    }

    return "Liked meal.";
  }

  if (meal.feedbackStatus === "WORKED_WITH_TWEAKS") {
    return counts.okayVotes > 0
      ? `Worked with tweaks and ${counts.okayVotes} Okay ${voteNoun(
          counts.okayVotes,
        )}.`
      : "Worked with tweaks recorded.";
  }

  return `Family showed interest with ${counts.wantVotes} Want ${voteNoun(
    counts.wantVotes,
  )}.`;
}

function buildTopWantedMeals(meals: MealMemoryMeal[]) {
  return meals
    .map((meal) => {
      const counts = countVotes(meal.votes);
      const commentCount = meal.votes.filter((vote) => vote.comment?.trim()).length;

      return {
        ...counts,
        commentCount,
        costEstimateCents: meal.costEstimateCents,
        cuisine: meal.cuisine,
        lastServedDate: meal.date,
        mealId: meal.id,
        mealName: meal.name,
        score: counts.wantVotes * 2 + counts.okayVotes - counts.noVotes * 2,
        weekId: meal.weekId,
      };
    })
    .filter((meal) => meal.wantVotes > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.wantVotes - left.wantVotes ||
        right.lastServedDate.localeCompare(left.lastServedDate) ||
        left.mealName.localeCompare(right.mealName),
    )
    .slice(0, 12);
}

function buildRepeatCandidates(meals: MealMemoryMeal[]) {
  return meals
    .map((meal) => {
      const counts = countVotes(meal.votes);
      const likedBonus = meal.feedbackStatus === "LIKED" ? 1 : 0;
      const tweakBonus = meal.feedbackStatus === "WORKED_WITH_TWEAKS" ? 1 : 0;
      const score =
        counts.wantVotes * 2 +
        counts.okayVotes +
        likedBonus +
        tweakBonus -
        counts.noVotes * 3;

      return {
        ...counts,
        lastServedDate: meal.date,
        mealId: meal.id,
        mealName: meal.name,
        reason: repeatReason(meal, counts),
        score,
        weekId: meal.weekId,
      };
    })
    .filter(
      (meal) =>
        meal.score > 0 &&
        (meal.wantVotes > meal.noVotes || meal.reason.startsWith("Liked meal")),
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.wantVotes - left.wantVotes ||
        right.lastServedDate.localeCompare(left.lastServedDate) ||
        left.mealName.localeCompare(right.mealName),
    )
    .slice(0, 12);
}

function buildAvoidSignals(input: MealMemoryInput) {
  const feedbackSignals = input.meals
    .filter((meal) => meal.feedbackStatus === "REJECTED")
    .map((meal) => ({
      lastServedDate: meal.date,
      mealId: meal.id,
      mealName: meal.name,
      patternToAvoid: null,
      reason: `Rejected meal feedback: ${
        meal.feedbackReason?.trim() || "No reason recorded."
      }`,
      source: "feedback" as const,
      strength: 3,
    }));
  const voteSignals = input.meals
    .map((meal) => ({
      counts: countVotes(meal.votes),
      meal,
    }))
    .filter(({ counts }) => counts.noVotes > 0)
    .map(({ counts, meal }) => ({
      lastServedDate: meal.date,
      mealId: meal.id,
      mealName: meal.name,
      patternToAvoid: null,
      reason: `${counts.noVotes} ${familyMemberNoun(counts.noVotes)} voted No.`,
      source: "vote" as const,
      strength: counts.noVotes,
    }));
  const rejectedPatternSignals = input.rejectedMeals
    .filter((meal) => meal.active)
    .map((meal) => ({
      lastServedDate: meal.rejectedAt,
      mealId: null,
      mealName: meal.mealName,
      patternToAvoid: meal.patternToAvoid,
      reason: meal.reason,
      source: "rejected-pattern" as const,
      strength: 4,
    }));

  return [...feedbackSignals, ...voteSignals, ...rejectedPatternSignals]
    .sort(
      (left, right) =>
        right.strength - left.strength ||
        (right.lastServedDate ?? "").localeCompare(left.lastServedDate ?? "") ||
        left.mealName.localeCompare(right.mealName),
    )
    .slice(0, 18);
}

function buildMemberPatterns(meals: MealMemoryMeal[]) {
  const patterns = new Map<string, MealMemoryMemberPattern>();

  for (const meal of meals) {
    for (const vote of meal.votes) {
      const label = personLabel(vote.user);
      const current =
        patterns.get(label) ??
        ({
          comments: 0,
          label,
          no: 0,
          okay: 0,
          total: 0,
          want: 0,
        } satisfies MealMemoryMemberPattern);

      current.total += 1;
      current.comments += vote.comment?.trim() ? 1 : 0;

      if (vote.vote === "WANT") {
        current.want += 1;
      } else if (vote.vote === "OKAY") {
        current.okay += 1;
      } else {
        current.no += 1;
      }

      patterns.set(label, current);
    }
  }

  return Array.from(patterns.values()).sort(
    (left, right) => left.label.localeCompare(right.label) || right.total - left.total,
  );
}

function classifyTheme(text: string) {
  const normalized = text.toLowerCase();

  if (/\b(kid|kids|child|children|toddler)\b/.test(normalized)) {
    return "Kid Fit";
  }

  if (/\b(bring|repeat|again|back|favorite|liked|cleaned|hit)\b/.test(normalized)) {
    return "Repeat";
  }

  if (/\b(rich|heavy|cream|creamy)\b/.test(normalized)) {
    return "Too Rich";
  }

  if (/\b(sauce|seasoning|spice|spicy|salt|flavor)\b/.test(normalized)) {
    return "Seasoning";
  }

  if (/\b(easy|quick|fast|weeknight|prep)\b/.test(normalized)) {
    return "Weeknight Fit";
  }

  return "Other";
}

function addCommentTheme(
  themes: Map<string, MealMemoryCommentTheme>,
  theme: string,
  comment: {
    label: string;
    mealName: string;
    text: string;
  },
) {
  const current =
    themes.get(theme) ??
    ({
      commentCount: 0,
      comments: [],
      theme,
    } satisfies MealMemoryCommentTheme);

  current.commentCount += 1;
  current.comments.push(comment);
  themes.set(theme, current);
}

function buildCommentThemes(meals: MealMemoryMeal[]) {
  const themes = new Map<string, MealMemoryCommentTheme>();

  for (const meal of meals) {
    for (const vote of meal.votes) {
      const comment = vote.comment?.trim();

      if (!comment) {
        continue;
      }

      addCommentTheme(themes, classifyTheme(comment), {
        label: personLabel(vote.user),
        mealName: meal.name,
        text: comment,
      });
    }

    for (const feedbackText of [
      meal.feedbackReason,
      meal.feedbackTweaks,
      meal.outcomeNotes,
      meal.leftoverNotes,
    ]) {
      const text = feedbackText?.trim();

      if (!text) {
        continue;
      }

      addCommentTheme(themes, classifyTheme(text), {
        label: "Feedback",
        mealName: meal.name,
        text,
      });
    }
  }

  return Array.from(themes.values())
    .sort(
      (left, right) =>
        right.commentCount - left.commentCount || left.theme.localeCompare(right.theme),
    )
    .slice(0, 8);
}

function buildWorkedWellMeals(meals: MealMemoryMeal[]) {
  return meals
    .filter((meal) =>
      ["LIKED", "WORKED_WITH_TWEAKS"].includes(meal.feedbackStatus),
    )
    .sort(
      (left, right) =>
        right.date.localeCompare(left.date) || left.name.localeCompare(right.name),
    )
    .slice(0, 12)
    .map((meal) => ({
      feedbackReason: meal.feedbackReason,
      feedbackStatus: meal.feedbackStatus,
      feedbackTweaks: meal.feedbackTweaks,
      lastServedDate: meal.date,
      mealId: meal.id,
      mealName: meal.name,
      weekId: meal.weekId,
    }));
}

export function buildMealMemoryDashboard(
  input: MealMemoryInput,
): MealMemoryDashboard {
  const votes = input.meals.flatMap((meal) => meal.votes);
  const actualCosts = input.meals
    .map((meal) => meal.actualCostCents)
    .filter((value): value is number => typeof value === "number");

  return {
    avoidSignals: buildAvoidSignals(input),
    commentThemes: buildCommentThemes(input.meals),
    memberPatterns: buildMemberPatterns(input.meals),
    repeatCandidates: buildRepeatCandidates(input.meals),
    stats: {
      activeRejectedPatterns: input.rejectedMeals.filter((meal) => meal.active).length,
      actualCostCents: actualCosts.length
        ? actualCosts.reduce((total, cost) => total + cost, 0)
        : null,
      cookedDinners: input.meals.filter((meal) => meal.outcomeStatus === "COOKED")
        .length,
      leftoverDinners: input.meals.filter(
        (meal) => meal.outcomeStatus === "LEFTOVERS",
      ).length,
      likedMeals: input.meals.filter((meal) => meal.feedbackStatus === "LIKED")
        .length,
      mealsReviewed: input.meals.length,
      noVotes: votes.filter((vote) => vote.vote === "NO").length,
      replacedDinners: input.meals.filter(
        (meal) => meal.outcomeStatus === "REPLACED",
      ).length,
      skippedDinners: input.meals.filter((meal) => meal.outcomeStatus === "SKIPPED")
        .length,
      totalVotes: votes.length,
      unclosedDinners: input.meals.filter((meal) => meal.outcomeStatus === "PLANNED")
        .length,
      wantVotes: votes.filter((vote) => vote.vote === "WANT").length,
    },
    topWantedMeals: buildTopWantedMeals(input.meals),
    workedWellMeals: buildWorkedWellMeals(input.meals),
  };
}
