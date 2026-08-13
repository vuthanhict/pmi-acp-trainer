/* ===================== Rà lại 108 câu bị treo cờ manualReview =====================
   Sau tools/classifyRemaining.mjs, ngân hàng còn 111 câu manualReview = true. Trong đó:
     - 108 câu CHẤM TỰ ĐỘNG ĐƯỢC (107 single_select + 1 multiple_select, đều có correctOptionIds).
       Cờ được đặt chỉ vì bộ phân loại tự động có confidence = 0.54, dưới ngưỡng 0.55 — tức là
       "phân loại chưa chắc", không phải "không chấm được". Nhưng gradeAttempt() hiểu là không
       chấm được, nên 108 câu (6,4% ngân hàng) không bao giờ được tính vào điểm và bị GAP bỏ qua.
     - 3 câu matching KHÔNG có correctOptionIds — thật sự không chấm tự động được. Giữ nguyên cờ.

   Script này tách hai khái niệm đang bị gộp: manualReview từ nay chỉ có nghĩa "không chấm tự động
   được"; độ chắc chắn của phân loại nằm ở confidence.

   Phân loại cũ của 108 câu lệch rõ rệt (D3 ôm 37 câu = 34%, trong khi P1/P2/P4/M4/M7/L2/L3/L4
   không có câu nào) — dấu hiệu bộ phân loại đổ dồn về một task khi không chắc. Cả 108 câu đã được
   đọc lại thủ công; MAP dưới đây là phân loại sau khi rà, kèm ghi chú lý do ở các câu đổi task.

   Chạy: node tools/reviewManualReview.mjs
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

const MAP = {
  q_68d403b5ee2d: ["L4", 0.5],  // capitalization vs expense: điều chỉnh thực hành tài chính cho agile
  q_260b240cda0d: ["M7", 0.6],  // adaptive action khi kế hoạch thay đổi (cũ: D4)
  q_4cbf00993f39: ["L6", 0.7],  // Hersey + giai đoạn storming, xung đột gay gắt (cũ: D3)
  q_32c6346f71a6: ["D5", 0.65], // velocity giảm → đưa ra retrospective (cũ: D2)
  q_a51ac5900752: ["D1", 0.7],  // wireframe để lấy phản hồi sớm
  q_d317722aed9d: ["D1", 0.7],  // wireframe/prototype cho khách hình dung
  q_c6b6540a9c68: ["P2", 0.55], // iteration zero: dựng môi trường (cũ: D3)
  q_96545e372af6: ["M3", 0.75], // colocation tạo môi trường cộng tác (cũ: D3)
  q_824880e04c39: ["L6", 0.65], // retrospective căng thẳng → xử lý xung đột (cũ: D5)
  q_a4fc519cfbe1: ["L1", 0.55], // decision framing: ai nên tham gia quyết định (cũ: D3)
  q_7d4010903da9: ["L4", 0.6],  // giải thích ước lượng/lập kế hoạch lặp cho stakeholder (cũ: L1)
  q_0d612311a7b8: ["D2", 0.7],  // cone of uncertainty
  q_42eb413fd343: ["D2", 0.75], // dùng velocity lịch sử kèm dải bất định
  q_63b86a9ad029: ["D5", 0.8],  // mục tiêu của retrospective
  q_efbb8aa05248: ["D2", 0.8],  // burndown chart
  q_e9ba2ce24408: ["L1", 0.55], // nhịp bền vững theo capacity của đội (cũ: D2)
  q_725530f120ad: ["D3", 0.85], // quản lý rủi ro liên tục
  q_2d3f64302922: ["L1", 0.6],  // vắng họp → nói riêng, hỗ trợ (cũ: D5)
  q_5499fd5b082c: ["D2", 0.8],  // burndown chart
  q_73bf50add197: ["M3", 0.6],  // cải thiện cách giao tiếp trong đội (cũ: D5)
  q_c399eb757f80: ["M3", 0.6],  // giao tiếp hiệu quả qua daily stand-up (cũ: D3)
  q_8a6177fb2d9f: ["P2", 0.55], // timeboxing cho iteration (cũ: L5)
  q_fbe1b424d77e: ["P1", 0.85], // mục đích của product backlog (cũ: L5)
  q_ac286071f9bb: ["D3", 0.7],  // gỡ block nêu trong stand-up
  q_9cc2a8d5028b: ["D3", 0.55], // vai trò SM trong stand-up, xử lý impediment
  q_4675f442ed4d: ["L1", 0.6],  // trễ hạn liên tục → nói riêng, tìm nguyên nhân
  q_438569126c8e: ["D3", 0.5],  // mục đích daily stand-up
  q_c447ce84a126: ["M7", 0.65], // PO muốn chốt scope 3 sprint → giải thích tính thích ứng (cũ: D3)
  q_d107ede7babf: ["D3", 0.6],  // impediment → điều chỉnh sprint backlog cùng PO
  q_4b92188c5cf0: ["L6", 0.75], // xung đột dev - tester
  q_80ca5d82d8cb: ["D3", 0.7],  // phụ thuộc ngoài gây trễ
  q_2170c8ac3ffa: ["D4", 0.75], // chờ phê duyệt = lãng phí
  q_7bd739a1ef35: ["P1", 0.7],  // mục đích của persona (cũ: L5)
  q_9f6b1eaf831d: ["D3", 0.6],  // SM gỡ impediment cho dòng chảy giao hàng
  q_c6f7aadc9beb: ["D7", 0.65], // tăng tốc giao hàng → gỡ nút thắt (cũ: D5)
  q_24a170cb389b: ["D5", 0.6],  // đội mất gắn kết → retrospective
  q_0d845e99bfbd: ["D5", 0.7],  // ưu tiên cải tiến có tác động ngay
  q_6573a1c22358: ["D7", 0.6],  // item kẹt ở In Progress (Kanban) (cũ: D3)
  q_4df545911fd1: ["L4", 0.55], // chọn cách tiếp cận phù hợp ngữ cảnh (cũ: D3)
  q_bc53086e5f0b: ["D6", 0.7],  // ưu tiên stakeholder theo power/interest (cũ: D3)
  q_6b0f3bee657d: ["L5", 0.65], // đội mất động lực → nhắc lại ý nghĩa dự án (cũ: L1)
  q_871568ccf5d1: ["D4", 0.55], // tránh lập kế hoạch chi tiết từ đầu
  q_ae66bfd34c2c: ["L1", 0.65], // người làm việc mới là người ước lượng
  q_5cfca80fc7fc: ["L6", 0.6],  // nói xấu sau lưng → đối diện hành vi (cũ: D1)
  q_263933cfaf1c: ["M3", 0.65], // công cụ low-tech high-touch thúc đẩy cộng tác (cũ: M2)
  q_8fb7d95e20bc: ["D5", 0.6],  // ESVP trong retrospective (cũ: D3)
  q_9ab0b836a1ae: ["L4", 0.5],  // đạo đức nghề nghiệp: không chia sẻ thông tin mật (cũ: L1)
  q_dd91bdc709b2: ["M3", 0.6],  // team charter / social contract (cũ: L5)
  q_6da1fb9c8d47: ["D3", 0.85], // xử lý rủi ro severity cao trước
  q_e7e71755f7da: ["L6", 0.6],  // nguyên tắc đàm phán (cũ: L1)
  q_ca44c98b88e3: ["M3", 0.55], // thành viên dành 100% cho dự án
  q_eeacfd8f0238: ["L6", 0.8],  // xác định cấp độ xung đột
  q_a928644e188a: ["D5", 0.6],  // ESVP trong retrospective (cũ: D4)
  q_07ff8982f8de: ["D4", 0.7],  // họp không liên quan = lãng phí thời gian
  q_5f1e8422edb8: ["P2", 0.6],  // lập iteration theo capacity thực tế (cũ: M3)
  q_f20013d045fd: ["D4", 0.55], // agile modeling: tài liệu vừa đủ, không cầu kỳ (cũ: D3)
  q_f14f96e36878: ["M3", 0.6],  // Tuckman: giai đoạn forming (cũ: L6)
  q_041577b5ba98: ["L4", 0.55], // vai trò trong XP (cũ: L1)
  q_4660464849c2: ["L4", 0.5],  // đạo đức: khai báo xung đột lợi ích (cũ: L6)
  q_9d9e32cd1e5b: ["L3", 0.8],  // wiki = explicit knowledge (cũ: L1)
  q_d886c67b9f07: ["L4", 0.6],  // Shu-Ha-Ri: đội đã ở mức Ri (cũ: D1)
  q_ec509c0d0bf6: ["D3", 0.55], // hợp đồng chia sẻ rủi ro - lợi ích với vendor
  q_b0363401b8b3: ["D5", 0.65], // refactoring làm đều trong công việc thường (cũ: D4)
  q_3b7c8f4ce550: ["M1", 0.65], // spike để tránh sunk cost (cũ: D1)
  q_6e080b7f477c: ["L6", 0.6],  // legal ép thêm story → đàm phán
  q_5426d43a6d61: ["M4", 0.8],  // minh bạch trong empirical process control (cũ: D3)
  q_64d8dfde4caa: ["M1", 0.7],  // fail fast ở sprint đầu (cũ: D3)
  q_f5469ba43938: ["D3", 0.85], // risk exposure = xác suất × mức thiệt hại
  q_9167e08a07d0: ["D5", 0.55], // code nhanh sinh technical debt (cũ: M1)
  q_43f01defb74a: ["D3", 0.75], // reserve analysis
  q_f79b288eb847: ["D3", 0.8],  // phân tích rủi ro định lượng
  q_e33066159ada: ["L1", 0.6],  // hiệu suất giảm → tìm hiểu động lực cá nhân (cũ: D5)
  q_771e3bce5c36: ["D6", 0.6],  // đánh đổi bảo mật → hỏi ý kiến stakeholder (cũ: D3)
  q_0bf91b34bcf2: ["D7", 0.6],  // hoãn khởi động item B (cũ: D3)
  q_9e0db25d0b52: ["M6", 0.55], // giảm test tích hợp chung vi phạm continuous integration (cũ: D4)
  q_598706c1b3c4: ["L5", 0.75], // tính năng lệch mục tiêu → nhắc lại tầm nhìn (cũ: D3)
  q_444f35986939: ["D6", 0.55], // bỏ tính năng compliance → phải báo bộ phận liên quan (cũ: L5)
  q_b188706271f4: ["L1", 0.55], // decision framing (trùng nội dung q_a4fc519cfbe1) (cũ: D5)
  q_1a1807fb6287: ["M2", 0.55], // lợi ích của systems thinking (cũ: L5)
  q_81c4c633717f: ["M3", 0.75], // colocation → osmotic communication (cũ: D2)
  q_3e0a271fa3b4: ["L4", 0.6],  // trùng nội dung q_7d4010903da9 (cũ: D3)
  q_22cc2649d89a: ["M3", 0.6],  // "cave": làm việc riêng trong đội colocated (cũ: L1)
  q_6d3a3bd38099: ["L4", 0.65], // giải thích progressive elaboration cho PMO (cũ: L1)
  q_50b7c7fe6c94: ["P4", 0.55], // cộng tác với vendor để tối ưu giá trị bàn giao (cũ: M3)
  q_3d2293be3708: ["P1", 0.6],  // chọn giải pháp dựa trên yêu cầu phi chức năng (cũ: M1)
  q_796890674d98: ["M3", 0.6],  // nêu roadblock ở stand-up để cả đội cùng sở hữu (cũ: D3)
  q_a981a1cc1316: ["M3", 0.7],  // giao tiếp mặt đối mặt hiệu quả nhất (cũ: M2)
  q_974e7132fd0a: ["D5", 0.5],  // nhận định về technical debt (cũ: D3)
  q_e7525f492c31: ["M7", 0.55], // khách đổi ý → hợp đồng linh hoạt, chỉnh DoD (cũ: D1)
  q_d715646b7197: ["D6", 0.65], // PO gặp stakeholder bàn đánh đổi (cũ: L1)
  q_5181eb234e8d: ["L6", 0.7],  // đội thiếu tin tưởng, nhiều xung đột (cũ: D1)
  q_07105c64dbbe: ["D1", 0.65], // hết timebox → demo phần đã hoàn thành
  q_8f294c93a7aa: ["M3", 0.6],  // "cave" (cũ: D7)
  q_14eaca6d581d: ["D3", 0.65], // yêu cầu thêm sát ngày go-live → nêu rủi ro với khách
  q_20ff8bb5254f: ["D2", 0.7],  // nghỉ phép đã biết trước không ảnh hưởng release plan
  q_f939d0e45583: ["D2", 0.7],  // hiểu sai về velocity
  q_47f581337592: ["D3", 0.7],  // bước tiếp theo sau khi brainstorm rủi ro
  q_faa2e8d9c9a1: ["D3", 0.55], // mất người duy nhất có chuyên môn → rủi ro hiện thực hoá (cũ: M3)
  q_48de7fd1840d: ["D6", 0.7],  // stakeholder bất ngờ vì thay đổi → cập nhật thường xuyên (cũ: D1)
  q_24bb6c82bf08: ["M5", 0.6],  // brainstorming: không phê phán (cũ: D3)
  q_ae29e60a16eb: ["M4", 0.6],  // sai sót nghiêm trọng phải nói ngay, không giấu tới retro (cũ: D5)
  q_728bcfea6ab9: ["D4", 0.7],  // rework là triệu chứng
  q_d4329f916ef8: ["D7", 0.55], // kết hợp iterative + lean để trị vấn đề dòng chảy (cũ: D4)
  q_cb7d50eaad6e: ["L1", 0.6],  // thông tin không được cập nhật → trao đổi cởi mở với thành viên
  q_32a43980ea85: ["D3", 0.85], // spike + đưa phản ứng rủi ro vào backlog (multiple_select)
  q_5a0405e2a975: ["D3", 0.5],  // điểm nào nên đưa ra ngoài daily
  q_9a7cba329806: ["L6", 0.6],  // tranh luận dài về độ dài iteration
  q_8b3d33181d13: ["D3", 0.7],  // quy trình/compliance chặn đội → mời stakeholder liên quan
};

const quizEmbed = readPayload("QUIZ_EMBED_GZ_B64");
const seen = new Set();
const changes = [];

for (const list of Object.values(quizEmbed.data)) {
  for (const q of list) {
    const hit = MAP[q.id];
    if (!hit) continue;
    if (!q.manualReview) throw new Error(`${q.id} không còn cờ manualReview — MAP đã lỗi thời`);
    if (!(q.correctOptionIds || []).length) {
      throw new Error(`${q.id} không có đáp án đúng — không được bỏ cờ manualReview`);
    }
    const [taskId, confidence] = hit;
    const task = TASKS[taskId];
    if (!task) throw new Error(`taskId không hợp lệ: ${taskId} (${q.id})`);
    seen.add(q.id);
    if (q.taskId !== taskId) changes.push(`${q.id}: ${q.taskId} → ${taskId}`);
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

// Chỉ còn lại các câu THẬT SỰ không chấm tự động được mới được giữ cờ.
const left = Object.values(quizEmbed.data).flat().filter((q) => q.manualReview);
const wrong = left.filter((q) => (q.correctOptionIds || []).length);
if (wrong.length) throw new Error(`còn ${wrong.length} câu chấm được nhưng vẫn treo cờ manualReview`);

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

console.log(`Đã rà lại ${seen.size} câu: đổi task ${changes.length} câu, bỏ cờ manualReview toàn bộ.`);
console.log(`Còn ${left.length} câu giữ cờ manualReview (matching, không có đáp án để chấm).`);
