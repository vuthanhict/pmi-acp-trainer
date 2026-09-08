/* ===================== Tracking engine (streak/goal/readiness/GAP-practice) ===================== */
/* Logic thuần: mọi số liệu đều tính lại từ attempts[]/completedQuizzes[]/gapSnapshots[] —
   không lưu bản sao tổng hợp (xem comment gốc bên dưới). buildGapPracticeQuestionIds nằm ở
   đây (không phải gapEngine.js) vì nó là 1 phần của luồng "Luyện GAP", dùng QUESTIONS_BY_QUIZ
   để CHỌN câu chứ không tính mastery. */
import { DEFAULT_TZ, dayKey, todayKey, shiftDayKey, diffDayKeys, weekdayOfDayKey, clamp, mean, shuffleArray } from "./utils.js";
import { QUIZ_CATALOG, QUESTIONS_BY_QUIZ, QUESTION_INDEX } from "./embeddedData.js";
import { recencyWeight } from "./gapEngine.js";

/* ===================== Tracking engine ===================== */
/* NGUYÊN TẮC THIẾT KẾ QUAN TRỌNG: mọi số liệu tracking đều được TÍNH LẠI từ `attempts[]`  */
/* và `completedQuizzes[]` — không lưu bản sao đã tổng hợp vào progress. Nhờ vậy việc merge */
/* backup từ Drive / import file / làm bài trên 2 thiết bị không bao giờ tạo ra chuỗi ngày  */
/* hay tiến độ sai. Trong progress chỉ lưu ĐÚNG hai thứ người dùng tự đặt: mục tiêu hằng    */
/* ngày và ngày thi dự kiến. Dữ liệu đề thi (QUESTION_INDEX/QUIZ_CATALOG) chỉ được ĐỌC.     */

export const GOAL_PRESETS = [10, 20, 30, 50];
export const DEFAULT_GOAL_VALUE = 20;
export const READINESS_READY_BAR = 75;   // ngưỡng thận trọng do app đặt, KHÔNG phải chuẩn PMI
// Vạch tham chiếu trên biểu đồ ĐỘ CHÍNH XÁC. Tách khỏi READINESS_READY_BAR dù cùng giá trị: một
// bên là ngưỡng của chỉ số readiness (0-100, tổng hợp 4 hệ số), một bên là tỉ lệ trả lời đúng —
// hai đại lượng khác nhau, chỉnh cái này không được vô tình dịch cái kia.
export const TREND_ACCURACY_BAR = 75;
const STREAK_FREEZES_PER_MONTH = 2;
const MAX_MINUTES_PER_ATTEMPT = 10;       // chặn outlier: mở tab rồi bỏ đi cả tiếng
const READINESS_MIN_ATTEMPTS = 60;        // dưới mức này chỉ hiện "chưa đủ dữ liệu"

/** Câu hỏi được tính vào tiến độ hằng ngày: đã chấm được (loại matching/manual review). */
export function isCountableAttempt(a) {
  return a && a.gradeStatus === "graded";
}

/**
 * Gom attempts theo ngày (múi giờ người học) và tách rõ hai lớp:
 *  - firstExposure: lần ĐẦU TIÊN trong đời gặp questionId đó  → phản ánh năng lực thật
 *  - retake:        các lần gặp lại                            → phần lớn là đo trí nhớ
 * Đây là cơ chế chống "ảo tưởng tiến bộ" khi làm lại cùng một bộ đề.
 */
