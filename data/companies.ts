export const SEGMENTS = ["Enterprise", "Mid-Market", "SMB", "Strategic"] as const;

export const STAGES = [
  "New Logo",
  "Upsell",
  "Expansion",
  "Renewal",
  "Pilot",
  "Co-Sell",
  "Land & Expand",
] as const;

export type Segment = (typeof SEGMENTS)[number];
export type Stage = (typeof STAGES)[number];
export type Tag = Segment | Stage;

export type TagTone =
  | "blue"
  | "purple"
  | "green"
  | "moss"
  | "red"
  | "orange"
  | "amber"
  | "teal"
  | "yellow"
  | "neutral";

export const TAG_TONES: Record<Tag, TagTone> = {
  Enterprise: "blue",
  "Mid-Market": "moss",
  SMB: "yellow",
  Strategic: "red",
  "New Logo": "green",
  Upsell: "purple",
  Expansion: "green",
  Renewal: "green",
  Pilot: "orange",
  "Co-Sell": "amber",
  "Land & Expand": "teal",
};

export type Company = {
  id: string;
  name: string;
  tags: Tag[];
  owner: string;
  ownerSubject?: string;
  openDeals: number;
  pipelineValue: number;
  winProbability: number;
  trend: number[];
  lastInteraction: { date: string; label: string };
  activityDays: number;
  logo?: string;
};

export const SORT_OPTIONS = [
  { value: "pipelineValue", label: "Pipeline Value" },
  { value: "winProbability", label: "Win Probability" },
  { value: "openDeals", label: "Open Deals" },
  { value: "lastInteraction", label: "Last Interaction" },
  { value: "name", label: "Company Name" },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]["value"];

export const INTERACTION_TYPES = [
  "Discovery",
  "Demo",
  "Pricing",
  "Security",
  "Legal",
  "Product",
  "Pilot",
  "Exec",
  "QBR Call",
  "Partner",
  "Renewal",
  "Expansion",
] as const;

export const ACTIVITY_WINDOWS = [7, 30, 60, 90] as const;
export type ActivityWindow = (typeof ACTIVITY_WINDOWS)[number];

export const TREND_WINDOWS = ["Last 7 Days", "Last 30 Days", "Last 90 Days"];
