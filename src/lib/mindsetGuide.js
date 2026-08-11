/* ===================== Cẩm nang ACP Mindset ===================== */
/* Dữ liệu tĩnh thuần (không import React) cho MindsetGuideScreen. Nội dung chắt lọc từ 3 nguồn:
 *  1) PMI-ACP Examination Content Outline (ECO) chính thức, PMI, tháng 11/2024 — 4 domain,
 *     tasks, enablers. Đây là "khung xương" chính thức, khớp đúng DOMAIN_WEIGHTS app đang dùng
 *     (Mindset 28% / Leadership 25% / Product 19% / Delivery 28%, xem gapEngine.js).
 *  2) Kỹ thuật "từ khóa → hành động đúng" — kỹ thuật ôn thi phổ biến trong cộng đồng PMI-ACP,
 *     đối chiếu với các mô hình gốc: 5 mức xung đột (Speed Leas) và 5 chế độ xử lý xung đột
 *     (Thomas-Kilmann).
 *  3) Kinh nghiệm thi thật từ cộng đồng (lessons learned) — điểm khác biệt PMP vs ACP, kỹ thuật
 *     làm bài, sai lầm thường gặp.
 * Không có nội dung nào ở đây thay thế được PMI Agile Practice Guide chính thức — đây là bản
 * tóm tắt để ôn tập nhanh trước ngày thi, không phải tài liệu học từ đầu. */

export const MINDSET_DOMAINS = [
  { key: "overview", labelVi: "Tổng quan", labelEn: "Overview" },
  { key: "mindset", labelVi: "Mindset · 28%", labelEn: "Mindset · 28%" },
  { key: "leadership", labelVi: "Leadership · 25%", labelEn: "Leadership · 25%" },
  { key: "product", labelVi: "Product · 19%", labelEn: "Product · 19%" },
  { key: "delivery", labelVi: "Delivery · 28%", labelEn: "Delivery · 28%" },
  { key: "keywords", labelVi: "Từ khóa → Hành động", labelEn: "Trigger → Action" },
  { key: "exam", labelVi: "Kinh nghiệm thi", labelEn: "Exam experience" },
];

