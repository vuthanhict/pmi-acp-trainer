import { useState, useMemo } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { useIsDesktop, useIsWide } from "../../hooks/useViewport.js";
import { VI_TERM_LIST } from "../../lib/embeddedData.js";
import { Card, Icon } from "../../components/ui/primitives.jsx";
import { SpeakButton } from "../../components/vocab/SpeakButton.jsx";
import { RATE_SENTENCE } from "../../lib/speech.js";

/* ===================== Glossary Screen ===================== */
export function GlossaryScreen() {
  const { t } = useAppCtx();
  const isDesktop = useIsDesktop();
  const isWide = useIsWide();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const categories = useMemo(() => ["all", ...Array.from(new Set(VI_TERM_LIST.map((tm) => tm.category))).sort()], []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return VI_TERM_LIST.filter((tm) => {
      if (category !== "all" && tm.category !== category) return false;
      if (!q) return true;
      const en = ((tm.sourceTerms && tm.sourceTerms.join(" ")) || "") + " " + tm.termVi + " " + tm.translationVi;
      return en.toLowerCase().includes(q);
    });
  }, [query, category]);

  return (
    <div className="pt-1 pb-4">
      <div className="relative mb-3">
        <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-soft)" }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("glossarySearchPlaceholder")} className="pmi-input w-full pl-9 pr-3 py-2.5 text-sm" />
      </div>
      <div className={`flex gap-1.5 overflow-x-auto pb-3 ${isDesktop ? "flex-wrap" : "-mx-4 px-4"}`}>
        {categories.map((c) => (
          <button
            key={c} onClick={() => setCategory(c)}
            className="pmi-focusable pmi-mono shrink-0 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap"
            style={category === c ? { background: "var(--accent)", color: "var(--accent-fg)" } : { background: "var(--paper)", color: "var(--ink-mid)", border: "1px solid var(--line-strong)" }}
          >
            {c === "all" ? t("glossaryAllCategories") : c}
          </button>
        ))}
      </div>
      <p className="pmi-mono text-xs mb-3" style={{ color: "var(--ink-soft)" }}>{t("glossaryCount", { n: filtered.length })}</p>
      {filtered.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>{t("glossaryNoResults")}</p>
      ) : (
        <div className={isWide ? "grid grid-cols-4 gap-2" : isDesktop ? "grid grid-cols-2 gap-2" : "space-y-2"}>
          {filtered.map((tm) => {
            const en = (tm.sourceTerms && tm.sourceTerms[0]) || tm.termVi;
            const isOpen = expanded === tm.id;
            return (
              <Card key={tm.id} onClick={() => setExpanded(isOpen ? null : tm.id)}>
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="pmi-display font-medium text-sm truncate">{en}</p>
                    {tm.ipa && <p className="pmi-mono text-[11px] truncate" style={{ color: "var(--sky)" }}>{tm.ipa}</p>}
                    {tm.translationVi && tm.translationVi !== en && <p className="text-xs italic truncate" style={{ color: "var(--ink-soft)" }}>{tm.translationVi}</p>}
                  </div>
                  <div className="flex items-center shrink-0 ml-2">
                    <SpeakButton text={en} title={t("speakWord")} />
                    <Icon name={isOpen ? "chevronUp" : "chevronDown"} size={15} style={{ color: "var(--ink-soft)" }} />
                  </div>
                </div>
                {isOpen && (
                  <div className="mt-2 space-y-1.5">
                    {tm.senseEn && (
                      <p className="text-xs" style={{ color: "var(--ink-mid)" }}>
                        <span className="pmi-mono text-[9px] font-bold mr-1.5" style={{ color: "var(--ink-soft)" }}>EN</span>
                        {tm.senseEn}
                      </p>
                    )}
                    <p className="text-xs" style={{ color: "var(--ink)" }}>{tm.definitionVi}</p>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
