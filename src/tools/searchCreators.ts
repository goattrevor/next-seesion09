import "server-only";
import { searchCreatorsPrompt } from "@/config/demo";
import { MIN_FOLLOWERS } from "@/lib/shared";
import type { Platform } from "@/lib/types";
import { runWebSearch } from "@/tools/webSearch";
import { hasYoutubeKey, searchYoutubeChannels } from "@/tools/youtube";

/*
 * 후보 찾기 (읽기 전용).
 * 유튜브는 API 키가 있으면 공식 API로, 나머지는 웹 검색으로 찾습니다.
 * 인스타그램·틱톡은 일반 개발자용 공개 검색 API가 없어 웹 검색을 씁니다.
 */
export async function searchCreators(platform: Platform, product: string, keywords: string[]) {
  if (platform === "youtube" && hasYoutubeKey()) {
    const channels = await searchYoutubeChannels(keywords.join(" "));
    const candidates = channels.filter((channel) => channel.followers === null || channel.followers >= MIN_FOLLOWERS);
    return {
      platform,
      data_source: "youtube_api" as const,
      count: candidates.length,
      candidates: candidates.slice(0, 10),
      sources: [],
    };
  }

  const result = await runWebSearch(searchCreatorsPrompt(platform, product, keywords));
  return {
    platform,
    data_source: "web_search" as const,
    candidates_text: result.text || "검색 결과가 없습니다. 키워드를 바꿔 다시 시도하세요.",
    sources: result.sources,
  };
}
