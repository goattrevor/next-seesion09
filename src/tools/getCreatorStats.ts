import "server-only";
import { creatorStatsPrompt } from "@/config/demo";
import type { CreatorStats, Platform, Source } from "@/lib/types";
import { parseCount, runWebSearch } from "@/tools/webSearch";
import { getYoutubeChannelStats, hasYoutubeKey } from "@/tools/youtube";

/* 웹 검색 답변의 "항목: 값" 줄에서 값을 꺼냅니다. */
function readLine(text: string, label: string) {
  const line = text.split("\n").find((row) => row.replace(/^[\s*-]+/, "").startsWith(label));
  const value = line?.split(/[:：]/).slice(1).join(":").trim();
  return value && !/확인\s*불가/.test(value) ? value : null;
}

/* 지표 확인 (읽기 전용). 확인하지 못한 항목은 null과 unverified 목록으로 표시합니다. */
export async function getCreatorStats(
  platform: Platform,
  handle: string,
): Promise<{ stats: CreatorStats; sources: Source[] }> {
  if (platform === "youtube" && hasYoutubeKey()) {
    const channel = await getYoutubeChannelStats(handle);
    if (!channel) {
      return {
        stats: {
          platform, handle, found: false, name: null, url: null, followers: null, average_views: null,
          recent_topics: "채널을 찾지 못했습니다.", data_source: "youtube_api", unverified: ["전체"],
        },
        sources: [],
      };
    }
    const unverified = [
      ...(channel.followers === null ? ["팔로워 수(비공개)"] : []),
      ...(channel.averageViews === null ? ["평균 조회수"] : []),
    ];
    return {
      stats: {
        platform,
        handle: channel.handle,
        found: true,
        name: channel.name,
        url: channel.url,
        followers: channel.followers,
        average_views: channel.averageViews,
        recent_topics: `최근 영상 제목: ${channel.recentTitles.slice(0, 6).join(" / ") || "확인 불가"}`,
        data_source: "youtube_api",
        unverified,
      },
      sources: [{ title: `${channel.name} (YouTube)`, url: channel.url }],
    };
  }

  const result = await runWebSearch(creatorStatsPrompt(platform, handle), "low");
  const followers = parseCount(readLine(result.text, "팔로워 수"));
  const averageViews = parseCount(readLine(result.text, "평균 조회수"));
  const topics = readLine(result.text, "최근 콘텐츠 주제");
  const audience = readLine(result.text, "주 시청자층");
  const unverified = [
    ...(followers === null ? ["팔로워 수"] : []),
    ...(averageViews === null ? ["평균 조회수"] : []),
    ...(topics === null ? ["최근 콘텐츠 주제"] : []),
    ...(audience === null ? ["주 시청자층"] : []),
  ];
  return {
    stats: {
      platform,
      handle,
      found: result.text.length > 0,
      name: readLine(result.text, "이름"),
      url: readLine(result.text, "프로필 URL"),
      followers,
      average_views: averageViews,
      recent_topics: [topics, audience && `주 시청자층: ${audience}`].filter(Boolean).join(" ") || "확인 불가",
      data_source: "web_search",
      unverified,
    },
    sources: result.sources,
  };
}