export function buildDailyHistory(attempts, tz = DEFAULT_TZ) {
  const sorted = attempts
    .filter(isCountableAttempt)
    .filter((a) => a.answeredAt)
    .slice()
    .sort((x, y) => new Date(x.answeredAt) - new Date(y.answeredAt));

  const seenQuestions = new Set();
  const history = new Map();
  for (const a of sorted) {
    const key = dayKey(a.answeredAt, tz);
    if (!key) continue;
    if (!history.has(key)) {
      history.set(key, {
        dayKey: key, answered: 0, correct: 0,
        firstExposure: 0, firstExposureCorrect: 0,
        retake: 0, retakeCorrect: 0,
        minutes: 0, sessionIds: new Set(),
      });
    }
    const row = history.get(key);
    const isFirst = !seenQuestions.has(a.questionId);
    seenQuestions.add(a.questionId);

    row.answered += 1;
    if (a.isCorrect) row.correct += 1;
    if (isFirst) {
      row.firstExposure += 1;
      if (a.isCorrect) row.firstExposureCorrect += 1;
    } else {
      row.retake += 1;
      if (a.isCorrect) row.retakeCorrect += 1;
    }
    if (Number.isFinite(a.responseTimeMs) && a.responseTimeMs > 0) {
      row.minutes += Math.min(MAX_MINUTES_PER_ATTEMPT, a.responseTimeMs / 60_000);
    }
    if (a.sessionId) row.sessionIds.add(a.sessionId);
  }
  for (const row of history.values()) {
    row.sessions = row.sessionIds.size;
    delete row.sessionIds;
    row.minutes = Math.round(row.minutes);
  }
  return history;
}

/** Số câu mục tiêu quy đổi ra "câu" cho một ngày, dù người dùng chọn kiểu mục tiêu nào. */
export function goalTargetCount(goal) {
  if (!goal) return null;
  if (goal.type === "quizset") {
    const cat = QUIZ_CATALOG.find((c) => c.quizIndex === goal.quizIndex);
    return cat?.questionCount || null;
  }
  return goal.value || null;
}

export function isGoalMet(dayRow, goal) {
  const target = goalTargetCount(goal);
  if (!target || !dayRow) return false;
  return dayRow.answered >= target;
}

/**
 * Chuỗi ngày liên tiếp đạt mục tiêu, có cơ chế "bảo vệ chuỗi" 2 lượt/tháng dương lịch.
 * Không có cơ chế này, ốm đúng 1 ngày là mất chuỗi 30 ngày — và người học bỏ app luôn.
 * Ngày HÔM NAY chưa đạt thì không phá chuỗi (còn cả ngày để làm), chỉ không cộng thêm.
 */
export function computeStreak(history, goal, tz = DEFAULT_TZ, now = Date.now()) {
  const today = todayKey(tz, now);
  if (!goalTargetCount(goal)) {
    return { current: 0, longest: 0, freezesUsed: 0, freezesLeft: STREAK_FREEZES_PER_MONTH, lastActiveDay: null, todayMet: false };
  }

  const metDays = new Set();
  for (const [key, row] of history.entries()) if (isGoalMet(row, goal)) metDays.add(key);

  const todayMet = metDays.has(today);
  const freezeBudget = new Map(); // "YYYY-MM" → số lượt đã dùng
  const takeFreeze = (key) => {
    const month = key.slice(0, 7);
    const used = freezeBudget.get(month) || 0;
    if (used >= STREAK_FREEZES_PER_MONTH) return false;
    freezeBudget.set(month, used + 1);
    return true;
  };

  let current = 0;
  let cursor = todayMet ? today : shiftDayKey(today, -1);
  // Trần an toàn 400 vòng: không ai có chuỗi dài hơn thế, và tránh lặp vô hạn nếu dữ liệu lỗi.
  for (let i = 0; i < 400; i++) {
    if (metDays.has(cursor)) {
      current += 1;
      cursor = shiftDayKey(cursor, -1);
      continue;
    }
    if (current > 0 && takeFreeze(cursor)) {
      cursor = shiftDayKey(cursor, -1);
      continue;
    }
    break;
  }

  // Chuỗi dài nhất: quét toàn bộ lịch sử, cùng luật freeze (ngân sách riêng cho mỗi lần quét).
  let longest = 0;
  const allDays = [...metDays].sort();
  if (allDays.length) {
    const first = allDays[0];
    const last = allDays[allDays.length - 1];
    const span = Math.min(2000, diffDayKeys(last, first) + 1);
    const localBudget = new Map();
    let run = 0;
    let gapRun = 0;
    for (let i = 0; i < span; i++) {
      const key = shiftDayKey(first, i);
      if (metDays.has(key)) {
        run += 1;
        gapRun = 0;
        longest = Math.max(longest, run);
      } else if (run > 0) {
        const month = key.slice(0, 7);
        const used = localBudget.get(month) || 0;
        gapRun += 1;
        if (gapRun <= 1 && used < STREAK_FREEZES_PER_MONTH) {
          localBudget.set(month, used + 1);
        } else {
          run = 0;
          gapRun = 0;
          localBudget.clear();
        }
      }
    }
  }
  longest = Math.max(longest, current);

  const thisMonth = today.slice(0, 7);
  const freezesUsed = freezeBudget.get(thisMonth) || 0;
  const activeDays = [...history.keys()].sort();
  return {
    current,
    longest,
    todayMet,
    freezesUsed,
    freezesLeft: Math.max(0, STREAK_FREEZES_PER_MONTH - freezesUsed),
    lastActiveDay: activeDays.length ? activeDays[activeDays.length - 1] : null,
  };
}

