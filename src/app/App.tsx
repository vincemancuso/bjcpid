import { useMemo, useState, type ReactNode } from "react";
import { bjcpFullStyleGuidelines, bjcpSourceMetadata, bjcpStyles } from "../domain/bjcp/loadStyles";
import type { BjcpFullStyleGuideline, BjcpStyle } from "../domain/bjcp/types";
import { DeterministicStyleMatcher } from "../domain/matching/deterministicMatcher";
import type { StyleMatch } from "../domain/matching/types";
import { emptyProfile, type TastingProfile } from "../domain/tasting/types";
import { RuleBasedTextParser, normalizeCategorical } from "../parsing/ruleBasedTextParser";
import { fermentationCharacterTerms, hopCharacterTerms, maltCharacterTerms } from "../domain/bjcp/sensoryDescriptors";
import bjcpidLogo from "./assets/bjcpid-logo-transparent.png";

type InputMode = "scoresheet" | "free-notes";
type NoteSection = "aroma" | "appearance" | "flavor" | "mouthfeel" | "overall" | "freeText";
type CharacterField = "hopCharacters" | "maltCharacters" | "fermentationCharacters";
type CharacterSection = "aroma" | "flavor";
type SectionCharacters = Record<CharacterSection, Record<CharacterField, string[]>>;
type HighlightKind = "match" | "conflict";
type HighlightTerm = { term: string; kind: HighlightKind };
type TargetStyleSummary = {
  style: BjcpStyle;
  guideline?: BjcpFullStyleGuideline;
  match: StyleMatch;
  topRank?: number;
};

type MatchDiagnosticMatch = StyleMatch & {
  style: Pick<BjcpStyle, "id" | "name" | "categoryId" | "categoryName" | "stats" | "tags" | "isSpecialty" | "qualifiedDescriptors">;
  guidelineSections?: BjcpFullStyleGuideline["sections"];
};

const selectOptions = {
  color: ["", "straw", "gold", "amber", "copper", "brown", "black", "unusual"],
  clarity: ["", "brilliant", "clear", "slight-haze", "hazy", "opaque"],
  bitterness: ["", "very-low", "low", "medium", "medium-high", "high"],
  sweetness: ["", "very-dry", "dry", "balanced", "semi-sweet", "sweet"],
  body: ["", "light", "medium-light", "medium", "medium-full", "full"],
  carbonation: ["", "very-low", "low", "medium", "medium-high", "high"],
  perceivedAlcohol: ["", "low", "medium", "high"],
  roastIntensity: ["", "none", "low", "medium", "high"],
  acidity: ["", "very-low", "low", "medium", "medium-high", "high"]
};

const hopOptions = hopCharacterTerms;
const maltOptions = maltCharacterTerms;
const fermentationOptions = fermentationCharacterTerms;

const evidencePhrases: Record<string, string[]> = {
  straw: ["straw", "pale yellow", "very pale"],
  gold: ["gold", "golden", "yellow"],
  amber: ["amber"],
  copper: ["copper"],
  brown: ["brown"],
  black: ["black", "dark brown", "jet black"],
  unusual: ["unusual", "distinctive ingredient colors", "varies by base style"],
  brilliant: ["brilliant"],
  clear: ["clear"],
  "slight-haze": ["slight haze", "light haze", "slightly hazy"],
  hazy: ["hazy", "haze", "cloudy"],
  opaque: ["opaque"],
  "very-low": ["very low", "minimal", "absent"],
  low: ["low", "restrained"],
  medium: ["medium", "moderate"],
  "medium-high": ["medium-high", "moderately-high", "assertive"],
  high: ["high", "prominent", "intense"],
  "very-dry": ["very dry", "bone dry", "well-attenuated"],
  dry: ["dry", "dryish", "crisp", "well-attenuated"],
  balanced: ["balanced"],
  "semi-sweet": ["slightly malty", "malty sweetness", "suggestion of sweetness"],
  sweet: ["sweet", "sweetness", "malty sweetness"],
  light: ["light body", "light"],
  "medium-light": ["medium-light", "medium light"],
  "medium-full": ["medium-full", "medium full"],
  full: ["full body", "full"],
  none: ["none", "absent", "no"],
  "fruity esters": ["fruity esters", "esters", "fruitiness"],
  "peppery phenols": ["peppery phenols", "peppery", "phenols"],
  "belgian spice": ["belgian spice", "spicy"],
  "lactic sour": ["lactic", "sourness", "sour"],
  acetic: ["acetic", "vinegar"],
  roast: ["roast", "roasted", "roasty"],
  bready: ["bread", "bready"]
};

const conflictPhraseGroups: Record<string, string[]> = {
  Color: ["straw", "pale yellow", "gold", "golden", "yellow", "amber", "copper", "brown", "black", "jet black", "dark brown"],
  Clarity: ["brilliant", "clear", "slight haze", "light haze", "hazy", "opaque"],
  Bitterness: ["very low bitterness", "low bitterness", "medium-low bitterness", "medium bitterness", "medium-high bitterness", "high bitterness", "very high bitterness", "restrained bitterness", "assertive bitterness"],
  Body: ["light body", "medium-light body", "medium body", "medium-full body", "full body"],
  Carbonation: ["low carbonation", "medium carbonation", "medium-high carbonation", "high carbonation"],
  Acidity: ["lactic", "sour", "sourness", "acidic", "tart", "no sourness"],
  "Sweetness/dryness": ["dry", "dryish", "well-attenuated", "sweet", "sweetness", "malty sweetness"],
  "Roast intensity": ["roast", "roasted", "roasty", "coffee", "chocolate"],
  "Fermentation character": ["clean fermentation", "clean", "fruity esters", "esters", "banana", "clove", "peppery", "phenols", "funky", "lactic", "acetic"],
  Faults: ["diacetyl", "dms", "astringency", "astringent", "oxidation", "oxidized", "sulfur", "solvent", "vegetal", "metallic"]
};

