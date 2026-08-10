import { useState, useMemo } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { VI_TERM_LIST } from "../../lib/embeddedData.js";
import { termHeadword, isAnswerCorrect } from "../../lib/vocabSrs.js";
import { shuffleArray } from "../../lib/utils.js";
import { Card, Button } from "../../components/ui/primitives.jsx";

export function VocabFlashcardCard({ tm, onGrade }) {
  const { t } = useAppCtx();
  const [flipped, setFlipped] = useState(false);
  return (
    <>
      <Card
        className="text-center py-10 px-6 cursor-pointer select-none"
        onClick={() => setFlipped((f) => !f)}
        style={{ minHeight: 200, display: "flex", flexDirection: "column", justifyContent: "center" }}
      >
        {!flipped ? (
          <>
            <p className="pmi-eyebrow mb-3">{tm.category}</p>
            <p className="pmi-display font-bold text-2xl">{termHeadword(tm)}</p>
          </>
        ) : (
          <div className="space-y-2 text-left">
            <p className="pmi-display font-semibold text-base text-center mb-2">{termHeadword(tm)}</p>
            <p className="text-sm" style={{ color: "var(--ink)" }}>{tm.definitionVi}</p>
            {tm.exampleEn && (
              <p className="text-xs italic" style={{ color: "var(--ink-soft)" }}>
                <span className="pmi-mono not-italic text-[10px] mr-1" style={{ color: "var(--sky)" }}>{t("vocabExampleLabel")}</span>
                “{tm.exampleEn}”
              </p>
            )}
          </div>
        )}
      </Card>
      {!flipped ? (
        <Button onClick={() => setFlipped(true)} className="w-full">{t("vocabFlip")}</Button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => onGrade(false)}>{t("vocabDontKnow")}</Button>
          <Button variant="primary" onClick={() => onGrade(true)}>{t("vocabKnow")}</Button>
        </div>
      )}
    </>
  );
}
export function VocabChoiceCard({ tm, onGrade }) {
  const { t } = useAppCtx();
  const [selected, setSelected] = useState(null);
  const options = useMemo(() => {
    const distractors = shuffleArray(VI_TERM_LIST.filter((x) => x.id !== tm.id && x.definitionVi !== tm.definitionVi)).slice(0, 3).map((x) => x.definitionVi);
    return shuffleArray([tm.definitionVi, ...distractors]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tm.id]);
  const answered = selected !== null;
  const correct = answered && selected === tm.definitionVi;

  return (
    <>
      <Card className="py-8 px-6 text-center" style={{ minHeight: 120 }}>
        <p className="pmi-eyebrow mb-3">{tm.category}</p>
        <p className="pmi-display font-bold text-2xl">{termHeadword(tm)}</p>
      </Card>
      <div className="space-y-2">
        {options.map((opt, i) => {
          let style = { background: "var(--paper)", border: "1px solid var(--line-strong)", color: "var(--ink)" };
          if (answered) {
            if (opt === tm.definitionVi) style = { background: "var(--sage-tint)", border: "1px solid var(--sage)", color: "var(--sage)" };
            else if (opt === selected) style = { background: "var(--flag-tint)", border: "1px solid var(--flag)", color: "var(--flag)" };
            else style = { background: "var(--paper)", border: "1px solid var(--line)", color: "var(--ink-soft)" };
          }
          return (
            <button
              key={i}
              onClick={() => !answered && setSelected(opt)}
              className="pmi-focusable w-full text-left px-3 py-2.5 rounded-lg text-sm"
              style={style}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {answered && <Button onClick={() => onGrade(correct)} className="w-full">{t("vocabNext")}</Button>}
    </>
  );
}
export function VocabTypeCard({ tm, onGrade }) {
  const { t } = useAppCtx();
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const correct = checked && isAnswerCorrect(tm, value);

  function submit() {
    if (!value.trim() || checked) return;
    setChecked(true);
  }

  return (
    <>
      <Card className="py-6 px-6 text-left" style={{ minHeight: 120 }}>
        <p className="pmi-eyebrow mb-2">{tm.category}</p>
        <p className="text-sm" style={{ color: "var(--ink)" }}>{tm.definitionVi}</p>
        {tm.exampleEn && (
          <p className="text-xs italic mt-2" style={{ color: "var(--ink-soft)" }}>
            <span className="pmi-mono not-italic text-[10px] mr-1" style={{ color: "var(--sky)" }}>{t("vocabExampleLabel")}</span>
            “{tm.exampleEn}”
          </p>
        )}
      </Card>
      {!checked ? (
        <>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder={t("vocabTypePlaceholder")}
            className="pmi-input w-full px-3 py-2.5 text-sm"
            autoFocus
          />
          <Button onClick={submit} disabled={!value.trim()} className="w-full">{t("vocabCheck")}</Button>
        </>
      ) : (
        <>
          <div className="text-sm px-1 space-y-1">
            <p style={{ color: correct ? "var(--sage)" : "var(--flag)" }}>
              {correct ? t("vocabCorrect") : `${t("vocabIncorrect")} — ${t("vocabYourAnswer")}: "${value}"`}
            </p>
            <p style={{ color: "var(--ink-mid)" }}>{t("vocabCorrectAnswer")}: <strong style={{ color: "var(--ink)" }}>{termHeadword(tm)}</strong></p>
          </div>
          <Button onClick={() => onGrade(correct)} className="w-full">{t("vocabNext")}</Button>
        </>
      )}
    </>
  );
}
