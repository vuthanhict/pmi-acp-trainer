# Đặc tả chức năng: Tracking quá trình luyện tập & Đánh giá độ sẵn sàng thi PMI-ACP

Vai trò biên soạn: Senior BA + Senior UI/UX Designer
Phạm vi: bổ sung module **Progress / Tracking** vào PMI-ACP Daily Trainer (`src/App.jsx`)
Trạng thái: đề xuất để chốt trước khi implement

---

## 1. Hiện trạng — cái gì đã có, cái gì đang thiếu

### 1.1 Dữ liệu đã có (rất tốt, gần như không cần backfill)

App đã lưu đủ nguyên liệu thô cho toàn bộ tính năng tracking:

| Nguồn | Trường quan trọng | Dùng được cho |
|---|---|---|
| `progress.attempts[]` | `answeredAt`, `isCorrect`, `gradeStatus`, `eligibleForGap`, `confidence`, `responseTimeMs`, `changedAnswer`, `supportUsage.assisted`, `questionId`, `quizIndex`, `sessionId`, `mode` | Đếm câu/ngày, streak, độ chính xác theo lần, tốc độ, calibration |
| `progress.completedQuizzes[]` | `quizIndex`, `sessionId`, `completedAt`, `rawScore`, `trustedScore`, `independentScore` | So sánh **Lần 1 / Lần 2 / Lần n** theo từng bộ đề |
| `progress.gapSnapshots[]` | `profile` (toàn bộ mastery theo task/domain tại thời điểm nộp bài) | Đường xu hướng mastery theo thời gian |
| `calculateGapProfile()` | `domains[].mastery`, `tasks[].mastery/evidence/status/diagnoses` | Điểm sẵn sàng có trọng số domain |

**Kết luận BA quan trọng:** mọi chỉ số đề xuất bên dưới đều **tính suy ra được (derived)** từ dữ liệu đang có. Người dùng bật tính năng lên là thấy ngay lịch sử cũ của mình — không có màn hình rỗng, không cần migration rủi ro.

### 1.2 Khoảng trống so với yêu cầu

| Yêu cầu người dùng | Hiện trạng | Khoảng trống |
|---|---|---|
| Đặt mục tiêu mỗi ngày 10/20/…/50 câu hoặc trọn 1 bộ đề | Không có khái niệm "mục tiêu" hay "ngày" | Thiếu hoàn toàn: goal setting, đếm tiến độ trong ngày, streak |
| Lần 1 đúng bao %, lần 2 %, lần n % | `HistoryScreen` liệt kê phẳng theo thời gian, không nhóm theo bộ đề, không so sánh | Thiếu view "1 bộ đề → nhiều lần làm → delta" |
| Nhìn nhận trực quan | Chỉ có 4 vòng tròn mastery ở Today + thanh % ở History | Thiếu biểu đồ theo thời gian, thiếu heatmap thói quen, thiếu so sánh |
| Đánh giá khả năng, **sự chắc chắn**, tỉ lệ thành công kỳ thi thật | `gapProfile` có mastery + status theo task | Thiếu một chỉ số tổng hợp cấp kỳ thi + biên độ tin cậy + điều kiện đủ dữ liệu |
| Bổ trợ Fill-GAP | `FillGapScreen` chọn task thủ công, size cố định | Thiếu liên kết: mục tiêu ngày → tự sinh phiên Fill-GAP đúng size |

### 1.3 Rủi ro nghiệp vụ cần xử lý ngay trong thiết kế

> ⚠️ **Lạm phát điểm do làm lại (score inflation).** Khi người dùng làm bộ đề lần 2, lần 3, % tăng lên phần lớn là **nhớ đáp án**, không phải năng lực. Nếu đưa con số này vào "tỉ lệ thành công kỳ thi thật" thì chỉ số sẽ nói dối theo hướng nguy hiểm nhất: khiến người học tự tin đi thi khi chưa sẵn sàng.

Vì vậy toàn bộ thiết kế bên dưới **tách đôi** hai loại số liệu và không bao giờ trộn:

