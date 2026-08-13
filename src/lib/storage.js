/* ===================== Persistent storage (progress object) ===================== */
/* Lớp lưu trữ + schema/migration/merge cho object `progress` (IndexedDB ưu tiên,
   localStorage fallback). Không import React. DEFAULT_SUPPORT_USAGE nằm ở đây vì nó là
   phần của shape mặc định 1 attempt, dùng bởi ensureSupportUsage(). */
import { compactGapSnapshots } from "./trackingEngine.js";
import { loadLegacyVocabSrs } from "./vocabSrs.js";
import { attemptIsTrusted, computeSessionScores } from "./sessionScore.js";
import { gradeAttempt } from "./gapEngine.js";
import { QUESTION_INDEX } from "./embeddedData.js";

export const DEFAULT_SUPPORT_USAGE = {
  translationOpenedBeforeAnswer: false,
  terminologyOpenedBeforeAnswer: false,
  postAnswerTranslationOpened: false,
  // Mở bảng từ vựng của câu TRƯỚC khi trả lời. Ghi nhận riêng, KHÔNG gộp vào `assisted` ở chế độ
  // Practice/Fill-gap: tra nghĩa một từ tiếng Anh không phải là gợi ý nội dung, và nếu phạt điểm
  // thì người học sẽ né tính năng — đúng ngược lại mục đích của nó. Ở chế độ Exam thì có tính,
  // vì thi thật không có từ điển (xem vocabCountsAsAssisted trong QuizRunner).
  vocabOpenedBeforeAnswer: false,
  assisted: false,
};

/* ---------- Persistent storage (IndexedDB, localStorage fallback) ---------- */
/* Ưu tiên IndexedDB (hạn mức lớn, hoạt động ổn định trên Chrome/Edge/Firefox/Safari kể cả  */
/* iOS/Android); nếu trình duyệt chặn IndexedDB (chế độ ẩn danh nghiêm ngặt, cài đặt riêng   */
/* tư…) thì rơi về localStorage; nếu cả hai đều bị chặn, storageOk=false và app vẫn chạy     */
/* bình thường trong bộ nhớ phiên, người dùng có thể tự lưu qua Xuất/Khôi phục backup.       */
const IDB_NAME = "pmi_acp_trainer";
const IDB_STORE = "kv";

function openIdb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("no-indexeddb")); return; }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(IDB_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("idb-open-failed"));
  });
}
function idbGet(key) {
  return openIdb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error || new Error("idb-get-failed"));
  }));
}
function idbSet(key, value) {
  return openIdb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("idb-set-failed"));
  }));
}
let idbUsable = null;
async function checkIdbUsable() {
  if (idbUsable !== null) return idbUsable;
  try {
    await idbSet("__probe__", "1");
    idbUsable = true;
  } catch (e) {
    idbUsable = false;
  }
  return idbUsable;
}
const storage = {
  async get(key) {
    if (await checkIdbUsable()) {
      try { return await idbGet(key); } catch (e) { /* rơi về localStorage bên dưới */ }
    }
    return localStorage.getItem(key);
  },
  async set(key, value) {
    let ok = false;
    if (await checkIdbUsable()) {
      try { await idbSet(key, value); ok = true; } catch (e) { /* thử localStorage bên dưới */ }
    }
    try {
      localStorage.setItem(key, value);
      ok = true;
    } catch (e) { /* localStorage cũng bị chặn (vd. Safari private mode cũ) */ }
    if (!ok) throw new Error("storage-unavailable");
  },
};

const PROGRESS_KEY = "progress";
export const PROGRESS_SCHEMA_VERSION = 6;

