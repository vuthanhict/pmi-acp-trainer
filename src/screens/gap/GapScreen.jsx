import { useMemo, useState } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { useIsDesktop, useIsWide } from "../../hooks/useViewport.js";
import { DOMAIN_MINDSET, DIAGNOSIS_LABEL } from "../../i18n/text.js";
import { fmtPct } from "../../lib/utils.js";
import { buildGapPracticeQuestionIds } from "../../lib/trackingEngine.js";
import { Card, Button, DomainRing, StatusChip, ProgressBar } from "../../components/ui/primitives.jsx";

/* ===================== GAP Screen ===================== */
export function GapScreen({ gapProfile, onFillGap, embedded = false }) {
  const { t, lang } = useAppCtx();
  const isDesktop = useIsDesktop();
  const isWide = useIsWide();
  const byDomain = useMemo(() => {
    const m = new Map();
    for (const tk of gapProfile.tasks) {
      if (!m.has(tk.domain)) m.set(tk.domain, []);
      m.get(tk.domain).push(tk);
    }
    return m;
  }, [gapProfile]);

  return (
    <div className={embedded ? "space-y-4" : "pt-1 space-y-4 pb-4"}>
      {/* Khi nhúng trong màn Tiến độ, vòng domain đã hiển thị ở tab Tổng quan — không lặp lại. */}
      {!embedded && (
        <Card className="flex items-center justify-around py-5">
          {gapProfile.domains.map((d) => (
            <DomainRing key={d.domain} domain={d.domain} mastery={d.mastery} />
          ))}
        </Card>
      )}

      {gapProfile.domains.map((d) => (
        <div key={d.domain}>
          <div className="flex items-center justify-between mb-2">
            <p className="pmi-eyebrow">{d.domain}</p>
            <p className="pmi-mono text-[11px]" style={{ color: "var(--ink-soft)" }}>{d.mastery === null ? t("insufficientDataShort") : `${t("masteryLabel")} ${fmtPct(d.mastery)}`}</p>
          </div>
          <div className={isWide ? "grid grid-cols-3 gap-2" : isDesktop ? "grid grid-cols-2 gap-2" : "space-y-2"}>
            {(byDomain.get(d.domain) || []).map((tk) => {
              // Ngoài 2 chẩn đoán hành vi rõ rệt (đọc nhanh dính bẫy, tự tin nhưng sai), tip tư duy cũng
              // đáng hiện cho concept_gap và answer_change_risk: phần lớn câu hỏi tình huống PMI-ACP
              // sai không phải vì thiếu kiến thức mà vì áp tư duy truyền thống/waterfall thay vì agile —
              // và việc đổi từ đáp án đúng bản năng sang đáp án "nghe có vẻ đúng quy trình" cũng là
              // biểu hiện của việc chưa tin vào tư duy agile. Không áp dụng cho fluency_gap (vấn đề tốc
              // độ) hay language_gap_candidate (vấn đề đọc hiểu tiếng Anh) vì không liên quan tư duy.
              const isMindsetIssue = ["reading_or_mindset_trap", "blind_spot", "concept_gap", "answer_change_risk"].some((d) => tk.diagnoses.includes(d));
              return (
              <Card key={tk.taskId}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{tk.taskId} · {tk.taskName}</p>
                  <StatusChip status={tk.status} />
                </div>
                <ProgressBar value={tk.mastery} className="mb-2" />
                <div className="pmi-mono grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] mb-2" style={{ color: "var(--ink-mid)" }}>
                  <span>{t("attemptsLabel")}: {tk.attempts}</span>
                  <span>{t("sessionsLabel")}: {tk.sessions}</span>
                  <span>{t("accLabel")}: {fmtPct(tk.accuracy)}</span>
                  <span>{t("calLabel")}: {fmtPct(tk.confidenceCalibration)}</span>
                  <span>{t("speedLabel")}: {tk.speedScore === null ? "—" : fmtPct(tk.speedScore)}</span>
                  <span>{t("evidenceLabel")}: {fmtPct(tk.evidence)}</span>
                  <span>{t("viHelpRatioLabel")}: {tk.assistedRatio === null ? "—" : fmtPct(tk.assistedRatio)}</span>
                </div>
                {tk.diagnoses.length > 0 && <DiagnosisChips diagnoses={tk.diagnoses} />}
                {isMindsetIssue && DOMAIN_MINDSET[lang][tk.domain] && (
                  <p className="text-xs mt-2 flex gap-1.5" style={{ color: "var(--seal-fg)" }}>
                    <span className="shrink-0">💡</span>
                    <span>{DOMAIN_MINDSET[lang][tk.domain]}</span>
                  </p>
                )}
              </Card>
              );
            })}
            {(byDomain.get(d.domain) || []).length === 0 && <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{t("noDataForDomain")}</p>}
          </div>
        </div>
      ))}
      <Button onClick={onFillGap} className={isDesktop ? "w-auto" : "w-full"}>{t("practiceGapNow")}</Button>
    </div>
  );
}
export function DiagnosisChips({ diagnoses }) {
  const { lang } = useAppCtx();
  return (
    <div className="flex flex-wrap gap-1">
      {diagnoses.map((r) => (
        <span key={r} className="pmi-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--paper)", color: "var(--ink-mid)", border: "1px solid var(--line)" }}>{DIAGNOSIS_LABEL[lang][r] || r}</span>
      ))}
    </div>
  );
}

