import { useState, useMemo } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { useIsDesktop } from "../../hooks/useViewport.js";
import { VI_TERM_LIST } from "../../lib/embeddedData.js";
import { isSrsDue, nextSrsRecord } from "../../lib/vocabSrs.js";
import { shuffleArray } from "../../lib/utils.js";
import { Card, Button } from "../../components/ui/primitives.jsx";
import { VocabFlashcardCard, VocabChoiceCard, VocabTypeCard } from "./vocabCards.jsx";

/* Ba phạm vi ôn: thẻ đến hạn (mặc định), bộ tự lưu khi làm bài, và toàn bộ termbase.
   "saved" tách riêng vì đó là những thẻ người học CHỦ ĐỘNG đánh dấu là mình chưa biết — ưu tiên
   cao hơn nhiều so với 736 thẻ chung. */
function poolForScope(scope, srsMap, savedMap, now) {
  if (scope === "saved") return VI_TERM_LIST.filter((tm) => savedMap[tm.id]);
  if (scope === "due") return VI_TERM_LIST.filter((tm) => isSrsDue(srsMap[tm.id], now));
  return VI_TERM_LIST;
}

export function VocabScreen({ vocabSrs, vocabSaved, onUpdateVocabSrs, onToggleVocabSaved }) {
  const { t } = useAppCtx();
  const isDesktop = useIsDesktop();
  const srsMap = vocabSrs || {};
  const savedMap = vocabSaved || {};
  const [mode, setMode] = useState("flashcard");
  // Nếu người học đã lưu thẻ nào từ lúc làm bài thì mở thẳng vào bộ đó — đó là thứ họ chủ động
  // đánh dấu là chưa biết, gần như luôn là thứ họ muốn ôn trước.
  const [scope, setScope] = useState(() => (Object.keys(savedMap).length ? "saved" : "due"));
  const [deck, setDeck] = useState(() => shuffleArray(poolForScope(Object.keys(savedMap).length ? "saved" : "due", srsMap, savedMap, Date.now())));
  const [index, setIndex] = useState(0);
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0 });

  const dueCount = useMemo(() => {
    const now = Date.now();
    return VI_TERM_LIST.filter((tm) => isSrsDue(srsMap[tm.id], now)).length;
  }, [srsMap]);
  const savedCount = useMemo(() => Object.keys(savedMap).length, [savedMap]);

  function restart(nextMode = mode, nextScope = scope) {
    setMode(nextMode);
    setScope(nextScope);
    setDeck(shuffleArray(poolForScope(nextScope, srsMap, savedMap, Date.now())));
    setIndex(0);
    setSessionStats({ correct: 0, incorrect: 0 });
  }

  function grade(correct) {
    const tm = deck[index];
    const now = Date.now();
    const rec = nextSrsRecord(srsMap[tm.id], correct, now);
    const nextMap = { ...srsMap, [tm.id]: rec };
    onUpdateVocabSrs(nextMap);
    setSessionStats((s) => ({ correct: s.correct + (correct ? 1 : 0), incorrect: s.incorrect + (correct ? 0 : 1) }));
    setIndex((i) => i + 1);
  }

  const current = deck[index];
  const finished = index >= deck.length;
  const MODES = [
    { key: "flashcard", label: t("vocabModeFlashcard") },
    { key: "choice", label: t("vocabModeChoice") },
    { key: "type", label: t("vocabModeType") },
  ];

  return (
    <div className="pt-1 pb-4 space-y-4">
      <div>
        <p className="pmi-eyebrow mb-1">{t("vocabHeader")}</p>
        <p className="text-xs" style={{ color: "var(--ink-mid)" }}>{t("vocabSubtitle")}</p>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => restart(m.key, scope)}
            className="pmi-mono text-xs px-3 py-1.5 rounded-full font-medium"
            style={mode === m.key ? { background: "var(--accent)", color: "var(--accent-fg)" } : { background: "var(--paper)", border: "1px solid var(--line-strong)", color: "var(--ink-mid)" }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {[
          { key: "due", label: t("vocabScopeDue", { n: dueCount }) },
          { key: "saved", label: t("vocabScopeSaved", { n: savedCount }) },
          { key: "all", label: t("vocabScopeAll") },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => restart(mode, f.key)}
            className="pmi-mono text-[11px] px-2.5 py-1 rounded-full font-medium"
            style={scope === f.key ? { background: "var(--line)", color: "var(--ink)" } : { color: "var(--ink-soft)" }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!finished && deck.length > 0 && (
        <p className="pmi-mono text-[11px]" style={{ color: "var(--ink-soft)" }}>{t("vocabProgress", { n: index + 1, total: deck.length })}</p>
      )}

      {deck.length === 0 ? (
        <Card className="text-center py-8">
          <p className="pmi-display font-semibold text-base mb-2">{t(scope === "saved" ? "vocabSavedEmpty" : "vocabAllCaughtUp")}</p>
          <p className="text-sm mb-4" style={{ color: "var(--ink-mid)" }}>{t(scope === "saved" ? "vocabSavedEmptyBody" : "vocabAllCaughtUpBody")}</p>
          <Button onClick={() => restart(mode, "all")} className={isDesktop ? "w-auto" : "w-full"}>{t("vocabScopeAll")}</Button>
        </Card>
      ) : finished ? (
        <Card className="text-center py-8">
          <p className="pmi-display font-semibold text-lg mb-2">{t("vocabDone")}</p>
          <p className="text-sm mb-4" style={{ color: "var(--ink-mid)" }}>
            {t("vocabDoneSummary", { known: sessionStats.correct, total: deck.length, unknown: sessionStats.incorrect })}
          </p>
          <Button onClick={() => restart()} className={isDesktop ? "w-auto" : "w-full"}>{t("vocabRestart")}</Button>
        </Card>
      ) : mode === "choice" ? (
        <VocabChoiceCard key={current.id} tm={current} onGrade={grade} />
      ) : mode === "type" ? (
        <VocabTypeCard key={current.id} tm={current} onGrade={grade} />
      ) : (
        <VocabFlashcardCard
          key={current.id}
          tm={current}
          onGrade={grade}
          saved={!!savedMap[current.id]}
          onToggleSave={() => onToggleVocabSaved(current.id, null, null)}
        />
      )}
    </div>
  );
}
