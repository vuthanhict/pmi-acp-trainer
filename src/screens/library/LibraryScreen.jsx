import { useMemo } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { useIsDesktop, useIsWide } from "../../hooks/useViewport.js";
import { QUIZ_CATALOG } from "../../lib/embeddedData.js";
import { Card, Button, Icon, TierChip } from "../../components/ui/primitives.jsx";
import { AttemptSparkline } from "../progress/trackingWidgets.jsx";

/* ===================== Library Screen ===================== */
export function LibraryScreen({ progress, onOpenQuiz, onOpenHistory, onOpenMistakes }) {
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

  // Toàn bộ lần làm của mỗi bộ đề, xếp theo thời gian — để vẽ được L1 → L2 → L3 thay vì
  // chỉ hiện điểm lần cuối (mất hoàn toàn cảm giác tiến bộ, thứ giữ động lực ôn thi).
  const entriesByQuiz = useMemo(() => {
    const m = new Map();
    for (const c of progress.completedQuizzes) {
      if (c.quizIndex == null) continue;
      if (!m.has(c.quizIndex)) m.set(c.quizIndex, []);
      m.get(c.quizIndex).push(c);
    }
    for (const list of m.values()) list.sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
    return m;
  }, [progress.completedQuizzes]);

  return (
    <div className="space-y-5 pt-1">
      {grouped.map(([stageOrder, quizzes]) => (
        <div key={stageOrder}>
          <p className="pmi-eyebrow mb-2">{t("stage")} {stageOrder}</p>
          <div className={isWide ? "grid grid-cols-3 gap-2" : isDesktop ? "grid grid-cols-2 gap-2" : "space-y-2"}>
            {quizzes.map((c) => {
              const entries = entriesByQuiz.get(c.quizIndex) || [];
              const last = entries.length ? entries[entries.length - 1] : null;
              const attempts = entries.length;
              // Chỉ số "sự thật": lần đầu gặp và làm độc lập của lượt gần nhất. Cố tình đặt
              // ngay cạnh sparkline để con số đẹp không đứng một mình.
              const truth = last
                ? [
                    last.firstExposureScore ? t("resultsFirstExposureLine", { p: Math.round(last.firstExposureScore.percent), c: last.firstExposureScore.correct, n: last.firstExposureScore.graded }) : null,
                    last.independentScore ? `${t("independentLabel")} ${Math.round(last.independentScore.percent)}%` : null,
                  ].filter(Boolean).join(" · ")
                : "";
              return (
                <Card key={c.quizIndex}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-sm pr-2">{c.quizName}</p>
                    <TierChip tier={c.tier} />
                  </div>
                  <p className="pmi-mono text-[11px] mb-2" style={{ color: "var(--ink-soft)" }}>
                    {c.questionCount} {t("questionsShort")} · {attempts > 0 ? t("attemptedTimes", { n: attempts }) : t("notAttempted")}
                  </p>
                  {attempts > 0 && <AttemptSparkline entries={entries} />}
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
