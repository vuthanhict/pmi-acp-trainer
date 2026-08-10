/* ===================== Study plan recommendation ===================== */
import { QUIZ_CATALOG } from "./embeddedData.js";

/* ---------- Study plan recommendation ---------- */
export function recommendNextQuiz(progress) {
  const doneSet = new Set(progress.completedQuizzes.map((c) => c.quizIndex));
  for (const c of QUIZ_CATALOG) {
    if (c.tier === "required" && !doneSet.has(c.quizIndex)) return c;
  }
  for (const c of QUIZ_CATALOG) {
    if (c.tier === "recommended" && !doneSet.has(c.quizIndex)) return c;
  }
  for (const c of QUIZ_CATALOG) {
    if (!doneSet.has(c.quizIndex)) return c;
  }
  return QUIZ_CATALOG[0];
}
