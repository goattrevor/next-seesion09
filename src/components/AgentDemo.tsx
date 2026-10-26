"use client";

import { useState, type FormEvent } from "react";
import { DEMO_PROMPT, MAX_PROMPT_LENGTH, MAX_STEPS, SHORTLIST_SIZE } from "@/lib/shared";
import type { AgentRunResult, AgentStep, Platform, Shortlist } from "@/lib/types";

type RunState = "idle" | "running" | "done" | "error";

export default function AgentDemo() {
  const [prompt, setPrompt] = useState(DEMO_PROMPT);
  const [state, setState] = useState<RunState>("idle");
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [reportSaved, setReportSaved] = useState(false);
  const [shortlist, setShortlist] = useState<Shortlist | null>(null);

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "running" || !prompt.trim()) return;
    setState("running");
    setSteps([]);
    setReply("");
    setError("");
    setReportSaved(false);
    setShortlist(null);
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = (await response.json()) as Partial<AgentRunResult> & {
        error?: string;
      };
      setSteps(data.steps ?? []);
      if (!response.ok)
        throw new Error(data.error || "에이전트를 실행하지 못했습니다.");
      if (typeof data.reply !== "string")
        throw new Error("에이전트 응답이 비어 있습니다.");
      setReply(data.reply);
      setReportSaved(Boolean(data.reportSaved));
      setShortlist(data.shortlist ?? null);
      setState("done");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "연결 오류가 발생했습니다.",
      );
      setState("error");
    }
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <span className="session-tag">
          SESSION 09 <b>·</b> AGENT
        </span>
      </header>

      <section className="hero" id="top">
        <h1>
          제품을 넣으면,
          <br />
          <em>어울리는 광고 모델을 찾는</em> 에이전트
        </h1>
        <p className="lede">
          에이전트가 인스타그램·유튜브·틱톡에서 팔로워 1만 이상 크리에이터를
          찾고 지표를 확인해
          <br className="desktop-break" /> 제품과 잘 맞는 순서로 5명의 순위를
          매겨 저장합니다.
        </p>
      </section>

      <section className="demo-grid" aria-label="에이전트 실행 데모">
        <div className="run-card">
          <div className="card-heading">
            <div>
              <h2>광고 모델 찾기</h2>
            </div>
            <span className="step-limit">
              MAX_STEPS <b>{MAX_STEPS}</b>
            </span>
          </div>
          <form onSubmit={run}>
            <label htmlFor="prompt">제품 설명과 타깃 고객을 입력하세요</label>
            <textarea
              id="prompt"
              value={prompt}
              maxLength={MAX_PROMPT_LENGTH}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              disabled={state === "running"}
            />
            <div className="form-foot">
              <span>
                {prompt.length} / {MAX_PROMPT_LENGTH}
              </span>
              <button
                type="submit"
                disabled={state === "running" || !prompt.trim()}
              >
                {state === "running" ? (
                  <>
                    <span className="spinner" /> 실행 중
                  </>
                ) : (
                  <>
                    에이전트 실행 <span aria-hidden="true">↗</span>
                  </>
                )}
              </button>
            </div>
          </form>
          <p className="data-note">
            웹 검색이 여러 번 포함되어 2~5분 정도 걸립니다. 에이전트는
            크리에이터에게 연락하지 않으며, 지표는 반드시 프로필을 열어 직접
            확인하세요.
          </p>
        </div>

        <aside className="trace-card" aria-live="polite">
          <div className="trace-heading">
            <div>
              <h2>실행 로그</h2>
            </div>
            <span className={`run-status ${state}`}>
              <i />
              {state === "running"
                ? "RUNNING"
                : state === "done"
                  ? "COMPLETE"
                  : state === "error"
                    ? "FAILED"
                    : "READY"}
            </span>
          </div>
          <div className="trace-list">
            {steps.length === 0 && state !== "running" && (
              <div className="trace-empty">
                <span className="empty-orbit">◎</span>
                <p>
                  실행하면 도구 선택과
                  <br />
                  결과가 여기에 표시됩니다.
                </p>
              </div>
            )}
            {state === "running" && steps.length === 0 && (
              <div className="trace-empty">
                <span className="empty-orbit pulse">◎</span>
                <p>
                  제품을 읽고 찾을
                  <br />
                  크리에이터를 고르고 있어요…
                </p>
              </div>
            )}
            {steps.map((step, index) => (
              <article
                className={`trace-step ${step.status}`}
                key={`${step.name}-${index}`}
              >
                <div className="trace-index">
                  {String(index).padStart(2, "0")}
                </div>
                <div className="trace-content">
                  <div className="trace-title">
                    <strong>{step.label}</strong>
                    <span>{step.status === "done" ? "DONE" : "ERROR"}</span>
                  </div>
                  <p>{step.output}</p>
                  <small>입력 · {step.input}</small>
                </div>
              </article>
            ))}
            {state === "running" && steps.length > 0 && (
              <div className="trace-wait">
                <span className="spinner dark" /> 다음 도구를 기다리는 중
              </div>
            )}
          </div>
          {error && (
            <div className="error-box" role="alert">
              <strong>실행이 멈췄어요</strong>
              <p>{error}</p>
              <small>
                supabase/schema.sql 적용 여부와 .env.local 설정을 확인해 주세요.
              </small>
            </div>
          )}
          {reply && (
            <div className="result-box">
              <div className="result-title">
                <span>에이전트 결과</span>
                {reportSaved && (
                  <b>
                    <i /> Supabase 저장 완료
                  </b>
                )}
              </div>
              <p>{reply}</p>
            </div>
          )}
        </aside>
      </section>

      {shortlist && <ShortlistView shortlist={shortlist} />}

      <footer></footer>
    </main>
  );
}

