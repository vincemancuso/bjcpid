import { classifyStyleTermSupport, classifyTextTermSupport, termVariants, type GuidelineTermSupport } from "../bjcp/qualifiedDescriptors";
import type { BjcpStyle } from "../bjcp/types";
import type { TastingProfile } from "../tasting/types";
import type { EvidenceItem, StyleMatch, StyleMatcher } from "./types";

const intensityRank = {
  "very-low": 0,
  low: 1,
  medium: 2,
  "medium-high": 3,
  high: 4
} as const;

const bodyRank = {
  light: 0,
  "medium-light": 1,
  medium: 2,
  "medium-full": 3,
  full: 4
} as const;

const colorToSrm = {
  straw: 3,
  gold: 5,
  amber: 10,
  copper: 14,
  brown: 22,
  black: 35,
  unusual: 0
} as const;

const scoringWeights = {
  color: {
    match: 16,
    near: 6,
    moderateConflict: -12,
    farConflict: -26,
    unsupportedUnusual: -18,
    specialtyUnusual: 12
  },
  descriptor: {
    required: 7,
    supported: 5,
    optional: 2,
    prohibited: -9,
    fermentationProhibited: -14,
    missingTypical: -2,
    fermentationMissingTypical: -5
  },
  structure: {
    rangeMatch: 9,
    rangeConflict: -8,
    numericSrmMatch: 12,
    numericSrmConflict: -18,
    bitternessConflict: -10,
    bodyConflict: -5,
    specialtyDeclared: 18,
    specialtyMissing: -18
  },
  scale: {
    exact: 7,
    adjacent: 3,
    twoStepsAway: -4,
    far: -8,
    optionalExact: 2,
    optionalAdjacent: 1,
    prohibited: -9
  },
  holistic: {
    missingRequiredHallmark: -18
  }
} as const;

const bitternessBands: Record<keyof typeof intensityRank, { min: number; max: number }> = {
  "very-low": { min: 0, max: 8 },
  low: { min: 8, max: 22 },
  medium: { min: 20, max: 40 },
  "medium-high": { min: 35, max: 60 },
  high: { min: 50, max: 100 }
};

const carbonationPhrases: Record<keyof typeof intensityRank, string[]> = {
  "very-low": ["very low carbonation", "flat"],
  low: ["low carbonation"],
  medium: ["medium carbonation", "moderate carbonation"],
  "medium-high": ["medium-high carbonation", "medium to medium-high carbonation"],
  high: ["high carbonation", "very high carbonation", "highly carbonated"]
};

const acidityPhrases: Record<keyof typeof intensityRank, string[]> = {
  "very-low": ["no sourness", "no acidity"],
  low: ["light tartness", "low acidity", "gentle fruitiness"],
  medium: ["sour", "sourness", "acidic", "tart", "lactic"],
  "medium-high": ["sharply sour", "crisp acidity", "medium-high acidity"],
  high: ["strong sourness", "sharp acidity", "very sour", "very high acidity"]
};

const bodyPhrases: Record<keyof typeof bodyRank, string[]> = {
  light: ["light body", "light to medium-low body"],
  "medium-light": ["medium-light body", "medium light body"],
  medium: ["medium body"],
  "medium-full": ["medium-full body", "medium full body"],
  full: ["full body"]
};

const sweetnessRank = {
  "very-dry": 0,
  dry: 1,
  balanced: 2,
  "semi-sweet": 3,
  sweet: 4
} as const;

const sweetnessPhrases: Record<keyof typeof sweetnessRank, string[]> = {
  "very-dry": ["very dry", "bone dry"],
  dry: ["dry", "crisp", "dry finish"],
  balanced: ["balanced", "balanced finish"],
  "semi-sweet": ["semi-sweet", "semi sweet"],
  sweet: ["sweet", "sweet finish", "residual sweetness", "noticeably sweet"]
};