- **First-exposure accuracy** — chỉ tính lượt làm **đầu tiên** của mỗi `questionId` → dùng cho *dự báo kỳ thi thật*.
- **Repeat accuracy (Lần 1…n)** — dùng cho *đo tốc độ tiến bộ và khả năng ghi nhớ*, hiển thị riêng, có nhãn cảnh báo.

Tương tự, `supportUsage.assisted` (mở bản dịch/thuật ngữ trước khi trả lời) phải bị loại khỏi dự báo — app đã có sẵn `independentScore`, ta tận dụng.

---

## 2. Mục tiêu & User stories

### 2.1 Mục tiêu sản phẩm

1. **Tạo nhịp học đều** — biến việc ôn thi thành thói quen đo được hằng ngày.
2. **Cho thấy tiến bộ** — người học nhìn thấy đường đi lên, không chỉ điểm số rời rạc.
3. **Trả lời một câu hỏi duy nhất:** *"Tôi đi thi bây giờ thì đỗ không, và tôi có chắc về câu trả lời đó tới đâu?"*
4. **Biến chẩn đoán thành hành động** — mọi điểm yếu đều có nút bấm dẫn thẳng sang phiên Fill-GAP tương ứng.

### 2.2 User stories (định dạng đề xuất cho backlog)

| ID | Story | Ưu tiên |
|---|---|---|
| US-01 | Là người học, tôi muốn đặt mục tiêu mỗi ngày (10/20/30/50 câu hoặc trọn 1 bộ đề) để có cam kết rõ ràng | P0 |
| US-02 | Là người học, tôi muốn thấy tiến độ hôm nay (x/20 câu) ngay trên màn Today để biết còn phải làm bao nhiêu | P0 |
| US-03 | Là người học, tôi muốn thấy chuỗi ngày học liên tiếp (streak) và lịch heatmap để duy trì động lực | P1 |
| US-04 | Là người học, tôi muốn xem một bộ đề đã làm mấy lần, mỗi lần đúng bao nhiêu %, và chênh lệch giữa các lần | P0 |
| US-05 | Là người học, tôi muốn biết % của mình là "thật" hay do nhớ đáp án | P0 |
| US-06 | Là người học, tôi muốn một Điểm Sẵn Sàng tổng hợp kèm biên độ tin cậy và điều kiện để tin được nó | P0 |
| US-07 | Là người học, tôi muốn thấy xu hướng mastery theo thời gian cho từng domain | P1 |
| US-08 | Là người học, tôi muốn từ mỗi điểm yếu bấm một nút là vào ngay phiên luyện đúng chủ đề đó, đúng số câu mục tiêu | P0 |
| US-09 | Là người học, tôi muốn được cảnh báo khi kiến thức một domain đang bị "quên dần" do lâu không đụng tới | P2 |
| US-10 | Là người học, tôi muốn đặt ngày thi dự kiến để hệ thống tính nhịp câu/ngày cần thiết | P2 |

---

## 3. Mô hình dữ liệu bổ sung

Nguyên tắc: **chỉ thêm, không sửa, không xoá** (`schemaVersion: 2 → 3`), để `mergeProgressData()` và bản backup Google Drive cũ vẫn tương thích.

```js
// defaultProgress() — bổ sung
goals: {
  daily: {
    type: "questions",        // "questions" | "quizset"
    target: 20,               // 10 | 20 | 30 | 50 | custom; bỏ qua nếu type = "quizset"
    countAssisted: false,     // câu có dùng trợ giúp có tính vào mục tiêu không
    restDays: [0],            // 0=CN — ngày nghỉ không phá streak
    startedAt: "2026-08-10",
  },
  exam: {
    targetDate: null,         // ISO date, cho US-10
    readinessTarget: 0.78,    // ngưỡng tự đặt
  },
},
streak: {                     // cache, luôn có thể tính lại từ attempts
  current: 0, longest: 0, lastActiveDate: null, freezesLeft: 2,
},
```

