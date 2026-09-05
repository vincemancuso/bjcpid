import styles from "../../data/bjcp/2021-1.25/styles.json";
import fullGuidelines from "../../data/bjcp/2021-1.25/full-style-guidelines.json";
import metadata from "../../data/bjcp/2021-1.25/source-metadata.json";
import { withQualifiedDescriptors } from "./qualifiedDescriptors";
import type { BjcpFullStyleGuideline, BjcpStyle } from "./types";

export const bjcpStyles = (styles as BjcpStyle[]).map(withQualifiedDescriptors);
export const bjcpFullStyleGuidelines = fullGuidelines as Record<string, BjcpFullStyleGuideline>;
export const bjcpSourceMetadata = metadata;
