/* ===================== Tracking: hook ===================== */
import { useMemo } from "react";
import { DEFAULT_TZ, clamp, diffDayKeys, shiftDayKey, todayKey } from "../lib/utils.js";
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

    // Bề rộng thời gian của hai biểu đồ xu hướng: bám theo lịch sử THẬT thay vì cố định 30 ngày.
    // Cố định 30 thì người mới học 10 ngày phải nhìn 20 ô trống, còn người đã học 3 tháng thì mất
    // 2/3 dữ liệu. Trần 90 ngày để trục hoành không bị nén tới mức không đọc được nhãn.
    const activeDays = [...history.keys()].sort();
    const trendDays = activeDays.length
      ? clamp(diffDayKeys(today, activeDays[0]) + 1, 14, 90)
      : 30;
    // Phần tương lai kéo tới đúng NGÀY THI (trần 90 để trục không bị nén). Chưa đặt ngày thi thì
    // không vẽ phần này — không có mốc nào để kéo tới.
    const trendFutureDays = examDate ? clamp(diffDayKeys(examDate, today), 0, 90) : 0;

    return {
      tz, today, history, todayRow, streak, goal, target, examDate, currentPace,
      done,
      remaining: target ? Math.max(0, target - done) : 0,
      ratio: target ? clamp(done / target) : 0,
      goalMet: target ? done >= target : false,
      trendDays,
      trendFutureDays,
      trend: buildAccuracyTrend(history, { tz, days: trendDays, futureDays: trendFutureDays }),
      masteryTrend: buildMasteryTrend(progress.gapSnapshots, { tz, days: trendDays, futureDays: trendFutureDays }),
      readiness: computeReadiness(gapProfile, progress.attempts),
    };
    // gapProfile đã được memo hoá ở App theo attempts nên không cần thêm dependency.
  }, [progress.attempts, progress.gapSnapshots, progress.tracking?.examDate, goal, tz, gapProfile]);
}
