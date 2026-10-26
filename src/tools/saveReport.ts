import "server-only";
import { getSupabase } from "@/lib/supabase";
import type { ValidationReport } from "@/lib/types";

export type ReportInput = ValidationReport & { prompt: string };

export async function saveReport(input: ReportInput) {
  const { error } = await getSupabase().from("agent_reports").insert({
    prompt: input.prompt,
    title: input.title,
    summary: input.summary,
    similar_cases: input.similar_cases,
    competitors: input.competitors,
    market: input.market,
    sources: input.sources,
  });
  if (error) throw new Error(`리포트 저장에 실패했습니다: ${error.message}`);
  return { saved: true, message: "Supabase agent_reports 테이블에 검증 리포트를 저장했습니다." };
}
