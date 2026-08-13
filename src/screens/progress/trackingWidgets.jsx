import { useState, useMemo } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { useIsDesktop, useIsWide } from "../../hooks/useViewport.js";
import { QUIZ_CATALOG } from "../../lib/embeddedData.js";
import { DOMAIN_WEIGHTS } from "../../lib/gapEngine.js";
import { GOAL_PRESETS, DEFAULT_GOAL_VALUE, READINESS_READY_BAR } from "../../lib/trackingEngine.js";
import { buildStudyPlan, computeCatchUp } from "../../lib/studyPlan.js";
import { fmtDate, fmtDayKey, shiftDayKey, weekdayOfDayKey, diffDayKeys } from "../../lib/utils.js";
import { marginOfError } from "../../lib/passStats.js";
import { Card, Button, ProgressBar, Icon, TierChip, STATUS_RING_VAR } from "../../components/ui/primitives.jsx";

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

/* ---------- Tiến độ theo LƯỢT của một bộ đề (Thư viện) ---------- */
/* Thay cho sparkline điểm từng phiên trước đây: mỗi phiên chỉ ~10 câu nên sai số lấy mẫu ±31
   điểm — chuỗi 30%/100%/27% là nhiễu chứ không phải xu hướng. Ở đây hiển thị theo LƯỢT (lần gặp
   thứ N của từng câu trong đề, xem passStats.js): độ phủ, % của cả lượt và sai số kèm theo. */
