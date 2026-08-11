/* ===================== Tách các từ bị gộp nhầm nghĩa ra khỏi thẻ gốc =====================
   Bug gốc do người dùng phát hiện: thẻ vocab-rely gộp "rely" (v, dựa vào) và "reliable" (adj,
   đáng tin cậy) — hai từ cùng gốc hình thái nhưng NGHĨA khác hẳn. Rà soát bằng 8 agent song song
   trên toàn bộ 813 thẻ nhóm "vocabulary" tìm thấy 68 lỗi cùng loại trên 62 thẻ gốc.

   Script này đọc kết quả rà soát (mảng {termId, badSurface, reason, newTerm}), rồi với mỗi lỗi:
     1. Xóa badSurface khỏi sourceTerms của thẻ gốc — sửa TRỰC TIẾP trong file .psv nguồn (không
        phải payload nhị phân), để lần build sau không bị hoàn nguyên lỗi.
     2. Thêm thẻ mới cho badSurface đó — TRỪ khi newTerm.id trùng với một thẻ đã tồn tại sẵn
        (trường hợp "vocab-effect → effective" đã có sẵn thẻ "vocab-effective" riêng do một batch
        khác soạn từ trước; khi đó chỉ cần bước 1, không tạo trùng).
     3. Kiểm tra không có sourceTerm nào bị gán cho hai thẻ khác nhau sau khi sửa.

   Chạy: node tools/splitAmbiguousTerms.mjs
*/
import fs from "fs";

const AUDIT_DIR = "/private/tmp/claude-501/-Users-thanh-PMI-ACP-pmi-acp-trainer/d74ef2ae-17e1-403c-8409-599f0278a06b/scratchpad/audit";
const NEW_TERMS_FILE = "data/vocab-add-splits.psv";

const issues = JSON.parse(fs.readFileSync(`${AUDIT_DIR}/all-issues.json`, "utf8"));

/* badSurface có thể là 1 từ ("reliable") hoặc nhiều từ gộp trong 1 đề xuất — agent không hoàn
   toàn nhất quán khi liệt kê nhiều từ, dùng cả dấu phẩy ("cost, costs") lẫn dấu gạch chéo
   ("fill / fills / filled"), nên tách theo cả hai. */
function splitSurfaces(badSurface) {
  return badSurface.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
}

/* ---------- 1. Xác định thẻ nào đã tồn tại sẵn để tránh tạo trùng id ---------- */
const psvAddFiles = fs.readdirSync("data").filter((f) => /^vocab-add-.*\.psv$/.test(f));
const existingIds = new Set();
for (const f of psvAddFiles) {
  for (const line of fs.readFileSync(`data/${f}`, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    existingIds.add(t.split("|")[0].trim());
  }
}
// 303 thẻ gốc (không có sourceTerms trong .psv, chỉ có id trong vocab-phonetics.psv) cũng tính
// là "đã tồn tại" để không tạo trùng — dù bước quét trước xác nhận không lỗi nào rơi vào nhóm này.
for (const line of fs.readFileSync("data/vocab-phonetics.psv", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  existingIds.add(t.split("|")[0].trim());
}

/* ---------- 2. Với mỗi lỗi, xóa badSurface khỏi đúng dòng .psv chứa termId ---------- */
// Gom theo file để đọc/ghi mỗi file đúng 1 lần.
const byFile = new Map(); // file -> Map(termId -> Set(surfacesToRemove))
for (const issue of issues) {
  let foundFile = null;
  for (const f of psvAddFiles) {
    const lines = fs.readFileSync(`data/${f}`, "utf8").split("\n");
    if (lines.some((l) => l.trim() && !l.trim().startsWith("#") && l.split("|")[0].trim() === issue.termId)) {
      foundFile = f;
      break;
    }
  }
  if (!foundFile) throw new Error(`Không tìm thấy termId ${issue.termId} trong bất kỳ file vocab-add-*.psv nào`);
  if (!byFile.has(foundFile)) byFile.set(foundFile, new Map());
  const m = byFile.get(foundFile);
  if (!m.has(issue.termId)) m.set(issue.termId, new Set());
  for (const s of splitSurfaces(issue.badSurface)) m.get(issue.termId).add(s.toLowerCase());
}

let removedCount = 0;
for (const [file, termMap] of byFile) {
  const path = `data/${file}`;
  const lines = fs.readFileSync(path, "utf8").split("\n");
  const nextLines = lines.map((line) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return line;
    const cols = line.split("|").map((s) => s.trim());
    const id = cols[0];
    if (!termMap.has(id)) return line;
    const toRemove = termMap.get(id);
    const surfaces = cols[2].split(",").map((s) => s.trim());
    const kept = surfaces.filter((s) => !toRemove.has(s.toLowerCase()));
    if (kept.length === surfaces.length) throw new Error(`${id}: không khớp được surface cần xóa (${[...toRemove].join(", ")}) trong "${cols[2]}"`);
    if (!kept.length) throw new Error(`${id}: xóa hết sourceTerms, thẻ sẽ rỗng — kiểm tra lại`);
    removedCount += surfaces.length - kept.length;
    cols[2] = kept.join(", ");
    return cols.join(" | ");
  });
  fs.writeFileSync(path, nextLines.join("\n"));
  console.log(`${file}: đã xóa sourceTerm lệch nghĩa khỏi ${termMap.size} thẻ.`);
}

/* ---------- 3. Thêm thẻ mới cho các từ vừa tách ra (bỏ qua nếu đã trùng id có sẵn) ---------- */
const newRows = [];
let skippedCollision = 0;
const seenNewIds = new Set();
for (const issue of issues) {
  const nt = issue.newTerm;
  if (existingIds.has(nt.id) || seenNewIds.has(nt.id)) {
    skippedCollision++;
    console.log(`Bỏ qua tạo thẻ mới "${nt.id}" (đã tồn tại sẵn) — chỉ xóa "${issue.badSurface}" khỏi ${issue.termId}.`);
    continue;
  }
  seenNewIds.add(nt.id);
  const surfaces = splitSurfaces(issue.badSurface).join(", ");
  // category giữ "vocabulary" — toàn bộ 62 thẻ gốc đều thuộc nhóm này (đã giới hạn phạm vi rà soát).
  newRows.push([nt.id, "vocabulary", surfaces, nt.ipa, nt.pos, nt.senseEn, nt.translationVi, nt.definitionVi, nt.exampleEn].join(" | "));
}

const header = `# Thẻ tách ra từ các thẻ bị gộp nhầm nghĩa (phát hiện qua rà soát 8-agent, xem tools/splitAmbiguousTerms.mjs).
# Mỗi thẻ ở đây từng là 1 sourceTerm nằm lẫn trong thẻ khác nhưng mang nghĩa/từ loại khác hẳn
# headword — ví dụ điển hình: "reliable" (đáng tin cậy) từng bị gộp vào "rely" (dựa vào).
# Định dạng: id | category | surfaceForms | ipa | pos | senseEn | translationVi | definitionVi | exampleEn
`;
fs.writeFileSync(NEW_TERMS_FILE, header + newRows.join("\n") + "\n");
console.log(`\nĐã ghi ${newRows.length} thẻ mới vào ${NEW_TERMS_FILE} (bỏ qua ${skippedCollision} thẻ trùng id có sẵn).`);
console.log(`Tổng cộng đã xóa ${removedCount} sourceTerm lệch nghĩa khỏi các thẻ gốc.`);
console.log("\nChạy tiếp `node tools/buildVocab.mjs` để build lại.");