**Không tạo thêm event log.** Nhật ký hằng ngày (`dailyLog`) được **tính lại từ `attempts[].answeredAt`** mỗi lần render, gom nhóm theo ngày ở timezone `learner.timezone` (`Asia/Ho_Chi_Minh`). Lý do: tránh hai nguồn sự thật lệch nhau, và giữ nguyên tính đúng đắn của lịch sử đã có.

**Việc dọn dẹp cần làm kèm:** `gapSnapshots` đang được append vô hạn mỗi lần nộp bài, mỗi snapshot chứa toàn bộ danh sách task. Trước khi dựng biểu đồ xu hướng dựa trên nó, nên nén xuống dạng gọn (chỉ giữ `{ at, domains: {mastery}, overall }`) và giới hạn ~200 bản ghi gần nhất, nếu không dung lượng IndexedDB/backup Drive sẽ phình nhanh.

---

## 4. Từ điển chỉ số (Metric dictionary)

Đây là phần cốt lõi để con số có thể bảo vệ được, không phải "cảm giác".

### 4.1 Tiến độ ngày & streak

```
questionsToday   = |{ a ∈ attempts : localDate(a.answeredAt) = today
                                   ∧ a.gradeStatus = "graded"
                                   ∧ (countAssisted ∨ ¬a.supportUsage.assisted) }|
goalMet(day)     = questionsToday ≥ target                     (type = "questions")
                 | ∃ c ∈ completedQuizzes : localDate(c.completedAt) = day   (type = "quizset")
streak.current   = số ngày liên tiếp lùi từ hôm nay thoả goalMet, bỏ qua restDays
```

Quy tắc UX: ngày hôm nay **chưa** tính là đứt chuỗi cho đến hết ngày. Streak chỉ gãy khi đã qua một ngày không đạt mục tiêu và không phải ngày nghỉ.

### 4.2 So sánh Lần 1 → Lần n (yêu cầu trung tâm của người dùng)

Với mỗi `quizIndex`, lấy các `completedQuizzes` cùng `quizIndex`, sắp theo `completedAt`, đánh số `attemptNo = 1..n`:

| Chỉ số hiển thị mỗi lần | Công thức | Ý nghĩa |
|---|---|---|
| `rawPercent` | đã có sẵn `rawScore.percent` | Điểm thô |
| `independentPercent` | đã có sẵn `independentScore.percent` | Điểm khi **không** dùng trợ giúp — con số đáng tin |
| `delta` | `percent(n) − percent(n−1)` | Mức tiến bộ |
| `newlyCorrect` | số câu **sai ở lần trước, đúng ở lần này** | Sửa được lỗ hổng thật |
| `regressed` | số câu **đúng lần trước, sai lần này** | Cảnh báo: chưa vững, hoặc đoán mò lần trước |
| `stillWrong` | sai ở cả hai lần | Đây chính là danh sách nạp thẳng vào Fill-GAP |
| `avgTime` | trung vị `responseTimeMs` | Tiến bộ về tốc độ |

`newlyCorrect / regressed / stillWrong` tính bằng cách join `attempts` của hai `sessionId` theo `questionId` — dữ liệu đã đủ, không cần thêm gì.

> Nhãn bắt buộc trên mọi lần ≥ 2: *"Lần làm lại — % này bị ảnh hưởng bởi trí nhớ đáp án, không dùng để dự báo kỳ thi."*

### 4.3 Điểm Sẵn Sàng (Readiness Score) — trả lời "tôi đỗ không"

Chỉ tính trên tập **sạch**: `gradeStatus = "graded"` ∧ `eligibleForGap` ∧ `¬supportUsage.assisted` ∧ **lượt đầu tiên** của mỗi `questionId`.

```
R_core     = Σ_domain ( examWeight_d × mastery_d )        // đã có trong calculateGapProfile
             (Mindset .28, Leadership .25, Product .19, Delivery .28)
Coverage   = Σ_domain ( examWeight_d × min(1, distinctQuestions_d / 60) )
Trend      = kẹp trong [−1,1] của (mastery 30 ngày gần nhất − mastery 30 ngày trước đó)
Consistency= tỉ lệ ngày đạt mục tiêu trong 14 ngày gần nhất
Calibration= 1 − |P(confidence) − accuracy thực tế|       // đã có CONFIDENCE_PROBABILITY

Readiness  = 100 × clamp( 0.60·R_core + 0.15·Coverage + 0.10·Trend⁺ + 0.08·Calibration + 0.07·Consistency )
```

