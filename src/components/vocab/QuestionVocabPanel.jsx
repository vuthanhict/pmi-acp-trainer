import { useState, useMemo } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { useIsDesktop } from "../../hooks/useViewport.js";
import { questionVocab, VOCAB_GROUPS } from "../../lib/questionVocab.js";
import { termHeadword } from "../../lib/vocabSrs.js";
import { firstSurfaceMatch } from "../../lib/inlineVocab.js";
import { Icon } from "../ui/primitives.jsx";
import { SpeakButton } from "./SpeakButton.jsx";
import { TermDetailBody, POS_LABEL_KEY } from "./TermDetail.jsx";

/* ===================== Bảng từ vựng của một câu hỏi ===================== */
/* Mục tiêu: người học đang làm đề gặp từ lạ thì tra ngay tại chỗ, không phải rời màn hình. Vì
   trình độ tiếng Anh còn yếu nên mỗi thẻ hiện ĐỦ: từ gốc, phiên âm IPA, từ loại, nghĩa tiếng
   Việt, phần giải thích cách dùng trong ngữ cảnh đề thi, và một ví dụ. Nút ★ lưu thẻ vào bộ
   riêng để ôn lại bằng spaced repetition ở màn "Ôn từ vựng".

   Danh sách được chia 3 nhóm (thuật ngữ / từ vựng / cụm từ) và mặc định chỉ mở nhóm đầu tiên có
   dữ liệu — một câu dài có thể có tới 70 thẻ, đổ hết ra cùng lúc thì không ai đọc. */

const GROUP_LABEL_KEY = { term: "vocabPanelGroupTerm", word: "vocabPanelGroupWord", phrase: "vocabPanelGroupPhrase" };

/* Dòng tóm tắt dưới mỗi từ — ưu tiên tiếng Việt vì đó là điều người học cần thấy trước. Nhiều
   thuật ngữ có translationVi trùng luôn với chính từ tiếng Anh ("working agreement" →
   "Working Agreement"), lặp lại như vậy chỉ tốn chỗ nên rơi xuống dùng định nghĩa tiếng Việt. */
function summaryLine(term, head) {
  const vi = (term.translationVi || "").trim();
  if (vi && vi.toLowerCase() !== head.toLowerCase()) return vi;
  return term.definitionVi || term.senseEn || "";
}

/* `searchText`: toàn bộ văn bản tiếng Anh của câu hỏi (đề + đáp án + có thể cả giải thích) — dùng
   tìm bề mặt THẬT của thẻ trong câu này, tránh lặp lại lỗi "Thus hiện thành therefore" nhưng lần
   này ở bảng liệt kê thay vì popup. Rơi về headword chuẩn nếu không tìm thấy (thẻ hiếm khi được
   gắn thủ công/qua enrichment cũ mà không khớp string trực tiếp). */
function VocabRow({ term, searchText, saved, onToggleSave }) {
  const { t } = useAppCtx();
  const [open, setOpen] = useState(false);
  const head = firstSurfaceMatch(searchText, term) || termHeadword(term);
  const isCanonical = head.toLowerCase() === termHeadword(term).toLowerCase();
  return (
    <div className="rounded-lg" style={{ border: "1px solid var(--line)", background: "var(--paper)" }}>
      <div className="flex items-start gap-2 px-3 py-2.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="pmi-focusable flex-1 min-w-0 text-left"
          aria-expanded={open}
        >
          <span className="flex items-baseline gap-2 flex-wrap">
            <span className="pmi-display font-semibold text-sm">{head}</span>
            {term.ipa && isCanonical && <span className="pmi-mono text-[11px]" style={{ color: "var(--sky)" }}>{term.ipa}</span>}
            {term.pos && (
              <span className="pmi-mono text-[10px] italic" style={{ color: "var(--ink-soft)" }}>
                {t(POS_LABEL_KEY[term.pos] || "posOther")}
              </span>
            )}
          </span>
          <span className="block text-xs mt-0.5 truncate" style={{ color: "var(--ink-mid)" }}>
            {summaryLine(term, head)}
          </span>
        </button>
        <SpeakButton text={head} title={t("speakWord")} />
        <button
          onClick={() => onToggleSave(term.id)}
          title={saved ? t("vocabPanelUnsave") : t("vocabPanelSave")}
          aria-label={saved ? t("vocabPanelUnsave") : t("vocabPanelSave")}
          className="pmi-focusable shrink-0 p-1 rounded-md"
          style={{ color: saved ? "var(--seal-fg)" : "var(--ink-soft)" }}
        >
          <Icon name={saved ? "starFilled" : "star"} size={17} />
        </button>
        <button onClick={() => setOpen((o) => !o)} className="pmi-focusable shrink-0 p-1" style={{ color: "var(--ink-soft)" }} tabIndex={-1}>
          <Icon name={open ? "chevronUp" : "chevronDown"} size={14} />
        </button>
      </div>
      {open && (
        <div className="px-3 pb-3 pt-0">
          <TermDetailBody term={term} />
        </div>
      )}
    </div>
  );
}

