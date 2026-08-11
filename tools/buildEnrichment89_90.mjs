/* ===================== Hợp nhất bản dịch mới cho đề 89 & 90 vào VI_ENRICHMENT =====================
   Đầu vào: 10 file kết quả dịch (out-0..9.json) do các agent dịch song song ghi ra, mỗi phần tử
   {id, stemVi, choicesVi:[{id,textVi}], correctAnswerTextVi, explanationShortVi}.

   Việc này build lại đúng cấu trúc VI_ENRICHMENT_GZ_B64 hiện có (xem tools/buildVocab.mjs và
   src/lib/embeddedData.js): mỗi pack theo quizIndex chứa items theo questionId, mỗi item có
   preAnswer (stemVi/choicesVi/termIds) + postAnswer (correctAnswerTextVi/termIds/explanationShortVi)
   + quality. termIds tự sinh bằng cách khớp sourceTerms của termbase lên chính VĂN BẢN TIẾNG ANH
   gốc — không phụ thuộc bản dịch — dùng lại đúng thuật toán trong buildVocab.mjs để nhất quán.

   Chạy: node tools/buildEnrichment89_90.mjs
*/
import fs from "fs";
import zlib from "zlib";
import { readPayload } from "./extractEmbedded.mjs";

const SCRATCH = "/private/tmp/claude-501/-Users-thanh-PMI-ACP-pmi-acp-trainer/d74ef2ae-17e1-403c-8409-599f0278a06b/scratchpad/translate";
const SRC = "src/lib/embeddedData.js";

const quizEmbed = readPayload("QUIZ_EMBED_GZ_B64");
const termbase = readPayload("VI_TERMBASE_GZ_B64");
const enrichment = readPayload("VI_ENRICHMENT_GZ_B64");

/* ---------- 1. Đọc + gộp 10 file dịch, validate từng câu ---------- */
const translated = new Map();
for (let i = 0; i < 10; i++) {
  const path = `${SCRATCH}/out-${i}.json`;
  const arr = JSON.parse(fs.readFileSync(path, "utf8"));
  for (const item of arr) {
    if (translated.has(item.id)) throw new Error(`id trùng giữa các batch dịch: ${item.id}`);
    translated.set(item.id, item);
  }
}
console.log(`Đọc được ${translated.size} câu đã dịch từ 10 file batch.`);

/* ---------- 2. Thuật toán khớp thẻ từ vựng — giống hệt buildVocab.mjs ---------- */
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

/* Phủ định trong đề bài hoặc đáp án làm bản dịch dễ hiểu sai nếu chỉ đọc lướt — gắn cờ giống hệt
   cách các câu đề khác (1470 câu cũ) đã được gắn, để người học vẫn thấy cảnh báo nhất quán. */
const NEGATION_RE = /\b(not|except|never|cannot|without|no longer)\b/i;
function detectNegation(q) {
  const text = [q.stem, ...(q.choices || []).map((c) => c.text)].join(" ");
  return NEGATION_RE.test(text);
}

/* ---------- 3. Build items theo quizIndex ---------- */
const packs = {};
for (const qi of [89, 90]) {
  const cat = quizEmbed.catalog.find((c) => c.quizIndex === qi);
  const list = quizEmbed.data[String(qi)];
  const items = {};
  let missing = 0;
  for (const q of list) {
    const t = translated.get(q.id);
    if (!t) { missing++; continue; }
    if (!t.choicesVi || t.choicesVi.length !== q.choices.length) {
      throw new Error(`${q.id}: số lượng choicesVi (${t.choicesVi?.length}) không khớp choices gốc (${q.choices.length})`);
    }
    const preText = [q.stem, ...q.choices.map((c) => c.text)].join("\n");
    const needsReview = detectNegation(q);
    items[q.id] = {
      preAnswer: {
        stemVi: t.stemVi,
        choicesVi: t.choicesVi.map((c) => ({ id: c.id, textVi: c.textVi })),
        termIds: matchTermIds(preText),
      },
      postAnswer: {
        correctAnswerTextVi: t.correctAnswerTextVi,
        termIds: matchTermIds(q.explanationShort),
        explanationShortVi: t.explanationShortVi,
      },
      quality: {
        status: "machine_draft",
        needsManualReview: needsReview,
        warnings: needsReview ? ["negation_requires_review"] : [],
      },
    };
  }
  if (missing) throw new Error(`quiz ${qi}: thiếu bản dịch cho ${missing} câu`);
  packs[qi] = {
    quizIndex: qi,
    quizName: cat.quizName,
    termbaseVersion: termbase.version,
    generator: "buildEnrichment89_90.mjs (dịch bởi các agent, xem tools/buildEnrichment89_90.mjs)",
    items,
  };
  console.log(`Quiz ${qi} (${cat.quizName}): ${Object.keys(items).length}/${list.length} câu, ${Object.values(items).filter((it) => it.quality.needsManualReview).length} câu gắn cờ cần review (phủ định).`);
}

/* ---------- 4. Ghi vào enrichment hiện có + build lại embeddedData.js ---------- */
Object.assign(enrichment, packs);
function gzB64(obj) {
  return zlib.gzipSync(Buffer.from(JSON.stringify(obj)), { level: 9 }).toString("base64");
}
let src = fs.readFileSync(SRC, "utf8");
const re = /(VI_ENRICHMENT_GZ_B64 = ")[^"]+(")/;
if (!re.test(src)) throw new Error("không tìm thấy payload VI_ENRICHMENT_GZ_B64");
src = src.replace(re, `$1${gzB64(enrichment)}$2`);
fs.writeFileSync(SRC, src);

console.log("Đã ghi VI_ENRICHMENT_GZ_B64 mới. Chạy tiếp `node tools/buildVocab.mjs` để đồng bộ chỉ mục từ vựng.");
