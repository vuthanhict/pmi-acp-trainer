import { useState } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { Icon } from "../ui/primitives.jsx";
import { VI_TERM_INDEX, VI_ITEM_INDEX } from "../../lib/embeddedData.js";

/* ===================== Vietnamese support (inline) ===================== */
export const WARNING_LABEL = {
  vi: {
    source_needs_manual_review: "Câu nguồn (tiếng Anh) cần review thủ công",
    negation_requires_review: "Có câu phủ định — cần đối chiếu kỹ với bản tiếng Anh",
    matching_interaction: "Dạng câu ghép nối (matching) — bản dịch có thể không đầy đủ",
  },
  en: {
    source_needs_manual_review: "The English source needs manual review",
    negation_requires_review: "Contains a negation — cross-check carefully with the English text",
    matching_interaction: "Matching-type question — translation may be incomplete",
  },
};
export const VI_STATUS_LABEL = {
  vi: { machine_draft: "Bản dịch hỗ trợ — chưa duyệt thủ công", reviewed: "Bản dịch đã được review", approved: "Bản dịch đã được duyệt" },
  en: { machine_draft: "Assisted translation — not manually reviewed", reviewed: "Translation reviewed", approved: "Translation approved" },
};
export function TermChip({ termId, onExpand, expandedId }) {
  const term = VI_TERM_INDEX.get(termId);
  if (!term) return null;
  const en = (term.sourceTerms && term.sourceTerms[0]) || term.termVi;
  const isOpen = expandedId === termId;
  return (
    <button
      onClick={() => onExpand(isOpen ? null : termId)}
      className="pmi-mono text-[11px] px-2.5 py-1 rounded-full transition-colors"
      style={isOpen ? { background: "var(--accent)", color: "var(--accent-fg)" } : { background: "var(--paper)", border: "1px solid var(--line-strong)", color: "var(--ink-mid)" }}
    >
      {en}
    </button>
  );
}
/* Nút bật/tắt song ngữ EN/VI — luôn đặt ngay cạnh nội dung nó tác động (đầu câu hỏi, hoặc đầu   */
/* khối GIẢI THÍCH khi chưa bật từ trước) để rõ ràng thay vì chôn ở cuối card như thiết kế cũ.   */
export function BilingualToggle({ on, onClick, compact }) {
  const { t } = useAppCtx();
  return (
    <button
      onClick={onClick}
      className={`pmi-focusable shrink-0 flex items-center gap-1.5 font-semibold rounded-full transition-colors ${compact ? "text-[11px] px-2 py-1" : "text-xs px-3 py-1.5"}`}
      style={on ? { background: "var(--sky)", color: "#fff" } : { background: "var(--paper)", border: "1px solid var(--line-strong)", color: "var(--ink-mid)" }}
    >
      <Icon name="globe" size={compact ? 12 : 13} /> {on ? t("bilingualToggleOn") : t("bilingualToggleOff")}
    </button>
  );
}
/* Khối dịch tiếng Việt cho phần đề bài — hiện ngay dưới đề bài gốc (song ngữ thật sự) thay vì   */
/* ẩn trong 1 panel riêng phải mở thêm 1 lần nữa. Dùng chung cho cả lúc làm bài và lúc xem lại.  */
export function BilingualStemBlock({ viItem, expandedTerm, onExpandTerm }) {
  const { t, lang } = useAppCtx();
  if (!viItem) return <p className="text-xs mt-2 mb-2" style={{ color: "var(--ink-soft)" }}>{t("viNoData")}</p>;
  return (
    <div className="mt-2 mb-3 p-3 rounded-lg" style={{ background: "var(--sky-tint)", border: "1px solid var(--sky)" }}>
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="pmi-mono text-[10px] font-bold tracking-wide" style={{ color: "var(--sky)" }}>{t("viBlockLabel")}</span>
        <span className="pmi-chip pmi-status-needs_work">{VI_STATUS_LABEL[lang][viItem.quality?.status] || VI_STATUS_LABEL[lang].machine_draft}</span>
        {viItem.quality?.needsManualReview && <span className="pmi-chip pmi-status-critical">{t("viNeedsReview")}</span>}
      </div>
      {viItem.quality?.needsManualReview && viItem.quality.warnings?.length > 0 && (
        <ul className="text-[11px] list-disc pl-4 mb-2 space-y-0.5" style={{ color: "var(--flag)" }}>
          {viItem.quality.warnings.map((w) => (
            <li key={w}>{WARNING_LABEL[lang][w] || w}</li>
          ))}
        </ul>
      )}
      <p className="text-sm italic whitespace-pre-wrap" style={{ color: "var(--ink)" }}>{viItem.preAnswer.stemVi}</p>
      {(viItem.preAnswer.termIds || []).length > 0 && (
        <div className="mt-2.5">
          <p className="pmi-eyebrow mb-1.5">{t("viTermsHeader")}</p>
          <div className="flex flex-wrap gap-1.5">
            {viItem.preAnswer.termIds.map((tid) => (
              <TermChip key={tid} termId={tid} onExpand={onExpandTerm} expandedId={expandedTerm} />
            ))}
          </div>
          {expandedTerm && viItem.preAnswer.termIds.includes(expandedTerm) && <TermDefinitionCard termId={expandedTerm} />}
        </div>
      )}
    </div>
  );
}
/* Khối dịch tiếng Việt cho đáp án + giải thích — hiện tự động ngay dưới bản tiếng Anh một khi   */
/* song ngữ đã bật (không cần bấm thêm 1 nút "mở" riêng như thiết kế cũ nữa).                    */
export function BilingualAnswerBlock({ viItem }) {
  const { t } = useAppCtx();
  if (!viItem) return null;
  return (
    <div className="mt-2 p-3 rounded-lg" style={{ background: "var(--sky-tint)", border: "1px solid var(--sky)" }}>
      <p className="pmi-mono text-[10px] font-bold tracking-wide mb-1.5" style={{ color: "var(--sky)" }}>{t("viBlockLabel")}</p>
      <p className="text-xs font-medium mb-1" style={{ color: "var(--sage)" }}>{viItem.postAnswer.correctAnswerTextVi}</p>
      <ExplanationText text={viItem.postAnswer.explanationShortVi} className="text-xs" color="var(--ink-mid)" />
    </div>
  );
}
export function TermDefinitionCard({ termId }) {
  const { t: tt } = useAppCtx();
  const t = VI_TERM_INDEX.get(termId);
  if (!t) return null;
  const en = (t.sourceTerms && t.sourceTerms[0]) || t.termVi;
  return (
    <div className="mt-2 text-xs pl-2" style={{ borderLeft: "2px solid var(--line-strong)" }}>
      <p className="font-semibold">{en}</p>
      <p className="mt-0.5" style={{ color: "var(--ink-mid)" }}>{t.definitionVi}</p>
      {t.exampleEn && (
        <p className="mt-1 italic" style={{ color: "var(--ink-soft)" }}>
          <span className="pmi-mono not-italic text-[10px] mr-1" style={{ color: "var(--sky)" }}>{tt("vocabExampleLabel")}</span>
          “{t.exampleEn}”
        </p>
      )}
    </div>
  );
}
export function ChoiceViLine({ questionId, choiceId }) {
  const item = VI_ITEM_INDEX.get(questionId);
  if (!item) return null;
  const c = (item.preAnswer.choicesVi || []).find((x) => x.id.toLowerCase() === choiceId.toLowerCase());
  if (!c) return null;
  return (
    <span className="flex items-start gap-1.5 mt-1.5 pt-1.5" style={{ borderTop: "1px dashed var(--line-strong)" }}>
      <span className="pmi-mono text-[9px] font-bold shrink-0 mt-0.5" style={{ color: "var(--sky)" }}>VI</span>
      <span className="italic text-xs" style={{ color: "var(--ink-mid)" }}>{c.textVi}</span>
    </span>
  );
}

