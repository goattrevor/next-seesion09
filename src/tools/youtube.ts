import "server-only";

/*
 * YouTube Data API v3 (읽기 전용).
 * YOUTUBE_API_KEY가 없으면 null을 돌려주고, 호출한 쪽이 웹 검색으로 대신합니다.
 */

const API = "https://www.googleapis.com/youtube/v3";

type Channel = {
  id: string;
  snippet: { title: string; description: string; customUrl?: string };
  statistics: { subscriberCount?: string; hiddenSubscriberCount?: boolean; viewCount?: string };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
};

function apiKey() {
  return process.env.YOUTUBE_API_KEY?.trim() || null;
}

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = apiKey();
  if (!key) throw new Error("YOUTUBE_API_KEY가 없습니다.");
  const url = `${API}/${path}?${new URLSearchParams({ ...params, key })}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    /* 오류 본문에 키가 섞일 수 있어 상태 코드만 남깁니다. */
    throw new Error(`YouTube API 호출에 실패했습니다 (HTTP ${response.status}).`);
  }
  return response.json() as Promise<T>;
}

function toCreator(channel: Channel) {
  const handle = channel.snippet.customUrl ?? channel.id;
  const followers = channel.statistics.hiddenSubscriberCount
    ? null
    : Number(channel.statistics.subscriberCount ?? NaN);
  return {
    name: channel.snippet.title,
    handle: handle.startsWith("@") ? handle : `@${handle}`,
    url: channel.snippet.customUrl
      ? `https://www.youtube.com/${channel.snippet.customUrl}`
      : `https://www.youtube.com/channel/${channel.id}`,
    followers: Number.isFinite(followers) ? followers : null,
    description: channel.snippet.description.slice(0, 200),
  };
}

export function hasYoutubeKey() {
  return apiKey() !== null;
}

export async function searchYoutubeChannels(query: string) {
  const search = await get<{ items: { id: { channelId: string } }[] }>("search", {
    part: "snippet",
    type: "channel",
    q: query,
    regionCode: "KR",
    relevanceLanguage: "ko",
    maxResults: "15",
  });
  const ids = search.items.map((item) => item.id.channelId).filter(Boolean);
  if (ids.length === 0) return [];
  const channels = await get<{ items: Channel[] }>("channels", { part: "snippet,statistics", id: ids.join(",") });
  return channels.items.map(toCreator);
}

export async function getYoutubeChannelStats(handle: string) {
  const channels = await get<{ items?: Channel[] }>("channels", {
    part: "snippet,statistics,contentDetails",
    forHandle: handle.startsWith("@") ? handle : `@${handle}`,
  });
  const channel = channels.items?.[0];
  if (!channel) return null;

  /* 최근 업로드 10개의 평균 조회수와 제목으로 콘텐츠 주제를 파악합니다. */
  let averageViews: number | null = null;
  let recentTitles: string[] = [];
  const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
  if (uploads) {
    const playlist = await get<{ items: { contentDetails: { videoId: string } }[] }>("playlistItems", {
      part: "contentDetails",
      playlistId: uploads,
      maxResults: "10",
    });
    const videoIds = playlist.items.map((item) => item.contentDetails.videoId);
    if (videoIds.length > 0) {
      const videos = await get<{ items: { snippet: { title: string }; statistics: { viewCount?: string } }[] }>(
        "videos",
        { part: "snippet,statistics", id: videoIds.join(",") },
      );
      const views = videos.items.map((video) => Number(video.statistics.viewCount ?? NaN)).filter(Number.isFinite);
      averageViews = views.length ? Math.round(views.reduce((sum, value) => sum + value, 0) / views.length) : null;
      recentTitles = videos.items.map((video) => video.snippet.title);
    }
  }
  return { ...toCreator(channel), averageViews, recentTitles };
}
