/* ===================== Giải quyết xung đột sourceTerm bị gán cho nhiều thẻ =====================
   Sau khi tách 68 thẻ lệch nghĩa (splitAmbiguousTerms.mjs), quét lại phát hiện 55 sourceTerm vẫn
   bị gán cho >1 thẻ khác nhau — phần lớn là các thẻ tôi soạn TRƯỚC lần rà soát này, độc lập với
   nhau, vô tình trùng từ. Một sourceTerm thuộc 2 thẻ khiến việc tra cứu không xác định (thẻ nào
   thắng phụ thuộc thứ tự nội bộ, không phải do người học chọn).

   Xử lý bằng tay từng cặp (đã đọc định nghĩa của cả hai bên) — không thể tự động hoá vì cần hiểu
   nghĩa để quyết định giữ ở thẻ nào. Ba loại hành động:
     REMOVE  — xoá 1 sourceTerm khỏi 1 thẻ vì nó thuộc về thẻ kia đúng nghĩa hơn.
     DELETE  — xoá hẳn 1 thẻ dư thừa 100% (mọi sourceTerm của nó đã có sẵn ở thẻ khác).
     REDEFINE— thẻ chỉ còn đúng 1 sourceTerm sau khi xoá, nhưng nghĩa đó KHÁC hẳn định nghĩa cũ
               (vd "as though" nghĩa "như thể" chứ không phải "mặc dù" như "though/although").
     ADD     — bổ sung 1 biến thể chính tả còn thiếu vào thẻ được giữ lại.

   Chạy: node tools/resolveConflicts.mjs
*/
import fs from "fs";
import zlib from "zlib";
import { readPayload } from "./extractEmbedded.mjs";

const SRC = "src/lib/embeddedData.js";
const psvAddFiles = fs.readdirSync("data").filter((f) => /^vocab-add-.*\.psv$/.test(f));

function findFileOf(termId) {
  for (const f of psvAddFiles) {
    const lines = fs.readFileSync(`data/${f}`, "utf8").split("\n");
    if (lines.some((l) => l.trim() && !l.trim().startsWith("#") && l.split("|")[0].trim() === termId)) return f;
  }
  return null;
}

// facilitation, t-shaped-skills, vocab-disruptive, vocab-rollout thuộc 303 thẻ GỐC (không có
// trong bất kỳ file vocab-add-*.psv nào — sourceTerms của chúng nằm trong payload nhị phân ban
// đầu) — xử lý riêng ở PAYLOAD_PATCH bên dưới, không đưa vào REMOVE/DELETE/ADD dựa trên .psv.
const REMOVE = [
  ["vocab-agility", ["agile"]],
  ["vocab-self-directed", ["self-managing", "self-managed"]],
  ["vocab-roadblock", ["blocker", "blockers", "blocked"]],
  ["vocab-block", ["blocker"]],
  ["vocab-fewer", ["less"]], // tránh nhầm với LeSS (Large-Scale Scrum)
  ["vocab-mentor-v", ["mentoring"]],
  ["vocab-valuable", ["value-added", "value-driven"]],
  ["vocab-especially", ["specifically", "particularly"]],
  ["vocab-benefit", ["beneficial"]],
  ["vocab-incomplete", ["complete"]],
  ["vocab-state", ["statement"]],
  ["vocab-app", ["application"]],
  ["vocab-productivity", ["productive"]],
  ["vocab-produce", ["production"]],
  ["vocab-aware", ["awareness"]],
  ["vocab-driven", ["driven"]],
  ["vocab-manage", ["manageable"]],
  ["vocab-decomposition", ["break down", "breaking down", "broken down"]],
  ["vocab-middle", ["midway"]],
  ["vocab-teammate", ["peer"]],
  ["vocab-final", ["finalise"]],
  ["vocab-understand", ["misunderstand"]],
  ["vocab-simply", ["simple", "simplest"]],
  ["vocab-oppose", ["as opposed to"]],
  ["vocab-certain", ["uncertain"]], // lỗi bỏ sót của agent: uncertain NGƯỢC nghĩa certain
  ["vocab-unsure", ["uncertain"]],
  ["vocab-stick", ["stuck"]],
  ["vocab-ago", ["recently", "previously"]], // lỗi bỏ sót: ago khác cấu trúc câu hẳn với 2 từ này
  ["vocab-though", ["though", "even though"]], // chỉ còn "as though" — xem REDEFINE bên dưới
  ["vocab-speed", ["faster"]],
  ["vocab-simpler", ["easier", "easiest", "simplest"]],
  ["vocab-nothing", ["everything"]],
  ["vocab-predictive", ["predictability"]],
  ["vocab-positive", ["negative", "negatively"]],
  ["vocab-anyone", ["no one"]],
];

