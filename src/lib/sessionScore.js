/* ===================== Tính 4 loại điểm của một phiên làm bài ===================== */
/* Tách khỏi App.finishSession để cùng một công thức được dùng ở hai nơi: lúc nộp bài, và lúc
   migrate tính lại completedQuizzes cũ (xem recomputeCompletedScores trong storage.js).

   Điểm mấu chốt: tính "câu tin cậy" theo cờ eligibleForGap CỦA CÂU HỎI trong ngân hàng hiện tại,
   không theo cờ đã đóng băng trong attempt. Cờ trong attempt được ghi lúc trả lời; nếu sau đó câu
   hỏi được phân loại lại domain/task (như đề SUPER 1) thì cờ cũ sai và điểm Trusted sẽ kẹt ở 0/0
   vĩnh viễn. Chỉ khi câu không còn trong ngân hàng mới rơi về cờ cũ của attempt. */
import { QUESTION_INDEX } from "./embeddedData.js";

export function attemptIsTrusted(attempt) {
  const question = QUESTION_INDEX.get(attempt.questionId);
  return question ? !!question.eligibleForGap : !!attempt.eligibleForGap;
}

function pct(correct, total) {
  return total ? Number(((correct / total) * 100).toFixed(2)) : 0;
}

/**
 * @param {object[]} sessionAttempts attempts của đúng phiên này
 * @param {Set<string>} seenBeforeIds questionId đã gặp ở các phiên TRƯỚC đó
 */
export function computeSessionScores(sessionAttempts, seenBeforeIds) {
  const graded = sessionAttempts.filter((a) => a.gradeStatus === "graded");
  const trusted = graded.filter(attemptIsTrusted);
  const trustedCorrect = trusted.filter((a) => a.isCorrect).length;
  const rawGraded = sessionAttempts.filter((a) => a.gradeStatus !== "manual_review");
  const rawCorrect = rawGraded.filter((a) => a.isCorrect).length;
  const independent = trusted.filter((a) => !a.supportUsage?.assisted);
  const independentCorrect = independent.filter((a) => a.isCorrect).length;
  // Điểm "lần đầu gặp": chỉ tính những câu chưa từng xuất hiện ở BẤT KỲ phiên nào trước đó.
  // Làm lại một bộ đề thì phần lớn điểm tăng là do nhớ đáp án; con số này tách phần đó ra
  // để người học không tự tin sai trước kỳ thi thật.
  const firstExposure = trusted.filter((a) => !seenBeforeIds.has(a.questionId));
  const firstExposureCorrect = firstExposure.filter((a) => a.isCorrect).length;

  return {
    rawScore: { correct: rawCorrect, graded: rawGraded.length, percent: pct(rawCorrect, rawGraded.length) },
    trustedScore: { correct: trustedCorrect, graded: trusted.length, percent: pct(trustedCorrect, trusted.length) },
    independentScore: independent.length
      ? { correct: independentCorrect, graded: independent.length, percent: pct(independentCorrect, independent.length) }
      : null,
    firstExposureScore: firstExposure.length
      ? { correct: firstExposureCorrect, graded: firstExposure.length, percent: pct(firstExposureCorrect, firstExposure.length) }
      : null,
  };
}