/* 추천 리스트: 1~5위 크리에이터 · 적합 근거 · 확인된 지표 · 출처 */
const PLATFORM_NAME: Record<Platform, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
};

function formatCount(value: number | null) {
  if (value === null) return "확인 불가";
  if (value >= 10_000) return `${(value / 10_000).toFixed(value >= 100_000 ? 0 : 1)}만`;
  return value.toLocaleString("ko-KR");
}

function ShortlistView({ shortlist }: { shortlist: Shortlist }) {
  return (
    <section className="report-card" aria-label="광고 모델 추천 리스트">
      <p className="report-kicker">CREATOR SHORTLIST · TOP {SHORTLIST_SIZE}</p>
      <h2>{shortlist.product}</h2>
      <p className="report-target">타깃 · {shortlist.target_customer}</p>
      <p className="report-summary">{shortlist.summary}</p>

      <ol className="rank-list">
        {shortlist.creators.map((creator) => (
          <li className="rank-item" key={`${creator.platform}-${creator.handle}`}>
            <div className="rank-number">{creator.rank}</div>
            <div className="rank-body">
              <div className="rank-head">
                <div>
                  <strong>{creator.name}</strong>
                  {creator.url ? (
                    <a href={creator.url} target="_blank" rel="noreferrer noopener">
                      {creator.handle}
                    </a>
                  ) : (
                    <span>{creator.handle}</span>
                  )}
                </div>
                <em className={`platform-chip ${creator.platform}`}>{PLATFORM_NAME[creator.platform]}</em>
              </div>
              <dl className="rank-stats">
                <div>
                  <dt>팔로워</dt>
                  <dd>{formatCount(creator.followers)}</dd>
                </div>
                <div>
                  <dt>평균 조회수</dt>
                  <dd>{formatCount(creator.average_views)}</dd>
                </div>
              </dl>
              <p>
                <b>콘텐츠 적합</b> {creator.fit_topic}
              </p>
              <p>
                <b>타깃 적합</b> {creator.fit_audience}
              </p>
              {creator.caution && creator.caution !== "없음" && (
                <small>주의 · {creator.caution}</small>
              )}
            </div>
          </li>
        ))}
      </ol>

      {shortlist.sources.length > 0 && (
        <div className="report-section">
          <h3>
            <span>SRC</span> 출처
          </h3>
          <ol className="source-list">
            {shortlist.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer noopener">
                  {source.title}
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