export function QuizPassSummary({ passes, comparison }) {
  const { t, lang } = useAppCtx();
  if (!passes.length) return null;
  const colorFor = (p) => (p >= READINESS_READY_BAR ? "var(--sage)" : p >= 60 ? "var(--sky)" : "var(--flag)");

  return (
    <div className="mb-2.5 space-y-1.5">
      {passes.map((p) => {
        const moe = marginOfError(p.correct, p.answered);
        return (
          <div key={p.pass}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="pmi-mono text-[10px]" style={{ color: "var(--ink-soft)" }}>
                {t("passLabel", { n: p.pass })}
              </span>
              <span className="pmi-mono text-[10px]" style={{ color: colorFor(p.percent) }}>
                {Math.round(p.percent)}%{moe != null && <span style={{ color: "var(--ink-soft)" }}> ±{moe}</span>}
              </span>
            </div>
            <div className="pmi-pass-track">
              <div className="pmi-pass-fill" style={{ width: `${Math.min(100, (p.answered / p.total) * 100)}%`, background: colorFor(p.percent) }} />
            </div>
            <p className="pmi-mono text-[9px]" style={{ color: "var(--ink-soft)" }}>
              {p.complete
                ? t("passCoverageDone", { c: p.correct, a: p.answered, d: p.completedAt ? fmtDate(p.completedAt, lang) : "" })
                : t("passCoverageOngoing", { c: p.correct, a: p.answered, n: p.total - p.answered })}
            </p>
          </div>
        );
      })}
      {comparison && (
        <p className="pmi-mono text-[9px]" style={{ color: comparison.delta >= 0 ? "var(--sage)" : "var(--flag)" }}>
          {t("passPairedLine", {
            a: comparison.passA, b: comparison.passB, n: comparison.shared,
            pa: Math.round(comparison.percentA), pb: Math.round(comparison.percentB),
            f: comparison.fixed, r: comparison.broken,
          })}
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
export function Heatmap({ tracking, planRows }) {
  const { t, lang } = useAppCtx();
  const [selected, setSelected] = useState(null);
  const { history, today, goal, target } = tracking;

  // Mục tiêu của TỪNG NGÀY trong quá khứ (khi đã đặt ngày thi, mục tiêu đổi mỗi ngày — xem
  // buildPlanProgress). Không có thì mới rơi về mục tiêu hôm nay; dùng mục tiêu hôm nay cho mọi
  // ngày cũ sẽ tô đỏ oan những ngày người học thực sự đã đạt.
  const targetByDay = useMemo(() => {
    const m = new Map();
    for (const r of planRows || []) m.set(r.dayKey, r.target);
    return m;
  }, [planRows]);

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
          const dayTarget = targetByDay.get(key) ?? target;
          if (dayTarget) {
            const r = row.answered / dayTarget;
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
  }, [history, today, target, targetByDay]);

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

/* ---------- Tiến độ so với KẾ HOẠCH (burn-up + mục tiêu từng ngày) ---------- */
/* Trả lời đúng hai câu hỏi người học hay hỏi khi đã đặt ngày thi: "hôm nay/những ngày qua tôi có
   đạt mục tiêu không" và "tổng thể tôi đang vượt hay chậm so với kế hoạch". Cả hai đều dùng ĐƠN
   VỊ KHỐI LƯỢNG LỘ TRÌNH chứ không phải tổng số câu đã bấm (xem buildPlanProgress). */
const STRIP_H = 46;

export function PlanProgressCard({ plan, studyPlan, onStartTodayPractice, onStartExamMode }) {
  const { t, lang } = useAppCtx();
  const isDesktop = useIsDesktop();
  const isWide = useIsWide();
  if (!plan?.hasExamDate || !plan.rows.length) return null;

  // Khung vẽ đổi theo viewport thay vì phóng to một khung 320px: nếu chỉ kéo giãn viewBox thì trên
  // desktop nét vẽ và chữ bị phóng theo (to, mờ) mà số nhãn ngày vẫn y nguyên. Khung rộng hơn cho
  // phép hiện NHIỀU MỐC NGÀY hơn với cỡ chữ giữ nguyên tỉ lệ dễ đọc.
  const W = isWide ? 900 : isDesktop ? 620 : 320;
  const H = isWide ? 260 : isDesktop ? 210 : 168;
  const FS = isWide ? 10 : isDesktop ? 9 : 6.5;      // cỡ chữ nhãn trục
  const padL = isWide ? 46 : isDesktop ? 40 : 32;
  const padR = isWide ? 14 : 10;
  const padT = 10;
  const padB = isWide ? 44 : isDesktop ? 40 : 34;
  const series = plan.series;
  const n = series.length;
  // Trục Y chạm ĐÚNG tổng khối lượng lộ trình: đây là "số câu cần đạt", phải nhìn thấy được đích
  // chứ không chỉ thấy đoạn đã đi.
  const maxY = Math.max(plan.scope, 1);
  const x = (i) => padL + (n === 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const y = (v) => padT + (1 - Math.min(1, v / maxY)) * (H - padT - padB);
  const pathOf = (field) => {
    const pts = series.map((r, i) => [i, r[field]]).filter(([, v]) => v !== null && v !== undefined);
    return pts.map(([i, v], k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  };
  const indexOfDay = (day) => series.findIndex((r) => r.dayKey === day);

  const behind = plan.aheadBy < 0;
  const statusColor = behind ? "var(--flag)" : "var(--sage)";
  const lateFinish = plan.projectedFinishDay && plan.projectedFinishDay > plan.deadlineDay;

  // Mốc bắt buộc suy ngược từ ngày thi (buildStudyPlan) — vẽ thành vạch đứng để biết ĐẾN NGÀY NÀO
  // thì phải xong việc gì, thay vì chỉ có một đường kế hoạch trơn.
  const markers = (studyPlan?.segments || [])
    .map((sg) => ({ key: sg.key, day: sg.endDate, i: indexOfDay(sg.endDate) }))
    .filter((m) => m.i > 0)
    // Trên khung hẹp bỏ mốc "nghỉ": nó chỉ cách mốc thi thử 1-2 ngày nên hai nhãn chồng lên nhau,
    // mà thông tin "2 ngày nghỉ trước thi" đã có ở thẻ Ngày thi.
    .filter((m) => isDesktop || m.key !== "final_days");

  // Nhãn ngày trên trục X: chia đều theo bề rộng thật, luôn có ngày đầu và ngày thi.
  const tickCount = isWide ? 12 : isDesktop ? 8 : 5;
  const tickIdx = [];
  for (let k = 0; k < tickCount; k++) {
    const i = Math.round((k / (tickCount - 1)) * (n - 1));
    if (!tickIdx.includes(i)) tickIdx.push(i);
  }
  const dm = (day) => day.slice(5).replace("-", "/");

  const stripDays = isWide ? 21 : isDesktop ? 14 : 10;
  const strip = plan.rows.slice(-stripDays);
  const ratioOf = (r) => (r.target > 0 ? Math.min(1.6, r.progressed / r.target) : (r.progressed > 0 ? 1 : 0));
  const pending = (studyPlan?.quizPassPlan || []).filter((q) => q.status !== "done");
  const doneCount = (studyPlan?.quizPassPlan || []).length - pending.length;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="pmi-mono text-sm font-semibold" style={{ color: statusColor }}>
          {behind
            ? t("planBehind", { n: Math.abs(plan.aheadBy), d: Math.abs(plan.aheadDays) })
            : t("planAhead", { n: plan.aheadBy, d: plan.aheadDays })}
        </span>
        <span className="pmi-mono text-[10px]" style={{ color: "var(--ink-soft)" }}>
          {t("planMetDays", { m: plan.metDays, n: plan.judgedDays })}
        </span>
      </div>
      <p className="pmi-mono text-[10px] mb-2" style={{ color: "var(--ink-soft)" }}>
        {t("planScopeLine", { done: plan.cumDone, total: plan.scope, from: fmtDayKey(plan.startDay, lang), to: fmtDayKey(plan.examDate, lang) })}
      </p>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label={t("planChartLabel")}>
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={y(maxY * g)} y2={y(maxY * g)} stroke="var(--line)" strokeWidth="0.5" />
            <text x={padL - 4} y={y(maxY * g) + FS / 2 - 1} textAnchor="end" fontSize={FS} fill="var(--ink-soft)" fontFamily="var(--font-mono)">
              {Math.round(maxY * g)}
            </text>
          </g>
        ))}

        {/* Nhãn mốc so le hai hàng: các mốc cuối lộ trình nằm sát nhau (cách nhau vài ngày), để
            cùng một hàng là chữ chồng lên nhau không đọc được. */}
        {markers.map((m, k) => (
          <g key={m.key}>
            <line x1={x(m.i)} x2={x(m.i)} y1={padT} y2={H - padB} stroke="var(--line-strong)" strokeWidth="0.7" strokeDasharray="2 2" />
            <text
              x={x(m.i)} y={padT + 8 + (k % 2 ? FS + 3 : 0)}
              textAnchor={m.i > (n - 1) * 0.88 ? "end" : m.i < (n - 1) * 0.12 ? "start" : "middle"}
              fontSize={FS} fill="var(--ink-soft)" fontFamily="var(--font-mono)"
            >
              {t(`planMarker_${m.key}`)} {dm(m.day)}
            </text>
          </g>
        ))}
        {/* Vạch HÔM NAY: ranh giới giữa phần đã đi thật và phần dự phóng. */}
        <line x1={x(plan.todayIndex)} x2={x(plan.todayIndex)} y1={padT} y2={H - padB} stroke="var(--ink-soft)" strokeWidth="1" />

        <path d={pathOf("cumPlan")} fill="none" stroke="var(--ink-soft)" strokeWidth="1.6" strokeDasharray="4 3" />
        <path d={pathOf("cumProjected")} fill="none" stroke={statusColor} strokeWidth="1.4" strokeDasharray="1.5 2.5" opacity="0.85" />
        <path d={pathOf("cumDone")} fill="none" stroke={statusColor} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(plan.todayIndex)} cy={y(plan.cumDone)} r="2.6" fill={statusColor} />

        {tickIdx.map((i, k) => (
          <g key={series[i].dayKey}>
            <line x1={x(i)} x2={x(i)} y1={H - padB} y2={H - padB + 3} stroke="var(--line-strong)" strokeWidth="0.6" />
            <text
              x={x(i)} y={H - padB + FS + 5}
              textAnchor={k === 0 ? "start" : k === tickIdx.length - 1 ? "end" : "middle"}
              fontSize={FS} fill="var(--ink-soft)" fontFamily="var(--font-mono)"
            >
              {dm(series[i].dayKey)}
            </text>
          </g>
        ))}
        {/* Nhãn HÔM NAY gắn thẳng vào vạch để không phải đếm ô mới biết mình đang ở đâu. */}
        <text
          x={x(plan.todayIndex)} y={H - padB + 2 * FS + 8}
          textAnchor={plan.todayIndex < (n - 1) * 0.12 ? "start" : "middle"}
          fontSize={FS} fill="var(--ink)" fontFamily="var(--font-mono)"
        >
          {t("planToday")} {dm(plan.today)}
        </text>
      </svg>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 mb-3 pmi-mono text-[10px]" style={{ color: "var(--ink-mid)" }}>
        <span className="flex items-center gap-1.5"><span style={{ width: 14, height: 2.5, background: statusColor, display: "inline-block" }} />{t("planLegendActual")}</span>
        <span className="flex items-center gap-1.5"><span style={{ width: 14, height: 0, borderTop: "2px dashed var(--ink-soft)", display: "inline-block" }} />{t("planLegendPlan")}</span>
        <span className="flex items-center gap-1.5"><span style={{ width: 14, height: 0, borderTop: `1.5px dotted ${statusColor}`, display: "inline-block" }} />{t("planLegendProjected")}</span>
      </div>

      {plan.shortfallAtExam > 0 && (
        <p className="pmi-mono text-[10px] mb-3" style={{ color: "var(--flag)" }}>
          {t("planShortfallAtExam", { n: plan.shortfallAtExam, p: Math.round((plan.projectedAtExam / plan.scope) * 100) })}
        </p>
      )}

      <p className="pmi-eyebrow mb-1.5">{t("planDailyHeader")}</p>
      <div className="flex items-end gap-1" style={{ height: STRIP_H, position: "relative" }}>
        {/* Vạch 100% nằm ở 1/1.6 chiều cao vì trục cắt tại 160% mục tiêu. */}
        <div style={{ position: "absolute", bottom: `${(1 / 1.6) * STRIP_H}px`, left: 0, right: 0, borderTop: "1px dashed var(--ink-soft)", opacity: 0.7, pointerEvents: "none" }} />
        {strip.map((r) => {
          const ratio = ratioOf(r);
          const color = r.pending ? "var(--line-strong)" : r.met ? (ratio >= 1.25 ? "var(--sky)" : "var(--sage)") : "var(--flag)";
          return (
            <div key={r.dayKey} className="flex-1 flex flex-col justify-end items-stretch" style={{ height: "100%" }}
              title={t("planDayTip", { date: fmtDayKey(r.dayKey, lang), p: r.progressed, g: r.target, a: r.answered })}>
              <div style={{ height: `${(ratio / 1.6) * 100}%`, background: color, borderRadius: 2, minHeight: 2 }} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mt-1">
        {strip.map((r, i) => (
          <span key={r.dayKey} className="flex-1 pmi-mono text-center" style={{ fontSize: isDesktop ? 9 : 8, color: r.dayKey === plan.today ? "var(--ink)" : "var(--ink-soft)" }}>
            {/* Trên mobile 10 cột hẹp — chỉ ghi ngày, cách một cột một nhãn để không dính chữ. */}
            {isDesktop || strip.length <= 6 || i % 2 === 0 ? dm(r.dayKey) : ""}
          </span>
        ))}
      </div>
      <p className="pmi-mono text-[9px] mt-1" style={{ color: "var(--ink-soft)" }}>{t("planDailyLegend")}</p>

      <div className={`pmi-mono grid ${isDesktop ? "grid-cols-2" : "grid-cols-1"} gap-x-3 gap-y-1 text-[10px] mt-3`} style={{ color: "var(--ink-mid)" }}>
        <span>{t("planPace", { n: plan.pace })}</span>
        <span>{t("planNeeded", { n: Math.ceil(plan.remaining / Math.max(1, plan.daysToDeadline)) })}</span>
        <span>{t("planRemaining", { n: plan.remaining })}</span>
        <span style={lateFinish ? { color: "var(--flag)" } : undefined}>
          {plan.projectedFinishDay
            ? t("planProjected", { d: fmtDayKey(plan.projectedFinishDay, lang) })
            : t("planProjectedNone")}
        </span>
      </div>
      {lateFinish && (
        <p className="text-xs mt-2 flex gap-1.5" style={{ color: "var(--seal-fg)" }}>
          <span className="shrink-0">ⓘ</span><span>{t("planLateWarning", { d: fmtDayKey(plan.deadlineDay, lang) })}</span>
        </p>
      )}

      {/* "Đề nào còn phải làm xong" — cùng dữ liệu với bảng thu gọn ở thẻ Ngày thi, nhưng đặt thẳng
          dưới biểu đồ vì đây chính là thứ tạo nên khối lượng của đường kế hoạch phía trên. */}
      {pending.length > 0 && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="pmi-eyebrow">{t("planQuizHeader")}</span>
            <span className="pmi-mono text-[10px]" style={{ color: "var(--ink-soft)" }}>
              {t("planQuizDone", { m: doneCount, n: doneCount + pending.length })}
            </span>
          </div>
          <div className="space-y-1">
            {pending.map((q) => {
              const stat = q.status === "first_pass"
                ? t("planQuizRemaining", { n: q.unseenInQuiz, done: q.gradableCount - q.unseenInQuiz, total: q.gradableCount })
                : t("planQuizNeedsExam");
              // Mobile: tên đề một dòng riêng rồi mới tới số liệu — nhét chung một dòng thì tên bị
              // cắt còn "PMI-ACP: S..." và không phân biệt được Phần 1 với Phần 2.
              // Nút làm nốt: bấm là vào thẳng những câu CHƯA GẶP của đúng đề đó (không mở lại cả
              // đề), trần MAX_CHUNK_SIZE câu một phiên để còn ngồi hết được trong một lần.
              const chunk = Math.min(MAX_CHUNK_SIZE, q.unseenInQuiz);
              const cooldownLeft = q.status === "needs_exam_mode" && q.earliestExamModeDate
                ? diffDayKeys(q.earliestExamModeDate, plan.today)
                : 0;
              return (
                <div key={q.quizIndex} className="text-[11px] py-1.5" style={{ borderBottom: "1px solid var(--line)" }}>
                  <div className={isDesktop ? "flex items-center justify-between gap-2" : ""}>
                    <div className="min-w-0 flex items-center gap-1.5">
                      <TierChip tier={q.tier} />
                      <span className="truncate">{q.quizName}</span>
                    </div>
                    <span className={`pmi-mono text-[10px] shrink-0 ${isDesktop ? "" : "block text-right"}`} style={{ color: "var(--ink-soft)" }}>
                      {stat}
                    </span>
                  </div>
                  <div className={`mt-1 ${isDesktop ? "flex justify-end" : ""}`}>
                    {q.status === "first_pass" ? (
                      <button
                        onClick={() => onStartTodayPractice?.(q.quizIndex, chunk)}
                        className="pmi-focusable pmi-mono text-[10px] px-2 py-1 rounded-md"
                        style={{ border: "1px solid var(--line-strong)", color: "var(--ink)" }}
                      >
                        {t("planQuizContinueBtn", { n: chunk })}
                      </button>
                    ) : cooldownLeft > 0 ? (
                      <span className="pmi-mono text-[10px]" style={{ color: "var(--ink-soft)" }}>
                        {t("planQuizExamCooldown", { d: fmtDayKey(q.earliestExamModeDate, lang) })}
                      </span>
                    ) : (
                      <button
                        onClick={() => onStartExamMode?.(q.quizIndex)}
                        className="pmi-focusable pmi-mono text-[10px] px-2 py-1 rounded-md"
                        style={{ border: "1px solid var(--line-strong)", color: "var(--ink)" }}
                      >
                        {t("planQuizExamBtn")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <table className="pmi-sr">
        <caption>{t("planChartLabel")}</caption>
        <thead><tr><th>{lang === "en" ? "Date" : "Ngày"}</th><th>{t("planDailyTarget")}</th><th>{t("planDailyDone")}</th></tr></thead>
        <tbody>
          {plan.rows.map((r) => (
            <tr key={r.dayKey}><td>{fmtDayKey(r.dayKey, lang)}</td><td>{r.target}</td><td>{r.progressed}</td></tr>
          ))}
        </tbody>
      </table>
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

/* ---------- Ngày thi + lộ trình luyện thi ---------- */
// Tái dùng đúng 5 mức trạng thái đã có (STATUS_RING_VAR/pmi-status-*) thay vì bịa thêm bảng màu
// riêng cho phase/risk — giữ đúng 1 ngôn ngữ thị giác xuyên suốt app (critical=đỏ, ready=xanh lá…).
// "overdue" (phase và riskLevel) không xuất hiện ở đây — nhánh render riêng ở dưới thay thế
// hoàn toàn khối badge/mốc/lịch khi ngày thi đã qua, nên 2 bảng màu này chỉ cần phủ các trạng
// thái còn lại (xem nhánh `plan.phase === "overdue"` trong JSX bên dưới).
const STUDY_PHASE_RING = { foundation: "needs_work", gap_fill: "needs_work", mock_exams: "developing", final_review: "developing", final_days: "ready" };
const STUDY_RISK_RING = { ample: "ready", on_track: "developing", tight: "needs_work", insufficient: "critical" };
const STUDY_SEGMENT_COLOR = { foundation: "var(--sky)", gap_fill: "var(--seal)", mock_exams: "var(--sage)", final_days: "var(--line-strong)" };

export function ExamDateCard({ progress, tracking, gapProfile, onSetExamDate, onFillGap, onGoLibrary, style }) {
  const { t, lang } = useAppCtx();
  const [draft, setDraft] = useState(tracking.examDate || "");
  const plan = useMemo(
    () => (tracking.examDate ? buildStudyPlan({ progress, gapProfile, tracking }) : null),
    [progress, gapProfile, tracking]
  );

  return (
    <Card style={style}>
      <div className="flex items-center justify-between mb-3">
        <span className="pmi-eyebrow">{t("examDateHeader")}</span>
        {tracking.examDate && (
          <button onClick={() => { onSetExamDate(null); setDraft(""); }} className="pmi-focusable pmi-mono text-[11px]" style={{ color: "var(--ink-soft)" }}>
            {t("examDateClearBtn")}
          </button>
        )}
      </div>

      {plan?.hasExamDate ? (
        <>
          <p className="pmi-display font-semibold text-2xl mb-1">
            {plan.daysLeft >= 0 ? t("examDateCountdown", { n: plan.daysLeft }) : t("examDatePassed")}
          </p>
          <p className="pmi-mono text-[11px] mb-3" style={{ color: "var(--ink-soft)" }}>{fmtDayKey(tracking.examDate, lang)}</p>

          {plan.phase === "overdue" ? (
            <>
              <p className="text-sm mb-3" style={{ color: "var(--flag)" }}>{t("studyOverdueMessage")}</p>
              <div className="flex gap-2">
                <input type="date" value={draft} min={tracking.today} onChange={(e) => setDraft(e.target.value)} className="pmi-input flex-1 px-3 py-2 text-sm" />
                <Button onClick={() => draft && onSetExamDate(draft)} disabled={!draft}>{t("examDateSetBtn")}</Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className={`pmi-chip pmi-status-${STUDY_PHASE_RING[plan.phase]}`}>{t(`studyPhase_${plan.phase}`)}</span>
                <span className={`pmi-chip pmi-status-${STUDY_RISK_RING[plan.riskLevel]}`}>{t(`studyRisk_${plan.riskLevel}`)}</span>
              </div>
              <p className="text-xs mb-1" style={{ color: "var(--ink-mid)" }}>{t(`studyPhaseHint_${plan.phase}`)}</p>
              <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
                {plan.workloadQuestions > 0 ? t("studyDailyTarget", { n: plan.dailyQuestionTarget }) : t("studyDailyTargetDone")}
              </p>
              {plan.workloadQuestions > 0 && (
                <p className="text-xs mt-0.5" style={{ color: tracking.currentPace >= plan.dailyQuestionTarget ? "var(--sage)" : "var(--seal-fg)" }}>
                  {t("studyCurrentPace", { n: tracking.currentPace })}
                </p>
              )}
              {/* Giải thích rõ con số ~X câu/ngày từ đâu ra — tổng khối lượng, không phải phỏng đoán. */}
              <p className="text-[11px] mt-1.5 mb-4" style={{ color: "var(--ink-soft)" }}>
                {t("studyWorkloadExplain", {
                  total: plan.totalCoreQuestions, coreTotal: plan.coreTotal,
                  unseen: plan.unseenCoreQuestions, workload: plan.workloadQuestions,
                })}
              </p>

              <p className="pmi-eyebrow mb-2">{t("studyMilestonesHeader")}</p>
              <ul className="space-y-2 mb-3">
                {plan.milestones.map((m) => (
                  <li key={m.id} className="flex items-start gap-2 text-xs">
                    <span className="shrink-0 mt-0.5" style={{ color: m.done ? "var(--sage)" : m.overdue ? "var(--flag)" : "var(--ink-soft)" }}>
                      <Icon name={m.done ? "check" : "x"} size={12} />
                    </span>
                    <span style={{ color: m.overdue ? "var(--flag)" : "var(--ink-mid)" }}>
                      {t(`studyMilestone_${m.id}`, { current: m.current, target: m.target, date: m.dueDate ? fmtDayKey(m.dueDate, lang) : "" })}
                      {m.overdue && ` — ${t("studyMilestoneOverdue")}`}
                    </span>
                  </li>
                ))}
              </ul>

              {(plan.firstPassRemaining > 0 || plan.criticalCount > 0) && (
                <div className="flex gap-2 mb-4">
                  {plan.firstPassRemaining > 0 && <Button variant="secondary" onClick={onGoLibrary} className="flex-1">{t("libraryBtn")}</Button>}
                  {plan.criticalCount > 0 && <Button variant="secondary" onClick={onFillGap} className="flex-1">{t("practiceGapBtn")}</Button>}
                </div>
              )}

              <p className="pmi-eyebrow mb-2">{t("studyTimelineHeader")}</p>
              <div className="flex h-2 rounded-full overflow-hidden mb-2" style={{ background: "var(--line)" }}>
                {plan.segments.map((s) => (
                  <div key={s.key} style={{ width: `${(s.days / Math.max(1, plan.daysLeft)) * 100}%`, background: STUDY_SEGMENT_COLOR[s.key] }} />
                ))}
              </div>
              <div className="space-y-1 mb-4">
                {plan.segments.map((s) => (
                  <div key={s.key} className="flex items-center justify-between text-[11px]" style={{ color: "var(--ink-soft)" }}>
                    <span className="flex items-center gap-1.5">
                      <span style={{ width: 7, height: 7, borderRadius: 999, background: STUDY_SEGMENT_COLOR[s.key], display: "inline-block" }} />
                      {t(`studySegment_${s.key}`)}
                    </span>
                    <span className="pmi-mono">{fmtDayKey(s.startDate, lang)} → {fmtDayKey(s.endDate, lang)}</span>
                  </div>
                ))}
              </div>

            </>
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

/* ---------- Trọng tâm HÔM NAY theo lộ trình thi ---------- */
// Chỉ hiện khi đã đặt ngày thi — thay hẳn cho DailyGoalCard trong trạng thái đó (xem TodayScreen):
// người học không tự chọn số câu/ngày nữa, mục tiêu LUÔN bám theo lộ trình thi (đồng bộ vào
// progress.tracking.dailyGoal ở effect trong App.jsx nên StreakBadge/goalMet vẫn hoạt động y hệt
// trước). Đây là câu trả lời trực tiếp cho "hôm nay phải làm gì": mục tiêu (đã cộng dồn phần
// thiếu hôm qua — xem computeCatchUp), và MỘT hành động cụ thể để bấm vào làm ngay.
const TODAY_ACTION_ICON = { first_pass: "play", exam_mode: "target", gap_fill: "flag", wait_cooldown: "clock", final_review: "seal", rest: "moon" };
// Trần số câu cho MỘT phiên "Luyện tập ngay" — dù mục tiêu hôm nay có cao (lộ trình gấp), phiên
// luyện vẫn phải đủ ngắn để ngồi một mạch làm hết; còn thiếu thì bấm lại sau khi nộp bài. Đây là
// phần trả lời trực tiếp cho việc tránh phải nộp bài dở dang vì không đủ 3-4 tiếng liền.
const MAX_CHUNK_SIZE = 40;
// Phiên "làm thêm" khi đã đạt mục tiêu hôm nay — nhỏ, không bắt buộc, chỉ để tận dụng lúc rảnh.
const BONUS_CHUNK_SIZE = 10;

export function TodayFocusCard({ progress, tracking, gapProfile, onStart, onStartTodayPractice, onQuickPractice, onOpenPlan }) {
  const { t, lang } = useAppCtx();
  const plan = useMemo(
    () => (tracking.examDate ? buildStudyPlan({ progress, gapProfile, tracking }) : null),
    [progress, gapProfile, tracking]
  );
  const catchUp = useMemo(
    () => (tracking.examDate ? computeCatchUp({ progress, tracking }) : null),
    [progress, tracking]
  );
  if (!plan?.hasExamDate) return null;

  const { done, target, ratio, goalMet, todayRow, streak } = tracking;
  const action = plan.todayAction;
  const accuracy = todayRow && todayRow.answered ? Math.round((todayRow.correct / todayRow.answered) * 100) : 0;
  const chunkSize = Math.min(MAX_CHUNK_SIZE, goalMet ? BONUS_CHUNK_SIZE : Math.max(1, (target || 0) - done));

  return (
    <Card style={goalMet ? { borderColor: "var(--sage)" } : undefined}>
      <div className="flex items-center justify-between mb-3">
        <span className="pmi-eyebrow">{t("todayFocusHeader")}</span>
        <button onClick={onOpenPlan} className="pmi-focusable text-xs font-medium" style={{ color: "var(--ink-mid)" }}>{t("viewFullPlanBtn")}</button>
      </div>

      {plan.phase === "overdue" ? (
        <p className="text-sm" style={{ color: "var(--flag)" }}>{t("studyOverdueMessage")}</p>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`pmi-chip pmi-status-${STUDY_PHASE_RING[plan.phase]}`}>{t(`studyPhase_${plan.phase}`)}</span>
              <span className="text-xs" style={{ color: "var(--ink-soft)" }}>{t("examDateCountdown", { n: plan.daysLeft })}</span>
            </div>
            <StreakBadge streak={streak} />
          </div>

          {plan.workloadQuestions > 0 && target > 0 && (
            <>
              <p className="pmi-display font-semibold text-3xl mb-1" style={goalMet ? { color: "var(--sage)" } : undefined}>
                {done}<span className="text-base font-normal" style={{ color: "var(--ink-soft)" }}> / {target} {t("questionsShort")}</span>
              </p>
              <ProgressBar value={ratio} className="mb-1" />
              <p className="pmi-mono text-[11px] mb-2" style={{ color: "var(--ink-soft)" }}>
                {todayRow
                  ? t("goalTodayStats", { c: todayRow.correct, a: todayRow.answered, p: accuracy, m: todayRow.minutes })
                  : t("goalTodayEmpty")}
              </p>
            </>
          )}

          {catchUp && catchUp.shortfall > 0 ? (
            <p className="text-xs mb-1" style={{ color: "var(--seal-fg)" }}>
              {t("todayCatchUp", { done: catchUp.yesterdayDone, target: catchUp.yesterdayTarget, shortfall: catchUp.shortfall })}
            </p>
          ) : catchUp?.surplus > 0 ? (
            <p className="text-xs mb-1" style={{ color: "var(--sage)" }}>{t("todayCatchUpSurplus", { n: catchUp.surplus })}</p>
          ) : catchUp?.yesterdayTarget > 0 ? (
            <p className="text-xs mb-1" style={{ color: "var(--sage)" }}>{t("todayCatchUpMet")}</p>
          ) : null}

          {action && (
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
              <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Icon name={TODAY_ACTION_ICON[action.type]} size={14} />
                {action.type === "wait_cooldown"
                  ? t("todayAction_wait_cooldown", { quizName: action.quizName, date: fmtDayKey(action.availableDate, lang) })
                  : t(`todayAction_${action.type}`, { quizName: action.quizName, n: action.criticalCount })}
              </p>
              {action.type === "first_pass" && (() => {
                const n = Math.min(chunkSize, action.unseenInQuiz);
                return (
                  <>
                    <Button onClick={() => onStartTodayPractice(action.quizIndex, n)} className="w-full">
                      {goalMet ? t("startPracticeExtraBtn", { n }) : t("startPracticeBtn", { n })}
                    </Button>
                    <p className="text-[11px] mt-1.5" style={{ color: "var(--ink-soft)" }}>{t("todayChunkExplain")}</p>
                  </>
                );
              })()}
              {action.type === "exam_mode" && (
                <>
                  <Button onClick={() => onStart(action.quizIndex, "exam")} className="w-full">{t("startExamBtn")}</Button>
                  <p className="text-[11px] mt-1.5" style={{ color: "var(--ink-soft)" }}>{t("todayExamModeExplain")}</p>
                </>
              )}
              {action.type === "gap_fill" && <Button onClick={() => onQuickPractice(20)} className="w-full">{t("practiceGapBtn")}</Button>}
              {action.type === "wait_cooldown" && <Button variant="secondary" onClick={() => onQuickPractice(20)} className="w-full">{t("practiceGapBtn")}</Button>}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
