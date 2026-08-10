/* ---------- Matching-type question parsing ---------- */
/* 3/1.470 câu có interactionType="matching" (choices=[], correctOptionIds=[]).      */
/* Stem chứa các dòng "- [Ô trống]: <statement>" và "- [Các lựa chọn để ghép]: A; B". */
/* correctAnswerText chứa "[Category] statement" cho từng dòng — dùng để hiện đáp án. */
export function parseMatchingQuestion(q) {
  const stem = q.stem || "";
  const lines = stem.split("\n");
  const intro = [];
  const statements = [];
  let options = [];
  for (const line of lines) {
    const blankMatch = line.match(/^-\s*\[Ô trống\]:\s*(.*)$/);
    const optMatch = line.match(/^-\s*\[Các lựa chọn để ghép\]:\s*(.*)$/);
    if (blankMatch) {
      statements.push(blankMatch[1].trim());
    } else if (optMatch) {
      options = optMatch[1].split(";").map((s) => s.trim()).filter(Boolean);
    } else if (!line.trim().startsWith("-") && statements.length === 0 && intro.length === 0 && line.trim()) {
      // Stem gốc thường lặp lại các statement thành đoạn văn xuôi TRƯỚC danh sách gạch đầu dòng
      // có cấu trúc — chỉ giữ dòng hướng dẫn đầu tiên, tránh hiển thị statement hai lần.
      intro.push(line);
    }
  }
  // Đáp án đúng: "[Category] statement" mỗi dòng trong correctAnswerText
  const correctMap = new Map(); // statement -> category
  const correctText = q.correctAnswerText || "";
  for (const line of correctText.split("\n")) {
    const m = line.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (m) correctMap.set(m[2].trim(), m[1].trim());
  }
  return { intro: intro.join("\n").trim(), statements, options, correctMap };
}