const DELETE = [
  "vocab-primarily", // trùng hoàn toàn với vocab-primary (đã có primary/primarily)
  "vocab-strategic", // trùng hoàn toàn với vocab-strategy (đã có strategy/strategic/strategically)
  "vocab-accordingly", // trùng hoàn toàn với vocab-according-to (đã có according to/accordingly)
  "vocab-close-adj", // trùng hoàn toàn với vocab-closely (thẻ có sẵn từ trước, đầy đủ hơn)
  "vocab-generalizing-specialist", // trùng với t-shaped-skills đã có "generalizing specialist"
];

const ADD = [];

/* ---------- 4 thẻ thuộc 303 gốc — patch trực tiếp payload VI_TERMBASE_GZ_B64 ---------- */
const PAYLOAD_REMOVE = [
  ["facilitation", ["facilitator"]],
  ["vocab-rollout", ["roll out", "rolled out"]], // giữ đúng dạng danh từ liền "rollout"
];
const PAYLOAD_DELETE = ["vocab-disruptive"]; // trùng hoàn toàn với vocab-disrupt
const PAYLOAD_ADD = [["t-shaped-skills", ["generalising specialist"]]]; // biến thể chính tả Anh

const REDEFINE = {
  "vocab-though": {
    // Sau khi xoá "though, even though", chỉ còn "as though" — nghĩa hoàn toàn khác "although":
    // "as though" = "như thể, dường như" (so sánh giả định), không phải "mặc dù".
    termVi: "as though",
    translationVi: "như thể, dường như",
    definitionVi:
      "KHÁC \"though/although\" (mặc dù). \"As though\" (= \"as if\") dùng để so sánh giả định — mô tả điều gì đó DƯỜNG NHƯ đúng, không phải nhượng bộ một sự thật.",
    exampleEn: "The board looked as though nothing had moved in three days.",
  },
};

/* ---------- Thực thi REMOVE + REDEFINE (theo từng file, đọc/ghi 1 lần) ---------- */
const byFile = new Map();
for (const [termId, surfaces] of REMOVE) {
  const file = findFileOf(termId);
  if (!file) throw new Error(`REMOVE: không tìm thấy ${termId}`);
  if (!byFile.has(file)) byFile.set(file, new Map());
  byFile.get(file).set(termId, new Set(surfaces.map((s) => s.toLowerCase())));
}
for (const [termId] of ADD) {
  const file = findFileOf(termId);
  if (file && !byFile.has(file)) byFile.set(file, new Map());
}
for (const termId of Object.keys(REDEFINE)) {
  const file = findFileOf(termId);
  if (!file) throw new Error(`REDEFINE: không tìm thấy ${termId}`);
  if (!byFile.has(file)) byFile.set(file, new Map());
}

let removedCount = 0;
let deletedCount = 0;
let addedCount = 0;
let redefinedCount = 0;

