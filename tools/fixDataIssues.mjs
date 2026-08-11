/* ===================== Sửa 2 câu có explanationShort bị lệch trong dữ liệu gốc =====================
   Phát hiện khi dịch đề 89/90: q_08446d54fa75 và q_1b072b2ec3ff (cả hai thuộc quiz 90) có trường
   explanationShort không liên quan gì tới câu hỏi/đáp án của chính chúng — nhiều khả năng là lỗi
   copy-paste từ câu khác lúc sinh dữ liệu gốc (một câu nói về planning poker trong khi câu hỏi
   không liên quan; câu kia còn nguyên văn ghi chú nội bộ của người soạn đề "Question needs cleaner,
   mutually exclusive distractors..." thay vì lời giải thích thật).

   Script này viết lại explanationShort (tiếng Anh, nguồn) VÀ explanationShortVi (bản dịch tương
   ứng) cho đúng nội dung câu hỏi, dựa trên correctOptionIds đã có sẵn (không đổi đáp án đúng, chỉ
   sửa phần giải thích). Không đụng tới bất kỳ câu nào khác.

   Chạy: node tools/fixDataIssues.mjs
*/
import fs from "fs";
import zlib from "zlib";
import { readPayload } from "./extractEmbedded.mjs";

const SRC = "src/lib/embeddedData.js";

const FIXES = {
  q_08446d54fa75: {
    explanationShort:
      "The purpose of a retrospective is to inspect what happened and adapt going forward, so the scrum master should raise the problems that arose during the sprint — not just the solutions that were already implemented or the problems that were already solved. Naming the problems openly lets the whole team investigate why value was not sufficiently delivered and agree on concrete improvements for the next sprint.",
    explanationShortVi:
      "Mục đích của một buổi Retrospective là nhìn lại những gì đã xảy ra và điều chỉnh cho giai đoạn tiếp theo, vì vậy Scrum Master nên nêu ra những vấn đề đã phát sinh trong Sprint — chứ không chỉ các giải pháp đã được triển khai hay các vấn đề đã được giải quyết xong. Việc nêu vấn đề một cách công khai giúp cả nhóm cùng tìm hiểu vì sao giá trị mang lại chưa đủ, từ đó thống nhất những cải tiến cụ thể cho Sprint tiếp theo.",
  },
  q_1b072b2ec3ff: {
    explanationShort:
      "The product owner is accountable for ordering the product backlog to maximize value, so when the team finishes early it should ask the product owner which item to pull next rather than deciding on its own or asking the scrum master, who has no authority over backlog priority. This keeps the team working on the highest-value item available instead of whatever happens to come next in the list.",
    explanationShortVi:
      "Product Owner là người chịu trách nhiệm sắp xếp thứ tự ưu tiên của product backlog nhằm tối đa hóa giá trị, vì vậy khi nhóm hoàn thành sớm, họ nên hỏi Product Owner nên lấy hạng mục nào tiếp theo, thay vì tự ý quyết định hoặc hỏi Scrum Master — người không có thẩm quyền quyết định thứ tự ưu tiên của backlog. Điều này giúp nhóm luôn làm việc trên hạng mục có giá trị cao nhất hiện có, thay vì hạng mục kế tiếp một cách ngẫu nhiên trong danh sách.",
  },
};

const quizEmbed = readPayload("QUIZ_EMBED_GZ_B64");
const enrichment = readPayload("VI_ENRICHMENT_GZ_B64");
const termbase = readPayload("VI_TERMBASE_GZ_B64");

/* 1. Sửa nguồn tiếng Anh trong QUIZ_EMBED */
let foundEn = 0;
for (const list of Object.values(quizEmbed.data)) {
  for (const q of list) {
    const fix = FIXES[q.id];
    if (!fix) continue;
    q.explanationShort = fix.explanationShort;
    foundEn++;
  }
}
if (foundEn !== Object.keys(FIXES).length) throw new Error(`chỉ tìm thấy ${foundEn}/${Object.keys(FIXES).length} câu trong QUIZ_EMBED`);

/* 2. Sửa bản dịch trong VI_ENRICHMENT + tính lại termIds cho postAnswer vì explanation đã đổi */
const WORD_CHAR = /[a-z0-9]/;
function buildMatchers() {
  const matchers = [];
  for (const term of termbase.terms) {
    for (const raw of term.sourceTerms || []) {
      const surface = raw.toLowerCase().trim();
      if (surface.length < 4) continue;
      matchers.push({ termId: term.id, surface, len: surface.length });
    }
  }
  return matchers.sort((a, b) => b.len - a.len);
}
const MATCHERS = buildMatchers();
function matchTermIds(text) {
  const hay = (text || "").toLowerCase();
  const found = new Set();
  for (const m of MATCHERS) {
    let from = 0;
    for (;;) {
      const at = hay.indexOf(m.surface, from);
      if (at === -1) break;
      const before = at === 0 ? "" : hay[at - 1];
      const after = hay[at + m.len] || "";
      if (!WORD_CHAR.test(before) && !WORD_CHAR.test(after)) { found.add(m.termId); break; }
      from = at + 1;
    }
  }
  return [...found];
}

let foundVi = 0;
for (const pack of Object.values(enrichment)) {
  for (const [qid, item] of Object.entries(pack.items || {})) {
    const fix = FIXES[qid];
    if (!fix) continue;
    item.postAnswer.explanationShortVi = fix.explanationShortVi;
    item.postAnswer.termIds = matchTermIds(fix.explanationShort);
    foundVi++;
  }
}
if (foundVi !== Object.keys(FIXES).length) throw new Error(`chỉ tìm thấy ${foundVi}/${Object.keys(FIXES).length} câu trong VI_ENRICHMENT`);

/* 3. Ghi ngược vào embeddedData.js */
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
src = replacePayload(src, "VI_ENRICHMENT_GZ_B64", gzB64(enrichment));
fs.writeFileSync(SRC, src);

console.log(`Đã sửa explanationShort + explanationShortVi cho ${Object.keys(FIXES).length} câu: ${Object.keys(FIXES).join(", ")}`);
console.log("Chạy tiếp `node tools/buildVocab.mjs` để đồng bộ lại chỉ mục từ vựng.");
