/* ===================== Sửa explanationShort cho các câu có ảnh mới bổ sung =====================
   Sau khi gắn ảnh gốc cho 10 câu (xem tools/fixImageQuestions.mjs), đối chiếu lại explanationShort
   (tiếng Anh, nguồn) và explanationShortVi (bản dịch) với "Giải thích" đầy đủ trong nguồn LMS, phát
   hiện 2 nhóm lỗi:

   1) Q25 và Q95 (đề PMI Practice Exam 2024): explanationShort tiếng Anh là bản copy nguyên văn nhưng
      bị CẮT MẤT câu cuối cùng của giải thích gốc. Bản dịch tiếng Việt (explanationShortVi) của 2 câu
      này thực ra đã đầy đủ và chính xác từ trước — chỉ cần nối lại câu tiếng Anh bị thiếu.
   2) 4 câu (SUPER1 Q162, Prepcast 02 Q54, Prepcast 03 Q47, Prepcast 03 Q70): explanationShort tiếng
      Anh không phải là giải thích thật — mà là GHI CHÚ CỦA NGƯỜI/AI XỬ LÝ DỮ LIỆU TRƯỚC ĐÂY, dạng
      hướng dẫn viết lại ("State explicitly which band widens...", "Verify the app's chart image
      renders this clearly.") vì tại thời điểm đó app chưa có ảnh nên không thể viết giải thích thật
      dựa trên hình. Bản dịch tiếng Việt tương ứng phần lớn cũng mang tính chung chung/giả định hình
      ảnh, và câu Prepcast 03 Q47 còn SAI SỰ THẬT (nói đường Actual "bám sát" đường lý tưởng, trong khi
      ảnh gốc cho thấy Actual tụt lại rõ rệt so với Schedule). Nay đã có ảnh gốc, viết lại cả bản tiếng
      Anh và tiếng Việt dựa trên số liệu quan sát được trực tiếp trên từng hình.
   3) SUPER1 Q126: cả bản tiếng Anh lẫn tiếng Việt đều mô tả SAI CHIỀU biểu đồ — nói đường Points
      Completed "tụt xuống dưới/thấp hơn" đường Points Planned, trong khi ảnh gốc cho thấy điều ngược
      lại (Points Completed nằm CAO HƠN Points Planned từ khoảng ngày 5 trở đi — đúng là chậm tiến độ,
      nhưng vị trí mô tả trên biểu đồ bị đảo ngược, có thể gây hiểu sai khi đối chiếu với hình).
   4) Prepcast 01 Q91: cả bản tiếng Anh lẫn tiếng Việt đều mô tả NGƯỢC cấu trúc bảng — nói "mỗi cột đại
      diện cho một ràng buộc" (constraint), trong khi ảnh gốc cho thấy ngược lại: các HÀNG là ràng buộc
      (Schedule/Cost/Scope), các CỘT là mức ưu tiên (Fixed/Flexible/Accept). Viết lại theo đúng cấu trúc
      thật của bảng trong ảnh, đồng thời chỉ rõ ô vi phạm cụ thể (cột "Flexible" có 2 dấu tích).

   Chạy: node tools/fixImageQuestionExplanations.mjs
*/
import fs from "fs";
import zlib from "zlib";
import { readPayload } from "./extractEmbedded.mjs";

const SRC = "src/lib/embeddedData.js";