/**
 * Chuỗi thời gian 2 đường cho biểu đồ xu hướng: độ chính xác lần-đầu-gặp và làm-lại.
 * Dùng cửa sổ trượt `window` ngày để làm mượt — dữ liệu từng ngày quá thưa (10-20 câu)
 * nên đường thô sẽ nhảy 0%↔100% và không đọc được gì.
 */
export function buildAccuracyTrend(history, { days = 30, window = 7, tz = DEFAULT_TZ, now = Date.now() } = {}) {
  const today = todayKey(tz, now);
  const points = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = shiftDayKey(today, -i);
    let fe = 0, feC = 0, rt = 0, rtC = 0;
    for (let w = 0; w < window; w++) {
      const row = history.get(shiftDayKey(key, -w));
      if (!row) continue;
      fe += row.firstExposure; feC += row.firstExposureCorrect;
      rt += row.retake; rtC += row.retakeCorrect;
    }
    points.push({
      dayKey: key,
      firstExposure: fe >= 5 ? feC / fe : null,   // dưới 5 mẫu thì con số vô nghĩa → để trống
      retake: rt >= 5 ? rtC / rt : null,
      firstExposureN: fe,
      retakeN: rt,
    });
  }
  return points;
}

/**
 * Diễn biến mastery từng domain theo NGÀY, đọc từ gapSnapshots. Một điểm cho mỗi ngày trong
 * `days` ngày gần nhất; ngày không có phiên nào trả về domains rỗng để đường bị NGẮT thay vì
 * nối liền qua khoảng trống (cùng luật với buildAccuracyTrend).
 *
 * Trước đây hàm này trả về một điểm cho mỗi SNAPSHOT và cắt `.slice(-40)`, nên biểu đồ vẽ ra hai
 * thứ sai cùng lúc:
 *   - Trục hoành không phải thời gian. Người học làm ~5 phiên/ngày nhưng số phiên mỗi ngày rất
 *     lệch, nên một ngày chiếm 22,5% bề ngang còn ngày kế bên chiếm 5% — độ dốc của đường, thứ
 *     duy nhất đọc được từ một biểu đồ xu hướng, thành vô nghĩa.
 *   - 40 snapshot của một người làm 5 phiên/ngày chỉ là 8 ngày, tức biểu đồ phủ 9/28 ngày lịch
 *     sử mà không có nhãn ngày nào để nhận ra.
 *
 * Mastery là một TRẠNG THÁI tích luỹ chứ không phải lượng làm trong ngày, nên ngày có nhiều
 * phiên lấy snapshot CUỐI CÙNG (trạng thái cuối ngày), không lấy trung bình.
 */
export function buildMasteryTrend(gapSnapshots, { days = 30, tz = DEFAULT_TZ, now = Date.now() } = {}) {
  const lastOfDay = new Map();
  for (const s of gapSnapshots || []) {
    if (!s?.generatedAt || !s?.profile?.domains) continue;
    const key = dayKey(s.generatedAt, tz);
    if (!key) continue;
    const cur = lastOfDay.get(key);
    if (!cur || cur.generatedAt <= s.generatedAt) lastOfDay.set(key, s);
  }

  const today = todayKey(tz, now);
  const points = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = shiftDayKey(today, -i);
    const s = lastOfDay.get(key);
    points.push({
      dayKey: key,
      domains: s ? Object.fromEntries(s.profile.domains.map((d) => [d.domain, d.mastery])) : {},
    });
  }
  return points;
}

