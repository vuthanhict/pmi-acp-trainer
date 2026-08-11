import { useState, useMemo } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { VI_TERM_LIST } from "../../lib/embeddedData.js";
import { termHeadword, isAnswerCorrect } from "../../lib/vocabSrs.js";
import { shuffleArray } from "../../lib/utils.js";
import { Card, Button, Icon } from "../../components/ui/primitives.jsx";
import { SpeakButton } from "../../components/vocab/SpeakButton.jsx";
import { RATE_SENTENCE } from "../../lib/speech.js";

export function VocabFlashcardCard({ tm, onGrade, saved, onToggleSave }) {
  const { t } = useAppCtx();
  const [flipped, setFlipped] = useState(false);
  return (
    <>
      <Card
        className="text-center py-10 px-6 cursor-pointer select-none"
        onClick={() => setFlipped((f) => !f)}
        style={{ minHeight: 200, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative" }}
      >
        {/* Đánh dấu/bỏ đánh dấu ngay trong lúc ôn — thẻ nào lật ra thấy vẫn chưa nhớ thì lưu lại
            luôn, không phải quay về màn làm đề mới lưu được. */}
        {onToggleSave && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSave(); }}
            title={saved ? t("vocabPanelUnsave") : t("vocabPanelSave")}
            aria-label={saved ? t("vocabPanelUnsave") : t("vocabPanelSave")}
            className="pmi-focusable p-1 rounded-md"
            style={{ position: "absolute", top: 10, right: 10, color: saved ? "var(--seal-fg)" : "var(--ink-soft)" }}
          >
            <Icon name={saved ? "starFilled" : "star"} size={17} />
          </button>
        )}
        {!flipped ? (
          <>
            <p className="pmi-eyebrow mb-3">{tm.category}</p>
            <div className="flex items-center justify-center gap-1.5">
              <p className="pmi-display font-bold text-2xl">{termHeadword(tm)}</p>
              <SpeakButton text={termHeadword(tm)} size={18} title={t("speakWord")} />
            </div>
            {tm.ipa && <p className="pmi-mono text-xs mt-1.5" style={{ color: "var(--sky)" }}>{tm.ipa}</p>}
          </>
        ) : (
          <div className="space-y-2 text-left">
            <div className="flex items-center justify-center gap-1.5">
              <p className="pmi-display font-semibold text-base">{termHeadword(tm)}</p>
              <SpeakButton text={termHeadword(tm)} size={16} title={t("speakWord")} />
            </div>
            {tm.ipa && <p className="pmi-mono text-[11px] text-center mb-2" style={{ color: "var(--sky)" }}>{tm.ipa}</p>}
            <p className="text-sm" style={{ color: "var(--ink)" }}>{tm.definitionVi}</p>
            {tm.senseEn && (
              <p className="text-xs" style={{ color: "var(--ink-mid)" }}>
                <span className="pmi-mono text-[9px] font-bold mr-1.5" style={{ color: "var(--ink-soft)" }}>EN</span>
                {tm.senseEn}
              </p>
            )}
            {tm.exampleEn && (
              <p className="text-xs italic flex items-start gap-1" style={{ color: "var(--ink-soft)" }}>
                <span className="pmi-mono not-italic text-[10px] mr-1 shrink-0" style={{ color: "var(--sky)" }}>{t("vocabExampleLabel")}</span>
                <span className="flex-1">“{tm.exampleEn}”</span>
                <SpeakButton text={tm.exampleEn} rate={RATE_SENTENCE} size={13} title={t("speakExample")} />
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
        <div className="flex items-center justify-center gap-1.5">
          <p className="pmi-display font-bold text-2xl">{termHeadword(tm)}</p>
          {/* Chế độ trắc nghiệm hiện sẵn từ và hỏi nghĩa, nên nghe phát âm không lộ đáp án. */}
          <SpeakButton text={termHeadword(tm)} size={18} title={t("speakWord")} />
        </div>
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
            <p className="flex items-center gap-1.5" style={{ color: "var(--ink-mid)" }}>
              <span>{t("vocabCorrectAnswer")}: <strong style={{ color: "var(--ink)" }}>{termHeadword(tm)}</strong></span>
              <SpeakButton text={termHeadword(tm)} size={14} title={t("speakWord")} />
            </p>
          </div>
          <Button onClick={() => onGrade(correct)} className="w-full">{t("vocabNext")}</Button>
        </>
      )}
    </>
  );
}
