import React, { useState, useMemo } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { useIsDesktop } from "../../hooks/useViewport.js";
import { QUIZ_CATALOG } from "../../lib/embeddedData.js";
import { DOMAIN_WEIGHTS } from "../../lib/gapEngine.js";
import { GOAL_PRESETS, DEFAULT_GOAL_VALUE, READINESS_READY_BAR } from "../../lib/trackingEngine.js";
import { fmtDayKey, shiftDayKey, weekdayOfDayKey, diffDayKeys } from "../../lib/utils.js";
import { Card, Button, ProgressBar, Icon, STATUS_RING_VAR } from "../../components/ui/primitives.jsx";

/* ===================== Tracking: hook + components ===================== */


/* ---------- Mục tiêu hằng ngày ---------- */
export function GoalPicker({ goal, onSave, onCancel }) {
  const { t } = useAppCtx();
  const [type, setType] = useState(goal?.type || "questions");
  const [value, setValue] = useState(goal?.value || DEFAULT_GOAL_VALUE);
  const [quizIndex, setQuizIndex] = useState(goal?.quizIndex ?? (QUIZ_CATALOG[0]?.quizIndex ?? null));
  const selectedCat = QUIZ_CATALOG.find((c) => c.quizIndex === quizIndex);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {GOAL_PRESETS.map((n) => (
          <button
            key={n}
            onClick={() => { setType("questions"); setValue(n); }}
            className="pmi-focusable pmi-mono flex-1 py-2.5 rounded-lg text-sm font-semibold"
            style={type === "questions" && value === n
              ? { background: "var(--accent)", color: "var(--accent-fg)" }
              : { background: "var(--paper)", border: "1px solid var(--line-strong)", color: "var(--ink-mid)" }}
          >{n}</button>
        ))}
      </div>
      <button
        onClick={() => setType("quizset")}
        className="pmi-focusable w-full text-left px-3 py-2.5 rounded-lg text-sm"
        style={type === "quizset"
          ? { border: "1.5px solid var(--ink)", background: "var(--paper)" }
          : { border: "1.5px solid var(--line-strong)" }}
      >{t("goalUnitQuizset")}</button>

      {type === "quizset" && (
        <>
          <select
            value={quizIndex ?? ""}
            onChange={(e) => setQuizIndex(Number(e.target.value))}
            className="pmi-input w-full px-3 py-2 text-sm"
          >
            {QUIZ_CATALOG.map((c) => (
              <option key={c.quizIndex} value={c.quizIndex}>{c.quizName} ({c.questionCount})</option>
            ))}
          </select>
          {selectedCat && selectedCat.questionCount > 60 && (
            <p className="text-xs" style={{ color: "var(--seal-fg)" }}>{t("goalQuizsetHint")}</p>
          )}
        </>
      )}

      <div className="flex gap-2">
        <Button
          onClick={() => onSave(type === "quizset" ? { type: "quizset", quizIndex } : { type: "questions", value })}
          className="flex-1"
        >{t("goalSaveBtn")}</Button>
        {onCancel && <Button onClick={onCancel} variant="secondary">{t("cancelBtn")}</Button>}
      </div>
    </div>
  );
}

export function StreakBadge({ streak }) {
  const { t } = useAppCtx();
  if (!streak.current) {
    return <span className="pmi-mono text-[11px]" style={{ color: "var(--ink-soft)" }}>{t("streakNone")}</span>;
  }
  return (
    <span className="pmi-mono text-[11px] flex items-center gap-1" style={{ color: "var(--seal-fg)" }}>
      <Icon name="flame" size={13} />
      {t("streakLabel", { n: streak.current })}
    </span>
  );
}

