export type ColorDescriptor = "straw" | "gold" | "amber" | "copper" | "brown" | "black" | "unusual";
export type ClarityDescriptor = "brilliant" | "clear" | "slight-haze" | "hazy" | "opaque";
export type Intensity5 = "very-low" | "low" | "medium" | "medium-high" | "high";
export type Intensity4 = "none" | "low" | "medium" | "high";
export type Intensity3 = "low" | "medium" | "high";
export type SweetnessDescriptor = "very-dry" | "dry" | "balanced" | "semi-sweet" | "sweet";
export type BodyDescriptor = "light" | "medium-light" | "medium" | "medium-full" | "full";

export interface TastingProfile {
  freeText?: string;
  aroma?: string;
  appearance?: string;
  flavor?: string;
  mouthfeel?: string;
  overall?: string;
  descriptors: string[];
  negatedDescriptors?: string[];
  categorical: {
    color?: ColorDescriptor;
    unusualColor?: boolean;
    clarity?: ClarityDescriptor;
    bitterness?: Intensity5;
    sweetness?: SweetnessDescriptor;
    body?: BodyDescriptor;
    carbonation?: Intensity5;
    perceivedAlcohol?: Intensity3;
    roastIntensity?: Intensity4;
    acidity?: Intensity5;
    hopAromaIntensity?: Intensity5;
    hopCharacters?: string[];
    maltCharacters?: string[];
    fermentationCharacters?: string[];
    faults?: string[];
  };
  stats?: {
    abv?: number;
    ibu?: number;
    srm?: number;
    og?: number;
    fg?: number;
  };
  specialIngredients?: string;
}

export interface TastingProfileParser {
  parse(input: string): Promise<TastingProfile>;
}

export function emptyProfile(): TastingProfile {
  return {
    descriptors: [],
    negatedDescriptors: [],
    categorical: {}
  };
}
