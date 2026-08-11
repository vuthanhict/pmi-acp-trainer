/* ===================== Study plan (lộ trình theo ngày thi) ===================== */
/* Logic thuần, không import React — nhận progress/gapProfile/tracking đã tính sẵn, không lưu
   bản sao đã tổng hợp vào progress (đúng nguyên tắc ở đầu trackingEngine.js): mọi con số ở
   đây tính lại từ attempts/completedQuizzes mỗi lần gọi, nên merge Drive/import không bao giờ
   làm lệch lộ trình. */
import { QUIZ_CATALOG, QUESTIONS_BY_QUIZ } from "./embeddedData.js";
import { shiftDayKey, diffDayKeys, dayKey } from "./utils.js";
import { READINESS_READY_BAR } from "./trackingEngine.js";

const CORE_TIERS = ["required", "recommended"];
// 2 ngày cuối trước thi: chỉ ôn nhẹ/nghỉ ngơi, không tính vào nhịp học nội dung mới — nhồi nhét
// sát ngày thi làm tăng lo âu và không kịp thấm, phản tác dụng hơn là để trống.
const FINAL_REST_DAYS = 2;
// Ngưỡng % task "critical" chấp nhận được để coi là đã qua giai đoạn nền tảng — không đòi hỏi
// 0 tuyệt đối (một vài task vẫn còn dữ liệu ít) mà cho phép một tỉ lệ nhỏ.
const CRITICAL_TOLERANCE_RATIO = 0.15;
const CRITICAL_TOLERANCE_MIN = 2;
// Khoảng cách TỐI THIỂU giữa lúc học xong nội dung một đề required và lúc được phép làm lượt
// Exam mode tính giờ của đề đó — làm ngay hôm sau chỉ đo trí nhớ ngắn hạn (còn nhớ mặt câu vừa
// luyện), không đo được mastery thật. 5 ngày đủ để quên mặt câu nhưng chưa quên kiến thức nền.
export const MIN_REDO_GAP_DAYS = 5;

function coreQuizzes() {
  return QUIZ_CATALOG.filter((c) => CORE_TIERS.includes(c.tier));
}
function gradableQuestions(quizIndex) {
  return (QUESTIONS_BY_QUIZ.get(quizIndex) || []).filter((q) => !q.manualReview);
}

/**
 * Kế hoạch từng đề + tổng khối lượng câu còn phải hoàn tất trước ngày thi — tách riêng khỏi
 * buildStudyPlan để dùng lại được cho việc tính "mục tiêu hôm qua" (xem computeCatchUp bên
 * dưới), vốn cần chạy lại đúng phép tính này trên tập attempts/completedQuizzes ĐÃ LOẠI hoạt
 * động của hôm nay.
 *
 * Mỗi đề chỉ có ĐÚNG 2 yêu cầu, không đếm theo "số lượt làm" nữa (số lượt không còn ý nghĩa khi
 * một đề có thể được học rải rác qua nhiều phiên luyện chia nhỏ nhiều ngày — xem
 * startTodayPracticeSession ở App.jsx):
 *   1) PHỦ HẾT NỘI DUNG — mọi câu (không tính manualReview) đã được trả lời ít nhất 1 lần, so
 *      khớp từng questionId với lịch sử attempts (đúng yêu cầu "xét các câu chưa làm thực sự").
 *      Có thể đạt được qua nhiều phiên luyện nhỏ rải rác nhiều ngày.
 *   2) (CHỈ required) MỘT LƯỢT EXAM MODE TRỌN VẸN — phòng thi thật không có gợi ý và tính giờ
 *      nghiêm ngặt, nên phải có ít nhất 1 lần làm hết đề trong một phiên duy nhất, dưới điều
 *      kiện giống thi thật. Lượt này KHÔNG được chia nhỏ (startTodayPracticeSession chỉ tạo
 *      phiên Practice) — luôn dùng toàn bộ câu của đề.
 */
