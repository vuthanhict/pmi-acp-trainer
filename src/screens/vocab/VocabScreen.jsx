import { useState, useMemo } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { useIsDesktop } from "../../hooks/useViewport.js";
import { VI_TERM_LIST } from "../../lib/embeddedData.js";
import { isSrsDue, nextSrsRecord } from "../../lib/vocabSrs.js";
import { shuffleArray } from "../../lib/utils.js";
import { Card, Button } from "../../components/ui/primitives.jsx";
import { VocabFlashcardCard, VocabChoiceCard, VocabTypeCard } from "./vocabCards.jsx";

export function VocabScreen({ vocabSrs, onUpdateVocabSrs }) {
  const { t } = useAppCtx();
  const isDesktop = useIsDesktop();
  const srsMap = vocabSrs || {};
  const [mode, setMode] = useState("flashcard");
  const [scope, setScope] = useState("due");
  const [deck, setDeck] = useState(() => {
    const now = Date.now();
    return shuffleArray(VI_TERM_LIST.filter((tm) => isSrsDue(srsMap[tm.id], now)));
  });
  const [index, setIndex] = useState(0);
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0 });

  const dueCount = useMemo(() => {
    const now = Date.now();
    return VI_TERM_LIST.filter((tm) => isSrsDue(srsMap[tm.id], now)).length;
  }, [srsMap]);

  function restart(nextMode = mode, nextScope = scope) {
    setMode(nextMode);
    setScope(nextScope);
    const now = Date.now();
    const pool = nextScope === "due" ? VI_TERM_LIST.filter((tm) => isSrsDue(srsMap[tm.id], now)) : VI_TERM_LIST;
    setDeck(shuffleArray(pool));
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

      <div className="flex gap-1.5">
        {[{ key: "due", label: t("vocabScopeDue", { n: dueCount }) }, { key: "all", label: t("vocabScopeAll") }].map((f) => (
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
          <p className="pmi-display font-semibold text-base mb-2">{t("vocabAllCaughtUp")}</p>
          <p className="text-sm mb-4" style={{ color: "var(--ink-mid)" }}>{t("vocabAllCaughtUpBody")}</p>
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
        <VocabFlashcardCard key={current.id} tm={current} onGrade={grade} />
      )}
    </div>
  );
}
