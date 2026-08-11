/* ===================== Ghi data/vi-enrichment.json (đã chỉnh sửa thủ công/bằng agent) ngược lại
   vào payload VI_ENRICHMENT_GZ_B64 trong src/lib/embeddedData.js =====================
   Dùng sau khi chỉnh sửa trực tiếp data/vi-enrichment.json (ví dụ dịch lại toàn bộ câu hỏi).
   Không đụng tới các payload khác (QUIZ_EMBED, VI_TERMBASE, VOCAB_INDEX).

   Chạy: node tools/rebuildEnrichment.mjs
*/
import fs from "fs";
import zlib from "zlib";

const SRC = "src/lib/embeddedData.js";
const ENRICHMENT_PATH = "data/vi-enrichment.json";

const enrichment = JSON.parse(fs.readFileSync(ENRICHMENT_PATH, "utf8"));

function gzB64(obj) {
  return zlib.gzipSync(Buffer.from(JSON.stringify(obj)), { level: 9 }).toString("base64");
}

let src = fs.readFileSync(SRC, "utf8");
const re = /(VI_ENRICHMENT_GZ_B64 = ")[^"]+(")/;
if (!re.test(src)) throw new Error("không tìm thấy payload VI_ENRICHMENT_GZ_B64");
src = src.replace(re, `$1${gzB64(enrichment)}$2`);
fs.writeFileSync(SRC, src);

let total = 0;
for (const [qi, pack] of Object.entries(enrichment)) {
  total += Object.keys(pack.items).length;
}
console.log(`Đã ghi VI_ENRICHMENT_GZ_B64 mới: ${Object.keys(enrichment).length} quiz, ${total} câu.`);
