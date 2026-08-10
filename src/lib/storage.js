/* ===================== Persistent storage (progress object) ===================== */
/* Lớp lưu trữ + schema/migration/merge cho object `progress` (IndexedDB ưu tiên,
   localStorage fallback). Không import React. DEFAULT_SUPPORT_USAGE nằm ở đây vì nó là
   phần của shape mặc định 1 attempt, dùng bởi ensureSupportUsage(). */
import { compactGapSnapshots } from "./trackingEngine.js";
import { loadLegacyVocabSrs } from "./vocabSrs.js";

export const DEFAULT_SUPPORT_USAGE = {
  translationOpenedBeforeAnswer: false,
  terminologyOpenedBeforeAnswer: false,
  postAnswerTranslationOpened: false,
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
export const PROGRESS_SCHEMA_VERSION = 4;

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
    settings: { theme: "light", uiLanguage: "vi", sidebarOpen: true },
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
  base.attempts = (raw.attempts || []).map(ensureSupportUsage);
  // v2 → v3: thêm nhánh `tracking`. Backup cũ không có trường này vẫn nạp bình thường,
  // chỉ là chưa đặt mục tiêu — không có bước migrate nào đụng tới attempts/completedQuizzes.
  base.tracking = { ...defaultProgress().tracking, ...(raw.tracking || {}) };
  base.gapSnapshots = compactGapSnapshots(raw.gapSnapshots || []);
  // v3 → v4: gộp SRS từ vựng vào progress để đồng bộ được (xem defaultProgress()). Nếu progress
  // đã có vocabSrs (đã migrate trước đó, hoặc phục hồi từ backup mới) thì giữ nguyên; chỉ đọc
  // từ localStorage cũ khi đây là lần đầu nâng cấp lên v4.
  base.vocabSrs = raw.vocabSrs && Object.keys(raw.vocabSrs).length ? raw.vocabSrs : loadLegacyVocabSrs();
  base.schemaVersion = PROGRESS_SCHEMA_VERSION;
  return base;
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
    settings: { ...base.settings, ...(data.settings || {}) },
  };
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
export async function loadProgressFromStorage() {
  const raw = await storage.get(PROGRESS_KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}
export async function saveProgressToStorage(progress) {
  await storage.set(PROGRESS_KEY, JSON.stringify(progress));
}
