/* ===================== Study plan (lộ trình theo ngày thi) ===================== */
/* Logic thuần, không import React — nhận progress/gapProfile/tracking đã tính sẵn, không lưu
   bản sao đã tổng hợp vào progress (đúng nguyên tắc ở đầu trackingEngine.js): mọi con số ở
   đây tính lại từ attempts/completedQuizzes mỗi lần gọi, nên merge Drive/import không bao giờ
   làm lệch lộ trình. */
import { QUIZ_CATALOG, QUESTIONS_BY_QUIZ } from "./embeddedData.js";
import { shiftDayKey, diffDayKeys } from "./utils.js";
import { READINESS_READY_BAR } from "./trackingEngine.js";

const CORE_TIERS = ["required", "recommended"];
// 2 ngày cuối trước thi: chỉ ôn nhẹ/nghỉ ngơi, không tính vào nhịp học nội dung mới — nhồi nhét
// sát ngày thi làm tăng lo âu và không kịp thấm, phản tác dụng hơn là để trống.
const FINAL_REST_DAYS = 2;
// Ngưỡng % task "critical" chấp nhận được để coi là đã qua giai đoạn nền tảng — không đòi hỏi
// 0 tuyệt đối (một vài task vẫn còn dữ liệu ít) mà cho phép một tỉ lệ nhỏ.
const CRITICAL_TOLERANCE_RATIO = 0.15;
const CRITICAL_TOLERANCE_MIN = 2;

function coreQuizzes() {
  return QUIZ_CATALOG.filter((c) => CORE_TIERS.includes(c.tier));
}

/** Số bài thi thử (Exam mode, timed) khuyến nghị trước ngày thi — càng nhiều thời gian càng
    nên luyện nhiều lượt để quen áp lực thời gian, nhưng không cần quá 3 (hiệu quả giảm dần). */
export function recommendedMockExamCount(daysLeft) {
  if (daysLeft == null) return 2;
  if (daysLeft >= 30) return 3;
  if (daysLeft >= 14) return 2;
  return 1;
}

/**
 * Tính lộ trình luyện thi từ ngày thi đã đặt: còn bao nhiêu ngày, giai đoạn hiện tại (dựa trên
 * tiến độ THẬT, không phải lịch giả định), nhịp câu/ngày cần đạt, mốc bắt buộc, và một lịch dự
 * kiến (Gantt đơn giản) để hình dung việc phân bổ thời gian còn lại.
 */
