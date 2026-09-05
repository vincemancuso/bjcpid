import { describe, expect, it } from "vitest";
import type { BjcpStyle } from "../src/domain/bjcp/types";
import { bjcpFullStyleGuidelines, bjcpStyles } from "../src/domain/bjcp/loadStyles";
import { DeterministicStyleMatcher } from "../src/domain/matching/deterministicMatcher";
import { RuleBasedTextParser } from "../src/parsing/ruleBasedTextParser";
import { sampleCorpus } from "./fixtures/sampleCorpus";

describe("BJCP style data", () => {
  it("loads local style data", () => {
    expect(bjcpStyles.length).toBe(116);
    expect(bjcpStyles.every((style) => style.id && style.name && style.categoryName)).toBe(true);
    expect(new Set(bjcpStyles.map((style) => style.categoryId)).size).toBe(34);
    expect(bjcpStyles.map((style) => style.id)).toContain("1A");
    expect(bjcpStyles.map((style) => style.id)).toContain("34C");
  });

  it("loads full guideline write-ups for every local style", () => {
    for (const style of bjcpStyles) {
      expect(bjcpFullStyleGuidelines[style.id]?.sections.overall).toBeTruthy();
      expect(bjcpFullStyleGuidelines[style.id]?.sections.flavor).toBeTruthy();
    }
  });

  it("enriches local styles with qualified descriptors", () => {
    const americanWheat = bjcpStyles.find((style) => style.id === "1D");
    expect(americanWheat?.qualifiedDescriptors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ term: "banana", qualifier: "prohibited" }),
        expect.objectContaining({ term: "fruity esters", qualifier: "optional" })
      ])
    );

    const grodziskie = bjcpStyles.find((style) => style.id === "27E");
    expect(grodziskie?.qualifiedDescriptors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ term: "smoke", qualifier: "required" }),
        expect.objectContaining({ term: "wood" })
      ])
    );

    const woodAged = bjcpStyles.find((style) => style.id === "33A");
    expect(woodAged?.qualifiedDescriptors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ term: "wood" }),
        expect.objectContaining({ term: "barrel" }),
        expect.objectContaining({ term: "vanilla" })
      ])
    );
  });
});

