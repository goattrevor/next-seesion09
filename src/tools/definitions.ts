import type OpenAI from "openai";
import { PLATFORMS, SHORTLIST_SIZE } from "@/lib/shared";

const platform = { type: "string", enum: [...PLATFORMS], description: "조회할 플랫폼" };

export const toolDefinitions: OpenAI.Responses.FunctionTool[] = [
  {
    type: "function",
    name: "search_creators",
    description:
      "한 플랫폼에서 제품 광고에 어울리는 국내 크리에이터 후보를 새로 찾아야 할 때 사용합니다. "
      + "instagram, youtube, tiktok마다 따로 호출하고, 쓸 만한 후보가 부족하면 키워드를 바꿔 다시 호출합니다. 읽기 전용.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        platform,
        product: { type: "string", description: "제품을 한 문장으로 정리한 것" },
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "크리에이터 콘텐츠 주제를 찾을 검색 키워드 1~5개 (예: 비건 뷰티, 민감성 피부)",
        },
      },
      required: ["platform", "product", "keywords"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_creator_stats",
    description:
      "검색으로 찾은 후보를 순위에 넣기 전, 팔로워·평균 조회수·최근 콘텐츠 주제를 확인해야 할 때 사용합니다. "
      + "순위에 넣을 후보는 반드시 이 도구로 먼저 확인해야 합니다. 읽기 전용.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        platform,
        handle: { type: "string", description: "검색 결과에 나온 핸들 (예: @creator_id)" },
      },
      required: ["platform", "handle"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "save_shortlist",
    description:
      `지표를 확인한 후보 중 상위 ${SHORTLIST_SIZE}명의 순위가 확정됐을 때 한 번만 호출해 추천 리스트를 저장합니다. `
      + "팔로워·조회수·URL·출처는 서버가 확인된 값으로 채우므로 적지 않습니다. 쓰기 작업.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        product: { type: "string", description: "제품 한 문장 요약" },
        target_customer: { type: "string", description: "타깃 고객 한 문장 요약" },
        summary: { type: "string", description: "추천 결과와 순위 근거 요약 2~4문장" },
        creators: {
          type: "array",
          description: `정확히 ${SHORTLIST_SIZE}명, rank 1부터 순서대로`,
          items: {
            type: "object",
            properties: {
              rank: { type: "integer", description: `1~${SHORTLIST_SIZE}` },
              platform,
              handle: { type: "string", description: "get_creator_stats로 확인한 핸들" },
              fit_topic: { type: "string", description: "콘텐츠 주제가 제품과 맞는 근거" },
              fit_audience: { type: "string", description: "시청자층이 타깃 고객과 맞는 근거. 모르면 확인 불가" },
              caution: { type: "string", description: "주의할 점 (경쟁 브랜드 협업, 확인 불가 지표 등). 없으면 없음" },
            },
            required: ["rank", "platform", "handle", "fit_topic", "fit_audience", "caution"],
            additionalProperties: false,
          },
        },
      },
      required: ["product", "target_customer", "summary", "creators"],
      additionalProperties: false,
    },
  },
];
