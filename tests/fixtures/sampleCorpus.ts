import type { TastingProfile } from "../../src/domain/tasting/types";

export interface SampleCase {
  name: string;
  notes: string;
  categorical?: TastingProfile["categorical"];
  specialIngredients?: string;
  expectedTopGroup: string[];
  rationale: string;
}

export const sampleCorpus: SampleCase[] = [
  {
    name: "American Pale Ale",
    notes: "Gold and clear. Aroma: moderate citrus hops and light cracker malt. Flavor: medium bitterness, clean fermentation, dry finish. Mouthfeel: medium-light body, moderate carbonation.",
    expectedTopGroup: ["18B", "21A"],
    rationale: "Citrus hops, cracker malt, clean fermentation, medium bitterness, and dry pale profile fit American pale styles."
  },
  {
    name: "American IPA",
    notes: "Amber, clear beer with big citrus, pine and resin hop aroma. Dry, high bitterness, clean fermentation, medium body and moderate carbonation.",
    expectedTopGroup: ["21A"],
    rationale: "Assertive American hop character and high bitterness should elevate American IPA."
  },
  {
    name: "Kolsch-like pale lagered ale",
    notes: "Brilliant gold beer with soft grainy malt, clean fermentation, low bitterness and medium carbonation.",
    expectedTopGroup: ["5B", "4A"],
    rationale: "The MVP archive uses the pale clean German lager profile as the nearest local stand-in."
  },
  {
    name: "Munich Helles",
    notes: "Clear gold beer with grainy-sweet malt, floral hops, low bitterness, clean fermentation, medium body.",
    expectedTopGroup: ["4A"],
    rationale: "Pale German malt and noble hop evidence should favor the closest local pale German lager."
  },
  {
    name: "Irish Stout",
    notes: "Black opaque beer. Coffee and roast aroma, dry flavor, medium bitterness, medium-light body and low carbonation. No diacetyl.",
    expectedTopGroup: ["15B"],
    rationale: "Black color, roast, coffee, dry finish, and medium bitterness should point to Irish Stout."
  },
  {
    name: "Weissbier",
    notes: "Hazy gold wheat beer with banana, clove, bready malt, low bitterness, medium-light body and high carbonation.",
    expectedTopGroup: ["10A"],
    rationale: "Banana, clove, haze, wheat-like bread, and high carbonation are Weissbier markers."
  },
  {
    name: "Saison",
    notes: "Hazy gold ale with fruity esters, peppery phenols, dry finish, medium bitterness, light body and high carbonation.",
    expectedTopGroup: ["25B"],
    rationale: "Dry, peppery, fruity, highly carbonated Belgian profile should favor Saison."
  },
  {
    name: "Belgian Tripel",
    notes: "Clear gold strong ale with honey malt, fruity esters, peppery phenols, dry finish, medium alcohol and high carbonation.",
    expectedTopGroup: ["26C"],
    rationale: "Strong pale Belgian fermentation profile with alcohol and high carbonation should favor Tripel."
  },
  {
    name: "English Bitter-ish IPA",
    notes: "Amber clear ale with biscuit and caramel malt, floral spicy hops, medium-high bitterness and balanced finish.",
    expectedTopGroup: ["12C"],
    rationale: "Floral-spicy English hops and biscuit-caramel malt should favor English IPA in this MVP archive."
  },
  {
    name: "Berliner Weisse",
    notes: "Pale straw, slightly hazy, sharp lactic sourness, very low bitterness, very dry, light body and high carbonation.",
    expectedTopGroup: ["23A"],
    rationale: "Low bitterness, lactic sourness, straw color, light body, and high carbonation should favor Berliner Weisse."
  },
  {
    name: "Fruit specialty",
    notes: "Pink beer with cherry fruit aroma and tart finish, unusual color.",
    specialIngredients: "cherry",
    expectedTopGroup: ["29A"],
    rationale: "Declared fruit and unusual color should surface the specialty category."
  }
];
