import { useState, useMemo } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { QUIZ_CATALOG } from "../../lib/embeddedData.js";
import { fmtDate } from "../../lib/utils.js";
import { Card } from "../../components/ui/primitives.jsx";

/* ===================== History Screen ===================== */
export function HistoryScreen({ progress, initialQuizFilter, onOpenEntry }) {
  const { t, lang } = useAppCtx();
  const [quizFilter, setQuizFilter] = useState(initialQuizFilter ?? "all");
  const [modeFilter, setModeFilter] = useState("all");

  const entries = useMemo(() => {
    return progress.completedQuizzes
      .filter((c) => quizFilter === "all" || c.quizIndex === quizFilter)
      .filter((c) => modeFilter === "all" || c.mode === modeFilter)
      .slice()
      .sort((a, b) => new Date(b.completedAt ?? 0) - new Date(a.completedAt ?? 0));
  }, [progress.completedQuizzes, quizFilter, modeFilter]);

  const modeFilters = [
    { key: "all", label: t("historyFilterModeAll") },
    { key: "exam", label: t("examBtn") },
    { key: "practice", label: t("practiceBtn") },
    { key: "fillgap", label: t("modeFillgap") },
  ];

  return (
    <div className="space-y-4 pt-1 pb-4">
      <p className="pmi-eyebrow">{t("historyTitle")}</p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={quizFilter === "all" ? "all" : String(quizFilter)}
          onChange={(e) => setQuizFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
          className="pmi-mono text-xs px-3 py-2 rounded-lg flex-1"
          style={{ background: "var(--paper)", border: "1px solid var(--line-strong)", color: "var(--ink-mid)" }}
        >
          <option value="all">{t("historyFilterQuizAll")}</option>
          {QUIZ_CATALOG.map((c) => (
            <option key={c.quizIndex} value={c.quizIndex}>{c.quizName}</option>
          ))}
        </select>
        <div className="flex gap-1.5 overflow-x-auto">
          {modeFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setModeFilter(f.key)}
              className="pmi-mono shrink-0 text-xs px-3 py-1.5 rounded-full font-medium"
              style={modeFilter === f.key ? { background: "var(--accent)", color: "var(--accent-fg)" } : { background: "var(--paper)", border: "1px solid var(--line-strong)", color: "var(--ink-mid)" }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-center py-10" style={{ color: "var(--ink-soft)" }}>{t("historyEmpty")}</p>
      ) : (
        <>
          <p className="pmi-mono text-[11px]" style={{ color: "var(--ink-soft)" }}>{t("historyEntryCount", { n: entries.length })}</p>
          <div className="space-y-2">
            {entries.map((c) => (
              <Card key={c.sessionId} onClick={() => onOpenEntry(c.sessionId)}>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <p className="font-medium text-sm pr-2">{c.quizName}</p>
                  <span className="pmi-chip pmi-status-developing shrink-0">{c.mode === "exam" ? t("examBtn") : c.mode === "practice" ? t("practiceBtn") : t("modeFillgap")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="pmi-mono text-[11px]" style={{ color: "var(--ink-soft)" }}>{fmtDate(c.completedAt, lang)}</p>
                  <p className="pmi-mono text-sm font-semibold" style={{ color: c.trustedScore.percent >= 70 ? "var(--sage)" : "var(--flag)" }}>{c.trustedScore.percent}%</p>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
