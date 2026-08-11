import { useMemo, useState } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { QUESTION_INDEX } from "../../lib/embeddedData.js";
import { buildMistakeReview } from "../../lib/mistakeReview.js";
import { Card, Button, Icon } from "../../components/ui/primitives.jsx";
import { ReviewQuestionCard } from "../results/ResultsScreen.jsx";

/* ---------- Một dòng câu hay sai: tóm tắt gấp lại, bấm để xem chi tiết đầy đủ ---------- */
function MistakeRow({ row, savedVocabIds, onToggleVocabSaved }) {
  const { t } = useAppCtx();
  const [open, setOpen] = useState(false);
  const q = QUESTION_INDEX.get(row.questionId);
  if (!q) return null;
  return (
    <div>
      <Card className="py-3" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm truncate">{q.questionNumber != null ? `#${q.questionNumber} · ` : ""}{q.stem}</p>
            <p className="pmi-mono text-[11px] mt-0.5" style={{ color: row.lastCorrect ? "var(--sage)" : "var(--flag)" }}>
              {t("mistakeReviewRowStats", { wrong: row.wrongCount, total: row.totalAttempts })}
              {" · "}{row.lastCorrect ? t("mistakeReviewLastCorrect") : t("mistakeReviewLastWrong")}
            </p>
          </div>
          <Icon name={open ? "chevronUp" : "chevronDown"} size={14} style={{ color: "var(--ink-soft)" }} className="shrink-0" />
        </div>
      </Card>
      {open && (
        <div className="mt-2">
          <ReviewQuestionCard
            item={{ kind: row.lastCorrect ? "correct" : "wrong", a: row.lastAttempt }}
            savedVocabIds={savedVocabIds}
            onToggleVocabSaved={onToggleVocabSaved}
          />
        </div>
      )}
    </div>
  );
}

/* ===================== Màn "Câu hay sai" của một đề ===================== */
export function MistakeReviewScreen({ progress, quizIndex, quizName, onBack, onPracticeMistakes, onToggleVocabSaved }) {
  const { t } = useAppCtx();
  const savedVocabIds = useMemo(() => new Set(Object.keys(progress.vocabSaved || {})), [progress.vocabSaved]);
  const rows = useMemo(() => buildMistakeReview({ attempts: progress.attempts, quizIndex }), [progress.attempts, quizIndex]);
  const repeatRows = rows.filter((r) => r.wrongCount >= 2);
  const onceRows = rows.filter((r) => r.wrongCount === 1);

  return (
    <div className="pt-1 space-y-4 pb-4">
      <button onClick={onBack} className="pmi-focusable text-sm font-medium flex items-center gap-1" style={{ color: "var(--ink-mid)" }}>
        <Icon name="left" size={14} /> {t("mistakeReviewBackBtn")}
      </button>

      <div>
        <p className="pmi-eyebrow mb-1">{t("mistakeReviewHeader")}</p>
        <p className="pmi-display font-semibold text-lg">{quizName}</p>
      </div>

      {rows.length === 0 ? (
        <Card><p className="text-sm" style={{ color: "var(--ink-soft)" }}>{t("mistakeReviewEmpty")}</p></Card>
      ) : (
        <>
          <Card className="py-3">
            <p className="text-xs" style={{ color: "var(--ink-mid)" }}>
              {t("mistakeReviewSummary", { repeat: repeatRows.length, once: onceRows.length })}
            </p>
            <Button onClick={() => onPracticeMistakes(rows.map((r) => r.questionId))} className="w-full mt-3">
              {t("mistakeReviewPracticeBtn", { n: rows.length })}
            </Button>
          </Card>

          {repeatRows.length > 0 && (
            <div>
              <p className="pmi-eyebrow mb-2">{t("mistakeReviewRepeatHeader")}</p>
              <div className="space-y-2">
                {repeatRows.map((r) => (
                  <MistakeRow key={r.questionId} row={r} savedVocabIds={savedVocabIds} onToggleVocabSaved={onToggleVocabSaved} />
                ))}
              </div>
            </div>
          )}

          {onceRows.length > 0 && (
            <div>
              <p className="pmi-eyebrow mb-2">{t("mistakeReviewOnceHeader")}</p>
              <div className="space-y-2">
                {onceRows.map((r) => (
                  <MistakeRow key={r.questionId} row={r} savedVocabIds={savedVocabIds} onToggleVocabSaved={onToggleVocabSaved} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
