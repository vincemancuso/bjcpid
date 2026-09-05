import { describe, expect, it } from "vitest";
import { RuleBasedTextParser, normalizeCategorical } from "../src/parsing/ruleBasedTextParser";

describe("RuleBasedTextParser", () => {
  it("parses sectioned free text", async () => {
    const parser = new RuleBasedTextParser();
    const profile = await parser.parse("Aroma: Moderate citrus hops.\nAppearance: Gold and clear.\nFlavor: Medium bitterness, dry finish.\nMouthfeel: Medium-light body.");
    expect(profile.aroma).toContain("citrus");
    expect(profile.appearance).toContain("Gold");
    expect(profile.flavor).toContain("Medium bitterness");
    expect(profile.mouthfeel).toContain("Medium-light body");
    expect(profile.categorical.color).toBe("gold");
    expect(profile.categorical.bitterness).toBe("medium");
  });

  it("infers sections from unsectioned prose", async () => {
    const parser = new RuleBasedTextParser();
    const profile = await parser.parse("Bright golden beer, very clear. Smells like lemon citrus and floral hops. Dry and crisp with medium bitterness, clean fermentation, light body, lively carbonation.");
    expect(profile.appearance).toContain("golden");
    expect(profile.aroma).toContain("Smells");
    expect(profile.flavor).toContain("medium bitterness");
    expect(profile.mouthfeel).toContain("body");
  });

  it("tracks simple negation", async () => {
    const parser = new RuleBasedTextParser();
    const profile = await parser.parse("Black stout-like beer, coffee roast, no diacetyl, without sourness and not roasty.");
    expect(profile.negatedDescriptors).toContain("diacetyl");
    expect(profile.categorical.faults).not.toContain("diacetyl");
  });

  it("normalizes categorical descriptors", () => {
    const categorical = normalizeCategorical("Hazy amber beer with tropical fruit hops, caramel malt, medium-high bitterness and medium-full body.");
    expect(categorical.color).toBe("amber");
    expect(categorical.clarity).toBe("hazy");
    expect(categorical.hopCharacters).toContain("tropical fruit");
    expect(categorical.maltCharacters).toContain("caramel");
    expect(categorical.bitterness).toBe("medium-high");
    expect(categorical.body).toBe("medium-full");
  });

  it("parses smoke, wood, and barrel character without treating negated smoke as present", async () => {
    const parser = new RuleBasedTextParser();
    const smoky = await parser.parse("Pale beer with oak smoke aroma, woody barrel notes, and a dry finish.");
    const clean = await parser.parse("Pale beer with floral hops, grainy malt, dry finish, and no smoke.");

    expect(smoky.categorical.maltCharacters).toEqual(expect.arrayContaining(["oak", "smoke", "wood", "barrel"]));
    expect(clean.negatedDescriptors).toContain("smoke");
    expect(clean.categorical.maltCharacters).not.toContain("smoke");
  });
});
