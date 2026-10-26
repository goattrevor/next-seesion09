import OpenAI from "openai";
import { MAX_PROMPT_LENGTH } from "@/lib/shared";
import { AgentRunError, runAgent } from "@/agent/runAgent";

export const runtime = "nodejs";
/* 웹 검색이 여러 번 포함되어 2~5분 걸릴 수 있습니다. Vercel 배포 시 함수 실행 시간 상한을 늘립니다. */
export const maxDuration = 300;

const WINDOW_MS = 60_000;
/* 한 번 실행에 웹 검색이 최대 10회 이상 들어가므로 기존 8회에서 줄였습니다. */
const REQUESTS_PER_WINDOW = 2;
const buckets = new Map<string, { startedAt: number; count: number }>();

function isRateLimited(request: Request) {
  const now = Date.now();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = forwarded || "local";
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.startedAt >= WINDOW_MS) {
    buckets.set(key, { startedAt: now, count: 1 });
    if (buckets.size > 500) {
      for (const [ip, value] of buckets) if (now - value.startedAt >= WINDOW_MS) buckets.delete(ip);
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > REQUESTS_PER_WINDOW;
}

export async function POST(request: Request) {
  if (isRateLimited(request)) {
    return Response.json({ error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "요청 형식을 확인해 주세요." }, { status: 400 });
  }
  const prompt = body && typeof body === "object" && "prompt" in body
    ? (body as { prompt?: unknown }).prompt
    : undefined;
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > MAX_PROMPT_LENGTH) {
    return Response.json({ error: `요청은 1~${MAX_PROMPT_LENGTH}자여야 합니다.` }, { status: 400 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return Response.json({ error: "Supabase 환경변수를 .env.local에 설정해 주세요." }, { status: 503 });
  }

  try {
    return Response.json(await runAgent(prompt.trim()));
  } catch (error) {
    if (error instanceof AgentRunError) {
      return Response.json({ error: error.message, steps: error.steps }, { status: 502 });
    }
    if (error instanceof OpenAI.APIError && error.status === 429) {
      return Response.json({ error: "OpenAI 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    }
    return Response.json({ error: "에이전트 실행에 실패했습니다. 환경 설정과 Supabase 스키마를 확인해 주세요." }, { status: 500 });
  }
}
