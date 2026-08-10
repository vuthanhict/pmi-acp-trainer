/* ===================== GAP / mastery scoring engine ===================== */
/* Logic thuần: tính mastery theo domain/task từ lịch sử attempts, và chấm điểm 1 attempt.
   Không import React, không đọc DOM/localStorage — chỉ nhận dữ liệu qua tham số. */
import { clamp, normOpt, setsEqual } from "./utils.js";
import { QUESTION_INDEX } from "./embeddedData.js";

export const DOMAIN_WEIGHTS = { Mindset: 0.28, Leadership: 0.25, Product: 0.19, Delivery: 0.28 };
export const CONFIDENCE_PROBABILITY = { 1: 0.35, 2: 0.5, 3: 0.65, 4: 0.8, 5: 0.95 };

/* ---------- Gap engine (port of gap-engine.mjs) ---------- */
function recencyWeight(answeredAt, now, halfLifeDays) {
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
function calibrationScoreOf(a) {
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
function diagnoseTask(rows, accuracy, speed, assistedRatio) {
  const highConfidenceWrong = rows.filter((a) => !a.isCorrect && a.confidence >= 4).length;
  const fastWrong = rows.filter((a) => !a.isCorrect && a.responseTimeMs != null && a.responseTimeMs <= (a.targetTimeMs ?? 90_000) * 0.5).length;
  const slowCorrect = rows.filter((a) => a.isCorrect && a.responseTimeMs != null && a.responseTimeMs > (a.targetTimeMs ?? 90_000) * 1.25).length;
  const changedToWrong = rows.filter((a) => !a.isCorrect && a.changedAnswer === true).length;
  const sessionCount = new Set(rows.map((a) => a.sessionId)).size;
  const reasons = [];
  if (rows.length < 5 || sessionCount < 2) reasons.push("coverage_gap");
  if (highConfidenceWrong >= 2) reasons.push("blind_spot");
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
export function calculateGapProfile({ attempts, now = Date.now(), halfLifeDays = 30 }) {
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
    const confidenceCalibration = weightedMean(rows, calibrationScoreOf, weight);
    const speed = weightedMeanAvailable(rows, speedScoreOf, weight);
    const masteryWeight = speed === null ? 0.85 : 1;
    const mastery = clamp((0.65 * accuracy + 0.2 * confidenceCalibration + (speed === null ? 0 : 0.15 * speed)) / masteryWeight);
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
      confidenceCalibration: Number(confidenceCalibration.toFixed(4)),
      speedScore: speed === null ? null : Number(speed.toFixed(4)),
      mastery: Number(mastery.toFixed(4)),
      evidence: Number(evidence.toFixed(4)),
      assistedRatio: assistedRatio === null ? null : Number(assistedRatio.toFixed(4)),
      status: statusFor(mastery, attemptsCount, sessions),
      gapPriority: Number((weaknessPriority + coveragePriority).toFixed(4)),
      diagnoses: diagnoseTask(rows, accuracy, speed, assistedRatio),
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