**Biên độ tin cậy (phần "sự chắc chắn" người dùng hỏi)** — dùng sai số chuẩn nhị thức trên số câu first-exposure độc lập `n`:

```
margin = 1.96 × √( p(1−p) / n )        // p = tỉ lệ đúng first-exposure
Hiển thị: "Sẵn sàng 71% (khoảng tin cậy 64–78%, dựa trên 142 câu lần-đầu)"
```

Cách này khiến chỉ số **tự thú nhận khi nó chưa đáng tin**: làm 30 câu thì khoảng tin cậy rộng ~±18 điểm, người dùng thấy ngay là chưa kết luận được gì.

**Cổng chặn (gating) — không hiển thị Readiness khi chưa đủ bằng chứng:**

| Điều kiện | Hiển thị |
|---|---|
| < 100 câu first-exposure độc lập | "Chưa đủ dữ liệu — cần thêm ~N câu" + thanh tiến độ tới ngưỡng |
| Có domain < 20 câu | Hiện điểm nhưng gắn cờ "thiếu dữ liệu ở domain X" |
| Dữ liệu gần nhất > 21 ngày | "Số liệu đã cũ — làm 1 phiên 20 câu để làm mới" |

**Diễn giải sang ngôn ngữ người dùng** (PMI không công bố cut score chính thức, nên phải nói bằng mức tự tin, không hứa hẹn):

| Readiness | Nhãn | Thông điệp |
|---|---|---|
| ≥ 80 và cận dưới KTC ≥ 75 | 🟢 Sẵn sàng | Đủ điều kiện đăng ký thi |
| 70–79 | 🟡 Gần sẵn sàng | Còn ~X ngày theo nhịp hiện tại |
| 60–69 | 🟠 Cần luyện thêm | Tập trung 3 task yếu nhất |
| < 60 | 🔴 Chưa sẵn sàng | Ưu tiên học lại nội dung, chưa nên cày đề |

### 4.4 Cảnh báo quên (US-09)

Tận dụng `recencyWeight` đã có: nếu một domain có `mastery ≥ 0.7` nhưng không có attempt nào trong 21 ngày → gắn nhãn "đang phai" và đẩy lên đầu gợi ý Fill-GAP.

---

## 5. Thiết kế UX

### 5.1 Thay đổi kiến trúc thông tin

`NAV_ITEMS` hiện có 7 mục (Today, Library, History, Gap, Glossary, Vocab, Data) — trên mobile là 7 tab, đã chật. Đề xuất:

- **Thêm** `progress` (icon `chart`) — nhà của toàn bộ tracking.
- **Gộp** `history` vào `progress` dưới dạng tab con ("Dòng thời gian"), vì History hiện chỉ là danh sách phẳng.
- Giữ nguyên số tab = 7. Không tăng gánh nặng điều hướng.

```
Today · Library · Progress · Gap · Glossary · Vocab · Data
                    └── tab con: Tổng quan | Theo bộ đề | Dòng thời gian
```

Phân vai rõ ràng để tránh chồng lấn với màn Gap đang có:
- **Progress** = *Tôi đã đi được bao xa?* (thời gian, thói quen, xu hướng, độ sẵn sàng)
- **Gap** = *Tôi yếu chỗ nào?* (chẩn đoán theo task)
- **Fill-GAP** = *Làm gì tiếp theo?* (hành động)

### 5.2 Màn Today — bổ sung khối "Mục tiêu hôm nay" (P0)

Đặt **trên cùng**, trước cả 4 vòng domain: khi mở app, câu hỏi đầu tiên trong đầu người học là "hôm nay tôi phải làm gì", không phải "mastery của tôi là bao nhiêu".

