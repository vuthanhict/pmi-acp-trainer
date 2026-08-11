import { useState, useRef } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { useIsDesktop } from "../../hooks/useViewport.js";
import { downloadJson, fmtDate } from "../../lib/utils.js";
import { mergeProgressData, defaultProgress } from "../../lib/storage.js";
import { Card, Button, Icon } from "../../components/ui/primitives.jsx";

const DRIVE_ERROR_I18N_KEY = {
  "popup-timeout": "driveErrorPopupTimeout",
  popup_closed: "driveErrorPopupClosed",
  popup_closed_by_user: "driveErrorPopupClosed",
  access_denied: "driveErrorDenied",
};

/* ===================== Data & Backup Screen ===================== */
export function DataScreen({
  progress, persist, showToast, theme, lang, setTheme, setLang,
  driveConnected, driveBusy, driveError, driveAutoBackup, driveLastSync, driveFileMeta,
  driveConnectNow, driveBackupNow, driveRestoreNow, driveToggleAuto, driveDisconnectNow,
}) {
  const { t } = useAppCtx();
  const isDesktop = useIsDesktop();
  const [resetConfirm, setResetConfirm] = useState("");
  const [showReset, setShowReset] = useState(false);
  const fileRef = useRef(null);
  const backupRef = useRef(null);

  function exportProgress() {
    downloadJson(`pmi-acp-progress-${Date.now()}.json`, {
      schemaVersion: progress.schemaVersion, settings: progress.settings, attempts: progress.attempts,
      completedQuizzes: progress.completedQuizzes, activeSession: progress.activeSession, gapSnapshots: progress.gapSnapshots,
      tracking: progress.tracking, vocabSrs: progress.vocabSrs, vocabSaved: progress.vocabSaved,
    });
    showToast(t("exportProgress"));
  }
  function exportFull() {
    downloadJson(`pmi-acp-full-backup-${Date.now()}.json`, progress);
    showToast(t("exportBackup"));
  }
  function mergeImport(data) {
    const { merged, addedCount } = mergeProgressData(progress, data);
    persist(merged);
    showToast(`+${addedCount}`);
  }
  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { mergeImport(JSON.parse(reader.result)); } catch (err) { showToast("!"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }
  function doReset() {
    if (resetConfirm !== "RESET") return;
    persist(defaultProgress());
    setShowReset(false);
    setResetConfirm("");
    showToast(t("resetBtn"));
  }

  return (
    <div className={`pt-1 pb-4 ${isDesktop ? "grid grid-cols-2 gap-4 items-start" : "space-y-4"}`}>
      <Card>
        <p className="pmi-eyebrow mb-3">{t("interfaceLanguage")} / {t("themeLabel")}</p>
        <div className="space-y-2.5">
          <div className="pmi-toggle flex p-1 pmi-mono text-xs font-semibold">
            <button onClick={() => setLang("vi")} className={`pmi-toggle-btn flex-1 py-2 ${lang === "vi" ? "is-active" : ""}`}>Tiếng Việt</button>
            <button onClick={() => setLang("en")} className={`pmi-toggle-btn flex-1 py-2 ${lang === "en" ? "is-active" : ""}`}>English</button>
          </div>
          <div className="pmi-toggle flex p-1 pmi-mono text-xs font-semibold">
            <button onClick={() => setTheme("light")} className={`pmi-toggle-btn flex-1 py-2 flex items-center justify-center gap-1.5 ${theme === "light" ? "is-active" : ""}`}><Icon name="sun" size={13} />{t("themeLight")}</button>
            <button onClick={() => setTheme("dark")} className={`pmi-toggle-btn flex-1 py-2 flex items-center justify-center gap-1.5 ${theme === "dark" ? "is-active" : ""}`}><Icon name="moon" size={13} />{t("themeDark")}</button>
          </div>
        </div>
      </Card>

      <Card>
        <p className="pmi-eyebrow mb-1">{t("overview")}</p>
        <p className="text-xs" style={{ color: "var(--ink-mid)" }}>{t("attemptsCount", { n: progress.attempts.length, m: progress.completedQuizzes.length })}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--ink-mid)" }}>
          {t("vocabDataCount", { saved: Object.keys(progress.vocabSaved || {}).length, drilled: Object.keys(progress.vocabSrs || {}).length })}
        </p>
        <p className="pmi-mono text-xs mt-1" style={{ color: "var(--ink-soft)" }}>{t("lastUpdated", { t: fmtDate(progress.updatedAt, lang) })}</p>
      </Card>

      <Card>
        <p className="pmi-eyebrow mb-3">{t("backupProgress")}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={exportProgress} className="flex items-center justify-center gap-1"><Icon name="download" size={14} /> {t("exportProgress")}</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-1"><Icon name="upload" size={14} /> {t("importProgress")}</Button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={handleFile} />
      </Card>

      <Card style={isDesktop ? { gridColumn: "span 2" } : undefined}>
        <div className="flex items-center justify-between mb-2">
          <p className="pmi-eyebrow flex items-center gap-1"><Icon name="cloud" size={14} /> {t("driveHeader")}</p>
          <span className="pmi-chip" style={driveConnected ? { background: "var(--line)", color: "var(--ink)" } : { background: "var(--flag-tint)", color: "var(--flag)" }}>
            {driveConnected ? t("driveConnectedLabel") : t("driveNotConnectedLabel")}
          </span>
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--ink-mid)" }}>{t("driveDesc")}</p>
        <div className="grid grid-cols-2 gap-2">
          {!driveConnected ? (
            <Button variant="secondary" onClick={driveConnectNow} disabled={driveBusy} className="flex items-center justify-center gap-1 col-span-2"><Icon name="cloud" size={14} /> {t("driveConnectBtn")}</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={driveBackupNow} disabled={driveBusy} className="flex items-center justify-center gap-1"><Icon name="upload" size={14} /> {t("driveBackupBtn")}</Button>
              <Button variant="secondary" onClick={driveRestoreNow} disabled={driveBusy} className="flex items-center justify-center gap-1"><Icon name="download" size={14} /> {t("driveRestoreBtn")}</Button>
            </>
          )}
        </div>
        {driveConnected && (
          <div className="flex items-center justify-between mt-3">
            <label className="flex items-center gap-2 text-xs" style={{ color: "var(--ink-mid)" }}>
              <input type="checkbox" checked={driveAutoBackup} onChange={driveToggleAuto} />
              {t("driveAutoLabel")}
            </label>
            <button onClick={driveDisconnectNow} className="text-xs underline" style={{ color: "var(--ink-soft)" }}>{t("driveDisconnectBtn")}</button>
          </div>
        )}
        <p className="pmi-mono text-[11px] mt-2" style={{ color: "var(--ink-soft)" }}>{t("driveLastSyncLabel", { t: driveLastSync ? fmtDate(driveLastSync, lang) : t("driveNeverSynced") })}</p>
        {driveConnected && driveFileMeta && (
          <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: "var(--ink-soft)" }}>
            <Icon name="link" size={11} />
            {t("driveFileLabel")} <span style={{ color: "var(--ink-mid)" }}>{driveFileMeta.name}</span>
            {driveFileMeta.webViewLink && (
              <a href={driveFileMeta.webViewLink} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--ink-mid)" }}>
                {t("driveOpenFileLink")}
              </a>
            )}
          </p>
        )}
        {driveError && (
          <p className="text-xs mt-2" style={{ color: "var(--flag)" }}>
            {t("driveErrorLabel")}: {t(DRIVE_ERROR_I18N_KEY[driveError] || driveError)}
          </p>
        )}
      </Card>

      <Card>
        <p className="pmi-eyebrow mb-3">{t("fullBackup")}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={exportFull} className="flex items-center justify-center gap-1"><Icon name="download" size={14} /> {t("exportBackup")}</Button>
          <Button variant="secondary" onClick={() => backupRef.current?.click()} className="flex items-center justify-center gap-1"><Icon name="upload" size={14} /> {t("restoreBackup")}</Button>
        </div>
        <input ref={backupRef} type="file" accept="application/json" className="hidden" onChange={handleFile} />
      </Card>

      <Card style={isDesktop ? { gridColumn: "span 2", borderColor: "var(--flag)" } : { borderColor: "var(--flag)" }}>
        <p className="pmi-eyebrow mb-2 flex items-center gap-1" style={{ color: "var(--flag)" }}><Icon name="reset" size={14} /> {t("resetHeader")}</p>
        {!showReset ? (
          <Button variant="danger" onClick={() => setShowReset(true)} className={isDesktop ? "w-auto" : "w-full"}>{t("resetBtn")}</Button>
        ) : (
          <div className="space-y-2 max-w-sm">
            <p className="text-xs" style={{ color: "var(--ink-mid)" }}>{t("resetConfirmText")}</p>
            <input value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} className="pmi-input w-full px-3 py-2 text-sm" placeholder={t("resetConfirmPlaceholder")} />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setShowReset(false); setResetConfirm(""); }} className="flex-1">{t("cancelBtn")}</Button>
              <Button variant="danger" onClick={doReset} disabled={resetConfirm !== "RESET"} className="flex-1">{t("resetConfirmBtn")}</Button>
            </div>
          </div>
        )}
      </Card>

      <p className="text-[11px] text-center px-4" style={isDesktop ? { gridColumn: "span 2", color: "var(--ink-soft)" } : { color: "var(--ink-soft)" }}>{t("dataFooterNote")}</p>
    </div>
  );
}
