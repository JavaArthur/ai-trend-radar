export interface Snapshot {
  at: string;
  stars: number;
}
export interface Evidence {
  source: "topics" | "readme" | "description" | "manual";
  text: string;
}
export interface Classification {
  aiRelated: boolean;
  categories: string[];
  forms: string[];
  tags: string[];
  summary: string;
  status: "ai" | "rules" | "manual";
  evidence: Evidence[];
  readmeHash: string;
  processedAt: string;
  model?: string;
}
export interface Project {
  id: number;
  fullName: string;
  slug: string;
  url: string;
  description: string;
  homepage: string | null;
  stars: number;
  forks: number;
  language: string | null;
  topics: string[];
  license: string | null;
  archived: boolean;
  unavailable: boolean;
  pushedAt: string;
  createdAt: string;
  firstSeenAt: string;
  fetchedAt: string;
  defaultBranch: string;
  readmeCheckedAt?: string;
  sources: string[];
  skillEvidence: boolean;
  classification: Classification;
  snapshots: Snapshot[];
}
export interface TrendEntry {
  fullName: string;
  rank: number;
  starsInPeriod: number | null;
}
export interface TrendSource {
  fetchedAt: string | null;
  entries: TrendEntry[];
  error?: string;
}
export interface Catalog {
  schemaVersion: 1;
  generatedAt: string | null;
  lastSuccessfulCollectionAt: string | null;
  trending: { daily: TrendSource; weekly: TrendSource };
  projects: Project[];
  warnings: string[];
}
export interface Metrics {
  delta: number | null;
  rate: number | null;
  from: string | null;
  to: string | null;
  complete: boolean;
  positiveDays: number;
  hot: boolean;
  rising: boolean;
  active: boolean;
}
export interface Override {
  exclude?: boolean;
  aiRelated?: boolean;
  categories?: string[];
  forms?: string[];
  tags?: string[];
  summary?: string;
  reason?: string;
}
