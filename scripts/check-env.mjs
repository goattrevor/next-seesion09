import { readFileSync, existsSync } from "node:fs";

const envPath = ".env.local";
const values = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !match[1].startsWith("#")) values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

const required = [
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];
const missing = required.filter((key) => !values[key]);
if (missing.length) {
  console.error(`환경변수가 비어 있습니다: ${missing.join(", ")}`);
  console.error("README.md의 설정 절차를 따라 .env.local을 채우세요. 값 자체는 출력하지 않습니다.");
  process.exit(1);
}

if (!/^https:\/\//.test(values.NEXT_PUBLIC_SUPABASE_URL)) {
  console.error("NEXT_PUBLIC_SUPABASE_URL은 https:// 주소여야 합니다.");
  process.exit(1);
}
if (!values.YOUTUBE_API_KEY) {
  console.log("참고: YOUTUBE_API_KEY가 없어 유튜브도 웹 검색으로 조회합니다. (선택 사항)");
}
console.log("필수 환경변수가 설정되어 있습니다. 비밀값은 표시하지 않았습니다.");
