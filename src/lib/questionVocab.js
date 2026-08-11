/* ===================== Từ vựng theo từng câu hỏi ===================== */
/* Gom các thẻ từ vựng gắn với một câu hỏi thành 3 nhóm hiển thị. Lý do chia nhóm thay vì đổ ra
   một danh sách phẳng: một câu trung bình có ~17 thẻ (câu dài tới 70), đọc một mạch thì rối. Ba
   nhóm này tương ứng ba loại khó khác nhau với người học:
     term   — thuật ngữ chuyên môn Agile/PMI (phải hiểu để chọn đúng đáp án)
     word   — từ tiếng Anh học thuật/công sở (rào cản ngôn ngữ thuần túy)
     phrase — cụm từ & mẫu câu ra đề (nghĩa không suy được từ từng từ)
   Trong mỗi nhóm, thứ tự đã được sắp sẵn từ lúc build theo độ hiếm — thẻ ít gặp (khả năng cao
   là người học chưa biết) đứng trước. Module này không import React. */
import { VI_TERM_INDEX, VOCAB_BY_QUESTION } from "./embeddedData.js";

export const VOCAB_GROUPS = ["term", "word", "phrase"];

function groupOf(term) {
  if (term.category === "exam-phrase") return "phrase";
  if (term.category === "vocabulary") return "word";
  return "term";
}

/* Trả về { term: [], word: [], phrase: [], total } cho một câu hỏi.
   includePost=false khi người học CHƯA trả lời: chỉ hiện thẻ của đề bài + đáp án lựa chọn, không
   hiện thẻ lấy từ phần giải thích — nếu không, danh sách từ vựng sẽ vô tình lộ hướng đáp án. */
export function questionVocab(questionId, includePost) {
  const entry = VOCAB_BY_QUESTION.get(questionId);
  const groups = { term: [], word: [], phrase: [], total: 0 };
  if (!entry) return groups;
  const ids = includePost ? [...entry.pre, ...entry.post] : entry.pre;
  for (const id of ids) {
    const term = VI_TERM_INDEX.get(id);
    if (!term) continue;
    groups[groupOf(term)].push(term);
    groups.total++;
  }
  return groups;
}

/* Danh sách thẻ PHẲNG của một câu — dùng cho việc gạch chân từ ngay trong đề bài (xem
   inlineVocab.js). Cùng nguồn dữ liệu và cùng luật lọc pre/post với questionVocab(), nên phần
   gạch chân trong đề luôn khớp đúng với danh sách trong bảng từ vựng. */
export function questionVocabTerms(questionId, includePost) {
  const g = questionVocab(questionId, includePost);
  return [...g.term, ...g.word, ...g.phrase];
}

/* Số thẻ hiển thị trên nút mở panel — dùng cùng quy tắc lọc với questionVocab() để con số trên
   nút luôn khớp đúng số dòng người dùng sẽ thấy khi mở ra. */
export function questionVocabCount(questionId, includePost) {
  return questionVocab(questionId, includePost).total;
}
