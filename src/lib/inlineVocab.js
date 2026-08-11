/* ===================== Nhận diện từ vựng ngay trong câu hỏi ===================== */
/* Cắt một đoạn văn bản tiếng Anh thành các mảnh xen kẽ: mảnh thường và mảnh là "thẻ từ vựng".
   Nhờ đó người học chạm thẳng vào từ lạ trong đề để tra, không phải mở bảng rồi tự dò xem từ mình
   không hiểu nằm ở đâu trong 35 thẻ.

   Chỉ khớp với các thẻ ĐÃ gắn cho chính câu hỏi đó (xem questionVocab), không phải toàn bộ 1.127
   thẻ — như vậy phần gạch chân trong đề luôn khớp đúng với danh sách trong bảng, và tránh khớp
   nhầm những từ vốn không thuộc ngữ cảnh câu này. Module không import React. */

const WORD_CHAR = /[A-Za-z0-9]/;

function isBoundary(text, index) {
  if (index < 0 || index >= text.length) return true;
  return !WORD_CHAR.test(text[index]);
}

/* Gom bề mặt theo ký tự đầu để không phải thử toàn bộ ~250 bề mặt tại mỗi vị trí trong câu. */
function buildSurfaceMap(terms) {
  const byFirstChar = new Map();
  for (const term of terms) {
    for (const raw of term.sourceTerms || []) {
      const surface = raw.toLowerCase().trim();
      // Bề mặt quá ngắn dễ khớp bừa vào giữa từ khác, và cũng là từ mà ai cũng biết.
      if (surface.length < 3) continue;
      const key = surface[0];
      if (!byFirstChar.has(key)) byFirstChar.set(key, []);
      byFirstChar.get(key).push({ termId: term.id, surface });
    }
  }
  // Bề mặt dài xét trước: "user story" phải thắng "story", "definition of done" thắng "done".
  for (const list of byFirstChar.values()) list.sort((a, b) => b.surface.length - a.surface.length);
  return byFirstChar;
}

/* Trả về mảng mảnh: { text, termId? }. Ghép liền lại đúng bằng văn bản gốc (không mất ký tự nào),
   nên phần hiển thị vẫn giữ nguyên xuống dòng và dấu câu như đề gốc. */
export function segmentText(text, terms) {
  const src = text || "";
  if (!src || !terms || !terms.length) return [{ text: src }];
  const byFirstChar = buildSurfaceMap(terms);
  const lower = src.toLowerCase();
  const segments = [];
  let plainFrom = 0;
  let i = 0;

  while (i < src.length) {
    let hit = null;
    // Chỉ thử khớp khi đang đứng ở ĐẦU một từ, tránh khớp vào giữa từ khác.
    if (WORD_CHAR.test(src[i]) && isBoundary(src, i - 1)) {
      const candidates = byFirstChar.get(lower[i]);
      if (candidates) {
        for (const c of candidates) {
          const end = i + c.surface.length;
          if (end <= src.length && lower.startsWith(c.surface, i) && isBoundary(src, end)) { hit = { ...c, end }; break; }
        }
      }
    }
    if (hit) {
      if (plainFrom < i) segments.push({ text: src.slice(plainFrom, i) });
      segments.push({ text: src.slice(i, hit.end), termId: hit.termId, start: i, end: hit.end });
      i = hit.end;
      plainFrom = i;
    } else {
      i++;
    }
  }
  if (plainFrom < src.length) segments.push({ text: src.slice(plainFrom) });
  return segments;
}

/* Trích câu chứa vị trí [start,end) trong text — dùng để hiển thị "trong câu này từ được dùng
   thế nào" ngay trong ngữ cảnh thật của câu hỏi, thay vì chỉ có ví dụ chung của thẻ từ vựng.
   Ranh giới câu: dấu .!? theo sau bởi khoảng trắng/hết chuỗi, hoặc dấu xuống dòng. Không dùng
   regex toàn cục để tránh phải lo lastIndex — quét thủ công, đơn giản và dễ kiểm chứng đúng. */
export function sentenceAround(text, start, end) {
  const src = text || "";
  if (!src) return "";
  let from = 0;
  for (let i = start - 1; i >= 0; i--) {
    const ch = src[i];
    if (ch === "\n") { from = i + 1; break; }
    if ((ch === "." || ch === "!" || ch === "?") && (i + 1 >= src.length || /\s/.test(src[i + 1]))) {
      from = i + 1;
      break;
    }
  }
  let to = src.length;
  for (let i = end; i < src.length; i++) {
    const ch = src[i];
    if (ch === "\n") { to = i; break; }
    if (ch === "." || ch === "!" || ch === "?") { to = i + 1; break; }
  }
  return src.slice(from, to).trim();
}

/* Tìm bề mặt THẬT của 1 thẻ trong 1 đoạn văn bản tiếng Anh cho trước (vd đề bài của câu hỏi) —
   dùng chung logic khớp dài-nhất-thắng của segmentText() để đồng nhất với phần gạch chân trong
   đề. Nơi cần: các chip thuật ngữ ở khối "Song ngữ" (BilingualWidgets.jsx) hiện lấy cố định
   sourceTerms[0] làm nhãn, y hệt lỗi "Thus hiện thành therefore" — chip phải hiện đúng từ THẬT SỰ
   xuất hiện trong câu hỏi đó, không phải headword chuẩn của thẻ. Trả về null nếu không tìm thấy
   (vd thẻ được gắn từ phần giải thích/đáp án chứ không có trong đề bài). */
export function firstSurfaceMatch(text, term) {
  if (!term) return null;
  const segments = segmentText(text, [term]);
  const hit = segments.find((s) => s.termId === term.id);
  return hit ? hit.text : null;
}