/* ===================== Fill-gap Screen ===================== */
export function FillGapScreen({ progress, gapProfile, onStart, onBack }) {
  const { t } = useAppCtx();
  const isDesktop = useIsDesktop();
  const [selectedTasks, setSelectedTasks] = useState(() => gapProfile.tasks.slice(0, 3).map((tk) => tk.taskId));
  const [size, setSize] = useState(10);
  const candidateTasks = gapProfile.tasks.slice(0, 8);

  function toggleTask(taskId) {
    setSelectedTasks((prev) => {
      if (prev.includes(taskId)) return prev.filter((tid) => tid !== taskId);
      if (prev.length >= 3) return prev;
      return [...prev, taskId];
    });
  }

  // Dùng chung bộ chọn câu với nút "Làm tiếp N câu" ở màn Hôm nay (xem buildGapPracticeQuestionIds).
  function buildSession() {
    return buildGapPracticeQuestionIds({
      attempts: progress.attempts, taskIds: selectedTasks, size,
      reservedQuizIndexes: progress.settings?.reservedQuizIndexes || [],
    });
  }

  return (
    <div className="pt-1 space-y-4 pb-4">
      <button onClick={onBack} className="pmi-focusable text-xs" style={{ color: "var(--ink-soft)" }}>{t("backToGap")}</button>
      <Card>
        <p className="pmi-eyebrow mb-3">{t("chooseTasks")}</p>
        <div className="space-y-2">
          {candidateTasks.map((tk) => (
            <button
              key={tk.taskId}
              onClick={() => toggleTask(tk.taskId)}
              className="pmi-focusable w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between"
              style={selectedTasks.includes(tk.taskId) ? { border: "1.5px solid var(--ink)", background: "var(--paper)" } : { border: "1.5px solid var(--line-strong)" }}
            >
              <span className="text-sm">{tk.taskId} · {tk.taskName}</span>
              <StatusChip status={tk.status} />
            </button>
          ))}
          {candidateTasks.length === 0 && <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{t("noTasksYet")}</p>}
        </div>
      </Card>
      <Card>
        <p className="pmi-eyebrow mb-3">{t("sessionSize")}</p>
        <div className="flex gap-2">
          {[8, 10, 12, 15].map((n) => (
            <button
              key={n} onClick={() => setSize(n)}
              className="pmi-focusable pmi-mono flex-1 py-2 rounded-lg text-sm font-semibold"
              style={size === n ? { background: "var(--accent)", color: "var(--accent-fg)" } : { background: "var(--paper)", border: "1px solid var(--line-strong)", color: "var(--ink-mid)" }}
            >{n}</button>
          ))}
        </div>
      </Card>
      <Button onClick={() => onStart(buildSession(), size)} disabled={!selectedTasks.length} className={isDesktop ? "w-auto" : "w-full"}>{t("startFillGapBtn")}</Button>
    </div>
  );
}
