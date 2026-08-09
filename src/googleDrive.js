/* ---------- Google Drive backup (Google Identity Services + Drive API v3) ---------- */
/* Dùng scope drive.file: app chỉ đọc/ghi được đúng file backup do chính nó tạo ra,        */
/* không đụng tới các file khác trong Drive của người dùng. Access token chỉ sống trong    */
/* bộ nhớ (không lưu localStorage) — hết hạn sau ~1h hoặc khi tải lại trang, người dùng     */
/* bấm "Kết nối" lại để cấp quyền lần nữa (yêu cầu bảo mật của OAuth phía trình duyệt).      */

const GOOGLE_CLIENT_ID = "615852282158-nm8hmbccmqiilul26oq22mktrmf6hnp3.apps.googleusercontent.com";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const BACKUP_FILE_NAME = "pmi-acp-progress-backup.json";
export const DRIVE_FILE_ID_KEY = "pmi_acp_drive_file_id";

let gisLoadPromise = null;
function loadGis() {
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("gis-load-failed"));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

let tokenClient = null;
let currentToken = null; // { access_token, expiresAt }

async function ensureTokenClient() {
  await loadGis();
  if (!tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: () => {},
    });
  }
  return tokenClient;
}

// Tải sẵn script GIS ngay khi app khởi động — nếu chờ tới lúc người dùng bấm "Kết nối" mới tải
// (script từ mạng, không đồng bộ) thì trình duyệt có thể coi cú click đã "nguội" (mất user-gesture)
// lúc requestAccessToken() thực sự chạy, và âm thầm chặn popup mà không báo lỗi gì cả.
ensureTokenClient().catch(() => {});

export function isDriveConnected() {
  return !!currentToken && currentToken.expiresAt > Date.now() + 10000;
}

export async function connectDrive({ interactive = true } = {}) {
  if (isDriveConnected()) return currentToken.access_token;
  const client = await ensureTokenClient();
  return new Promise((resolve, reject) => {
    let settled = false;
    // Lưới an toàn: nếu popup bị chặn hoàn toàn (khác với việc người dùng đang chậm tay đăng nhập),
    // Google Identity Services không gọi callback lỗi nào cả — chỉ log ra console — nên request sẽ
    // treo vĩnh viễn nếu không có timeout. 2 phút đủ rộng rãi cho một lượt đăng nhập bình thường.
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("popup-timeout"));
    }, 120000);
    client.callback = (resp) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (resp.error) { reject(new Error(resp.error)); return; }
      currentToken = { access_token: resp.access_token, expiresAt: Date.now() + (resp.expires_in ?? 3600) * 1000 };
      resolve(currentToken.access_token);
    };
    try {
      client.requestAccessToken({ prompt: interactive ? "consent" : "" });
    } catch (e) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(e);
    }
  });
}

export function disconnectDrive() {
  if (currentToken?.access_token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(currentToken.access_token, () => {});
  }
  currentToken = null;
}

async function driveFetch(url, options = {}) {
  if (!currentToken?.access_token) throw new Error("drive-not-connected");
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${currentToken.access_token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`drive-http-${res.status}: ${text.slice(0, 200)}`);
  }
  return res;
}

async function findBackupFileId() {
  const cached = localStorage.getItem(DRIVE_FILE_ID_KEY);
  if (cached) return cached;
  const q = encodeURIComponent(`name='${BACKUP_FILE_NAME}' and trashed=false`);
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive`);
  const data = await res.json();
  const file = data.files?.[0];
  if (file) {
    localStorage.setItem(DRIVE_FILE_ID_KEY, file.id);
    return file.id;
  }
  return null;
}

export async function uploadBackupToDrive(progressObj) {
  const body = JSON.stringify(progressObj);
  const fileId = await findBackupFileId();
  if (fileId) {
    await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return fileId;
  }
  const metadata = { name: BACKUP_FILE_NAME, mimeType: "application/json" };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([body], { type: "application/json" }));
  const res = await driveFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  localStorage.setItem(DRIVE_FILE_ID_KEY, data.id);
  return data.id;
}

export async function downloadBackupFromDrive() {
  const fileId = await findBackupFileId();
  if (!fileId) return null;
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
  return res.json();
}
