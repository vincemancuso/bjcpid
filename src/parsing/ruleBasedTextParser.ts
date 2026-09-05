import {
  emptyProfile,
  type BodyDescriptor,
  type ClarityDescriptor,
  type ColorDescriptor,
  type Intensity3,
  type Intensity4,
  type Intensity5,
  type SweetnessDescriptor,
  type TastingProfile,
  type TastingProfileParser
} from "../domain/tasting/types";
import { descriptorTerms, faultTerms, fermentationCharacterTerms, hopCharacterTerms, maltCharacterTerms, normalizeCharacterTerm } from "../domain/bjcp/sensoryDescriptors";

type TextSectionKey = "aroma" | "appearance" | "flavor" | "mouthfeel" | "overall";

const sectionMap: Record<string, TextSectionKey> = {
  aroma: "aroma",
  nose: "aroma",
  appearance: "appearance",
  look: "appearance",
  flavor: "flavor",
  taste: "flavor",
  mouthfeel: "mouthfeel",
  palate: "mouthfeel",
  overall: "overall",
  impression: "overall"
};

const colorTerms: Record<ColorDescriptor, string[]> = {
  straw: ["straw", "pale yellow"],
  gold: ["gold", "golden", "yellow"],
  amber: ["amber"],
  copper: ["copper"],
  brown: ["brown"],
  black: ["black", "dark", "stout"],
  unusual: ["pink", "red", "purple", "green", "fruit-colored", "unusual color"]
};

const clarityTerms: Record<ClarityDescriptor, string[]> = {
  brilliant: ["brilliant"],
  clear: ["clear"],
  "slight-haze": ["slight haze", "slightly hazy"],
  hazy: ["hazy", "cloudy"],
  opaque: ["opaque"]
};

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function firstKey<T extends string>(text: string, dictionary: Record<T, string[]>): T | undefined {
  return (Object.keys(dictionary) as T[]).find((key) => includesAny(text, dictionary[key]));
}

function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

export function parseSectionedText(input: string): Partial<Pick<TastingProfile, TextSectionKey>> {
  const parsed: Partial<Pick<TastingProfile, TextSectionKey>> = {};
  const matches = [...input.matchAll(/(?:^|\n)\s*([A-Za-z ]{3,24}):\s*/g)];
  matches.forEach((match, index) => {
    const label = match[1].trim().toLowerCase();
    const key = sectionMap[label];
    if (!key) return;
    const start = match.index! + match[0].length;
    const end = matches[index + 1]?.index ?? input.length;
    parsed[key] = input.slice(start, end).trim();
  });
  return parsed;
}

function inferSections(input: string, profile: TastingProfile): void {
  const sentences = input.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (!profile.appearance && includesAny(lower, ["gold", "amber", "black", "clear", "hazy", "head", "color", "opaque"])) profile.appearance = sentence;
    if (!profile.aroma && includesAny(lower, ["smell", "aroma", "nose", "citrus", "floral", "banana", "clove", "coffee", "smoke", "smoky", "wood", "oak"])) profile.aroma = sentence;
    if (!profile.flavor && includesAny(lower, ["taste", "flavor", "bitter", "sweet", "dry", "sour", "finish"])) profile.flavor = sentence;
    if (!profile.mouthfeel && includesAny(lower, ["body", "carbonation", "creamy", "lively", "warming"])) profile.mouthfeel = sentence;
  }
}

