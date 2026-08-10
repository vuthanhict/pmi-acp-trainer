/* ===================== Pure utility helpers ===================== */
/* Hàm thuần JS, không side-effect ngoài downloadJson (tạo file tải xuống) — không import
   React hay bất kỳ module UI nào. */

/* ---------- Utilities ---------- */
export function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
export function isoNow() {
  return new Date().toISOString();
}
export function normOpt(id) {
  return String(id ?? "").toLowerCase();
}
export function setsEqual(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}
export function clamp(v, min = 0, max = 1) {
  return Math.min(max, Math.max(min, v));
}
export function mean(values) {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}
export function fmtPct(n) {
  return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : "—";
}
export function fmtDate(iso, lang) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(lang === "en" ? "en-US" : "vi-VN");
  } catch {
    return iso;
  }
}
export function fmtClock(ms) {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
/* ---------- Ngày theo múi giờ NGƯỜI HỌC (không phải UTC, không phải giờ máy) ---------- */
/* Bắt buộc: làm bài lúc 23h giờ VN mà cắt ngày theo UTC sẽ bị tính sang hôm sau, khiến   */
/* chuỗi ngày (streak) và tiến độ hôm nay sai lệch mỗi tối. Dùng Intl với timeZone của     */
/* learner; nếu môi trường không hỗ trợ thì rơi về giờ máy (vẫn tốt hơn UTC).              */
export const DEFAULT_TZ = "Asia/Ho_Chi_Minh";
const _dayKeyFmtCache = new Map();
export function dayKeyFormatter(tz) {
  if (!_dayKeyFmtCache.has(tz)) {
    let fmt;
    try {
      fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    } catch {
      fmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
    }
    _dayKeyFmtCache.set(tz, fmt);
  }
  return _dayKeyFmtCache.get(tz);
}
/** "2026-08-10" theo múi giờ tz. Trả về null nếu input không phải thời điểm hợp lệ. */
export function dayKey(dateLike, tz = DEFAULT_TZ) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (!Number.isFinite(d.getTime())) return null;
  return dayKeyFormatter(tz).format(d);
}
export function todayKey(tz = DEFAULT_TZ, now = Date.now()) {
  return dayKey(new Date(now), tz);
}
/* Cộng/trừ ngày trên chuỗi "YYYY-MM-DD". Neo vào 12:00 UTC để không bị lệch do DST. */
export function shiftDayKey(key, deltaDays) {
  const [y, m, d] = key.split("-").map(Number);
  const anchor = Date.UTC(y, m - 1, d, 12);
  return new Date(anchor + deltaDays * 86_400_000).toISOString().slice(0, 10);
}
export function diffDayKeys(a, b) {
  const toMs = (k) => {
    const [y, m, d] = k.split("-").map(Number);
    return Date.UTC(y, m - 1, d, 12);
  };
  return Math.round((toMs(a) - toMs(b)) / 86_400_000);
}
/** 0 = Chủ nhật … 6 = Thứ 7 */
export function weekdayOfDayKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}
export function fmtDayKey(key, lang) {
  if (!key) return "—";
  const [y, m, d] = key.split("-");
  return lang === "en" ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
}
export function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
