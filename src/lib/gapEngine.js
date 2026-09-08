/* ===================== GAP / mastery scoring engine ===================== */
/* Logic thuần: tính mastery theo domain/task từ lịch sử attempts, và chấm điểm 1 attempt.
   Không import React, không đọc DOM/localStorage — chỉ nhận dữ liệu qua tham số. */
import { clamp, normOpt, setsEqual } from "./utils.js";
import { QUESTION_INDEX } from "./embeddedData.js";

export const DOMAIN_WEIGHTS = { Mindset: 0.28, Leadership: 0.25, Product: 0.19, Delivery: 0.28 };
export const CONFIDENCE_PROBABILITY = { 1: 0.35, 2: 0.5, 3: 0.65, 4: 0.8, 5: 0.95 };
/* Trọng số các số hạng của mastery. Số hạng nào không có dữ liệu thì bị loại và phần còn lại
   được chuẩn hoá lại (xem calculateGapProfile) — nên đây là tỉ lệ tương đối, không phải một tổng
   bắt buộc bằng 1. */
export const MASTERY_W_ACCURACY = 0.65;
export const MASTERY_W_CALIBRATION = 0.2;
export const MASTERY_W_SPEED = 0.15;
/* Số hạng hiệu chuẩn chỉ được tham gia khi có ĐỦ BẰNG CHỨNG: ít nhất 5 lượt ghi độ tự tin và
   chiếm ít nhất 20% số lượt của task. Không có chốt này thì một task 64 lượt mà đúng 1 lượt có
   ghi độ tự tin sẽ để lượt đó quyết định 20% mastery của cả task (đo trên dữ liệu thật: D7 +0,05
   mastery từ 1/64 lượt). Ngưỡng 5 mẫu dùng lại đúng quy ước của buildAccuracyTrend. */
export const MASTERY_MIN_CALIBRATION_ROWS = 5;
export const MASTERY_MIN_CALIBRATION_SHARE = 0.2;

/* ---------- Gap engine (port of gap-engine.mjs) ---------- */
/* Nửa đời của trọng số độ mới: một lượt làm cách đây 30 ngày chỉ còn nói được một nửa so với
   lượt hôm nay. Xuất ra ngoài để computeReadiness dùng CHUNG một nhịp quên với mastery — trước
   đây hệ số independence là trung bình cộng phẳng toàn lịch sử, nên nó là hệ số duy nhất của
   readiness không nhìn theo thời gian. */
export const MASTERY_HALF_LIFE_DAYS = 30;

export function recencyWeight(answeredAt, now, halfLifeDays = MASTERY_HALF_LIFE_DAYS) {
  if (!answeredAt) return 1;
  const ageDays = Math.max(0, (now - new Date(answeredAt).getTime()) / 86_400_000);
  return 0.5 ** (ageDays / halfLifeDays);
}
function weightedMean(rows, valueFn, weightFn) {
  const totalWeight = rows.reduce((s, r) => s + weightFn(r), 0);
  if (!totalWeight) return 0;
  return rows.reduce((s, r) => s + valueFn(r) * weightFn(r), 0) / totalWeight;
}
function weightedMeanAvailable(rows, valueFn, weightFn) {
  const available = rows.map((r) => ({ r, v: valueFn(r) })).filter(({ v }) => Number.isFinite(v));
  if (!available.length) return null;
  const totalWeight = available.reduce((s, { r }) => s + weightFn(r), 0);
  if (!totalWeight) return null;
  return available.reduce((s, { r, v }) => s + v * weightFn(r), 0) / totalWeight;
}
function speedScoreOf(a) {
  if (!Number.isFinite(a.responseTimeMs) || a.responseTimeMs <= 0) return null;
  if (!a.isCorrect) return 0;
  const targetMs = a.targetTimeMs ?? 90_000;
  const ratio = Math.max(0.1, a.responseTimeMs / targetMs);
  return ratio <= 1 ? 1 : clamp(1 / ratio);
}
/* null khi lượt làm KHÔNG ghi độ tự tin — không thay bằng một giá trị giả định.
   Bản trước rơi về hằng số 0.65 cho mọi lượt thiếu dữ liệu, mà ô chọn độ tự tin là tuỳ chọn và
   có sẵn nút "Không ghi nhận": trên dữ liệu thật 1457/1471 lượt (99,05%) là null. Với hằng số
   đó, calibration = 1 − (0.65 − outcome)² chỉ nhận đúng hai giá trị (0.8775 khi đúng, 0.5775
   khi sai), nên trung bình của nó là 0.5775 + 0.30 × accuracy — một hàm bậc nhất của accuracy,
   không thêm một mẩu thông tin nào. Nó vẫn chiếm 20% công thức mastery, và vì luôn dương nên
   kéo theo một cái SÀN: task sai 100% vẫn ra mastery 11,6–13,6% thay vì 0.
   Thẻ GAP hiển thị nó cạnh "Độ chính xác" như một phép đo riêng, trong khi đó chỉ là độ chính
   xác đổi thang. */
