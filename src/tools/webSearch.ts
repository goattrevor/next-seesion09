import "server-only";
import OpenAI from "openai";
import { MODEL, WEB_SEARCH_INSTRUCTIONS } from "@/config/demo";
import type { Source } from "@/lib/types";

/*
 * 웹 검색 하위 호출.
 * 에이전트 루프에는 함수 도구만 등록하고, 실제 웹 검색은 이 서버 함수 안에서
 * 별도 Responses API 호출(web_search 내장 도구, 한국 위치 기준)로 실행합니다.
 * 덕분에 runAgent.ts의 call_id ↔ function_call_output 연결은 그대로 유지됩니다.
 */

const MAX_TEXT_LENGTH = 3500;
const MAX_SOURCES = 8;

export async function runWebSearch(input: string, contextSize: "low" | "medium" = "medium") {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY를 .env.local에 설정하세요.");

  const client = new OpenAI({ apiKey, timeout: 120_000, maxRetries: 0 });
  const response = await client.responses.create({
    model: MODEL,
    instructions: WEB_SEARCH_INSTRUCTIONS,
    input,
    tools: [{
      type: "web_search",
      search_context_size: contextSize,
      user_location: { type: "approximate", country: "KR", timezone: "Asia/Seoul" },
    }],
    max_output_tokens: 5000,
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

  const text = response.output_text?.trim() ?? "";
  return {
    text: text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH)}…` : text,
    sources: [...sources.values()].slice(0, MAX_SOURCES),
  };
}

/* "12.5만", "1.2M", "125,000명", "3천" 같은 표기를 숫자로 바꿉니다. 못 읽으면 null. */
export function parseCount(raw: string | undefined | null): number | null {
  if (!raw || /확인\s*불가/.test(raw)) return null;
  /* "(2026년 10월 기준)" 같은 날짜·괄호 설명을 먼저 지워 연도를 숫자로 읽지 않게 합니다. */
  const cleaned = raw
    .replace(/\([^)]*\)/g, " ")
    .replace(/\d{4}\s*년(\s*\d{1,2}\s*월)?(\s*\d{1,2}\s*일)?/g, " ")
    .replace(/,/g, "");
  const match = cleaned.match(/(\d+(?:\.\d+)?)\s*(만|천|억|[kKmM])?/);
  if (!match) return null;
  const units: Record<string, number> = { 천: 1e3, 만: 1e4, 억: 1e8, k: 1e3, K: 1e3, m: 1e6, M: 1e6 };
  const value = Number(match[1]) * (match[2] ? units[match[2]] : 1);
  return Number.isFinite(value) ? Math.round(value) : null;
}
