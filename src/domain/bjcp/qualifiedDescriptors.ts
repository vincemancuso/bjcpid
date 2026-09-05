import type { BjcpDescriptorQualifier, BjcpQualifiedDescriptor, BjcpStyle, BjcpStyleSectionKey } from "./types";
import { guidelineDescriptorTerms, termAliases } from "./sensoryDescriptors";

export type GuidelineTermSupport = "none" | BjcpDescriptorQualifier;

const sectionKeys: BjcpStyleSectionKey[] = ["overall", "aroma", "appearance", "flavor", "mouthfeel", "characteristicIngredients"];

export function styleText(style: BjcpStyle): string {
  return [
    style.name,
    style.categoryName,
    style.sections.overall,
    style.sections.aroma,
    style.sections.appearance,
    style.sections.flavor,
    style.sections.mouthfeel,
    style.sections.characteristicIngredients,
    style.tags?.join(" ")
  ]
    .join(" ")
    .toLowerCase();
}

export function termVariants(term: string): string[] {
  return termAliases[term.toLowerCase()] ?? [term];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termPattern(term: string): RegExp {
  return new RegExp(`(?<![a-z])${escapeRegex(term).replace(/\s+/g, "\\s+")}(?![a-z])`, "i");
}

function splitGuidelineContext(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|;\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function matchingContexts(text: string, term: string): string[] {
  const lower = text.toLowerCase();
  return termVariants(term).flatMap((variant) => splitGuidelineContext(lower).filter((context) => termPattern(variant).test(context)));
}

function matchingContextsForVariant(text: string, variant: string): string[] {
  return splitGuidelineContext(text.toLowerCase()).filter((context) => termPattern(variant).test(context));
}

function isProhibitedMention(context: string, term: string): boolean {
  const escaped = escapeRegex(term);
  return [
    new RegExp(`\\b(?:no|not|never|without|absent)\\b[\\w\\W]{0,54}\\b${escaped}\\b`, "i"),
    new RegExp(`\\b${escaped}\\b[\\w\\W]{0,54}\\b(?:is|are|seems?|be|being|become|becomes|taste|tastes)?\\s*(?:not acceptable|unacceptable|inappropriate|undesirable|a fault|faults|not allowed|should not|must not|never)\\b`, "i"),
    new RegExp(`\\b${escaped}\\b[\\w\\W]{0,54}\\bshould\\s+never\\b`, "i"),
    new RegExp(`\\b${escaped}\\b[\\w\\W]{0,54}\\b(?:low to none|none)\\b`, "i")
  ].some((pattern) => pattern.test(context));
}

function isOptionalMention(context: string, term: string): boolean {
  const escaped = escapeRegex(term);
  return [
    new RegExp(`\\b${escaped}\\b[\\w\\W]{0,54}\\b(?:optional|acceptable|allowable|allowed|may|might|can|could|occasionally|sometimes)\\b`, "i"),
    new RegExp(`\\b(?:optional|acceptable|allowable|allowed|may|might|can|could|occasionally|sometimes)\\b[\\w\\W]{0,54}\\b${escaped}\\b`, "i"),
    new RegExp(`\\b(?:if present|need not be present|not a fault)\\b[\\w\\W]{0,54}\\b${escaped}\\b`, "i"),
    new RegExp(`\\b${escaped}\\b[\\w\\W]{0,54}\\b(?:if present|need not be present|not a fault)\\b`, "i")
  ].some((pattern) => pattern.test(context));
}

function isRequiredMention(context: string, term: string): boolean {
  const escaped = escapeRegex(term);
  return [
    new RegExp(`\\b${escaped}\\b[\\w\\W]{0,54}\\b(?:required|must|expected|desirable|usually|typical(?:ly)?|common(?:ly)?|prominent|noticeable|apparent)\\b`, "i"),
    new RegExp(`\\b(?:required|must|expected|desirable|usually|typical(?:ly)?|common(?:ly)?|prominent|noticeable|apparent)\\b[\\w\\W]{0,54}\\b${escaped}\\b`, "i")
  ].some((pattern) => pattern.test(context));
}

export function classifyTextTermSupport(text: string, term: string): GuidelineTermSupport {
  let best: GuidelineTermSupport = "none";

  for (const variant of termVariants(term)) {
    for (const context of matchingContextsForVariant(text, variant)) {
      if (isProhibitedMention(context, variant)) return "prohibited";
      if (isOptionalMention(context, variant)) {
        if (best === "none") best = "optional";
        continue;
      }
      if (isRequiredMention(context, variant)) best = best === "none" || best === "optional" ? "required" : best;
      else if (best === "none") best = "supported";
    }
  }

  return best;
}

function strongestSupport(values: GuidelineTermSupport[]): GuidelineTermSupport {
  if (values.includes("prohibited")) return "prohibited";
  if (values.includes("required")) return "required";
  if (values.includes("supported")) return "supported";
  if (values.includes("optional")) return "optional";
  return "none";
}

function termsOverlap(left: string, right: string): boolean {
  const leftVariants = new Set(termVariants(left).map((term) => term.toLowerCase()));
  const rightVariants = new Set(termVariants(right).map((term) => term.toLowerCase()));
  return [...leftVariants].some((term) => rightVariants.has(term));
}

export function classifyStyleTermSupport(style: BjcpStyle, term: string): GuidelineTermSupport {
  if (style.qualifiedDescriptors?.length) {
    const qualifiers = style.qualifiedDescriptors.filter((descriptor) => termsOverlap(descriptor.term, term)).map((descriptor) => descriptor.qualifier);
    const support = strongestSupport(qualifiers);
    if (support !== "none") return support;
  }

  return classifyTextTermSupport(styleText(style), term);
}

export function extractQualifiedDescriptors(style: BjcpStyle): BjcpQualifiedDescriptor[] {
  const descriptors: BjcpQualifiedDescriptor[] = [];

  for (const section of sectionKeys) {
    const text = style.sections[section];
    if (!text) continue;

    for (const term of guidelineDescriptorTerms) {
      const qualifier = classifyTextTermSupport(text, term);
      if (qualifier === "none") continue;
      const evidence = matchingContexts(text, term)[0];
      if (!evidence) continue;
      descriptors.push({ term, qualifier, section, evidence });
    }
  }

  const seen = new Set<string>();
  return descriptors.filter((descriptor) => {
    const key = `${descriptor.section}:${descriptor.term}:${descriptor.qualifier}:${descriptor.evidence}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function withQualifiedDescriptors(style: BjcpStyle): BjcpStyle {
  return {
    ...style,
    qualifiedDescriptors: style.qualifiedDescriptors ?? extractQualifiedDescriptors(style)
  };
}
