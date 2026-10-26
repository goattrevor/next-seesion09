import "server-only";
import OpenAI from "openai";
import { AGENT_INSTRUCTIONS, MAX_OUTPUT_TOKENS, MODEL, type ResearchFocus } from "@/config/demo";
import { MAX_STEPS } from "@/lib/shared";
import type { AgentRunResult, AgentStep, ToolContext, ValidationReport } from "@/lib/types";
import { toolDefinitions } from "@/tools/definitions";
import { saveReport } from "@/tools/saveReport";
import { webResearch } from "@/tools/webResearch";

export class AgentRunError extends Error {
  constructor(message: string, public readonly steps: AgentStep[]) {
    super(message);
  }
}

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

/* 객체 배열 인자를 검증합니다. 모든 필드는 비어 있지 않은 문자열이어야 합니다. */
function readRecordList<K extends string>(
  value: unknown,
  key: string,
  fields: readonly K[],
  min: number,
  max: number,
): Record<K, string>[] {
  const list = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
  if (!Array.isArray(list) || list.length < min || list.length > max) {
    throw new Error(`${key}는 ${min}~${max}개 항목이어야 합니다.`);
  }
  return list.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`${key}[${index}] 형식이 올바르지 않습니다.`);
    const record = {} as Record<K, string>;
    for (const field of fields) record[field] = readString(item, field, 400);
    return record;
  });
}

/* 함수 도구 이름 → 웹 조사 주제. 세 도구는 같은 서버 함수를 다른 프롬프트로 실행합니다. */
const RESEARCH_TOOLS: Record<string, ResearchFocus> = {
  search_similar_cases: "similar_cases",
  search_competitors: "competitors",
  research_market: "market",
};

const STEP_LABELS: Record<string, string> = {
  search_similar_cases: "유사 사례 조사",
  search_competitors: "경쟁사 조사",
  research_market: "시장 규모·타깃 조사",
  save_report: "리포트 저장",
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

  const focus = RESEARCH_TOOLS[name];
  if (focus) {
    /* 조사 순서를 서버에서도 강제합니다: 유사 사례 → 경쟁사 → 시장 */
    if (focus === "competitors" && !context.hasSimilarCases) throw new Error("먼저 search_similar_cases를 호출하세요.");
    if (focus === "market" && !context.hasCompetitors) throw new Error("먼저 search_competitors를 호출하세요.");
    const idea = readString(args, "idea", 300);
    const result = await webResearch(focus, idea);
    for (const source of result.sources) context.sources.set(source.url, source);
    if (focus === "similar_cases") context.hasSimilarCases = true;
    if (focus === "competitors") context.hasCompetitors = true;
    if (focus === "market") context.hasMarket = true;
    return { value: result, input: idea, output: `웹 조사를 마쳤습니다. 출처 ${result.sources.length}개` };
  }

  if (name === "save_report") {
    /* 목표: 리포트 1건을 저장하면 종료합니다. 두 번째 저장은 막습니다. */
    if (context.report) throw new Error("리포트는 이미 저장했습니다. 최종 요약만 답하세요.");
    if (!context.hasSimilarCases || !context.hasCompetitors || !context.hasMarket) {
      throw new Error("유사 사례·경쟁사·시장 조사를 먼저 실행하세요.");
    }
    const marketArgs = args && typeof args === "object" ? (args as Record<string, unknown>).market : undefined;
    const report: ValidationReport = {
      title: readString(args, "title", 120),
      summary: readString(args, "summary", 1000),
      similar_cases: readRecordList(args, "similar_cases", ["name", "region", "description", "takeaway"] as const, 1, 6),
      competitors: readRecordList(args, "competitors", ["name", "type", "offering", "strength", "weakness"] as const, 1, 8),
      market: {
        size: readString(marketArgs, "size", 400),
        growth: readString(marketArgs, "growth", 400),
        target_customers: readString(marketArgs, "target_customers", 600),
      },
      /* 모델이 쓴 URL이 아니라 웹 조사 도구가 실제로 반환한 출처만 저장합니다. */
      sources: [...context.sources.values()].slice(0, 20),
    };
    const result = await saveReport({ prompt, ...report });
    context.report = report;
    return { value: result, input: report.title, output: result.message };
  }

  throw new Error(`등록되지 않은 도구입니다: ${name}`);
}

export async function runAgent(prompt: string): Promise<AgentRunResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new AgentRunError("OPENAI_API_KEY를 .env.local에 설정하세요.", []);

  const client = new OpenAI({ apiKey, timeout: 90_000, maxRetries: 0 });
  const steps: AgentStep[] = [];
  const context: ToolContext = {
    hasSimilarCases: false,
    hasCompetitors: false,
    hasMarket: false,
    sources: new Map(),
    report: null,
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
      return { reply, steps, reportSaved, report: context.report };
    }

    const outputs: OpenAI.Responses.ResponseInputItem[] = [];
    for (const call of calls) {
      const labels = STEP_LABELS;
      try {
        const result = await executeTool(call.name, call.arguments, prompt, context);
        steps.push({ name: call.name, label: labels[call.name] ?? call.name, input: result.input, output: result.output, status: "done" });
        if (call.name === "save_report") reportSaved = true;
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