function calibrationScoreOf(a) {
  if (a.confidence == null) return null;
  const confidence = CONFIDENCE_PROBABILITY[a.confidence] ?? 0.65;
  const outcome = a.isCorrect ? 1 : 0;
  return clamp(1 - (confidence - outcome) ** 2);
}
function recentWrongStreak(rows) {
  const sorted = [...rows].sort((a, b) => new Date(b.answeredAt ?? 0) - new Date(a.answeredAt ?? 0));
  let streak = 0;
  for (const r of sorted) {
    if (r.isCorrect) break;
    streak += 1;
  }
  return streak;
}
function diagnoseTask(rows, accuracy, speed, assistedRatio, hasCalibrationEvidence) {
  const highConfidenceWrong = rows.filter((a) => !a.isCorrect && a.confidence >= 4).length;
  const fastWrong = rows.filter((a) => !a.isCorrect && a.responseTimeMs != null && a.responseTimeMs <= (a.targetTimeMs ?? 90_000) * 0.5).length;
  const slowCorrect = rows.filter((a) => a.isCorrect && a.responseTimeMs != null && a.responseTimeMs > (a.targetTimeMs ?? 90_000) * 1.25).length;
  const changedToWrong = rows.filter((a) => !a.isCorrect && a.changedAnswer === true).length;
  const sessionCount = new Set(rows.map((a) => a.sessionId)).size;
  const reasons = [];
  if (rows.length < 5 || sessionCount < 2) reasons.push("coverage_gap");
  // Cùng chốt bằng chứng với số hạng hiệu chuẩn: "tự tin nhưng sai" rút ra từ 3/91 lượt có ghi
  // độ tự tin thì không phải một kết luận, mà chip lại hiện ngang hàng với concept_gap vốn dựa
  // trên toàn bộ lượt làm.
  if (hasCalibrationEvidence && highConfidenceWrong >= 2) reasons.push("blind_spot");
  if (fastWrong >= 2) reasons.push("reading_or_mindset_trap");
  if (speed !== null && accuracy >= 0.7 && speed < 0.65 && slowCorrect >= 2) reasons.push("fluency_gap");
  if (changedToWrong >= 2) reasons.push("answer_change_risk");
  if (rows.length >= 5 && accuracy < 0.7) reasons.push("concept_gap");
  if (rows.length >= 5 && sessionCount >= 2 && assistedRatio !== null && assistedRatio >= 0.6) reasons.push("language_gap_candidate");
  return reasons;
}
function statusFor(mastery, attempts, sessions) {
  if (attempts < 5 || sessions < 2) return "insufficient_data";
  if (mastery < 0.55) return "critical";
  if (mastery < 0.7) return "needs_work";
  if (mastery < 0.8) return "developing";
  return "ready";
}
export function calculateGapProfile({ attempts, now = Date.now(), halfLifeDays = MASTERY_HALF_LIFE_DAYS }) {
  const eligible = attempts.flatMap((attempt) => {
    const question = QUESTION_INDEX.get(attempt.questionId);
    if (!question || question.manualReview) return [];
    const { domain, taskId, taskName } = question;
    if (!domain || !taskId || domain === "Unclassified") return [];
    if (attempt.gradeStatus !== "graded") return [];
    return [{ ...attempt, domain, taskId, taskName, targetTimeMs: 90_000 }];
  });

  const groups = new Map();
  for (const row of eligible) {
    if (!groups.has(row.taskId)) groups.set(row.taskId, []);
    groups.get(row.taskId).push(row);
  }

  // Danh mục ĐẦY ĐỦ các task có trong ngân hàng câu hỏi — không chỉ những task đã có lượt làm.
  // Nếu chỉ duyệt qua `groups` (suy ra từ attempts) thì task nào 0 lượt làm sẽ biến mất hoàn
  // toàn khỏi GAP thay vì được đánh dấu là gap nặng nhất (chưa có dữ liệu gì để đánh giá).
  const knownTasks = new Map();
  for (const q of QUESTION_INDEX.values()) {
    if (q.manualReview || !q.domain || !q.taskId || q.domain === "Unclassified") continue;
    if (!knownTasks.has(q.taskId)) knownTasks.set(q.taskId, { domain: q.domain, taskName: q.taskName });
  }
  for (const taskId of groups.keys()) knownTasks.delete(taskId); // đã có rows, xử lý ở nhánh dưới

  const attemptedTasks = [...groups.entries()].map(([taskId, rows]) => {
    const weight = (row) => recencyWeight(row.answeredAt, now, halfLifeDays);
    const accuracy = weightedMean(rows, (r) => Number(r.isCorrect), weight);
    const calibratedRows = rows.filter((r) => r.confidence != null);
    const hasCalibrationEvidence = calibratedRows.length >= MASTERY_MIN_CALIBRATION_ROWS
      && calibratedRows.length >= rows.length * MASTERY_MIN_CALIBRATION_SHARE;
    const confidenceCalibration = hasCalibrationEvidence ? weightedMeanAvailable(rows, calibrationScoreOf, weight) : null;
    const speed = weightedMeanAvailable(rows, speedScoreOf, weight);
    // Chỉ những số hạng CÓ dữ liệu mới tham gia, rồi chuẩn hoá lại theo tổng trọng số của chúng —
    // tổng quát hoá đúng mẹo `masteryWeight = 0.85` mà bản trước đã dùng riêng cho `speed`, nay
    // áp cho cả `confidenceCalibration`. Nhờ vậy thang mastery luôn chạy đủ 0–1 dù thiếu số hạng
    // nào: task không ghi độ tự tin và không đo được tốc độ thì mastery = accuracy, đúng nghĩa.
    const parts = [[MASTERY_W_ACCURACY, accuracy]];
    if (confidenceCalibration !== null) parts.push([MASTERY_W_CALIBRATION, confidenceCalibration]);
    if (speed !== null) parts.push([MASTERY_W_SPEED, speed]);
    const masteryWeight = parts.reduce((s, [w]) => s + w, 0);
    const mastery = clamp(parts.reduce((s, [w, v]) => s + w * v, 0) / masteryWeight);
    const attemptsCount = rows.length;
    const distinctQuestions = new Set(rows.map((r) => r.questionId)).size;
    const sessions = new Set(rows.map((r) => r.sessionId)).size;
    const evidence = Math.min(1, distinctQuestions / 8) * Math.min(1, sessions / 2);
    const recurrenceFactor = 1 + Math.min(0.5, recentWrongStreak(rows) * 0.1);
    const domain = rows[0].domain;
    const examWeight = DOMAIN_WEIGHTS[domain] ?? 0;
    const weaknessPriority = examWeight * evidence * (1 - mastery) * recurrenceFactor;
    const coveragePriority = examWeight * (1 - evidence) * 0.3;
    const assistedRows = rows.filter((r) => r.supportUsage?.assisted);
    const assistedRatio = rows.length ? assistedRows.length / rows.length : null;
    return {
      domain,
      taskId,
      taskName: rows[0].taskName,
      attempts: attemptsCount,
      distinctQuestions,
      sessions,
      accuracy: Number(accuracy.toFixed(4)),
      confidenceCalibration: confidenceCalibration === null ? null : Number(confidenceCalibration.toFixed(4)),
      speedScore: speed === null ? null : Number(speed.toFixed(4)),
      mastery: Number(mastery.toFixed(4)),
      evidence: Number(evidence.toFixed(4)),
      assistedRatio: assistedRatio === null ? null : Number(assistedRatio.toFixed(4)),
      status: statusFor(mastery, attemptsCount, sessions),
      gapPriority: Number((weaknessPriority + coveragePriority).toFixed(4)),
      diagnoses: diagnoseTask(rows, accuracy, speed, assistedRatio, hasCalibrationEvidence),
    };
  });

  // Task chưa từng làm: coi là gap ưu tiên cao (hệ số 0.5, cao hơn mức "thiếu bằng chứng" 0.3
  // dành cho task đã có vài lượt làm) — thay vì im lặng biến mất khỏi danh sách như trước.
  const untouchedTasks = [...knownTasks.entries()].map(([taskId, info]) => {
    const examWeight = DOMAIN_WEIGHTS[info.domain] ?? 0;
    return {
      domain: info.domain,
      taskId,
      taskName: info.taskName,
      attempts: 0,
      distinctQuestions: 0,
      sessions: 0,
      accuracy: null,
      confidenceCalibration: null,
      speedScore: null,
      mastery: null,
      evidence: 0,
      assistedRatio: null,
      status: "insufficient_data",
      gapPriority: Number((examWeight * 0.5).toFixed(4)),
      diagnoses: ["coverage_gap"],
    };
  });

  const tasks = [...attemptedTasks, ...untouchedTasks].sort((a, b) => b.gapPriority - a.gapPriority);

  const domains = Object.keys(DOMAIN_WEIGHTS).map((domain) => {
    const domainTasks = tasks.filter((t) => t.domain === domain);
    const evidenceTotal = domainTasks.reduce((s, t) => s + t.evidence, 0);
    const mastery = evidenceTotal ? domainTasks.reduce((s, t) => s + t.mastery * t.evidence, 0) / evidenceTotal : null;
    return {
      domain,
      examWeight: DOMAIN_WEIGHTS[domain],
      mastery: mastery === null ? null : Number(mastery.toFixed(4)),
      attempts: domainTasks.reduce((s, t) => s + t.attempts, 0),
      tasksWithEvidence: domainTasks.filter((t) => t.status !== "insufficient_data").length,
    };
  });

  return {
    generatedAt: new Date(now).toISOString(),
    eligibleAttempts: eligible.length,
    excludedAttempts: attempts.length - eligible.length,
    domains,
    tasks,
    nextBestActions: tasks.slice(0, 5).map((t) => ({
      taskId: t.taskId,
      taskName: t.taskName,
      priority: t.gapPriority,
      recommendedQuestionCount: t.status === "insufficient_data" ? 5 : 8,
      diagnoses: t.diagnoses,
    })),
  };
}

/* ---------- Grading ---------- */
export function gradeAttempt(question, selectedOptionIds) {
  if (!question || question.manualReview) {
    return { isCorrect: null, gradeStatus: "manual_review", eligibleForGap: false };
  }
  const sel = (selectedOptionIds || []).map(normOpt);
  const correct = (question.correctOptionIds || []).map(normOpt);
  const isCorrect = setsEqual(sel, correct);
  return { isCorrect, gradeStatus: "graded", eligibleForGap: question.eligibleForGap };
}
