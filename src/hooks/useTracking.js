/* ===================== Tracking: hook ===================== */
import { useMemo } from "react";
import { DEFAULT_TZ, clamp, shiftDayKey, diffDayKeys, todayKey } from "../lib/utils.js";
import { buildDailyHistory, computeStreak, goalTargetCount, buildAccuracyTrend, buildMasteryTrend, computeReadiness } from "../lib/trackingEngine.js";

/** Tính lại toàn bộ số liệu tracking từ attempts. Không đọc/ghi bản sao tổng hợp nào. */
export function useTracking(progress, gapProfile) {
  const tz = progress.learner?.timezone || DEFAULT_TZ;
  const goal = progress.tracking?.dailyGoal || null;
  return useMemo(() => {
    const history = buildDailyHistory(progress.attempts, tz);
    const today = todayKey(tz);
    const todayRow = history.get(today) || null;
    const streak = computeStreak(history, goal, tz);
    const target = goalTargetCount(goal);
    const done = todayRow?.answered || 0;

    // Nhịp thực tế 14 ngày gần nhất (chia cho 14, không chia cho số ngày có hoạt động —
    // ngày nghỉ cũng là một phần của nhịp và phải kéo con số xuống).
    let last14 = 0;
    for (let i = 0; i < 14; i++) last14 += history.get(shiftDayKey(today, -i))?.answered || 0;
    const currentPace = Math.round(last14 / 14);

    const examDate = progress.tracking?.examDate || null;
    const daysLeft = examDate ? diffDayKeys(examDate, today) : null;
    // ~5 câu/task là mức tối thiểu để gap engine coi là "có bằng chứng" (evidence dùng
    // ngưỡng 8 câu phân biệt + 2 phiên; 5 là mốc thực dụng để thoát insufficient_data).
    const untouchedTasks = gapProfile.tasks.filter((tk) => tk.attempts === 0).length;
    const questionsNeeded = untouchedTasks * 5;
    const examDateInfo = {
      daysLeft,
      currentPace,
      paceOk: daysLeft && daysLeft > 0 ? currentPace * daysLeft >= questionsNeeded : false,
      questionsNeeded,
    };

    return {
      tz, today, history, todayRow, streak, goal, target, examDate, examDateInfo, currentPace,
      done,
      remaining: target ? Math.max(0, target - done) : 0,
      ratio: target ? clamp(done / target) : 0,
      goalMet: target ? done >= target : false,
      trend: buildAccuracyTrend(history, { tz }),
      masteryTrend: buildMasteryTrend(progress.gapSnapshots),
      readiness: computeReadiness(gapProfile, progress.attempts),
    };
    // gapProfile đã được memo hoá ở App theo attempts nên không cần thêm dependency.
  }, [progress.attempts, progress.gapSnapshots, progress.tracking?.examDate, goal, tz, gapProfile]);
}