export function DailyGoalCard({ tracking, onSetGoal, onPractice }) {
  const { t } = useAppCtx();
  const isDesktop = useIsDesktop();
  const [editing, setEditing] = useState(false);
  const { goal, target, done, remaining, ratio, goalMet, todayRow, streak } = tracking;

  if (!goal || editing) {
    return (
      <Card>
        <p className="pmi-eyebrow mb-1">{t("goalSetupTitle")}</p>
        <p className="text-xs mb-3" style={{ color: "var(--ink-mid)" }}>{t("goalSetupBody")}</p>
        <GoalPicker
          goal={goal}
          onSave={(g) => { onSetGoal(g); setEditing(false); }}
          onCancel={goal ? () => setEditing(false) : null}
        />
      </Card>
    );
  }

  const accuracy = todayRow && todayRow.answered ? Math.round((todayRow.correct / todayRow.answered) * 100) : 0;
  // Số câu gợi ý cho một lượt bấm: phần còn thiếu, nhưng không quá 15 câu/lượt để phiên
  // luyện vẫn đủ ngắn mà làm hết trong một lần ngồi.
  const chunk = goalMet ? 10 : Math.min(15, Math.max(1, remaining));

  return (
    <Card style={goalMet ? { borderColor: "var(--sage)" } : undefined}>
      <div className="flex items-center justify-between mb-3">
        <span className="pmi-eyebrow" style={goalMet ? { color: "var(--sage)" } : undefined}>
          {goalMet ? t("goalMetTitle") : t("goalHeaderToday")}
        </span>
        <div className="flex items-center gap-2.5">
          <StreakBadge streak={streak} />
          <button onClick={() => setEditing(true)} className="pmi-focusable pmi-mono text-[11px]" style={{ color: "var(--ink-soft)" }}>
            {t("goalChangeBtn")}
          </button>
        </div>
      </div>

      <p className="pmi-display font-bold text-3xl mb-2" style={goalMet ? { color: "var(--sage)" } : undefined}>
        {t("goalProgressCount", { done, total: target })}
      </p>
      <ProgressBar value={ratio} className="mb-2.5" />

      <p className="pmi-mono text-[11px] mb-3" style={{ color: "var(--ink-soft)" }}>
        {todayRow
          ? t("goalTodayStats", { c: todayRow.correct, a: todayRow.answered, p: accuracy, m: todayRow.minutes })
          : t("goalTodayEmpty")}
      </p>
      {goalMet && <p className="text-xs mb-3" style={{ color: "var(--ink-mid)" }}>{t("goalMetBody")}</p>}

      <Button onClick={() => onPractice(chunk)} className={isDesktop ? "w-auto" : "w-full"} variant={goalMet ? "secondary" : "primary"}>
        {goalMet ? t("goalExtraBtn") : done > 0 ? t("goalContinueBtn", { n: chunk }) : t("goalStartBtn", { n: chunk })}
      </Button>
    </Card>
  );
}

