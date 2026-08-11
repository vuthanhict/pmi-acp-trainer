import { useState, useEffect, useRef } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { Icon } from "../ui/primitives.jsx";
import { speechSupported, speak, RATE_WORD } from "../../lib/speech.js";

/* Nút loa — bấm để nghe phát âm. Tự ẩn hoàn toàn nếu trình duyệt không hỗ trợ Web Speech API,
   thay vì hiện một nút bấm vào không có gì xảy ra. Trong lúc đọc, icon đổi sang trạng thái
   "đang phát" để người dùng biết máy đang chạy (nhất là khi mở loa nhỏ hoặc đang cắm tai nghe). */
export function SpeakButton({ text, rate = RATE_WORD, size = 15, title }) {
  const { t } = useAppCtx();
  const [speaking, setSpeaking] = useState(false);
  const cancelRef = useRef(null);

  // Rời màn hình / đổi câu khi đang đọc dở thì phải cắt tiếng, nếu không giọng đọc vẫn chạy tiếp
  // trong lúc người dùng đã sang câu khác.
  useEffect(() => () => cancelRef.current?.(), []);

  if (!speechSupported() || !text) return null;

  function onClick(e) {
    e.stopPropagation(); // nút này hay nằm trong hàng/thẻ có onClick riêng (mở rộng, lật thẻ)
    if (speaking) { cancelRef.current?.(); return; }
    setSpeaking(true);
    cancelRef.current = speak(text, { rate, onDone: () => setSpeaking(false) });
  }

  return (
    <button
      onClick={onClick}
      title={title || t("speakBtn")}
      aria-label={title || t("speakBtn")}
      className="pmi-focusable shrink-0 p-1 rounded-md"
      style={{ color: speaking ? "var(--sky)" : "var(--ink-soft)" }}
    >
      <Icon name={speaking ? "volumeOn" : "volume"} size={size} />
    </button>
  );
}
