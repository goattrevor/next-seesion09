import "server-only";
import OpenAI from "openai";
import { AGENT_INSTRUCTIONS, MAX_OUTPUT_TOKENS, MODEL } from "@/config/demo";
import { MAX_STEPS, MIN_FOLLOWERS, PLATFORMS, SHORTLIST_SIZE } from "@/lib/shared";
import type { AgentRunResult, AgentStep, Platform, RankedCreator, ToolContext } from "@/lib/types";
import { toolDefinitions } from "@/tools/definitions";
import { getCreatorStats } from "@/tools/getCreatorStats";
import { saveShortlist } from "@/tools/saveShortlist";
import { searchCreators } from "@/tools/searchCreators";

export class AgentRunError extends Error {
  constructor(message: string, public readonly steps: AgentStep[]) {
    super(message);
  }
}

/* 지표를 확인할 수 있는 후보 수 상한 (웹 검색 비용 제한) */
const MAX_CHECKED_CREATORS = 10;

function readString(value: unknown, key: string, max = 800): string {
  if (!value || typeof value !== "object" || !(key in value)) {
    throw new Error(`도구 입력에 ${key} 값이 없습니다.`);
  }
  const result = (value as Record<string, unknown>)[key];
  if (typeof result !== "string" || !result.trim() || result.length > max) {
    throw new Error(`${key} 값은 1~${max}자 텍스트여야 합니다.`);
  }
  return result.trim();
}

function readPlatform(value: unknown): Platform {
  const platform = readString(value, "platform", 20);
  if (!(PLATFORMS as readonly string[]).includes(platform)) {
    throw new Error(`platform은 ${PLATFORMS.join(", ")} 중 하나여야 합니다.`);
  }
  return platform as Platform;
}

/* "@Creator_ID/" → "creator_id". 같은 사람을 같은 키로 찾기 위한 정규화입니다. */
function creatorKey(platform: Platform, handle: string) {
  return `${platform}:${handle.trim().replace(/^@/, "").replace(/\/+$/, "").toLowerCase()}`;
}

/*
 * 모델이 고칠 수 있는 규칙 위반은 실행을 멈추지 않고 도구 결과로 돌려줍니다.
 * 루프는 그대로 두고, 모델이 다음 라운드에서 다시 시도하게 합니다.
 */
function reject(reason: string) {
  return { value: { ok: false, error: reason }, input: "규칙 검증", output: `거절: ${reason}` };
}

const STEP_LABELS: Record<string, string> = {
  search_creators: "후보 검색",
  get_creator_stats: "지표 확인",
  save_shortlist: "추천 리스트 저장",
};

async function executeTool(
  name: string,
  rawArguments: string,
  prompt: string,
  context: ToolContext,
): Promise<{ value: unknown; input: string; output: string }> {
  let args: unknown;
  try {
    args = JSON.parse(rawArguments);
  } catch {
    throw new Error("도구 인자를 JSON으로 읽지 못했습니다.");
  }

  if (name === "search_creators") {
    const platform = readPlatform(args);
    const product = readString(args, "product", 300);
    const rawKeywords = (args as { keywords?: unknown }).keywords;
    if (!Array.isArray(rawKeywords) || rawKeywords.length < 1 || rawKeywords.length > 5
      || rawKeywords.some((item) => typeof item !== "string" || !item.trim() || item.length > 40)) {
      throw new Error("keywords는 1~5개의 40자 이내 단어여야 합니다.");
    }
    const keywords = (rawKeywords as string[]).map((item) => item.trim());
    const result = await searchCreators(platform, product, keywords);
    for (const source of result.sources) context.sources.set(source.url, source);
    context.searchedPlatforms.add(platform);
    const found = "count" in result ? `후보 ${result.count}명 (YouTube API)` : `웹 검색 완료, 출처 ${result.sources.length}개`;
    return { value: result, input: `${platform} · ${keywords.join(", ")}`, output: found };
  }

  if (name === "get_creator_stats") {
    const platform = readPlatform(args);
    const handle = readString(args, "handle", 100);
    if (!context.searchedPlatforms.has(platform)) {
      return reject(`먼저 search_creators로 ${platform} 후보를 찾으세요.`);
    }
    const key = creatorKey(platform, handle);
    const cached = context.checkedCreators.get(key);
    if (cached) return { value: cached, input: `${platform} ${handle}`, output: "이미 확인한 후보입니다." };
    if (context.checkedCreators.size >= MAX_CHECKED_CREATORS) {
      return reject(`지표 확인은 최대 ${MAX_CHECKED_CREATORS}명까지입니다. 확인한 후보 중에서 순위를 정하세요.`);
    }
    const { stats, sources } = await getCreatorStats(platform, handle);
    for (const source of sources) context.sources.set(source.url, source);
    context.checkedCreators.set(key, stats);
    /* API가 돌려준 정식 핸들로도 찾을 수 있게 같은 값을 한 번 더 등록합니다. */
    context.checkedCreators.set(creatorKey(platform, stats.handle), stats);
    const followers = stats.followers === null ? "팔로워 확인 불가" : `팔로워 ${stats.followers.toLocaleString("ko-KR")}`;
    return {
      value: stats,
      input: `${platform} ${handle}`,
      output: stats.found ? `${stats.name ?? handle} · ${followers}` : "계정을 찾지 못했습니다.",
    };
  }

  if (name === "save_shortlist") {
    /* 목표: 추천 리스트 1건을 저장하면 종료합니다. */
    if (context.shortlist) return reject("추천 리스트는 이미 저장했습니다. 최종 요약만 답하세요.");

    const rawCreators = (args as { creators?: unknown }).creators;
    if (!Array.isArray(rawCreators) || rawCreators.length !== SHORTLIST_SIZE) {
      return reject(`creators는 정확히 ${SHORTLIST_SIZE}명이어야 합니다.`);
    }

    const creators: RankedCreator[] = [];
    const seen = new Set<string>();
    for (const item of rawCreators) {
      const platform = readPlatform(item);
      const handle = readString(item, "handle", 100);
      const rank = (item as { rank?: unknown }).rank;
      const key = creatorKey(platform, handle);
      const stats = context.checkedCreators.get(key);
      if (!stats || !stats.found) return reject(`${platform} ${handle}은 get_creator_stats로 확인되지 않았습니다.`);
      if (seen.has(key)) return reject(`${handle}이 두 번 들어 있습니다.`);
      if (stats.followers !== null && stats.followers < MIN_FOLLOWERS) {
        return reject(`${handle}의 팔로워가 ${MIN_FOLLOWERS.toLocaleString("ko-KR")}명 미만입니다. 다른 후보로 바꾸세요.`);
      }
      seen.add(key);
      creators.push({
        rank: typeof rank === "number" ? rank : -1,
        platform,
        handle: stats.handle,
        /* 이름·URL·지표는 모델이 쓴 값이 아니라 확인된 값만 씁니다. */
        name: stats.name ?? stats.handle,
        url: stats.url,
        followers: stats.followers,
        average_views: stats.average_views,
        fit_topic: readString(item, "fit_topic", 400),
        fit_audience: readString(item, "fit_audience", 400),
        caution: readString(item, "caution", 300),
      });
    }
    const ranks = creators.map((creator) => creator.rank).sort((a, b) => a - b);
    if (ranks.some((rank, index) => rank !== index + 1)) {
      return reject(`rank는 1~${SHORTLIST_SIZE}가 한 번씩 들어가야 합니다.`);
    }
    creators.sort((a, b) => a.rank - b.rank);

    const shortlist = {
      product: readString(args, "product", 300),
      target_customer: readString(args, "target_customer", 300),
      summary: readString(args, "summary", 1000),
      creators,
      sources: [...context.sources.values()].slice(0, 20),
    };
    const result = await saveShortlist({ prompt, ...shortlist });
    context.shortlist = shortlist;
    return { value: result, input: `${SHORTLIST_SIZE}명 순위`, output: result.message };
  }

  throw new Error(`등록되지 않은 도구입니다: ${name}`);
}

