/* ===================== Tracking engine (streak/goal/readiness/GAP-practice) ===================== */
/* Logic thuần: mọi số liệu đều tính lại từ attempts[]/completedQuizzes[]/gapSnapshots[] —
   không lưu bản sao tổng hợp (xem comment gốc bên dưới). buildGapPracticeQuestionIds nằm ở
   đây (không phải gapEngine.js) vì nó là 1 phần của luồng "Luyện GAP", dùng QUESTIONS_BY_QUIZ
   để CHỌN câu chứ không tính mastery. */
import { DEFAULT_TZ, dayKey, todayKey, shiftDayKey, diffDayKeys, weekdayOfDayKey, clamp, mean, shuffleArray } from "./utils.js";
import { QUIZ_CATALOG, QUESTIONS_BY_QUIZ } from "./embeddedData.js";

/* ===================== Tracking engine ===================== */
/* NGUYÊN TẮC THIẾT KẾ QUAN TRỌNG: mọi số liệu tracking đều được TÍNH LẠI từ `attempts[]`  */
/* và `completedQuizzes[]` — không lưu bản sao đã tổng hợp vào progress. Nhờ vậy việc merge */
/* backup từ Drive / import file / làm bài trên 2 thiết bị không bao giờ tạo ra chuỗi ngày  */
/* hay tiến độ sai. Trong progress chỉ lưu ĐÚNG hai thứ người dùng tự đặt: mục tiêu hằng    */
/* ngày và ngày thi dự kiến. Dữ liệu đề thi (QUESTION_INDEX/QUIZ_CATALOG) chỉ được ĐỌC.     */

export const GOAL_PRESETS = [10, 20, 30, 50];
export const DEFAULT_GOAL_VALUE = 20;
export const READINESS_READY_BAR = 75;   // ngưỡng thận trọng do app đặt, KHÔNG phải chuẩn PMI
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

/** Diễn biến mastery từng domain, đọc từ gapSnapshots — dữ liệu app đã ghi sẵn từ đầu. */
export function buildMasteryTrend(gapSnapshots) {
  return (gapSnapshots || [])
    .filter((s) => s?.generatedAt && s?.profile?.domains)
    .slice(-40)
    .map((s) => ({
      at: s.generatedAt,
      sessionId: s.sessionId,
      domains: Object.fromEntries(s.profile.domains.map((d) => [d.domain, d.mastery])),
    }));
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

  const assistedCount = graded.filter((a) => a.supportUsage?.assisted).length;
  const assistedRatio = graded.length ? assistedCount / graded.length : 0;
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

/**
 * Chọn câu cho một phiên luyện GAP. Tách khỏi FillGapScreen để nút "Làm tiếp N câu" ở
 * màn Hôm nay dùng chung được — một chạm là vào bài, không bắt người dùng chọn task.
 * CHỈ ĐỌC ngân hàng câu hỏi.
 */
export function buildGapPracticeQuestionIds({ attempts, taskIds, size }) {
  const answeredIds = new Set(attempts.map((a) => a.questionId));
  const wrongIds = new Set(attempts.filter((a) => a.gradeStatus === "graded" && !a.isCorrect).map((a) => a.questionId));
  const taskFilter = taskIds && taskIds.length ? new Set(taskIds) : null;

  const pool = [];
  for (const [, list] of QUESTIONS_BY_QUIZ) {
    for (const q of list) {
      if (q.manualReview) continue;
      if (taskFilter && !taskFilter.has(q.taskId)) continue;
      pool.push(q);
    }
  }
  const unseen = pool.filter((q) => !answeredIds.has(q.id));
  const needReview = pool.filter((q) => wrongIds.has(q.id));
  const rest = pool.filter((q) => answeredIds.has(q.id) && !wrongIds.has(q.id));
  const ordered = [...shuffleArray(unseen), ...shuffleArray(needReview), ...shuffleArray(rest)];

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

/**
 * Nén gapSnapshots cũ hơn 90 ngày: giữ lại phần domains + 10 task ưu tiên nhất, bỏ phần
 * chi tiết hàng trăm task. Snapshot đầy đủ nặng ~40KB, sau 100 phiên là 4MB — vượt hạn
 * mức localStorage và làm chậm mọi lần lưu.
 */
export function compactGapSnapshots(snapshots, now = Date.now()) {
  const cutoff = now - 90 * 86_400_000;
  return (snapshots || []).map((s) => {
    if (!s?.profile || s.compacted) return s;
    const at = new Date(s.generatedAt || 0).getTime();
    if (!at || at >= cutoff) return s;
    return {
      sessionId: s.sessionId,
      generatedAt: s.generatedAt,
      compacted: true,
      profile: {
        generatedAt: s.profile.generatedAt,
        eligibleAttempts: s.profile.eligibleAttempts,
        domains: s.profile.domains,
        tasks: (s.profile.tasks || []).slice(0, 10),
        nextBestActions: s.profile.nextBestActions || [],
      },
    };
  });
}