```
┌──────────────────────────────────────────────┐
│ MỤC TIÊU HÔM NAY              🔥 12 ngày     │
│                                              │
│      ◕  14 / 20 câu           còn 6 câu      │
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░  70%                  │
│                                              │
│  [ Làm tiếp 6 câu ]  [ Đổi mục tiêu ]        │
└──────────────────────────────────────────────┘
```

- Nút chính **"Làm tiếp 6 câu"** sinh thẳng một phiên Fill-GAP đúng 6 câu, chọn theo `gapProfile.tasks` ưu tiên cao nhất → đây là mắt xích nối Tracking ↔ Fill-GAP mà yêu cầu đặt ra.
- Khi đạt mục tiêu: đổi thành trạng thái hoàn thành + gợi ý "làm thêm 10 câu" (không ép, không phạt).
- Vòng tròn tiến độ dùng lại component `DomainRing` (SVG stroke-dasharray) — chi phí implement thấp.

**Sheet đặt mục tiêu** (mở từ "Đổi mục tiêu"):

```
Mỗi ngày tôi muốn làm:
  ( ) 10 câu — nhẹ nhàng, ~15 phút
  (•) 20 câu — đều đặn, ~30 phút          ← mặc định
  ( ) 30 câu — nghiêm túc, ~45 phút
  ( ) 50 câu — cường độ cao, ~75 phút
  ( ) Trọn 1 bộ đề
  [ ] Tính cả câu có dùng trợ giúp (dịch/thuật ngữ)
  Ngày nghỉ: [CN ▾]        Ngày thi dự kiến: [__/__/____]
```

Ước lượng thời gian lấy từ trung vị `responseTimeMs` thật của chính người dùng (mặc định 90s khi chưa có dữ liệu) — cá nhân hoá, tăng độ tin cậy của cam kết.

### 5.3 Màn Progress — tab "Tổng quan" (P0)

```
┌──────────────────────────────────────────────────────┐
│ ĐỘ SẴN SÀNG THI PMI-ACP                              │
│                                                      │
│              71%   🟡 Gần sẵn sàng                   │
│      ├────────[64 ▓▓▓▓▓▓▓ 78]────────┤               │
│      0        60      70      80     100             │
│   Dựa trên 142 câu lần-đầu, không dùng trợ giúp      │
│   Cập nhật 2 ngày trước                              │
│                                                      │
│   ▸ Vì sao là 71%?                                   │
└──────────────────────────────────────────────────────┘
```

Thanh ngang có **dải khoảng tin cậy** (không phải một con số cứng) là lựa chọn thiết kế cố ý: nó truyền tải "sự chắc chắn" bằng hình ảnh, không cần người dùng đọc số.

Panel "Vì sao là 71%?" bung ra bảng đóng góp từng thành phần — minh bạch hoá công thức, tránh cảm giác hộp đen:

```
  Năng lực theo domain  ·············· 43.2 / 60
  Độ phủ ngân hàng đề   ·············· 11.0 / 15
  Xu hướng 30 ngày      ·············· +6.8 / 10
  Độ chuẩn tự đánh giá  ·············· 6.4 / 8
  Đều đặn 14 ngày       ·············· 3.5 / 7
```

Bên dưới, hai khối tiếp theo:

**Xu hướng độ chính xác (line chart, 8 tuần)** — ba đường phân biệt rõ:
- Đường đậm: **first-exposure** (sự thật)
- Đường nhạt: **tất cả lượt làm** (bị lạm phát bởi làm lại)
- Đường đứt: ngưỡng mục tiêu 78%

**Nhịp học (heatmap 12 tuần, kiểu GitHub)** — ô đậm nhạt theo số câu/ngày, viền ô cho ngày đạt mục tiêu. Chạm vào ô → tooltip "23/08: 24 câu · 79% · 38 phút".

**Mastery theo domain (bar chart ngang, kèm mũi tên delta 30 ngày)** — dùng lại `gapSnapshots` đã nén.

### 5.4 Màn Progress — tab "Theo bộ đề" (P0, đáp trực tiếp yêu cầu "lần 1, lần 2, lần n")

Danh sách bộ đề đã làm, mỗi bộ là một hàng có thể mở rộng:

