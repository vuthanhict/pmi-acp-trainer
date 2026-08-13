/* ===================== Phân loại domain/task ECO cho đề SUPER 1 (quiz 89 + 90) =====================
   Toàn bộ 214 câu của hai đề này được nhúng vào ngân hàng khi chưa qua bước phân loại: domain =
   "Unclassified", taskId = null → gradeAttempt() trả eligibleForGap = false cho mọi câu → điểm
   Trusted của mọi lần làm đề SUPER 1 luôn là 0/0 (hiển thị 0%), và các câu này không đóng góp gì
   vào GAP theo domain/task.

   Script gán domain + taskId + taskName + confidence cho từng câu (đối chiếu nội dung câu hỏi và
   đáp án đúng với 24 task ECO đang dùng trong ngân hàng), rồi bật eligibleForGap. Confidence phản
   ánh mức chắc chắn của phép gán: câu có ngữ cảnh trải nhiều task được để 0.5-0.6, giống thang
   confidence sẵn có ở các đề khác.

   Chạy: node tools/classifySuper1.mjs
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

/* key = "<quizIndex>-<questionNumber>" → [taskId, confidence] */
const MAP = {
  "89-1": ["D5", 0.8], "89-2": ["L2", 0.7], "89-3": ["P1", 0.85], "89-4": ["D6", 0.6],
  "89-5": ["M3", 0.7], "89-6": ["M3", 0.7], "89-7": ["P4", 0.8], "89-8": ["L1", 0.65],
  "89-9": ["P1", 0.75], "89-10": ["D6", 0.65], "89-11": ["M4", 0.8], "89-12": ["L3", 0.75],
  "89-13": ["D6", 0.65], "89-14": ["P4", 0.55], "89-15": ["P1", 0.8], "89-16": ["D2", 0.8],
  "89-17": ["D2", 0.65], "89-18": ["P1", 0.7], "89-19": ["P1", 0.75], "89-20": ["P4", 0.8],
  "89-21": ["P4", 0.7], "89-22": ["P1", 0.7], "89-23": ["D6", 0.7], "89-24": ["L3", 0.85],
  "89-25": ["P4", 0.7], "89-26": ["L6", 0.7], "89-27": ["L1", 0.7], "89-28": ["D1", 0.75],
  "89-29": ["D5", 0.65], "89-30": ["M2", 0.65], "89-31": ["L2", 0.7], "89-32": ["L4", 0.65],
  "89-33": ["P1", 0.8], "89-34": ["D5", 0.55], "89-35": ["D1", 0.8], "89-36": ["D3", 0.7],
  "89-37": ["D3", 0.7], "89-38": ["D3", 0.55], "89-39": ["M4", 0.8], "89-40": ["P1", 0.75],
  "89-41": ["L4", 0.75], "89-42": ["D5", 0.7], "89-43": ["D3", 0.6], "89-44": ["L4", 0.75],
  "89-45": ["M1", 0.6], "89-46": ["L5", 0.8], "89-47": ["M7", 0.65], "89-48": ["L2", 0.65],
  "89-49": ["D6", 0.8], "89-50": ["L1", 0.65], "89-51": ["P1", 0.8], "89-52": ["P1", 0.7],
  "89-53": ["M2", 0.55], "89-54": ["D5", 0.85], "89-55": ["D6", 0.7], "89-56": ["D2", 0.8],
  "89-57": ["D7", 0.5], "89-58": ["D6", 0.7], "89-59": ["M6", 0.6], "89-60": ["P1", 0.75],
  "89-61": ["D2", 0.8], "89-62": ["D4", 0.55], "89-63": ["P1", 0.9], "89-64": ["P4", 0.6],
  "89-65": ["D5", 0.8], "89-66": ["D6", 0.75], "89-67": ["L2", 0.6], "89-68": ["P2", 0.55],
  "89-69": ["P1", 0.75], "89-70": ["D2", 0.85], "89-71": ["M5", 0.85], "89-72": ["D7", 0.8],
  "89-73": ["D4", 0.6], "89-74": ["L4", 0.7], "89-75": ["L5", 0.75], "89-76": ["P1", 0.65],
  "89-77": ["D1", 0.7], "89-78": ["D5", 0.8], "89-79": ["L1", 0.55], "89-80": ["L6", 0.85],
  "89-81": ["P1", 0.6], "89-82": ["D2", 0.55], "89-83": ["P2", 0.7], "89-84": ["D4", 0.7],
  "89-85": ["D2", 0.8], "89-86": ["L1", 0.75], "89-87": ["P1", 0.7], "89-88": ["P1", 0.7],
  "89-89": ["D3", 0.85], "89-90": ["D6", 0.65], "89-91": ["L3", 0.65], "89-92": ["D3", 0.6],
  "89-93": ["L5", 0.8], "89-94": ["D5", 0.65], "89-95": ["P1", 0.55], "89-96": ["P1", 0.6],
  "89-97": ["M3", 0.6], "89-98": ["D6", 0.55], "89-99": ["P1", 0.65], "89-100": ["L4", 0.5],
  "89-101": ["D7", 0.6], "89-102": ["D3", 0.6], "89-103": ["M1", 0.7], "89-104": ["D6", 0.75],
  "89-105": ["P1", 0.6], "89-106": ["L5", 0.65], "89-107": ["M3", 0.5],

  "90-108": ["P1", 0.6], "90-109": ["D5", 0.8], "90-110": ["L5", 0.6], "90-111": ["M3", 0.6],
  "90-112": ["P1", 0.7], "90-113": ["D4", 0.75], "90-114": ["L3", 0.7], "90-115": ["L1", 0.7],
  "90-116": ["D7", 0.55], "90-117": ["L3", 0.65], "90-118": ["D3", 0.8], "90-119": ["L4", 0.7],
  "90-120": ["P1", 0.7], "90-121": ["D3", 0.8], "90-122": ["D6", 0.7], "90-123": ["P1", 0.6],
  "90-124": ["P4", 0.55], "90-125": ["P1", 0.6], "90-126": ["D2", 0.85], "90-127": ["P2", 0.6],
  "90-128": ["D5", 0.6], "90-129": ["D5", 0.7], "90-130": ["D5", 0.6], "90-131": ["D5", 0.5],
  "90-132": ["P1", 0.7], "90-133": ["D7", 0.85], "90-134": ["M3", 0.7], "90-135": ["P2", 0.55],
  "90-136": ["P1", 0.75], "90-137": ["D5", 0.8], "90-138": ["L4", 0.55], "90-139": ["L2", 0.55],
  "90-140": ["P1", 0.6], "90-141": ["M4", 0.55], "90-142": ["P4", 0.65], "90-143": ["M7", 0.6],
  "90-144": ["L3", 0.65], "90-145": ["M1", 0.7], "90-146": ["D2", 0.7], "90-147": ["P1", 0.7],
  "90-148": ["M4", 0.7], "90-149": ["L4", 0.55], "90-150": ["L1", 0.65], "90-151": ["P1", 0.7],
  "90-152": ["D3", 0.7], "90-153": ["P1", 0.55], "90-154": ["M1", 0.65], "90-155": ["D7", 0.8],
  "90-156": ["L6", 0.7], "90-157": ["D1", 0.65], "90-158": ["P2", 0.55], "90-159": ["D2", 0.85],
  "90-160": ["M2", 0.5], "90-161": ["P1", 0.75], "90-162": ["D2", 0.85], "90-163": ["L3", 0.65],
  "90-164": ["P1", 0.6], "90-165": ["D3", 0.8], "90-166": ["P1", 0.5], "90-167": ["D1", 0.75],
  "90-168": ["L1", 0.7], "90-169": ["P4", 0.7], "90-170": ["P4", 0.55], "90-171": ["D5", 0.8],
  "90-172": ["D3", 0.6], "90-173": ["L3", 0.55], "90-174": ["P1", 0.65], "90-175": ["D3", 0.85],
  "90-176": ["L6", 0.55], "90-177": ["M7", 0.6], "90-178": ["L1", 0.55], "90-179": ["D6", 0.7],
  "90-180": ["M4", 0.7], "90-181": ["L2", 0.7], "90-182": ["D5", 0.7], "90-183": ["P2", 0.6],
  "90-184": ["D5", 0.8], "90-185": ["D6", 0.75], "90-186": ["P4", 0.55], "90-187": ["P1", 0.65],
  "90-188": ["L4", 0.7], "90-189": ["D6", 0.6], "90-190": ["M5", 0.65], "90-191": ["L1", 0.6],
  "90-192": ["D4", 0.7], "90-193": ["D6", 0.75], "90-194": ["P1", 0.8], "90-195": ["D2", 0.75],
  "90-196": ["P1", 0.8], "90-197": ["D3", 0.6], "90-198": ["M7", 0.6], "90-199": ["M1", 0.7],
  "90-200": ["P3", 0.6], "90-201": ["L5", 0.7], "90-202": ["M5", 0.65], "90-203": ["P1", 0.65],
  "90-204": ["L1", 0.75], "90-205": ["M1", 0.75], "90-206": ["L1", 0.6], "90-207": ["D4", 0.8],
  "90-208": ["L5", 0.6], "90-209": ["L3", 0.6], "90-210": ["P2", 0.6], "90-211": ["D6", 0.6],
  "90-212": ["L1", 0.65], "90-213": ["M3", 0.7], "90-214": ["D5", 0.75],
};