function extractNegations(text: string): string[] {
  const negated: string[] = [];
  for (const term of descriptorTerms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b(no|not|without)\\s+(?:\\w+\\s+){0,2}${escaped}\\b`, "i").test(text)) negated.push(term);
  }
  return uniq(negated);
}

export function normalizeCategorical(text: string): TastingProfile["categorical"] {
  const lower = text.toLowerCase();
  const negated = extractNegations(lower);
  const categorical: TastingProfile["categorical"] = {};
  categorical.color = firstKey(lower, colorTerms);
  categorical.unusualColor = categorical.color === "unusual";
  categorical.clarity = firstKey(lower, clarityTerms);

  const bitterness: Array<[Intensity5, string[]]> = [
    ["medium-high", ["medium-high bitterness", "firm bitterness", "assertive bitterness"]],
    ["very-low", ["no bitterness", "very low bitterness", "minimal bitterness", "undetectable bitterness"]],
    ["high", ["high bitterness", "very bitter", "intensely bitter"]],
    ["medium", ["medium bitterness", "moderate bitterness", "moderately bitter"]],
    ["low", ["low bitterness", "light bitterness"]]
  ];
  const sweetness: Array<[SweetnessDescriptor, string[]]> = [
    ["very-dry", ["very dry", "bone dry"]],
    ["dry", ["dry", "crisp"]],
    ["semi-sweet", ["semi-sweet", "semi sweet"]],
    ["sweet", ["sweet finish", "residual sweetness", "noticeably sweet", "syrupy"]],
    ["balanced", ["balanced"]]
  ];
  const body: Array<[BodyDescriptor, string[]]> = [
    ["medium-full", ["medium-full body"]],
    ["medium-light", ["medium-light body"]],
    ["full", ["full body"]],
    ["medium", ["medium body"]],
    ["light", ["light body"]]
  ];
  const carbonation: Array<[Intensity5, string[]]> = [
    ["high", ["high carbonation", "lively carbonation", "spritzy"]],
    ["medium-high", ["medium-high carbonation"]],
    ["medium", ["moderate carbonation", "medium carbonation"]],
    ["low", ["low carbonation"]],
    ["very-low", ["flat", "very low carbonation"]]
  ];
  const alcohol: Array<[Intensity3, string[]]> = [
    ["high", ["hot alcohol", "boozy", "strong alcohol"]],
    ["medium", ["warming", "moderate alcohol", "soft alcohol"]],
    ["low", ["no alcohol", "low alcohol"]]
  ];
  const roast: Array<[Intensity4, string[]]> = [
    ["high", ["burnt", "intense roast"]],
    ["medium", ["roasty", "roast", "coffee", "chocolate"]],
    ["low", ["light roast"]],
    ["none", ["not roasty", "no roast"]]
  ];
  const acidity: Array<[Intensity5, string[]]> = [
    ["high", ["very sour", "sharp acidity", "high acidity"]],
    ["medium-high", ["medium-high acidity"]],
    ["medium", ["sour", "acidic", "tart", "lactic"]],
    ["low", ["light tartness", "low acidity"]],
    ["very-low", ["no sourness", "without sourness"]]
  ];

  const pick = <T extends string>(sets: Array<[T, string[]]>): T | undefined => sets.find(([, terms]) => includesAny(lower, terms))?.[0];
  categorical.bitterness = pick(bitterness);
  categorical.sweetness = pick(sweetness);
  categorical.body = pick(body);
  categorical.carbonation = pick(carbonation);
  categorical.perceivedAlcohol = pick(alcohol);
  categorical.roastIntensity = pick(roast);
  categorical.acidity = pick(acidity);
  categorical.hopCharacters = uniq(hopCharacterTerms.filter((term) => lower.includes(term) && !negated.includes(term)).map(normalizeCharacterTerm));
  categorical.maltCharacters = uniq(
    maltCharacterTerms
      .filter((term) => lower.includes(term) && !negated.includes(term))
      .map(normalizeCharacterTerm)
  );
  categorical.fermentationCharacters = uniq(fermentationCharacterTerms.filter((term) => lower.includes(term) && !negated.includes(term)).map(normalizeCharacterTerm));
  categorical.faults = uniq(faultTerms.filter((term) => lower.includes(term) && !negated.includes(term)));
  return categorical;
}

export class RuleBasedTextParser implements TastingProfileParser {
  async parse(input: string): Promise<TastingProfile> {
    const profile = emptyProfile();
    profile.freeText = input;
    Object.assign(profile, parseSectionedText(input));
    inferSections(input, profile);
    const negated = extractNegations(input.toLowerCase());
    const categorical = normalizeCategorical(input);
    profile.negatedDescriptors = negated;
    profile.descriptors = uniq(descriptorTerms.filter((term) => input.toLowerCase().includes(term) && !negated.includes(term)));
    profile.categorical = categorical;
    return profile;
  }
}
