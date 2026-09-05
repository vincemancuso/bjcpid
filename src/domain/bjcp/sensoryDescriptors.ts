export const termAliases: Record<string, string[]> = {
  acetic: ["acetic", "vinegar", "vinegary"],
  alcohol: ["alcohol", "alcoholic", "boozy", "warming"],
  apple: ["apple", "green apple", "red apple"],
  barrel: ["barrel", "barrels", "barrel-aged", "barrell", "barrells", "cask", "casks", "bourbon", "whiskey", "rum", "wine barrel"],
  berry: ["berry", "berries", "currant", "currants"],
  "belgian spice": ["belgian spice", "spicy", "spice"],
  bread: ["bread", "bready", "bread crust"],
  brett: ["brett", "brettanomyces"],
  "brown sugar": ["brown sugar"],
  burnt: ["burnt", "burned"],
  "dark fruit": ["dark fruit", "dried fruit", "raisin", "raisins", "plum", "plums", "prune", "prunes", "fig", "figs", "date", "dates"],
  dms: ["dms", "cooked corn", "vegetal"],
  "dried fruit": ["dried fruit", "raisin", "raisins", "plum", "plums", "prune", "prunes", "fig", "figs", "date", "dates"],
  "fruity esters": ["fruity esters", "esters", "fruitiness"],
  "lactic sour": ["lactic sour", "lactic"],
  "maillard": ["maillard", "melanoidin"],
  oak: ["oak", "oaky"],
  orange: ["orange", "orange peel"],
  pear: ["pear", "pome fruit"],
  peat: ["peat", "peat-smoked", "peaty"],
  "peppery phenols": ["peppery phenols", "peppery", "phenols", "phenolic"],
  phenolic: ["phenolic", "phenols"],
  pine: ["pine", "piney"],
  roast: ["roast", "roasted", "roasty"],
  smoke: ["smoke", "smoked", "smoky", "rauchmalz", "beechwood-smoked", "oak-smoked", "bacon", "ham"],
  spicy: ["spicy", "spice", "spicy-peppery", "peppery"],
  "stone fruit": ["stone fruit", "apricot", "peach", "nectarine"],
  sulfur: ["sulfur", "sulfury", "sulphur", "sulphury"],
  "tropical fruit": ["tropical fruit", "tropical", "mango", "passionfruit", "pineapple", "guava"],
  vanilla: ["vanilla", "vanillin"],
  wood: ["wood", "woody", "wooden", "beechwood", "alder", "maple", "mesquite", "hickory", "cedar"]
};

export const hopCharacterTerms = [
  "floral",
  "spicy",
  "herbal",
  "earthy",
  "pine",
  "resin",
  "citrus",
  "grapefruit",
  "orange",
  "lemon",
  "tropical fruit",
  "stone fruit",
  "berry",
  "melon",
  "dank",
  "grassy",
  "white wine"
];

export const maltCharacterTerms = [
  "grainy",
  "cracker",
  "bread",
  "doughy",
  "toast",
  "biscuit",
  "maillard",
  "caramel",
  "toffee",
  "honey",
  "molasses",
  "brown sugar",
  "nutty",
  "chocolate",
  "cocoa",
  "coffee",
  "roast",
  "burnt",
  "smoke",
  "wood",
  "oak",
  "barrel",
  "vanilla",
  "coconut",
  "tobacco",
  "leather",
  "dark fruit",
  "dried fruit"
];

export const fermentationCharacterTerms = [
  "clean",
  "fruity esters",
  "apple",
  "pear",
  "banana",
  "clove",
  "peppery phenols",
  "belgian spice",
  "bubblegum",
  "vanilla",
  "funky",
  "brett",
  "barnyard",
  "horsey",
  "lactic sour",
  "acetic",
  "vinegar",
  "sulfur",
  "diacetyl",
  "dms",
  "phenolic"
];

export const faultTerms = [
  "acetaldehyde",
  "alcoholic",
  "hot",
  "astringent",
  "diacetyl",
  "dms",
  "estery",
  "grassy",
  "light-struck",
  "metallic",
  "musty",
  "oxidized",
  "phenolic",
  "solvent",
  "sour",
  "acidic",
  "sulfur",
  "vegetal",
  "yeasty",
  "acrid",
  "burnt",
  "charred",
  "rubbery",
  "medicinal",
  "creosote",
  "smoke",
  "peat"
];

export const guidelineDescriptorTerms = [
  ...fermentationCharacterTerms,
  ...maltCharacterTerms,
  ...hopCharacterTerms,
  "sour",
  "acidic",
  "tart",
  "dry",
  "sweet",
  "bitter",
  "crisp",
  "carbonation",
  "body"
];

export const descriptorTerms = [...new Set([...guidelineDescriptorTerms, ...faultTerms])];

export function normalizeCharacterTerm(term: string): string {
  if (term === "bready") return "bread";
  if (term === "smoky" || term === "smoked") return "smoke";
  if (term === "woody") return "wood";
  if (term === "oaky") return "oak";
  if (term === "barrell" || term === "barrells" || term === "barrel-aged") return "barrel";
  return term;
}
