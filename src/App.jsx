import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import "./styles/design-system.css";
import { useIsDesktop, useIsWide } from "./hooks/useViewport.js";
import { useTracking } from "./hooks/useTracking.js";
import { Icon, Toast } from "./components/ui/primitives.jsx";
import { ThemeLangControls } from "./components/ui/ThemeLangControls.jsx";
import { FillGapScreen } from "./screens/gap/GapScreen.jsx";
import { ProgressScreen } from "./screens/progress/ProgressScreen.jsx";
import { TodayScreen } from "./screens/today/TodayScreen.jsx";
import { LibraryScreen } from "./screens/library/LibraryScreen.jsx";
import { HistoryScreen } from "./screens/history/HistoryScreen.jsx";
import { GlossaryScreen } from "./screens/glossary/GlossaryScreen.jsx";
import { DataScreen } from "./screens/data/DataScreen.jsx";
import { QuizRunner } from "./screens/quiz/QuizRunner.jsx";
import { ResultsScreen } from "./screens/results/ResultsScreen.jsx";
import { VocabScreen } from "./screens/vocab/VocabScreen.jsx";
import { connectDrive, disconnectDrive, isDriveConnected, uploadBackupToDrive, downloadBackupFromDrive } from "./googleDrive.js";
import { UI_TEXT, fmtStr } from "./i18n/text.js";
import { AppCtx } from "./context/AppContext.jsx";
import { QUIZ_CATALOG, QUESTION_INDEX, QUESTIONS_BY_QUIZ, initEmbeddedData } from "./lib/embeddedData.js";
import { calculateGapProfile, gradeAttempt } from "./lib/gapEngine.js";
import { buildGapPracticeQuestionIds, compactGapSnapshots } from "./lib/trackingEngine.js";
import {
  defaultProgress, ensureSupportUsage, migrateProgress, mergeProgressData, loadProgressFromStorage, saveProgressToStorage,
} from "./lib/storage.js";
import { recommendNextQuiz } from "./lib/recommend.js";
import { uid, isoNow, setsEqual } from "./lib/utils.js";
import { primeVoices } from "./lib/speech.js";




const DRIVE_AUTO_KEY = "pmi_acp_drive_auto_backup";
const DRIVE_LAST_SYNC_KEY = "pmi_acp_drive_last_sync";

const NAV_ITEMS = [
  { key: "today", icon: "home", labelKey: "navToday" },
  { key: "library", icon: "book", labelKey: "navLibrary" },
  { key: "history", icon: "clock", labelKey: "navHistory" },
  { key: "gap", icon: "target", labelKey: "navGap" },
  { key: "glossary", icon: "languages", labelKey: "navGlossary" },
  { key: "vocab", icon: "seal", labelKey: "navVocab" },
  { key: "data", icon: "database", labelKey: "navData" },
];