function VocabGroups({ groups, searchText, savedIds, onToggleSave }) {
  const { t } = useAppCtx();
  const present = VOCAB_GROUPS.filter((g) => groups[g].length > 0);
  const [openGroup, setOpenGroup] = useState(present[0] || null);
  if (!present.length) {
    return <p className="text-xs py-6 text-center" style={{ color: "var(--ink-soft)" }}>{t("vocabPanelEmpty")}</p>;
  }
  return (
    <div className="space-y-2">
      {present.map((g) => {
        const isOpen = openGroup === g;
        return (
          <div key={g}>
            <button
              onClick={() => setOpenGroup(isOpen ? null : g)}
              className="pmi-focusable w-full flex items-center justify-between px-1 py-1.5"
            >
              <span className="pmi-eyebrow">{t(GROUP_LABEL_KEY[g])} ({groups[g].length})</span>
              <Icon name={isOpen ? "chevronUp" : "chevronDown"} size={14} style={{ color: "var(--ink-soft)" }} />
            </button>
            {isOpen && (
              <div className="space-y-1.5 mt-1">
                {groups[g].map((term) => (
                  <VocabRow key={term.id} term={term} searchText={searchText} saved={savedIds.has(term.id)} onToggleSave={onToggleSave} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* Nút mở bảng — đặt ngay cạnh nút song ngữ ở đầu câu hỏi. Ẩn hẳn khi câu không có thẻ nào
   (không bao giờ hiện một nút bấm vào thì rỗng). */
export function VocabPanelButton({ questionId, includePost, onClick, compact }) {
  const { t } = useAppCtx();
  const count = useMemo(() => questionVocab(questionId, includePost).total, [questionId, includePost]);
  if (!count) return null;
  return (
    <button
      onClick={onClick}
      className={`pmi-focusable shrink-0 flex items-center gap-1.5 font-semibold rounded-full transition-colors ${compact ? "text-[11px] px-2 py-1" : "text-xs px-3 py-1.5"}`}
      style={{ background: "var(--paper)", border: "1px solid var(--line-strong)", color: "var(--ink-mid)" }}
    >
      <Icon name="book" size={compact ? 12 : 13} /> {t("vocabPanelBtn", { n: count })}
    </button>
  );
}

/* Ghép toàn bộ văn bản tiếng Anh của câu hỏi thành 1 chuỗi để dò bề mặt thật của từng thẻ —
   cùng phạm vi pre/post với chính lúc build chỉ mục (xem tools/buildVocab.mjs: pre = đề + đáp
   án, post = giải thích + đáp án đúng). */
function questionSearchText(question, includePost) {
  if (!question) return "";
  const pre = [question.stem, ...(question.choices || []).map((c) => c.text)].join("\n");
  if (!includePost) return pre;
  return [pre, question.explanationShort, question.correctAnswerText].filter(Boolean).join("\n");
}

/* Bảng từ vựng — bottom sheet trên mobile, hộp thoại giữa màn hình trên desktop, cùng khuôn với
   các overlay khác của app (palette câu hỏi, xác nhận nộp bài).
   `question`: object câu hỏi tiếng Anh gốc (q.stem/choices/...) — dùng để mỗi dòng trong bảng
   hiện đúng bề mặt THẬT xuất hiện trong câu này, tránh lặp lại lỗi "Thus hiện thành therefore". */
export function VocabPanelSheet({ questionId, question, includePost, savedIds, onToggleSave, onClose }) {
  const { t } = useAppCtx();
  const isDesktop = useIsDesktop();
  const groups = useMemo(() => questionVocab(questionId, includePost), [questionId, includePost]);
  const searchText = useMemo(() => questionSearchText(question, includePost), [question, includePost]);
  return (
    <div
      className={`fixed inset-0 flex ${isDesktop ? "items-center" : "items-end"} justify-center z-50`}
      style={{ background: "rgba(22,35,63,0.4)" }}
      onClick={onClose}
    >
      <div
        className={`pmi-card ${isDesktop ? "rounded-lg" : "rounded-t-2xl"} p-0 w-full max-w-md flex flex-col`}
        style={{ maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="min-w-0">
            <p className="pmi-display font-semibold">{t("vocabPanelTitle")}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-soft)" }}>{t("vocabPanelHint")}</p>
          </div>
          <button onClick={onClose} className="pmi-focusable p-1 shrink-0" style={{ color: "var(--ink-soft)" }} aria-label={t("cancelBtn")}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="px-4 py-3 overflow-y-auto">
          <VocabGroups groups={groups} searchText={searchText} savedIds={savedIds} onToggleSave={onToggleSave} />
        </div>
      </div>
    </div>
  );
}
