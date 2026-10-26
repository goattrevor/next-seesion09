import "server-only";
import { randomUUID } from "node:crypto";
import { getSupabase } from "@/lib/supabase";
import type { Shortlist } from "@/lib/types";

/* 유일한 쓰기 도구. 새 리스트 1건 insert만 하며 수정·삭제는 하지 않습니다. */
export async function saveShortlist(input: Shortlist & { prompt: string }) {
  /* 익명 키에는 읽기 권한을 주지 않으므로 insert 후 select 대신 id를 서버에서 만듭니다. */
  const id = randomUUID();
  const { error } = await getSupabase()
    .from("creator_shortlists")
    .insert({
      id,
      prompt: input.prompt,
      product: input.product,
      target_customer: input.target_customer,
      summary: input.summary,
      creators: input.creators,
      sources: input.sources,
    });
  if (error) throw new Error(`추천 리스트 저장에 실패했습니다: ${error.message}`);
  return { saved: true, id, message: "Supabase creator_shortlists 테이블에 추천 리스트를 저장했습니다." };
}