```
┌──────────────────────────────────────────────────────┐
│ PMI-ACP SUPER 1 · 214 câu              3 lần làm  ▾  │
│                                                      │
│  Lần 1  12/07   ▓▓▓▓▓▓░░░░  58%                      │
│  Lần 2  26/07   ▓▓▓▓▓▓▓▓░░  71%   ▲ +13              │
│  Lần 3  09/08   ▓▓▓▓▓▓▓▓▓░  84%   ▲ +13              │
│                                                      │
│  ⚠ Lần 2–3 có yếu tố nhớ đáp án. Điểm lần-đầu: 58%   │
│                                                      │
│  Lần 2 → Lần 3:                                      │
│    ✅ Sửa được 31 câu    ❌ Tụt 4 câu   ⛔ Sai cả 3 lần: 18 │
│                                                      │
│  [ Luyện 18 câu sai dai dẳng ]   [ Xem chi tiết ]    │
└──────────────────────────────────────────────────────┘
```

Ba con số **Sửa được / Tụt / Sai dai dẳng** là giá trị lớn nhất của view này — chúng biến "% tăng" thành thông tin hành động được. Nút "Luyện 18 câu sai dai dẳng" nạp thẳng danh sách `questionId` vào `startFillGapSession()` (hàm đã tồn tại, nhận sẵn mảng ids).

Mini-chart sparkline cạnh tên bộ đề cho phép quét nhanh bộ nào đang lên, bộ nào chững.

### 5.5 Nguyên tắc trực quan hoá

Giữ đúng ngôn ngữ thiết kế "phiếu báo danh / thẻ chứng chỉ" đã có (`DESIGN_CSS`, IBM Plex, palette seal/sage/flag/sky):

| Nội dung | Dạng biểu đồ | Lý do |
|---|---|---|
| Tiến độ ngày | Vòng tròn | Một giá trị so với một mục tiêu |
| Xu hướng độ chính xác | Đường, nhiều series | So sánh diễn biến theo thời gian |
| Thói quen học | Heatmap lịch | Mật độ theo ngày, thấy được chỗ đứt quãng |
| Mastery theo domain | Bar ngang + delta | So sánh hạng mục, nhãn dài dễ đọc |
| Lần 1..n của một bộ đề | Bar dọc nhỏ + delta | Chuỗi rời rạc, ít điểm |
| Độ sẵn sàng | Thanh có dải KTC | Truyền tải cả giá trị lẫn độ bất định |

Kỹ thuật: vẽ bằng **SVG thuần** như `DomainRing` hiện tại. Không thêm thư viện chart — dự án đang không có dependency chart, và các dạng trên đều dưới 60 dòng SVG mỗi loại.

Màu bám semantic tokens sẵn có: `--sage` (tốt), `--seal` (cảnh báo), `--flag` (yếu), `--sky` (trung tính/thông tin). Không mã hoá thông tin **chỉ** bằng màu — luôn kèm nhãn/biểu tượng (yêu cầu tiếp cận, và app đã tuân thủ điều này ở `StatusChip`).

---

## 6. Liên kết với Fill-GAP

Mọi màn tracking đều kết thúc bằng một nút hành động, không để người dùng ở trạng thái "biết rồi thì sao":

| Nơi phát hiện | Nút | Hành vi |
|---|---|---|
| Mục tiêu hôm nay còn thiếu 6 câu | "Làm tiếp 6 câu" | `startFillGapSession(topGapIds, 6)` |
| Domain đang "phai" | "Làm mới Delivery — 10 câu" | Lọc pool theo domain |
| Bộ đề có 18 câu sai dai dẳng | "Luyện 18 câu sai dai dẳng" | Nạp trực tiếp mảng id |
| Readiness thiếu dữ liệu ở 1 domain | "Bổ sung 20 câu Product" | Ưu tiên câu chưa từng gặp |

Đề xuất thêm cho `FillGapScreen`: preset size khớp với mục tiêu ngày (10/20/30/50) thay vì mặc định cứng 10, và tuỳ chọn "chỉ câu chưa từng gặp" — trực tiếp cải thiện chất lượng số liệu first-exposure.

---