export function defaultProgress() {
  return {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    learner: { displayName: "", timezone: "Asia/Ho_Chi_Minh" },
    plan: { id: "pmi-acp-core-2024", currentStageId: "pmi-practice-exam", recommendedNextQuizIndex: 88 },
    completedQuizzes: [],
    activeSession: null,
    attempts: [],
    gapSnapshots: [],
    // Chỉ lưu thứ người dùng TỰ ĐẶT. Lịch sử ngày, chuỗi ngày, readiness đều được tính lại
    // từ attempts mỗi lần render — xem chú thích ở đầu "Tracking engine".
    tracking: { dailyGoal: null, examDate: null },
    // Tiến độ ôn từ vựng (spaced repetition) — key theo termId, xem nextSrsRecord().
    // Trước schema v4, dữ liệu này nằm ở localStorage riêng (VOCAB_SRS_KEY), không đồng bộ
    // được qua export/import/Drive — migrateProgress() sẽ gộp dữ liệu cũ vào đây một lần.
    vocabSrs: {},
    // Bộ thẻ người dùng TỰ LƯU khi đang làm bài — key theo termId, value ghi lại lưu lúc nào và
    // lưu từ câu nào. Tách riêng khỏi vocabSrs vì hai thứ trả lời hai câu hỏi khác nhau: "tôi
    // muốn học thẻ này" (saved) và "tôi đã thuộc tới đâu" (srs). Một thẻ có thể có srs mà chưa
    // từng được lưu (ôn ở màn Ôn từ vựng), hoặc được lưu mà chưa ôn lần nào.
    vocabSaved: {},
    // Đề người học để dành làm bài kiểm tra thật ở tuần cuối: luyện GAP không bao giờ rút câu
    // từ những đề này, để chúng còn nguyên vẹn khi cần một phép đo sạch (xem
    // buildGapPracticeQuestionIds).
    settings: { theme: "light", uiLanguage: "vi", sidebarOpen: true, reservedQuizIndexes: [] },
    updatedAt: null,
  };
}
export function ensureSupportUsage(attempt) {
  if (attempt.supportUsage) {
    return { ...attempt, supportUsage: { ...DEFAULT_SUPPORT_USAGE, ...attempt.supportUsage } };
  }
  return { ...attempt, supportUsage: { ...DEFAULT_SUPPORT_USAGE } };
}
export function migrateProgress(raw) {
  const base = { ...defaultProgress(), ...raw, settings: { ...defaultProgress().settings, ...(raw.settings || {}) } };
  base.settings.reservedQuizIndexes = Array.isArray(base.settings.reservedQuizIndexes) ? base.settings.reservedQuizIndexes : [];
  base.attempts = (raw.attempts || []).map(ensureSupportUsage);
  // v2 → v3: thêm nhánh `tracking`. Backup cũ không có trường này vẫn nạp bình thường,
  // chỉ là chưa đặt mục tiêu — không có bước migrate nào đụng tới attempts/completedQuizzes.
  base.tracking = { ...defaultProgress().tracking, ...(raw.tracking || {}) };
  base.gapSnapshots = compactGapSnapshots(raw.gapSnapshots || []);
  // v3 → v4: gộp SRS từ vựng vào progress để đồng bộ được (xem defaultProgress()). Nếu progress
  // đã có vocabSrs (đã migrate trước đó, hoặc phục hồi từ backup mới) thì giữ nguyên; chỉ đọc
  // từ localStorage cũ khi đây là lần đầu nâng cấp lên v4.
  base.vocabSrs = raw.vocabSrs && Object.keys(raw.vocabSrs).length ? raw.vocabSrs : loadLegacyVocabSrs();
  // v4 → v5: thêm `vocabSaved` (bộ thẻ tự lưu khi làm bài). Backup cũ không có trường này nạp
  // bình thường, chỉ là bộ tự lưu rỗng — không đụng tới vocabSrs đã có.
  base.vocabSaved = raw.vocabSaved || {};
  // v5 → v6: tính lại điểm của các lần làm bài đã lưu (xem recomputeCompletedScores). Chạy ở MỌI
  // lần nạp chứ không chỉ khi nâng cấp version: ngân hàng câu hỏi được sửa dần (phân loại lại
  // domain/task, sửa đáp án), và một bản backup cũ nạp vào máy đã migrate rồi vẫn cần tính lại.
  Object.assign(base, recomputeCompletedScores(base.attempts, base.completedQuizzes));
  base.schemaVersion = PROGRESS_SCHEMA_VERSION;
  return base;
}
/* Tính lại rawScore/trustedScore/independentScore/firstExposureScore của mọi lần làm bài đã lưu,
   từ attempts + ngân hàng câu hỏi HIỆN TẠI.

   Vì sao cần: điểm được chốt một lần lúc nộp bài và không bao giờ được tính lại. Đề SUPER 1 (quiz
   89/90) từng được nhúng vào khi chưa phân loại domain/task ECO, nên mọi câu có eligibleForGap =
   false → trustedScore = 0/0 → màn Results và Lịch sử hiển thị 0% dù người học làm đúng quá nửa.
   Sau khi phân loại (tools/classifySuper1.mjs), điểm cũ vẫn kẹt ở 0 nếu không tính lại.

   Cờ eligibleForGap đóng băng trong từng attempt cũng được làm mới theo ngân hàng hiện tại, để dữ
   liệu xuất ra (backup/Drive) không còn mang cờ sai. Câu trả lời đang treo ở trạng thái
   "manual_review" được chấm lại nếu câu hỏi nay đã chấm tự động được (44 câu bị gắn nhầm cờ
   manualReview chỉ vì chưa phân loại — xem tools/classifyRemaining.mjs); ngoài trường hợp đó thì
   isCorrect/gradeStatus giữ nguyên, vì đó là điều người học đã thực sự làm. */
