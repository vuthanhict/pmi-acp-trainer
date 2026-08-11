/* Như candidateWords.mjs nhưng lấy mốc người học A1: chỉ loại ra ~350 từ lõi A1 (đại từ, be/have/do,
   giới từ, số đếm, các động từ/danh từ sinh hoạt cơ bản). Mọi thứ trên mức đó đều coi là "cần thẻ",
   vì người học A1 thật sự không biết "customer", "avoid", "require", "situation"...
   Chạy: node tools/candidateWordsA1.mjs > data/candidates-a1.txt */
import fs from "fs";

const quiz = JSON.parse(fs.readFileSync("data/quiz-embed.json", "utf8"));
const termbase = JSON.parse(fs.readFileSync("data/vi-termbase.json", "utf8"));

/* Từ lõi A1 — giữ danh sách này CỐ TÌNH NGẮN. Thà thừa thẻ còn hơn thiếu: người học đã biết từ nào
   thì lướt qua, còn từ không có thẻ thì họ mắc kẹt hoàn toàn. */
const A1 = new Set(`a an the and or but if so because then than that this these those there here it its
is are was were be been being am do does did done doing have has had having will would can could may
might must shall should not no nor of to in on at by for with from into out up down over under about
after before during between i you he she we they me him her us them my your his their our who what
when where why how all any some each every both other another same more most less few many much little
one two three four five six seven eight nine ten first second third last next new old good bad best better
time day days week weeks month year years today tomorrow yesterday morning now soon early late long short
work works worked working team teams people person man woman men women child children friend friends
make makes made making take takes took taken taking give gives gave given get gets got getting
go goes went going come comes came coming use uses used using need needs needed want wants wanted
like likes liked know knows knew known think thinks thought see sees saw seen look looks looked
say says said tell tells told ask asks asked answer answers answered help helps helped find finds found
start starts started begin begins began end ends ended stop stops stopped
show shows showed shown put puts keep keeps kept let lets leave leaves left move moves moved
call calls called run runs ran set sets try tries tried turn turns turned bring brings brought
hold holds held write writes wrote read reads send sends sent meet meets met
big large small great high low hard easy same different such own enough very too also just only
yes not never always often sometimes again back away off out around near far here there
thing things way ways part parts place places name names number numbers word words
house home school room door car food water money hour hours minute minutes
i'm it's don't doesn't isn't aren't can't won't didn't that's what's let's they're we're you're
mr mrs ms okay ok please thank thanks sorry hello
his hers ours yours mine theirs myself yourself himself herself itself ourselves themselves
`.split(/\s+/).filter(Boolean));

const covered = new Set();
for (const t of termbase.terms) {
  for (const s of [...(t.sourceTerms || []), t.termVi]) {
    for (const w of String(s).toLowerCase().split(/[^a-z'-]+/)) if (w) covered.add(w);
    covered.add(String(s).toLowerCase());
  }
}
function stem(w) {
  if (w.length > 5 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}
const docFreq = new Map();
for (const list of Object.values(quiz.data)) {
  for (const q of list) {
    const text = [q.stem, ...(q.choices || []).map((c) => c.text), q.explanationShort].join(" ");
    const seen = new Set();
    for (const raw of text.toLowerCase().split(/[^a-z'-]+/)) {
      const w = raw.replace(/^[-']+|[-']+$/g, "");
      if (w.length < 3) continue;
      if (A1.has(w) || covered.has(w)) continue;
      const s = stem(w);
      if (A1.has(s) || covered.has(s)) continue;
      if (seen.has(s)) continue;
      seen.add(s);
      if (!docFreq.has(s)) docFreq.set(s, { count: 0, forms: new Map() });
      const e = docFreq.get(s);
      e.count++;
      e.forms.set(w, (e.forms.get(w) || 0) + 1);
    }
  }
}
const rows = [...docFreq.entries()].filter(([, e]) => e.count >= 6).sort((a, b) => b[1].count - a[1].count);
console.log(`# ${rows.length} ứng viên CHƯA có thẻ (>=6 câu), termbase hiện có ${termbase.terms.length}`);
for (const [s, e] of rows) {
  const forms = [...e.forms.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f).join("|");
  console.log(`${String(e.count).padStart(4)}  ${forms}`);
}
