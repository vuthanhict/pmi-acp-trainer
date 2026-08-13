import { useMemo } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { useIsDesktop, useIsWide } from "../../hooks/useViewport.js";
import { QUIZ_CATALOG } from "../../lib/embeddedData.js";
import { Card, Button, Icon, TierChip } from "../../components/ui/primitives.jsx";
import { QuizPassSummary } from "../progress/trackingWidgets.jsx";
import { buildAllQuizPasses, comparePasses } from "../../lib/passStats.js";

/* ===================== Library Screen ===================== */
export function LibraryScreen({ progress, onOpenQuiz, onOpenHistory, onOpenMistakes, onToggleReserved }) {
  const { t } = useAppCtx();
  const isDesktop = useIsDesktop();
  const isWide = useIsWide();
  const grouped = useMemo(() => {
    const byStage = new Map();
    for (const c of QUIZ_CATALOG) {
      const key = c.stageOrder;
      if (!byStage.has(key)) byStage.set(key, []);
      byStage.get(key).push(c);
    }
    return [...byStage.entries()].sort((a, b) => a[0] - b[0]);
  }, []);

  // Tiến độ theo LƯỢT (lần gặp thứ N của từng câu), suy ra từ attempts — không phải theo phiên.
  // Một đề thường được làm rải rác qua hàng chục phiên nhỏ; điểm từng phiên gần như là nhiễu
  // (xem passStats.js), còn % của cả lượt mới là con số dự báo được kỳ thi.
  const passesByQuiz = useMemo(() => buildAllQuizPasses(progress.attempts), [progress.attempts]);
  const entriesByQuiz = useMemo(() => {
    const m = new Map();
    for (const c of progress.completedQuizzes) {
      if (c.quizIndex == null) continue;
      if (!m.has(c.quizIndex)) m.set(c.quizIndex, []);
      m.get(c.quizIndex).push(c);
    }
    return m;
  }, [progress.completedQuizzes]);

  const reserved = new Set(progress.settings?.reservedQuizIndexes || []);

  return (
    <div className="space-y-5 pt-1">
      {grouped.map(([stageOrder, quizzes]) => (
        <div key={stageOrder}>
          <p className="pmi-eyebrow mb-2">{t("stage")} {stageOrder}</p>
          <div className={isWide ? "grid grid-cols-3 gap-2" : isDesktop ? "grid grid-cols-2 gap-2" : "space-y-2"}>
            {quizzes.map((c) => {
              const entries = entriesByQuiz.get(c.quizIndex) || [];
              const last = entries.length
                ? entries.reduce((mx, e) => (new Date(e.completedAt) > new Date(mx.completedAt) ? e : mx))
                : null;
              const attempts = entries.length;
              const passes = passesByQuiz.get(c.quizIndex) || [];
              // Chỉ so cặp khi đã có lượt 2 — và luôn so trên tập câu chung, xem comparePasses.
              const comparison = passes.length > 1 ? comparePasses(progress.attempts, c.quizIndex, passes.length - 1, passes.length) : null;
              // Chỉ số "làm độc lập" (không dùng hỗ trợ tiếng Việt) của phiên gần nhất. Điểm
              // "lần đầu gặp" của phiên đã bị bỏ khỏi đây: lượt 1 THEO ĐỊNH NGHĨA chính là lần
              // đầu gặp, nên QuizPassSummary ở trên đã nói con số đó trên cả đề thay vì trên
              // dăm câu của một phiên.
              const truth = last?.independentScore
                ? `${t("independentLabel")} ${Math.round(last.independentScore.percent)}%`
                : "";
              return (
                <Card key={c.quizIndex}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-sm pr-2">{c.quizName}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      {reserved.has(c.quizIndex) && <span className="pmi-chip pmi-status-ready">{t("reservedChip")}</span>}
                      <TierChip tier={c.tier} />
                    </div>
                  </div>
                  <p className="pmi-mono text-[11px] mb-2" style={{ color: "var(--ink-soft)" }}>
                    {c.questionCount} {t("questionsShort")} · {passes.length > 0 ? t("attemptedTimes", { n: passes.length }) : t("notAttempted")}
                  </p>
                  {passes.length > 0 && <QuizPassSummary passes={passes} comparison={comparison} />}
                  {truth && <p className="pmi-mono text-[10px] mb-2" style={{ color: "var(--ink-soft)" }}>{truth}</p>}
                  <div className="flex gap-2">
                    <Button onClick={() => onOpenQuiz(c.quizIndex, "exam")} className="flex-1">{t("examBtn")}</Button>
                    <Button onClick={() => onOpenQuiz(c.quizIndex, "practice")} variant="secondary" className="flex-1">{t("practiceBtn")}</Button>
                    {attempts > 0 && (
                      <Button onClick={() => onOpenHistory(c.quizIndex)} variant="ghost" className="shrink-0" title={t("historyOfQuizBtn")}>
                        <Icon name="clock" size={16} />
                      </Button>
                    )}
                    {attempts > 0 && (
                      <Button onClick={() => onOpenMistakes(c.quizIndex)} variant="ghost" className="shrink-0" title={t("mistakesOfQuizBtn")}>
                        <Icon name="warn" size={16} />
                      </Button>
                    )}
                    <Button
                      onClick={() => onToggleReserved(c.quizIndex)}
                      variant="ghost"
                      className="shrink-0"
                      title={reserved.has(c.quizIndex) ? t("reservedOffBtn") : t("reservedOnBtn")}
                    >
                      <Icon name={reserved.has(c.quizIndex) ? "lockClosed" : "lockOpen"} size={16} />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