function computeQuizWorkload(attempts, completedQuizzes, tz) {
  const completedByQuiz = new Map();
  for (const entry of completedQuizzes) {
    if (entry.quizIndex == null) continue;
    if (!completedByQuiz.has(entry.quizIndex)) completedByQuiz.set(entry.quizIndex, []);
    completedByQuiz.get(entry.quizIndex).push(entry);
  }

  const answeredIds = new Set(attempts.map((a) => a.questionId));
  const core = coreQuizzes();

  let unseenCoreQuestions = 0;
  let totalCoreQuestions = 0;
  let totalRequiredQuestions = 0;
  let totalRecommendedQuestions = 0;
  let workloadQuestions = 0;
  let requiredExamModeDone = 0;

  const quizPassPlan = core.map((c) => {
    const entries = completedByQuiz.get(c.quizIndex) || [];
    // Chunk luyện tập (startTodayPracticeSession) luôn mode "practice" với questionIds là tập
    // con — chỉ có nút "làm lại Exam mode" (luôn full đề) mới có thể tạo entry mode "exam", nên
    // examModeDone dưới đây luôn tương ứng một lượt TRỌN VẸN, không cần kiểm tra coverage riêng.
    const examModeDone = entries.some((e) => e.mode === "exam");
    if (c.tier === "required" && examModeDone) requiredExamModeDone += 1;

    const gradable = gradableQuestions(c.quizIndex);
    const gradableIds = new Set(gradable.map((q) => q.id));
    totalCoreQuestions += gradable.length;
    if (c.tier === "required") totalRequiredQuestions += gradable.length;
    else totalRecommendedQuestions += gradable.length;

    const unseenInQuiz = gradable.filter((q) => !answeredIds.has(q.id)).length;
    unseenCoreQuestions += unseenInQuiz;

    const needsExamMode = c.tier === "required" && !examModeDone;
    workloadQuestions += unseenInQuiz + (needsExamMode ? gradable.length : 0);

    const status = unseenInQuiz > 0 ? "first_pass" : needsExamMode ? "needs_exam_mode" : "done";

    // Mốc "được phép làm Exam mode": chỉ có ý nghĩa khi coverage vừa xong nhưng chưa có lượt exam
    // — lấy ngày TRẢ LỜI GẦN NHẤT trong số các câu thuộc đề này (lúc chưa có lượt exam, mọi
    // attempt của đề đều là luyện tập rải rác, nên đây chính là ngày hoàn tất phủ nội dung).
    let earliestExamModeDate = null;
    if (status === "needs_exam_mode") {
      let lastPracticeDay = null;
      for (const a of attempts) {
        if (!a.answeredAt || !gradableIds.has(a.questionId)) continue;
        const d = dayKey(a.answeredAt, tz);
        if (d && (!lastPracticeDay || d > lastPracticeDay)) lastPracticeDay = d;
      }
      earliestExamModeDate = lastPracticeDay ? shiftDayKey(lastPracticeDay, MIN_REDO_GAP_DAYS) : null;
    }

    return {
      quizIndex: c.quizIndex, quizName: c.quizName, tier: c.tier,
      unseenInQuiz, gradableCount: gradable.length,
      examModeDone: c.tier === "required" ? examModeDone : null,
      status, earliestExamModeDate,
    };
  });

  return {
    core, quizPassPlan, workloadQuestions, unseenCoreQuestions,
    totalCoreQuestions, totalRequiredQuestions, totalRecommendedQuestions, requiredExamModeDone,
    firstPassRemaining: quizPassPlan.filter((q) => q.status === "first_pass").length,
    examModeRemaining: quizPassPlan.filter((q) => q.status === "needs_exam_mode").length,
  };
}

/**
 * Tính lộ trình luyện thi từ ngày thi đã đặt: còn bao nhiêu ngày, giai đoạn hiện tại (dựa trên
 * tiến độ THẬT, không phải lịch giả định), nhịp câu/ngày cần đạt (có xét yêu cầu Exam mode của
 * từng đề required), các mốc bắt buộc kèm hạn chót giải thích được, một lịch dự kiến (Gantt) suy
 * ngược từ ngày thi để còn đủ thời gian luyện GAP + làm Exam mode trước khi thi, và hành động cụ
 * thể của HÔM NAY (đề nào, chế độ nào) để người học không phải tự suy ra phải làm gì tiếp theo.
 */
