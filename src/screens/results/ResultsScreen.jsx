import { useState, useMemo } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { QUESTION_INDEX, VI_ITEM_INDEX } from "../../lib/embeddedData.js";
import { parseMatchingQuestion } from "../../lib/matching.js";
import { normOpt } from "../../lib/utils.js";
import { DOMAIN_MINDSET, EXAM_MINDSET_TIPS } from "../../i18n/text.js";
import { Card, Icon, Button, DeltaChip } from "../../components/ui/primitives.jsx";
import {
  BilingualToggle, BilingualStemBlock, ChoiceViLine, ExplanationText, BilingualAnswerBlock,
} from "../../components/bilingual/BilingualWidgets.jsx";
import { VocabPanelButton, VocabPanelSheet } from "../../components/vocab/QuestionVocabPanel.jsx";
import { InlineVocabText } from "../../components/vocab/InlineVocabText.jsx";
import { TermPopover } from "../../components/vocab/TermDetail.jsx";
import { questionVocabTerms } from "../../lib/questionVocab.js";

/* ===================== Review Question Card (dùng trong Results Screen) ===================== */
export function ReviewQuestionCard({ item, savedVocabIds, onToggleVocabSaved }) {
  const { t, lang } = useAppCtx();
  const [viOn, setViOn] = useState(false);
  const [expandedTerm, setExpandedTerm] = useState(null);
  const [vocabOpen, setVocabOpen] = useState(false);
  const [inlineTerm, setInlineTerm] = useState(null);
  const questionId = item.kind === "unanswered" || item.kind === "matching" ? item.q.id : item.a.questionId;
  const q = item.kind === "unanswered" || item.kind === "matching" ? item.q : QUESTION_INDEX.get(questionId);
  if (!q) return null;
  const viItem = VI_ITEM_INDEX.get(questionId);
  const badgeStyle = item.kind === "wrong" ? "pmi-status-critical" : item.kind === "correct" ? "pmi-status-ready" : item.kind === "matching" ? "pmi-status-developing" : "pmi-status-insufficient_data";
  const badgeLabel = item.kind === "wrong" ? t("resultsFilterWrong") : item.kind === "correct" ? t("resultsFilterCorrect") : item.kind === "matching" ? t("resultsFilterMatching") : t("resultsFilterUnanswered");
  const matchingParsed = item.kind === "matching" ? parseMatchingQuestion(q) : null;
  const selectedIds = item.kind === "unanswered" || item.kind === "matching" ? [] : (item.a.selectedOptionIds || []).map(normOpt);
  const correctIds = (q.correctOptionIds || []).map(normOpt);
  // Lúc xem lại thì mọi thứ đã lộ, nên gạch chân cả thẻ lấy từ phần giải thích.
  const inlineTerms = questionVocabTerms(questionId, true);
  return (
    <Card id={q.questionNumber ? `rev-q-${q.questionNumber}` : undefined}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {q.questionNumber != null && <span className="pmi-mono text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>{t("reviewQuestionNumber", { n: q.questionNumber })}</span>}
        <span className={`pmi-chip ${badgeStyle}`}>{badgeLabel}</span>
        {item.kind !== "unanswered" && item.kind !== "matching" && item.a.supportUsage?.assisted && <span className="pmi-chip pmi-status-developing">{t("assistedBadge")}</span>}
      </div>
      <div className="flex justify-end gap-1.5 mb-2 flex-wrap">
        {/* Lúc xem lại thì mọi thứ đã lộ, nên bảng từ vựng gồm cả thẻ lấy từ phần giải thích. */}
        <VocabPanelButton questionId={questionId} includePost onClick={() => setVocabOpen(true)} compact />
        <BilingualToggle on={viOn} onClick={() => setViOn((o) => !o)} compact />
      </div>
      {inlineTerm && (
        <TermPopover
          termId={inlineTerm.termId}
          anchorRect={inlineTerm.rect}
          saved={savedVocabIds?.has(inlineTerm.termId)}
          onToggleSave={(termId) => onToggleVocabSaved(termId, questionId, q.quizIndex)}
          onClose={() => setInlineTerm(null)}
        />
      )}
      {vocabOpen && (
        <VocabPanelSheet
          questionId={questionId}
          includePost
          savedIds={savedVocabIds}
          onToggleSave={(termId) => onToggleVocabSaved(termId, questionId, q.quizIndex)}
          onClose={() => setVocabOpen(false)}
        />
      )}
      <p className="text-sm mb-1 whitespace-pre-wrap">
        <InlineVocabText
          text={matchingParsed ? matchingParsed.intro || q.stem : q.stem}
          terms={inlineTerms}
          activeTermId={inlineTerm?.termId}
          onPickTerm={(id, rect) => setInlineTerm({ termId: id, rect })}
        />
      </p>
      {viOn && <BilingualStemBlock viItem={viItem} expandedTerm={expandedTerm} onExpandTerm={setExpandedTerm} />}
      {item.kind === "unanswered" && <p className="pmi-mono text-xs mb-2" style={{ color: "var(--ink-soft)" }}>{t("notAnsweredLabel")}</p>}
      {item.kind !== "unanswered" && item.kind !== "matching" && (
        <p className="pmi-mono text-xs mb-2" style={{ color: "var(--ink-soft)" }}>{t("confidenceShort")}: {item.a.confidence ?? t("notRecorded")}</p>
      )}
      {matchingParsed ? (
        <div className="pmi-mono text-xs space-y-1 mb-2 mt-1">
          {matchingParsed.statements.map((s, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span style={{ color: "var(--ink-mid)" }}>{s}</span>
              <span className="font-semibold shrink-0" style={{ color: "var(--sage)" }}>→ {matchingParsed.correctMap.get(s)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5 mb-2">
          {(q.choices || []).map((c) => {
            const cid = normOpt(c.id);
            const isCorrectChoice = correctIds.includes(cid);
            const isSel = selectedIds.includes(cid);
            const isWrongSel = isSel && !isCorrectChoice;
            let stateCls = "";
            if (isCorrectChoice) stateCls = "is-correct";
            else if (isWrongSel) stateCls = "is-wrong";
            return (
              <div key={c.id} className={`pmi-choice w-full px-3 py-2.5 text-sm flex items-start gap-2 ${stateCls}`}>
                <span className="pmi-choice-letter uppercase shrink-0">{c.id}.</span>
                <span className="flex-1">
                  <InlineVocabText
                    text={c.text}
                    terms={inlineTerms}
                    activeTermId={inlineTerm?.termId}
                    onPickTerm={(id, rect) => setInlineTerm({ termId: id, rect })}
                  />
                  {viOn && <ChoiceViLine questionId={questionId} choiceId={c.id} />}
                </span>
                {isCorrectChoice && <Icon name="check" size={15} style={{ color: "var(--sage)" }} className="shrink-0" />}
                {isWrongSel && <Icon name="x" size={15} style={{ color: "var(--flag)" }} className="shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <p className="pmi-eyebrow">{t("explanationHeader")}</p>
        {!viOn && <BilingualToggle on={false} onClick={() => setViOn(true)} compact />}
      </div>
      <ExplanationText text={q.explanationShort} className="text-xs mb-2" color="var(--ink-mid)" />
      {viOn && <BilingualAnswerBlock viItem={viItem} />}
      {item.kind === "wrong" && q.domain && DOMAIN_MINDSET[lang][q.domain] && (
        <p className="text-xs mt-2 flex gap-1.5" style={{ color: "var(--seal-fg)" }}>
          <span className="shrink-0">💡</span>
          <span>{DOMAIN_MINDSET[lang][q.domain]}</span>
        </p>
      )}
    </Card>
  );
}

/* ===================== Results Screen ===================== */
export function ResultsScreen({ sessionId, progress, onDone, onGap, backLabel, onToggleVocabSaved }) {
  const { t, lang } = useAppCtx();
  const [filter, setFilter] = useState("all");
  const [mindsetOpen, setMindsetOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpValue, setJumpValue] = useState("");
  const [jumpError, setJumpError] = useState(false);
  const entry = progress.completedQuizzes.find((c) => c.sessionId === sessionId);
  // Lượt gần nhất TRƯỚC lượt này của cùng bộ đề (nếu có) — dùng để so sánh tiến bộ.
  const prevEntry = useMemo(() => {
    if (!entry || entry.quizIndex == null) return null;
    const earlier = progress.completedQuizzes
      .filter((c) => c.quizIndex === entry.quizIndex && c.sessionId !== entry.sessionId && new Date(c.completedAt) < new Date(entry.completedAt))
      .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
    return earlier.length ? earlier[earlier.length - 1] : null;
  }, [entry, progress.completedQuizzes]);
  const savedVocabIds = useMemo(() => new Set(Object.keys(progress.vocabSaved || {})), [progress.vocabSaved]);
  const sessAttempts = progress.attempts.filter((a) => a.sessionId === sessionId);
  const wrong = sessAttempts.filter((a) => a.gradeStatus === "graded" && !a.isCorrect);
  const correctList = sessAttempts.filter((a) => a.gradeStatus === "graded" && a.isCorrect);
  const manual = sessAttempts.filter((a) => a.gradeStatus === "manual_review");

  // questionIds được lưu lại từ session gốc — cho phép biết câu nào bị bỏ qua khi "Nộp bài sớm"
  // (fallback rỗng cho các completedQuizzes cũ trước khi trường này tồn tại).
  const allQuestionIds = entry?.questionIds || [];
  const attemptedIds = new Set(sessAttempts.map((a) => a.questionId));
  // Câu ghép cặp (matching) không tạo attempt (luôn ungraded, tự thân) — tách riêng khỏi "chưa làm"
  // thật sự, vì trong Exam mode đây là nơi duy nhất xem được đáp án (đã khóa xem trước lúc làm bài).
  const matchingQuestions = allQuestionIds.map((qid) => QUESTION_INDEX.get(qid)).filter((q) => q && q.interactionType === "matching");
  const matchingIds = new Set(matchingQuestions.map((q) => q.id));
  const unansweredQuestions = allQuestionIds.filter((qid) => !attemptedIds.has(qid) && !matchingIds.has(qid)).map((qid) => QUESTION_INDEX.get(qid)).filter(Boolean);

  if (!entry) return <div className="pt-4 text-sm" style={{ color: "var(--ink-soft)" }}>—</div>;

  const filters = [
    { key: "all", label: t("resultsFilterAll"), count: wrong.length + correctList.length + unansweredQuestions.length + matchingQuestions.length },
    { key: "wrong", label: t("resultsFilterWrong"), count: wrong.length },
    { key: "correct", label: t("resultsFilterCorrect"), count: correctList.length },
    { key: "unanswered", label: t("resultsFilterUnanswered"), count: unansweredQuestions.length },
    ...(matchingQuestions.length ? [{ key: "matching", label: t("resultsFilterMatching"), count: matchingQuestions.length }] : []),
  ];

  // Gộp toàn bộ (không lọc) để dựng lưới "đi nhanh tới câu", sắp theo questionNumber cho nhất quán.
  const allItems = [
    ...wrong.map((a) => ({ kind: "wrong", a })),
    ...correctList.map((a) => ({ kind: "correct", a })),
    ...unansweredQuestions.map((q) => ({ kind: "unanswered", q })),
    ...matchingQuestions.map((q) => ({ kind: "matching", q })),
  ];
  function questionOf(item) {
    return item.kind === "unanswered" || item.kind === "matching" ? item.q : QUESTION_INDEX.get(item.a.questionId);
  }
  allItems.sort((x, y) => (questionOf(x)?.questionNumber ?? 0) - (questionOf(y)?.questionNumber ?? 0));

  const reviewItems = filter === "all" ? allItems : allItems.filter((item) => item.kind === filter);

  function jumpToQuestion(num) {
    const n = Number(num);
    const target = allItems.find((item) => questionOf(item)?.questionNumber === n);
    if (!target) {
      setJumpError(true);
      return;
    }
    setJumpError(false);
    setFilter("all");
    setJumpValue("");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(`rev-q-${n}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  return (
    <div className="pt-1 space-y-4 pb-4">
      <Card className="text-center py-6">
        <p className="pmi-eyebrow mb-1">{entry.quizName}</p>
        <p className="pmi-display font-bold text-5xl mb-3" style={{ color: entry.trustedScore.percent >= 70 ? "var(--sage)" : "var(--flag)" }}>{entry.trustedScore.percent}%</p>
        <p className="pmi-mono text-xs mb-1" style={{ color: "var(--ink-soft)" }}>{t("trustedLabel")}: {entry.trustedScore.correct}/{entry.trustedScore.graded} · {t("rawLabel")}: {entry.rawScore.correct}/{entry.rawScore.graded} ({entry.rawScore.percent}%)</p>
        <p className="pmi-mono text-xs mb-3" style={{ color: "var(--ink-soft)" }}>
          {t("independentLabel")}: {entry.independentScore ? `${entry.independentScore.percent}% (${entry.independentScore.correct}/${entry.independentScore.graded}, ${t("independentSuffix")})` : t("independentNoData")}
        </p>
        <p className="pmi-mono text-xs mb-3" style={{ color: "var(--ink-soft)" }}>
          {entry.firstExposureScore
            ? t("resultsFirstExposureLine", { p: Math.round(entry.firstExposureScore.percent), c: entry.firstExposureScore.correct, n: entry.firstExposureScore.graded })
            : t("resultsFirstExposureNone")}
        </p>
        {manual.length > 0 && <p className="text-xs" style={{ color: "var(--seal-fg)" }}>{t("manualReviewNote", { n: manual.length })}</p>}
        {unansweredQuestions.length > 0 && <p className="text-xs mt-1" style={{ color: "var(--seal-fg)" }}>{t("unansweredNote", { n: unansweredQuestions.length })}</p>}
      </Card>

      {/* So sánh với lần trước cùng bộ đề — đặt ngay sau điểm số, đúng khoảnh khắc người học
          quan tâm nhất và dễ tiếp nhận thông tin "sự thật" nhất. */}
      {entry.quizIndex != null && (
        <Card className="py-3">
          <p className="pmi-eyebrow mb-2">{t("resultsCompareHeader")}</p>
          {prevEntry ? (
            <div className="space-y-1 text-xs" style={{ color: "var(--ink-mid)" }}>
              <p className="flex items-center gap-2">
                <span>{t("resultsCompareTrusted", { prev: Math.round(prevEntry.trustedScore.percent), cur: Math.round(entry.trustedScore.percent) })}</span>
                <DeltaChip delta={entry.trustedScore.percent - prevEntry.trustedScore.percent} />
              </p>
              {entry.firstExposureScore && prevEntry.firstExposureScore && (
                <p className="flex items-center gap-2">
                  <span>{t("resultsCompareFirst", { prev: Math.round(prevEntry.firstExposureScore.percent), cur: Math.round(entry.firstExposureScore.percent) })}</span>
                  <DeltaChip delta={entry.firstExposureScore.percent - prevEntry.firstExposureScore.percent} />
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{t("resultsCompareNoPrev")}</p>
          )}
        </Card>
      )}

      <Card className="py-3">
        <button onClick={() => setMindsetOpen((o) => !o)} className="pmi-focusable w-full flex items-center justify-between">
          <span className="pmi-eyebrow" style={{ color: "var(--seal-fg)" }}>💡 {t("mindsetTipsHeader")}</span>
          <Icon name={mindsetOpen ? "chevronUp" : "chevronDown"} size={14} style={{ color: "var(--ink-soft)" }} />
        </button>
        {mindsetOpen && (
          <ul className="mt-2.5 space-y-1.5 text-xs" style={{ color: "var(--ink-mid)" }}>
            {EXAM_MINDSET_TIPS[lang].map((tip, i) => (
              <li key={i} className="flex gap-2">
                <span className="pmi-mono shrink-0" style={{ color: "var(--ink-soft)" }}>{i + 1}.</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex gap-1.5 overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="pmi-mono shrink-0 text-xs px-3 py-1.5 rounded-full font-medium"
            style={filter === f.key ? { background: "var(--accent)", color: "var(--accent-fg)" } : { background: "var(--paper)", border: "1px solid var(--line-strong)", color: "var(--ink-mid)" }}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      <Card className="py-3">
        <button onClick={() => setJumpOpen((o) => !o)} className="pmi-focusable w-full flex items-center justify-between">
          <span className="pmi-eyebrow">{t("jumpHeader")}</span>
          <Icon name={jumpOpen ? "chevronUp" : "chevronDown"} size={14} style={{ color: "var(--ink-soft)" }} />
        </button>
        {jumpOpen && (
          <div className="mt-3">
            <div className="flex gap-2 mb-3">
              <input
                type="number"
                inputMode="numeric"
                value={jumpValue}
                onChange={(e) => { setJumpValue(e.target.value); setJumpError(false); }}
                onKeyDown={(e) => { if (e.key === "Enter" && jumpValue) jumpToQuestion(jumpValue); }}
                placeholder={t("jumpPlaceholder")}
                className="pmi-mono text-sm px-3 py-2 rounded-lg flex-1 min-w-0"
                style={{ background: "var(--paper)", border: `1px solid ${jumpError ? "var(--flag)" : "var(--line-strong)"}`, color: "var(--ink)" }}
              />
              <Button onClick={() => jumpValue && jumpToQuestion(jumpValue)} className="shrink-0">{t("jumpGoBtn")}</Button>
            </div>
            {jumpError && <p className="text-xs mb-3" style={{ color: "var(--flag)" }}>{t("jumpNotFound", { n: jumpValue })}</p>}
            <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(34px, 1fr))" }}>
              {allItems.map((item) => {
                const q = questionOf(item);
                if (!q) return null;
                const cls = item.kind === "correct" ? "is-done" : item.kind === "wrong" ? "is-wrong" : item.kind === "matching" ? "is-visited" : "";
                return (
                  <button key={q.id} onClick={() => jumpToQuestion(q.questionNumber)} className={`pmi-bubble pmi-focusable h-8 ${cls}`}>
                    {q.questionNumber}
                  </button>
                );
              })}
            </div>
            <p className="pmi-mono text-[10px] text-center mt-3" style={{ color: "var(--ink-soft)" }}>{t("jumpLegend")}</p>
          </div>
        )}
      </Card>

      {reviewItems.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: "var(--ink-soft)" }}>{t("resultsEmptyFilter")}</p>
      ) : (
        <div className="space-y-2">
          {reviewItems.map((item) => {
            const questionId = item.kind === "unanswered" || item.kind === "matching" ? item.q.id : item.a.questionId;
            return (
              <ReviewQuestionCard
                key={questionId}
                item={item}
                savedVocabIds={savedVocabIds}
                onToggleVocabSaved={onToggleVocabSaved}
              />
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="secondary" onClick={onGap} className="flex-1">{t("viewGapBtn")}</Button>
        <Button onClick={onDone} className="flex-1">{backLabel || t("backHomeBtn")}</Button>
      </div>
    </div>
  );
}