const bitternessPhrases: Record<string, string[]> = {
  "very-low": ["very low bitterness", "minimal bitterness"],
  low: ["low bitterness", "restrained bitterness"],
  medium: ["medium bitterness", "moderate bitterness"],
  "medium-high": ["medium-high bitterness", "assertive bitterness"],
  high: ["high bitterness", "very high bitterness"]
};

const carbonationPhrases: Record<string, string[]> = {
  "very-low": ["very low carbonation"],
  low: ["low carbonation"],
  medium: ["medium carbonation", "moderate carbonation"],
  "medium-high": ["medium-high carbonation"],
  high: ["high carbonation"]
};

const bodyPhrases: Record<string, string[]> = {
  light: ["light body", "light to medium-low body"],
  "medium-light": ["medium-light body", "medium light body"],
  medium: ["medium body"],
  "medium-full": ["medium-full body", "medium full body"],
  full: ["full body"]
};

const alcoholPhrases: Record<string, string[]> = {
  low: ["low alcohol", "restrained alcohol"],
  medium: ["moderate alcohol", "smooth alcohol", "warming"],
  high: ["high alcohol", "strong alcohol", "hot alcohol"]
};

function label(value: string): string {
  if (!value) return "Unknown";
  return value
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function mergeProfile(base: TastingProfile, patch: Partial<TastingProfile>): TastingProfile {
  return {
    ...base,
    ...patch,
    categorical: {
      ...base.categorical,
      ...patch.categorical
    },
    stats: {
      ...base.stats,
      ...patch.stats
    }
  };
}

function definedCategorical(categorical: TastingProfile["categorical"]): TastingProfile["categorical"] {
  return Object.fromEntries(Object.entries(categorical).filter(([, value]) => value !== undefined && value !== false && (!Array.isArray(value) || value.length > 0))) as TastingProfile["categorical"];
}

function combineSectionCharacters(sectionCharacters: SectionCharacters): Pick<TastingProfile["categorical"], CharacterField> {
  return {
    hopCharacters: [...new Set([...sectionCharacters.aroma.hopCharacters, ...sectionCharacters.flavor.hopCharacters])],
    maltCharacters: [...new Set([...sectionCharacters.aroma.maltCharacters, ...sectionCharacters.flavor.maltCharacters])],
    fermentationCharacters: [...new Set([...sectionCharacters.aroma.fermentationCharacters, ...sectionCharacters.flavor.fermentationCharacters])]
  };
}

function emptyExpandedNotes(): Record<NoteSection, boolean> {
  return {
    aroma: false,
    appearance: false,
    flavor: false,
    mouthfeel: false,
    overall: false,
    freeText: false
  };
}

function emptySectionCharacters(): SectionCharacters {
  return {
    aroma: { hopCharacters: [], maltCharacters: [], fermentationCharacters: [] },
    flavor: { hopCharacters: [], maltCharacters: [], fermentationCharacters: [] }
  };
}

function styleDiagnostic(match: StyleMatch): MatchDiagnosticMatch {
  const style = bjcpStyles.find((candidate) => candidate.id === match.styleId);
  const guideline = bjcpFullStyleGuidelines[match.styleId];
  return {
    ...match,
    style: {
      id: style?.id ?? match.styleId,
      name: style?.name ?? match.styleName,
      categoryId: style?.categoryId ?? "",
      categoryName: style?.categoryName ?? match.categoryName,
      stats: style?.stats,
      tags: style?.tags,
      isSpecialty: style?.isSpecialty,
      qualifiedDescriptors: style?.qualifiedDescriptors
    },
    guidelineSections: guideline?.sections
  };
}

function buildMatchDiagnostics({
  inputMode,
  profile,
  sectionCharacters,
  matches,
  targetStyleSummaries
}: {
  inputMode: InputMode;
  profile: TastingProfile;
  sectionCharacters: SectionCharacters;
  matches: StyleMatch[];
  targetStyleSummaries: TargetStyleSummary[];
}) {
  return {
    generatedAt: new Date().toISOString(),
    purpose: "BJCPid matcher feedback payload",
    feedbackQuestions: [
      "Which ranked style felt wrong?",
      "What style did you expect instead?",
      "Which supplied evidence should have mattered more or less?"
    ],
    guidelineArchive: bjcpSourceMetadata,
    inputMode,
    scoresheetNotes: {
      aroma: profile.aroma ?? "",
      appearance: profile.appearance ?? "",
      flavor: profile.flavor ?? "",
      mouthfeel: profile.mouthfeel ?? "",
      overall: profile.overall ?? "",
      freeText: profile.freeText ?? ""
    },
    manualSelections: {
      sectionCharacters,
      categorical: profile.categorical,
      stats: profile.stats ?? {},
      descriptors: profile.descriptors,
      negatedDescriptors: profile.negatedDescriptors ?? [],
      specialIngredients: profile.specialIngredients ?? ""
    },
    matchedStyles: matches.map(styleDiagnostic),
    targetStyles: targetStyleSummaries.map(({ style, guideline, match, topRank }) => ({
      topRank: topRank ?? null,
      match: styleDiagnostic(match),
      targetStyle: {
        id: style.id,
        name: style.name,
        categoryId: style.categoryId,
        categoryName: style.categoryName,
        stats: style.stats,
        tags: style.tags,
        isSpecialty: style.isSpecialty,
        qualifiedDescriptors: style.qualifiedDescriptors,
        guidelineSections: guideline?.sections
      }
    }))
  };
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) throw new Error("Clipboard copy failed");
}