/* ---------- Sparkline lần 1..n (Thư viện) ---------- */
export function AttemptSparkline({ entries }) {
  const { t } = useAppCtx();
  if (!entries.length) return null;
  const first = entries[0].trustedScore.percent;
  const last = entries[entries.length - 1].trustedScore.percent;
  const delta = Math.round(last - first);
  const shown = entries.slice(-6); // giữ card gọn khi làm đi làm lại nhiều lần
  const colorFor = (p) => (p >= READINESS_READY_BAR ? "var(--sage)" : p >= 60 ? "var(--sky)" : "var(--flag)");

  return (
    <div className="mb-2.5">
      <div className="flex items-center gap-1 mb-1">
        {shown.map((e, i) => (
          <React.Fragment key={e.sessionId}>
            {i > 0 && <div className="pmi-spark-line" />}
            <div className="flex flex-col items-center gap-1" style={{ minWidth: 34 }}>
              <span className="pmi-mono text-[10px]" style={{ color: colorFor(e.trustedScore.percent) }}>
                {Math.round(e.trustedScore.percent)}%
              </span>
              <div className={`pmi-spark-dot ${i === shown.length - 1 ? "is-last" : ""}`} style={{ background: colorFor(e.trustedScore.percent) }} />
              <span className="pmi-mono text-[9px]" style={{ color: "var(--ink-soft)" }}>
                {t("attemptNth", { n: entries.length - shown.length + i + 1 })}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>
      {entries.length > 1 && (
        <p className="pmi-mono text-[10px]" style={{ color: delta >= 0 ? "var(--sage)" : "var(--flag)" }}>
          {t("attemptDelta", { sign: delta >= 0 ? "+" : "", n: delta })}
        </p>
      )}
    </div>
  );
}

/* ---------- Thước Readiness ---------- */
export function ReadinessCard({ readiness, onAction }) {
  const { t } = useAppCtx();
  const isDesktop = useIsDesktop();
  const color = STATUS_RING_VAR[readiness.ring];
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="pmi-eyebrow">{t("readinessHeader")}</span>
        <span className={`pmi-chip pmi-status-${readiness.ring}`}>{t(`readinessLevel_${readiness.level}`)}</span>
      </div>

      <p className="pmi-display font-bold text-5xl mb-3" style={{ color }}>{readiness.score}</p>

      <div className="pmi-meter mb-1.5">
        <div className="pmi-meter-fill" style={{ width: `${readiness.score}%`, background: color }} />
        <div className="pmi-meter-bar" style={{ left: `${READINESS_READY_BAR}%` }} />
        <div className="pmi-meter-dot" style={{ left: `${readiness.score}%`, background: color }} />
      </div>
      <div className="pmi-mono flex justify-between text-[10px] mb-4" style={{ color: "var(--ink-soft)" }}>
        <span>0</span><span>{READINESS_READY_BAR}</span><span>100</span>
      </div>

      <p className="pmi-eyebrow mb-2">{t("readinessMissingHeader")}</p>
      <ul className="space-y-1.5 text-xs mb-3" style={{ color: "var(--ink-mid)" }}>
        {readiness.reasons.map((r) => (
          <li key={r.key} className="flex gap-2">
            <span className="shrink-0" style={{ color: "var(--ink-soft)" }}>•</span>
            <span>{t(r.key, r.vars)}</span>
          </li>
        ))}
      </ul>

      <Button onClick={onAction} className={isDesktop ? "w-auto" : "w-full"}>{t("readinessActionBtn")}</Button>
      <p className="text-[10px] mt-3" style={{ color: "var(--ink-soft)" }}>{t("readinessDisclaimer")}</p>
    </Card>
  );
}

/* ---------- Biểu đồ xu hướng 2 đường ---------- */
/* Đây là chi tiết quan trọng nhất của cả tính năng: khoảng cách giữa "lần đầu gặp" và  */
/* "làm lại" chính là phần người học chỉ đang NHỚ đáp án. Vẽ chung một đường sẽ cho biểu */
/* đồ dốc đẹp và tạo tự tin sai trước kỳ thi thật.                                       */
export function TrendChart({ points }) {
  const { t, lang } = useAppCtx();
  const W = 320, H = 140, padL = 26, padR = 6, padT = 8, padB = 18;
  const usable = points.filter((p) => p.firstExposure !== null || p.retake !== null);
  if (usable.length < 2) {
    return <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{t("trendNoData")}</p>;
  }

  const x = (i) => padL + (i / Math.max(1, points.length - 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - v) * (H - padT - padB);

  // Giá trị null (chưa đủ 5 mẫu trong cửa sổ) phải NGẮT đường, không nội suy — nếu nối
  // liền qua khoảng trống thì biểu đồ sẽ bịa ra dữ liệu không tồn tại.
  const segmentsOf = (field) => {
    const segs = [];
    let cur = [];
    points.forEach((p, i) => {
      const v = p[field];
      if (v === null || v === undefined) {
        if (cur.length > 1) segs.push(cur);
        cur = [];
      } else cur.push([x(i), y(v)]);
    });
    if (cur.length > 1) segs.push(cur);
    return segs;
  };
  const toPath = (seg) => seg.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");

  const gridLines = [0.25, 0.5, 0.75, 1];
  const labelEvery = Math.ceil(points.length / 4);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label={t("trendHeader")}>
        {gridLines.map((g) => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeWidth="0.5" />
            <text x={padL - 4} y={y(g) + 3} textAnchor="end" fontSize="7.5" fill="var(--ink-soft)" fontFamily="var(--font-mono)">{Math.round(g * 100)}</text>
          </g>
        ))}
        <line
          x1={padL} x2={W - padR} y1={y(READINESS_READY_BAR / 100)} y2={y(READINESS_READY_BAR / 100)}
          stroke="var(--ink-soft)" strokeWidth="0.8" strokeDasharray="3 3"
        />
        {segmentsOf("retake").map((seg, i) => (
          <path key={`r${i}`} d={toPath(seg)} fill="none" stroke="var(--ink-soft)" strokeWidth="1.6" strokeDasharray="4 3" strokeLinejoin="round" />
        ))}
        {segmentsOf("firstExposure").map((seg, i) => (
          <path key={`f${i}`} d={toPath(seg)} fill="none" stroke="var(--sky)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {points.map((p, i) => (
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={p.dayKey} x={x(i)} y={H - 5} textAnchor="middle" fontSize="7" fill="var(--ink-soft)" fontFamily="var(--font-mono)">
              {p.dayKey.slice(5).replace("-", "/")}
            </text>
          ) : null
        ))}
      </svg>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 pmi-mono text-[10px]" style={{ color: "var(--ink-mid)" }}>
        <span className="flex items-center gap-1.5"><span style={{ width: 14, height: 2.5, background: "var(--sky)", display: "inline-block" }} />{t("trendFirstExposure")}</span>
        <span className="flex items-center gap-1.5"><span style={{ width: 14, height: 0, borderTop: "2px dashed var(--ink-soft)", display: "inline-block" }} />{t("trendRetake")}</span>
        <span className="flex items-center gap-1.5"><span style={{ width: 14, height: 0, borderTop: "1px dashed var(--ink-soft)", display: "inline-block" }} />{t("trendThreshold")}</span>
      </div>
      <p className="text-xs mt-2.5 flex gap-1.5" style={{ color: "var(--seal-fg)" }}>
        <span className="shrink-0">ⓘ</span><span>{t("trendExplain")}</span>
      </p>
      {/* Bảng tương đương cho trình đọc màn hình — biểu đồ SVG không tự đọc được. */}
      <table className="pmi-sr">
        <caption>{t("trendHeader")}</caption>
        <thead><tr><th>{lang === "en" ? "Date" : "Ngày"}</th><th>{t("trendFirstExposure")}</th><th>{t("trendRetake")}</th></tr></thead>
        <tbody>
          {points.filter((p) => p.firstExposure !== null || p.retake !== null).map((p) => (
            <tr key={p.dayKey}>
              <td>{fmtDayKey(p.dayKey, lang)}</td>
              <td>{p.firstExposure === null ? "—" : `${Math.round(p.firstExposure * 100)}%`}</td>
              <td>{p.retake === null ? "—" : `${Math.round(p.retake * 100)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Heatmap 12 tuần ---------- */
export function Heatmap({ tracking }) {
  const { t, lang } = useAppCtx();
  const [selected, setSelected] = useState(null);
  const { history, today, goal, target } = tracking;

  const { cells, metCount, activeCount } = useMemo(() => {
    const mondayIdx = (weekdayOfDayKey(today) + 6) % 7; // 0 = thứ 2
    const startOfThisWeek = shiftDayKey(today, -mondayIdx);
    const firstDay = shiftDayKey(startOfThisWeek, -11 * 7);
    const out = [];
    let met = 0, active = 0;
    for (let w = 0; w < 12; w++) {
      for (let d = 0; d < 7; d++) {
        const key = shiftDayKey(firstDay, w * 7 + d);
        const row = history.get(key) || null;
        const future = diffDayKeys(key, today) > 0;
        let level = 0;
        if (row) {
          active += 1;
          if (target) {
            const r = row.answered / target;
            level = r >= 1.5 ? 4 : r >= 1 ? 3 : r >= 0.5 ? 2 : 1;
            if (r >= 1) met += 1;
          } else {
            level = row.answered >= 40 ? 4 : row.answered >= 20 ? 3 : row.answered >= 10 ? 2 : 1;
          }
        }
        out.push({ key, row, level, future, weekIdx: w, dayIdx: d });
      }
    }
    return { cells: out, metCount: met, activeCount: active };
  }, [history, today, target]);

  const selectedCell = selected ? cells.find((c) => c.key === selected) : null;
  const dayLabels = lang === "en" ? ["M", "T", "W", "T", "F", "S", "S"] : ["2", "3", "4", "5", "6", "7", "CN"];

  return (
    <div>
      <div className="pmi-heat-wrap">
        <div className="pmi-heat-labels shrink-0">
          {dayLabels.map((d, i) => (
            <span key={i} className="pmi-mono text-[8px] flex items-center justify-center" style={{ color: "var(--ink-soft)" }}>{d}</span>
          ))}
        </div>
        <div className="pmi-heat-grid">
          {cells.map((c) => (
            <button
              key={c.key}
              onClick={() => setSelected(c.key === selected ? null : c.key)}
              disabled={c.future}
              title={c.row
                ? t("heatmapDayDetail", { date: fmtDayKey(c.key, lang), answered: c.row.answered, p: Math.round((c.row.correct / c.row.answered) * 100) })
                : t("heatmapDayEmpty", { date: fmtDayKey(c.key, lang) })}
              className={`pmi-heat pmi-focusable lvl-${c.level} ${c.future ? "is-future" : ""} ${c.key === today ? "is-today" : ""}`}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 pmi-mono text-[10px]" style={{ color: "var(--ink-soft)" }}>
        <span>
          {goal
            ? t("heatmapSummary", { met: metCount, total: 84, p: Math.round((metCount / 84) * 100) })
            : t("heatmapNeedGoal")}
        </span>
        <span className="flex items-center gap-1">
          {t("heatmapLegendLess")}
          {[0, 1, 2, 3, 4].map((l) => <span key={l} className={`pmi-heat lvl-${l}`} style={{ width: 9, height: 9 }} />)}
          {t("heatmapLegendMore")}
        </span>
      </div>

      {selectedCell && (
        <div className="mt-3 px-3 py-2.5 rounded-lg text-xs" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
          {selectedCell.row ? (
            <>
              <p className="pmi-mono font-semibold mb-1">{fmtDayKey(selectedCell.key, lang)}</p>
              <p style={{ color: "var(--ink-mid)" }}>
                {t("goalTodayStats", {
                  c: selectedCell.row.correct, a: selectedCell.row.answered,
                  p: Math.round((selectedCell.row.correct / selectedCell.row.answered) * 100),
                  m: selectedCell.row.minutes,
                })}
              </p>
              <p className="pmi-mono text-[10px] mt-1" style={{ color: "var(--ink-soft)" }}>
                {t("firstExposureLabel")} {selectedCell.row.firstExposure} · {t("retakeLabel")} {selectedCell.row.retake}
              </p>
            </>
          ) : (
            <p style={{ color: "var(--ink-soft)" }}>{t("heatmapDayEmpty", { date: fmtDayKey(selectedCell.key, lang) })}</p>
          )}
        </div>
      )}
      <p className="pmi-sr">{t("heatmapSummary", { met: metCount, total: 84, p: Math.round((metCount / 84) * 100) })} · {activeCount}</p>
    </div>
  );
}

/* ---------- Diễn biến mastery theo domain (đọc từ gapSnapshots đã có sẵn) ---------- */
export function MasteryTrendCard({ masteryTrend }) {
  const { t } = useAppCtx();
  if (masteryTrend.length < 2) {
    return <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{t("masteryTrendEmpty")}</p>;
  }
  const W = 320, H = 110, padL = 24, padR = 6, padT = 6, padB = 12;
  const domains = Object.keys(DOMAIN_WEIGHTS);
  const colorOf = { Mindset: "var(--sky)", Leadership: "var(--seal)", Product: "var(--sage)", Delivery: "var(--flag)" };
  const x = (i) => padL + (i / Math.max(1, masteryTrend.length - 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - v) * (H - padT - padB);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label={t("masteryTrendHeader")}>
        {[0.5, 1].map((g) => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeWidth="0.5" />
            <text x={padL - 4} y={y(g) + 3} textAnchor="end" fontSize="7" fill="var(--ink-soft)" fontFamily="var(--font-mono)">{g * 100}</text>
          </g>
        ))}
        {domains.map((d) => {
          const pts = masteryTrend.map((s, i) => [i, s.domains[d]]).filter(([, v]) => v !== null && v !== undefined);
          if (pts.length < 2) return null;
          const path = pts.map(([i, v], k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
          return <path key={d} d={path} fill="none" stroke={colorOf[d]} strokeWidth="1.8" strokeLinejoin="round" />;
        })}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 pmi-mono text-[10px]" style={{ color: "var(--ink-mid)" }}>
        {domains.map((d) => (
          <span key={d} className="flex items-center gap-1.5">
            <span style={{ width: 12, height: 2.5, background: colorOf[d], display: "inline-block" }} />{d}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Ngày thi + nhịp cần thiết ---------- */
export function ExamDateCard({ tracking, gapProfile, onSetExamDate }) {
  const { t, lang } = useAppCtx();
  const { examDateInfo } = tracking;
  const [draft, setDraft] = useState(tracking.examDate || "");

  const untouched = gapProfile.tasks.filter((tk) => tk.attempts === 0).length;
  // Ước lượng thô nhưng đủ dùng: mỗi task chưa đụng cần ~5 câu để có bằng chứng tối thiểu.
  const questionsNeeded = untouched * 5;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="pmi-eyebrow">{t("examDateHeader")}</span>
        {tracking.examDate && (
          <button onClick={() => { onSetExamDate(null); setDraft(""); }} className="pmi-focusable pmi-mono text-[11px]" style={{ color: "var(--ink-soft)" }}>
            {t("examDateClearBtn")}
          </button>
        )}
      </div>

      {tracking.examDate ? (
        <>
          <p className="pmi-display font-semibold text-2xl mb-1">
            {examDateInfo.daysLeft >= 0 ? t("examDateCountdown", { n: examDateInfo.daysLeft }) : t("examDatePassed")}
          </p>
          <p className="pmi-mono text-[11px] mb-3" style={{ color: "var(--ink-soft)" }}>{fmtDayKey(tracking.examDate, lang)}</p>
          {examDateInfo.daysLeft > 0 && untouched > 0 && (
            <p className="text-xs" style={{ color: "var(--ink-mid)" }}>
              {t("examDatePace", { n: untouched, q: Math.ceil(questionsNeeded / examDateInfo.daysLeft) })}
            </p>
          )}
          {examDateInfo.daysLeft > 0 && (
            <p className="text-xs mt-1.5" style={{ color: examDateInfo.paceOk ? "var(--sage)" : "var(--seal-fg)" }}>
              {examDateInfo.paceOk
                ? t("examDatePaceOk", { q: examDateInfo.currentPace })
                : t("examDatePaceLow", { cur: examDateInfo.currentPace, need: Math.ceil(questionsNeeded / examDateInfo.daysLeft) })}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-sm mb-3" style={{ color: "var(--ink-soft)" }}>{t("examDateNotSet")}</p>
          <div className="flex gap-2">
            <input
              type="date"
              value={draft}
              min={tracking.today}
              onChange={(e) => setDraft(e.target.value)}
              className="pmi-input flex-1 px-3 py-2 text-sm"
            />
            <Button onClick={() => draft && onSetExamDate(draft)} disabled={!draft}>{t("examDateSetBtn")}</Button>
          </div>
        </>
      )}
    </Card>
  );
}