for (const file of new Set([...byFile.keys(), ...DELETE.map(findFileOf)])) {
  if (!file) continue;
  const path = `data/${file}`;
  const lines = fs.readFileSync(path, "utf8").split("\n");
  const removeMap = byFile.get(file) || new Map();
  const addMap = new Map(ADD.filter(([id]) => findFileOf(id) === file));
  const deleteIds = new Set(DELETE.filter((id) => findFileOf(id) === file));

  const nextLines = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) { nextLines.push(line); continue; }
    const cols = line.split("|").map((s) => s.trim());
    const id = cols[0];

    if (deleteIds.has(id)) { deletedCount++; continue; } // bỏ hẳn dòng này

    let surfaces = cols[2].split(",").map((s) => s.trim());

    if (removeMap.has(id)) {
      const toRemove = removeMap.get(id);
      const before = surfaces.length;
      surfaces = surfaces.filter((s) => !toRemove.has(s.toLowerCase()));
      if (surfaces.length === before) throw new Error(`${id}: không khớp được surface cần xoá trong "${cols[2]}"`);
      removedCount += before - surfaces.length;
    }
    if (addMap.has(id)) {
      for (const s of addMap.get(id)) if (!surfaces.some((x) => x.toLowerCase() === s.toLowerCase())) { surfaces.push(s); addedCount++; }
    }
    cols[2] = surfaces.join(", ");

    if (REDEFINE[id]) {
      const r = REDEFINE[id];
      cols[6] = r.translationVi; // translationVi
      cols[7] = r.definitionVi; // definitionVi
      cols[8] = r.exampleEn; // exampleEn
      redefinedCount++;
    }

    nextLines.push(cols.join(" | "));
  }
  fs.writeFileSync(path, nextLines.join("\n"));
}

/* ---------- Patch payload cho 4 thẻ thuộc 303 gốc ---------- */
const termbase = readPayload("VI_TERMBASE_GZ_B64");
const byId = new Map(termbase.terms.map((t) => [t.id, t]));
let payloadRemoved = 0;
for (const [termId, surfaces] of PAYLOAD_REMOVE) {
  const t = byId.get(termId);
  if (!t) throw new Error(`PAYLOAD_REMOVE: không tìm thấy ${termId}`);
  const toRemove = new Set(surfaces.map((s) => s.toLowerCase()));
  const before = t.sourceTerms.length;
  t.sourceTerms = t.sourceTerms.filter((s) => !toRemove.has(s.toLowerCase()));
  if (t.sourceTerms.length === before) throw new Error(`${termId}: không khớp được surface cần xoá trong payload`);
  payloadRemoved += before - t.sourceTerms.length;
}
for (const [termId, surfaces] of PAYLOAD_ADD) {
  const t = byId.get(termId);
  if (!t) throw new Error(`PAYLOAD_ADD: không tìm thấy ${termId}`);
  for (const s of surfaces) if (!t.sourceTerms.some((x) => x.toLowerCase() === s.toLowerCase())) t.sourceTerms.push(s);
}
const deleteSet = new Set(PAYLOAD_DELETE);
termbase.terms = termbase.terms.filter((t) => !deleteSet.has(t.id));

function gzB64(obj) {
  return zlib.gzipSync(Buffer.from(JSON.stringify(obj)), { level: 9 }).toString("base64");
}
let src = fs.readFileSync(SRC, "utf8");
const re = /(VI_TERMBASE_GZ_B64 = ")[^"]+(")/;
if (!re.test(src)) throw new Error("không tìm thấy payload VI_TERMBASE_GZ_B64");
src = src.replace(re, `$1${gzB64(termbase)}$2`);
fs.writeFileSync(SRC, src);

console.log(`Đã xoá ${removedCount} sourceTerm trùng (.psv), xoá hẳn ${deletedCount} thẻ dư thừa (.psv), thêm ${addedCount} biến thể, viết lại nghĩa cho ${redefinedCount} thẻ.`);
console.log(`Payload (303 gốc): đã xoá ${payloadRemoved} sourceTerm, xoá hẳn ${PAYLOAD_DELETE.length} thẻ dư thừa.`);
console.log("\nLƯU Ý: chạy `node tools/buildVocab.mjs` NGAY SAU script này để build lại chỉ mục —");
console.log("buildVocab.mjs sẽ đọc payload vừa patch làm điểm khởi đầu rồi áp lại các file .psv lên trên.");
