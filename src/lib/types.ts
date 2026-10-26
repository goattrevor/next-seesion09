export type AgentStep = {
  name: string;
  label: string;
  input: string;
  output: string;
  status: "done" | "error";
};

export type Source = { title: string; url: string };

export type SimilarCase = {
  name: string;
  region: string;
  description: string;
  takeaway: string;
};

export type Competitor = {
  name: string;
  type: string;
  offering: string;
  strength: string;
  weakness: string;
};

export type MarketInsight = {
  size: string;
  growth: string;
  target_customers: string;
};

export type ValidationReport = {
  title: string;
  summary: string;
  similar_cases: SimilarCase[];
  competitors: Competitor[];
  market: MarketInsight;
  sources: Source[];
};

export type AgentRunResult = {
  reply: string;
  steps: AgentStep[];
  reportSaved: boolean;
  report: ValidationReport | null;
};

export type ToolContext = {
  hasSimilarCases: boolean;
  hasCompetitors: boolean;
  hasMarket: boolean;
  /* 웹 조사 도구가 실제로 반환한 출처만 모읍니다. 리포트 출처는 여기서만 가져옵니다. */
  sources: Map<string, Source>;
  report: ValidationReport | null;
};