export const READINESS_LEVELS = [
  { key: "high_risk", min: 0, ring: "critical" },
  { key: "progressing", min: 60, ring: "needs_work" },
  { key: "near_ready", min: READINESS_READY_BAR, ring: "developing" },
  { key: "ready", min: 85, ring: "ready" },
];
export function readinessLevelFor(score) {
  let level = READINESS_LEVELS[0];
  for (const l of READINESS_LEVELS) if (score >= l.min) level = l;
  return level;
}

/**
 * Readiness Index 0–100 — trả lời "tôi đỗ được chưa?" bằng 4 hệ số nhân, tất cả đều
 * lấy từ dữ liệu app đã có. Cố tình KHÔNG hiển thị "xác suất đỗ %" vì không có bộ dữ
 * liệu chuẩn hóa nào để hiệu chỉnh con số đó — hứa hẹn sai còn tệ hơn không hứa.
 *
 *   base         Σ(trọng số đề thi × mastery domain), domain chưa có dữ liệu tính là 0
 *   coverage     0.5 + 0.5 × (tỉ lệ task đã có bằng chứng) — phủ 10% đề thi không phải là sẵn sàng
 *   recency      0.5^(số ngày nghỉ / 21), sàn 0.7 — nghỉ 3 tuần thì mastery cũ không còn đúng
 *   independence 1 − 0.25 × tỉ lệ dùng hỗ trợ tiếng Việt — phòng thi thật không có bản dịch
 */
export function computeReadiness(gapProfile, attempts, { now = Date.now(), lang = "vi" } = {}) {
  const totalTasks = gapProfile.tasks.length;
  const tasksWithEvidence = gapProfile.tasks.filter((t) => t.status !== "insufficient_data").length;
  const untouched = gapProfile.tasks.filter((t) => t.attempts === 0).length;
  const critical = gapProfile.tasks.filter((t) => t.status === "critical");

  const base = gapProfile.domains.reduce((s, d) => s + d.examWeight * (d.mastery ?? 0), 0);
  const coverage = totalTasks ? tasksWithEvidence / totalTasks : 0;
  const coverageFactor = 0.5 + 0.5 * coverage;

  const graded = attempts.filter(isCountableAttempt);
  const lastAt = graded.reduce((mx, a) => Math.max(mx, new Date(a.answeredAt || 0).getTime() || 0), 0);
  const idleDays = lastAt ? Math.max(0, Math.floor((now - lastAt) / 86_400_000)) : 999;
  const recency = lastAt ? clamp(0.5 ** (idleDays / 21), 0.7, 1) : 0.7;

  // Tỉ lệ dùng hỗ trợ CÓ TRỌNG SỐ ĐỘ MỚI, cùng nhịp quên với mastery (recencyWeight). Trung bình
  // cộng phẳng toàn lịch sử biến independence thành hệ số duy nhất của readiness không nhìn theo
  // thời gian: base đã giảm dần theo tuổi lượt làm, recency giảm theo số ngày nghỉ, riêng nó thì
  // đứng yên. Hệ quả đo trên dữ liệu thật: người học dùng hỗ trợ 56% trong 7 ngày gần nhất vẫn
  // được chấm theo mức 31% của cả lịch sử — readiness báo 61 trong khi thực chất là 57. Chiều
  // ngược lại cũng vậy: bỏ hẳn hỗ trợ phải mất hàng tháng mới được ghi nhận.
  let assistedWeight = 0;
  let totalWeight = 0;
  for (const a of graded) {
    const w = recencyWeight(a.answeredAt, now);
    totalWeight += w;
    if (a.supportUsage?.assisted) assistedWeight += w;
  }
  const assistedRatio = totalWeight ? assistedWeight / totalWeight : 0;
  const independence = 1 - 0.25 * assistedRatio;

  const rawScore = 100 * base * coverageFactor * recency * independence;
  const score = Math.round(clamp(rawScore, 0, 100));
  const enoughData = gapProfile.eligibleAttempts >= READINESS_MIN_ATTEMPTS;
  const level = enoughData ? readinessLevelFor(score) : { key: "insufficient", ring: "insufficient_data" };

  // "Còn thiếu gì" — cụ thể, xếp theo mức ảnh hưởng, mỗi mục gắn được với một hành động.
  const reasons = [];
  if (!enoughData) {
    reasons.push({ key: "reasonVolume", vars: { n: gapProfile.eligibleAttempts } });
  }
  if (critical.length) {
    const worstDomain = [...critical].sort((a, b) => b.gapPriority - a.gapPriority)[0].domain;
    reasons.push({ key: "reasonCritical", vars: { n: critical.length, domain: worstDomain } });
  }
  if (coverage < 0.9 && untouched > 0) {
    reasons.push({ key: "reasonCoverage", vars: { p: Math.round(coverage * 100), n: untouched } });
  }
  const weakDomain = gapProfile.domains
    .filter((d) => d.mastery !== null && d.mastery < 0.7)
    .sort((a, b) => a.mastery * a.examWeight - b.mastery * b.examWeight)[0];
  if (weakDomain) {
    reasons.push({ key: "reasonDomainLow", vars: { domain: weakDomain.domain, p: Math.round(weakDomain.mastery * 100), w: Math.round(weakDomain.examWeight * 100) } });
  }
  if (assistedRatio >= 0.2) {
    reasons.push({ key: "reasonAssisted", vars: { p: Math.round(assistedRatio * 100) } });
  }
  if (idleDays >= 7 && lastAt) {
    reasons.push({ key: "reasonRecency", vars: { n: idleDays } });
  }
  if (!reasons.length) reasons.push({ key: "reasonAllGood", vars: {} });

  return {
    score, level: level.key, ring: level.ring, enoughData,
    factors: { base, coverage, coverageFactor, recency, independence, idleDays, assistedRatio },
    stats: { totalTasks, tasksWithEvidence, untouched, criticalCount: critical.length, eligibleAttempts: gapProfile.eligibleAttempts },
    reasons,
  };
}

