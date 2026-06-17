// Dan level and tier enums for the voting system
// DDMythical Reform Dan 4K

export const DAN_LEVELS = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "α", "β", "γ", "δ", "ε", "ζ", "η",
] as const;

export type DanLevel = (typeof DAN_LEVELS)[number];

export const DAN_LABELS: Record<DanLevel, string> = {
  "1": "1st Dan",
  "2": "2nd Dan",
  "3": "3rd Dan",
  "4": "4th Dan",
  "5": "5th Dan",
  "6": "6th Dan",
  "7": "7th Dan",
  "8": "8th Dan",
  "9": "9th Dan",
  "10": "10th Dan",
  "α": "α",
  "β": "β",
  "γ": "γ",
  "δ": "δ",
  "ε": "ε",
  "ζ": "ζ (Emilk)",
  "η": "η (Thaumiel)",
};

export const TIERS = ["low", "mid", "high"] as const;
export type Tier = (typeof TIERS)[number];

export function isValidDanLevel(value: string): value is DanLevel {
  return DAN_LEVELS.includes(value as DanLevel);
}

export function isValidTier(value: string): value is Tier {
  return TIERS.includes(value as Tier);
}

// Display order for sorting dan levels
export const DAN_ORDER: Record<DanLevel, number> = {
  "1": 1, "2": 2, "3": 3, "4": 4, "5": 5,
  "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
  "α": 11, "β": 12, "γ": 13, "δ": 14, "ε": 15,
  "ζ": 16, "η": 17,
};
