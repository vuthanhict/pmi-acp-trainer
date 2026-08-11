import { useState, useLayoutEffect, useRef } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { useIsDesktop } from "../../hooks/useViewport.js";
import { VI_TERM_INDEX } from "../../lib/embeddedData.js";
import { termHeadword } from "../../lib/vocabSrs.js";
import { RATE_SENTENCE } from "../../lib/speech.js";
import { Icon } from "../ui/primitives.jsx";
import { SpeakButton } from "./SpeakButton.jsx";

export const POS_LABEL_KEY = {
  n: "posNoun", v: "posVerb", adj: "posAdj", adv: "posAdv", phr: "posPhrase", conj: "posConj", prep: "posPrep", abbr: "posAbbr",
};

/* Phần ruột của một thẻ từ vựng — dùng chung cho bảng từ vựng cả câu và popup tra nhanh một từ,
   để hai nơi không bao giờ hiển thị lệch nhau.
   `contextSentence`: câu THẬT trích từ chính câu hỏi đang xem, chứa từ vừa chạm (xem
   sentenceAround() trong inlineVocab.js) — chỉ popup tra nhanh trong đề mới có, bảng từ vựng liệt
   kê cả câu thì không gắn với 1 vị trí chạm cụ thể nên không truyền prop này. Bỏ qua nếu trùng
   với exampleEn (thẻ tự dùng đúng câu đề làm ví dụ) để khỏi lặp lại hai lần. */
export function TermDetailBody({ term, contextSentence }) {
  const { t } = useAppCtx();
  const showContext = contextSentence && contextSentence.trim().toLowerCase() !== (term.exampleEn || "").trim().toLowerCase();
  return (
    <div className="space-y-1.5 text-xs">
      {term.senseEn && (
        <p style={{ color: "var(--ink-mid)" }}>
          <span className="pmi-mono text-[9px] font-bold mr-1.5" style={{ color: "var(--ink-soft)" }}>EN</span>
          {term.senseEn}
        </p>
      )}
      <p style={{ color: "var(--ink)" }}>{term.definitionVi}</p>
      {showContext && (
        <p className="flex items-start gap-1" style={{ color: "var(--ink)" }}>
          <span className="pmi-mono not-italic text-[10px] mr-1 shrink-0" style={{ color: "var(--accent)" }}>{t("vocabInContextLabel")}</span>
          <span className="flex-1">“{contextSentence}”</span>
        </p>
      )}
      {term.exampleEn && (
        <p className="italic flex items-start gap-1" style={{ color: "var(--ink-soft)" }}>
          <span className="pmi-mono not-italic text-[10px] mr-1 shrink-0" style={{ color: "var(--sky)" }}>{t("vocabExampleLabel")}</span>
          <span className="flex-1">“{term.exampleEn}”</span>
          <SpeakButton text={term.exampleEn} rate={RATE_SENTENCE} size={13} title={t("speakExample")} />
        </p>
      )}
    </div>
  );
}

/* Dòng tiêu đề: từ gốc + IPA + từ loại + nút nghe + nút lưu.
   `tappedSurface`: biến thể CHÍNH XÁC người dùng vừa chạm trong đề (vd "Thus"), có thể khác
   headword chuẩn của thẻ (vd "therefore") khi thẻ gộp nhiều từ đồng nghĩa/biến thể. Ưu tiên hiển
   thị đúng từ đã chạm để người học không tưởng nhầm mình vừa tra một từ khác — IPA chỉ hiện khi
   nó thực sự là headword chuẩn, vì ta không có phiên âm riêng cho từng biến thể. */
