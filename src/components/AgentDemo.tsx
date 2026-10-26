"use client";

import { useState, type FormEvent } from "react";
import { DEMO_PROMPT, MAX_PROMPT_LENGTH, MAX_STEPS } from "@/lib/shared";
import type { AgentRunResult, AgentStep, ValidationReport } from "@/lib/types";

type RunState = "idle" | "running" | "done" | "error";

export default function AgentDemo() {
  const [prompt, setPrompt] = useState(DEMO_PROMPT);
  const [state, setState] = useState<RunState>("idle");
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [reportSaved, setReportSaved] = useState(false);
  const [report, setReport] = useState<ValidationReport | null>(null);

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "running" || !prompt.trim()) return;
    setState("running");
    setSteps([]);
    setReply("");
    setError("");
    setReportSaved(false);
    setReport(null);
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
      setReport(data.report ?? null);
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
          아이디어를 넣으면,
          <br />
          <em>시장을 조사해 검증하는</em> 에이전트
        </h1>
        <p className="lede">
          에이전트가 웹을 검색해 유사 사례, 진입 시 경쟁사, 시장 규모와
          타깃을 조사하고
          <br className="desktop-break" /> 출처가 달린 검증 리포트로 정리해
          저장합니다.
        </p>
      </section>

      <section className="demo-grid" aria-label="에이전트 실행 데모">
        <div className="run-card">
          <div className="card-heading">
            <div>
              <h2>아이디어 검증 요청하기</h2>
            </div>
            <span className="step-limit">
              MAX_STEPS <b>{MAX_STEPS}</b>
            </span>
          </div>
          <form onSubmit={run}>
            <label htmlFor="prompt">검증할 아이디어를 입력하세요</label>
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
            웹 조사 3회가 포함되어 1~3분 정도 걸립니다. 수치는 반드시 출처를
            열어 직접 확인하세요.
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
                  아이디어를 정리하고
                  <br />
                  조사를 시작하고 있어요…
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

      {report && <ReportView report={report} />}

      <footer></footer>
    </main>
  );
}

/* 검증 리포트: 유사 사례 · 경쟁사 · 시장 규모와 타깃 · 출처 */
function ReportView({ report }: { report: ValidationReport }) {
  return (
    <section className="report-card" aria-label="검증 리포트">
      <p className="report-kicker">VALIDATION REPORT</p>
      <h2>{report.title}</h2>
      <p className="report-summary">{report.summary}</p>

      <div className="report-section">
        <h3>
          <span>01</span> 유사 사례
        </h3>
        <div className="case-grid">
          {report.similar_cases.map((item, index) => (
            <article className="case-item" key={`${item.name}-${index}`}>
              <div className="case-head">
                <strong>{item.name}</strong>
                <em>{item.region}</em>
              </div>
              <p>{item.description}</p>
              <small>교훈 · {item.takeaway}</small>
            </article>
          ))}
        </div>
      </div>

      <div className="report-section">
        <h3>
          <span>02</span> 진입 시 경쟁사
        </h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>경쟁사</th>
                <th>유형</th>
                <th>제공 가치</th>
                <th>강점</th>
                <th>약점</th>
              </tr>
            </thead>
            <tbody>
              {report.competitors.map((item, index) => (
                <tr key={`${item.name}-${index}`}>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>
                    <span className={`type-chip ${item.type === "직접" ? "direct" : ""}`}>
                      {item.type}
                    </span>
                  </td>
                  <td>{item.offering}</td>
                  <td>{item.strength}</td>
                  <td>{item.weakness}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="report-section">
        <h3>
          <span>03</span> 시장 규모 · 타깃
        </h3>
        <dl className="market-grid">
          <div>
            <dt>시장 규모</dt>
            <dd>{report.market.size}</dd>
          </div>
          <div>
            <dt>성장률 · 추세</dt>
            <dd>{report.market.growth}</dd>
          </div>
          <div>
            <dt>핵심 타깃</dt>
            <dd>{report.market.target_customers}</dd>
          </div>
        </dl>
      </div>

      {report.sources.length > 0 && (
        <div className="report-section">
          <h3>
            <span>04</span> 출처
          </h3>
          <ol className="source-list">
            {report.sources.map((source) => (
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
