import "server-only";
import OpenAI from "openai";
import { MODEL, RESEARCH_INSTRUCTIONS, RESEARCH_PROMPTS, type ResearchFocus } from "@/config/demo";
import type { Source } from "@/lib/types";

/*
 * 웹 조사 도구.
 * 에이전트 루프에는 함수 도구만 등록하고, 실제 웹 검색은 이 서버 함수 안에서
 * 별도 Responses API 호출(web_search 내장 도구)로 실행합니다.
 * 덕분에 runAgent.ts의 call_id ↔ function_call_output 연결은 그대로 유지됩니다.
 */

const MAX_NOTES_LENGTH = 4000;
const MAX_SOURCES = 8;

export async function webResearch(focus: ResearchFocus, idea: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY를 .env.local에 설정하세요.");

  const client = new OpenAI({ apiKey, timeout: 120_000, maxRetries: 0 });
  const response = await client.responses.create({
    model: MODEL,
    instructions: RESEARCH_INSTRUCTIONS,
    input: RESEARCH_PROMPTS[focus](idea),
    tools: [{
      type: "web_search",
      search_context_size: "medium",
      user_location: { type: "approximate", country: "KR", timezone: "Asia/Seoul" },
    }],
    max_output_tokens: 6000,
    store: false,
  });

  /* 모델이 답변에 실제로 인용한 URL만 출처로 모읍니다. */
  const sources = new Map<string, Source>();
  for (const item of response.output) {
    if (item.type !== "message") continue;
    for (const part of item.content) {
      if (part.type !== "output_text") continue;
      for (const annotation of part.annotations) {
        if (annotation.type !== "url_citation" || sources.has(annotation.url)) continue;
        sources.set(annotation.url, { title: annotation.title || annotation.url, url: annotation.url });
      }
    }
  }

  const notes = response.output_text?.trim();
  if (!notes) throw new Error("웹 조사 결과가 비어 있습니다. 잠시 후 다시 시도해 주세요.");

  return {
    focus,
    idea,
    notes: notes.length > MAX_NOTES_LENGTH ? `${notes.slice(0, MAX_NOTES_LENGTH)}…` : notes,
    sources: [...sources.values()].slice(0, MAX_SOURCES),
  };
}
