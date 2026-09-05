import type { BjcpStyle } from "../bjcp/types";
import type { TastingProfile } from "../tasting/types";

export type ConfidenceLabel = "low" | "moderate" | "strong";
export type EvidenceKind = "matched" | "conflict" | "missing";

export interface EvidenceItem {
  dimension: string;
  note: string;
}

export interface StyleMatch {
  styleId: string;
  styleName: string;
  categoryName: string;
  rank: number;
  fitScore: number;
  supportScore: number;
  evidenceCompleteness: number;
  confidenceLabel: ConfidenceLabel;
  matchedEvidence: EvidenceItem[];
  conflictingEvidence: EvidenceItem[];
  missingEvidence: string[];
  specialtyNotice?: string;
  sharedEvidence?: string[];
  keyDifferences?: string[];
  rationale?: string;
}

export interface StyleMatcher {
  match(profile: TastingProfile, styles: BjcpStyle[]): StyleMatch[];
}