describe("DeterministicStyleMatcher", () => {
  it.each(sampleCorpus)("returns ranked candidates for $name", async (sample) => {
    const parser = new RuleBasedTextParser();
    const matcher = new DeterministicStyleMatcher();
    const profile = await parser.parse(sample.notes);
    profile.specialIngredients = sample.specialIngredients;
    profile.categorical = { ...profile.categorical, ...sample.categorical };
    const matches = matcher.match(profile, bjcpStyles);
    expect(matches).toHaveLength(5);
    expect(matches.map((match) => match.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(matches[0].supportScore).toBeGreaterThanOrEqual(matches[4].supportScore);
  });

  it("generates cautious confidence and missing evidence for sparse notes", async () => {
    const parser = new RuleBasedTextParser();
    const matcher = new DeterministicStyleMatcher();
    const profile = await parser.parse("It is golden.");
    const [top] = matcher.match(profile, bjcpStyles);
    expect(top.confidenceLabel).toBe("low");
    expect(top.supportScore).toBeLessThan(top.fitScore);
    expect(top.missingEvidence).toContain("Bitterness");
    expect(top.evidenceCompleteness).toBeLessThan(40);
  });

  it("labels specialty styles and penalizes missing declaration", async () => {
    const parser = new RuleBasedTextParser();
    const matcher = new DeterministicStyleMatcher();
    const profile = await parser.parse("Pink unusual beer with cherry fruit.");
    const matches = matcher.match(profile, bjcpStyles.filter((style) => style.id === "29A"));
    const fruit = matches.find((match) => match.styleId === "29A");
    expect(fruit?.specialtyNotice).toContain("Missing required");
  });

  it("does not over-rank English IPA for herbal-earthy aroma with banana and acetic fermentation", () => {
    const matcher = new DeterministicStyleMatcher();
    const matches = matcher.match(
      {
        descriptors: [],
        negatedDescriptors: [],
        categorical: {
          hopCharacters: ["herbal", "earthy", "pine"],
          fermentationCharacters: ["banana", "acetic"]
        }
      },
      bjcpStyles
    );
    expect(matches[0].styleId).not.toBe("12C");
    const englishIpa = matches.find((match) => match.styleId === "12C");
    if (englishIpa) {
      expect(englishIpa.conflictingEvidence.some((evidence) => evidence.note.includes("banana"))).toBe(true);
    }
  });

  it("treats optional guideline mentions as weaker support than expected traits", () => {
    const matcher = new DeterministicStyleMatcher();
    const styles: BjcpStyle[] = [
      {
        id: "X1",
        name: "Optional Citrus Beer",
        categoryId: "X",
        categoryName: "Test",
        sections: {
          aroma: "Light spicy, floral, or citrus hop aroma optional.",
          flavor: "Clean fermentation profile."
        }
      },
      {
        id: "X2",
        name: "Expected Citrus Beer",
        categoryId: "X",
        categoryName: "Test",
        sections: {
          aroma: "Citrus hop aroma is expected and prominent.",
          flavor: "Clean fermentation profile."
        }
      }
    ];

    const matches = matcher.match(
      {
        descriptors: [],
        negatedDescriptors: [],
        categorical: { hopCharacters: ["citrus"] }
      },
      styles
    );

    expect(matches[0].styleId).toBe("X2");
    expect(matches.find((match) => match.styleId === "X1")?.matchedEvidence[0]?.note).toContain("allowed but optional");
  });

  it("detects prohibited traits when the qualifier appears before or after the term", () => {
    const matcher = new DeterministicStyleMatcher();
    const styles: BjcpStyle[] = [
      {
        id: "X1",
        name: "No Banana Beer",
        categoryId: "X",
        categoryName: "Test",
        sections: {
          aroma: "Moderate esters optional, usually neutral. No banana.",
          flavor: "Clean fermentation profile."
        }
      },
      {
        id: "X2",
        name: "Inappropriate Banana Beer",
        categoryId: "X",
        categoryName: "Test",
        sections: {
          aroma: "Moderate esters optional; banana is inappropriate.",
          flavor: "Clean fermentation profile."
        }
      }
    ];

    const matches = matcher.match(
      {
        descriptors: [],
        negatedDescriptors: [],
        categorical: { fermentationCharacters: ["banana"] }
      },
      styles
    );

    expect(matches).toHaveLength(2);
    expect(matches.every((match) => match.conflictingEvidence.some((evidence) => evidence.note.includes("banana")))).toBe(true);
  });

  it("does not penalize a style when an optional trait is absent", () => {
    const matcher = new DeterministicStyleMatcher();
    const styles: BjcpStyle[] = [
      {
        id: "X1",
        name: "Optional Citrus Beer",
        categoryId: "X",
        categoryName: "Test",
        sections: {
          aroma: "Citrus hop aroma optional.",
          flavor: "Clean fermentation profile."
        },
        qualifiedDescriptors: [
          { term: "citrus", qualifier: "optional", section: "aroma", evidence: "citrus hop aroma optional." },
          { term: "clean", qualifier: "required", section: "flavor", evidence: "clean fermentation profile." }
        ]
      }
    ];

    const [match] = matcher.match(
      {
        descriptors: [],
        negatedDescriptors: [],
        categorical: { fermentationCharacters: ["clean"] }
      },
      styles
    );

    expect(match.matchedEvidence.some((evidence) => evidence.note.includes("clean"))).toBe(true);
    expect(match.conflictingEvidence.some((evidence) => evidence.note.includes("citrus"))).toBe(false);
  });

  it("uses color as a high-weight gate when descriptors point at a dark style", () => {
    const matcher = new DeterministicStyleMatcher();
    const styles: BjcpStyle[] = [
      {
        id: "X1",
        name: "Synthetic Stout",
        categoryId: "X",
        categoryName: "Test",
        sections: {
          appearance: "Black color. Opaque.",
          flavor: "Coffee, chocolate, and roast are expected."
        },
        stats: { srm: { min: 30, max: 40 } },
        qualifiedDescriptors: [
          { term: "coffee", qualifier: "required", section: "flavor", evidence: "coffee, chocolate, and roast are expected." },
          { term: "chocolate", qualifier: "required", section: "flavor", evidence: "coffee, chocolate, and roast are expected." },
          { term: "roast", qualifier: "required", section: "flavor", evidence: "coffee, chocolate, and roast are expected." }
        ]
      },
      {
        id: "X2",
        name: "Synthetic Pale Ale",
        categoryId: "X",
        categoryName: "Test",
        sections: {
          appearance: "Gold color. Clear.",
          flavor: "Clean fermentation profile with moderate bitterness."
        },
        stats: { srm: { min: 4, max: 8 } },
        qualifiedDescriptors: [{ term: "clean", qualifier: "supported", section: "flavor", evidence: "clean fermentation profile with moderate bitterness." }]
      }
    ];

    const matches = matcher.match(
      {
        descriptors: [],
        negatedDescriptors: [],
        categorical: {
          color: "gold",
          maltCharacters: ["coffee", "chocolate", "roast"],
          fermentationCharacters: ["clean"]
        }
      },
      styles
    );

    expect(matches[0].styleId).toBe("X2");
    expect(matches.find((match) => match.styleId === "X1")?.conflictingEvidence.some((evidence) => evidence.dimension === "Color")).toBe(true);
  });

  it("scores body by distance instead of all-or-nothing buckets", () => {
    const matcher = new DeterministicStyleMatcher();
    const styles: BjcpStyle[] = [
      {
        id: "X1",
        name: "Adjacent Body Beer",
        categoryId: "X",
        categoryName: "Test",
        sections: { mouthfeel: "Medium-full body." }
      },
      {
        id: "X2",
        name: "Far Body Beer",
        categoryId: "X",
        categoryName: "Test",
        sections: { mouthfeel: "Full body." }
      }
    ];

    const matches = matcher.match(
      {
        descriptors: [],
        negatedDescriptors: [],
        categorical: { body: "medium" }
      },
      styles
    );

    expect(matches[0].styleId).toBe("X1");
    expect(matches.find((match) => match.styleId === "X1")?.matchedEvidence.some((evidence) => evidence.note.includes("close"))).toBe(true);
    expect(matches.find((match) => match.styleId === "X2")?.conflictingEvidence.some((evidence) => evidence.dimension === "Body")).toBe(true);
  });

  it("scores carbonation and sweetness by scale distance", () => {
    const matcher = new DeterministicStyleMatcher();
    const styles: BjcpStyle[] = [
      {
        id: "X1",
        name: "Nearby Scale Beer",
        categoryId: "X",
        categoryName: "Test",
        sections: {
          flavor: "Dry finish.",
          mouthfeel: "Medium-high carbonation."
        }
      },
      {
        id: "X2",
        name: "Distant Scale Beer",
        categoryId: "X",
        categoryName: "Test",
        sections: {
          flavor: "Sweet finish.",
          mouthfeel: "Low carbonation."
        }
      }
    ];

    const matches = matcher.match(
      {
        descriptors: [],
        negatedDescriptors: [],
        categorical: { carbonation: "high", sweetness: "very-dry" }
      },
      styles
    );

    expect(matches[0].styleId).toBe("X1");
    expect(matches.find((match) => match.styleId === "X2")?.conflictingEvidence.map((evidence) => evidence.dimension)).toEqual(
      expect.arrayContaining(["Carbonation", "Sweetness/dryness"])
    );
  });

  it("demotes Piwo Grodziskie when a complete pale profile has no smoke character", async () => {
    const parser = new RuleBasedTextParser();
    const matcher = new DeterministicStyleMatcher();
    const profile = await parser.parse("Pale gold, brilliant clarity. Clean fermentation, dry crisp finish, medium bitterness, light body, high carbonation. Floral herbal hops and grainy wheat, no smoke.");
    const matches = matcher.match(profile, bjcpStyles.filter((style) => ["5B", "18B", "27E"].includes(style.id)));
    const grodziskie = matches.find((match) => match.styleId === "27E");

    expect(matches[0].styleId).not.toBe("27E");
    expect(grodziskie?.conflictingEvidence.some((evidence) => evidence.dimension === "Smoke/wood character")).toBe(true);
  });
});
