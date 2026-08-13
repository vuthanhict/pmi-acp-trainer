/* ===================== Chọn điểm để HIỂN THỊ cho một lần làm bài ===================== */
/* Điểm "trusted" chỉ tính các câu có eligibleForGap = true (câu đã được phân loại
   domain/task ECO). Một số bộ đề được nhúng vào khi chưa qua bước phân loại nên toàn
   bộ câu có eligibleForGap = false → trusted = 0/0 → màn Results/Lịch sử hiện 0%
   dù người học làm đúng quá nửa. Khi không có câu trusted nào, ta lùi về rawScore và
   đánh dấu fallback để UI ghi rõ đây là điểm thô. */

export function displayScore(entry) {
  const trusted = entry?.trustedScore;
  if (trusted && trusted.graded > 0) return { ...trusted, fallback: false };
  const raw = entry?.rawScore || { correct: 0, graded: 0, percent: 0 };
  return { correct: raw.correct, graded: raw.graded, percent: raw.percent, fallback: raw.graded > 0 };
}
