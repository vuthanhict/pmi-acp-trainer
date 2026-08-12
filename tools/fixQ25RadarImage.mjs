/* ===================== Bổ sung nội dung thiếu cho câu 25 - PMI Practice Exam (2024) =====================
   Câu q_53e1465f6426 (quiz 88, câu #25) thiếu danh sách 8 hạng mục đánh giá trong phần thân câu hỏi
   (bị cắt mất khi trích xuất dữ liệu gốc) và không có hình radar chart minh họa điểm số nhóm — vốn là
   một phần bắt buộc của đề bài (đáp án đúng phụ thuộc vào việc đọc số liệu trên biểu đồ).

   Người dùng cung cấp lại ảnh gốc; ảnh được vẽ lại thành SVG tại public/images/q25-team-radar.svg
   (public/images/q25-team-radar.svg) dựa trên số liệu đọc được từ ảnh và khớp với explanationShort
   sẵn có ("constructive disagreement" = 1, "committed team" = 3 là hai mức thấp nhất).

   Chạy: node tools/fixQ25RadarImage.mjs
*/
import fs from "fs";
import zlib from "zlib";
import { readPayload } from "./extractEmbedded.mjs";

const SRC = "src/lib/embeddedData.js";
const QUESTION_ID = "q_53e1465f6426";
const IMAGE_PATH = "images/q25-team-radar.svg";

const CATEGORIES = [
  "Self Organizing",
  "Empowered to Make Decisions",
  "Belief in Vision and Success",
  "Committed Team",
  "Trust Each Other",
  "Participatory Decision Making",
  "Consensus-Driven",
  "Constructive Disagreement",
];

const NEW_STEM =
  "At a company-wide retreat, a project team completed team-building activities, training, and a personality assessment matrix. At their first retrospective back at work, the scrum master facilitates a more specific team performance evaluation. The five team members were asked to score the team in eight categories and then the mean scores were plotted in a radar chart:\n" +
  "The questionnaire stated: On a scale of 1-5, how well do you rate the team in the following categories:\n\n" +
  CATEGORIES.map((c) => `- ${c}`).join("\n") +
  "\n\nWhich statement correctly describes the health of this team?";

const quizEmbed = readPayload("QUIZ_EMBED_GZ_B64");

let found = 0;
for (const list of Object.values(quizEmbed.data)) {
  for (const q of list) {
    if (q.id !== QUESTION_ID) continue;
    q.stem = NEW_STEM;
    q.image = IMAGE_PATH;
    q.imageAlt =
      "Radar chart 'Team Score' theo thang 1-5 (1=Strongly Disagree, 3=Neutral, 5=Strongly Agree): Self Organizing 4, Empowered to Make Decisions 2, Belief in Vision and Success 4, Committed Team 3, Trust Each Other 4, Participatory Decision Making 4, Consensus-Driven 3, Constructive Disagreement 1.";
    found++;
  }
}
if (found !== 1) throw new Error(`kỳ vọng tìm thấy đúng 1 câu ${QUESTION_ID}, tìm thấy ${found}`);

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

console.log(`Đã bổ sung stem (danh sách 8 hạng mục) + image cho câu ${QUESTION_ID}.`);