/* Tự động cắt văn bản giải thích gốc (thường rất dài, có breakdown từng đáp án A/B/C/D) thành */
/* bản tóm tắt ~1-2 câu mở đầu, cắt tại ranh giới câu gần nhất cho tự nhiên. Mặc định chỉ hiện  */
/* bản tóm tắt để review nhanh — bấm "Xem đầy đủ" mới tải toàn bộ. Giúp lướt qua nhiều câu       */
/* nhanh hơn nhiều so với luôn hiện cả đoạn văn dài ngay từ đầu.                                 */
export function truncateExplanation(text, maxLen) {
  if (!text || text.length <= maxLen) return text || "";
  const cut = text.slice(0, maxLen);
  const sentenceEnd = cut.lastIndexOf(". ");
  if (sentenceEnd > maxLen * 0.4) return cut.slice(0, sentenceEnd + 1).trim();
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}
export function ExplanationText({ text, className = "text-sm", color, previewLength = 200 }) {
  const { t } = useAppCtx();
  const [expanded, setExpanded] = useState(false);
  const full = (text || "").trim();
  const preview = truncateExplanation(full, previewLength);
  const hasMore = preview !== full;
  const display = expanded || !hasMore ? full : preview;
  return (
    <div>
      <p className={`${className} whitespace-pre-wrap`} style={{ color }}>{display || "—"}</p>
      {hasMore && (
        <button onClick={() => setExpanded((e) => !e)} className="pmi-focusable pmi-mono text-[11px] font-semibold mt-1.5 flex items-center gap-1" style={{ color: "var(--sky)" }}>
          {expanded ? t("hideFullExplanation") : t("showFullExplanation")} <Icon name={expanded ? "chevronUp" : "chevronDown"} size={11} />
        </button>
      )}
    </div>
  );
}
