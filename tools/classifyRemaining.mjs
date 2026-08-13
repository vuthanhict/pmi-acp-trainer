/* ===================== Phân loại 44 câu "Unclassified" còn lại =====================
   Sau khi phân loại đề SUPER 1 (tools/classifySuper1.mjs), ngân hàng còn 44 câu rải rác ở 12 đề
   mang domain = "Unclassified", taskId = null, taskName = "Needs manual review", confidence = 0.2
   và manualReview = true.

   Điểm quan trọng: cờ manualReview của 44 câu này KHÔNG có nghĩa "không chấm tự động được" — cả
   44 câu đều là single_select, có correctOptionIds và explanationShort đầy đủ. Cờ được đặt chỉ vì
   bộ phân loại tự động không map được câu hỏi vào task ECO nào (phần lớn là câu kiến thức thuần:
   Dreyfus, TDD, XP, planning onion, agile triangle...). Nhưng gradeAttempt() lại hiểu manualReview
   là "không chấm được" → 44 câu này không bao giờ được tính vào bất kỳ loại điểm nào, và
   calculateGapProfile() cũng bỏ qua chúng.

   Vì vậy chỉ gán domain/task là chưa đủ: phải bỏ cờ manualReview thì câu mới thực sự được chấm và
   đóng góp vào GAP. Cả 44 câu đã được đọc thủ công để xác nhận có đúng một đáp án đúng rõ ràng.

   Chạy: node tools/classifyRemaining.mjs
*/
import fs from "fs";
import zlib from "zlib";
import { readPayload } from "./extractEmbedded.mjs";

const SRC = "src/lib/embeddedData.js";

const TASKS = {
  M1: ["Mindset", "Experiment Early"],
  M2: ["Mindset", "Embrace Agile Mindset"],
  M3: ["Mindset", "Promote Collaborative Team Environment"],
  M4: ["Mindset", "Build Transparency"],
  M5: ["Mindset", "Foster Psychological Safety"],
  M6: ["Mindset", "Shorten Feedback Loops"],
  M7: ["Mindset", "Embrace Change"],
  L1: ["Leadership", "Empower Teams"],
  L2: ["Leadership", "Facilitate Problem Resolution"],
  L3: ["Leadership", "Promote Knowledge Sharing"],
  L4: ["Leadership", "Promote Agile Mindset Principles and Practices"],
  L5: ["Leadership", "Promote Shared Vision and Purpose"],
  L6: ["Leadership", "Facilitate Conflict Management"],
  P1: ["Product", "Refine Product Backlog"],
  P2: ["Product", "Manage Increments"],
  P3: ["Product", "Visualize Work"],
  P4: ["Product", "Manage Value Delivery"],
  D1: ["Delivery", "Seek Early Feedback"],
  D2: ["Delivery", "Manage Agile Metrics"],
  D3: ["Delivery", "Manage Impediments and Risk"],
  D4: ["Delivery", "Recognize and Eliminate Waste"],
  D5: ["Delivery", "Perform Continuous Improvements"],
  D6: ["Delivery", "Actively Engage Customers"],
  D7: ["Delivery", "Optimize Flow"],
};

/* key = questionId → [taskId, confidence]. Confidence thấp (0.5) ở các câu kiến thức thuần vốn
   không thuộc hẳn task nào — chúng được xếp vào task gần nghĩa nhất. */
