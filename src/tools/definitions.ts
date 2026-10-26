import type OpenAI from "openai";

const ideaParameters = {
  type: "object",
  properties: { idea: { type: "string", description: "검증할 아이디어를 한 문장으로 정리한 것" } },
  required: ["idea"],
  additionalProperties: false,
};

export const toolDefinitions: OpenAI.Responses.FunctionTool[] = [
  {
    type: "function",
    name: "search_similar_cases",
    description: "웹 검색으로 국내외 유사 서비스·사례(성공·실패 포함)를 조사합니다. 첫 번째로 호출하세요.",
    strict: true,
    parameters: ideaParameters,
  },
  {
    type: "function",
    name: "search_competitors",
    description: "웹 검색으로 이 아이디어가 한국 시장에 진입할 때의 직접·간접 경쟁사를 조사합니다. search_similar_cases 다음에 호출하세요.",
    strict: true,
    parameters: ideaParameters,
  },
  {
    type: "function",
    name: "research_market",
    description: "웹 검색으로 시장 규모, 성장률, 타깃 고객을 조사합니다. search_competitors 다음에 호출하세요.",
    strict: true,
    parameters: ideaParameters,
  },
  {
    type: "function",
    name: "save_report",
    description: "세 조사 결과를 바탕으로 검증 리포트를 Supabase에 저장합니다. 출처는 서버가 조사 결과에서 자동으로 붙입니다. 마지막 도구로 호출하세요.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "리포트 제목" },
        summary: { type: "string", description: "검증 결론 요약 2~4문장" },
        similar_cases: {
          type: "array",
          description: "유사 사례 1~6개",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              region: { type: "string", enum: ["국내", "해외"] },
              description: { type: "string", description: "무엇을 하는 서비스인지와 현재 상태" },
              takeaway: { type: "string", description: "이 아이디어에 주는 교훈" },
            },
            required: ["name", "region", "description", "takeaway"],
            additionalProperties: false,
          },
        },
        competitors: {
          type: "array",
          description: "진입 시 경쟁사 1~8개",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: { type: "string", enum: ["직접", "간접"] },
              offering: { type: "string", description: "핵심 제공 가치와 수익 모델" },
              strength: { type: "string" },
              weakness: { type: "string" },
            },
            required: ["name", "type", "offering", "strength", "weakness"],
            additionalProperties: false,
          },
        },
        market: {
          type: "object",
          properties: {
            size: { type: "string", description: "시장 규모 (기준 연도·출처 기관 포함)" },
            growth: { type: "string", description: "성장률 또는 추세 (기준 연도·출처 기관 포함)" },
            target_customers: { type: "string", description: "핵심 타깃 고객과 그 근거" },
          },
          required: ["size", "growth", "target_customers"],
          additionalProperties: false,
        },
      },
      required: ["title", "summary", "similar_cases", "competitors", "market"],
      additionalProperties: false,
    },
  },
];
