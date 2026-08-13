import { useMemo, useState } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { useIsDesktop } from "../../hooks/useViewport.js";
import { Card, DomainRing } from "../../components/ui/primitives.jsx";
import { GapScreen } from "../gap/GapScreen.jsx";
import {
  GoalPicker, StreakBadge, ReadinessCard, TrendChart, Heatmap, MasteryTrendCard, ExamDateCard,
  PlanProgressCard,
} from "./trackingWidgets.jsx";
import { buildPlanProgress, buildStudyPlan } from "../../lib/studyPlan.js";

/* ===================== Progress Screen (Tổng quan / Nhịp luyện / GAP) ===================== */
export function ProgressScreen({ progress, gapProfile, tracking, onFillGap, onGoLibrary, onSetGoal, onSetExamDate, onStartTodayPractice, onStartExamMode }) {
  const { t } = useAppCtx();
  const isDesktop = useIsDesktop();
  const [tab, setTab] = useState("overview");
  // Chỉ tính khi thực sự mở tab Nhịp luyện: hàm dựng lại khối lượng lộ trình cho từng ngày.
  const planProgress = useMemo(
    () => (tab === "rhythm" ? buildPlanProgress({ progress, tracking }) : null),
    [tab, progress, tracking],
  );
  // Mốc bắt buộc + danh sách đề lấy từ buildStudyPlan — cùng nguồn với thẻ Ngày thi bên dưới, để
  // vạch trên biểu đồ và bảng đề không bao giờ lệch nhau.
  const studyPlan = useMemo(
    () => (tab === "rhythm" && tracking.examDate ? buildStudyPlan({ progress, gapProfile, tracking }) : null),
    [tab, progress, gapProfile, tracking],
  );
  const tabs = [
    { key: "overview", label: t("progressTabOverview") },
    { key: "rhythm", label: t("progressTabRhythm") },
    { key: "gap", label: t("progressTabGap") },
  ];

  return (
    <div className="pt-1 space-y-4 pb-4">
      <div className="pmi-tabs" role="tablist">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            role="tab"
            aria-selected={tab === tb.key}
            onClick={() => setTab(tb.key)}
            className={`pmi-tab pmi-focusable ${tab === tb.key ? "is-active" : ""}`}
          >{tb.label}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className={isDesktop ? "grid grid-cols-2 gap-4 items-start" : "space-y-4"}>
          <Card className="flex items-center justify-around py-5" style={isDesktop ? { gridColumn: "span 2" } : undefined}>
            {gapProfile.domains.map((d) => (
              <DomainRing key={d.domain} domain={d.domain} mastery={d.mastery} />
            ))}
          </Card>
          <ReadinessCard readiness={tracking.readiness} onAction={onFillGap} />
          <div className="space-y-4">
            <Card>
              <p className="pmi-eyebrow mb-3">{t("trendHeader")}</p>
              <TrendChart points={tracking.trend} />
            </Card>
            <Card>
              <p className="pmi-eyebrow mb-3">{t("masteryTrendHeader")}</p>
              <MasteryTrendCard masteryTrend={tracking.masteryTrend} />
            </Card>
          </div>
        </div>
      )}

      {tab === "rhythm" && (
        <div className={isDesktop ? "grid grid-cols-2 gap-4 items-start" : "space-y-4"}>
          <Card>
            <p className="pmi-eyebrow mb-3">{t("heatmapHeader")}</p>
            <Heatmap tracking={tracking} planRows={planProgress?.rows} />
          </Card>
          <Card>
            <div className="flex items-center justify-between mb-3">
              <span className="pmi-eyebrow">{t("goalHeaderToday")}</span>
              <StreakBadge streak={tracking.streak} />
            </div>
            <div className="pmi-mono grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] mb-3" style={{ color: "var(--ink-mid)" }}>
              <span>{t("streakLongest", { n: tracking.streak.longest })}</span>
              <span>{t("streakFreezeLeft", { n: tracking.streak.freezesLeft })}</span>
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--ink-soft)" }}>{t("streakFreezeExplain")}</p>
            {tracking.examDate ? (
              <p className="text-xs" style={{ color: "var(--ink-mid)" }}>{t("goalLockedByPlan")}</p>
            ) : (
              <GoalPicker goal={tracking.goal} onSave={onSetGoal} onCancel={null} />
            )}
          </Card>
          <Card style={isDesktop ? { gridColumn: "span 2" } : undefined}>
            <p className="pmi-eyebrow mb-3">{t("planHeader")}</p>
            {!planProgress?.hasExamDate ? (
              <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{t("planNoExamDate")}</p>
            ) : planProgress.overdue ? (
              <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{t("planOverdue")}</p>
            ) : (
              <PlanProgressCard plan={planProgress} studyPlan={studyPlan} onStartTodayPractice={onStartTodayPractice} onStartExamMode={onStartExamMode} />
            )}
          </Card>
          {/* Chiếm trọn chiều rộng — bảng "số lượt cần làm từng đề" bên trong cần đủ không gian
              để hiện tên đề không bị cắt ngắn. */}
          <ExamDateCard
            progress={progress} tracking={tracking} gapProfile={gapProfile}
            onSetExamDate={onSetExamDate} onFillGap={onFillGap} onGoLibrary={onGoLibrary}
            style={isDesktop ? { gridColumn: "span 2" } : undefined}
          />
        </div>
      )}

      {tab === "gap" && <GapScreen gapProfile={gapProfile} onFillGap={onFillGap} embedded />}
    </div>
  );
}