const expectedDimensions = [
  "Color",
  "Clarity",
  "Bitterness",
  "Fermentation character",
  "Body",
  "Carbonation",
  "Sweetness/dryness",
  "Alcohol strength",
  "Malt character",
  "Hop character",
  "Acidity",
  "Roast intensity"
];

const hallmarkGroups = [
  { dimension: "Smoke/wood character", terms: ["smoke", "wood", "oak", "barrel"] },
  { dimension: "Sour/funky character", terms: ["lactic sour", "sour", "acidic", "tart", "acetic", "funky"] },
  { dimension: "Weizen fermentation", terms: ["banana", "clove"] },
  { dimension: "Belgian fermentation", terms: ["fruity esters", "peppery phenols", "belgian spice"] },
  { dimension: "Roast character", terms: ["roast", "coffee", "chocolate"] }
] as const;

function containsPositiveTerm(styleOrText: BjcpStyle | string, term: string): boolean {
  const support = typeof styleOrText === "string" ? classifyTextTermSupport(styleOrText, term) : classifyStyleTermSupport(styleOrText, term);
  return support !== "none" && support !== "prohibited";
}

function hasStyleTerm(style: BjcpStyle, term: string): boolean {
  return containsPositiveTerm(style, term);
}

function addMatch(items: EvidenceItem[], dimension: string, note: string): void {
  items.push({ dimension, note });
}

function addConflict(items: EvidenceItem[], dimension: string, note: string): void {
  items.push({ dimension, note });
}

function rangeContains(value: number | undefined, min?: number, max?: number): boolean | undefined {
  if (value === undefined || min === undefined || max === undefined) return undefined;
  return value >= min && value <= max;
}

