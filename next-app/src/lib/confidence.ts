import { DAN_LEVELS, DAN_ORDER, DanLevel } from "./validation";

export type TierCounts = { low: number; mid: number; high: number };
export type VoteDistribution = Record<string, TierCounts>;
export type ConfidenceStage = "empty" | "provisional" | "tied" | "established";
export type RankConfidence =
  | "baseline"
  | "low"
  | "rejected"
  | "provisional"
  | "tied"
  | "pending";

export const CONFIDENCE_POLICY = {
  minimum_total_votes: 20,
  minimum_leader_votes: 12,
  minimum_leader_share: 0.6,
  minimum_leader_to_runner_up_ratio: 2,
} as const;

export interface ConfidenceAnalysis {
  active: boolean;
  stage: ConfidenceStage;
  baseline_rank: DanLevel | null;
  leading_ranks: DanLevel[];
  baseline_votes: number;
  total_votes: number;
  leader_share: number;
  runner_up_votes: number;
  policy: typeof CONFIDENCE_POLICY;
  ranks: Record<string, RankConfidence>;
}

export function rankVoteCount(tiers: TierCounts | undefined): number {
  return tiers ? tiers.low + tiers.mid + tiers.high : 0;
}

export function buildDistribution(
  votes: Array<{ dan_level: string; tier: string }>
): VoteDistribution {
  const distribution: VoteDistribution = {};
  for (const vote of votes) {
    if (
      !Object.prototype.hasOwnProperty.call(DAN_ORDER, vote.dan_level) ||
      !["low", "mid", "high"].includes(vote.tier)
    ) {
      continue;
    }
    if (!distribution[vote.dan_level]) {
      distribution[vote.dan_level] = { low: 0, mid: 0, high: 0 };
    }
    distribution[vote.dan_level][vote.tier as keyof TierCounts]++;
  }
  return distribution;
}

export function analyzeConfidence(distribution: VoteDistribution): ConfidenceAnalysis {
  const ranked = DAN_LEVELS.map((rank) => ({
    rank,
    count: rankVoteCount(distribution[rank]),
  })).sort((a, b) => b.count - a.count || DAN_ORDER[a.rank] - DAN_ORDER[b.rank]);
  const leader = ranked[0];
  const runnerUp = ranked[1]?.count || 0;
  const totalVotes = ranked.reduce((sum, item) => sum + item.count, 0);
  const leaderShare = totalVotes > 0 ? leader.count / totalVotes : 0;
  const leadRatio = runnerUp > 0 ? leader.count / runnerUp : Infinity;
  const active =
    totalVotes >= CONFIDENCE_POLICY.minimum_total_votes &&
    leader.count >= CONFIDENCE_POLICY.minimum_leader_votes &&
    leaderShare >= CONFIDENCE_POLICY.minimum_leader_share &&
    leadRatio >= CONFIDENCE_POLICY.minimum_leader_to_runner_up_ratio;
  const leadingRanks = totalVotes > 0
    ? ranked.filter((item) => item.count === leader.count).map((item) => item.rank)
    : [];
  const stage: ConfidenceStage = active
    ? "established"
    : totalVotes === 0
      ? "empty"
      : leadingRanks.length === 1 ? "provisional" : "tied";

  const ranks: Record<string, RankConfidence> = {};
  for (const rank of DAN_LEVELS) {
    if (!active) {
      ranks[rank] = stage === "provisional" && leadingRanks[0] === rank
        ? "provisional"
        : stage === "tied" && leadingRanks.includes(rank)
          ? "tied"
          : "pending";
      continue;
    }
    const distance = Math.abs(DAN_ORDER[rank] - DAN_ORDER[leader.rank]);
    ranks[rank] = distance === 0 ? "baseline" : distance === 1 ? "low" : "rejected";
  }

  return {
    active,
    stage,
    baseline_rank: leadingRanks.length === 1 ? leader.rank : null,
    leading_ranks: leadingRanks,
    baseline_votes: leadingRanks.length === 1 ? leader.count : 0,
    total_votes: totalVotes,
    leader_share: leaderShare,
    runner_up_votes: runnerUp,
    policy: CONFIDENCE_POLICY,
    ranks,
  };
}

export function buildInGameDistribution(
  distribution: VoteDistribution,
  confidence: ConfidenceAnalysis
): VoteDistribution {
  if (confidence.stage === "empty") return {};
  const rendered: VoteDistribution = {};
  for (const rank of confidence.leading_ranks) {
    if (distribution[rank]) rendered[rank] = distribution[rank];
  }
  return rendered;
}