/* ===================== Main App ===================== */
function App() {
  const [progress, setProgress] = useState(defaultProgress());
  const [storageOk, setStorageOk] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [dataError, setDataError] = useState(false);
  const [view, setView] = useState("today");
  const [toast, setToast] = useState("");
  const [lastSessionId, setLastSessionId] = useState(null);
  const [resultsReturnView, setResultsReturnView] = useState("today");
  const [historyQuizFilter, setHistoryQuizFilter] = useState(null);
  const [driveConnectedState, setDriveConnectedState] = useState(false);
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveError, setDriveError] = useState(null);
  const [driveAutoBackup, setDriveAutoBackup] = useState(() => localStorage.getItem(DRIVE_AUTO_KEY) === "1");
  const [driveLastSync, setDriveLastSync] = useState(() => localStorage.getItem(DRIVE_LAST_SYNC_KEY) || null);
  const toastTimer = useRef(null);

  const theme = progress.settings?.theme || "light";
  const lang = progress.settings?.uiLanguage || "vi";
  const t = useCallback((key, vars) => fmtStr((UI_TEXT[lang] && UI_TEXT[lang][key]) ?? key, vars), [lang]);

  // Danh sách giọng đọc nạp bất đồng bộ trên Chrome — gọi sớm để lần bấm nút phát âm đầu tiên
  // đã có sẵn giọng tiếng Anh, thay vì rơi về giọng mặc định theo ngôn ngữ hệ thống.
  useEffect(() => { primeVoices(); }, []);

  useEffect(() => {
    (async () => {
      try {
        await initEmbeddedData();
      } catch (e) {
        setDataError(true);
        setLoaded(true);
        return;
      }
      try {
        const p = await loadProgressFromStorage();
        if (p) setProgress(migrateProgress(p));
        setStorageOk(true);
      } catch (e) {
        setStorageOk(false);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    document.documentElement.style.colorScheme = theme;
  }, [theme, loaded]);

  const saveTimerRef = useRef(null);
  const persist = useCallback((updater) => {
    setProgress((prev) => (typeof updater === "function" ? updater(prev) : updater));
  }, []);

  // Ghi xuống storage (debounce) mỗi khi progress thực sự thay đổi — tách riêng khỏi việc cập nhật
  // state để nhiều lệnh persist() gọi liên tiếp trong cùng 1 lượt xử lý (vd: lưu câu trả lời rồi
  // cập nhật session ngay sau đó) không còn ghi đè lẫn nhau như khi dùng persist(next) trực tiếp.
  useEffect(() => {
    if (!loaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await saveProgressToStorage({ ...progress, updatedAt: isoNow() });
        setStorageOk(true);
      } catch (e) {
        setStorageOk(false);
      }
      if (driveAutoBackup && isDriveConnected()) {
        try {
          await uploadBackupToDrive(progress);
          const now = isoNow();
          setDriveLastSync(now);
          localStorage.setItem(DRIVE_LAST_SYNC_KEY, now);
        } catch (e) {
          setDriveConnectedState(false);
        }
      }
    }, 150);
    return () => clearTimeout(saveTimerRef.current);
  }, [progress, loaded, driveAutoBackup]);

  const showToast = useCallback((text) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1600);
  }, []);

  const driveConnectNow = useCallback(async () => {
    setDriveError(null);
    setDriveBusy(true);
    try {
      await connectDrive({ interactive: true });
      setDriveConnectedState(true);
    } catch (e) {
      setDriveError(String(e?.message || e));
    } finally {
      setDriveBusy(false);
    }
  }, []);

  const driveBackupNow = useCallback(async () => {
    setDriveError(null);
    setDriveBusy(true);
    try {
      if (!isDriveConnected()) await connectDrive({ interactive: true });
      await uploadBackupToDrive(progress);
      setDriveConnectedState(true);
      const now = isoNow();
      setDriveLastSync(now);
      localStorage.setItem(DRIVE_LAST_SYNC_KEY, now);
      showToast(t("driveBackupDone"));
    } catch (e) {
      setDriveConnectedState(false);
      setDriveError(String(e?.message || e));
    } finally {
      setDriveBusy(false);
    }
  }, [progress, t, showToast]);

  const driveRestoreNow = useCallback(async () => {
    setDriveError(null);
    setDriveBusy(true);
    try {
      if (!isDriveConnected()) await connectDrive({ interactive: true });
      const data = await downloadBackupFromDrive();
      setDriveConnectedState(true);
      const now = isoNow();
      setDriveLastSync(now);
      localStorage.setItem(DRIVE_LAST_SYNC_KEY, now);
      if (!data) {
        showToast(t("driveNoBackup"));
      } else {
        const { merged, addedCount } = mergeProgressData(progress, data);
        persist(merged);
        showToast(`+${addedCount}`);
      }
    } catch (e) {
      setDriveConnectedState(false);
      setDriveError(String(e?.message || e));
    } finally {
      setDriveBusy(false);
    }
  }, [progress, persist, t, showToast]);

  const driveToggleAuto = useCallback(() => {
    setDriveAutoBackup((prev) => {
      const next = !prev;
      localStorage.setItem(DRIVE_AUTO_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const driveDisconnectNow = useCallback(() => {
    disconnectDrive();
    setDriveConnectedState(false);
  }, []);

  // `loaded` PHẢI nằm trong deps: lần render đầu tiên chạy khi QUESTION_INDEX còn rỗng (dữ liệu
  // đề được giải nén bất đồng bộ). Với người dùng mới, storage rỗng nên setProgress không bao giờ
  // được gọi → progress.attempts giữ nguyên tham chiếu [] → memo không tính lại và toàn bộ task
  // "chưa từng làm" biến mất khỏi GAP/Readiness vĩnh viễn.
  const gapProfile = useMemo(() => calculateGapProfile({ attempts: progress.attempts }), [progress.attempts, loaded]);
  const tracking = useTracking(progress, gapProfile);

  function startQuizSession(quizIndex, mode) {
    const cat = QUIZ_CATALOG.find((c) => c.quizIndex === quizIndex);
    const questions = QUESTIONS_BY_QUIZ.get(quizIndex) || [];
    const session = {
      sessionId: uid(`session-${quizIndex}`),
      quizIndex,
      quizName: cat?.quizName || "",
      mode,
      startedAt: isoNow(),
      currentQuestionNumber: 1,
      answeredQuestionIds: [],
      flaggedQuestionIds: [],
      visitedQuestionIds: [],
      questionIds: questions.map((q) => q.id),
      assistedWarningAcknowledged: false,
    };
    persist((prev) => ({ ...prev, activeSession: session }));
    setView("quiz");
  }

  /* ---- Tracking ---- */
  function setDailyGoal(goal) {
    persist((prev) => ({ ...prev, tracking: { ...prev.tracking, dailyGoal: goal } }));
    showToast(t("savedToast"));
  }
  function setExamDate(dateKey) {
    persist((prev) => ({ ...prev, tracking: { ...prev.tracking, examDate: dateKey } }));
  }
  function updateVocabSrs(nextMap) {
    persist((prev) => ({ ...prev, vocabSrs: nextMap }));
  }
  /** Lưu/bỏ lưu một thẻ từ vựng ngay trong lúc làm bài hoặc xem lại. Ghi kèm câu hỏi nguồn để
      màn "Ôn từ vựng" cho biết thẻ này đến từ đâu. Bỏ lưu KHÔNG xóa tiến độ ôn (vocabSrs) —
      người học có thể lưu lại sau mà không mất số lần đã ôn. */
  function toggleVocabSaved(termId, questionId, quizIndex) {
    persist((prev) => {
      const saved = { ...(prev.vocabSaved || {}) };
      if (saved[termId]) delete saved[termId];
      else saved[termId] = { savedAt: isoNow(), questionId, quizIndex: quizIndex ?? null };
      return { ...prev, vocabSaved: saved };
    });
  }
  /** Nút "Làm tiếp N câu" ở màn Hôm nay: tự chọn câu theo GAP, vào bài ngay trong một chạm. */
  function startQuickPractice(size) {
    const taskIds = gapProfile.tasks.slice(0, 5).map((tk) => tk.taskId);
    const ids = buildGapPracticeQuestionIds({ attempts: progress.attempts, taskIds, size });
    if (!ids.length) return;
    startFillGapSession(ids, ids.length);
  }

  function startFillGapSession(questionIds, size) {
    const session = {
      sessionId: uid("session-fillgap"),
      quizIndex: null,
      quizName: `Fill-gap (${size})`,
      mode: "fillgap",
      startedAt: isoNow(),
      currentQuestionNumber: 1,
      answeredQuestionIds: [],
      flaggedQuestionIds: [],
      visitedQuestionIds: [],
      questionIds,
      assistedWarningAcknowledged: false,
    };
    persist((prev) => ({ ...prev, activeSession: session }));
    setView("quiz");
  }

  function openHistoryEntry(sessionId) {
    setLastSessionId(sessionId);
    setResultsReturnView("history");
    setView("results");
  }

  function resumeSession() {
    if (!progress.activeSession) return;
    setView("quiz");
  }

  function finishSession(session, gradeNow) {
    persist((prev) => {
      let attempts = prev.attempts;
      if (gradeNow) {
        attempts = attempts.map((a) => {
          if (a.sessionId !== session.sessionId || a.gradeStatus !== "pending") return a;
          const q = QUESTION_INDEX.get(a.questionId);
          const g = gradeAttempt(q, a.selectedOptionIds);
          return { ...a, ...g };
        });
      }
      const finalAttempts = attempts.filter((a) => a.sessionId === session.sessionId);
      const graded = finalAttempts.filter((a) => a.gradeStatus === "graded");
      const trusted = graded.filter((a) => a.eligibleForGap);
      const trustedCorrect = trusted.filter((a) => a.isCorrect).length;
      const rawGraded = finalAttempts.filter((a) => a.gradeStatus !== "manual_review");
      const rawCorrect = rawGraded.filter((a) => a.isCorrect).length;
      const independent = trusted.filter((a) => !a.supportUsage?.assisted);
      const independentCorrect = independent.filter((a) => a.isCorrect).length;

      // Điểm "lần đầu gặp": chỉ tính những câu chưa từng xuất hiện ở BẤT KỲ phiên nào trước đó.
      // Làm lại một bộ đề thì phần lớn điểm tăng là do nhớ đáp án; con số này tách phần đó ra
      // để người học không tự tin sai trước kỳ thi thật.
      const seenBefore = new Set(prev.attempts.filter((a) => a.sessionId !== session.sessionId).map((a) => a.questionId));
      const firstExposure = trusted.filter((a) => !seenBefore.has(a.questionId));
      const firstExposureCorrect = firstExposure.filter((a) => a.isCorrect).length;

      const completedEntry = {
        quizIndex: session.quizIndex,
        quizName: session.quizName,
        sessionId: session.sessionId,
        mode: session.mode,
        completedAt: isoNow(),
        questionIds: session.questionIds,
        rawScore: { correct: rawCorrect, graded: rawGraded.length, percent: rawGraded.length ? Number(((rawCorrect / rawGraded.length) * 100).toFixed(2)) : 0 },
        trustedScore: { correct: trustedCorrect, graded: trusted.length, percent: trusted.length ? Number(((trustedCorrect / trusted.length) * 100).toFixed(2)) : 0 },
        independentScore: independent.length
          ? { correct: independentCorrect, graded: independent.length, percent: Number(((independentCorrect / independent.length) * 100).toFixed(2)) }
          : null,
        firstExposureScore: firstExposure.length
          ? { correct: firstExposureCorrect, graded: firstExposure.length, percent: Number(((firstExposureCorrect / firstExposure.length) * 100).toFixed(2)) }
          : null,
      };

      const nextProgress = {
        ...prev,
        attempts,
        activeSession: null,
        completedQuizzes: [...prev.completedQuizzes, completedEntry],
      };
      const nextGap = calculateGapProfile({ attempts: nextProgress.attempts });
      nextProgress.gapSnapshots = compactGapSnapshots([
        ...nextProgress.gapSnapshots,
        { sessionId: session.sessionId, generatedAt: isoNow(), profile: nextGap },
      ]);
      if (session.quizIndex) {
        const rec = recommendNextQuiz(nextProgress);
        nextProgress.plan = { ...nextProgress.plan, recommendedNextQuizIndex: rec.quizIndex, currentStageId: rec.stageId };
      }
      return nextProgress;
    });
    setLastSessionId(session.sessionId);
    setResultsReturnView("today");
    setView("results");
  }

  function saveAttempt(attempt) {
    persist((prev) => {
      const idx = prev.attempts.findIndex((a) => a.sessionId === attempt.sessionId && a.questionId === attempt.questionId);
      let attempts;
      if (idx >= 0) {
        const prevAttempt = prev.attempts[idx];
        const mergedSupport = {
          translationOpenedBeforeAnswer: !!(prevAttempt.supportUsage?.translationOpenedBeforeAnswer || attempt.supportUsage?.translationOpenedBeforeAnswer),
          terminologyOpenedBeforeAnswer: !!(prevAttempt.supportUsage?.terminologyOpenedBeforeAnswer || attempt.supportUsage?.terminologyOpenedBeforeAnswer),
          postAnswerTranslationOpened: !!(prevAttempt.supportUsage?.postAnswerTranslationOpened || attempt.supportUsage?.postAnswerTranslationOpened),
          assisted: !!(prevAttempt.supportUsage?.assisted || attempt.supportUsage?.assisted),
        };
        attempts = prev.attempts.slice();
        attempts[idx] = {
          ...attempt,
          supportUsage: mergedSupport,
          changedAnswer: !setsEqual(prevAttempt.selectedOptionIds, attempt.selectedOptionIds) || prevAttempt.changedAnswer,
        };
      } else {
        attempts = [...prev.attempts, ensureSupportUsage(attempt)];
      }
      return { ...prev, attempts };
    });
    showToast(t("savedToast"));
  }

  function updateActiveSession(patch) {
    persist((prev) => (prev.activeSession ? { ...prev, activeSession: { ...prev.activeSession, ...patch } } : prev));
  }

  function setTheme(next) {
    persist((prev) => ({ ...prev, settings: { ...prev.settings, theme: next } }));
  }
  function setLang(next) {
    persist((prev) => ({ ...prev, settings: { ...prev.settings, uiLanguage: next } }));
  }
  function setSidebarOpen(next) {
    persist((prev) => ({ ...prev, settings: { ...prev.settings, sidebarOpen: next } }));
  }
  const sidebarOpen = progress.settings?.sidebarOpen !== false;

  const isDesktop = useIsDesktop();
  const isWide = useIsWide();

  if (dataError) {
    return (
      <>
        <div className={`pmi-app ${theme === "dark" ? "dark" : ""} min-h-screen flex items-center justify-center px-6 text-center`} style={{ color: "var(--ink)" }}>
          <div>
            <p className="font-semibold mb-2">Không thể tải dữ liệu đề thi</p>
            <p className="text-sm" style={{ color: "var(--ink-mid)" }}>Trình duyệt của bạn có thể chưa hỗ trợ giải nén dữ liệu (DecompressionStream). Hãy thử cập nhật trình duyệt hoặc mở bằng Chrome/Edge/Safari phiên bản mới.</p>
          </div>
        </div>
      </>
    );
  }

  if (!loaded) {
    return (
      <>
        <div className={`pmi-app ${theme === "dark" ? "dark" : ""} min-h-screen flex items-center justify-center`} style={{ color: "var(--ink-soft)" }}>
          <span className="pmi-mono text-sm">···</span>
        </div>
      </>
    );
  }

  const ctxValue = { lang, theme, t };

  return (
    <AppCtx.Provider value={ctxValue}>
      <div className={`pmi-app ${theme === "dark" ? "dark" : ""}`}>
        <div className={`min-h-screen ${isDesktop ? "flex" : ""}`}>
          {/* Sidebar nav — chỉ render khi đo được viewport >= 768px và người dùng chưa ẩn */}
          {isDesktop && sidebarOpen && (
            <nav className="flex flex-col w-56 shrink-0 sticky top-0 py-6 px-3 gap-1" style={{ height: "100vh", borderRight: "1px solid var(--line)" }}>
              <div className="flex items-start justify-between px-3 mb-6">
                <div>
                  <p className="pmi-eyebrow mb-1">PMI-ACP</p>
                  <p className="pmi-display font-semibold text-lg leading-tight" style={{ color: "var(--ink)" }}>Daily Trainer</p>
                </div>
                <button onClick={() => setSidebarOpen(false)} title={t("hideSidebar")} className="pmi-focusable p-1.5 rounded-md shrink-0" style={{ color: "var(--ink-soft)" }}>
                  <Icon name="sidebar" size={16} />
                </button>
              </div>
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className="pmi-focusable flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={view === item.key ? { background: "var(--paper-raised)", color: "var(--ink)", border: "1px solid var(--line)" } : { color: "var(--ink-mid)", border: "1px solid transparent" }}
                >
                  <Icon name={item.icon} size={18} /> {t(item.labelKey)}
                </button>
              ))}
              <div className="mt-auto px-3 pt-4">
                <ThemeLangControls theme={theme} lang={lang} setTheme={setTheme} setLang={setLang} />
              </div>
            </nav>
          )}

          <div className="flex-1" style={{ minWidth: 0 }}>
            {!storageOk && (
              <div className="pmi-mono text-xs px-4 py-2 flex items-center gap-2" style={{ background: "var(--seal-tint)", color: "var(--seal-fg)" }}>
                <Icon name="warn" size={14} /> {t("publishBanner")}
              </div>
            )}

            <div className={!isDesktop ? "max-w-md mx-auto px-4" : view === "quiz" && isWide ? "max-w-6xl mx-auto px-8" : isWide ? "max-w-5xl mx-auto px-8" : "max-w-3xl mx-auto px-8"}>
              {!isDesktop && (
                <header className="pt-5 pb-3 flex items-center justify-between">
                  <div>
                    <p className="pmi-eyebrow mb-0.5">PMI-ACP</p>
                    <h1 className="pmi-display font-semibold text-xl leading-none" style={{ color: "var(--ink)" }}>Daily Trainer</h1>
                  </div>
                  <ThemeLangControls theme={theme} lang={lang} setTheme={setTheme} setLang={setLang} />
                </header>
              )}
              {isDesktop && (
                <header className="pt-6 pb-4 flex items-center gap-3">
                  {!sidebarOpen && (
                    <button onClick={() => setSidebarOpen(true)} title={t("showSidebar")} className="pmi-focusable p-1.5 rounded-md shrink-0" style={{ color: "var(--ink-mid)", border: "1px solid var(--line-strong)" }}>
                      <Icon name="sidebar" size={16} />
                    </button>
                  )}
                  <p className="text-sm" style={{ color: "var(--ink-mid)" }}>{t("appSubtitle")}</p>
                </header>
              )}

              <main className={isDesktop ? "pb-10" : "pb-24"}>
                {view === "today" && (
                  <TodayScreen
                    progress={progress}
                    gapProfile={gapProfile}
                    tracking={tracking}
                    onResume={resumeSession}
                    onStart={(qi) => startQuizSession(qi, "exam")}
                    onGoLibrary={() => setView("library")}
                    onGoGap={() => setView("gap")}
                    onGoFillGap={() => setView("fillgap")}
                    onSetGoal={setDailyGoal}
                    onQuickPractice={startQuickPractice}
                  />
                )}
                {view === "library" && <LibraryScreen progress={progress} onOpenQuiz={(qi, mode) => startQuizSession(qi, mode)} onOpenHistory={(qi) => { setHistoryQuizFilter(qi); setView("history"); }} />}
                {view === "history" && <HistoryScreen progress={progress} initialQuizFilter={historyQuizFilter} onOpenEntry={openHistoryEntry} />}
                {view === "quiz" && progress.activeSession && (
                  <QuizRunner
                    session={progress.activeSession}
                    attempts={progress.attempts}
                    onSaveAttempt={saveAttempt}
                    onUpdateSession={updateActiveSession}
                    onFinish={(grade) => finishSession(progress.activeSession, grade)}
                    onExit={() => setView("today")}
                    showToast={showToast}
                    vocabSaved={progress.vocabSaved}
                    onToggleVocabSaved={toggleVocabSaved}
                  />
                )}
                {view === "results" && <ResultsScreen sessionId={lastSessionId} progress={progress} onDone={() => setView(resultsReturnView)} onGap={() => setView("gap")} backLabel={resultsReturnView === "history" ? t("historyBackToHistory") : null} onToggleVocabSaved={toggleVocabSaved} />}
                {view === "gap" && (
                  <ProgressScreen
                    progress={progress}
                    gapProfile={gapProfile}
                    tracking={tracking}
                    onFillGap={() => setView("fillgap")}
                    onSetGoal={setDailyGoal}
                    onSetExamDate={setExamDate}
                  />
                )}
                {view === "fillgap" && <FillGapScreen progress={progress} gapProfile={gapProfile} onStart={(ids, size) => startFillGapSession(ids, size)} onBack={() => setView("gap")} />}
                {view === "glossary" && <GlossaryScreen />}
                {view === "vocab" && <VocabScreen vocabSrs={progress.vocabSrs} vocabSaved={progress.vocabSaved} onUpdateVocabSrs={updateVocabSrs} onToggleVocabSaved={toggleVocabSaved} />}
                {view === "data" && (
                  <DataScreen
                    progress={progress} persist={persist} showToast={showToast} theme={theme} lang={lang} setTheme={setTheme} setLang={setLang}
                    driveConnected={driveConnectedState} driveBusy={driveBusy} driveError={driveError} driveAutoBackup={driveAutoBackup} driveLastSync={driveLastSync}
                    driveConnectNow={driveConnectNow} driveBackupNow={driveBackupNow} driveRestoreNow={driveRestoreNow} driveToggleAuto={driveToggleAuto} driveDisconnectNow={driveDisconnectNow}
                  />
                )}
              </main>
            </div>
          </div>

          {/* Bottom tab bar — chỉ render khi đo được viewport < 768px */}
          {!isDesktop && (
          <nav className="fixed bottom-0 left-0 right-0 flex justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]" style={{ background: "var(--paper-raised)", borderTop: "1px solid var(--line)" }}>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className="pmi-focusable flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[11px]"
                style={{ color: view === item.key ? "var(--ink)" : "var(--ink-soft)" }}
              >
                <Icon name={item.icon} size={18} />
                {t(item.labelKey)}
              </button>
            ))}
          </nav>
          )}
        </div>
      </div>
      <Toast text={toast} />
    </AppCtx.Provider>
  );
}

export default App;