/* ---- 1) explanationShort tiếng Anh (QUIZ_EMBED) ---- */
const EN_FIXES = {
  q_53e1465f6426: {
    quizIndex: 88,
    explanationShort:
      "This team scored lowest in the \"constructive disagreement\" and \"committed team\" categories, averaging scores of \"1\" and \"3,\" respectively. The team should focus on commitment and how to optimize conflict. The Tabaka Model, as described by Jean Tabaka, focuses on building effective and cohesive teams through leadership principles and behaviors that foster trust and collaboration. This model emphasizes the importance of the leader's role in creating a positive team environment and includes both principles to embrace and principles to avoid.",
  },
  q_7189b930c648: {
    quizIndex: 88,
    explanationShort:
      "The amount of work completed per iteration is stable, but the number of items in the backlog is steadily increasing. This indicates that the team is working consistently but the backlog continues to grow, which can lead to delays if priorities are not adjusted. Reviewing priorities and adjusting the number of items in the backlog will ensure the team focuses on the most critical tasks and avoids delays. Increasing the number of team members does not guarantee an immediate increase in velocity; on the contrary, it may reduce velocity in the short term and create additional delays.",
  },
  q_2a5fbecb555c: {
    quizIndex: 90,
    explanationShort:
      "On the burndown chart, the actual-progress line (solid, square markers) stays above the ideal line (dashed) for the whole iteration — from day 19 to day 31 it only drops from about 800 to about 600, while the ideal line is nearly at zero by then. This shows the team fell behind schedule from early on and did not finish all the work planned for the iteration, matching answer C.",
  },
  q_2c1a41fa5dd6: {
    quizIndex: 2,
    explanationShort:
      "On a cumulative flow diagram, a bottleneck shows up as a band that widens because work enters that stage faster than it leaves. By Day 8 the Development band has grown very wide while the Testing band right after it stays narrow — work is piling up waiting to be tested, so Testing is the bottleneck. The other stages keep a steady or narrow band, meaning work still flows through them normally.",
  },
  q_19d900458fdc: {
    quizIndex: 3,
    explanationShort:
      "The 10-day burndown chart shows the Actual line tracking close to the Schedule line for the first few days, then falling more slowly: by Day 7 about 100 hours remain versus roughly 64 planned. The team is behind, but only moderately so, midway through the sprint — the right move is to keep the committed user stories as-is and push to finish them, rather than adding, removing, or re-prioritizing scope mid-sprint.",
  },
  q_54657cee7bc5: {
    quizIndex: 3,
    explanationShort:
      "The burndown chart shows remaining work staying almost flat (about 720 down to 630, then holding near 680) through iterations 2-4 instead of trending down toward zero like the schedule line. Because new user stories were added during those iterations, this flat line means the team kept completing work at a steady pace but only enough to offset the newly added scope — it merely kept up with the added scope rather than shrinking the overall backlog.",
  },
  q_00f1bf119445: {
    quizIndex: 90,
    explanationShort:
      "Early in the iteration, the Points Completed (remaining) line tracks close to the Points Planned line, but from around Day 5 it stays above the Points Planned line and the gap keeps widening — meaning more points remain to be done than the plan called for, i.e. the team is completing work more slowly than planned. That puts the iteration at risk of not finishing everything, matching answer A. If Points Completed had instead dropped below Points Planned, that would mean the team was ahead of schedule (answer C) — not what this chart shows.",
  },
  q_ff9086d40c50: {
    quizIndex: 1,
    explanationShort:
      "In this tradeoff matrix, the rows are the project constraints (Schedule, Cost, Scope) and the columns are the priority levels (Fixed, Flexible, Accept) — each constraint should be checked in exactly one column, so the three checks form a one-to-one mapping. Here the \"Flexible\" column has two checks (Schedule and Cost), while \"Schedule\" itself is checked in two columns (Fixed and Flexible) — the matrix never actually says whether schedule is the fixed constraint or a flexible one, contradicting its own purpose. Each column should only contain one mark, matching answer C.",
  },
};