export function TermDetailHeader({ term, tappedSurface, saved, onToggleSave, onClose }) {
  const { t } = useAppCtx();
  const canonicalHead = termHeadword(term);
  const head = tappedSurface || canonicalHead;
  const isCanonical = head.toLowerCase() === canonicalHead.toLowerCase();
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2 flex-wrap">
          <span className="pmi-display font-semibold text-sm">{head}</span>
          {term.ipa && isCanonical && <span className="pmi-mono text-[11px]" style={{ color: "var(--sky)" }}>{term.ipa}</span>}
          {term.pos && (
            <span className="pmi-mono text-[10px] italic" style={{ color: "var(--ink-soft)" }}>
              {t(POS_LABEL_KEY[term.pos] || "posOther")}
            </span>
          )}
        </span>
        {term.translationVi && term.translationVi.toLowerCase() !== head.toLowerCase() && (
          <span className="block text-xs mt-0.5" style={{ color: "var(--ink-mid)" }}>{term.translationVi}</span>
        )}
      </div>
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
      {onClose && (
        <button onClick={onClose} className="pmi-focusable shrink-0 p-1" style={{ color: "var(--ink-soft)" }} aria-label={t("cancelBtn")}>
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}

const POPOVER_WIDTH = 320;
const GAP = 8;

/* Popup tra nhanh MỘT từ, mở ra khi chạm thẳng vào từ đó trong đề bài.
   - Màn hình nhỏ: bottom sheet, giống mọi overlay khác của app, ngón tay luôn với tới được.
   - Màn hình lớn: thẻ nổi neo ngay cạnh từ vừa chạm, đúng chỗ mắt đang nhìn.
   `extraAction` dùng cho nút "Chọn đáp án này" khi người dùng lỡ chạm vào từ nằm trong một đáp án
   chưa chọn — biến cú chạm nhầm thành một thao tác có ích thay vì bắt họ đóng popup rồi chạm lại. */
export function TermPopover({ termId, tappedSurface, contextSentence, anchorRect, saved, onToggleSave, onClose, extraAction }) {
  const { t } = useAppCtx();
  const isDesktop = useIsDesktop();
  const cardRef = useRef(null);
  const [pos, setPos] = useState(null);
  const term = VI_TERM_INDEX.get(termId);

  // Đo chiều cao thật rồi mới chốt vị trí: nếu bên dưới không đủ chỗ thì lật lên trên từ.
  useLayoutEffect(() => {
    if (!isDesktop || !anchorRect || !cardRef.current) return;
    const h = cardRef.current.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = anchorRect.bottom + GAP;
    const top = below + h > vh - GAP ? Math.max(GAP, anchorRect.top - h - GAP) : below;
    const left = Math.min(Math.max(GAP, anchorRect.left), vw - POPOVER_WIDTH - GAP);
    setPos({ top, left });
  }, [isDesktop, anchorRect, termId]);

  if (!term) return null;

  const body = (
    <>
      <TermDetailHeader term={term} tappedSurface={tappedSurface} saved={saved} onToggleSave={onToggleSave} onClose={onClose} />
      <div className="mt-2">
        <TermDetailBody term={term} contextSentence={contextSentence} />
      </div>
      {extraAction && (
        <button
          onClick={extraAction.onClick}
          className="pmi-focusable w-full mt-3 text-xs font-semibold px-3 py-2 rounded-lg"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          {extraAction.label}
        </button>
      )}
    </>
  );

  if (!isDesktop) {
    return (
      <div className="fixed inset-0 flex items-end justify-center z-[60]" style={{ background: "rgba(22,35,63,0.4)" }} onClick={onClose}>
        <div className="pmi-card rounded-t-2xl p-4 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          {body}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Lớp trong suốt bắt cú click ra ngoài để đóng popup, không che nội dung phía dưới. */}
      <div className="fixed inset-0 z-[60]" onClick={onClose} />
      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        className="pmi-card p-3 rounded-lg"
        style={{
          position: "fixed",
          width: POPOVER_WIDTH,
          top: pos ? pos.top : -9999,
          left: pos ? pos.left : -9999,
          zIndex: 61,
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        }}
      >
        {body}
      </div>
    </>
  );
}
