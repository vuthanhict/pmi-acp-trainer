/* ===================== Ôn câu hay sai (theo đề) ===================== */
/* Logic thuần, không import React. Gộp lịch sử làm bài của TỪNG CÂU trong một đề qua TẤT CẢ các
   session/lần làm — trả lời "câu nào tôi cứ sai hoài" thay vì chỉ xem đúng/sai trong 1 lần làm
   (ResultsScreen) hay điểm % tổng qua các lần (AttemptSparkline ở LibraryScreen), cả hai đều
   không giữ lại danh sách câu cụ thể xuyên suốt lịch sử. */
import { QUESTIONS_BY_QUIZ } from "./embeddedData.js";

/**
 * @param {object} params
 * @param {array} params.attempts progress.attempts đầy đủ (không lọc theo session)
 * @param {number} params.quizIndex đề cần xem
 * @param {number} [params.minWrongCount=1] chỉ giữ câu có ít nhất bấy nhiêu lần sai
 * @returns {array} xếp theo số lần sai nhiều nhất trước, sai gần đây nhất trước trong các câu hoà
 */
export function buildMistakeReview({ attempts, quizIndex, minWrongCount = 1 }) {
  const questionIds = new Set((QUESTIONS_BY_QUIZ.get(quizIndex) || []).map((q) => q.id));
  const byQuestion = new Map();
  // Chỉ tính attempt đã CHẤM ĐƯỢC — câu manualReview không có đáp án đúng để so, không thể xếp
  // "sai" một cách có ý nghĩa.
  for (const a of attempts) {
    if (a.gradeStatus !== "graded" || !questionIds.has(a.questionId)) continue;
    if (!byQuestion.has(a.questionId)) byQuestion.set(a.questionId, []);
    byQuestion.get(a.questionId).push(a);
  }

  const rows = [];
  for (const [questionId, list] of byQuestion) {
    const sorted = list.slice().sort((x, y) => new Date(x.answeredAt || 0) - new Date(y.answeredAt || 0));
    const wrongCount = sorted.filter((a) => !a.isCorrect).length;
    if (wrongCount < minWrongCount) continue;
    const lastAttempt = sorted[sorted.length - 1];
    rows.push({
      questionId,
      totalAttempts: sorted.length,
      wrongCount,
      correctCount: sorted.length - wrongCount,
      lastCorrect: !!lastAttempt.isCorrect,
      lastAnsweredAt: lastAttempt.answeredAt,
      // Giữ nguyên attempt gần nhất (không phải chỉ tóm tắt) để tái dùng ReviewQuestionCard của
      // ResultsScreen nguyên trạng — hiện đúng lựa chọn/độ tự tin của lần làm gần nhất.
      lastAttempt,
    });
  }

  rows.sort((x, y) => y.wrongCount - x.wrongCount || new Date(y.lastAnsweredAt || 0) - new Date(x.lastAnsweredAt || 0));
  return rows;
}
