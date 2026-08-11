/* ===================== Phát âm từ vựng (Web Speech API) ===================== */
/* Dùng bộ đọc có sẵn của trình duyệt/hệ điều hành thay vì file mp3: app này là trang tĩnh, dữ
   liệu nhúng sẵn và chạy được offline — nhúng thêm 736 file audio sẽ phình dung lượng vô lý,
   còn gọi API TTS ngoài thì cần mạng và khoá API. Đổi lại, chất lượng giọng phụ thuộc máy người
   dùng, và một số trình duyệt không hỗ trợ (khi đó nút phát âm được ẩn hẳn).

   Điểm quan trọng nhất ở đây: PHẢI tự chọn giọng tiếng Anh. Nếu để trình duyệt tự quyết, nó lấy
   giọng theo ngôn ngữ hệ thống — máy cài tiếng Việt sẽ đọc "sustainable pace" bằng giọng Việt,
   sai hoàn toàn mục đích luyện phát âm. Module này không import React. */

export function speechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
}

/* Danh sách giọng nạp bất đồng bộ trên Chrome: lần gọi getVoices() đầu tiên thường trả về mảng
   rỗng, phải chờ sự kiện "voiceschanged". Cache lại kết quả đã chọn để không phải dò mỗi lần bấm. */
let cachedVoice = null;
let cachedVoiceResolved = false;

function scoreVoice(v) {
  const lang = (v.lang || "").toLowerCase().replace("_", "-");
  if (!lang.startsWith("en")) return -1;
  let score = 1;
  if (lang === "en-us") score += 4; // IPA trong termbase soạn theo giọng Mỹ
  else if (lang === "en-gb") score += 3;
  // Giọng cài sẵn trong máy phát được cả khi offline; giọng "remote" của Chrome cần mạng.
  if (v.localService) score += 2;
  // Trên macOS/iOS các giọng này tự nhiên hơn hẳn giọng mặc định (Alex/Fred).
  if (/samantha|karen|daniel|alex|google us english|microsoft (aria|guy|zira|david)/i.test(v.name || "")) score += 2;
  return score;
}

export function pickEnglishVoice() {
  if (cachedVoiceResolved) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || !voices.length) return null; // chưa nạp xong — thử lại ở lần bấm sau
  let best = null;
  let bestScore = 0;
  for (const v of voices) {
    const s = scoreVoice(v);
    if (s > bestScore) { best = v; bestScore = s; }
  }
  cachedVoice = best;
  cachedVoiceResolved = true;
  return best;
}

/* Gọi sớm (lúc app khởi động) để danh sách giọng kịp nạp trước khi người dùng bấm nút đầu tiên. */
export function primeVoices() {
  if (!speechSupported()) return;
  try {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener("voiceschanged", () => {
      cachedVoiceResolved = false; // buộc dò lại khi hệ điều hành nạp thêm giọng
      pickEnglishVoice();
    }, { once: true });
  } catch (e) { /* trình duyệt không hỗ trợ — nút phát âm sẽ tự ẩn */ }
}

/* Tốc độ chậm hơn bình thường một chút: người học đang ở trình độ tiếng Anh chưa tốt, nghe tốc
   độ gốc rất khó bắt được từng âm. Câu ví dụ dài nên đọc chậm hơn nữa so với từ đơn. */
export const RATE_WORD = 0.85;
export const RATE_SENTENCE = 0.8;

/* Đọc `text`. Trả về hàm huỷ. onDone chạy khi đọc xong / lỗi / bị huỷ — luôn đúng một lần, để
   component không bị kẹt ở trạng thái "đang đọc". */
export function speak(text, { rate = RATE_WORD, onDone } = {}) {
  if (!speechSupported() || !text) { onDone?.(); return () => {}; }
  const synth = window.speechSynthesis;
  // Bấm nút khác khi câu trước chưa đọc xong thì cắt ngay câu cũ, không xếp hàng chờ.
  synth.cancel();

  const utter = new window.SpeechSynthesisUtterance(text);
  const voice = pickEnglishVoice();
  if (voice) utter.voice = voice;
  // Đặt lang kể cả khi đã có voice: một số trình duyệt vẫn dựa vào trường này để chọn bộ phát âm.
  utter.lang = voice?.lang || "en-US";
  utter.rate = rate;

  let done = false;
  const finish = () => { if (!done) { done = true; onDone?.(); } };
  utter.onend = finish;
  utter.onerror = finish;

  synth.speak(utter);
  return () => { synth.cancel(); finish(); };
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
}