/* ---- 2) explanationShortVi (VI_ENRICHMENT) — chỉ với các câu cần viết lại thật sự ---- */
const VI_FIXES = {
  q_2a5fbecb555c: {
    quizIndex: 90,
    explanationShortVi:
      "Trên biểu đồ burndown, đường tiến độ thực tế (nét liền, ô vuông) luôn nằm TRÊN đường lý tưởng (nét đứt) trong suốt cả iteration — từ ngày 19 đến ngày 31 chỉ giảm từ khoảng 800 xuống khoảng 600, trong khi đường lý tưởng gần như đã chạm 0. Điều này cho thấy đội chậm tiến độ ngay từ đầu và không hoàn thành hết công việc đã lên kế hoạch cho iteration, khớp với đáp án C.\n\nĐáp án A sai vì mô tả tình huống ngược lại. Đáp án B và D sai vì burndown chart không thể hiện việc \"kéo dài\" hay \"rút ngắn\" thời gian iteration — timebox của Scrum là cố định, burndown chỉ phản ánh lượng công việc còn lại so với thời gian đã cố định sẵn.",
  },
  q_2c1a41fa5dd6: {
    quizIndex: 2,
    explanationShortVi:
      "Trong biểu đồ luồng tích lũy (CFD), điểm nghẽn được nhận diện qua dải màu (band) của một giai đoạn ngày càng phình rộng theo thời gian — nghĩa là công việc đi VÀO giai đoạn đó nhanh hơn tốc độ đi RA. Theo biểu đồ, tính đến Ngày 8, dải \"Development\" đã phình rất rộng trong khi dải \"Testing\" ngay sau đó lại rất hẹp — công việc đang ùn ứ chờ được kiểm thử, nên Testing chính là điểm nghẽn (đáp án c). Các giai đoạn còn lại (Analysis, Deployment) có dải ổn định hoặc hẹp hơn, cho thấy luồng công việc qua các khâu này vẫn thông suốt.",
  },
  q_19d900458fdc: {
    quizIndex: 3,
    explanationShortVi:
      "Biểu đồ burndown 10 ngày (\"Est Hrs Remaining\") cho thấy đường Actual bám khá sát đường Schedule trong vài ngày đầu, sau đó giảm chậm hơn hẳn: đến Ngày 7 còn khoảng 100 giờ trong khi kế hoạch chỉ còn khoảng 64 giờ. Đội đang chậm hơn kế hoạch, nhưng mới ở mức vừa phải và đang ở giữa sprint (ngày 7/10), nên việc hợp lý nhất là giữ nguyên các user story đã cam kết trong sprint backlog và cố gắng hoàn thành nhanh nhất có thể, thay vì thêm, bớt hay sắp xếp lại ưu tiên giữa chừng.\n\n(b) Thêm story chỉ hợp lý nếu team đang dư năng lực, không phải khi đang chậm tiến độ. (c) Sắp xếp lại ưu tiên không giải quyết được vấn đề khối lượng công việc còn nhiều hơn dự kiến. (d) Loại bỏ story là phản ứng thái quá khi mới chậm ở mức vừa phải và còn nhiều ngày phía trước.",
  },
  q_54657cee7bc5: {
    quizIndex: 3,
    explanationShortVi:
      "Biểu đồ burndown cho thấy khối lượng công việc còn lại gần như đi ngang (khoảng 720 → 630 rồi giữ quanh mức 680) suốt iteration 2–4, thay vì giảm dần về 0 như đường kế hoạch. Vì có user story mới liên tục được thêm vào trong các iteration này, đường phẳng đó cho thấy đội vẫn hoàn thành công việc đều đặn nhưng chỉ vừa đủ bù lại phần scope mới phát sinh — tức đội \"chạy tại chỗ\": làm việc hiệu quả nhưng chưa thu hẹp được khối lượng còn lại vì scope tăng song song.\n\nĐáp án a sai vì biểu đồ đã cung cấp đủ dữ kiện để phân tích. Đáp án b là kết luận vội vàng khi còn nhiều iteration phía trước. Đáp án d mâu thuẫn với việc scope liên tục tăng khiến remaining work không thể giảm nhanh như kỳ vọng.",
  },
  q_00f1bf119445: {
    quizIndex: 90,
    explanationShortVi:
      "Ở đầu iteration, đường Points Completed (điểm còn lại theo thực tế) bám khá sát đường Points Planned, nhưng từ khoảng Ngày 5 nó bắt đầu nằm CAO HƠN đường Points Planned và khoảng cách ngày càng doãng ra — nghĩa là số điểm còn lại thực tế nhiều hơn kế hoạch, tức nhóm đang hoàn thành công việc chậm hơn dự kiến. Điều này khiến iteration có nguy cơ không hoàn thành đúng như kế hoạch (đáp án a).\n\nNếu đường Points Completed nằm THẤP hơn đường Points Planned thì mới là vượt tiến độ (đáp án c) — không phải điều biểu đồ này thể hiện. (b) Biểu đồ không cho thấy dấu hiệu cắt giảm phạm vi chủ động. (d) Velocity không đổi là khái niệm đo qua nhiều iteration, không phản ánh đúng tình huống tụt hậu đang diễn ra trong một iteration.",
  },
  q_ff9086d40c50: {
    quizIndex: 1,
    explanationShortVi:
      "Trong bảng tradeoff matrix này, các HÀNG là ràng buộc dự án (Schedule, Cost, Scope), còn các CỘT là mức ưu tiên (Fixed, Flexible, Accept) — mỗi ràng buộc chỉ nên được đánh dấu ở đúng MỘT cột, để ba dấu tích tạo thành một ánh xạ 1-1 giữa ràng buộc và mức ưu tiên. Ở bảng trong câu hỏi, cột \"Flexible\" lại có hai dấu tích (cả Schedule và Cost), đồng thời \"Schedule\" bị đánh dấu ở hai cột (Fixed và Flexible) — bảng không nói rõ được liệu schedule là ràng buộc cố định hay linh hoạt, tự mâu thuẫn với chính mục đích của nó. Mỗi cột chỉ nên có một dấu tích duy nhất, đúng như đáp án c.\n\nCác phương án khác không phản ánh đúng bản chất lỗi: (a) và (d) mô tả sai mục đích của công cụ (nó dùng để làm rõ độ ưu tiên, không phải liệt kê ràng buộc hay đo trọng số); (b) chỉ là đảo ngược cách trình bày hàng/cột, không liên quan đến lỗi logic của bảng.",
  },
};

