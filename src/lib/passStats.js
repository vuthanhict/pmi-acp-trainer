/* ===================== "Lượt" (pass) làm đề — suy ra từ attempts ===================== */
/* VÌ SAO CẦN KHÁI NIỆM NÀY: completedQuizzes ghi theo PHIÊN, mà một đề thường được làm rải rác
   qua hàng chục phiên nhỏ (startTodayPracticeSession chia 10-20 câu/lần) cộng thêm các phiên
   fill-gap. Hệ quả: người học chỉ thấy 12 con số rời rạc kiểu 30% / 100% / 27%, mỗi con số tính
   trên ~10 câu nên sai số lấy mẫu 95% lên tới ±31 điểm — gần như thuần nhiễu, nhưng lại được vẽ
   thành "xu hướng" và đọc thành "tôi đang tệ đi". Con số thật sự dự báo được kỳ thi — độ chính
   xác trên TOÀN BỘ đề ở lần gặp đầu tiên — thì không được tính ở đâu cả.

   ĐỊNH NGHĨA: lượt N của một đề = tập hợp lần trả lời thứ N của TỪNG CÂU thuộc đề đó.
   Định nghĩa theo "lần gặp thứ N của mỗi câu" (chứ không theo phiên) nên miễn nhiễm với việc
   chia nhỏ phiên, với fill-gap, và với merge dữ liệu từ nhiều thiết bị.

   Câu thuộc đề nào được tra từ QUESTION_INDEX chứ KHÔNG lấy attempt.quizIndex: phiên fill-gap có
   quizIndex = null nhưng vẫn phục vụ câu của các đề, và những lần đó phải được tính vào lượt của
   đề tương ứng — nếu không, độ phủ lượt 1 sẽ không bao giờ đạt 100%. */
import { QUESTION_INDEX, QUESTIONS_BY_QUIZ } from "./embeddedData.js";

function gradableIdsOf(quizIndex) {
  return (QUESTIONS_BY_QUIZ.get(quizIndex) || []).filter((q) => !q.manualReview).map((q) => q.id);
}

function pct(correct, total) {
  return total ? Number(((correct / total) * 100).toFixed(2)) : 0;
}

/**
 * Gán số thứ tự lượt cho từng attempt đã chấm: lần gặp đầu tiên của một câu là lượt 1, lần thứ
 * hai là lượt 2... Trả về Map(attempt → passNumber) dưới dạng mảng song song với đầu vào đã lọc.
 */
function gradedAttemptsWithPass(attempts) {
  const sorted = attempts
    .filter((a) => a.gradeStatus === "graded" && a.answeredAt)
    .slice()
    .sort((x, y) => new Date(x.answeredAt) - new Date(y.answeredAt));
  const count = new Map();
  return sorted.map((a) => {
    const n = (count.get(a.questionId) || 0) + 1;
    count.set(a.questionId, n);
    return { attempt: a, pass: n };
  });
}

/**
 * Thống kê từng lượt của MỘT đề.
 * @returns {Array<{pass, correct, answered, percent, total, complete, startedAt, completedAt}>}
 *   answered = số câu của đề đã làm ở lượt này, total = số câu chấm được của đề.
 */
export function buildQuizPasses(attempts, quizIndex) {
  const ids = new Set(gradableIdsOf(quizIndex));
  if (!ids.size) return [];
  const rows = gradedAttemptsWithPass(attempts).filter(({ attempt }) => ids.has(attempt.questionId));

  const byPass = new Map();
  for (const { attempt, pass } of rows) {
    if (!byPass.has(pass)) byPass.set(pass, []);
    byPass.get(pass).push(attempt);
  }

  return [...byPass.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pass, list]) => {
      const correct = list.filter((a) => a.isCorrect).length;
      const times = list.map((a) => new Date(a.answeredAt).getTime()).filter(Number.isFinite);
      return {
        pass,
        correct,
        answered: list.length,
        percent: pct(correct, list.length),
        total: ids.size,
        complete: list.length >= ids.size,
        startedAt: times.length ? new Date(Math.min(...times)).toISOString() : null,
        completedAt: list.length >= ids.size && times.length ? new Date(Math.max(...times)).toISOString() : null,
      };
    });
}

/**
 * So sánh hai lượt CÓ CẶP: chỉ tính trên những câu xuất hiện ở CẢ hai lượt.
 *
 * Bắt buộc phải so kiểu này. Lượt 2 thường mới làm được một phần, và phần đó lại chính là những
 * câu từng sai (fill-gap ưu tiên phục vụ lại) — so thẳng "lượt 2 = 70%" với "lượt 1 = 49%" là so
 * trên hai mẫu lệch nhau, luôn cho ra kết luận sai về tiến bộ.
 */
export function comparePasses(attempts, quizIndex, passA = 1, passB = 2) {
  const ids = new Set(gradableIdsOf(quizIndex));
  const rows = gradedAttemptsWithPass(attempts).filter(({ attempt }) => ids.has(attempt.questionId));

  const pick = (n) => new Map(rows.filter((r) => r.pass === n).map((r) => [r.attempt.questionId, r.attempt]));
  const a = pick(passA);
  const b = pick(passB);
  const shared = [...a.keys()].filter((id) => b.has(id));
  if (!shared.length) return null;

  const correctA = shared.filter((id) => a.get(id).isCorrect).length;
  const correctB = shared.filter((id) => b.get(id).isCorrect).length;
  return {
    passA, passB, shared: shared.length,
    percentA: pct(correctA, shared.length),
    percentB: pct(correctB, shared.length),
    delta: Number((pct(correctB, shared.length) - pct(correctA, shared.length)).toFixed(2)),
    fixed: shared.filter((id) => !a.get(id).isCorrect && b.get(id).isCorrect).length,
    broken: shared.filter((id) => a.get(id).isCorrect && !b.get(id).isCorrect).length,
  };
}

/** Lượt đang làm dở gần nhất (hoặc lượt cuối đã xong) — thứ cần đưa lên đầu thẻ đề. */
export function currentPass(passes) {
  if (!passes.length) return null;
  const inProgress = passes.find((p) => !p.complete);
  return inProgress || passes[passes.length - 1];
}

/**
 * Sai số lấy mẫu 95% (điểm %) của một tỉ lệ đúng — dùng để nói thẳng cho người học biết con số
 * họ đang nhìn đáng tin tới đâu. n=10 → ±31 điểm; n=106 → ±9,5 điểm.
 */
export function marginOfError(correct, answered) {
  if (!answered) return null;
  const p = correct / answered;
  return Number((1.96 * Math.sqrt(Math.max(p * (1 - p), 0.01) / answered) * 100).toFixed(1));
}

/** Thống kê lượt của TẤT CẢ các đề đã đụng tới — Map(quizIndex → passes[]). */
export function buildAllQuizPasses(attempts) {
  const touched = new Set();
  for (const a of attempts) {
    const q = QUESTION_INDEX.get(a.questionId);
    if (q && q.quizIndex != null) touched.add(q.quizIndex);
  }
  const m = new Map();
  for (const quizIndex of touched) m.set(quizIndex, buildQuizPasses(attempts, quizIndex));
  return m;
}