export const MINDSET_SECTIONS = [
  {
    id: "why-mindset",
    domain: "overview",
    type: "intro",
    title: "Vì sao ACP thi TƯ DUY, không thi thuộc lòng",
    paragraphs: [
      "PMI-ACP không hỏi \"Scrum là gì\" — nó đưa ra một tình huống cụ thể và hỏi bạn sẽ làm gì TIẾP THEO. Hơn 90% câu hỏi là dạng tình huống (situational judgment): 2-3 phương án đều \"nghe có vẻ đúng\", chỉ một phương án đúng với tinh thần Agile thật sự.",
      "Cạm bẫy lớn nhất với người đã có PMP: cùng một tình huống, đáp án đúng ở PMP (chỉ đạo, quy trình, quyền lực của PM) có thể là đáp án SAI ở PMI-ACP (trao quyền, phục vụ nhóm, để nhóm tự quyết). Đề thi test đúng khả năng CHUYỂN tư duy này.",
    ],
    bullets: [
      "120 câu (100 câu tính điểm + 20 câu thử nghiệm không tính điểm, trộn ngẫu nhiên) — không biết câu nào là câu thử nghiệm nên phải làm nghiêm túc mọi câu.",
      "3 giờ làm bài, có 1 lần nghỉ 10 phút bắt buộc sau câu 60 — sau khi rà soát xong phần 1 và bắt đầu nghỉ, KHÔNG quay lại sửa phần 1 được nữa.",
      "4 domain: Mindset 28% · Leadership 25% · Product 19% · Delivery 28% — đúng tỉ trọng app dùng để tính GAP/Readiness.",
    ],
    source: "PMI-ACP Examination Content Outline, PMI, 11/2024",
  },
  {
    id: "domain-mindset",
    domain: "mindset",
    type: "domain",
    title: "Domain I — Mindset (28%)",
    summary: "Hiểu sâu tư duy và nguyên tắc Agile, tạo môi trường thử nghiệm — học hỏi — cải tiến liên tục, xây dựng nhóm hiệu suất cao và minh bạch triệt để.",
    tasks: [
      { name: "Thử nghiệm sớm (Experiment Early)", points: ["Xây tăng trưởng (increment) nhỏ để kiểm chứng giải pháp/nhu cầu thị trường trước khi làm lớn.", "Tạo môi trường để đổi mới, học hỏi và phát triển — chấp nhận thất bại nhỏ, học nhanh."] },
      { name: "Đón nhận tư duy Agile (Embrace Agile Mindset)", points: ["Áp dụng đúng giá trị & nguyên tắc Agile, không chỉ đúng công cụ/nghi thức.", "Biết phân loại tình huống bằng lý thuyết phức tạp (Cynefin, Stacey Matrix, CAS) để chọn cách tiếp cận phù hợp — việc CÀNG mới/CÀNG ít dữ liệu lịch sử, càng cần thử nghiệm/expert judgement thay vì lập kế hoạch chi tiết trước."] },
      { name: "Thúc đẩy môi trường nhóm cộng tác", points: ["Xây dựng tầm nhìn nhóm & thỏa thuận làm việc (working agreement) chung.", "Dùng kết quả Retrospective để cải tiến nhóm — không chỉ họp cho có.", "Cam kết theo quyết định của nhóm dù cá nhân không đồng ý hoàn toàn.", "Đánh giá mức hiểu Agile của nhóm để điều chỉnh cách tiếp cận (tailor), không áp một khuôn cho mọi nhóm."] },
      { name: "Xây dựng minh bạch (Build Transparency)", points: ["Công khai trạng thái, tiến độ, rủi ro, trở ngại cho TẤT CẢ mọi người — qua information radiator (bảng lớn, biểu đồ trực quan), không phải báo cáo riêng lẻ.", "Thiết lập vòng phản hồi (feedback loop) cho nhóm.", "Có chiến lược giao tiếp riêng cho nhóm co-located và nhóm phân tán."] },
      { name: "Nuôi dưỡng an toàn tâm lý (Foster Psychological Safety)", points: ["Văn hóa không đổ lỗi (no-blame) — khách quan khi nhìn vào vấn đề, không nhìn vào con người.", "Khuyến khích ĐỐI THOẠI hơn TRANH LUẬN thắng-thua.", "Chủ động xin và đưa phản hồi mang tính xây dựng, rồi HÀNH ĐỘNG theo phản hồi đó.", "Khuyến khích thách thức hiện trạng (status quo) một cách an toàn."] },
      { name: "Rút ngắn vòng phản hồi (Shorten Feedback Loops)", points: ["Đưa stakeholder vào NGAY TỪ NGÀY ĐẦU, không đợi tới cuối.", "Tối đa hóa giá trị trong một khung thời gian cho trước.", "Dùng công cụ rút ngắn phản hồi: design thinking, lean startup."] },
      { name: "Đón nhận thay đổi (Embrace Change)", points: ["Thúc đẩy growth mindset để phản ứng với thay đổi thay vì chống lại.", "Thích nghi quy trình khi yêu cầu/độ ưu tiên thay đổi.", "Khuyến khích kỹ năng đa năng (generalizing specialist) trong nhóm.", "Điều chỉnh sản phẩm theo học hỏi & phản hồi mới, không bám cứng kế hoạch cũ."] },
    ],
  },
  {
    id: "domain-leadership",
    domain: "leadership",
    type: "domain",
    title: "Domain II — Leadership (25%)",
    summary: "Lãnh đạo bằng ảnh hưởng, không bằng quyền lực. Servant leadership là sợi chỉ xuyên suốt domain này.",
    tasks: [
      { name: "Trao quyền cho nhóm (Empower Teams)", points: ["Xây dựng môi trường tin cậy, giao tiếp minh bạch.", "Tạo động lực để nhóm thử nghiệm/chấp nhận rủi ro có kiểm soát.", "Coach & mentor thành viên — phân biệt rõ Training (dạy kiến thức) / Coaching (khai vấn để tự tìm câu trả lời) / Mentoring (chia sẻ kinh nghiệm cá nhân), dùng đúng cái khi đúng lúc.", "Thúc đẩy sở hữu chung (collective ownership) mục tiêu.", "Dùng trí tuệ cảm xúc (emotional intelligence) để hỗ trợ nhóm, tăng đồng cảm, giải quyết xung đột."] },
      { name: "Hỗ trợ giải quyết vấn đề (Facilitate Problem Resolution)", points: ["Tìm NGUYÊN NHÂN GỐC RỄ (root cause analysis, Ishikawa/fishbone) — không xử lý phần ngọn.", "Cùng nhóm xác định chiến lược giải quyết mang lại giá trị cao nhất.", "Đảm bảo vấn đề được giải quyết ĐÚNG THỜI HẠN — không để trôi."] },
      { name: "Thúc đẩy chia sẻ tri thức", points: ["Tạo môi trường ghi nhận & chia sẻ tri thức: lessons learned, retrospective, cộng đồng thực hành (community of practice).", "Tận dụng tài sản tri thức tổ chức từ các sáng kiến tương tự trước đó.", "Dành thời gian THẬT SỰ cho việc chia sẻ tri thức, không chỉ nói suông."] },
      { name: "Thúc đẩy tầm nhìn & mục đích chung", points: ["Đảm bảo mọi stakeholder hiểu chung một tầm nhìn/mục đích.", "Đảm bảo sản phẩm luôn bám sát tầm nhìn & mục tiêu tổ chức.", "Truyền đạt LIÊN TỤC tầm nhìn — không phải nói một lần rồi thôi."] },
      { name: "Hỗ trợ quản lý xung đột (Facilitate Conflict Management)", points: ["Xác định nguyên nhân gốc rễ VÀ mức độ nghiêm trọng của xung đột trước khi hành động.", "Ưu tiên cách tiếp cận CỘNG TÁC (collaborative) để giải quyết — xem mục \"Bậc thang xung đột\" bên dưới."] },
    ],
  },
  {
    id: "domain-product",
    domain: "product",
    type: "domain",
    title: "Domain III — Product (19%)",
    summary: "Domain nhỏ nhất về tỉ trọng nhưng dễ mất điểm nhất nếu nhầm vai trò — ai được làm gì với backlog.",
    tasks: [
      { name: "Tinh chỉnh Product Backlog (Refine Product Backlog)", points: ["Làm rõ các mục backlog còn mơ hồ.", "Ưu tiên backlog CÙNG với khách hàng/stakeholder — nhưng quyết định cuối cùng luôn thuộc về Product Owner.", "Chia nhỏ (decompose) các mục backlog khi cần.", "Dùng kỹ thuật ước lượng tập thể (planning poker, affinity estimating...)."] },
      { name: "Quản lý increment", points: ["Đảm bảo increment bám sát ưu tiên nghiệp vụ.", "Định nghĩa rõ mục tiêu của increment.", "Trình diễn increment sớm để lấy phản hồi.", "Đo lường giá trị đã bàn giao — không chỉ đo \"đã làm xong việc\"."] },
      { name: "Trực quan hóa công việc (Visualize Work)", points: ["Hướng dẫn nhóm dùng kỹ thuật trực quan hóa (Kanban board, burn-up/down...).", "Thiết lập quy trình cập nhật số liệu thường xuyên.", "Chia sẻ thông tin liên tục cho mọi bên liên quan."] },
      { name: "Quản lý bàn giao giá trị (Manage Value Delivery)", points: ["Định nghĩa rõ \"giá trị\" trông như thế nào (tiêu chí thành công, bảo mật, tuân thủ...).", "Đảm bảo các increment giá trị được tối ưu.", "Xác nhận kết quả mục tiêu thực sự đạt được (hài lòng khách hàng, tăng doanh số...)."] },
    ],
  },
  {
    id: "domain-delivery",
    domain: "delivery",
    type: "domain",
    title: "Domain IV — Delivery (28%)",
    summary: "Domain nặng tỉ trọng ngang Mindset. Trọng tâm: phản hồi sớm, đo lường bằng metrics thật, và loại bỏ lãng phí.",
    tasks: [
      { name: "Tìm phản hồi sớm (Seek Early Feedback)", points: ["Đánh giá mức hài lòng của khách hàng liên tục, không đợi cuối dự án.", "Bàn giao theo increment nhỏ.", "Thu thập & tích hợp phản hồi stakeholder ĐỀU ĐẶN."] },
      { name: "Quản lý agile metrics", points: ["Chọn đúng chỉ số cho đúng đối tượng xem (không phải 1 bộ số cho tất cả).", "Công khai (radiate) chỉ số cho người liên quan.", "Dùng insight từ số liệu để RA QUYẾT ĐỊNH, không chỉ để báo cáo."] },
      { name: "Quản lý trở ngại & rủi ro", points: ["CHỦ ĐỘNG nhận diện rủi ro/trở ngại trước khi chúng thành vấn đề.", "Cùng nhóm tìm hướng xử lý phù hợp nhất.", "Ưu tiên loại bỏ trở ngại & giảm thiểu rủi ro theo mức ảnh hưởng.", "Dùng lessons learned để tránh rủi ro/trở ngại lặp lại."] },
      { name: "Nhận diện & loại bỏ lãng phí", points: ["Trực quan hóa toàn bộ dòng chảy giá trị (value-added vs non-value-added).", "Dùng số liệu & vòng phản hồi để phát hiện lãng phí.", "Lặp lại việc nhận diện — giảm lãng phí là quá trình liên tục, không làm một lần."] },
      { name: "Cải tiến liên tục", points: ["Lấy số liệu & phản hồi để dẫn dắt cải tiến.", "Triển khai hành động cải tiến cụ thể.", "Đánh giá HIỆU QUẢ thật của cải tiến đã làm — không chỉ làm cho có."] },
      { name: "Chủ động thu hút khách hàng", points: ["Xác định & phân tích đúng nhu cầu khách hàng.", "Xác nhận sản phẩm của mỗi iteration đáp ứng đúng tiêu chí chấp nhận (acceptance criteria).", "Khuyến khích khách hàng cộng tác trực tiếp với nhóm."] },
      { name: "Tối ưu dòng chảy (Optimize Flow)", points: ["Giới hạn công việc đang làm (WIP limit) ở MỌI cấp độ.", "Bảo vệ nhóm khỏi gián đoạn (tạo \"lá chắn\"/team interface).", "Dùng số liệu để phân tích & cải thiện dòng chảy."] },
    ],
  },
  {
    id: "kw-team",
    domain: "keywords",
    type: "keywordTable",
    title: "Đội nhóm & Servant Leadership",
    intro: "Mẫu số chung: Scrum Master KHÔNG tự làm thay nhóm, KHÔNG tự đưa giải pháp — luôn tạo điều kiện để nhóm tự giải quyết.",
    rows: [
      { trigger: "Xung đột (conflict) trong nhóm", action: "Đưa các bên vào \"một phòng\" (one room), tạo điều kiện để họ tự hòa giải trước khi can thiệp sâu hơn." },
      { trigger: "Thành viên mất động lực (demotivated)", action: "Tìm hiểu NGUYÊN NHÂN trước, sau đó hành động dựa trên động lực CÁ NHÂN của người đó — không áp dụng một cách chung cho cả nhóm." },
      { trigger: "Thành viên vi phạm quy tắc nhóm", action: "Nhắc lại Ground Rules / Working Agreement mà chính nhóm đã tự đặt ra — không áp luật từ trên xuống." },
      { trigger: "Việc mới hoàn toàn, không có dữ liệu lịch sử (new, unfamiliar, no historical data)", action: "Hỏi ý kiến chuyên gia (Expert Judgement/SME), xây Prototype để lấy phản hồi sớm, hoặc dùng nguồn lực/outsource bên ngoài." },
      { trigger: "Stakeholder không biết gì về Agile", action: "Coaching hoặc Training cho họ — đừng giả định họ tự hiểu." },
      { trigger: "Một thành viên thiếu kỹ năng (skill gap)", action: "Scrum Master TỔ CHỨC buổi training/coaching cho người đó — không tự mình đứng ra dạy trực tiếp (đó là vai trò tạo điều kiện, không phải giảng viên)." },
      { trigger: "Cần ước lượng (estimate) công việc", action: "Để CHÍNH NHÓM ước lượng — họ là người thực thi, có đủ kiến thức & kinh nghiệm để ước lượng đúng nhất." },
      { trigger: "PMO yêu cầu hướng dẫn (PMO guidance)", action: "Trao đổi với PMO để thống nhất kế hoạch/quy trình, và LUÔN thông báo tình trạng dự án cho PMO — không né tránh PMO." },
      { trigger: "Câu hỏi dạng \"phương án XỬ LÝ TỐT NHẤT\" (keyword: best)", action: "Ưu tiên: xác định nguyên nhân gốc rễ → họp trực tiếp (face-to-face) → đạt đồng thuận (buy-in) → thông báo cho stakeholder liên quan." },
      { trigger: "Quá nhiều yêu cầu, nguồn lực hạn chế", action: "Dùng MVP (Minimum Viable Product) — chỉ giữ đủ tính năng cốt lõi để kiểm chứng giá trị/kiểm chứng thị trường." },
      { trigger: "Nhóm phân tán về địa lý, cần giao tiếp", action: "Vẫn ưu tiên hình thức GẦN VỚI face-to-face nhất — dùng virtual meeting có video/whiteboard thay vì chỉ chat/email." },
      { trigger: "Chỉ Product Owner mới được sắp xếp ưu tiên", action: "PM/Scrum Master/thành viên nhóm KHÔNG bao giờ tự ý sắp xếp ưu tiên Product Backlog — nếu PO chưa biết cách, coach cho PO chứ không làm thay." },
    ],
  },
  {
    id: "kw-stakeholder",
    domain: "keywords",
    type: "keywordTable",
    title: "Stakeholder Engagement",
    intro: "Cốt lõi: hiểu đúng kỳ vọng, engage liên tục xuyên suốt (không phải chỉ đầu/cuối dự án), và luôn hướng tới đồng thuận thay vì áp đặt.",
    rows: [
      { trigger: "Stakeholder phàn nàn, không chấp nhận deliverables", action: "Hiểu rõ kỳ vọng của họ, engage họ xuyên suốt dự án, và cung cấp Definition of Done (DoD) rõ ràng theo đúng kỳ vọng đã thống nhất." },
      { trigger: "Stakeholder phàn nàn về yêu cầu/phạm vi thiếu hoặc không rõ", action: "Xem lại các tiêu chí ĐÃ THỎA THUẬN (agreed criteria) và hướng dẫn thực hiện lại cho rõ." },
      { trigger: "Stakeholder (dự án Agile) muốn biết thêm về tình hình dự án", action: "Mời họ tham gia buổi Sprint Review — đây là kênh chính thức để stakeholder nắm tiến độ." },
      { trigger: "Stakeholder chia sẻ nhiều ý tưởng/quyết định khác nhau", action: "Tham khảo ý kiến các Key Stakeholder, tạo điều kiện xử lý xung đột giữa các ý tưởng, và đồng bộ lại tầm nhìn chung của dự án." },
    ],
  },
  {
    id: "conflict-ladder",
    domain: "keywords",
    type: "ladder",
    title: "Bậc thang xử lý xung đột",
    intro: "Nguyên tắc chung: LUÔN xử lý ở mức thấp nhất có thể trước khi leo thang. PM/Scrum Master phải là người chủ động đứng ra kết thúc xung đột — không được để trôi (delay).",
    steps: [
      { title: "1 · Các bên tự xử lý trước", detail: "Mọi cá nhân/nhóm liên quan cần tự cố gắng xử lý trước khi cần người thứ ba can thiệp. Tương ứng mức 1 (Speed Leas): \"vấn đề cần giải quyết\" — chỉ cần thúc đẩy đồng thuận." },
      { title: "2 · Xung đột GIỮA 2 cá nhân", detail: "Làm việc/trao đổi RIÊNG với từng người trước, sau đó mới đưa họ ngồi lại cùng nhau trao đổi — không nhảy thẳng vào họp chung khi cảm xúc còn căng." },
      { title: "3 · Vấn đề mang tính CÁ NHÂN/riêng tư", detail: "Họp kín (private meeting), tìm nguyên nhân gốc rễ (root cause) trước khi hành động." },
      { title: "4 · Vấn đề của CẢ NHÓM", detail: "Họp nhóm (team meeting), tạo điều kiện để đạt hiệu quả, mục tiêu chung và sự đồng thuận. Tương ứng mức 2 Leas — nhóm sẵn sàng bàn nhưng cần được hỗ trợ để chủ động lên tiếng." },
      { title: "5 · Xung đột leo thang thành \"cạnh tranh\"", detail: "Dùng thỏa hiệp (compromise), đàm phán dựa trên dữ liệu để đạt thống nhất. Tương ứng mức 3 Leas (\"contest\")." },
      { title: "6 · Không tự giải quyết được", detail: "Áp dụng hình thức kỷ luật chính thức bằng văn bản (formal written) — cần trung gian trung lập khi cảm xúc đã leo thang mạnh. Tương ứng mức 4 Leas (\"fight or flight\")." },
      { title: "7 · Phương án cuối cùng", detail: "Escalate lên Functional Manager hoặc Sponsor. Tương ứng mức 5 Leas (\"intractable\") — lúc này trọng tâm chuyển từ \"giải quyết\" sang \"kiểm soát thiệt hại\", có thể cần tách các cá nhân ra." },
    ],
    notes: [
      "Xung đột về NGUỒN LỰC (resource conflict) → làm việc với Functional Manager, không tự quyết một mình.",
      "Đàm phán (dealing) với Vendor → liên quan đến conflict/issue và chiến lược Procurement, không xử lý như xung đột nội bộ nhóm.",
      "Xung đột GIỮA 2 team → họp + coaching, luôn ưu tiên hướng WIN-WIN, hiểu rõ nguyên nhân gốc rễ, phân loại tích cực/tiêu cực, xử lý theo vai trò & trách nhiệm — với dự án Agile có thể xử lý qua Retrospective.",
      "Xung đột giữa Team và Stakeholder → xử lý trực tiếp với bên liên quan, vẫn theo hướng WIN-WIN, dựa trên ý kiến Key Stakeholder và đàm phán theo đúng quy trình đã thống nhất.",
      "Nếu thông tin liên quan tới vấn đề RIÊNG TƯ/bảo mật (confidential, personal) → dùng phỏng vấn riêng (interview) thay vì họp công khai.",
    ],
    source: "Đối chiếu với mô hình 5 mức xung đột (Speed Leas) và 5 chế độ xử lý xung đột (Thomas-Kilmann): Competing/Avoiding/Accommodating/Collaborating/Compromising — PMI-ACP hầu như luôn ưu tiên Collaborating (cộng tác, cùng thắng) trừ khi đề bài nêu rõ cần quyết định nhanh.",
  },
  {
    id: "kw-modes",
    domain: "keywords",
    type: "modesTable",
    title: "5 chế độ xử lý xung đột (Thomas-Kilmann)",
    rows: [
      { mode: "Collaborating — Cộng tác", when: "Vấn đề quan trọng, cần cả hai bên đều thắng", note: "Chế độ MẶC ĐỊNH mà PMI-ACP mong đợi — tin tưởng, giao tiếp cởi mở." },
      { mode: "Compromising — Thỏa hiệp", when: "Cần một giải pháp ở giữa, chấp nhận được cho cả hai bên", note: "Dùng khi không đủ thời gian/điều kiện để Collaborate trọn vẹn." },
      { mode: "Accommodating — Nhường nhịn", when: "Mối quan hệ quan trọng hơn vấn đề đang tranh cãi", note: "Cần lắng nghe, đồng cảm — dùng có chọn lọc, không dùng liên tục." },
      { mode: "Avoiding — Né tránh", when: "Cần thời gian để hạ nhiệt cảm xúc trước khi bàn tiếp", note: "Tạm thời, không phải giải pháp lâu dài." },
      { mode: "Competing — Áp đặt", when: "Cần quyết định NHANH, tình huống khẩn cấp", note: "Ít dùng nhất trong tinh thần Agile — chỉ khi thời gian không cho phép cách khác." },
    ],
  },
  {
    id: "exam-mistakes",
    domain: "exam",
    type: "tips",
    title: "Sai lầm thường gặp & kinh nghiệm thi thật",
    items: [
      "Đừng mang tư duy PMP vào ACP. Cùng một tình huống, \"chỉ đạo/quy trình\" có thể đúng ở PMP nhưng SAI ở ACP — ACP luôn ưu tiên trao quyền, phục vụ nhóm (servant leadership).",
      "Đề thường có 2-3 đáp án \"nghe có vẻ đúng\". Lọc bằng giá trị & nguyên tắc Agile: chọn đáp án phục vụ NHÓM/KHÁCH HÀNG nhất, không phải đáp án nghe \"nhanh gọn\" nhất.",
      "Chú ý các từ khóa đổi hướng câu hỏi: \"most likely\", \"best next step\", \"first\", \"should\" — đọc sót một từ có thể đổi hoàn toàn đáp án đúng.",
      "3 giờ làm bài, nghỉ 10 phút bắt buộc sau câu 60 — sau khi bắt đầu nghỉ KHÔNG quay lại sửa phần trước được. Đánh dấu (flag) câu chưa chắc để rà lại TRƯỚC khi bấm nghỉ, không phải sau.",
      "Luyện câu tình huống quan trọng hơn học thuộc định nghĩa suông — ACP đo khả năng ÁP DỤNG, không đo khả năng nhớ.",
      "Giữ lại một \"nhật ký câu sai\" trong lúc luyện, ghi rõ lý do sai mỗi câu — đây chính xác là mục đích của thẻ \"Câu hay sai\" trong app: xem lại đúng những câu bị sai LẶP LẠI qua nhiều lần làm, thay vì chỉ nhớ điểm số cuối cùng.",
      "Khi làm đề thi thử (mock exam), làm dưới ĐÚNG điều kiện thi thật — tính giờ, không tra cứu — để quen áp lực thời gian và tự lượng đúng tốc độ làm bài của bản thân.",
    ],
    source: "Tổng hợp kinh nghiệm thi thật từ cộng đồng ôn thi PMI-ACP.",
  },
  {
    id: "exam-references",
    domain: "exam",
    type: "references",
    title: "Nguồn tham khảo",
    items: [
      { label: "PMI-ACP® Examination Content Outline (PMI, 11/2024) — bản chính thức", url: "https://www.pmi.org/-/media/pmi/documents/public/pdf/certifications/agile-certified-exam-outline.pdf" },
      { label: "PMI Agile Practice Guide — tài liệu tham chiếu chính thức của PMI", url: "https://www.pmi.org/learning/library/coaching-agile-project-teams-navigate-conflict-6760" },
      { label: "iZenBridge — Facilitate Conflict Management (Domain Leadership Task 6)", url: "https://www.izenbridge.com/kb/pmi-acp-exam-content-outline/leadership-task6-facilitate-conflict-management/" },
      { label: "Deep Fried Brain Project — PMI-ACP Lessons Learned & Study Tips", url: "https://www.deepfriedbrainproject.com/2013/10/pmi-acp-exam-passed-lessons-learned-study-tips.html" },
    ],
  },
];