export function recomputeCompletedScores(attempts, completedQuizzes) {
  const freshAttempts = attempts.map((raw) => {
    let a = raw;
    if (a.gradeStatus === "manual_review") {
      const question = QUESTION_INDEX.get(a.questionId);
      if (question && !question.manualReview) a = { ...a, ...gradeAttempt(question, a.selectedOptionIds) };
    }
    const trusted = attemptIsTrusted(a);
    return trusted === a.eligibleForGap ? a : { ...a, eligibleForGap: trusted };
  });

  const bySession = new Map();
  for (const a of freshAttempts) {
    if (!bySession.has(a.sessionId)) bySession.set(a.sessionId, []);
    bySession.get(a.sessionId).push(a);
  }

  const freshCompleted = completedQuizzes.map((entry) => {
    const sessionAttempts = bySession.get(entry.sessionId);
    if (!sessionAttempts?.length) return entry; // lần làm không còn attempt nào — giữ nguyên số cũ
    // "Đã gặp trước đó" phải tính theo MỐC THỜI GIAN của lần làm này, không phải toàn bộ lịch sử:
    // nếu không, các lần làm cũ sẽ bị coi là đã gặp câu hỏi ở những lần làm SAU chúng.
    const cutoff = new Date(entry.completedAt ?? 0).getTime() || Infinity;
    const seenBefore = new Set(
      freshAttempts
        .filter((a) => a.sessionId !== entry.sessionId && new Date(a.answeredAt ?? 0).getTime() < cutoff)
        .map((a) => a.questionId),
    );
    return { ...entry, ...computeSessionScores(sessionAttempts, seenBefore) };
  });

  return { attempts: freshAttempts, completedQuizzes: freshCompleted };
}
export function mergeProgressData(base, data) {
  const existingKeys = new Set(base.attempts.map((a) => `${a.sessionId}::${a.questionId}`));
  const newAttempts = (data.attempts || []).filter((a) => !existingKeys.has(`${a.sessionId}::${a.questionId}`)).map(ensureSupportUsage);
  const existingCompleted = new Set(base.completedQuizzes.map((c) => c.sessionId));
  const newCompleted = (data.completedQuizzes || []).filter((c) => !existingCompleted.has(c.sessionId));
  const merged = {
    ...base,
    attempts: [...base.attempts, ...newAttempts],
    completedQuizzes: [...base.completedQuizzes, ...newCompleted],
    gapSnapshots: compactGapSnapshots([...base.gapSnapshots, ...(data.gapSnapshots || [])]),
    activeSession: base.activeSession || data.activeSession || null,
    // Mục tiêu/ngày thi của máy hiện tại được ưu tiên giữ; chỉ lấy từ file nếu máy này chưa đặt.
    tracking: {
      dailyGoal: base.tracking?.dailyGoal ?? data.tracking?.dailyGoal ?? null,
      examDate: base.tracking?.examDate ?? data.tracking?.examDate ?? null,
    },
    vocabSrs: mergeVocabSrs(base.vocabSrs, data.vocabSrs),
    // Bộ thẻ tự lưu là hợp của 2 nguồn — giữ lần lưu SỚM NHẤT của mỗi thẻ để "lưu từ câu nào"
    // vẫn trỏ đúng về câu hỏi đầu tiên khiến người học muốn học từ đó.
    vocabSaved: mergeVocabSaved(base.vocabSaved, data.vocabSaved),
    settings: { ...base.settings, ...(data.settings || {}) },
  };
  // Lần làm bài đến từ máy khác/bản backup cũ mang điểm chốt theo ngân hàng lúc đó — tính lại
  // theo ngân hàng hiện tại, giống hệt đường nạp qua migrateProgress().
  Object.assign(merged, recomputeCompletedScores(merged.attempts, merged.completedQuizzes));
  return { merged, addedCount: newAttempts.length };
}
/* Gộp SRS từ vựng của 2 nguồn theo từng thẻ — giữ bản "học nhiều/thuộc kỹ hơn" (reviewCount cao
   hơn, hoà thì box cao hơn) thay vì luôn ưu tiên 1 phía, để merge từ nhiều thiết bị không bao
   giờ làm lùi tiến độ đã đạt được ở thiết bị kia. */
export function mergeVocabSrs(base, incoming) {
  const merged = { ...(base || {}) };
  for (const [id, rec] of Object.entries(incoming || {})) {
    const cur = merged[id];
    if (!cur) { merged[id] = rec; continue; }
    const curScore = (cur.reviewCount || 0) * 100 + (cur.box || 0);
    const recScore = (rec.reviewCount || 0) * 100 + (rec.box || 0);
    if (recScore > curScore) merged[id] = rec;
  }
  return merged;
}
export function mergeVocabSaved(base, incoming) {
  const merged = { ...(base || {}) };
  for (const [id, rec] of Object.entries(incoming || {})) {
    const cur = merged[id];
    if (!cur || (rec.savedAt || "") < (cur.savedAt || "")) merged[id] = rec;
  }
  return merged;
}
export async function loadProgressFromStorage() {
  const raw = await storage.get(PROGRESS_KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}
export async function saveProgressToStorage(progress) {
  await storage.set(PROGRESS_KEY, JSON.stringify(progress));
}