/* Giãn cách kiểu Leitner cho CÂU HỎI, dùng lại đúng ý tưởng đã áp dụng cho từ vựng (vocabSrs):
   trả lời đúng thì lần gặp lại được đẩy xa dần, trả lời sai thì kéo về đầu. Chỉ số là số lần
   đúng LIÊN TIẾP gần nhất. Không có giãn cách thì câu sai hôm nay có thể được phục vụ lại ngay
   hôm sau — trả lời đúng ở khoảng cách 1 ngày chủ yếu đo trí nhớ ngắn hạn, làm mastery tăng ảo
   trong khi năng lực thi không đổi. */
export const QUESTION_REVIEW_INTERVAL_DAYS = [1, 3, 7, 14];

function reviewIntervalDays(box) {
  return QUESTION_REVIEW_INTERVAL_DAYS[Math.min(box, QUESTION_REVIEW_INTERVAL_DAYS.length - 1)];
}

/** Trạng thái ôn của từng câu suy từ attempts: số lần làm, chuỗi đúng liên tiếp, lần gặp cuối. */
export function buildQuestionReviewState(attempts) {
  const state = new Map();
  const sorted = attempts
    .filter(isCountableAttempt)
    .filter((a) => a.answeredAt)
    .slice()
    .sort((x, y) => new Date(x.answeredAt) - new Date(y.answeredAt));
  for (const a of sorted) {
    const cur = state.get(a.questionId) || { count: 0, streak: 0, lastAt: 0 };
    cur.count += 1;
    cur.streak = a.isCorrect ? cur.streak + 1 : 0;
    cur.lastAt = new Date(a.answeredAt).getTime() || cur.lastAt;
    state.set(a.questionId, cur);
  }
  return state;
}

