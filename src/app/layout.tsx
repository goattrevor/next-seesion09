import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "광고 모델 추천 에이전트",
  description: "제품에 맞는 인스타그램·유튜브·틱톡 크리에이터를 찾아 순위를 매기는 에이전트",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
