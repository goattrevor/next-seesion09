import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "아이디어 검증 에이전트",
  description: "아이디어를 입력하면 유사 사례·경쟁사·시장을 조사해 검증 리포트를 작성하는 에이전트",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
