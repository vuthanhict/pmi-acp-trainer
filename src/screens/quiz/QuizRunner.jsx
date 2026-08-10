import { useState, useEffect, useMemo, useRef } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { useIsDesktop, useIsWide } from "../../hooks/useViewport.js";
import { QUESTION_INDEX, VI_ITEM_INDEX } from "../../lib/embeddedData.js";
import { parseMatchingQuestion } from "../../lib/matching.js";
import { gradeAttempt } from "../../lib/gapEngine.js";
import { DEFAULT_SUPPORT_USAGE } from "../../lib/storage.js";
import { normOpt, isoNow, fmtClock } from "../../lib/utils.js";
import { Card, Button, ProgressBar, Icon } from "../../components/ui/primitives.jsx";
import {
  BilingualToggle, BilingualStemBlock, ChoiceViLine, ExplanationText, BilingualAnswerBlock,
} from "../../components/bilingual/BilingualWidgets.jsx";

/* ===================== Matching-question widget (3/1.470 câu, không chấm điểm) ===================== */
const DRAG_THRESHOLD_PX = 6;
export function MatchingQuestion({ question, mode }) {
  const { t } = useAppCtx();
  const canReveal = mode !== "exam"; // Exam mode: không xem trước đáp án, đúng nguyên tắc "không tính điểm giữa chừng" như mọi câu khác
  const parsed = useMemo(() => parseMatchingQuestion(question), [question.id]);
  const [picks, setPicks] = useState({}); // { statementIndex: category }
  const [active, setActive] = useState(0); // statement index đang chờ gán đáp án (luồng chạm), null nếu không có
  const [revealed, setRevealed] = useState(false);
  const [dragCat, setDragCat] = useState(null); // category đang được kéo, null nếu không kéo
  const [dragPos, setDragPos] = useState(null); // {x,y} toạ độ con trỏ/ngón tay khi đang kéo
  const [overIndex, setOverIndex] = useState(null); // statement đang được rê tới khi kéo
  const dropZoneRefs = useRef(new Map());
  const pointerInfoRef = useRef(null); // {cat, startX, startY, pointerId}

  useEffect(() => {
    setPicks({});
    setActive(parsed.statements.length ? 0 : null);
    setRevealed(false);
    setDragCat(null);
    setDragPos(null);
    setOverIndex(null);
    pointerInfoRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  const usedCategories = new Set(Object.values(picks));

  function assignPick(idx, cat) {
    if (revealed || idx === null || usedCategories.has(cat)) return;
    const nextPicks = { ...picks, [idx]: cat };
    setPicks(nextPicks);
    let nextActive = null;
    for (let i = 0; i < parsed.statements.length; i++) {
      if (nextPicks[i] === undefined) { nextActive = i; break; }
    }
    setActive(nextActive);
  }
  function clearPick(i) {
    if (revealed) return;
    setPicks((p) => { const next = { ...p }; delete next[i]; return next; });
    setActive(i);
  }
  function tapStatement(i) {
    if (revealed) return;
    if (picks[i] !== undefined) { clearPick(i); return; }
    setActive(i);
  }
  function findOverIndex(x, y) {
    for (const [i, el] of dropZoneRefs.current.entries()) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return null;
  }

  // Kéo-thả bằng Pointer Events (hoạt động cả chuột lẫn cảm ứng). Nếu ngón tay/chuột không di
  // chuyển quá ngưỡng thì coi như một cú CHẠM đơn giản (gán vào câu đang active) thay vì kéo.
  function onChipPointerDown(e, cat) {
    if (revealed || usedCategories.has(cat)) return;
    pointerInfoRef.current = { cat, startX: e.clientX, startY: e.clientY, pointerId: e.pointerId };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  }
  function onChipPointerMove(e, cat) {
    const info = pointerInfoRef.current;
    if (!info || info.cat !== cat) return;
    const dx = e.clientX - info.startX;
    const dy = e.clientY - info.startY;
    if (dragCat !== cat && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      setDragCat(cat);
    }
    if (dragCat === cat || Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      setDragPos({ x: e.clientX, y: e.clientY });
      setOverIndex(findOverIndex(e.clientX, e.clientY));
    }
  }
  function onChipPointerUp(e, cat) {
    const info = pointerInfoRef.current;
    pointerInfoRef.current = null;
    if (!info || info.cat !== cat) return;
    if (dragCat === cat) {
      if (overIndex !== null) assignPick(overIndex, cat);
    } else {
      // Không vượt ngưỡng kéo — xử lý như một cú chạm bình thường.
      assignPick(active, cat);
    }
    setDragCat(null);
    setDragPos(null);
    setOverIndex(null);
  }
  function onChipPointerCancel() {
    pointerInfoRef.current = null;
    setDragCat(null);
    setDragPos(null);
    setOverIndex(null);
  }

  return (
    <Card className="mb-3" style={{ position: "relative" }}>
      <p className="pmi-eyebrow mb-3" style={{ color: "var(--seal-fg)" }}>{t("matchingHeader")}</p>
      {parsed.intro && <p className="text-sm leading-relaxed mb-3 whitespace-pre-wrap">{parsed.intro}</p>}
      {!revealed && <p className="text-xs mb-3" style={{ color: "var(--ink-soft)" }}>{t("matchingTapHint")}</p>}

      {/* Ngân hàng đáp án — kéo (chuột/ngón tay) thả vào vùng trống bên dưới, hoặc chạm nhanh để gán vào câu đang chọn */}
      {!revealed && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {parsed.options.map((o) => {
            const used = usedCategories.has(o);
            const isBeingDragged = dragCat === o;
            const receiving = active !== null && !used;
            return (
              <button
                key={o}
                onPointerDown={(e) => onChipPointerDown(e, o)}
                onPointerMove={(e) => onChipPointerMove(e, o)}
                onPointerUp={(e) => onChipPointerUp(e, o)}
                onPointerCancel={onChipPointerCancel}
                disabled={used}
                className="pmi-focusable pmi-mono text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{
                  touchAction: "none",
                  opacity: isBeingDragged ? 0.35 : 1,
                  ...(used
                    ? { background: "var(--line)", color: "var(--ink-soft)", textDecoration: "line-through" }
                    : receiving
                    ? { background: "var(--accent)", color: "var(--accent-fg)" }
                    : { background: "var(--paper)", border: "1px solid var(--line-strong)", color: "var(--ink-mid)" }),
                }}
              >
                {o}
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        {parsed.statements.map((s, i) => {
          const correctCategory = parsed.correctMap.get(s);
          const pick = picks[i];
          const isActive = active === i;
          const isHoverTarget = dragCat && overIndex === i;
          let zoneStyle = { border: "1.5px dashed var(--line-strong)", background: "transparent" };
          if (pick) zoneStyle = { border: "1.5px solid var(--ink)", background: "var(--paper)" };
          else if (isHoverTarget) zoneStyle = { border: "1.5px dashed var(--ink)", background: "var(--seal-tint)" };
          else if (isActive) zoneStyle = { border: "1.5px dashed var(--ink)", background: "var(--paper)" };
          if (revealed) {
            const ok = pick === correctCategory;
            zoneStyle = ok ? { border: "1.5px solid var(--sage)", background: "var(--sage-tint)" } : { border: "1.5px solid var(--flag)", background: "var(--flag-tint)" };
          }
          return (
            <div key={i} className="rounded-lg p-3" style={{ border: "1px solid var(--line-strong)" }}>
              <div role="button" tabIndex={0} onClick={() => tapStatement(i)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") tapStatement(i); }} className="pmi-focusable cursor-pointer">
                <p className="text-sm mb-2">{s}</p>
              </div>
              <div
                ref={(el) => { if (el) dropZoneRefs.current.set(i, el); else dropZoneRefs.current.delete(i); }}
                onClick={() => tapStatement(i)}
                className="rounded-lg px-3 py-2.5 flex items-center justify-between cursor-pointer"
                style={zoneStyle}
              >
                {!revealed ? (
                  pick ? (
                    <>
                      <span className="pmi-mono inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--ink)" }}>
                        <Icon name="check" size={12} /> {pick}
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); clearPick(i); }} className="pmi-focusable" style={{ color: "var(--ink-soft)" }}>
                        <Icon name="x" size={13} />
                      </button>
                    </>
                  ) : (
                    <span className="pmi-mono text-xs" style={{ color: isActive || isHoverTarget ? "var(--seal-fg)" : "var(--ink-soft)" }}>
                      {isActive ? t("matchingActiveHint") : t("matchingDropHint")}
                    </span>
                  )
                ) : (
                  <div className="flex items-center gap-2 pmi-mono text-xs font-semibold">
                    <span style={{ color: pick === correctCategory ? "var(--sage)" : "var(--flag)" }}>{pick || "—"}</span>
                    {pick !== correctCategory && (
                      <>
                        <Icon name="right" size={12} style={{ color: "var(--ink-soft)" }} />
                        <span style={{ color: "var(--sage)" }}>{correctCategory}</span>
                      </>
                    )}
                    {pick === correctCategory && <Icon name="check" size={14} style={{ color: "var(--sage)" }} />}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!revealed ? (
        canReveal ? (
          <Button variant="secondary" onClick={() => setRevealed(true)} className="w-full mt-3">{t("matchingCheckBtn")}</Button>
        ) : (
          <p className="pmi-mono text-[11px] text-center mt-3 px-2" style={{ color: "var(--ink-soft)" }}>{t("matchingExamLocked")}</p>
        )
      ) : (
        <p className="pmi-mono text-[11px] mt-3" style={{ color: "var(--ink-soft)" }}>{t("matchingCorrectHeader")} ↑</p>
      )}

      {/* "Bóng ma" đáp án bám theo con trỏ/ngón tay khi đang kéo */}
      {dragCat && dragPos && (
        <div
          className="pmi-mono text-xs font-semibold px-3 py-1.5 rounded-full"
          style={{
            position: "fixed",
            left: dragPos.x,
            top: dragPos.y,
            transform: "translate(-50%, -50%) scale(1.1)",
            background: "var(--accent)",
            color: "var(--accent-fg)",
            zIndex: 1000,
            boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
            pointerEvents: "none",
          }}
        >
          {dragCat}
        </div>
      )}
    </Card>
  );
}


/* ===================== Quiz Runner ===================== */
export function PaletteBody({ questions, filteredIndices, paletteFilter, setPaletteFilter, idx, visitedIds, session, isDone, onJump, unansweredForFilter, flaggedCount }) {
  const { t } = useAppCtx();
  return (
    <>
      <div className="flex gap-1.5 flex-wrap mb-3">
        {[
          { key: "all", label: t("paletteFilterAll"), count: questions.length },
          { key: "unanswered", label: t("paletteFilterUnanswered"), count: unansweredForFilter },
          { key: "flagged", label: t("paletteFilterFlagged"), count: flaggedCount },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setPaletteFilter(f.key)}
            className="pmi-mono text-xs px-3 py-1.5 rounded-full font-medium"
            style={paletteFilter === f.key ? { background: "var(--accent)", color: "var(--accent-fg)" } : { background: "var(--paper)", border: "1px solid var(--line-strong)", color: "var(--ink-mid)" }}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>
      {filteredIndices.length === 0 ? (
        <p className="text-xs text-center py-6" style={{ color: "var(--ink-soft)" }}>{t("paletteFilterEmpty")}</p>
      ) : paletteFilter === "all" ? (
        <div className="space-y-1.5">
          {Array.from({ length: Math.ceil(filteredIndices.length / 10) }, (_, r) => filteredIndices.slice(r * 10, r * 10 + 10)).map((row, ri) => (
            <div key={ri} className="flex items-center gap-1.5">
              <span className="pmi-mono text-[10px] w-5 text-right shrink-0" style={{ color: "var(--ink-soft)" }}>{row[0] + 1}</span>
              <div className="grid grid-cols-10 gap-1.5 flex-1">
                {row.map((i) => {
                  const qq = questions[i];
                  const done = isDone(qq);
                  const visited = visitedIds.includes(qq.id);
                  const flagged = session.flaggedQuestionIds.includes(qq.id);
                  let cls = "";
                  if (done) cls = "is-done";
                  else if (visited) cls = "is-visited";
                  if (i === idx) cls = "is-current";
                  return (
                    <button key={qq.id} onClick={() => onJump(i)} className={`pmi-bubble pmi-focusable h-8 ${cls}`}>
                      {i + 1}
                      {flagged && <span className="pmi-bubble-flag" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(34px, 1fr))" }}>
          {filteredIndices.map((i) => {
            const qq = questions[i];
            const done = isDone(qq);
            const visited = visitedIds.includes(qq.id);
            const flagged = session.flaggedQuestionIds.includes(qq.id);
            let cls = "";
            if (done) cls = "is-done";
            else if (visited) cls = "is-visited";
            if (i === idx) cls = "is-current";
            return (
              <button key={qq.id} onClick={() => onJump(i)} className={`pmi-bubble pmi-focusable h-8 ${cls}`}>
                {i + 1}
                {flagged && <span className="pmi-bubble-flag" />}
              </button>
            );
          })}
        </div>
      )}
      <p className="pmi-mono text-[10px] text-center mt-3" style={{ color: "var(--ink-soft)" }}>{t("paletteLegend")}</p>
    </>
  );
}

export function QuizRunner({ session, attempts, onSaveAttempt, onUpdateSession, onFinish, onExit, showToast }) {
  const { t } = useAppCtx();
  const isDesktop = useIsDesktop();
  const isWide = useIsWide();
  const questions = useMemo(() => session.questionIds.map((id) => QUESTION_INDEX.get(id)).filter(Boolean), [session.questionIds]);
  const [idx, setIdx] = useState(Math.max(0, session.currentQuestionNumber - 1));
  const [selected, setSelected] = useState([]);
  const [confidence, setConfidence] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [viOn, setViOn] = useState(false);
  const [expandedTerm, setExpandedTerm] = useState(null);
  const [pendingHelp, setPendingHelp] = useState(null);
  const [showPalette, setShowPalette] = useState(false);
  const [paletteFilter, setPaletteFilter] = useState("all");
  const [now, setNow] = useState(() => Date.now());
  const activeMsRef = useRef(0);
  const lastResumeRef = useRef(performance.now());
  const visibleRef = useRef(document.visibilityState === "visible");
  const helpMemoryRef = useRef(new Map());
  function getHelpMemory(qid) {
    if (!helpMemoryRef.current.has(qid)) {
      const ex = sessionAttempts.find((a) => a.questionId === qid);
      helpMemoryRef.current.set(qid, {
        translation: !!ex?.supportUsage?.translationOpenedBeforeAnswer,
        terminology: !!ex?.supportUsage?.terminologyOpenedBeforeAnswer,
        postTranslation: !!ex?.supportUsage?.postAnswerTranslationOpened,
      });
    }
    return helpMemoryRef.current.get(qid);
  }

  const q = questions[idx];
  const isMatching = q?.interactionType === "matching";
  const isExam = session.mode === "exam";
  const sessionAttempts = useMemo(() => attempts.filter((a) => a.sessionId === session.sessionId), [attempts, session.sessionId]);
  const existing = useMemo(() => sessionAttempts.find((a) => a.questionId === q?.id), [sessionAttempts, q]);
  const answeredThisQuestion = session.answeredQuestionIds.includes(q?.id);
  const visitedIds = session.visitedQuestionIds || [];

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    activeMsRef.current = 0;
    lastResumeRef.current = performance.now();
    setSelected(existing ? existing.selectedOptionIds : []);
    setConfidence(existing ? existing.confidence : null);
    setRevealed(session.mode !== "exam" && !!existing && existing.gradeStatus !== "pending");
    setViOn(false);
    setExpandedTerm(null);
    if (q && !visitedIds.includes(q.id)) onUpdateSession({ visitedQuestionIds: [...visitedIds, q.id] });
    function onVis() {
      const n = performance.now();
      if (document.visibilityState === "visible") {
        lastResumeRef.current = n;
        visibleRef.current = true;
      } else {
        if (visibleRef.current) activeMsRef.current += n - lastResumeRef.current;
        visibleRef.current = false;
      }
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  function elapsedMs() {
    let total = activeMsRef.current;
    if (visibleRef.current) total += performance.now() - lastResumeRef.current;
    return Math.round(total);
  }

  function toggleChoice(choiceId) {
    if (session.mode !== "exam" && revealed) return;
    const isMulti = q.interactionType === "multiple_select";
    setSelected((prev) => {
      const id = normOpt(choiceId);
      if (isMulti) return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return [id];
    });
  }

  function currentSupportUsageFor(mem) {
    const priorSupport = existing?.supportUsage || DEFAULT_SUPPORT_USAGE;
    const translationOpenedBeforeAnswer = priorSupport.translationOpenedBeforeAnswer || mem.translation;
    const terminologyOpenedBeforeAnswer = priorSupport.terminologyOpenedBeforeAnswer || mem.terminology;
    const postAnswerTranslationOpened = priorSupport.postAnswerTranslationOpened || mem.postTranslation;
    return {
      translationOpenedBeforeAnswer,
      terminologyOpenedBeforeAnswer,
      postAnswerTranslationOpened,
      assisted: translationOpenedBeforeAnswer || terminologyOpenedBeforeAnswer || priorSupport.assisted,
    };
  }

  function persistAnswer(finalSelected, finalConfidence, opts = {}) {
    const grade = opts.forceGrade ? gradeAttempt(q, finalSelected) : { isCorrect: null, gradeStatus: "pending", eligibleForGap: false };
    const ms = elapsedMs();
    const attempt = {
      sessionId: session.sessionId,
      questionId: q.id,
      quizIndex: q.quizIndex,
      questionNumber: q.questionNumber,
      mode: session.mode,
      selectedOptionIds: finalSelected,
      isCorrect: grade.isCorrect,
      gradeStatus: grade.gradeStatus,
      eligibleForGap: grade.eligibleForGap,
      confidence: finalConfidence,
      responseTimeMs: ms > 0 ? ms : null,
      timingSource: ms > 0 ? "per_question" : "not_recorded",
      changedAnswer: false,
      flagged: session.flaggedQuestionIds.includes(q.id),
      answeredAt: isoNow(),
      supportUsage: currentSupportUsageFor(getHelpMemory(q.id)),
    };
    onSaveAttempt(attempt);
    const answered = session.answeredQuestionIds.includes(q.id) ? session.answeredQuestionIds : [...session.answeredQuestionIds, q.id];
    onUpdateSession({ answeredQuestionIds: answered, currentQuestionNumber: idx + 1 });
    return grade;
  }

  function handleCheck() {
    if (!selected.length) return;
    persistAnswer(selected, confidence, { forceGrade: true });
    setRevealed(true);
  }
  function goTo(nextIdx) {
    if (!isMatching && !revealed && selected.length) persistAnswer(selected, confidence);
    setIdx(Math.max(0, Math.min(questions.length - 1, nextIdx)));
  }
  function toggleFlag() {
    const has = session.flaggedQuestionIds.includes(q.id);
    onUpdateSession({ flaggedQuestionIds: has ? session.flaggedQuestionIds.filter((x) => x !== q.id) : [...session.flaggedQuestionIds, q.id] });
  }
  function applyViOn(value, relevant) {
    setViOn(value);
    if (value && relevant) {
      const mem = getHelpMemory(q.id);
      if (revealed) mem.postTranslation = true;
      else mem.translation = true;
      if (existing) onSaveAttempt({ ...existing, supportUsage: currentSupportUsageFor(mem) });
    }
  }
  function requestViOn(value) {
    if (!value) { setViOn(false); return; }
    const relevant = !answeredThisQuestion;
    if (session.mode === "exam" && relevant && !session.assistedWarningAcknowledged) {
      setPendingHelp({ kind: "translation", value: true });
      return;
    }
    applyViOn(true, relevant);
  }
  function applyExpandTerm(termId, relevant) {
    setExpandedTerm(termId);
    if (relevant) {
      const mem = getHelpMemory(q.id);
      mem.terminology = true;
      if (existing) onSaveAttempt({ ...existing, supportUsage: currentSupportUsageFor(mem) });
    }
  }
  function requestExpandTerm(termId) {
    if (termId === null) { setExpandedTerm(null); return; }
    const relevant = !answeredThisQuestion;
    if (session.mode === "exam" && relevant && !session.assistedWarningAcknowledged) {
      setPendingHelp({ kind: "terminology", value: termId });
      return;
    }
    applyExpandTerm(termId, relevant);
  }
  function confirmPendingHelp() {
    onUpdateSession({ assistedWarningAcknowledged: true });
    const relevant = !answeredThisQuestion;
    if (pendingHelp.kind === "translation") applyViOn(pendingHelp.value, relevant);
    else applyExpandTerm(pendingHelp.value, relevant);
    setPendingHelp(null);
  }
  if (!q) return <div className="pt-4 text-sm" style={{ color: "var(--ink-soft)" }}>—</div>;

  const answeredCount = session.answeredQuestionIds.length;
  const unansweredCount = questions.length - answeredCount;
  const sessionElapsedMs = now - new Date(session.startedAt).getTime();
  const questionElapsedMs = elapsedMs();
  const canGoNext = session.mode === "exam" || revealed || isMatching;
  const isLast = idx === questions.length - 1;
  const isFlagged = session.flaggedQuestionIds.includes(q.id);
  const flaggedCount = session.flaggedQuestionIds.length;
  function isDone(qq) {
    const a = sessionAttempts.find((x) => x.questionId === qq.id);
    return !!a && (session.mode === "exam" || a.gradeStatus !== "pending");
  }
  const filteredIndices = questions
    .map((_, i) => i)
    .filter((i) => {
      if (paletteFilter === "unanswered") return !isDone(questions[i]);
      if (paletteFilter === "flagged") return session.flaggedQuestionIds.includes(questions[i].id);
      return true;
    });
  const unansweredForFilter = questions.filter((qq) => !isDone(qq)).length;

  return (
    <div className={isWide ? "flex gap-6 items-start pt-1 pb-4" : ""}>
    <div className={isWide ? "flex-1 min-w-0" : "pt-1 pb-4"}>
      {/* "Vé dự thi" — chỉ Exam mode mới có phần cuống vé, phân biệt rõ với Practice */}
      {isExam ? (
        <div className={`mb-4 ${isDesktop ? "static" : "sticky top-0 z-10"}`}>
          <div className="pmi-ticket px-4 pt-3 pb-2.5 flex items-center justify-between pmi-ticket-tear">
            <div>
              <p className="pmi-eyebrow" style={{ color: "rgba(239,241,234,0.65)" }}>{t("modeExam")} · {session.quizName}</p>
              <p className="pmi-mono text-sm font-semibold mt-0.5">{t("questionOf", { n: idx + 1, total: questions.length })}</p>
            </div>
            <div className="text-right">
              <p className="pmi-eyebrow" style={{ color: "rgba(239,241,234,0.65)" }}>{t("timeLabel")}</p>
              <p className="pmi-mono text-lg font-semibold tabular-nums">{fmtClock(sessionElapsedMs)}</p>
            </div>
          </div>
          <div className="pmi-ticket-body px-4 py-2 flex items-center justify-between">
            <button onClick={onExit} className="pmi-focusable text-xs" style={{ color: "var(--ink-soft)" }}>{t("exitSaved")}</button>
            <button onClick={toggleFlag} className="pmi-focusable flex items-center gap-1 text-xs font-medium" style={{ color: isFlagged ? "var(--seal-fg)" : "var(--ink-soft)" }}>
              <Icon name="flag" size={14} /> {t("flagTooltip")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-3">
          <button onClick={onExit} className="pmi-focusable text-xs" style={{ color: "var(--ink-soft)" }}>{t("exitSaved")}</button>
          <div className="flex items-center gap-3">
            <span className="pmi-mono text-[11px]" style={{ color: "var(--ink-soft)" }}>{fmtClock(questionElapsedMs)}</span>
            <span className="pmi-eyebrow">{t(session.mode === "practice" ? "modePractice" : "modeFillgap")}</span>
            <button onClick={toggleFlag} className="pmi-focusable" style={{ color: isFlagged ? "var(--seal-fg)" : "var(--ink-soft)" }}>
              <Icon name="flag" size={16} />
            </button>
          </div>
        </div>
      )}

      {!isExam && (
        <div className="flex items-center justify-between mb-3">
          <p className="pmi-mono text-sm font-semibold">{t("questionOf", { n: idx + 1, total: questions.length })}</p>
        </div>
      )}
      <ProgressBar value={answeredCount / questions.length} className="mb-4" />

      {isMatching ? (
        <MatchingQuestion question={q} mode={session.mode} />
      ) : (
        <Card className="mb-3">
          {q.manualReview && <p className="text-xs mb-2 flex items-center gap-1" style={{ color: "var(--seal-fg)" }}><Icon name="warn" size={13} /> {t("manualReviewWarn")}</p>}
          <div className="flex justify-end mb-2">
            <BilingualToggle on={viOn} onClick={() => requestViOn(!viOn)} compact />
          </div>
          <p className="text-sm leading-relaxed mb-1 whitespace-pre-wrap">{q.stem}</p>
          {viOn && <BilingualStemBlock viItem={VI_ITEM_INDEX.get(q.id)} expandedTerm={expandedTerm} onExpandTerm={requestExpandTerm} />}
          <div className="space-y-2 mt-3">
            {q.choices.map((c) => {
              const cid = normOpt(c.id);
              const isSel = selected.includes(cid);
              const isCorrectChoice = revealed && (q.correctOptionIds || []).map(normOpt).includes(cid);
              const isWrongSel = revealed && isSel && !isCorrectChoice;
              let stateCls = "";
              if (revealed) {
                if (isCorrectChoice) stateCls = "is-correct";
                else if (isWrongSel) stateCls = "is-wrong";
              } else if (isSel) {
                stateCls = "is-selected";
              }
              return (
                <button
                  key={c.id}
                  onClick={() => toggleChoice(c.id)}
                  disabled={revealed && session.mode !== "exam"}
                  className={`pmi-choice pmi-focusable w-full px-3 py-3 text-sm flex items-start gap-2 ${stateCls}`}
                >
                  <span className="pmi-choice-letter uppercase shrink-0">{c.id}.</span>
                  <span className="flex-1">
                    {c.text}
                    {viOn && <ChoiceViLine questionId={q.id} choiceId={c.id} />}
                  </span>
                  {revealed && isCorrectChoice && <Icon name="check" size={16} style={{ color: "var(--sage)" }} className="shrink-0" />}
                  {revealed && isWrongSel && <Icon name="x" size={16} style={{ color: "var(--flag)" }} className="shrink-0" />}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {!isMatching && session.mode !== "exam" && (
        <Card className="mb-3">
          <p className="pmi-eyebrow mb-2">{t("confidenceLabel")}</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setConfidence(n)}
                className="pmi-focusable pmi-mono flex-1 py-1.5 rounded-lg text-xs font-semibold"
                style={confidence === n ? { background: "var(--accent)", color: "var(--accent-fg)" } : { background: "var(--paper)", border: "1px solid var(--line-strong)", color: "var(--ink-mid)" }}
              >{n}</button>
            ))}
            <button
              onClick={() => setConfidence(null)}
              className="pmi-focusable px-2 rounded-lg text-xs"
              style={confidence === null ? { background: "var(--line-strong)" } : { background: "var(--paper)", border: "1px solid var(--line-strong)", color: "var(--ink-mid)" }}
            >{t("notRecorded")}</button>
          </div>
        </Card>
      )}

      {!isMatching && revealed && (
        <Card className="mb-3">
          <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
            <p className="pmi-eyebrow">{t("explanationHeader")}</p>
            {!viOn && <BilingualToggle on={false} onClick={() => requestViOn(true)} compact />}
          </div>
          <p className="pmi-mono text-[11px] mb-2" style={{ color: "var(--ink-soft)" }}>{t("correctAnswerLabel")}: {(q.correctOptionIds || []).join(", ").toUpperCase() || "—"}</p>
          <ExplanationText text={q.explanationShort} />
          {viOn && <BilingualAnswerBlock viItem={VI_ITEM_INDEX.get(q.id)} />}
        </Card>
      )}

      <div className="flex gap-2 mb-2">
        <Button variant="secondary" onClick={() => goTo(idx - 1)} disabled={idx === 0} className="flex-1 flex items-center justify-center gap-1">
          <Icon name="left" size={14} /> {t("prevBtn")}
        </Button>
        {!isMatching && session.mode !== "exam" && !revealed && (
          <Button onClick={handleCheck} disabled={!selected.length} className="flex-1">{t("checkBtn")}</Button>
        )}
        {canGoNext && !isLast && (
          <Button onClick={() => goTo(idx + 1)} className="flex-1 flex items-center justify-center gap-1">
            {t("nextBtn")} <Icon name="right" size={14} />
          </Button>
        )}
        {isLast && canGoNext && (
          <Button onClick={() => { if (!isMatching && selected.length && !revealed) persistAnswer(selected, confidence); setConfirmSubmit(true); }} variant="danger" className="flex-1">{t("submitBtn")}</Button>
        )}
      </div>

      {!isWide && (
        <div className="flex gap-2">
          {!isLast && (
            <button
              onClick={() => { if (!isMatching && selected.length && !revealed) persistAnswer(selected, confidence); setConfirmSubmit(true); }}
              className="pmi-focusable shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg"
              style={{ color: "var(--ink-mid)", border: "1.5px dashed var(--line-strong)" }}
            >
              <Icon name="x" size={13} /> {t("finishEarlyBtn")}
            </button>
          )}
          <button
            onClick={() => setShowPalette(true)}
            className="pmi-focusable flex-1 min-w-0 flex items-center justify-between rounded-lg px-3 py-2"
            style={{ border: "1px solid var(--line-strong)", background: "var(--paper-raised)" }}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="pmi-mono text-xs font-semibold shrink-0">{answeredCount}/{questions.length}</span>
              {flaggedCount > 0 && (
                <span className="pmi-mono flex items-center gap-1 text-[11px] shrink-0" style={{ color: "var(--seal-fg)" }}>
                  <Icon name="flag" size={11} /> {flaggedCount}
                </span>
              )}
            </span>
            <Icon name="right" size={13} style={{ color: "var(--ink-mid)" }} className="shrink-0" />
          </button>
        </div>
      )}
      {isWide && !isLast && (
        <button
          onClick={() => { if (!isMatching && selected.length && !revealed) persistAnswer(selected, confidence); setConfirmSubmit(true); }}
          className="pmi-focusable w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg"
          style={{ color: "var(--ink-mid)", border: "1.5px dashed var(--line-strong)" }}
        >
          <Icon name="x" size={13} /> {t("finishEarlyBtn")}
        </button>
      )}

      {!isWide && showPalette && (
        <div className="fixed inset-0 flex items-end justify-center z-50" style={{ background: "rgba(22,35,63,0.4)" }} onClick={() => setShowPalette(false)}>
          <div className="pmi-card rounded-t-2xl p-0 w-full max-w-md flex flex-col" style={{ maxHeight: "78vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--line)" }}>
              <p className="pmi-display font-semibold">{t("paletteSheetTitle")}</p>
              <button onClick={() => setShowPalette(false)} className="pmi-focusable p-1" style={{ color: "var(--ink-soft)" }}>
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="px-4 pt-3 overflow-y-auto">
              <PaletteBody
                questions={questions}
                filteredIndices={filteredIndices}
                paletteFilter={paletteFilter}
                setPaletteFilter={setPaletteFilter}
                idx={idx}
                visitedIds={visitedIds}
                session={session}
                isDone={isDone}
                onJump={(i) => { goTo(i); setShowPalette(false); }}
                unansweredForFilter={unansweredForFilter}
                flaggedCount={flaggedCount}
              />
            </div>
            <div style={{ height: 12 }} />
          </div>
        </div>
      )}

      {confirmSubmit && (
        <div className={`fixed inset-0 flex ${isDesktop ? "items-center" : "items-end"} justify-center z-50`} style={{ background: "rgba(22,35,63,0.4)" }} onClick={() => setConfirmSubmit(false)}>
          <div className={`pmi-card ${isDesktop ? "rounded-lg" : "rounded-t-2xl"} p-5 w-full max-w-md`} onClick={(e) => e.stopPropagation()}>
            <p className="pmi-display font-semibold mb-1">{t("submitConfirmTitle")}</p>
            <p className="text-xs mb-2" style={{ color: "var(--ink-mid)" }}>{t("submitConfirmBody", { n: answeredCount, total: questions.length })}</p>
            {unansweredCount > 0 && <p className="text-xs mb-4" style={{ color: "var(--seal-fg)" }}>{t("submitConfirmUnansweredWarn", { n: unansweredCount })}</p>}
            <div className="flex gap-2 mt-2">
              <Button variant="secondary" onClick={() => setConfirmSubmit(false)} className="flex-1">{t("cancelBtn")}</Button>
              <Button variant="danger" onClick={() => onFinish(true)} className="flex-1">{t("confirmSubmitBtn")}</Button>
            </div>
          </div>
        </div>
      )}

      {pendingHelp && (
        <div className={`fixed inset-0 flex ${isDesktop ? "items-center" : "items-end"} justify-center z-50`} style={{ background: "rgba(22,35,63,0.4)" }} onClick={() => setPendingHelp(null)}>
          <div className={`pmi-card ${isDesktop ? "rounded-lg" : "rounded-t-2xl"} p-5 w-full max-w-md`} onClick={(e) => e.stopPropagation()}>
            <p className="pmi-display font-semibold mb-1">{t("assistedConfirmTitle")}</p>
            <p className="text-xs mb-4" style={{ color: "var(--ink-mid)" }}>{t("assistedConfirmBody")}</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setPendingHelp(null)} className="flex-1">{t("cancelBtn")}</Button>
              <Button onClick={confirmPendingHelp} className="flex-1">{t("assistedConfirmOk")}</Button>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Panel danh sách câu hỏi cố định — chỉ ở màn hình rộng (≥1280px), đủ chỗ hiện luôn      */}
    {/* thay vì phải bấm mở overlay như trên mobile/tablet.                                     */}
    {isWide && (
      <div className="shrink-0" style={{ width: 320 }}>
        <Card className="sticky" style={{ top: 16 }}>
          <p className="pmi-display font-semibold mb-3">{t("paletteSheetTitle")}</p>
          <PaletteBody
            questions={questions}
            filteredIndices={filteredIndices}
            paletteFilter={paletteFilter}
            setPaletteFilter={setPaletteFilter}
            idx={idx}
            visitedIds={visitedIds}
            session={session}
            isDone={isDone}
            onJump={(i) => goTo(i)}
            unansweredForFilter={unansweredForFilter}
            flaggedCount={flaggedCount}
          />
        </Card>
      </div>
    )}
    </div>
  );
}