const quizEmbed = readPayload("QUIZ_EMBED_GZ_B64");
const used = new Set();
let updated = 0;

for (const quizIndex of ["89", "90"]) {
  const list = quizEmbed.data[quizIndex];
  if (!list) throw new Error(`không tìm thấy quiz ${quizIndex}`);
  for (const q of list) {
    const key = `${quizIndex}-${q.questionNumber}`;
    const hit = MAP[key];
    if (!hit) throw new Error(`thiếu phân loại cho ${key} (${q.id})`);
    const [taskId, confidence] = hit;
    const task = TASKS[taskId];
    if (!task) throw new Error(`taskId không hợp lệ: ${taskId} (${key})`);
    used.add(key);
    q.domain = task[0];
    q.taskId = taskId;
    q.taskName = task[1];
    q.confidence = confidence;
    // manualReview vẫn là false cho toàn bộ hai đề này (đã kiểm tra) — chỉ câu tự chấm được mới
    // được tính vào GAP, nên eligibleForGap bám theo manualReview.
    q.eligibleForGap = !q.manualReview;
    updated++;
  }
}

const orphan = Object.keys(MAP).filter((k) => !used.has(k));
if (orphan.length) throw new Error(`khoá thừa trong MAP: ${orphan.join(", ")}`);

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

console.log(`Đã phân loại ${updated} câu của đề SUPER 1 (quiz 89 + 90) và bật eligibleForGap.`);