## 7. Phân kỳ triển khai

**Giai đoạn 1 — Nhịp học (P0, ~1 tuần)**
`goals` trong schema v3 · khối Mục tiêu hôm nay ở Today · sheet đặt mục tiêu · streak · liên kết "Làm tiếp N câu" sang Fill-GAP.
→ Giá trị đến sớm nhất, rủi ro kỹ thuật gần bằng 0.

**Giai đoạn 2 — So sánh lần làm (P0, ~1 tuần)**
Màn Progress + tab "Theo bộ đề" · logic newlyCorrect/regressed/stillWrong · nhãn cảnh báo lạm phát điểm · gộp History thành tab con.

**Giai đoạn 3 — Độ sẵn sàng (P0/P1, ~1.5 tuần)**
Tách first-exposure · công thức Readiness + khoảng tin cậy + cổng chặn dữ liệu · panel "Vì sao?" · nén `gapSnapshots` · biểu đồ xu hướng.

**Giai đoạn 4 — Nâng cao (P2)**
Heatmap 12 tuần · cảnh báo quên · ngày thi dự kiến và nhịp câu/ngày cần thiết · xuất báo cáo tiến độ.

### Tiêu chí nghiệm thu mẫu (US-04)

- [ ] Bộ đề làm ≥ 2 lần hiển thị đủ n dòng, sắp theo thời gian tăng dần, có `attemptNo`.
- [ ] Mỗi dòng ≥ 2 hiển thị delta so với dòng liền trước, đúng dấu, làm tròn 1 chữ số.
- [ ] Ba con số sửa được / tụt / sai dai dẳng khớp chính xác với join theo `questionId` giữa hai session.
- [ ] Nhãn cảnh báo lạm phát điểm luôn xuất hiện với mọi lần ≥ 2.
- [ ] Nút "Luyện câu sai dai dẳng" khởi tạo phiên có đúng bộ `questionId` đó.
- [ ] Dữ liệu lịch sử **có sẵn từ trước** hiển thị đúng, không cần người dùng làm gì thêm.

---

## 8. Rủi ro & tình huống biên

| Rủi ro | Xử lý |
|---|---|
| Người dùng làm lại đề rồi tưởng mình giỏi lên | Tách first-exposure, nhãn cảnh báo, Readiness không dùng lượt lặp |
| Streak gãy → mất động lực, bỏ app | Ngày nghỉ cấu hình được + 2 "freeze"; ngôn từ hồi phục ("Bắt đầu chuỗi mới") thay vì trách móc |
| Mục tiêu 50 câu/ngày quá sức → bỏ cuộc | Ước lượng thời gian thật của chính người dùng; gợi ý hạ mục tiêu khi 3 ngày liên tiếp không đạt |
| Readiness hiển thị khi mới làm 20 câu | Cổng chặn < 100 câu first-exposure |
| Múi giờ / đổi thiết bị làm lệch ranh giới ngày | Luôn gom nhóm theo `learner.timezone`, không theo giờ máy |
| `gapSnapshots` phình dung lượng | Nén schema + giới hạn 200 bản ghi (làm trước Giai đoạn 3) |
| Người dùng hiểu Readiness là lời hứa đỗ | Ngôn từ: "mức độ sẵn sàng", "khoảng tin cậy" — không bao giờ dùng "xác suất đỗ"; kèm chú thích PMI không công bố cut score |
| Bộ đề bị làm dở, thoát giữa chừng | Chỉ tính vào mục tiêu ngày các attempt đã `graded`; phiên dở không tạo `completedQuizzes` |

---

## 9. Cần chốt trước khi code

1. **Streak** — có làm ở Giai đoạn 1 không, hay để P2? (ảnh hưởng phạm vi tuần đầu)
2. **Gộp History vào Progress** — đồng ý, hay giữ History là tab riêng và chấp nhận 8 tab?
3. **Ngưỡng mục tiêu Readiness** — mặc định 78% có phù hợp với kỳ vọng của bạn không?
4. **Ngày thi dự kiến** — có đưa lên P0 để tính ngược nhịp câu/ngày không?
