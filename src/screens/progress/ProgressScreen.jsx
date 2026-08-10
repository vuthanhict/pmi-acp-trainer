import { useState } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { useIsDesktop } from "../../hooks/useViewport.js";
import { Card, DomainRing } from "../../components/ui/primitives.jsx";
import { GapScreen } from "../gap/GapScreen.jsx";
import {
  GoalPicker, StreakBadge, ReadinessCard, TrendChart, Heatmap, MasteryTrendCard, ExamDateCard,
} from "./trackingWidgets.jsx";

/* ===================== Progress Screen (Tổng quan / Nhịp luyện / GAP) ===================== */
export function ProgressScreen({ progress, gapProfile, tracking, onFillGap, onSetGoal, onSetExamDate }) {
  const { t } = useAppCtx();
  const isDesktop = useIsDesktop();
  const [tab, setTab] = useState("overview");
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
          <Card style={isDesktop ? { gridColumn: "span 2" } : undefined}>
            <p className="pmi-eyebrow mb-3">{t("heatmapHeader")}</p>
            <Heatmap tracking={tracking} />
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
            <GoalPicker goal={tracking.goal} onSave={onSetGoal} onCancel={null} />
          </Card>
          <ExamDateCard tracking={tracking} gapProfile={gapProfile} onSetExamDate={onSetExamDate} />
        </div>
      )}

      {tab === "gap" && <GapScreen gapProfile={gapProfile} onFillGap={onFillGap} embedded />}
    </div>
  );
}
