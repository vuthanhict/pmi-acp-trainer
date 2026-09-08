/* ===================== Study plan recommendation ===================== */
import { QUIZ_CATALOG, QUESTIONS_BY_QUIZ } from "./embeddedData.js";
import { computeQuizWorkload } from "./studyPlan.js";
import { DEFAULT_TZ } from "./utils.js";

/* ---------- Study plan recommendation ---------- */
/**
 * Đề tiếp theo nên làm, kèm TRẠNG THÁI THẬT của nó và số câu một phiên sẽ nạp — để thẻ "Đề khuyến
 * nghị tiếp theo" gọi đúng chế độ thay vì luôn mở Exam mode.
 *
 * Bản trước coi một đề là XONG khi completedQuizzes có bất kỳ entry nào của nó:
 *
 *   const doneSet = new Set(progress.completedQuizzes.map((c) => c.quizIndex));
 *
 * Nhưng một phiên luyện 10 câu cũng tạo entry. Đúng cùng lớp lỗi với examModeDone cũ. Đo trên dữ
 * liệu thật: 7/12 đề core bị đánh dấu xong sai — trong đó có đề đang làm dở 54/120 câu, và 6 đề
 * đã phủ hết nội dung nhưng chưa đi câu Exam mode nào. Vì bỏ qua cả 7, hàm nhảy tới đề CHƯA ĐỘNG
 * TỚI BAO GIỜ, rồi thẻ ở màn Hôm nay mời vào Exam mode đề đó — phá đúng nguyên tắc mà phần còn
 * lại của app dựng cả cooldown 5 ngày để bảo vệ, và nói ngược với thẻ Trọng tâm hôm nay ngay
 * phía trên nó.
 *
 * Nay dùng chung computeQuizWorkload() với lộ trình: "xong" = phủ hết nội dung, và (nếu required)
 * phủ hết đề ở chế độ Exam. Kết quả cũng được finishSession ghi vào progress.plan, nên định nghĩa
 * sai trước đây còn đọng lại trong state đã lưu.
 */
export function recommendNextQuiz(progress) {
  const tz = progress.learner?.timezone || DEFAULT_TZ;
  const { quizPassPlan } = computeQuizWorkload(progress.attempts || [], progress.completedQuizzes || [], tz);
  const core = new Map(quizPassPlan.map((q) => [q.quizIndex, q]));
  const answeredIds = new Set((progress.attempts || []).map((a) => a.questionId));

  // Đề optional không nằm trong lộ trình core nên quizPassPlan không phủ — với chúng, "xong" chỉ
  // là phủ hết nội dung (không đòi lượt Exam mode).
  const optionalUnseen = (quizIndex) =>
    (QUESTIONS_BY_QUIZ.get(quizIndex) || []).filter((q) => !q.manualReview && !answeredIds.has(q.id)).length;

  const describe = (c) => {
    const row = core.get(c.quizIndex);
    if (row) return { ...c, status: row.status, remaining: row.status === "first_pass" ? row.unseenInQuiz : row.examUnseenInQuiz || 0 };
    const unseen = optionalUnseen(c.quizIndex);
    return { ...c, status: unseen > 0 ? "first_pass" : "done", remaining: unseen };
  };

  for (const tier of ["required", "recommended"]) {
    const hit = QUIZ_CATALOG.filter((c) => c.tier === tier).map(describe).find((c) => c.status !== "done");
    if (hit) return hit;
  }
  const any = QUIZ_CATALOG.map(describe).find((c) => c.status !== "done");
  return any || describe(QUIZ_CATALOG[0]);
}
