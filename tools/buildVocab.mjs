/* ===================== Build lại termbase + chỉ mục từ vựng theo câu hỏi =====================
   Đầu vào (soạn tay, dễ đọc/dễ sửa hơn JSON):
     data/vocab-phonetics.psv   — ipa/pos/senseEn cho 303 thẻ termbase sẵn có
     data/vocab-add-*.psv       — các thẻ từ vựng bổ sung (từ, cụm từ, mẫu câu thi)
   Đầu ra: ghi đè 2 payload gzip+base64 trong src/lib/embeddedData.js
     VI_TERMBASE_GZ_B64  — termbase đã bổ sung ipa/pos/senseEn + các thẻ mới
     VOCAB_INDEX_GZ_B64  — chỉ mục câu hỏi -> danh sách thẻ từ vựng (mới, chưa từng có)

   Vì sao cần chỉ mục riêng thay vì dùng lại termIds trong VI_ENRICHMENT: enrichment chỉ phủ
   1.470/1.684 câu (đề 89, 90 không có) và được sinh ra TRƯỚC khi có các thẻ bổ sung. Chỉ mục ở
   đây = termIds có sẵn HỢP với kết quả tự động khớp sourceTerms trên chính văn bản câu hỏi, nên
   phủ 100% câu và tự động bao gồm mọi thẻ mới thêm vào.

   Chạy: node tools/buildVocab.mjs
*/
import fs from "fs";
import zlib from "zlib";
import { readPayload } from "./extractEmbedded.mjs";

const SRC = "src/lib/embeddedData.js";

/* ---------- Đọc các file .psv soạn tay ---------- */
function readPsv(path, expectedCols) {
  const rows = [];
  const lines = fs.readFileSync(path, "utf8").split("\n");
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const cols = trimmed.split("|").map((s) => s.trim());
    if (cols.length !== expectedCols) {
      throw new Error(`${path}:${i + 1} — cần ${expectedCols} cột, nhận ${cols.length}`);
    }
    rows.push(cols);
  });
  return rows;
}

const termbase = readPayload("VI_TERMBASE_GZ_B64");
const quizEmbed = readPayload("QUIZ_EMBED_GZ_B64");
const enrichment = readPayload("VI_ENRICHMENT_GZ_B64");

/* ---------- 1. Bổ sung ipa/pos/senseEn cho thẻ sẵn có ---------- */
const byId = new Map(termbase.terms.map((t) => [t.id, t]));
for (const [id, ipa, pos, senseEn] of readPsv("data/vocab-phonetics.psv", 4)) {
  const term = byId.get(id);
  if (!term) throw new Error(`vocab-phonetics.psv: id không có trong termbase — ${id}`);
  Object.assign(term, { ipa, pos, senseEn });
}

/* ---------- 2. Thêm các thẻ mới ---------- */
const ADD_FILES = fs.readdirSync("data").filter((f) => /^vocab-add-.*\.psv$/.test(f)).sort();
let addedCount = 0;
const seenAdd = new Set();
for (const file of ADD_FILES) {
  for (const cols of readPsv(`data/${file}`, 9)) {
    const [id, category, surfaces, ipa, pos, senseEn, translationVi, definitionVi, exampleEn] = cols;
    if (seenAdd.has(id)) throw new Error(`${file}: id bị khai báo hai lần trong các file .psv — ${id}`);
    seenAdd.add(id);
    const sourceTerms = surfaces.split(",").map((s) => s.trim()).filter(Boolean);
    const term = {
      id,
      sourceTerms,
      termVi: sourceTerms[0],
      translationVi,
      definitionVi,
      exampleEn,
      category,
      ipa,
      pos,
      senseEn,
    };
    // Ghi đè nếu thẻ đã tồn tại (lần chạy trước đã chèn) thay vì báo lỗi — nhờ vậy script chạy
    // lại nhiều lần vẫn cho kết quả y hệt, kể cả khi embeddedData.js đã chứa kết quả lần trước.
    const existing = byId.get(id);
    if (existing) {
      Object.assign(existing, term);
    } else {
      termbase.terms.push(term);
      byId.set(id, term);
      addedCount++;
    }
  }
}

/* ---------- 3. Khớp thẻ với từng câu hỏi ---------- */
/* Mỗi thẻ có nhiều "bề mặt" (sourceTerms). Khớp theo ranh giới từ, không phân biệt hoa thường.
   Bề mặt ngắn hơn 4 ký tự bị bỏ qua để tránh khớp nhầm (vd "xp" trong "expected"). */
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
  // Bề mặt dài khớp trước để cụm ("user story") thắng từ đơn ("story") khi cả hai cùng có mặt.
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
  return found;
}

/* termIds đã được curate sẵn trong enrichment — luôn giữ, chỉ bổ sung thêm phần tự khớp. */
const curated = new Map();
for (const pack of Object.values(enrichment)) {
  for (const [qid, item] of Object.entries(pack.items || {})) {
    curated.set(qid, { pre: item.preAnswer?.termIds || [], post: item.postAnswer?.termIds || [] });
  }
}

