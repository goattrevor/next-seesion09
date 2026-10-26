export const DEMO_PROMPT = "제품: 피부 자극이 적은 비건 선크림\n타깃 고객: 피부 고민이 많은 20대 대학생·사회초년생";
/*
 * 플랫폼별 검색 3회 + 후보 지표 확인 5~8회 + 저장 1회 + 최종 답변 1회.
 * 재검색 여유를 두어 16회로 잡았습니다. 늘리기 전에 비용을 확인하세요.
 */
export const MAX_STEPS = 16;
export const MAX_PROMPT_LENGTH = 500;
export const SHORTLIST_SIZE = 5;
export const MIN_FOLLOWERS = 10_000;
export const PLATFORMS = ["instagram", "youtube", "tiktok"] as const;
