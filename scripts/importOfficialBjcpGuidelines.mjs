import fs from "node:fs/promises";
import path from "node:path";

const indexUrl = "https://styles.bjcp.org/bjcp-2021-beer.md";
const outputDir = "src/data/bjcp/2021-1.25";

const headingToSection = {
  "Overall Impression": "overall",
  Aroma: "aroma",
  Appearance: "appearance",
  Flavor: "flavor",
  Mouthfeel: "mouthfeel",
  Comments: "comments",
  History: "history",
  "Characteristic Ingredients": "characteristicIngredients",
  "Style Comparison": "styleComparison",
  "Entry Instructions": "entryInstructions",
  "Vital Statistics": "vitalStatistics",
  "Commercial Examples": "commercialExamples",
  Tags: "tags"
};

function titleCaseCategory(name) {
  const smallWords = new Set(["and", "of"]);
  return name
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      if (word === "ipa") return "IPA";
      if (index > 0 && smallWords.has(word)) return word;
      return word[0].toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function cleanMarkdown(text) {
  return text
    .replace(/^>.*$/gm, "")
    .replace(/\\\s*$/gm, "\n")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseLinks(indexMarkdown) {
  const categories = [];
  const styles = [];
  const linkRe = /^- \[([^\]]+)\]\((https:\/\/styles\.bjcp\.org\/bjcp-2021-beer(?:\/[^)]+)?\.md)\)$/gm;
  let match;
  while ((match = linkRe.exec(indexMarkdown))) {
    const [, rawLabel, url] = match;
    const categoryMatch = rawLabel.match(/^([1-9]|[12]\d|3[0-4])\. (.+)$/);
    if (categoryMatch) {
      if (!url.endsWith(`/bjcp-2021-beer/${categoryMatch[1]}.md`)) continue;
      categories.push({
        id: categoryMatch[1],
        name: titleCaseCategory(categoryMatch[2]),
        url
      });
      continue;
    }

    const styleMatch = rawLabel.match(/^((?:[1-9]|[12]\d|3[0-4])[A-Z])\. (.+)$/);
    if (styleMatch) {
      const categoryId = styleMatch[1].match(/^\d+/)?.[0];
      if (!url.includes(`/bjcp-2021-beer/${categoryId}/`)) continue;
      styles.push({
        id: styleMatch[1],
        name: styleMatch[2],
        categoryId,
        url
      });
      continue;
    }

    const historicalMatch = rawLabel.match(/^Historical Beer: (.+)$/);
    const historicalId = url.match(/\/27\/(27[a-z])-/i)?.[1]?.toUpperCase();
    if (historicalMatch && historicalId) {
      styles.push({
        id: historicalId,
        name: historicalMatch[1],
        categoryId: "27",
        url
      });
    }
  }

  return { categories, styles };
}

