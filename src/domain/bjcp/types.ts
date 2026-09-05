export interface Range {
  min: number;
  max: number;
}

export type BjcpStyleSectionKey =
  | "overall"
  | "aroma"
  | "appearance"
  | "flavor"
  | "mouthfeel"
  | "comments"
  | "history"
  | "characteristicIngredients"
  | "styleComparison"
  | "entryInstructions";

export type BjcpDescriptorQualifier = "supported" | "optional" | "required" | "prohibited";

export interface BjcpQualifiedDescriptor {
  term: string;
  qualifier: BjcpDescriptorQualifier;
  section: BjcpStyleSectionKey;
  evidence: string;
}

export interface BjcpStyle {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  sections: {
    overall?: string;
    aroma?: string;
    appearance?: string;
    flavor?: string;
    mouthfeel?: string;
    comments?: string;
    history?: string;
    characteristicIngredients?: string;
    styleComparison?: string;
    entryInstructions?: string;
  };
  stats?: {
    og?: Range;
    fg?: Range;
    ibu?: Range;
    srm?: Range;
    abv?: Range;
  };
  commercialExamples?: string[];
  tags?: string[];
  isSpecialty?: boolean;
  qualifiedDescriptors?: BjcpQualifiedDescriptor[];
}

export interface BjcpFullStyleGuideline {
  id: string;
  title: string;
  sourceUrl: string;
  sections: {
    overall?: string;
    appearance?: string;
    aroma?: string;
    flavor?: string;
    mouthfeel?: string;
    comments?: string;
    history?: string;
    characteristicIngredients?: string;
    styleComparison?: string;
    entryInstructions?: string;
    vitalStatistics?: string;
    commercialExamples?: string;
  };
}