/* Thẻ xuất hiện ở quá nhiều câu thì gần như vô dụng khi hiển thị (ai cũng biết "team", "sprint").
   Đếm trước tần suất để sắp xếp: thẻ hiếm hơn = đáng học hơn, hiện lên trước. */
const allQuestions = Object.values(quizEmbed.data).flat();
const docFreq = new Map();
const perQuestion = new Map();
for (const q of allQuestions) {
  const preText = [q.stem, ...(q.choices || []).map((c) => c.text)].join("\n");
  const postText = [q.explanationShort, q.correctAnswerText].join("\n");
  const c = curated.get(q.id) || { pre: [], post: [] };
  const pre = new Set([...c.pre, ...matchTermIds(preText)]);
  const post = new Set([...c.post, ...matchTermIds(postText)]);
  // Thẻ đã hiện ở phần đề bài thì không lặp lại ở phần giải thích.
  for (const id of pre) post.delete(id);
  perQuestion.set(q.id, { pre, post });
  for (const id of new Set([...pre, ...post])) docFreq.set(id, (docFreq.get(id) || 0) + 1);
}

/* Lưu id thẻ dưới dạng CHỈ SỐ trong mảng terms thay vì chuỗi — nhỏ hơn nhiều lần trước khi nén. */
const termOrder = termbase.terms.map((t) => t.id);
const termIdx = new Map(termOrder.map((id, i) => [id, i]));
function sortAndIndex(ids) {
  return [...ids]
    .filter((id) => termIdx.has(id))
    .sort((a, b) => (docFreq.get(a) || 0) - (docFreq.get(b) || 0) || a.localeCompare(b))
    .map((id) => termIdx.get(id));
}

const items = {};
for (const [qid, { pre, post }] of perQuestion) {
  items[qid] = { pre: sortAndIndex(pre), post: sortAndIndex(post) };
}
// Cố ý KHÔNG nhúng timestamp: cùng đầu vào phải cho ra cùng byte, để chạy lại script không tạo
// ra diff 200KB giả trong git khi thực chất chẳng có gì đổi.
const vocabIndex = { schemaVersion: 1, terms: termOrder, items };

/* ---------- 4. Ghi ngược vào embeddedData.js ---------- */
// Hậu tố cố định (không nối chồng) để chạy lại script không làm version dài ra vô hạn.
termbase.version = `${String(termbase.version || "1").replace(/\+vocab$/, "")}+vocab`;
function gzB64(obj) {
  return zlib.gzipSync(Buffer.from(JSON.stringify(obj)), { level: 9 }).toString("base64");
}
function replacePayload(src, name, b64) {
  const re = new RegExp(`(${name} = ")[^"]+(")`);
  if (!re.test(src)) throw new Error(`không tìm thấy payload ${name} để ghi đè`);
  return src.replace(re, `$1${b64}$2`);
}

let src = fs.readFileSync(SRC, "utf8");
src = replacePayload(src, "VI_TERMBASE_GZ_B64", gzB64(termbase));
if (src.includes("VOCAB_INDEX_GZ_B64 = \"")) {
  src = replacePayload(src, "VOCAB_INDEX_GZ_B64", gzB64(vocabIndex));
} else {
  // Lần chạy đầu: chèn hằng số mới ngay sau VI_ENRICHMENT_GZ_B64.
  src = src.replace(
    /(const VI_ENRICHMENT_GZ_B64 = "[^"]+";\n)/,
    `$1\n/* Chỉ mục câu hỏi -> thẻ từ vựng, sinh bởi tools/buildVocab.mjs (xem chú thích trong file đó). */\nconst VOCAB_INDEX_GZ_B64 = "${gzB64(vocabIndex)}";\n`
  );
  if (!src.includes("VOCAB_INDEX_GZ_B64 = \"")) throw new Error("không chèn được VOCAB_INDEX_GZ_B64");
}
fs.writeFileSync(SRC, src);

/* ---------- Báo cáo ---------- */
const counts = Object.values(items).map((it) => it.pre.length + it.post.length).sort((a, b) => a - b);
const pct = (p) => counts[Math.floor((counts.length - 1) * p)];
console.log(`termbase: ${termbase.terms.length} thẻ (+${addedCount} mới)`);
console.log(`chỉ mục : ${Object.keys(items).length}/${allQuestions.length} câu`);
console.log(`thẻ/câu : min ${counts[0]} · p50 ${pct(0.5)} · p90 ${pct(0.9)} · max ${counts[counts.length - 1]}`);
console.log(`câu 0 thẻ: ${counts.filter((c) => c === 0).length}`);
const sizes = { termbase: gzB64(termbase).length, vocabIndex: gzB64(vocabIndex).length };
console.log(`gzip+b64 : termbase ${(sizes.termbase / 1024).toFixed(0)}KB · vocabIndex ${(sizes.vocabIndex / 1024).toFixed(0)}KB`);