function officialStyleUrl(style: BjcpStyle): string {
  const slug = style.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `https://www.bjcp.org/style/2021/${style.categoryId}/${style.id}/${slug}/`;
}

export function App() {
  const parser = useMemo(() => new RuleBasedTextParser(), []);
  const matcher = useMemo(() => new DeterministicStyleMatcher(), []);
  const [inputMode, setInputMode] = useState<InputMode>("scoresheet");
  const [targetStyleIds, setTargetStyleIds] = useState<string[]>([]);
  const [targetStyleQuery, setTargetStyleQuery] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<Record<NoteSection, boolean>>(() => emptyExpandedNotes());
  const [sectionCharacters, setSectionCharacters] = useState<SectionCharacters>(() => emptySectionCharacters());
  const [profile, setProfile] = useState<TastingProfile>(() => emptyProfile());
  const [matches, setMatches] = useState<StyleMatch[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<{ style: BjcpStyle; guideline?: BjcpFullStyleGuideline; match: StyleMatch } | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<StyleMatch | null>(null);
  const [status, setStatus] = useState("Ready for local matching.");
  const targetStyleOptions = useMemo(() => bjcpStyles.filter((style) => !targetStyleIds.includes(style.id)), [targetStyleIds]);
  const selectedTargetStyle = useMemo(() => {
    const query = targetStyleQuery.trim().toLowerCase();
    if (!query) return undefined;
    return targetStyleOptions.find((style) => `${style.id} ${style.name}`.toLowerCase() === query || style.id.toLowerCase() === query);
  }, [targetStyleOptions, targetStyleQuery]);
  const targetStyleSummaries = useMemo(() => {
    const summaries: TargetStyleSummary[] = [];
    for (const styleId of targetStyleIds) {
      const style = bjcpStyles.find((candidate) => candidate.id === styleId);
      if (!style) continue;
      const topMatch = matches.find((match) => match.styleId === style.id);
      const match = topMatch ?? matcher.match(profile, [style])[0];
      summaries.push({
        style,
        guideline: bjcpFullStyleGuidelines[style.id],
        match,
        topRank: topMatch?.rank
      });
    }
    return summaries;
  }, [matcher, matches, profile, targetStyleIds]);

  const runMatch = async () => {
    const combinedText = [profile.freeText, profile.aroma, profile.appearance, profile.flavor, profile.mouthfeel, profile.overall].filter(Boolean).join("\n");
    const parsed = await parser.parse(combinedText);
    const specialIngredients = profile.specialIngredients;
    const combinedCharacters = combineSectionCharacters(sectionCharacters);
    const nextProfile = mergeProfile(parsed, {
      ...profile,
      descriptors: [...new Set([...parsed.descriptors, ...profile.descriptors])],
      negatedDescriptors: [...new Set([...(parsed.negatedDescriptors ?? []), ...(profile.negatedDescriptors ?? [])])],
      categorical: {
        ...parsed.categorical,
        ...profile.categorical,
        hopCharacters: [...new Set([...(parsed.categorical.hopCharacters ?? []), ...(combinedCharacters.hopCharacters ?? [])])],
        maltCharacters: [...new Set([...(parsed.categorical.maltCharacters ?? []), ...(combinedCharacters.maltCharacters ?? [])])],
        fermentationCharacters: [...new Set([...(parsed.categorical.fermentationCharacters ?? []), ...(combinedCharacters.fermentationCharacters ?? [])])]
      },
      specialIngredients
    });
    setProfile(nextProfile);
    setMatches(matcher.match(nextProfile, bjcpStyles));
    setStatus("Matched locally. No tasting notes left this browser.");
  };

  const resetWorkspace = () => {
    setTargetStyleIds([]);
    setTargetStyleQuery("");
    setExpandedNotes(emptyExpandedNotes());
    setSectionCharacters(emptySectionCharacters());
    setProfile(emptyProfile());
    setMatches([]);
    setSelectedStyle(null);
    setSelectedEvidence(null);
    setStatus("Selections and matches cleared.");
  };

  const copyMatchDiagnostics = async () => {
    const diagnostics = buildMatchDiagnostics({
      inputMode,
      profile,
      sectionCharacters,
      matches,
      targetStyleSummaries
    });
    try {
      await copyTextToClipboard(JSON.stringify(diagnostics, null, 2));
      setStatus("Copied match diagnostics to clipboard.");
    } catch {
      setStatus("Unable to copy diagnostics. Clipboard permission may be blocked.");
    }
  };

  const updateText = (field: keyof TastingProfile, value: string) => {
    const categorical = definedCategorical(normalizeCategorical(value));
    setProfile((current) => mergeProfile(current, { [field]: value, categorical }));
  };

  const toggleNotes = (section: NoteSection) => {
    setExpandedNotes((current) => ({ ...current, [section]: !current[section] }));
  };

  const updateCategorical = (field: keyof TastingProfile["categorical"], value: string) => {
    setProfile((current) => mergeProfile(current, { categorical: { [field]: value || undefined } }));
  };

  const toggleList = (section: CharacterSection, field: CharacterField, value: string) => {
    setSectionCharacters((current) => {
      const values = current[section][field];
      return {
        ...current,
        [section]: {
          ...current[section],
          [field]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
        }
      };
    });
  };

  const addTargetStyle = () => {
    if (!selectedTargetStyle || targetStyleIds.includes(selectedTargetStyle.id)) return;
    setTargetStyleIds((current) => [...current, selectedTargetStyle.id]);
    setTargetStyleQuery("");
  };

  return (
    <main>
      <header className="topbar">
        <div className="brand-lockup">
          <img src={bjcpidLogo} alt="" aria-hidden="true" />
          <div className="brand-copy">
            <p className="eyebrow">Boston Wort Processors Present:</p>
            <h1 className="wordmark" aria-label="BJCPid">
              <span>BJCP</span>
              <span>id</span>
            </h1>
          </div>
        </div>
        <a className="club-link" href="https://wort.org/" target="_blank" rel="noreferrer">wort.org</a>
      </header>

      <section className="workspace" aria-label="Tasting note workspace">
        <div className="input-pane">
          <section className="scoresheet-shell" aria-labelledby="scoresheet-heading">
            <div className="scoresheet-shell-header">
              <h2 id="scoresheet-heading">BJCP Scoresheet</h2>
              <div className="input-toolbar">
                <div className="mode-switch" role="tablist" aria-label="Scoresheet mode">
                  <button type="button" role="tab" aria-selected={inputMode === "scoresheet"} onClick={() => setInputMode("scoresheet")}>
                    Guided
                  </button>
                  <button type="button" role="tab" aria-selected={inputMode === "free-notes"} onClick={() => setInputMode("free-notes")}>
                    Free Notes
                  </button>
                </div>
                <button className="primary" type="button" onClick={resetWorkspace}>Reset</button>
              </div>
            </div>

            {inputMode === "scoresheet" ? (
              <section className="scoresheet" aria-label="Guided scoresheet">
              <ScoresheetSection
                title="Aroma"
                htmlFor="aroma"
                value={profile.aroma ?? ""}
                onChange={(value) => updateText("aroma", value)}
                placeholder="Hop aroma, malt aroma, fermentation character, faults..."
                notesExpanded={expandedNotes.aroma}
                onToggleNotes={() => toggleNotes("aroma")}
              >
                <ChipSet title="Hop Character" options={hopOptions} selected={sectionCharacters.aroma.hopCharacters} onToggle={(value) => toggleList("aroma", "hopCharacters", value)} />
                <ChipSet title="Malt Character" options={maltOptions} selected={sectionCharacters.aroma.maltCharacters} onToggle={(value) => toggleList("aroma", "maltCharacters", value)} />
                <ChipSet title="Fermentation Character" options={fermentationOptions} selected={sectionCharacters.aroma.fermentationCharacters} onToggle={(value) => toggleList("aroma", "fermentationCharacters", value)} />
              </ScoresheetSection>

              <ScoresheetSection
                title="Appearance"
                htmlFor="appearance"
                value={profile.appearance ?? ""}
                onChange={(value) => updateText("appearance", value)}
                placeholder="Color, clarity, head color, foam persistence..."
                notesExpanded={expandedNotes.appearance}
                onToggleNotes={() => toggleNotes("appearance")}
              >
                <div className="section-controls two-up">
                  <SelectField field="color" labelText="Color" value={profile.categorical.color ?? ""} onChange={updateCategorical} />
                  <SelectField field="clarity" labelText="Clarity" value={profile.categorical.clarity ?? ""} onChange={updateCategorical} />
                </div>
              </ScoresheetSection>

              <ScoresheetSection
                title="Flavor"
                htmlFor="flavor"
                value={profile.flavor ?? ""}
                onChange={(value) => updateText("flavor", value)}
                placeholder="Bitterness, sweetness, malt, hops, fermentation, finish, faults..."
                notesExpanded={expandedNotes.flavor}
                onToggleNotes={() => toggleNotes("flavor")}
              >
                <div className="section-controls">
                  <SelectField field="bitterness" labelText="Bitterness" value={profile.categorical.bitterness ?? ""} onChange={updateCategorical} />
                  <SelectField field="sweetness" labelText="Sweetness / Dryness" value={profile.categorical.sweetness ?? ""} onChange={updateCategorical} />
                  <SelectField field="acidity" labelText="Acidity" value={profile.categorical.acidity ?? ""} onChange={updateCategorical} />
                  <SelectField field="roastIntensity" labelText="Roast Intensity" value={profile.categorical.roastIntensity ?? ""} onChange={updateCategorical} />
                </div>
                <ChipSet title="Flavor Hop Character" options={hopOptions} selected={sectionCharacters.flavor.hopCharacters} onToggle={(value) => toggleList("flavor", "hopCharacters", value)} />
                <ChipSet title="Flavor Malt Character" options={maltOptions} selected={sectionCharacters.flavor.maltCharacters} onToggle={(value) => toggleList("flavor", "maltCharacters", value)} />
                <ChipSet title="Flavor Fermentation Character" options={fermentationOptions} selected={sectionCharacters.flavor.fermentationCharacters} onToggle={(value) => toggleList("flavor", "fermentationCharacters", value)} />
              </ScoresheetSection>

              <ScoresheetSection
                title="Mouthfeel"
                htmlFor="mouthfeel"
                value={profile.mouthfeel ?? ""}
                onChange={(value) => updateText("mouthfeel", value)}
                placeholder="Body, carbonation, warmth, creaminess, astringency..."
                notesExpanded={expandedNotes.mouthfeel}
                onToggleNotes={() => toggleNotes("mouthfeel")}
              >
                <div className="section-controls">
                  <SelectField field="body" labelText="Body" value={profile.categorical.body ?? ""} onChange={updateCategorical} />
                  <SelectField field="carbonation" labelText="Carbonation" value={profile.categorical.carbonation ?? ""} onChange={updateCategorical} />
                  <SelectField field="perceivedAlcohol" labelText="Perceived Alcohol" value={profile.categorical.perceivedAlcohol ?? ""} onChange={updateCategorical} />
                </div>
              </ScoresheetSection>

              <ScoresheetSection
                title="Overall Impression"
                htmlFor="overall"
                value={profile.overall ?? ""}
                onChange={(value) => updateText("overall", value)}
                placeholder="Overall balance, drinkability, strongest impression, style clues..."
                notesExpanded={expandedNotes.overall}
                onToggleNotes={() => toggleNotes("overall")}
              />

              <div className="scoresheet-section">
                <div className="section-heading">
                  <h2>Specialty / Other</h2>
                </div>
                <label htmlFor="specialIngredients">
                  <span>Special ingredients or unusual features</span>
                  <input id="specialIngredients" value={profile.specialIngredients ?? ""} onChange={(event) => setProfile((current) => mergeProfile(current, { specialIngredients: event.target.value }))} />
                </label>
                <button className="notes-toggle" type="button" aria-expanded={expandedNotes.freeText} aria-controls="freeText-notes" onClick={() => toggleNotes("freeText")}>
                  <span aria-hidden="true">{expandedNotes.freeText ? "-" : "+"}</span>
                  General notes
                </button>
                {expandedNotes.freeText && (
                  <label id="freeText-notes" htmlFor="freeText">
                    <span>Notes</span>
                    <textarea
                      id="freeText"
                      value={profile.freeText ?? ""}
                      onChange={(event) => updateText("freeText", event.target.value)}
                      placeholder="Any extra notes that do not fit neatly above..."
                    />
                  </label>
                )}
              </div>
              </section>
            ) : (
              <section className="scoresheet free-notes-panel" aria-label="Free notes scoresheet">
              <FreeNoteSection
                title="Aroma"
                htmlFor="free-aroma"
                value={profile.aroma ?? ""}
                onChange={(value) => updateText("aroma", value)}
                placeholder="Hop aroma, malt aroma, fermentation character, faults..."
              />
              <FreeNoteSection
                title="Appearance"
                htmlFor="free-appearance"
                value={profile.appearance ?? ""}
                onChange={(value) => updateText("appearance", value)}
                placeholder="Color, clarity, head color, foam persistence..."
              />
              <FreeNoteSection
                title="Flavor"
                htmlFor="free-flavor"
                value={profile.flavor ?? ""}
                onChange={(value) => updateText("flavor", value)}
                placeholder="Bitterness, sweetness, malt, hops, fermentation, finish, faults..."
              />
              <FreeNoteSection
                title="Mouthfeel"
                htmlFor="free-mouthfeel"
                value={profile.mouthfeel ?? ""}
                onChange={(value) => updateText("mouthfeel", value)}
                placeholder="Body, carbonation, warmth, creaminess, astringency..."
              />
              <FreeNoteSection
                title="Overall Impression"
                htmlFor="free-overall"
                value={profile.overall ?? ""}
                onChange={(value) => updateText("overall", value)}
                placeholder="Overall balance, drinkability, strongest impression, style clues..."
              />
              <FreeNoteSection
                title="Specialty / Other"
                htmlFor="free-general"
                value={profile.freeText ?? ""}
                onChange={(value) => updateText("freeText", value)}
                placeholder="Special ingredients, unusual features, or extra notes..."
              />
              </section>
            )}
          </section>

          <div className="actions">
            <button className="primary" type="button" onClick={runMatch}>Match Styles</button>
            <span role="status">{status}</span>
          </div>
        </div>

        <aside className="results-pane" aria-label="Style suggestions">
          <section className="results-panel" aria-labelledby="top-candidates-heading">
            <div className="results-header">
              <div>
                <h2 id="top-candidates-heading">Top Candidates</h2>
                <p>{matches.length ? `${matches.length} local matches` : "Waiting for evidence"}</p>
              </div>
              <button className="secondary-action" type="button" onClick={copyMatchDiagnostics} disabled={!matches.length}>
                Copy
              </button>
            </div>

            <section className="target-styles" aria-labelledby="target-styles-heading">
              <div className="target-style-entry">
                <label htmlFor="targetStyle">
                  <span id="target-styles-heading">Target Styles</span>
                  <input
                    id="targetStyle"
                    list="targetStyleOptions"
                    value={targetStyleQuery}
                    onChange={(event) => setTargetStyleQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTargetStyle();
                      }
                    }}
                    placeholder="Type style name or ID..."
                    autoComplete="off"
                  />
                  <datalist id="targetStyleOptions">
                    {targetStyleOptions.map((style) => (
                      <option key={style.id} value={`${style.id} ${style.name}`} />
                    ))}
                  </datalist>
                </label>
                <button type="button" onClick={addTargetStyle} disabled={!selectedTargetStyle}>
                  Add
                </button>
              </div>

              {targetStyleSummaries.length > 0 && (
                <div className="target-style-list">
                  {targetStyleSummaries.map(({ style, guideline, match, topRank }) => (
                    <article className="target-style-card" key={style.id}>
                      <div>
                        <span className="rank">{topRank ? `Top #${topRank}` : "Target"}</span>
                        <h3>{style.id} {style.name}</h3>
                        <p>{match.supportScore}/100 support · {match.fitScore}/100 fit</p>
                      </div>
                      <div className="target-style-actions">
                        <button type="button" className="secondary-action" onClick={() => setSelectedEvidence(match)}>
                          Evidence
                        </button>
                        <button type="button" className="secondary-action" onClick={() => setSelectedStyle({ style, guideline, match })}>
                          Guidelines
                        </button>
                        <button type="button" className="icon-action" aria-label={`Remove ${style.name} target style`} onClick={() => setTargetStyleIds((current) => current.filter((id) => id !== style.id))}>
                          x
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {matches.length === 0 ? (
              <div className="empty-state">Enter tasting evidence and run local matching.</div>
            ) : (
              <div className="result-list">
                {matches.map((match) => (
                  <ResultCard
                    key={match.styleId}
                    match={match}
                    onViewEvidence={() => setSelectedEvidence(match)}
                    onViewStyle={() => {
                      const style = bjcpStyles.find((candidate) => candidate.id === match.styleId);
                      if (style) setSelectedStyle({ style, guideline: bjcpFullStyleGuidelines[style.id], match });
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </aside>
      </section>

      {selectedStyle && (
        <StyleModal
          style={selectedStyle.style}
          guideline={selectedStyle.guideline}
          match={selectedStyle.match}
          profile={profile}
          sectionCharacters={sectionCharacters}
          onClose={() => setSelectedStyle(null)}
        />
      )}
      {selectedEvidence && <EvidenceModal match={selectedEvidence} onClose={() => setSelectedEvidence(null)} />}

      <footer>
        Local archive: {bjcpSourceMetadata.name} {bjcpSourceMetadata.edition} v{bjcpSourceMetadata.version}. Guideline text used with permission for educational and study use. {bjcpSourceMetadata.copyright}. Current guidelines: www.bjcp.org.
      </footer>
    </main>
  );
}

function SelectField({
  field,
  labelText,
  value,
  onChange
}: {
  field: keyof typeof selectOptions;
  labelText: string;
  value: string;
  onChange: (field: keyof TastingProfile["categorical"], value: string) => void;
}) {
  return (
    <label>
      <span>{labelText}</span>
      <select value={value} onChange={(event) => onChange(field, event.target.value)}>
        {selectOptions[field].map((option) => (
          <option key={option} value={option}>
            {label(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function ScoresheetSection({
  title,
  htmlFor,
  value,
  onChange,
  placeholder,
  notesExpanded,
  onToggleNotes,
  children
}: {
  title: string;
  htmlFor: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  notesExpanded: boolean;
  onToggleNotes: () => void;
  children?: ReactNode;
}) {
  return (
    <section className="scoresheet-section" aria-labelledby={`${htmlFor}-heading`}>
      <div className="section-heading">
        <h2 id={`${htmlFor}-heading`}>{title}</h2>
      </div>
      {children}
      <button className="notes-toggle" type="button" aria-expanded={notesExpanded} aria-controls={`${htmlFor}-notes`} onClick={onToggleNotes}>
        <span aria-hidden="true">{notesExpanded ? "-" : "+"}</span>
        Notes
      </button>
      {notesExpanded && (
        <label id={`${htmlFor}-notes`} htmlFor={htmlFor}>
          <span>Notes</span>
          <textarea id={htmlFor} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
        </label>
      )}
    </section>
  );
}

function FreeNoteSection({
  title,
  htmlFor,
  value,
  onChange,
  placeholder
}: {
  title: string;
  htmlFor: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <section className="scoresheet-section free-note-section" aria-labelledby={`${htmlFor}-heading`}>
      <div className="section-heading">
        <h2 id={`${htmlFor}-heading`}>{title}</h2>
      </div>
      <label htmlFor={htmlFor}>
        <span>Notes</span>
        <textarea id={htmlFor} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      </label>
    </section>
  );
}

function ChipSet({ title, options, selected, onToggle }: { title: string; options: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <fieldset>
      <legend>{title}</legend>
      <div className="chips">
        {options.map((option) => (
          <label key={option} className={selected.includes(option) ? "chip selected" : "chip"}>
            <input type="checkbox" checked={selected.includes(option)} onChange={() => onToggle(option)} />
            {label(option)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ResultCard({ match, onViewEvidence, onViewStyle }: { match: StyleMatch; onViewEvidence: () => void; onViewStyle: () => void }) {
  const evidenceStatus =
    match.evidenceCompleteness >= 60
      ? { label: "Sufficient evidence", className: "sufficient" }
      : match.evidenceCompleteness >= 35
        ? { label: "Partial evidence", className: "partial" }
        : { label: "Needs more evidence", className: "insufficient" };
  const candidateLabel = match.confidenceLabel === "strong" ? "Strong support" : match.confidenceLabel === "moderate" ? "Moderate support" : "Provisional support";

  return (
    <article className="result-card">
      <div className="result-title">
        <div>
          <span className="rank">#{match.rank}</span>
          <h3>{match.styleId} {match.styleName}</h3>
          <p>{match.categoryName}</p>
        </div>
        <strong className={`sufficiency-pill ${evidenceStatus.className}`}>{evidenceStatus.label}</strong>
      </div>

      {match.specialtyNotice && <p className="notice">{match.specialtyNotice}</p>}

      <div className="style-visualization" aria-label={`${match.styleName} match visualization`}>
        <div className="candidate-label">{candidateLabel} · {match.supportScore}/100</div>
        <MetricBar label="Fit" value={match.fitScore} />
        <MetricBar label="Evidence" value={match.evidenceCompleteness} />
      </div>

      <div className="result-actions">
        <button className="secondary-action" type="button" onClick={onViewEvidence}>
          Evidence
        </button>
        <button className="secondary-action" type="button" onClick={onViewStyle}>
          Guidelines
        </button>
      </div>
    </article>
  );
}

function EvidenceModal({ match, onClose }: { match: StyleMatch; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="style-modal evidence-modal" role="dialog" aria-modal="true" aria-labelledby="evidence-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <span className="rank">{match.styleId}</span>
            <h2 id="evidence-modal-title">{match.styleName}</h2>
            <p>{match.categoryName}</p>
          </div>
          <button type="button" aria-label="Close evidence details" onClick={onClose}>Close</button>
        </header>

        <div className="style-visualization">
          <div className="candidate-label">Support · {match.supportScore}/100</div>
          <MetricBar label="Fit to supplied evidence" value={match.fitScore} />
          <MetricBar label="Evidence" value={match.evidenceCompleteness} />
        </div>

        <div className="evidence-grid">
          <EvidenceList title="Matched Evidence" items={match.matchedEvidence.map((item) => `${item.dimension}: ${item.note}`)} empty="No direct matches yet." />
          <EvidenceList title="Conflicts" items={match.conflictingEvidence.map((item) => `${item.dimension}: ${item.note}`)} empty="No conflicts found." />
          <EvidenceList title="Missing Evidence" items={match.missingEvidence} empty="Evidence is reasonably complete." />
        </div>

        {(match.sharedEvidence?.length || match.keyDifferences?.length) && (
          <div className="comparison">
            <strong>Close comparison</strong>
            <p>Shared: {match.sharedEvidence?.join(", ") || "limited shared evidence"}</p>
            <p>Key difference: {match.keyDifferences?.join(", ") || "small scoring margin"}. {match.rationale}</p>
          </div>
        )}
      </section>
    </div>
  );
}

function termsFor(value: string | undefined): string[] {
  if (!value) return [];
  return evidencePhrases[value] ?? [value];
}

function uniqueHighlightTerms(terms: HighlightTerm[]): HighlightTerm[] {
  const seen = new Map<string, HighlightKind>();
  for (const term of terms) {
    const normalized = term.term.toLowerCase();
    if (normalized.length < 3) continue;
    const existing = seen.get(normalized);
    if (!existing || term.kind === "conflict") seen.set(normalized, term.kind);
  }
  return [...seen.entries()]
    .map(([term, kind]) => ({ term, kind }))
    .sort((a, b) => b.term.length - a.term.length);
}

function buildHighlightTerms(profile: TastingProfile, sectionCharacters: SectionCharacters, match: StyleMatch): HighlightTerm[] {
  const combinedCharacters = combineSectionCharacters(sectionCharacters);
  const matched: string[] = [
    ...termsFor(profile.categorical.color),
    ...termsFor(profile.categorical.clarity),
    ...(profile.categorical.bitterness ? bitternessPhrases[profile.categorical.bitterness] : []),
    ...termsFor(profile.categorical.sweetness),
    ...(profile.categorical.body ? bodyPhrases[profile.categorical.body] : []),
    ...(profile.categorical.carbonation ? carbonationPhrases[profile.categorical.carbonation] : []),
    ...(profile.categorical.perceivedAlcohol ? alcoholPhrases[profile.categorical.perceivedAlcohol] : []),
    ...termsFor(profile.categorical.roastIntensity),
    ...termsFor(profile.categorical.acidity),
    ...(profile.categorical.hopCharacters ?? []).flatMap(termsFor),
    ...(profile.categorical.maltCharacters ?? []).flatMap(termsFor),
    ...(profile.categorical.fermentationCharacters ?? []).flatMap(termsFor),
    ...(combinedCharacters.hopCharacters ?? []).flatMap(termsFor),
    ...(combinedCharacters.maltCharacters ?? []).flatMap(termsFor),
    ...(combinedCharacters.fermentationCharacters ?? []).flatMap(termsFor)
  ];
  const conflictDimensions = new Set(match.conflictingEvidence.map((evidence) => evidence.dimension));
  const conflicts = [...conflictDimensions].flatMap((dimension) => conflictPhraseGroups[dimension] ?? []);

  return uniqueHighlightTerms([
    ...matched.map((term) => ({ term, kind: "match" as const })),
    ...conflicts.map((term) => ({ term, kind: "conflict" as const }))
  ]);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedText({ text, terms }: { text: string; terms: HighlightTerm[] }) {
  if (!terms.length) return <>{text}</>;
  const pattern = new RegExp(`(${terms.map((term) => escapeRegex(term.term)).join("|")})`, "gi");
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, index) => {
        const term = terms.find((candidate) => candidate.term.toLowerCase() === part.toLowerCase());
        if (!term) return <span key={`${part}-${index}`}>{part}</span>;
        return (
          <mark key={`${part}-${index}`} className={`guideline-highlight ${term.kind}`}>
            {part}
          </mark>
        );
      })}
    </>
  );
}

function StyleModal({
  style,
  guideline,
  match,
  profile,
  sectionCharacters,
  onClose
}: {
  style: BjcpStyle;
  guideline?: BjcpFullStyleGuideline;
  match: StyleMatch;
  profile: TastingProfile;
  sectionCharacters: SectionCharacters;
  onClose: () => void;
}) {
  const sections = guideline?.sections ?? style.sections;
  const highlightTerms = buildHighlightTerms(profile, sectionCharacters, match);
  const sectionEntries = [
    ["Overall Impression", sections.overall],
    ["Appearance", sections.appearance],
    ["Aroma", sections.aroma],
    ["Flavor", sections.flavor],
    ["Mouthfeel", sections.mouthfeel],
    ["Comments", sections.comments],
    ["History", sections.history],
    ["Characteristic Ingredients", sections.characteristicIngredients],
    ["Style Comparison", sections.styleComparison],
    ["Entry Instructions", sections.entryInstructions]
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const sourceUrl = guideline?.sourceUrl ?? officialStyleUrl(style);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="style-modal" role="dialog" aria-modal="true" aria-labelledby="style-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <span className="rank">{style.id}</span>
            <h2 id="style-modal-title">{style.name}</h2>
            <p>{style.categoryName}</p>
          </div>
          <div className="modal-actions">
            <a href={sourceUrl} target="_blank" rel="noreferrer">
              Open official BJCP guideline
            </a>
            <button type="button" aria-label="Close style write-up" onClick={onClose}>Close</button>
          </div>
        </header>

        <p className="source-callout">
          Full BJCP guideline write-up from the local educational archive. Green highlights support your tasting evidence; red highlights point to style language that conflicts with supplied evidence.
        </p>

        <div className="highlight-legend" aria-label="Guideline highlight legend">
          <span><mark className="guideline-highlight match">Consistent</mark> with your evidence</span>
          <span><mark className="guideline-highlight conflict">Contrary</mark> to your evidence</span>
        </div>

        {style.isSpecialty && <p className="notice">Possible specialty category. Confirm required declarations for competition use.</p>}

        {guideline?.sections.vitalStatistics ? (
          <section className="style-writeup">
            <h3>Vital Statistics</h3>
            <p className="preline"><HighlightedText text={guideline.sections.vitalStatistics} terms={highlightTerms} /></p>
          </section>
        ) : style.stats && (
          <dl className="style-stats" aria-label="Guideline statistics">
            {style.stats.og && <Stat label="OG" value={`${style.stats.og.min}-${style.stats.og.max}`} />}
            {style.stats.fg && <Stat label="FG" value={`${style.stats.fg.min}-${style.stats.fg.max}`} />}
            {style.stats.ibu && <Stat label="IBU" value={`${style.stats.ibu.min}-${style.stats.ibu.max}`} />}
            {style.stats.srm && <Stat label="SRM" value={`${style.stats.srm.min}-${style.stats.srm.max}`} />}
            {style.stats.abv && <Stat label="ABV" value={`${style.stats.abv.min}-${style.stats.abv.max}%`} />}
          </dl>
        )}

        <div className="style-writeup">
          {sectionEntries.map(([title, body]) => (
            <section key={title}>
              <h3>{title}</h3>
              <p><HighlightedText text={body} terms={highlightTerms} /></p>
            </section>
          ))}
        </div>

        {guideline?.sections.commercialExamples ? (
          <section className="style-writeup">
            <h3>Commercial Examples</h3>
            <p><HighlightedText text={guideline.sections.commercialExamples} terms={highlightTerms} /></p>
          </section>
        ) : style.commercialExamples?.length ? (
          <section className="style-writeup">
            <h3>Commercial Examples</h3>
            <p>{style.commercialExamples.join(", ")}</p>
          </section>
        ) : null}

        <p className="source-note">
          {bjcpSourceMetadata.name} {bjcpSourceMetadata.edition} v{bjcpSourceMetadata.version}. Guideline text used with permission for educational and study use. {bjcpSourceMetadata.copyright}. The most current master version can be found at www.bjcp.org.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-row">
      <div className="metric-label">
        <span>{label}</span>
        <strong>{value}/100</strong>
      </div>
      <div className="metric-track" role="progressbar" aria-label={`${label}: ${value} out of 100`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function EvidenceList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="evidence">
      <strong>{title}</strong>
      <ul>
        {(items.length ? items : [empty]).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
