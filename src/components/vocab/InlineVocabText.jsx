import { useMemo } from "react";
import { segmentText, sentenceAround } from "../../lib/inlineVocab.js";

/* Hiển thị một đoạn văn bản tiếng Anh trong đề, với các từ/cụm có thẻ từ vựng được gạch chân
   chấm và chạm được. Gạch chân CHẤM MỜ chứ không tô nền: một câu có thể có 35 từ được nhận diện,
   tô nền sẽ biến đề bài thành một mảng màu loang lổ không đọc nổi. Chấm mờ vừa đủ báo "chạm được"
   mà vẫn đọc trôi chảy.

   e.stopPropagation() là bắt buộc: đoạn này còn nằm trong nút chọn đáp án — chạm vào từ phải mở
   popup tra nghĩa chứ không được vô tình chọn luôn đáp án đó. */
export function InlineVocabText({ text, terms, onPickTerm, activeTermId }) {
  const segments = useMemo(() => segmentText(text, terms), [text, terms]);
  return (
    <>
      {segments.map((seg, i) => {
        if (!seg.termId) return <span key={i}>{seg.text}</span>;
        const isActive = activeTermId === seg.termId;
        return (
          <span
            key={i}
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onPickTerm(seg.termId, e.currentTarget.getBoundingClientRect(), seg.text, sentenceAround(text, seg.start, seg.end)); }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              e.stopPropagation();
              onPickTerm(seg.termId, e.currentTarget.getBoundingClientRect(), seg.text, sentenceAround(text, seg.start, seg.end));
            }}
            className="pmi-focusable cursor-pointer"
            style={{
              textDecoration: "underline",
              // Dùng --sky (đúng màu vẫn dùng cho phiên âm IPA) thay vì --line-strong: màu viền
              // đó gần như tàng hình dưới chữ sáng ở giao diện tối. Nét CHẤM 1px giữ cho câu vẫn
              // đọc trôi chảy dù có tới ~20 từ được gạch chân.
              textDecorationStyle: isActive ? "solid" : "dotted",
              textDecorationThickness: "1px",
              textUnderlineOffset: "3px",
              textDecorationColor: "var(--sky)",
              background: isActive ? "var(--sky-tint)" : "transparent",
              borderRadius: 3,
            }}
          >
            {seg.text}
          </span>
        );
      })}
    </>
  );
}