export async function runAgent(prompt: string): Promise<AgentRunResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new AgentRunError("OPENAI_API_KEY를 .env.local에 설정하세요.", []);

  const client = new OpenAI({ apiKey, timeout: 90_000, maxRetries: 0 });
  const steps: AgentStep[] = [];
  const context: ToolContext = {
    searchedPlatforms: new Set(),
    checkedCreators: new Map(),
    sources: new Map(),
    shortlist: null,
  };
  let conversation: OpenAI.Responses.ResponseInputItem[] = [{ role: "user", content: prompt }];
  let reportSaved = false;

  for (let round = 0; round < MAX_STEPS; round += 1) {
    let response: OpenAI.Responses.Response;
    try {
      response = await client.responses.create({
        model: MODEL,
        instructions: AGENT_INSTRUCTIONS,
        input: conversation,
        tools: toolDefinitions,
        tool_choice: "auto",
        parallel_tool_calls: false,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        store: false,
      });
    } catch (error) {
      const message = error instanceof OpenAI.APIError && error.status === 429
        ? "OpenAI 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요."
        : "OpenAI 응답을 받지 못했습니다. API 키와 모델 설정을 확인해 주세요.";
      throw new AgentRunError(message, steps);
    }

    const calls = response.output.filter(
      (item): item is OpenAI.Responses.ResponseFunctionToolCall => item.type === "function_call",
    );
    if (calls.length === 0) {
      const reply = response.output_text?.trim();
      if (!reply) throw new AgentRunError("에이전트 응답이 비어 있습니다.", steps);
      return { reply, steps, reportSaved, shortlist: context.shortlist };
    }

    const outputs: OpenAI.Responses.ResponseInputItem[] = [];
    for (const call of calls) {
      const labels = STEP_LABELS;
      try {
        const result = await executeTool(call.name, call.arguments, prompt, context);
        steps.push({ name: call.name, label: labels[call.name] ?? call.name, input: result.input, output: result.output, status: "done" });
        if (call.name === "save_shortlist" && context.shortlist) reportSaved = true;
        outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result.value) });
      } catch (error) {
        const message = error instanceof Error ? error.message : "도구 실행에 실패했습니다.";
        steps.push({ name: call.name, label: labels[call.name] ?? call.name, input: "인자 검증", output: message, status: "error" });
        throw new AgentRunError(message, steps);
      }
    }

    // 이 요청에는 함수 도구만 등록했으므로 모델 응답을 다음 입력 대화에 이어 붙입니다.
    const responseItems = response.output as OpenAI.Responses.ResponseInputItem[];
    conversation = [...conversation, ...responseItems, ...outputs];
  }

  throw new AgentRunError(`최대 ${MAX_STEPS}회 안에 작업을 마치지 못했습니다.`, steps);
}
