import { useAppCtx } from "../../context/AppContext.jsx";
import { useIsDesktop } from "../../hooks/useViewport.js";
import { QUIZ_CATALOG } from "../../lib/embeddedData.js";
import { recommendNextQuiz } from "../../lib/recommend.js";
import { fmtPct } from "../../lib/utils.js";
import { Card, Button, DomainRing, ProgressBar, StatusChip, TierChip } from "../../components/ui/primitives.jsx";
import { DailyGoalCard } from "../progress/trackingWidgets.jsx";

/* ===================== Today Screen ===================== */
export function TodayScreen({ progress, gapProfile, tracking, onResume, onStart, onGoLibrary, onGoGap, onGoFillGap, onSetGoal, onQuickPractice }) {
  const { t } = useAppCtx();
  const isDesktop = useIsDesktop();
  const rec = recommendNextQuiz(progress);
  const recCat = QUIZ_CATALOG.find((c) => c.quizIndex === rec.quizIndex);
  const topGaps = gapProfile.tasks.slice(0, 3);

  return (
    <div className="space-y-4 pt-1">
      {/* Mục tiêu hôm nay đứng TRÊN mọi thứ khác: đây là thứ biến app từ công cụ chẩn đoán
          thành công cụ giữ nhịp. Một chạm là vào bài, không bắt chọn task trước. */}
      <DailyGoalCard tracking={tracking} onSetGoal={onSetGoal} onPractice={onQuickPractice} />

      {/* Hero: 4 Domain Rings — con số mastery thật của app, không phải trang trí */}
      <Card className="flex items-center justify-around py-5">
        {gapProfile.domains.map((d) => (
          <DomainRing key={d.domain} domain={d.domain} mastery={d.mastery} onClick={onGoGap} />
        ))}
      </Card>

      <div className={isDesktop ? "grid grid-cols-2 gap-4" : "space-y-4"}>
        {progress.activeSession && (
          <Card style={isDesktop ? { gridColumn: "span 2", borderColor: "var(--line-strong)" } : { borderColor: "var(--line-strong)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="pmi-eyebrow">{t("inProgress")}</span>
              <span className="pmi-mono text-[11px]" style={{ color: "var(--ink-soft)" }}>{t(progress.activeSession.mode === "exam" ? "modeExam" : progress.activeSession.mode === "practice" ? "modePractice" : "modeFillgap")}</span>
            </div>
            <p className="font-medium mb-1">{progress.activeSession.quizName}</p>
            <p className="text-xs mb-3" style={{ color: "var(--ink-mid)" }}>{t("questionsAnswered", { n: progress.activeSession.answeredQuestionIds.length, total: progress.activeSession.questionIds.length })}</p>
            <ProgressBar value={progress.activeSession.answeredQuestionIds.length / progress.activeSession.questionIds.length} className="mb-3" />
            <Button onClick={onResume} className={isDesktop ? "w-auto" : "w-full"}>{t("continueBtn")}</Button>
          </Card>
        )}

        {recCat && (
          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="pmi-eyebrow">{t("recommendedNext")}</span>
              <TierChip tier={recCat.tier} />
            </div>
            <p className="pmi-display font-semibold mb-1">{recCat.quizName}</p>
            <p className="text-xs mb-3" style={{ color: "var(--ink-mid)" }}>{t("questionsCount", { n: recCat.questionCount })}</p>
            <div className="flex gap-2">
              <Button onClick={() => onStart(recCat.quizIndex)} className="flex-1">{t("startExamBtn")}</Button>
              <Button onClick={onGoLibrary} variant="secondary">{t("libraryBtn")}</Button>
            </div>
          </Card>
        )}

        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="pmi-eyebrow">{t("top3Gaps")}</span>
            <button onClick={onGoGap} className="pmi-focusable text-xs font-medium" style={{ color: "var(--ink)" }}>{t("viewAll")}</button>
          </div>
          {topGaps.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>{t("noGapData")}</p>
          ) : (
            <div className="space-y-3">
              {topGaps.map((tk) => (
                <div key={tk.taskId} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{tk.taskId} · {tk.taskName}</p>
                    <p className="pmi-mono text-[11px]" style={{ color: "var(--ink-soft)" }}>{tk.domain} · {t("accuracyLabel")} {fmtPct(tk.accuracy)}</p>
                  </div>
                  <StatusChip status={tk.status} />
                </div>
              ))}
              <Button onClick={onGoFillGap} variant="secondary" className="w-full mt-1">{t("practiceGapBtn")}</Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
