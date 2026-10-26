import type { PLATFORMS } from "@/lib/shared";

export type AgentStep = {
  name: string;
  label: string;
  input: string;
  output: string;
  status: "done" | "error";
};

export type Platform = (typeof PLATFORMS)[number];

export type Source = { title: string; url: string };

/* get_creator_stats가 확인한 지표. 확인하지 못한 값은 null로 둡니다. */
export type CreatorStats = {
  platform: Platform;
  handle: string;
  found: boolean;
  name: string | null;
  url: string | null;
  followers: number | null;
  average_views: number | null;
  recent_topics: string;
  data_source: "youtube_api" | "web_search";
  unverified: string[];
};

export type RankedCreator = {
  rank: number;
  platform: Platform;
  handle: string;
  name: string;
  url: string | null;
  followers: number | null;
  average_views: number | null;
  fit_topic: string;
  fit_audience: string;
  caution: string;
};

export type Shortlist = {
  product: string;
  target_customer: string;
  summary: string;
  creators: RankedCreator[];
  sources: Source[];
};

export type AgentRunResult = {
  reply: string;
  steps: AgentStep[];
  reportSaved: boolean;
  shortlist: Shortlist | null;
};

export type ToolContext = {
  searchedPlatforms: Set<Platform>;
  /* key: "platform:handle" (소문자, @ 제거). 지표를 확인한 후보만 순위에 넣을 수 있습니다. */
  checkedCreators: Map<string, CreatorStats>;
  sources: Map<string, Source>;
  shortlist: Shortlist | null;
};