/**
 * Chọn câu cho một phiên luyện GAP. Tách khỏi FillGapScreen để nút "Làm tiếp N câu" ở
 * màn Hôm nay dùng chung được — một chạm là vào bài, không bắt người dùng chọn task.
 * CHỈ ĐỌC ngân hàng câu hỏi.
 *
 * Thứ tự ưu tiên (thay cho "chưa gặp → từng sai → còn lại" trước đây):
 *   1. Câu CHƯA GẶP của những đề ĐÃ BẮT ĐẦU — học tiếp thứ đang dở, không mở thêm mặt trận mới.
 *   2. Câu cần ôn lại và ĐÃ ĐỦ GIÃN CÁCH — ưu tiên câu yếu nhất (chuỗi đúng ngắn nhất) và lâu
 *      chưa gặp nhất.
 *   3. Câu chưa gặp của đề chưa động tới — chỉ khi hai nhóm trên đã cạn.
 *   4. Câu chưa tới hạn ôn — phương án cuối, chọn câu ÍT ĐƯỢC LÀM NHẤT trước để số lần làm giữa
 *      các câu không lệch nhau.
 *
 * reservedQuizIndexes: các đề người học để dành làm thi thử — không bao giờ bị rút câu ra đây,
 * để tuần cuối vẫn còn đề nguyên vẹn làm bài kiểm tra thật.
 */
export function buildGapPracticeQuestionIds({ attempts, taskIds, size, reservedQuizIndexes = [], now = Date.now() }) {
  const answeredIds = new Set(attempts.map((a) => a.questionId));
  const review = buildQuestionReviewState(attempts);
  const taskFilter = taskIds && taskIds.length ? new Set(taskIds) : null;
  const reserved = new Set(reservedQuizIndexes);

  const startedQuizzes = new Set();
  for (const a of attempts) {
    const q = QUESTION_INDEX.get(a.questionId);
    if (q && q.quizIndex != null) startedQuizzes.add(q.quizIndex);
  }

  const pool = [];
  for (const [quizIndex, list] of QUESTIONS_BY_QUIZ) {
    if (reserved.has(quizIndex)) continue;
    for (const q of list) {
      if (q.manualReview) continue;
      if (taskFilter && !taskFilter.has(q.taskId)) continue;
      pool.push(q);
    }
  }

  const daysSince = (ts) => (ts ? (now - ts) / 86_400_000 : Infinity);
  const isDue = (st) => daysSince(st.lastAt) >= reviewIntervalDays(st.streak);

  const unseenStarted = [];
  const unseenFresh = [];
  const due = [];
  const notDue = [];
  for (const q of pool) {
    if (!answeredIds.has(q.id)) {
      (startedQuizzes.has(q.quizIndex) ? unseenStarted : unseenFresh).push(q);
      continue;
    }
    (isDue(review.get(q.id) || { streak: 0, lastAt: 0 }) ? due : notDue).push(q);
  }

  const byWeakestFirst = (a, b) => {
    const sa = review.get(a.id) || { streak: 0, lastAt: 0 };
    const sb = review.get(b.id) || { streak: 0, lastAt: 0 };
    return sa.streak - sb.streak || sa.lastAt - sb.lastAt;
  };
  const byLeastPractised = (a, b) => {
    const sa = review.get(a.id) || { count: 0, lastAt: 0 };
    const sb = review.get(b.id) || { count: 0, lastAt: 0 };
    return sa.count - sb.count || sa.lastAt - sb.lastAt;
  };

  const ordered = [
    ...shuffleArray(unseenStarted),
    ...due.sort(byWeakestFirst),
    ...shuffleArray(unseenFresh),
    ...notDue.sort(byLeastPractised),
  ];

  const seenDup = new Set();
  const picked = [];
  for (const q of ordered) {
    if (picked.length >= size) break;
    if (q.duplicateGroupId && seenDup.has(q.duplicateGroupId)) continue;
    picked.push(q);
    if (q.duplicateGroupId) seenDup.add(q.duplicateGroupId);
  }
  return picked.map((q) => q.id);
}

/* Mỗi phiên làm bài sinh ĐÚNG MỘT snapshot (xem finishSession ở App.jsx), nên hai bản có cùng
   sessionId luôn là bản sao của nhau. Giữ bản còn nguyên chi tiết (nguồn giàu nhất để chiếu
   xuống shape lưu trữ); hoà thì giữ bản sinh sau. */
function betterSnapshot(a, b) {
  if (!!a.compacted !== !!b.compacted) return a.compacted ? b : a;
  return new Date(a.generatedAt || 0) >= new Date(b.generatedAt || 0) ? a : b;
}

