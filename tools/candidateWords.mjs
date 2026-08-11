/* Quét toàn bộ 1.684 câu hỏi (stem + choices + explanation) để tìm các từ/cụm tiếng Anh KHÓ
   xuất hiện nhiều nhưng chưa có trong termbase — dùng làm danh sách ứng viên khi soạn thêm thẻ
   từ vựng. Chạy: node tools/candidateWords.mjs > data/candidates.txt */
import fs from "fs";

const quiz = JSON.parse(fs.readFileSync("data/quiz-embed.json", "utf8"));
const termbase = JSON.parse(fs.readFileSync("data/vi-termbase.json", "utf8"));

/* Từ phổ thông bậc A1-B1 — người học ở trình độ nào cũng biết, không cần thẻ. */
const COMMON = new Set(`a an the and or but if then than that this these those there here it its it's is are was were be been being am
of to in on at by for with from into onto over under about after before during between within without through across against
i you he she we they me him her us them my your his their our who whom whose which what when where why how
do does did done doing have has had having will would shall should can could may might must not no nor only just very too also
one two three four five six seven eight nine ten first second third next last new old good bad best better worse more most less least
time day days week weeks month months year years today tomorrow yesterday morning now soon early late long short
work works worked working team teams project projects manager managers member members people person group groups company
make makes made making take takes took taken taking give gives gave given get gets got getting go goes went going come comes came
use uses used using need needs needed want wants wanted like likes liked know knows knew known think thinks thought see sees saw seen
say says said tell tells told ask asks asked answer answers answered help helps helped find finds found look looks looked
start starts started begin begins began end ends ended finish finishes finished continue continues continued stop stops stopped
show shows showed shown put puts add adds added keep keeps kept let lets leave leaves left move moves moved change changes changed
call calls called run runs ran set sets try tries tried turn turns turned bring brings brought hold holds held write writes wrote
read reads meet meets met send sends sent receive receives received report reports reported plan plans planned planning
create creates created build builds built develop develops developed deliver delivers delivered provide provides provided
follow follows followed complete completes completed review reviews reviewed check checks checked test tests tested
manage manages managed lead leads led support supports supported improve improves improved increase increases increased
decrease decreases reduce reduces reduced high higher highest low lower lowest big large small great much many few little
all any some each every both other others another same different such own few several enough
because since while until unless although though however therefore thus so as well still yet even always never often sometimes
up down out off back away again once twice ever also almost around near far behind above below
project team work product process quality value cost price budget risk issue problem problems solution solutions
question questions option options choice choices answer correct incorrect wrong right true false exam
should would could shall must ought
part parts whole full empty open close closed way ways thing things point points case cases fact facts
number numbers amount level levels rate rates result results effect effects reason reasons
possible impossible able unable easy hard difficult simple important main major minor
name names list lists line lines type types kind kinds form forms order orders place places area areas side sides top bottom
mean means meaning yes ok okay please thank thanks
his hers ours yours mine theirs itself himself herself themselves myself yourself ourselves
been being was were had has have
per via etc eg ie vs
week's team's project's manager's company's client's
following above below given based upon toward towards among along beside besides despite except including
`.split(/\s+/).filter(Boolean));

/* Bề mặt đã có trong termbase (mọi sourceTerms + termVi) — không đề xuất lại. */
const covered = new Set();
for (const t of termbase.terms) {
  for (const s of [...(t.sourceTerms || []), t.termVi]) {
    for (const w of String(s).toLowerCase().split(/[^a-z'-]+/)) if (w) covered.add(w);
    covered.add(String(s).toLowerCase());
  }
}

/* Gộp các dạng biến hình đơn giản về một "gốc" để đếm chung (approve/approves/approved/approving). */
function stem(w) {
  if (w.length > 5 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

const docFreq = new Map(); // stem -> {count, forms:Map}
for (const list of Object.values(quiz.data)) {
  for (const q of list) {
    const text = [q.stem, ...(q.choices || []).map((c) => c.text), q.explanationShort].join(" ");
    const seen = new Set();
    for (const raw of text.toLowerCase().split(/[^a-z'-]+/)) {
      const w = raw.replace(/^[-']+|[-']+$/g, "");
      if (w.length < 4) continue;
      if (COMMON.has(w) || covered.has(w)) continue;
      const s = stem(w);
      if (COMMON.has(s) || covered.has(s)) continue;
      if (seen.has(s)) continue;
      seen.add(s);
      if (!docFreq.has(s)) docFreq.set(s, { count: 0, forms: new Map() });
      const e = docFreq.get(s);
      e.count++;
      e.forms.set(w, (e.forms.get(w) || 0) + 1);
    }
  }
}

const rows = [...docFreq.entries()]
  .filter(([, e]) => e.count >= 8)
  .sort((a, b) => b[1].count - a[1].count);
console.log(`# ${rows.length} ứng viên (xuất hiện >= 8 câu), tổng ${Object.values(quiz.data).reduce((a, b) => a + b.length, 0)} câu`);
for (const [s, e] of rows) {
  const forms = [...e.forms.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f).join("|");
  console.log(`${String(e.count).padStart(4)}  ${s.padEnd(20)} ${forms}`);
}
