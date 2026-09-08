import { useAppCtx } from "../../context/AppContext.jsx";
import { useIsDesktop } from "../../hooks/useViewport.js";
import { recommendNextQuiz } from "../../lib/recommend.js";
import { pickGapTaskIds, MAX_CHUNK_SIZE } from "../../lib/trackingEngine.js";
import { fmtPct } from "../../lib/utils.js";
import { Card, Button, DomainRing, ProgressBar, StatusChip, TierChip } from "../../components/ui/primitives.jsx";
import { DailyGoalCard, TodayFocusCard } from "../progress/trackingWidgets.jsx";

/* ===================== Today Screen ===================== */
export function TodayScreen({ progress, gapProfile, tracking, onResume, onStart, onStartTodayPractice, onGoLibrary, onGoGap, onGoFillGap, onSetGoal, onQuickPractice }) {
  const { t } = useAppCtx();
  const isDesktop = useIsDesktop();
  const rec = recommendNextQuiz(progress);
  // Chế độ và số câu bám đúng trạng thái thật của đề. Trước đây nút LUÔN gọi Exam mode và hiện
  // questionCount của cả đề, nên vừa mời làm Exam mode một đề chưa học câu nào, vừa nói "120 câu"
  // trong khi phiên nạp ít hơn (đề có câu manualReview, hoặc lượt exam đang làm dở).
  const recNeedsExam = rec.status === "needs_exam_mode";
  const recCount = recNeedsExam ? rec.remaining : Math.min(MAX_CHUNK_SIZE, rec.remaining);
  // Một task ưu tiên nhất của TỪNG domain thay vì 3 task đầu bảng. gapPriority nhân với
  // examWeight nên 3 task đầu luôn thuộc các domain nặng ký: trên dữ liệu thật là M2/D7/D3, không
  // bao giờ có Product — trong khi ReadinessCard ngay màn Tiến độ lại nêu đích danh Product là
  // domain yếu nhất. Hai chỗ nói ngược nhau về cùng một bộ dữ liệu.
  const topGaps = pickGapTaskIds(gapProfile.tasks, gapProfile.domains.length)
    .map((id) => gapProfile.tasks.find((tk) => tk.taskId === id))
    .filter(Boolean);

  return (
    <div className="space-y-4 pt-1">
      {/* Đã đặt ngày thi thì lộ trình LÀ mục tiêu hằng ngày — TodayFocusCard thay hẳn cho
          DailyGoalCard (không còn chọn tay 10/20/30/50 nữa, số câu luôn bám theo lộ trình, xem
          effect đồng bộ dailyGoal trong App.jsx). Chưa đặt ngày thi thì vẫn dùng mục tiêu tự chọn
          như trước — TodayFocusCard tự ẩn (trả null) khi không có ngày thi. */}
      {tracking.examDate ? (
        <TodayFocusCard
          progress={progress} tracking={tracking} gapProfile={gapProfile}
          onStart={onStart} onStartTodayPractice={onStartTodayPractice} onQuickPractice={onQuickPractice} onOpenPlan={onGoGap}
        />
      ) : (
        <DailyGoalCard tracking={tracking} onSetGoal={onSetGoal} onPractice={onQuickPractice} />
      )}

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

        {rec && rec.status !== "done" && (
          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="pmi-eyebrow">{t("recommendedNext")}</span>
              <TierChip tier={rec.tier} />
            </div>
            <p className="pmi-display font-semibold mb-1">{rec.quizName}</p>
            <p className="text-xs mb-3" style={{ color: "var(--ink-mid)" }}>{t("questionsCount", { n: recCount })}</p>
            <div className="flex gap-2">
              {recNeedsExam ? (
                <Button onClick={() => onStart(rec.quizIndex, "exam")} className="flex-1">{t("startExamContinueBtn", { n: recCount })}</Button>
              ) : (
                <Button onClick={() => onStartTodayPractice(rec.quizIndex, recCount)} className="flex-1">{t("startPracticeBtn", { n: recCount })}</Button>
              )}
              <Button onClick={onGoLibrary} variant="secondary">{t("libraryBtn")}</Button>
            </div>
          </Card>
        )}

        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="pmi-eyebrow">{t("topGapsByDomain")}</span>
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
