import { DAN_LEVELS, DAN_ORDER, DanLevel } from "./validation";

export type TierCounts = { low: number; mid: number; high: number };
export type VoteDistribution = Record<string, TierCounts>;
export type RankConfidence = "baseline" | "low" | "rejected" | "pending";

export const CONFIDENCE_POLICY = {
  minimum_total_votes: 20,
  minimum_leader_votes: 12,
  minimum_leader_share: 0.6,
  minimum_leader_to_runner_up_ratio: 2,
} as const;

export interface ConfidenceAnalysis {
  active: boolean;
  baseline_rank: DanLevel | null;
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

  const ranks: Record<string, RankConfidence> = {};
  for (const rank of DAN_LEVELS) {
    if (!active) {
      ranks[rank] = "pending";
      continue;
    }
    const distance = Math.abs(DAN_ORDER[rank] - DAN_ORDER[leader.rank]);
    ranks[rank] = distance === 0 ? "baseline" : distance === 1 ? "low" : "rejected";
  }

  return {
    active,
    baseline_rank: active ? leader.rank : null,
    baseline_votes: active ? leader.count : 0,
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
  if (!confidence.active || !confidence.baseline_rank) return distribution;
  const baseline = distribution[confidence.baseline_rank];
  return baseline ? { [confidence.baseline_rank]: baseline } : {};
}