export function buildStudyPlan({ progress, gapProfile, tracking }) {
  const { examDate, today } = tracking;
  if (!examDate) return { hasExamDate: false };

  const daysLeft = diffDayKeys(examDate, today); // âm nếu ngày thi đã qua, 0 nếu là hôm nay
  const effectiveDaysLeft = Math.max(0, daysLeft);

  const completedQuizIndexes = new Set(progress.completedQuizzes.map((c) => c.quizIndex).filter((x) => x != null));
  const core = coreQuizzes();
  const requiredQuizzes = core.filter((c) => c.tier === "required");
  const untouchedCore = core.filter((c) => !completedQuizIndexes.has(c.quizIndex));

  const mockExamsTarget = recommendedMockExamCount(daysLeft);
  const requiredIndexSet = new Set(requiredQuizzes.map((c) => c.quizIndex));
  const mockExamsDone = progress.completedQuizzes.filter((c) => c.mode === "exam" && requiredIndexSet.has(c.quizIndex)).length;

  // Khối lượng nội dung CHƯA HỌC quy đổi ra số câu (không tính theo đề, để không bị lệch khi
  // người học chỉ làm dở một đề) — cộng thêm phần câu đã làm SAI trong các đề required/recommended
  // (trọng số nhẹ hơn vì ôn lại nhanh hơn học mới).
  const answeredIds = new Set(progress.attempts.map((a) => a.questionId));
  const wrongIds = new Set(progress.attempts.filter((a) => a.gradeStatus === "graded" && !a.isCorrect).map((a) => a.questionId));
  let unseenCoreQuestions = 0;
  let wrongCoreQuestions = 0;
  for (const c of core) {
    for (const q of QUESTIONS_BY_QUIZ.get(c.quizIndex) || []) {
      if (q.manualReview) continue;
      if (!answeredIds.has(q.id)) unseenCoreQuestions += 1;
      else if (wrongIds.has(q.id)) wrongCoreQuestions += 1;
    }
  }
  const remainingWorkUnits = unseenCoreQuestions + Math.round(wrongCoreQuestions * 0.6);

  const studyDaysLeft = Math.max(0, effectiveDaysLeft - FINAL_REST_DAYS);
  const dailyQuestionTarget = studyDaysLeft > 0
    ? Math.ceil(remainingWorkUnits / studyDaysLeft)
    : remainingWorkUnits; // không còn ngày để dàn trải — toàn bộ dồn vào những gì còn lại

  let riskLevel;
  if (daysLeft < 0) riskLevel = "overdue";
  else if (dailyQuestionTarget <= 15) riskLevel = "ample";
  else if (dailyQuestionTarget <= 30) riskLevel = "on_track";
  else if (dailyQuestionTarget <= 60) riskLevel = "tight";
  else riskLevel = "insufficient";

  const criticalTasks = gapProfile.tasks.filter((t) => t.status === "critical");
  const criticalTolerance = Math.max(CRITICAL_TOLERANCE_MIN, Math.round(gapProfile.tasks.length * CRITICAL_TOLERANCE_RATIO));

  // ---- Giai đoạn THỰC TẾ: dựa trên tiến độ đã đạt, không phải mốc lịch giả định ----
  let phase;
  if (daysLeft <= 0) phase = "overdue";
  else if (daysLeft <= FINAL_REST_DAYS) phase = "final_days";
  else if (untouchedCore.length > 0 || criticalTasks.length > criticalTolerance) phase = "foundation";
  else if (mockExamsDone < mockExamsTarget) phase = "mock_exams";
  else phase = "final_review";

  // ---- Lịch dự kiến (Gantt đơn giản): chia effectiveDaysLeft cho 4 giai đoạn theo khối lượng
  // còn lại + số bài thi thử cần làm, chỉ để hình dung — không phải cam kết cứng. ----
  const finalDaysLen = Math.min(FINAL_REST_DAYS, effectiveDaysLeft);
  let remain = effectiveDaysLeft - finalDaysLen;
  const mockDaysLen = remain > 0 ? Math.min(remain, mockExamsTarget * 2) : 0;
  remain -= mockDaysLen;
  const finalReviewLen = remain > 0 ? Math.min(remain, 5) : 0;
  remain -= finalReviewLen;
  const foundationLen = Math.max(0, remain);

  let cursor = today;
  const segments = [];
  const pushSegment = (key, len) => {
    if (len <= 0) return;
    const startDate = cursor;
    const endDate = shiftDayKey(cursor, len - 1);
    segments.push({ key, days: len, startDate, endDate });
    cursor = shiftDayKey(cursor, len);
  };
  pushSegment("foundation", foundationLen);
  pushSegment("mock_exams", mockDaysLen);
  pushSegment("final_review", finalReviewLen);
  pushSegment("final_days", finalDaysLen);

  // ---- Mốc bắt buộc — mỗi mốc gắn được với một hành động cụ thể trong app ----
  const readinessDeadlineDays = Math.max(7, Math.round(effectiveDaysLeft * 0.2));
  const milestones = [
    {
      id: "core_coverage",
      done: untouchedCore.length === 0,
      current: core.length - untouchedCore.length,
      target: core.length,
    },
    {
      id: "no_critical_gap",
      done: criticalTasks.length <= criticalTolerance,
      current: gapProfile.tasks.length - criticalTasks.length,
      target: gapProfile.tasks.length,
    },
    {
      id: "mock_exams",
      done: mockExamsDone >= mockExamsTarget,
      current: mockExamsDone,
      target: mockExamsTarget,
    },
    {
      id: "readiness",
      done: tracking.readiness.enoughData && tracking.readiness.score >= READINESS_READY_BAR,
      current: tracking.readiness.enoughData ? tracking.readiness.score : 0,
      target: READINESS_READY_BAR,
      dueDate: shiftDayKey(examDate, -readinessDeadlineDays),
    },
  ];

  return {
    hasExamDate: true,
    examDate,
    daysLeft,
    phase,
    riskLevel,
    dailyQuestionTarget,
    remainingWorkUnits,
    unseenCoreQuestions,
    wrongCoreQuestions,
    untouchedCoreCount: untouchedCore.length,
    coreTotal: core.length,
    mockExamsDone,
    mockExamsTarget,
    criticalCount: criticalTasks.length,
    segments,
    milestones,
  };
}
