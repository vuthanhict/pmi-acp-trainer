/* ===================== Bổ sung hình minh họa còn thiếu cho các câu hỏi có ảnh =====================
   Nguồn: rà soát toàn bộ 89 quiz của khóa "PMI-ACP Exam Prep" trên LMS Atoha phát hiện 63 câu hỏi có
   hình minh họa (xem /Users/thanh/PMI-ACP/quiz-image/PMI_ACP_Cau_Hoi_Co_Hinh_Minh_Hoa_full/md/README.md).
   Trong 63 câu đó, chỉ 9 câu thuộc các đề thi thực sự có mặt trong bộ dữ liệu nhúng của app này (app chỉ
   nhúng 14/89 quiz — không có ET01-04, Andy Crowe, Hunt Ashley, StudyH2025). Các câu còn lại (Q25 đã sửa
   ở lượt trước bằng ảnh dựng lại gần đúng — nay thay bằng ảnh gốc thật) cũng nằm trong danh sách này.

   Chạy: node tools/fixImageQuestions.mjs
*/
import fs from "fs";
import zlib from "zlib";
import { readPayload } from "./extractEmbedded.mjs";

const SRC = "src/lib/embeddedData.js";

const FIXES = {
  q_53e1465f6426: {
    image: "images/PMIPracticeExam2024_Q25_1of1_team_health_radar_chart.png",
    imageAlt:
      'Biểu đồ radar "Team Score" thể hiện điểm trung bình của 8 hạng mục đánh giá đội (thang 1-5), với điểm thấp nhất ở "xung đột xây dựng" (1) và "cam kết đội" (3).',
  },
  q_7189b930c648: {
    image: "images/PMIPracticeExam2024_Q95_1of1_burnup_stable_velocity_scope_increase.png",
    imageAlt:
      "Biểu đồ burnup của dự án mobile: đường công việc hoàn thành tăng đều mỗi iteration, trong khi đường tổng scope (mục phát sinh) tăng dần, cho thấy scope creep.",
  },
  q_8f0263923c3d: {
    image: "images/SUPER1_Q16_1of1_backlog_points_jump_iter4.png",
    imageAlt: "Biểu đồ điểm backlog theo iteration (500 → 475 → 450 → 425 → 450), thể hiện điểm tăng đột ngột vào cuối iteration 4.",
  },
  q_00f1bf119445: {
    image: "images/SUPER1_Q126_1of1_planned_vs_completed_line_chart.png",
    imageAlt:
      "Biểu đồ đường so sánh story points dự kiến (Planned) và đã hoàn thành (Completed) theo ngày trong iteration, với đường Completed bắt đầu tụt dần so với Planned sau ngày 5, tạo khoảng cách ngày càng rộng.",
  },
  q_2a5fbecb555c: {
    image: "images/SUPER1_Q162_1of1_burndown_behind_schedule.png",
    imageAlt: "Biểu đồ burndown của iteration: đường tiến độ thực tế luôn nằm trên đường lý tưởng, cho thấy chậm tiến độ và chưa hoàn thành toàn bộ công việc.",
  },
  q_ff9086d40c50: {
    image: "images/Prepcast01_Q91_1of1_tradeoff_matrix_multiple_checks.png",
    imageAlt:
      "Bảng ma trận đánh đổi (tradeoff matrix) hiển thị ba ràng buộc dự án (scope, schedule, cost) và các cột Fixed / Flexible / Accept, trong đó một số cột có nhiều dấu tích thay vì chỉ có một dấu tích cho mỗi cột.",
  },
  q_2c1a41fa5dd6: {
    image: "images/Prepcast02_Q54_1of1_cumulative_flow_testing_bottleneck.png",
    imageAlt:
      "Biểu đồ lưu lượng tích lũy (Cumulative Flow Diagram) theo thời gian với các dải màu cho các bước quy trình (Backlog, Development, Testing, Done); tại Ngày 8 dải Development rộng đẩy sang dải Testing hẹp, cho thấy Testing là cổ chai.",
  },
  q_ef590fc1c9ba: {
    image: "images/Prepcast03_Q16_1of1_cumulative_flow_diagram.jpg",
    imageAlt:
      "Biểu đồ luồng tích lũy (cumulative flow diagram): biểu đồ vùng nhiều màu theo trục thời gian, hiển thị số lượng công việc theo trạng thái (To Do, In Progress, Done) để thấy WIP và lead time.",
  },
  q_19d900458fdc: {
    image: "images/Prepcast03_Q47_1of1_sprint_burndown_actual_above_schedule.jpg",
    imageAlt: "Biểu đồ burndown của sprint (10 ngày), đường Actual (xanh) nằm trên đường Schedule (đỏ) vào ngày 7, cho thấy tiến độ đang chậm.",
  },
  q_54657cee7bc5: {
    image: "images/Prepcast03_Q70_1of1_burndown_flat_scope_added.jpg",
    imageAlt:
      "Biểu đồ burndown release hiển thị công việc còn lại; đường thực tế gần như phẳng do có user stories được thêm vào trong iteration 2–4, thể hiện đội chỉ kịp hoàn thành scope mới.",
  },
};

const quizEmbed = readPayload("QUIZ_EMBED_GZ_B64");

let found = 0;
for (const list of Object.values(quizEmbed.data)) {
  for (const q of list) {
    const fix = FIXES[q.id];
    if (!fix) continue;
    q.image = fix.image;
    q.imageAlt = fix.imageAlt;
    found++;
  }
}
if (found !== Object.keys(FIXES).length) throw new Error(`kỳ vọng ${Object.keys(FIXES).length} câu, tìm thấy ${found}`);

function gzB64(obj) {
  return zlib.gzipSync(Buffer.from(JSON.stringify(obj)), { level: 9 }).toString("base64");
}
function replacePayload(src, name, b64) {
  const re = new RegExp(`(${name} = ")[^"]+(")`);
  if (!re.test(src)) throw new Error(`không tìm thấy payload ${name}`);
  return src.replace(re, `$1${b64}$2`);
}
let src = fs.readFileSync(SRC, "utf8");
src = replacePayload(src, "QUIZ_EMBED_GZ_B64", gzB64(quizEmbed));
fs.writeFileSync(SRC, src);

console.log(`Đã gắn ảnh cho ${found} câu: ${Object.keys(FIXES).join(", ")}`);
