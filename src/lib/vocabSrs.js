/* ===================== Vocabulary spaced-repetition drill ===================== */
/* Leitner-style SRS: mỗi thẻ có 1 "box" (1-6). Trả lời đúng -> lên box tiếp theo, khoảng cách  */
/* ôn lại giãn ra; trả lời sai -> rớt về box 1, ôn lại ngay. Thẻ "đến hạn" (due) là thẻ chưa ôn  */
/* lần nào hoặc đã qua ngày hẹn ôn lại — đây là những thẻ được ưu tiên đưa vào phiên học.        */
const VOCAB_KNOWN_KEY = "pmi_acp_vocab_known";
const VOCAB_SRS_KEY = "pmi_acp_vocab_srs";
export const SRS_INTERVAL_DAYS = [0, 1, 3, 7, 16, 35];
const SRS_MAX_BOX = SRS_INTERVAL_DAYS.length;

/* Đọc SRS từ localStorage đời cũ (trước schema v4, khi dữ liệu này chưa nằm trong progress) —
   chỉ dùng một lần bởi migrateProgress() để không mất tiến độ ôn từ vựng của người dùng cũ. */
export function loadLegacyVocabSrs() {
  try {
    const raw = localStorage.getItem(VOCAB_SRS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* rơi xuống migrate bên dưới */ }
  try {
    const oldKnown = JSON.parse(localStorage.getItem(VOCAB_KNOWN_KEY) || "[]");
    const migrated = {};
    const dueAt = new Date(Date.now() + SRS_INTERVAL_DAYS[2] * 86400000).toISOString();
    for (const id of oldKnown) migrated[id] = { box: 3, dueAt, reviewCount: 1 };
    return migrated;
  } catch (e) {
    return {};
  }
}
export function isSrsDue(record, now) {
  if (!record || !record.dueAt) return true;
  return new Date(record.dueAt).getTime() <= now;
}
export function nextSrsRecord(record, correct, now) {
  const prevBox = record?.box || 0;
  const box = correct ? Math.min(prevBox + 1, SRS_MAX_BOX) : 1;
  const days = SRS_INTERVAL_DAYS[box - 1];
  const dueAt = days === 0 ? null : new Date(now + days * 86400000).toISOString();
  return { box, dueAt, reviewCount: (record?.reviewCount || 0) + 1, lastResult: correct ? "known" : "unknown" };
}
export function termHeadword(tm) {
  return (tm.sourceTerms && tm.sourceTerms[0]) || tm.termVi;
}
export function normalizeAnswer(s) {
  return s.trim().toLowerCase().replace(/[.,!?'"()]/g, "").replace(/\s+/g, " ");
}
export function isAnswerCorrect(tm, raw) {
  const norm = normalizeAnswer(raw);
  if (!norm) return false;
  const candidates = [tm.termVi, ...(tm.sourceTerms || [])].filter(Boolean).map(normalizeAnswer);
  return candidates.includes(norm);
}