/* Chiếu một snapshot xuống ĐÚNG phần được đọc: diễn biến mastery từng domain theo thời gian.
   buildMasteryTrend là người đọc DUY NHẤT của gapSnapshots trong toàn app, và nó chỉ cần
   generatedAt + profile.domains[].mastery; `tasks` (24 task, kèm diagnoses) và `nextBestActions`
   không có nơi nào đọc tới — chúng chỉ là bản sao của thứ calculateGapProfile luôn tính lại từ
   attempts mỗi lần render (xem nguyên tắc ở đầu file).

   `eligibleAttempts` giữ lại vì nó nói snapshot này dựa trên bao nhiêu bằng chứng — một con số,
   và không suy ngược được từ attempts sau này.

   Vì sao snapshot vẫn phải tồn tại dù nguyên tắc chung là "không lưu bản sao tổng hợp": mastery
   có trọng số theo độ mới (recencyWeight tính theo `now`), nên mastery của ngày hôm qua KHÔNG
   dựng lại được từ attempts hôm nay. Đây là ngoại lệ duy nhất, và nó chỉ cần đúng 4 con số.

   Đo trên dữ liệu thật (129 phiên): 9.104 B/snapshot → 527 B, tức 1.147KB → 66KB. */
function compactSnapshot(s) {
  return {
    sessionId: s.sessionId,
    generatedAt: s.generatedAt,
    compacted: true,
    profile: {
      eligibleAttempts: s.profile.eligibleAttempts,
      domains: s.profile.domains,
    },
  };
}

/**
 * Chuẩn hoá danh sách gapSnapshots trước khi ghi xuống storage: khử trùng lặp theo sessionId,
 * sắp lại theo thời gian, rồi nén từng bản xuống phần thực sự được đọc (xem compactSnapshot).
 *
 * KHỬ TRÙNG LẶP là bắt buộc, không phải tối ưu: mergeProgressData() nối [...base, ...data] cho
 * gapSnapshots trong khi attempts/completedQuizzes đều được lọc theo khoá. Mỗi lần đồng bộ Drive
 * (chạy sau MỌI lần autosave) lại nối nguyên danh sách trên Drive vào danh sách cục bộ, nên số
 * snapshot nhân lên theo cấp số nhân: một máy có 129 phiên đã sinh ra 35.760 snapshot ≈ 318MB,
 * đủ để JSON.parse lúc mở app hết bộ nhớ. Đặt ngay trong hàm này để cả ba đường ghi
 * (migrateProgress, mergeProgressData, finishSession) đều được chuẩn hoá — và bản dữ liệu đã
 * phình sẵn trên máy người dùng tự lành ở lần mở app kế tiếp.
 *
 * NÉN NGAY LÚC GHI, không đợi 90 ngày như trước: phần bị bỏ đi vốn không có người đọc, nên giữ
 * nó thêm 90 ngày chỉ là trả tiền bộ nhớ cho dữ liệu chết. Bản đã nén theo shape cũ (còn 10
 * task) cũng được chiếu lại xuống shape mới thay vì bỏ qua, để dữ liệu cũ co lại luôn.
 *
 * Sắp theo generatedAt để danh sách lưu xuống (và bản xuất ra backup/Drive) luôn theo thứ tự thời
 * gian thay vì thứ tự nối của lần gộp gần nhất. buildMasteryTrend không còn phụ thuộc thứ tự này
 * (nó gom theo ngày và tự so generatedAt), nhưng một danh sách đã sắp thì diff/đọc bằng mắt được.
 */
export function compactGapSnapshots(snapshots) {
  const bySession = new Map();
  (snapshots || []).forEach((s, i) => {
    if (!s) return;
    // Snapshot không có sessionId (dữ liệu cũ/hỏng) không thể so trùng — giữ nguyên từng bản.
    const key = s.sessionId || `__anon-${i}`;
    const cur = bySession.get(key);
    bySession.set(key, cur ? betterSnapshot(s, cur) : s);
  });

  return [...bySession.values()]
    .sort((a, b) => new Date(a.generatedAt || 0) - new Date(b.generatedAt || 0))
    .map((s) => (s?.profile ? compactSnapshot(s) : s));
}
