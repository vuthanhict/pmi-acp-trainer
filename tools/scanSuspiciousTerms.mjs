/* ===================== Quét thẻ từ vựng có nguy cơ gộp nhầm nghĩa =====================
   Bug gốc: thẻ vocab-rely gộp "rely" (v, dựa vào) và "reliable" (adj, đáng tin cậy) làm một —
   hai từ cùng gốc hình thái nhưng NGHĨA khác hẳn nhau. Người dùng chạm vào "reliable" trong đề
   thì thấy định nghĩa/ví dụ của "rely", sai hoàn toàn so với ngữ cảnh câu.

   Không thể tự động phát hiện "nghĩa có lệch hay không" bằng máy — cần đọc hiểu. Script này chỉ
   lọc ra danh sách NGHI VẤN để rà soát bằng mắt: với mỗi sourceTerm khác headword trong cùng một
   thẻ, nếu nó KHÔNG phải biến thể hình thái học đơn giản (chia thì/số nhiều/-ing của chính từ đó)
   thì in ra. Biến thể "an toàn" (chấp nhận gộp chung) = chỉ thêm hậu tố -s/-es/-ed/-ing/-ies vào
   đúng gốc từ. Biến thể "đáng ngờ" = thêm hậu tố tạo từ loại mới (-able/-ible/-ive/-ary/-ous/
   -ent/-ant/-tion/-sion/-ment/-ance/-ency/-er/-or/-al) — đây là nhóm hậu tố hay tạo ra một khái
   niệm khác hẳn nghĩa gốc (rely → reliable, differ → different, invest → investment÷investor đều
   RÕ NGHĨA riêng cần cân nhắc).

   Chạy: node tools/scanSuspiciousTerms.mjs > data/suspicious-terms.txt
*/
import { readPayload } from "./extractEmbedded.mjs";

const termbase = readPayload("VI_TERMBASE_GZ_B64");

const SAFE_SUFFIX = /^(s|es|ed|ing|ies|d)$/;
// Hậu tố hay biến một hành động/tính chất thành MỘT KHÁI NIỆM KHÁC — luôn đáng ngờ dù độ dài gần.
const RISKY_SUFFIX = /(able|ible|ive|ary|ous|ent|ant|tion|sion|ment|ance|ence|ancy|ency|er|or|al|ful|less|ity|ism)$/;

function longestCommonPrefix(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function classify(head, surface) {
  if (head === surface) return "same";
  const h = head.toLowerCase();
  const s = surface.toLowerCase();
  const lcp = longestCommonPrefix(h, s);
  // Biến thể chia động từ/số nhiều đơn giản: giữ nguyên gốc rồi thêm hậu tố an toàn, hoặc gốc rút
  // gọn 1 ký tự (double consonant / rụng "e" trước -ing/-ed, ví dụ "hire"->"hiring").
  const suffix = s.slice(lcp);
  const remainder = h.slice(lcp);
  if (lcp >= Math.min(h.length, s.length) - 2 && SAFE_SUFFIX.test(suffix) && remainder.length <= 1) return "safe";
  if (lcp === h.length && SAFE_SUFFIX.test(suffix)) return "safe"; // hire + s/d/ing giữ nguyên gốc
  if (RISKY_SUFFIX.test(s) && !RISKY_SUFFIX.test(h)) return "risky";
  // Khác biệt lớn về độ dài / tiền tố chung quá ngắn so với từ dài — cũng đáng ngờ.
  if (lcp < Math.min(h.length, s.length) * 0.6) return "risky";
  return "unsure";
}

// Chỉ có ý nghĩa với TỪ ĐƠN: cụm nhiều từ (multi-word terminology) hay có viết tắt/đồng nghĩa
// hợp lệ trong cùng 1 thẻ (CI = continuous integration, blocker = impediment...) — đó KHÔNG phải
// lỗi kiểu rely/reliable, chỉ gây nhiễu nếu đưa vào cùng heuristic hình thái học ở trên.
const isSingleWord = (s) => /^[a-zA-Z-]+$/.test(s) && !s.includes(" ");

let riskyCount = 0;
const scope = termbase.terms.filter((t) => t.category === "vocabulary");
for (const t of scope) {
  const surfaces = (t.sourceTerms || []).filter(isSingleWord);
  if (surfaces.length < 2) continue;
  const head = surfaces[0];
  const flagged = [];
  for (const s of surfaces.slice(1)) {
    const cls = classify(head, s);
    if (cls === "risky" || cls === "unsure") flagged.push(`${s}(${cls})`);
  }
  if (flagged.length) {
    riskyCount++;
    console.log(`${t.id.padEnd(28)} head="${head}"  nghi vấn: ${flagged.join(", ")}`);
  }
}
console.error(`\n# ${riskyCount}/${scope.length} thẻ "vocabulary" có ít nhất 1 sourceTerm nghi vấn.`);