function clamp(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function evidenceCount(profile: TastingProfile): number {
  const c = profile.categorical;
  return [
    profile.freeText || profile.aroma || profile.appearance || profile.flavor || profile.mouthfeel || profile.overall,
    c.color,
    c.clarity,
    c.bitterness,
    c.sweetness,
    c.body,
    c.carbonation,
    c.perceivedAlcohol,
    c.roastIntensity,
    c.acidity,
    c.hopCharacters?.length,
    c.maltCharacters?.length,
    c.fermentationCharacters?.length,
    profile.specialIngredients,
    profile.stats?.abv,
    profile.stats?.ibu,
    profile.stats?.srm
  ].filter(Boolean).length;
}

function profileTerms(profile: TastingProfile): string[] {
  const categorical = profile.categorical;
  return [
    ...profile.descriptors,
    categorical.color,
    categorical.clarity,
    categorical.bitterness,
    categorical.sweetness,
    categorical.body,
    categorical.carbonation,
    categorical.perceivedAlcohol,
    categorical.roastIntensity && categorical.roastIntensity !== "none" ? "roast" : undefined,
    categorical.acidity && categorical.acidity !== "very-low" ? "sour" : undefined,
    ...(categorical.hopCharacters ?? []),
    ...(categorical.maltCharacters ?? []),
    ...(categorical.fermentationCharacters ?? []),
    ...(categorical.faults ?? []),
    profile.specialIngredients
  ]
    .filter(Boolean)
    .map((term) => String(term).toLowerCase());
}

function profileHasAnyTerm(profile: TastingProfile, terms: readonly string[]): boolean {
  const observed = profileTerms(profile);
  return terms.some((term) =>
    termVariants(term).some((variant) =>
      observed.some((observedTerm) => observedTerm === variant || observedTerm.includes(variant) || variant.includes(observedTerm))
    )
  );
}

function missingEvidence(profile: TastingProfile): string[] {
  const c = profile.categorical;
  const missing = [
    !c.color && "Color",
    !c.clarity && "Clarity",
    !c.bitterness && "Bitterness",
    !c.fermentationCharacters?.length && "Fermentation character",
    !c.body && "Body",
    !c.carbonation && "Carbonation",
    !c.sweetness && "Sweetness/dryness",
    !c.perceivedAlcohol && !profile.stats?.abv && "Alcohol strength",
    !c.maltCharacters?.length && "Malt character",
    !c.hopCharacters?.length && "Hop character",
    !c.acidity && "Acidity",
    !c.roastIntensity && "Roast intensity"
  ].filter(Boolean) as string[];
  return missing.slice(0, 6);
}

function scoreRange(value: number | undefined, label: string, min: number | undefined, max: number | undefined, matched: EvidenceItem[], conflicts: EvidenceItem[]): number {
  const contained = rangeContains(value, min, max);
  if (contained === undefined) return 0;
  if (contained) {
    addMatch(matched, label, `${value} is within this style's guideline range.`);
    return label === "SRM" ? scoringWeights.structure.numericSrmMatch : scoringWeights.structure.rangeMatch;
  }
  addConflict(conflicts, label, `${value} is outside this style's guideline range.`);
  return label === "SRM" ? scoringWeights.structure.numericSrmConflict : scoringWeights.structure.rangeConflict;
}

function bestScaleSupport<T extends string>(style: BjcpStyle, phrasesByValue: Record<T, string[]>): Array<{ value: T; support: GuidelineTermSupport }> {
  return Object.entries(phrasesByValue).flatMap(([value, phrases]) => {
    const support = strongestTermSupport(style, phrases as string[]);
    return support === "none" ? [] : [{ value: value as T, support }];
  });
}

function scoreRankedScale<T extends string>(
  style: BjcpStyle,
  dimension: string,
  value: T | undefined,
  rank: Record<T, number>,
  phrasesByValue: Record<T, string[]>,
  matched: EvidenceItem[],
  conflicts: EvidenceItem[]
): number {
  if (!value) return 0;

  const styleValues = bestScaleSupport(style, phrasesByValue);
  const prohibited = styleValues.find((item) => item.value === value && item.support === "prohibited");
  if (prohibited) {
    addConflict(conflicts, dimension, `${value.replace("-", " ")} is specifically discouraged for this style.`);
    return scoringWeights.scale.prohibited;
  }

  const allowedValues = styleValues.filter((item) => item.support !== "prohibited");
  if (!allowedValues.length) return 0;

  const best = allowedValues
    .map((item) => ({
      ...item,
      distance: Math.abs(rank[value] - rank[item.value])
    }))
    .sort((a, b) => a.distance - b.distance)[0];

  const label = value.replace("-", " ");
  if (best.distance === 0) {
    if (best.support === "optional") {
      addMatch(matched, dimension, `${label} is allowed but optional for this style.`);
      return scoringWeights.scale.optionalExact;
    }
    addMatch(matched, dimension, `${label} aligns with this style.`);
    return scoringWeights.scale.exact;
  }
  if (best.distance === 1) {
    if (best.support === "optional") {
      addMatch(matched, dimension, `${label} is close to an optional ${dimension.toLowerCase()} expression for this style.`);
      return scoringWeights.scale.optionalAdjacent;
    }
    addMatch(matched, dimension, `${label} is close to this style's expected ${dimension.toLowerCase()}.`);
    return scoringWeights.scale.adjacent;
  }
  if (best.distance === 2) {
    addConflict(conflicts, dimension, `${label} is outside this style's usual ${dimension.toLowerCase()}.`);
    return scoringWeights.scale.twoStepsAway;
  }

  addConflict(conflicts, dimension, `${label} strongly conflicts with this style's usual ${dimension.toLowerCase()}.`);
  return scoringWeights.scale.far;
}

function scoreTextTerms(style: BjcpStyle, dimension: string, terms: string[] | undefined, matched: EvidenceItem[], conflicts: EvidenceItem[], conflictIfMissing = false): number {
  if (!terms?.length) return 0;
  let score = 0;
  for (const term of terms) {
    const support = classifyStyleTermSupport(style, term);
    if (support === "prohibited") {
      addConflict(conflicts, dimension, `${term} is specifically discouraged or absent in this style.`);
      score += dimension === "Fermentation character" ? scoringWeights.descriptor.fermentationProhibited : scoringWeights.descriptor.prohibited;
    } else if (support === "required") {
      addMatch(matched, dimension, `Notes include ${term}, which is expected for this style.`);
      score += scoringWeights.descriptor.required;
    } else if (support === "optional") {
      addMatch(matched, dimension, `Notes include ${term}, which is allowed but optional for this style.`);
      score += scoringWeights.descriptor.optional;
    } else if (support === "supported") {
      addMatch(matched, dimension, `Notes include ${term}, which appears compatible.`);
      score += scoringWeights.descriptor.supported;
    } else if (conflictIfMissing) {
      addConflict(conflicts, dimension, `${term} is not typical in the local profile for this style.`);
      score += dimension === "Fermentation character" ? scoringWeights.descriptor.fermentationMissingTypical : scoringWeights.descriptor.missingTypical;
    }
  }
  return score;
}

function scoreColor(style: BjcpStyle, profile: TastingProfile, matched: EvidenceItem[], conflicts: EvidenceItem[]): number {
  const color = profile.categorical.color;
  if (!color) return 0;
  if (color === "unusual") {
    if (style.isSpecialty) {
      addMatch(matched, "Color", "Unusual color points toward a declared specialty category.");
      return scoringWeights.color.specialtyUnusual;
    }
    addConflict(conflicts, "Color", "Unusual color usually needs a specialty declaration.");
    return scoringWeights.color.unsupportedUnusual;
  }
  const srm = profile.stats?.srm ?? colorToSrm[color];
  const min = style.stats?.srm?.min;
  const max = style.stats?.srm?.max;
  const inRange = rangeContains(srm, min, max);
  if (inRange) {
    addMatch(matched, "Color", `${color} appears compatible with this style.`);
    return scoringWeights.color.match;
  }
  if (min === undefined || max === undefined) {
    if (hasStyleTerm(style, color)) {
      addMatch(matched, "Color", `${color} appears compatible with this style.`);
      return scoringWeights.color.near;
    }
    return 0;
  }

  const distance = srm < min ? min - srm : srm - max;
  if (distance <= 3) {
    addMatch(matched, "Color", `${color} is just outside this style's usual color range.`);
    return scoringWeights.color.near;
  }
  if (distance <= 8) {
    addConflict(conflicts, "Color", `${color} is outside this style's usual color range.`);
    return scoringWeights.color.moderateConflict;
  }

  addConflict(conflicts, "Color", `${color} strongly conflicts with this style's usual appearance.`);
  return style.isSpecialty ? Math.round(scoringWeights.color.farConflict / 2) : scoringWeights.color.farConflict;
}

function scoreBitterness(style: BjcpStyle, value: keyof typeof intensityRank | undefined, matched: EvidenceItem[], conflicts: EvidenceItem[]): number {
  if (!value || !style.stats?.ibu) return 0;
  const band = bitternessBands[value];
  const overlap = Math.max(0, Math.min(style.stats.ibu.max, band.max) - Math.max(style.stats.ibu.min, band.min));
  const coverage = overlap / (band.max - band.min);
  if (coverage >= 0.4) {
    addMatch(matched, "Bitterness", "Bitterness impression aligns with the guideline IBU range.");
    return 2 + Math.round(8 * coverage);
  }
  if (coverage > 0 || (value === "high" && style.stats.ibu.max >= 50)) {
    addMatch(matched, "Bitterness", "Bitterness impression is near the guideline IBU range.");
    return 3;
  }
  const distance = band.min > style.stats.ibu.max ? band.min - style.stats.ibu.max : style.stats.ibu.min - band.max;
  if (distance <= 8) {
    addConflict(conflicts, "Bitterness", "Bitterness impression is just outside the guideline IBU range.");
    return -4;
  }
  addConflict(conflicts, "Bitterness", "Bitterness impression strongly conflicts with the guideline IBU range.");
  return scoringWeights.structure.bitternessConflict;
}

function scoreIntensity(style: BjcpStyle, dimension: string, value: keyof typeof intensityRank | undefined, terms: string[], matched: EvidenceItem[], conflicts: EvidenceItem[]): number {
  if (!value) return 0;
  if (dimension === "Carbonation") {
    return scoreRankedScale(style, dimension, value, intensityRank, carbonationPhrases, matched, conflicts);
  }
  if (dimension === "Acidity") {
    return scoreRankedScale(style, dimension, value, intensityRank, acidityPhrases, matched, conflicts);
  }
  const support = strongestTermSupport(style, [...terms, value.replace("-", " ")]);
  if (support === "required" || support === "supported") {
    addMatch(matched, dimension, `${value.replace("-", " ")} is supported by the style profile.`);
    return 7;
  }
  if (support === "optional") {
    addMatch(matched, dimension, `${value.replace("-", " ")} is allowed but optional for this style.`);
    return 3;
  }
  return 0;
}

function strongestTermSupport(style: BjcpStyle, terms: string[]): GuidelineTermSupport {
  let best: GuidelineTermSupport = "none";
  for (const term of terms) {
    const support = classifyStyleTermSupport(style, term);
    if (support === "prohibited") return support;
    if (support === "required") best = "required";
    else if (support === "supported" && best !== "required") best = "supported";
    else if (support === "optional" && best === "none") best = "optional";
  }
  return best;
}

function scoreSweetness(style: BjcpStyle, profile: TastingProfile, matched: EvidenceItem[], conflicts: EvidenceItem[]): number {
  const value = profile.categorical.sweetness;
  if (!value) return 0;
  return scoreRankedScale(style, "Sweetness/dryness", value, sweetnessRank, sweetnessPhrases, matched, conflicts);
}

function scoreBody(style: BjcpStyle, profile: TastingProfile, matched: EvidenceItem[], conflicts: EvidenceItem[]): number {
  const value = profile.categorical.body;
  if (!value) return 0;
  return scoreRankedScale(style, "Body", value, bodyRank, bodyPhrases, matched, conflicts);
}

function scoreRequiredHallmarks(style: BjcpStyle, profile: TastingProfile, conflicts: EvidenceItem[]): number {
  if (evidenceCount(profile) < 4) return 0;
  let score = 0;

  for (const group of hallmarkGroups) {
    const styleRequiresGroup = group.terms.some((term) => classifyStyleTermSupport(style, term) === "required");
    if (!styleRequiresGroup || profileHasAnyTerm(profile, group.terms)) continue;

    addConflict(conflicts, group.dimension, `${style.name} depends on ${group.dimension.toLowerCase()}, but the notes do not mention it.`);
    score += scoringWeights.holistic.missingRequiredHallmark;
  }

  return score;
}

function supportScore(fitScore: number, completeness: number): number {
  const rawSupport = fitScore * (0.25 + 0.75 * (completeness / 100));
  if (completeness < 30) return Math.min(44, clamp(rawSupport));
  if (completeness < 45) return Math.min(64, clamp(rawSupport));
  return clamp(rawSupport);
}

function confidenceLabel(support: number): StyleMatch["confidenceLabel"] {
  if (support >= 70) return "strong";
  if (support >= 45) return "moderate";
  return "low";
}

function compareTop(matches: StyleMatch[]): StyleMatch[] {
  return matches.map((match, index) => {
    const other = matches[index === 0 ? 1 : 0];
    if (!other) return match;
    const shared = match.matchedEvidence
      .map((evidence) => evidence.dimension)
      .filter((dimension) => other.matchedEvidence.some((item) => item.dimension === dimension));
    return {
      ...match,
      sharedEvidence: [...new Set(shared)].slice(0, 4),
      keyDifferences: match.matchedEvidence
        .filter((evidence) => !other.matchedEvidence.some((item) => item.dimension === evidence.dimension))
        .map((evidence) => evidence.dimension)
        .slice(0, 3),
      rationale: match.fitScore >= other.fitScore ? "Ranked higher due to more matching evidence and fewer conflicts." : "Close candidate, but another style matched more supplied evidence."
    };
  });
}

export class DeterministicStyleMatcher implements StyleMatcher {
  match(profile: TastingProfile, styles: BjcpStyle[]): StyleMatch[] {
    const completeness = clamp((evidenceCount(profile) / 12) * 100);
    const missing = missingEvidence(profile);

    const matches = styles.map((style) => {
      const matchedEvidence: EvidenceItem[] = [];
      const conflictingEvidence: EvidenceItem[] = [];
      let score = 35;

      score += scoreColor(style, profile, matchedEvidence, conflictingEvidence);
      if (profile.categorical.clarity && hasStyleTerm(style, profile.categorical.clarity)) {
        addMatch(matchedEvidence, "Clarity", `${profile.categorical.clarity} matches the appearance profile.`);
        score += 5;
      }
      score += scoreBitterness(style, profile.categorical.bitterness, matchedEvidence, conflictingEvidence);
      score += scoreIntensity(style, "Carbonation", profile.categorical.carbonation, ["carbonation", "spritzy", "lively"], matchedEvidence, conflictingEvidence);
      score += scoreIntensity(style, "Acidity", profile.categorical.acidity, ["sour", "acidic", "lactic", "tart"], matchedEvidence, conflictingEvidence);
      score += scoreBody(style, profile, matchedEvidence, conflictingEvidence);
      score += scoreSweetness(style, profile, matchedEvidence, conflictingEvidence);
      score += scoreTextTerms(style, "Hop character", profile.categorical.hopCharacters, matchedEvidence, conflictingEvidence, true);
      score += scoreTextTerms(style, "Malt character", profile.categorical.maltCharacters, matchedEvidence, conflictingEvidence);
      score += scoreTextTerms(style, "Fermentation character", profile.categorical.fermentationCharacters, matchedEvidence, conflictingEvidence, true);
      score += scoreRequiredHallmarks(style, profile, conflictingEvidence);
      score += scoreRange(profile.stats?.abv, "ABV", style.stats?.abv?.min, style.stats?.abv?.max, matchedEvidence, conflictingEvidence);
      score += scoreRange(profile.stats?.ibu, "IBU", style.stats?.ibu?.min, style.stats?.ibu?.max, matchedEvidence, conflictingEvidence);
      score += scoreRange(profile.stats?.srm, "SRM", style.stats?.srm?.min, style.stats?.srm?.max, matchedEvidence, conflictingEvidence);

      if (profile.categorical.faults?.length) {
        for (const fault of profile.categorical.faults) {
          if (hasStyleTerm(style, fault)) score += 2;
          else {
            addConflict(conflictingEvidence, "Faults", `${fault} usually reduces style fit.`);
            score -= 5;
          }
        }
      }

      let specialtyNotice: string | undefined;
      if (style.isSpecialty) {
        specialtyNotice = profile.specialIngredients
          ? `Possible specialty category with declared ingredient: ${profile.specialIngredients}.`
          : "Possible specialty category. Missing required fruit/special ingredient and base style declaration.";
        if (profile.specialIngredients) score += scoringWeights.structure.specialtyDeclared;
        else score += scoringWeights.structure.specialtyMissing;
      } else if (profile.specialIngredients || profile.categorical.unusualColor) {
        score -= 14;
      }

      const fitScore = clamp(score);
      const support = supportScore(fitScore, completeness);

      return {
        styleId: style.id,
        styleName: style.name,
        categoryName: style.categoryName,
        rank: 0,
        fitScore,
        supportScore: support,
        evidenceCompleteness: completeness,
        confidenceLabel: confidenceLabel(support),
        matchedEvidence: matchedEvidence.slice(0, 8),
        conflictingEvidence: conflictingEvidence.slice(0, 5),
        missingEvidence: missing,
        specialtyNotice
      };
    });

    return compareTop(
      matches
        .sort((a, b) => b.supportScore - a.supportScore || b.fitScore - a.fitScore || a.styleId.localeCompare(b.styleId))
        .slice(0, 5)
        .map((match, index) => ({ ...match, rank: index + 1 }))
    );
  }
}