export function buildStudyPlan({ progress, gapProfile, tracking }) {
  const { examDate, today, tz } = tracking;
  if (!examDate) return { hasExamDate: false };

  const daysLeft = diffDayKeys(examDate, today); // âm nếu ngày thi đã qua, 0 nếu là hôm nay
  const effectiveDaysLeft = Math.max(0, daysLeft);

  const {
    core, quizPassPlan, workloadQuestions, unseenCoreQuestions,
    totalCoreQuestions, totalRequiredQuestions, totalRecommendedQuestions, requiredExamModeDone,
    firstPassRemaining, examModeRemaining,
  } = computeQuizWorkload(progress.attempts, progress.completedQuizzes, tz);
  const requiredQuizzes = core.filter((c) => c.tier === "required");

  const studyDaysLeft = Math.max(0, effectiveDaysLeft - FINAL_REST_DAYS);
  const dailyQuestionTarget = studyDaysLeft > 0
    ? Math.ceil(workloadQuestions / studyDaysLeft)
    : workloadQuestions; // không còn ngày để dàn trải — toàn bộ dồn vào những gì còn lại

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
  else if (firstPassRemaining > 0) phase = "foundation";
  else if (criticalTasks.length > criticalTolerance) phase = "gap_fill";
  else if (examModeRemaining > 0) phase = "mock_exams";
  else phase = "final_review";

  // ---- Mốc thời điểm bắt buộc, suy ngược từ ngày thi — giải thích được TẠI SAO lại là ngày đó:
  // mỗi đề required cần đúng 1 cửa sổ Exam mode; review buffer sau mỗi ~3 lượt để có thời gian
  // xem lại câu sai trước lượt tiếp theo thay vì dồn hết liền nhau.
  const examWindowDays = requiredQuizzes.length + Math.ceil(requiredQuizzes.length / 3);
  const gapFillWindowDays = Math.max(7, Math.round(effectiveDaysLeft * 0.15));
  const firstPassDeadline = shiftDayKey(examDate, -(FINAL_REST_DAYS + examWindowDays + gapFillWindowDays));
  const gapFillDeadline = shiftDayKey(examDate, -(FINAL_REST_DAYS + examWindowDays));
  const examModeDeadline = shiftDayKey(examDate, -FINAL_REST_DAYS);

  const milestones = [
    {
      id: "first_pass",
      done: firstPassRemaining === 0,
      current: core.length - firstPassRemaining,
      target: core.length,
      dueDate: firstPassDeadline,
    },
    {
      id: "no_critical_gap",
      done: criticalTasks.length <= criticalTolerance,
      current: gapProfile.tasks.length - criticalTasks.length,
      target: gapProfile.tasks.length,
      dueDate: gapFillDeadline,
    },
    {
      id: "required_exam_mode",
      done: examModeRemaining === 0,
      current: requiredExamModeDone,
      target: requiredQuizzes.length,
      dueDate: examModeDeadline,
    },
    {
      id: "readiness",
      done: tracking.readiness.enoughData && tracking.readiness.score >= READINESS_READY_BAR,
      current: tracking.readiness.enoughData ? tracking.readiness.score : 0,
      target: READINESS_READY_BAR,
      dueDate: shiftDayKey(examDate, -Math.max(7, Math.round(effectiveDaysLeft * 0.2))),
    },
  ];
  for (const m of milestones) m.overdue = !m.done && diffDayKeys(m.dueDate, today) < 0;

  // ---- Lịch dự kiến (Gantt): 4 khối LIÊN TIẾP từ hôm nay tới các mốc suy ngược ở trên — khớp
  // đúng với milestones (không phải chia tỉ lệ mơ hồ). Mốc nào đã ở quá khứ so với hôm nay (do
  // đặt ngày thi gấp, hoặc do đã trễ tiến độ) thì đoạn tương ứng biến mất khỏi lịch thay vì vẽ
  // ngược — timeline luôn bắt đầu từ hôm nay.
  const segments = [];
  let cursor = today;
  const tryPushSegment = (key, deadlineInclusive) => {
    if (diffDayKeys(deadlineInclusive, cursor) < 0) return;
    const days = diffDayKeys(deadlineInclusive, cursor) + 1;
    segments.push({ key, days, startDate: cursor, endDate: deadlineInclusive });
    cursor = shiftDayKey(deadlineInclusive, 1);
  };
  tryPushSegment("foundation", firstPassDeadline);
  tryPushSegment("gap_fill", gapFillDeadline);
  tryPushSegment("mock_exams", examModeDeadline);
  if (effectiveDaysLeft > 0) tryPushSegment("final_days", shiftDayKey(examDate, -1));

  // ---- Hành động cụ thể của HÔM NAY — một đề/task rõ ràng để bấm vào làm ngay, thay vì chỉ một
  // con số chung chung. Ưu tiên required trước recommended (quizPassPlan giữ đúng thứ tự stage
  // của QUIZ_CATALOG, nhưng sort tường minh lại theo tier để không phụ thuộc thứ tự catalog).
  const byRequiredFirst = (a, b) => (a.tier === "required" ? 0 : 1) - (b.tier === "required" ? 0 : 1);
  let todayAction = null;
  if (phase === "foundation") {
    const next = quizPassPlan.filter((q) => q.status === "first_pass").sort(byRequiredFirst)[0];
    if (next) todayAction = { type: "first_pass", quizIndex: next.quizIndex, quizName: next.quizName, tier: next.tier, unseenInQuiz: next.unseenInQuiz };
  } else if (phase === "gap_fill") {
    todayAction = { type: "gap_fill", criticalCount: criticalTasks.length };
  } else if (phase === "mock_exams") {
    const candidates = quizPassPlan.filter((q) => q.status === "needs_exam_mode");
    const ready = candidates.filter((q) => !q.earliestExamModeDate || diffDayKeys(q.earliestExamModeDate, today) <= 0)[0];
    if (ready) {
      todayAction = { type: "exam_mode", quizIndex: ready.quizIndex, quizName: ready.quizName, tier: ready.tier };
    } else {
      const waiting = candidates.sort((a, b) => diffDayKeys(a.earliestExamModeDate, b.earliestExamModeDate))[0];
      todayAction = waiting
        ? { type: "wait_cooldown", quizName: waiting.quizName, availableDate: waiting.earliestExamModeDate }
        : { type: "final_review" };
    }
  } else if (phase === "final_review") {
    todayAction = { type: "final_review" };
  } else if (phase === "final_days") {
    todayAction = { type: "rest" };
  }

  return {
    hasExamDate: true,
    examDate,
    daysLeft,
    phase,
    riskLevel,
    dailyQuestionTarget,
    workloadQuestions,
    unseenCoreQuestions,
    totalCoreQuestions,
    totalRequiredQuestions,
    totalRecommendedQuestions,
    coreTotal: core.length,
    firstPassRemaining,
    examModeRemaining,
    requiredExamModeDone,
    requiredTotal: requiredQuizzes.length,
    criticalCount: criticalTasks.length,
    segments,
    milestones,
    quizPassPlan,
    todayAction,
  };
}