function parseSections(markdown) {
  const withoutIntro = markdown.replace(/^>.*$/gm, "").trim();
  const titleMatch = withoutIntro.match(/^#\s+(.+)$/m);
  const sectionMatches = [...withoutIntro.matchAll(/^#{2,3}\s+(.+?)\s*:?\s*$/gm)];
  const sections = {};

  for (let index = 0; index < sectionMatches.length; index += 1) {
    const heading = sectionMatches[index][1].trim();
    const sectionKey = headingToSection[heading];
    if (!sectionKey) continue;
    const start = sectionMatches[index].index + sectionMatches[index][0].length;
    const end = sectionMatches[index + 1]?.index ?? withoutIntro.length;
    const content = cleanMarkdown(withoutIntro.slice(start, end));
    sections[sectionKey] = sections[sectionKey] ? `${sections[sectionKey]}\n\n${heading}\n\n${content}` : content;
  }

  return {
    title: titleMatch ? cleanMarkdown(titleMatch[1]) : undefined,
    sections
  };
}

function parseRange(text, labelPattern) {
  const match = text.match(new RegExp(`${labelPattern}:\\s*([0-9.]+)\\s*[-–]\\s*([0-9.]+)`, "i"));
  if (!match) return undefined;
  return { min: Number(match[1]), max: Number(match[2]) };
}

function parseStats(vitalStatistics = "") {
  if (/variable by type/i.test(vitalStatistics)) return {};
  const stats = {
    og: parseRange(vitalStatistics, "OG"),
    fg: parseRange(vitalStatistics, "FG"),
    ibu: parseRange(vitalStatistics, "IBUs?"),
    srm: parseRange(vitalStatistics, "SRM"),
    abv: parseRange(vitalStatistics, "ABV")
  };
  return Object.fromEntries(Object.entries(stats).filter(([, value]) => value));
}

function parseCommercialExamples(text = "") {
  if (!text) return undefined;
  return text
    .split(",")
    .map((example) => example.trim())
    .filter(Boolean);
}

function parseTags(text = "") {
  if (!text) return undefined;
  return text
    .replace(/\*/g, "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function isSpecialtyStyle(style) {
  return Boolean(style.sections.entryInstructions || /specialty|fruit|spice|vegetable|wood|smoked|alternative/i.test(`${style.name} ${style.categoryName}`));
}

async function getText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

async function main() {
  const indexMarkdown = await getText(indexUrl);
  const { categories: categoryLinks, styles: styleLinks } = parseLinks(indexMarkdown);
  const categoryById = new Map(categoryLinks.map((category) => [category.id, category]));

  if (categoryLinks.length !== 34) {
    throw new Error(`Expected 34 categories, found ${categoryLinks.length}`);
  }
  if (styleLinks.length < 100) {
    throw new Error(`Expected the complete substyle list, found only ${styleLinks.length}`);
  }

  const categories = [];
  for (const category of categoryLinks) {
    const markdown = await getText(category.url);
    const { sections } = parseSections(markdown);
    categories.push({
      id: category.id,
      name: category.name,
      description: sections.overall ?? cleanMarkdown(markdown.replace(/^>.*$/gm, "").replace(/^#.*$/m, ""))
    });
  }

  const fullGuidelines = {};
  const styles = [];
  for (const link of styleLinks) {
    const markdown = await getText(link.url);
    const { title, sections } = parseSections(markdown);
    const categoryName = categoryById.get(link.categoryId)?.name ?? "";
    const styleName = link.name;
    const stats = parseStats(sections.vitalStatistics);
    const commercialExamples = parseCommercialExamples(sections.commercialExamples);
    const tags = parseTags(sections.tags);
    const guidelineSections = { ...sections };
    delete guidelineSections.tags;

    const style = {
      id: link.id,
      name: styleName,
      categoryId: link.categoryId,
      categoryName,
      sections: {
        overall: sections.overall,
        aroma: sections.aroma,
        appearance: sections.appearance,
        flavor: sections.flavor,
        mouthfeel: sections.mouthfeel,
        comments: sections.comments,
        history: sections.history,
        characteristicIngredients: sections.characteristicIngredients,
        styleComparison: sections.styleComparison,
        entryInstructions: sections.entryInstructions
      },
      ...(Object.keys(stats).length ? { stats } : {}),
      ...(commercialExamples?.length ? { commercialExamples } : {}),
      ...(tags?.length ? { tags } : {})
    };
    if (isSpecialtyStyle(style)) style.isSpecialty = true;

    styles.push(style);
    fullGuidelines[link.id] = {
      id: link.id,
      title: title ?? `${link.id}. ${styleName}`,
      sourceUrl: link.url.replace(/\.md$/, ""),
      sections: guidelineSections
    };
  }

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, "categories.json"), `${JSON.stringify(categories, null, 2)}\n`);
  await fs.writeFile(path.join(outputDir, "styles.json"), `${JSON.stringify(styles, null, 2)}\n`);
  await fs.writeFile(path.join(outputDir, "full-style-guidelines.json"), `${JSON.stringify(fullGuidelines, null, 2)}\n`);
  await fs.writeFile(
    path.join(outputDir, "source-metadata.json"),
    `${JSON.stringify(
      {
        name: "BJCP Beer Style Guidelines",
        edition: "2021",
        version: "1.25",
        sourceUrl: indexUrl.replace(/\.md$/, ""),
        retrievedAt: new Date().toISOString().slice(0, 10),
        copyright: "Copyright 2021, Beer Judge Certification Program, Inc.",
        notes: "Local structured extraction from official BJCP Markdown style guideline pages for offline style matching. Appendix/local styles are not included in the main beer style database."
      },
      null,
      2
    )}\n`
  );

  console.log(`Imported ${styles.length} styles across ${categories.length} categories.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