const MAP = {
  q_1133e4a6e51b: ["P2", 0.55], // closeout: bàn giao sản phẩm cuối cho vận hành
  q_a2b9dbbf67ce: ["M2", 0.55], // agile triangle: value / quality / constraints
  q_b891c7b7c14c: ["D3", 0.65], // parking lot cho roadblock sau daily scrum
  q_ff9086d40c50: ["P3", 0.5],  // đọc trade-off matrix: mỗi cột đúng một dấu
  q_837555f09765: ["D1", 0.7],  // usability testing với end user
  q_76f5ab99d703: ["L4", 0.55], // Dreyfus: competent
  q_0f0b180a4bb8: ["L5", 0.55], // project charter trên dự án agile
  q_e91b68e02a91: ["M2", 0.55], // bản chất Scrum: ít vai trò nhưng rule không thương lượng
  q_88381831cb68: ["P2", 0.6],  // Definition of Done là gì
  q_39873999e858: ["M7", 0.6],  // quản lý thay đổi scope trong sprint
  q_335e3dd38ba3: ["D5", 0.5],  // lợi ích TDD
  q_aea1a1f97fa1: ["P2", 0.6],  // ý nghĩa của DoD
  q_cb5d5ff837fd: ["L1", 0.55], // mục tiêu sprint phi thực tế → điều chỉnh theo capacity
  q_ff20c83200a9: ["D6", 0.6],  // stakeholder liên tục đổi increment đã nghiệm thu
  q_31195147ee3a: ["D6", 0.7],  // vai trò của việc user tham gia
  q_6c37dea87ddb: ["L1", 0.6],  // cân bằng tải giữa các thành viên
  q_93d5a5829186: ["P2", 0.6],  // xong sớm → kéo thêm việc từ backlog
  q_1b0c477d2ea7: ["M6", 0.55], // XP: tích hợp nhiều lần mỗi ngày
  q_2145ccc70f89: ["D5", 0.5],  // lợi ích TDD
  q_ada3cda19df0: ["D7", 0.6],  // CI/CD để release thường xuyên
  q_36bb36456658: ["M2", 0.6],  // triple constraints trong agile
  q_1791025809b2: ["L4", 0.55], // Dreyfus: expert
  q_2eea7bea4ddf: ["D5", 0.5],  // luồng TDD
  q_3de66ae86a5f: ["D5", 0.55], // giảm technical debt bằng refactoring
  q_8f4a9eadac86: ["P1", 0.65], // personas để xác định user role
  q_582f41cdc5b1: ["L4", 0.55], // Dreyfus: chọn expert cho việc phức tạp
  q_e66346fc716b: ["M6", 0.55], // XP: continuous integration
  q_607101319bfa: ["L4", 0.55], // Dreyfus: novice
  q_80ee695a6b60: ["D5", 0.5],  // exploratory testing vs scripted testing
  q_153b714b6279: ["D5", 0.5],  // loại test cần ít tài liệu nhất
  q_76412bbdb5f7: ["L5", 0.5],  // SMART goal thiếu yếu tố time-based
  q_7a7414d3fe90: ["D5", 0.55], // ruthless testing giữ chất lượng
  q_01cdcad33fd8: ["D6", 0.75], // cập nhật stakeholder analysis sau tái cấu trúc
  q_c42174e54ef5: ["L4", 0.65], // giải thích agile cơ bản cho stakeholder
  q_fcce2b433fdc: ["P1", 0.6],  // thông tin cần có trong persona
  q_4f398cda6b42: ["D5", 0.5],  // thứ tự Red - Green - Refactor
  q_c14530a74277: ["M2", 0.6],  // không có phương pháp agile "tốt nhất"
  q_5a9677ccaf45: ["P1", 0.5],  // product roadmap gồm những gì
  q_4288a0e60c79: ["L4", 0.65], // giải thích progressive planning khi bị đòi kế hoạch chi tiết
  q_d0d4112fd7d6: ["L4", 0.5],  // thứ tự Agile planning onion
  q_aa36935cd707: ["M4", 0.6],  // đội di chuyển liên tục → thông tin dự án phải luôn thấy được
  q_3f4f851db59d: ["D1", 0.55], // DoD yêu cầu test với người dùng thật → test liên tục
  q_9f85f2e26cbe: ["L2", 0.55], // PO và product manager bất đồng → làm rõ vai trò
  q_3b9f8d16a625: ["D6", 0.6],  // nguyên tắc: business và dev làm việc cùng nhau hằng ngày
};

const quizEmbed = readPayload("QUIZ_EMBED_GZ_B64");
const seen = new Set();

for (const list of Object.values(quizEmbed.data)) {
  for (const q of list) {
    const hit = MAP[q.id];
    if (!hit) continue;
    if (q.domain !== "Unclassified") throw new Error(`${q.id} đã được phân loại rồi (${q.domain})`);
    if (q.interactionType !== "single_select" || !(q.correctOptionIds || []).length) {
      throw new Error(`${q.id} không phải câu chấm tự động được — không được bỏ cờ manualReview`);
    }
    const [taskId, confidence] = hit;
    const task = TASKS[taskId];
    if (!task) throw new Error(`taskId không hợp lệ: ${taskId} (${q.id})`);
    seen.add(q.id);
    q.domain = task[0];
    q.taskId = taskId;
    q.taskName = task[1];
    q.confidence = confidence;
    q.manualReview = false;
    q.eligibleForGap = true;
  }
}

const missing = Object.keys(MAP).filter((id) => !seen.has(id));
if (missing.length) throw new Error(`không tìm thấy trong ngân hàng: ${missing.join(", ")}`);

const stillUnclassified = Object.values(quizEmbed.data).flat().filter((q) => q.domain === "Unclassified");
if (stillUnclassified.length) throw new Error(`còn ${stillUnclassified.length} câu chưa phân loại`);

// manualReviewCount trong catalog phải khớp lại sau khi bỏ cờ (dữ liệu tham chiếu, app không đọc).
for (const c of quizEmbed.catalog) {
  c.manualReviewCount = (quizEmbed.data[String(c.quizIndex)] || []).filter((q) => q.manualReview).length;
}

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

console.log(`Đã phân loại ${seen.size} câu còn lại và bỏ cờ manualReview (chấm tự động được).`);