const WORD_CHAR = /[a-z0-9]/;
function buildMatchers(termbase) {
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
function matchTermIds(matchers, text) {
  const hay = (text || "").toLowerCase();
  const found = new Set();
  for (const m of matchers) {
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

const quizEmbed = readPayload("QUIZ_EMBED_GZ_B64");
const enrichment = readPayload("VI_ENRICHMENT_GZ_B64");
const termbase = readPayload("VI_TERMBASE_GZ_B64");
const matchers = buildMatchers(termbase);

let foundEn = 0;
for (const list of Object.values(quizEmbed.data)) {
  for (const q of list) {
    const fix = EN_FIXES[q.id];
    if (!fix) continue;
    q.explanationShort = fix.explanationShort;
    foundEn++;
  }
}
if (foundEn !== Object.keys(EN_FIXES).length) throw new Error(`EN: kỳ vọng ${Object.keys(EN_FIXES).length} câu, tìm thấy ${foundEn}`);

let foundVi = 0;
for (const [qid, fix] of Object.entries(VI_FIXES)) {
  const pack = enrichment[String(fix.quizIndex)];
  const item = pack?.items?.[qid];
  if (!item) throw new Error(`VI: không tìm thấy ${qid} trong quiz ${fix.quizIndex}`);
  item.postAnswer.explanationShortVi = fix.explanationShortVi;
  item.postAnswer.termIds = matchTermIds(matchers, EN_FIXES[qid].explanationShort);
  foundVi++;
}
if (foundVi !== Object.keys(VI_FIXES).length) throw new Error(`VI: kỳ vọng ${Object.keys(VI_FIXES).length} câu, tìm thấy ${foundVi}`);

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

console.log(`Đã sửa explanationShort (EN) cho ${foundEn} câu, explanationShortVi cho ${foundVi} câu.`);