/**
 * So sánh mục tiêu HÔM QUA (theo lộ trình, tính lại như thể đang đứng ở hôm qua — loại toàn bộ
 * hoạt động của HÔM NAY ra khỏi attempts/completedQuizzes) với số câu thực tế đã làm hôm qua.
 * Không cộng phần thiếu này vào dailyQuestionTarget của hôm nay lần nữa — target hôm nay vốn đã
 * TỰ ĐỘNG tăng vì khối lượng còn lại (workloadQuestions) không đổi trong khi số ngày còn lại giảm
 * đi 1 (và ngược lại: làm NHIỀU hơn hôm qua khiến workload giảm nhiều hơn 1 ngày bù lại, nên mục
 * tiêu hôm nay tự thấp xuống) — hàm này chỉ làm phần chênh lệch đó HIỂN THỊ RÕ để người học hiểu
 * vì sao mục tiêu hôm nay khác hôm qua, đúng yêu cầu "không đạt thì hôm sau phải tăng lên để bù".
 */
export function computeCatchUp({ progress, tracking }) {
  if (!tracking.examDate) return null;
  const { today, tz, examDate, history } = tracking;
  const yesterday = shiftDayKey(today, -1);
  const daysLeftYesterday = diffDayKeys(examDate, yesterday);
  if (daysLeftYesterday <= 0) return null; // hôm qua đã là ngày thi hoặc trễ hơn — so sánh vô nghĩa

  const attemptsUpToYesterday = progress.attempts.filter((a) => !a.answeredAt || dayKey(a.answeredAt, tz) <= yesterday);
  const completedUpToYesterday = progress.completedQuizzes.filter((c) => !c.completedAt || dayKey(c.completedAt, tz) <= yesterday);
  const { workloadQuestions } = computeQuizWorkload(attemptsUpToYesterday, completedUpToYesterday, tz);

  const studyDaysLeftYesterday = Math.max(0, daysLeftYesterday - FINAL_REST_DAYS);
  const yesterdayTarget = studyDaysLeftYesterday > 0 ? Math.ceil(workloadQuestions / studyDaysLeftYesterday) : workloadQuestions;
  const yesterdayDone = history.get(yesterday)?.answered || 0;
  const shortfall = Math.max(0, yesterdayTarget - yesterdayDone);
  const surplus = Math.max(0, yesterdayDone - yesterdayTarget);

  return { yesterdayTarget, yesterdayDone, shortfall, surplus, metYesterday: shortfall === 0 };
}
