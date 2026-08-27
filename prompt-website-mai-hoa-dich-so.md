# PROMPT: Xây dựng website "Gieo Quẻ & Luận Giải Mai Hoa Dịch Số" tích hợp AI

> **Ghi chú triển khai (đọc trước khi bắt đầu code):** Prompt này mô tả một hệ thống tương đối lớn (pipeline OCR tự động + thuật toán dịch lý + AI luận giải + UI cổ trang + widget thời gian thực). Để tránh làm dở dang nhiều thứ cùng lúc, hãy triển khai theo đúng thứ tự **Giai đoạn 1 → 2 → 3** ở cuối file, và chỉ chuyển giai đoạn khi giai đoạn trước đã chạy được, có thể demo. Nếu có phần nào không khả thi kỹ thuật hoặc tốn quá nhiều effort so với lợi ích, hãy dừng lại và trao đổi lại với tôi thay vì tự ý bỏ qua hoặc làm sơ sài.

## Bối cảnh & dữ liệu có sẵn
Nguồn tài liệu gốc là các file **PDF** (ví dụ bộ sách "Dịch Kinh Tường Giải" của Thu Giang Nguyễn Duy Cần, Quyển Thượng và Quyển Hạ), thay vì file Markdown chuẩn bị sẵn như trước.

**Phạm vi sử dụng:** đây là website nội bộ, chỉ dùng cá nhân/riêng tư, không public — nên không cần các ràng buộc về giới hạn hiển thị nội dung/bản quyền như với sản phẩm thương mại; có thể trích dẫn/hiển thị nguyên văn từ sách thoải mái để phục vụ tra cứu và đối chiếu. Vẫn nên có 1 lớp xác thực đơn giản (mật khẩu chung hoặc đăng nhập cơ bản) nếu deploy lên 1 domain/URL công khai truy cập được, để tránh người ngoài vô tình vào được trang.

**Yêu cầu quan trọng: hệ thống phải tự động hóa toàn bộ khâu nạp tài liệu** — người dùng (tôi) chỉ cần **bỏ bất kỳ file PDF nào vào 1 thư mục quy định** (ví dụ `data/pdf-input/`), hệ thống sẽ:
1. Tự động phát hiện file PDF mới được thêm vào thư mục (watch thư mục, hoặc quét lại mỗi khi khởi động/có trigger).
2. Tự động **chuyển đổi PDF sang Markdown** (giữ lại cấu trúc heading theo từng quẻ nếu nhận diện được, giữ đúng dấu tiếng Việt có dấu và chữ Hán nếu có trong PDF).
3. Lưu file Markdown đã convert vào 1 thư mục riêng (ví dụ `data/markdown-processed/`), đặt tên theo file PDF gốc.
4. Từ Markdown đó, chạy lại đúng pipeline parse ở mục B (bên dưới) để cập nhật `data/64-que.json` — hoặc nếu là tài liệu tham khảo không theo cấu trúc 64 quẻ (ví dụ tài liệu lý thuyết, ghi chú thêm), thì lưu riêng vào 1 kho ngữ liệu tham khảo mở rộng.
5. **AI dùng chính các file Markdown đã convert này làm tài liệu gốc** để trích dẫn/luận giải — không cần con người phải tự tay convert hay dán nội dung vào code mỗi khi có thêm tài liệu mới.

### Yêu cầu kỹ thuật cho khâu PDF → Markdown
- Dùng thư viện/công cụ chuyển đổi PDF sang Markdown có khả năng giữ được cấu trúc văn bản tốt (ưu tiên các công cụ xử lý tốt tiếng Việt có dấu và không làm vỡ định dạng — ví dụ các thư viện Python như `pymupdf4llm`, `marker-pdf`, hoặc dịch vụ OCR nếu PDF là dạng ảnh scan chứ không phải PDF có lớp text).
- **Cần phát hiện được PDF dạng scan (ảnh) và tự động chạy OCR tiếng Việt** (ví dụ Tesseract với gói ngôn ngữ `vie`) trước khi convert sang Markdown. **Lưu ý: OCR tiếng Việt cổ/Hán-Việt bằng Tesseract có tỷ lệ sai khá cao trong thực tế** — coder nên báo trước cho tôi mức độ chính xác thực tế sau khi test với vài trang mẫu, để tôi quyết định có cần tôi tự gõ tay 1 phần tài liệu gốc quan trọng hay không, thay vì mặc định OCR sẽ "chạy được".
- Sau khi convert, có bước **dò lại heading của từng quẻ** (dò các pattern như "31. TRẠCH SƠN HÀM", "Thoán từ", "Hào Sơ", v.v.) để tự động gắn heading Markdown (`###`, `######`) đúng cấp bậc — vì PDF chuyển thẳng qua thường mất định dạng heading, chỉ còn là văn bản thô.
- Xử lý các lỗi thường gặp khi convert: header/footer lặp lại mỗi trang (số trang, tên sách) cần được loại bỏ; các đoạn bị ngắt dòng giữa câu do xuống trang cần được nối lại; bảng biểu hoặc chú thích chân trang (như `<sup>[1]</sup>`) cần giữ lại đúng vị trí nếu có thể.
- Ghi log rõ ràng: file PDF nào đã xử lý, xử lý thành công/thất bại, có cần OCR không, để dễ debug khi kết quả convert bị sai.
- Cho phép **xem trước và chỉnh sửa thủ công** file Markdown đã convert (mở file `.md` sửa tay là đủ, không bắt buộc phải có giao diện admin riêng ở giai đoạn đầu) trước khi hệ thống dùng chính thức làm nguồn cho AI — vì OCR/convert tự động khó tránh sai sót 100%, đặc biệt với tài liệu Hán-Việt cổ.
- Toàn bộ pipeline này chạy 1 lần khi có file mới, không cần chạy lại mỗi lần người dùng cuối vào web bốc quẻ (kết quả convert được cache, chỉ tính lại khi phát hiện file PDF thay đổi/thêm mới — có thể dùng hash nội dung file để biết file đã đổi hay chưa).

Cấu trúc mỗi quẻ sau khi convert nên theo dạng Markdown heading như ví dụ:
```
### 31. TRẠCH SƠN HÀM 澤山咸
###### Thoán từ
###### Thoán Truyện
###### Đại Tượng
###### Tiểu Tượng
###### Sơ Lục: ... / Cửu Nhị: ... / Lục Tam: ... (luận giải từng hào)
```
(Lưu ý: heading level có thể lệch giữa các file tùy PDF gốc — cần code linh hoạt khi parse, không hard-code 1 level cố định. Cũng cần xử lý fallback bằng tên quẻ hoặc thứ tự xuất hiện nếu 1 quẻ nào đó bị thiếu số thứ tự sau khi convert.)

## Mục tiêu
Xây một **website (web app)** cho phép người dùng:
1. Nhập câu hỏi cần xem việc.
2. Gieo quẻ theo phương pháp **Mai Hoa Dịch Số** (Thiệu Khang Tiết), dùng quy tắc lấy số **1-2-3-5-7** (theo giờ/ngày/tháng/năm âm lịch hoặc theo số người dùng tự nhập) để lập Thể quái, Dụng quái, hào động, và quẻ biến.
3. Hiển thị quẻ gốc, quẻ biến, hào động một cách trực quan (hình quẻ bằng hào âm dương).
4. Tự động tra cứu đúng đoạn nội dung tương ứng (Thoán từ, Thoán Truyện, Đại Tượng, Tiểu Tượng, lời hào động) từ dữ liệu đã parse ở mục B.
5. Gọi AI (Claude API) để **luận giải sâu** dựa trên: (a) nội dung gốc tra được từ sách, (b) ngũ hành sinh khắc giữa Thể/Dụng theo Mai Hoa Dịch Số, (c) câu hỏi cụ thể của người dùng — để đưa ra lời giải sát với hoàn cảnh, không chỉ diễn nghĩa chung chung.

## Yêu cầu chi tiết

### A. Thuật toán an quẻ Mai Hoa Dịch Số (bắt buộc đúng chuẩn)

**A.1 Số lượng quẻ bốc mỗi lần (1, 2, 3, 5 hoặc 7 quẻ)**
- Người dùng tự chọn số lượng quẻ muốn bốc cùng lúc cho 1 câu hỏi: **1, 2, 3, 5, hoặc 7 quẻ**, tùy nhu cầu xem đơn giản hay phức tạp/nhiều khía cạnh.
- Mỗi quẻ trong số đó là **1 quẻ đầy đủ và độc lập**: có đủ quái Thượng + quái Hạ (64 quẻ), có hào động riêng, quẻ biến riêng, Thể/Dụng riêng — được an theo đúng thuật toán ở mục A.2 bên dưới, chạy độc lập cho từng lần bốc (mỗi quẻ dùng bộ số/thời điểm khác nhau, không dùng chung 1 kết quả).
- Khi bốc nhiều quẻ (2/3/5/7), giao diện cần đánh số thứ tự quẻ (Quẻ 1, Quẻ 2...) và cho phép:
  - Xem riêng từng quẻ với đầy đủ Thoán từ / hào động / Thể-Dụng như bốc 1 quẻ.
  - AI luận giải **tổng hợp cả bộ quẻ cùng lúc**, tìm ra mạch chung / diễn biến / các khía cạnh khác nhau mà bộ quẻ phản ánh cho cùng 1 câu hỏi (ví dụ: quẻ 1 nói về hiện tại, quẻ 2 nói về trở ngại, quẻ 3 nói về kết quả — hoặc đơn giản là nhiều lát cắt/góc nhìn khác nhau của cùng vấn đề), thay vì luận giải rời rạc từng quẻ không liên kết.
- Lưu ý: đây không phải cách phân vai quẻ cố định kiểu "quẻ định mệnh - quẻ chướng ngại..." trong 1 hệ thống bói khác — cần để AI tự nhận diện mối liên hệ giữa các quẻ dựa trên nội dung câu hỏi và nội dung từng quẻ tra được từ sách, không áp đặt khuôn mẫu cứng.

**A.2 Thuật toán an 1 quẻ (áp dụng cho từng quẻ trong bộ 1/2/3/5/7 quẻ nói trên)**
- Cho người dùng chọn 1 trong các cách lấy số để an quẻ (áp dụng riêng cho mỗi quẻ nếu bốc nhiều quẻ):
  - **Theo giờ ngày tháng năm (Ngày giờ báo số)**: dùng Năm + Tháng + Ngày (theo âm lịch, quy đổi Địa Chi) cộng dồn chia dư cho 8 ra quái Thượng; cộng thêm Giờ chia dư cho 8 ra quái Hạ; tổng tất cả (Năm+Tháng+Ngày+Giờ) chia dư cho 6 ra hào động.
    - *Cần chọn/triển khai 1 thư viện quy đổi dương lịch ↔ âm lịch Việt Nam đáng tin cậy (ví dụ `lunar-javascript`, hoặc thuật toán Hồ Ngọc Đức) — ghi rõ trong code đang dùng thư viện/nguồn thuật toán nào để dễ kiểm tra lại độ chính xác.*
  - **Theo số người dùng nhập tùy ý (Số báo)**: nhập 2 số (hoặc 1 số tách đôi) → số 1 chia dư 8 ra quái Thượng, số 2 chia dư 8 ra quái Hạ, tổng 2 số chia dư 6 ra hào động.
  - **Gieo ngẫu nhiên (bốc số ảo)**: hệ thống random số thay cho súc xắc/random theo thời gian thực (mili-giây) làm số linh động, đúng tinh thần "vật đến tức chiêm" của Mai Hoa Dịch Số. Khi bốc nhiều quẻ cùng lúc, mỗi quẻ phải lấy 1 mốc thời gian/số ngẫu nhiên riêng biệt (ví dụ cách nhau vài trăm mili-giây khi người dùng bấm bốc liên tiếp), không dùng trùng 1 số cho nhiều quẻ.
- Từ quái Thượng + quái Hạ (theo thứ tự Bát quái: 1 Càn, 2 Đoài, 3 Ly, 4 Chấn, 5 Tốn, 6 Khảm, 7 Cấn, 8 Khôn) ghép ra quẻ gốc (64 quẻ).
- Từ hào động, biến hào đó (âm↔dương) ra **quẻ biến**.
- Xác định **Thể quái** (quái chứa hào không động) và **Dụng quái** (quái chứa hào động); nếu hào động ở hào 4,5,6 (quái thượng) thì Thể là quái hạ, Dụng là quái thượng, và ngược lại; hào động ở hào 3 riêng thì theo quy tắc quái nào có hào động là Dụng.
- Tính **Hỗ quái** (lấy hào 2-3-4 làm hạ, hào 3-4-5 làm thượng) để tham khảo thêm cho luận đoán chi tiết.
- Áp dụng **Ngũ hành Bát quái** (Càn/Đoài=Kim, Ly=Hỏa, Chấn/Tốn=Mộc, Khảm=Thủy, Cấn/Khôn=Thổ) để tính sinh/khắc/tỷ hòa giữa Thể và Dụng → đây là yếu tố cốt lõi để đoán tốt/xấu trong Mai Hoa Dịch Số (Dụng khắc Thể là xấu, Thể sinh Dụng là hao tổn, Dụng sinh Thể là tốt, Thể khắc Dụng là chậm mà thành, Thể Dụng tỷ hòa là thuận).
- Tính thêm **vượng suy theo mùa (tứ thời vượng tướng)** nếu có thể (Xuân: Mộc vượng, Hỏa tướng...) để làm rõ mức độ tốt xấu.
- **Bắt buộc**: viết **unit test** cho toàn bộ thuật toán an quẻ (không chỉ "khuyến khích") — dùng ít nhất 5-10 ví dụ đối chiếu tay/đối chiếu với sách Mai Hoa Dịch Số đã xuất bản, để đảm bảo quy tắc chia dư 8, chia dư 6, xác định Thể/Dụng, và tính ngũ hành sinh khắc đều đúng trước khi nối vào phần AI luận giải. Sai ở bước này sẽ khiến toàn bộ AI luận giải phía sau vô nghĩa dù văn phong có hay đến đâu.

### B. Tra cứu và trích xuất nội dung từ tài liệu (đã qua bước PDF → Markdown ở trên)
- Viết một bước xử lý dữ liệu (build script) parse các file Markdown đã convert (trong `data/markdown-processed/`) thành cấu trúc JSON theo từng quẻ: `{ so_thu_tu, ten_que, thoan_tu, thoan_truyen, dai_tuong, tieu_tuong, hao: [{ten_hao, loi_hao, loi_tuong}], nguon_pdf }` để tra cứu nhanh, tránh phải load nguyên file Markdown mỗi lần. Trường `nguon_pdf` ghi lại file PDF gốc để truy vết khi cần đối chiếu.
- Xử lý các trường hợp lệch heading, tên quẻ không có số thứ tự, ký tự Hán tự đi kèm — dùng cả tên quẻ (ví dụ "LÔI HỎA PHONG") làm khóa dự phòng để khớp.
- Sau khi parse xong 64 quẻ, **in ra danh sách quẻ nào bị thiếu dữ liệu / parse lỗi** để tôi biết cần bổ sung hoặc sửa tay file Markdown nào — không để lỗi âm thầm (ví dụ 1 quẻ thiếu Hào từ mà không ai biết cho tới khi người dùng bốc trúng quẻ đó).
- Khi có kết quả quẻ gốc + quẻ biến + hào động, tự động lấy ra: Thoán từ + Đại Tượng của quẻ gốc, lời hào của hào động, và Thoán từ của quẻ biến (nếu có) để làm ngữ liệu cho AI luận giải.
- Nếu người dùng thêm PDF mới vào thư mục sau này (bổ sung tài liệu tham khảo khác ngoài 64 quẻ, ví dụ sách khác về Mai Hoa Dịch Số), pipeline convert PDF→Markdown ở trên vẫn chạy, nhưng script parse này cần phân biệt được: tài liệu nào là bộ 64 quẻ chính (đưa vào `64-que.json`) và tài liệu nào là ngữ liệu tham khảo mở rộng (đưa vào 1 kho riêng, ví dụ `data/tai-lieu-tham-khao/`, để AI có thể dùng làm ngữ cảnh bổ sung khi luận giải mà không làm rối cấu trúc chính).

### C. Tích hợp AI luận giải
- Sau khi có đủ: câu hỏi người dùng + **toàn bộ danh sách các quẻ đã bốc** (1 đến 7 quẻ, mỗi quẻ gồm quẻ gốc/biến/hào động/Thể-Dụng-ngũ hành) + đoạn trích nguyên văn từ tài liệu (đã convert từ PDF) cho từng quẻ + (nếu có liên quan) đoạn trích từ kho ngữ liệu tham khảo mở rộng (`data/tai-lieu-tham-khao/`), gọi Claude API qua endpoint `/v1/messages` với một system prompt chuyên biệt yêu cầu AI:
  1. Diễn giải ý nghĩa từng quẻ theo đúng cách hiểu Hình nhi thượng học của Nguyễn Duy Cần (không suy diễn tùy tiện, phải bám sát đoạn trích được cung cấp cho quẻ đó).
  2. Kết hợp phân tích Thể/Dụng, ngũ hành sinh khắc, hào động của từng quẻ để đưa ra nhận định tốt/xấu/chờ thời cho quẻ đó.
  3. **Nếu bốc từ 2 quẻ trở lên**: tổng hợp và tìm mạch liên kết giữa các quẻ — quẻ nào phản ánh khía cạnh/giai đoạn/góc nhìn nào của câu hỏi, có mâu thuẫn hay bổ trợ nhau không, quẻ nào nên coi trọng hơn (dựa trên độ rõ ràng sinh khắc Thể-Dụng) — rồi đưa ra kết luận chung thống nhất, không liệt kê rời rạc từng quẻ.
  4. Áp dụng trực tiếp vào **bối cảnh câu hỏi cụ thể của người dùng** (ví dụ hỏi về công việc, tình duyên, sức khỏe, tài chính...) — không trả lời chung chung mà phải cho lời khuyên/luận đoán thiết thực, có thời điểm nếu suy luận được (ứng theo Thể/Dụng, theo hào vị).
  5. Nêu rõ đây là công cụ tham khảo triết lý/dịch lý, không phải cam kết chắc chắn — giữ giọng điềm đạm, không mê tín hóa.
  6. Trả lời có cấu trúc: (a) Từng quẻ và ý nghĩa tổng quát + Thể-Dụng-hào động (rút gọn nếu nhiều quẻ), (b) Mạch liên kết giữa các quẻ (nếu >1 quẻ), (c) Luận giải riêng cho câu hỏi, (d) Lời khuyên hành động.
- Cho phép người dùng hỏi tiếp (chat follow-up) để AI luận giải sâu hơn dựa trên ngữ cảnh (các) quẻ đã gieo, giữ lịch sử hội thoại trong phiên.
- **Model:** dùng tên model Claude hiện đang có sẵn qua API tại thời điểm code (kiểm tra lại `docs.claude.com` để lấy đúng model string mới nhất — không hard-code cứng 1 tên model trong nhiều chỗ, để trong 1 biến cấu hình/env var duy nhất, vì Anthropic thỉnh thoảng ra model mới và đổi tên).
- **API key** của Claude chỉ được giữ ở backend (env var, không commit vào repo, có file `.env.example` mẫu không chứa giá trị thật). Toàn bộ gọi AI phải đi qua backend, client không bao giờ thấy API key.
- Cần xử lý: timeout khi gọi AI, lỗi rate-limit/API trả lỗi (hiển thị thông báo thân thiện cho người dùng, không văng lỗi kỹ thuật ra UI), và giới hạn độ dài ngữ liệu gửi lên (nếu bốc 7 quẻ + nhiều trích dẫn có thể vượt context — cần rút gọn/tóm tắt hợp lý phần trích dẫn dài trước khi đưa vào prompt).

### D. Giao diện / trải nghiệm người dùng
- Trang chủ: ô nhập câu hỏi + chọn **số lượng quẻ muốn bốc (1/2/3/5/7)** + chọn phương pháp lấy số cho mỗi quẻ (giờ ngày tháng năm / nhập số / ngẫu nhiên).
- Sau khi gieo: hiển thị dạng thẻ (card) cho từng quẻ theo thứ tự — **phía trên mỗi thẻ là hình ảnh trực quan của quẻ** (vẽ bằng SVG, không dùng ảnh raster để đảm bảo sắc nét mọi kích thước màn hình): 6 vạch hào xếp từ dưới lên trên (đúng thứ tự Sơ, Nhị, Tam, Tứ, Ngũ, Thượng), vạch dương vẽ 1 đường liền dài, vạch âm vẽ 2 đường liền ngắn cách khoảng giữa; hào động tô màu nhấn (ví dụ đỏ/vàng đồng) kèm ký hiệu vòng tròn nhỏ hoặc dấu "○"/"×" theo quy ước dương động/âm động truyền thống. Hiển thị quẻ gốc và quẻ biến cạnh nhau (có mũi tên hoặc ký hiệu "biến thành" ở giữa), kèm tên quẻ bằng chữ Việt + Hán tự phía trên hoặc dưới mỗi hình quẻ, và badge Thể/Dụng kèm ngũ hành đặt cạnh hình quẻ tương ứng.
- Nếu bốc nhiều quẻ, cho phép cuộn ngang/xếp lưới để xem tổng quan tất cả các quẻ cùng lúc trước khi đọc phần luận giải AI.
- Khu vực "Luận giải AI" hiện kết quả luận giải tổng hợp theo cấu trúc ở mục C, có thể mở rộng xem "trích dẫn gốc từ sách" cho từng quẻ để đối chiếu.
- Hiển thị trạng thái loading rõ ràng khi đang gọi AI (việc luận giải có thể mất vài giây), và thông báo lỗi thân thiện nếu AI gọi thất bại (kèm nút thử lại).

### D.1 Thẻ minh họa quẻ (illustrated card — phong cách như ảnh tham khảo)
Ngoài hình SVG hào âm dương (chính xác về mặt kỹ thuật), mỗi quẻ còn hiển thị dưới dạng **một thẻ minh họa (card) đẹp, giàu cảm xúc** — giống phong cách thẻ bài cổ trang Á Đông, gồm các thành phần:
- **Khung viền cổ điển** màu đỏ trầm/vàng đồng, họa tiết hoa văn góc thẻ, biểu tượng Âm Dương (Thái Cực) nhỏ ở góc trên trái.
- **2 dòng nhãn ở góc trên**: bên trái là **từ khóa bản chất quẻ** (ví dụ "KHỐN LONG ĐẮC THỦY" — rút từ tên/ý nghĩa quẻ gốc), bên phải là **nhãn về vận/thời** (ví dụ "THỜI VẬN ĐÃ ĐẾN") — cả 2 do AI/hệ thống sinh ra ngắn gọn dựa trên nội dung Thoán từ + phân tích Thể-Dụng của quẻ đó.
- **Nhãn đánh giá tổng quát ở giữa trên cùng** dạng khung viền nhỏ nổi bật (ví dụ "Đại Cát" / "Cát" / "Bình" / "Hung" / "Đại Hung") — suy ra từ mức độ sinh/khắc giữa Thể và Dụng (Dụng sinh Thể + vượng = Đại Cát; Thể khắc Dụng = Cát vừa; Dụng khắc Thể = Hung...).
- **Tranh minh họa trung tâm** thể hiện hình ảnh biểu tượng của quẻ (núi non, mây trời, cung điện, sông nước, rồng, gió, sấm sét... tùy theo 2 quái Thượng/Hạ hợp thành, ví dụ Càn=trời/rồng, Khôn=đất, Khảm=nước/hiểm, Ly=lửa/sáng, Chấn=sấm, Tốn=gió, Cấn=núi, Đoài=đầm/hồ). Ở giai đoạn đầu, dùng **SVG minh họa đơn giản, nhất quán phong cách, vẽ sẵn cho 8 quái đơn rồi kết hợp** (dễ làm, không phụ thuộc dịch vụ ngoài); việc tích hợp AI sinh ảnh cho từng quẻ là hạng mục nâng cao, chỉ làm sau khi phần lõi đã ổn và tôi xác nhận muốn đầu tư thêm chi phí gọi API tạo ảnh.
- **Badge số thứ tự quẻ** (1–64) góc trên phải, dạng cuộn thư nhỏ.
- **2 dòng chữ dọc 2 bên viền tranh**: mô tả ngắn tính chất/đức tính của quẻ (ví dụ "Chính yếu, cứng mạnh, khô, lớn, khỏe mạnh" và "Mạnh mẽ, dẻo dai, bền bỉ, nghiêm chỉnh, tròn đầy") — rút từ Thoán Truyện/Đại Tượng.
- **Tên quẻ lớn** trong khung băng đối xứng phía dưới tranh (chữ Việt, có thể kèm phiên âm Hán-Việt hoặc chữ Hán nhỏ đi kèm).
- **Hộp văn bản luận giải ngắn** (3–5 câu) ở cuối thẻ, nền giấy cổ (be/vàng nhạt), nội dung do AI tóm tắt cô đọng từ luận giải đầy đủ — văn phong súc tích, có tính khuyên răn/chiêm nghiệm.
- Thẻ này dùng làm **ảnh đại diện/trang bìa cho mỗi quẻ** khi hiển thị trong danh sách nhiều quẻ (bốc 2/3/5/7 quẻ), có thể bấm vào để mở rộng xem đầy đủ Thoán từ/hào động/luận giải AI chi tiết bên dưới. Cũng dùng thẻ này cho quẻ ở widget thời gian thực (mục D.2) khi mở panel chi tiết.
- Cho phép người dùng **tải thẻ về dạng ảnh** (export PNG, dùng thư viện như `html-to-image` hoặc canvas) để lưu/chia sẻ.

### D.2 Widget "Quẻ theo thời gian thực" (góc phải màn hình)
- Hiển thị 1 widget nhỏ cố định (fixed) ở **góc phải màn hình** (desktop: góc phải trên hoặc dưới tùy bố cục; mobile: có thể thu gọn thành nút tròn nổi) — đây là **quẻ tính theo thời gian thực, múi giờ UTC+7 (giờ Việt Nam)**.
- Cách tính: dùng thời điểm hiện tại (giờ, phút theo UTC+7) làm số báo tương tự phương pháp "Ngày giờ báo số" ở mục A.2 — ví dụ dùng (giờ × 60 + phút) hoặc kết hợp Năm-Tháng-Ngày-Giờ-Phút hiện tại theo quy tắc chia dư 8 ra quái Thượng/Hạ và chia dư 6 ra hào động; cần chốt rõ công thức cụ thể trong lúc code (có thể dùng giờ+phút hiện tại làm số Hạ quái/hào động, còn ngày-tháng-năm âm lịch làm số Thượng quái, miễn nhất quán và có thể kiểm chứng lại bằng tay).
- **Tự động tính lại mỗi khi sang phút mới** (theo đồng hồ UTC+7) — dùng `setInterval` kiểm tra định kỳ vài giây 1 lần là đủ (không cần kiểm tra mỗi giây, tránh tốn tài nguyên client không cần thiết), phát hiện khi phút thay đổi thì tính lại quẻ mới — quẻ ở góc phải sẽ tự "lật" sang quẻ mới kèm hiệu ứng chuyển động nhẹ (animation lật quẻ) để trực quan giống "quẻ đang sống theo thời gian".
- Widget mặc định hiển thị dạng thu gọn: hình quẻ SVG nhỏ (6 vạch hào) + giờ:phút hiện tại (UTC+7) bên dưới.
- **Khi người dùng bấm vào widget**: mở ra hộp thoại/panel chi tiết hiển thị đầy đủ như 1 quẻ bốc bình thường — hình quẻ gốc/biến cỡ lớn, tên quẻ, Thể/Dụng/ngũ hành, hào động, và có nút "Luận giải AI" để gọi AI phân tích quẻ thời khắc hiện tại này (không gắn với câu hỏi cụ thể nào — có thể để người dùng nhập nhanh 1 câu hỏi ngay trong panel này nếu muốn, hoặc AI mặc định luận giải theo hướng "khí vận/điềm ứng của thời khắc hiện tại" nếu người dùng không nhập câu hỏi).
- Lưu ý kỹ thuật: quẻ thời gian thực này là tính năng độc lập, không tính vào số lượng quẻ bốc theo yêu cầu (1/2/3/5/7) của người dùng ở mục A.1 — không lưu lịch sử liên tục (vì đổi mỗi phút sẽ rất nhiều bản ghi), chỉ lưu lại khi người dùng chủ động bấm "lưu quẻ này" trong panel chi tiết.
- Thiết kế theo phong cách nhã, cổ điển Á Đông nhưng hiện đại (không sến, không màu mè rối mắt) — có thể dùng tông màu trầm (đen/vàng đồng/đỏ trầm/be), font chữ có nét thư pháp nhẹ ở tiêu đề, còn phần nội dung dùng font dễ đọc.
- Responsive cho mobile.

### E. Kỹ thuật đề xuất
- Frontend: React (hoặc Next.js) + Tailwind.
- Backend nhẹ (Node/Express hoặc serverless function) để giữ an toàn khi gọi Claude API (không lộ API key ở client), phục vụ file JSON đã parse, và chạy pipeline PDF→Markdown ở phần "Bối cảnh & dữ liệu có sẵn".
- Pipeline chuyển đổi PDF→Markdown nên viết bằng Python (dễ dùng các thư viện xử lý PDF/OCR mạnh như `pymupdf4llm`, `marker-pdf`, `pytesseract`), chạy như 1 script/service riêng theo dõi thư mục `data/pdf-input/` (dùng `watchdog` hoặc cron job đơn giản), độc lập với backend chính (backend chính chỉ đọc kết quả JSON/Markdown đã xử lý xong).
- Bước tiền xử lý dữ liệu (parse Markdown → JSON theo mục B) chạy tự động ngay sau khi 1 file Markdown mới được tạo ra từ bước convert.
- Có thể cache lịch sử các quẻ đã gieo (localStorage hoặc DB nhẹ như SQLite) để người dùng xem lại.
- Có file `README.md` hướng dẫn: cách chạy local, cách thêm PDF mới, biến môi trường cần thiết, cách chạy lại pipeline thủ công nếu cần.

## Giai đoạn triển khai đề xuất

**Giai đoạn 1 — Lõi chạy được (ưu tiên cao nhất):**
- Tôi tự convert/gõ tay 1 bộ Markdown mẫu đầy đủ 64 quẻ trước (không cần chờ pipeline OCR tự động).
- Script parse Markdown → `64-que.json` (mục B).
- Thuật toán an quẻ đầy đủ 3 cách lấy số, hỗ trợ bốc 1/2/3/5/7 quẻ (mục A), có unit test.
- API gọi Claude luận giải (mục C).
- Giao diện cơ bản: nhập câu hỏi, hiển thị quẻ bằng SVG hào âm dương, hiển thị kết quả luận giải AI (mục D, chưa cần thẻ minh họa đẹp ở D.1).
→ Mục tiêu: có 1 sản phẩm dùng được thật, đúng thuật toán, luận giải AI chất lượng.

**Giai đoạn 2 — Tự động hóa dữ liệu:**
- Pipeline PDF → Markdown tự động, có OCR tiếng Việt cho bản scan (phần "Bối cảnh & dữ liệu có sẵn").
- Phân biệt tài liệu chính (64 quẻ) và tài liệu tham khảo mở rộng.

**Giai đoạn 3 — Trải nghiệm nâng cao:**
- Thẻ minh họa quẻ (D.1) kèm tính năng tải ảnh.
- Widget "Quẻ theo thời gian thực" (D.2).
- (Tùy chọn, cần xác nhận thêm) tích hợp AI sinh ảnh minh họa cho từng quẻ.

## Việc cần làm ngay
1. Bắt đầu **Giai đoạn 1**: script parse Markdown → `data/64-que.json` (mục B) — dùng bộ Markdown mẫu tôi cung cấp trước.
2. Cài thuật toán an quẻ Mai Hoa Dịch Số đầy đủ 3 cách lấy số ở mục A.2, và cơ chế bốc nhiều quẻ độc lập (1/2/3/5/7) ở mục A.1, kèm unit test đối chiếu tay.
3. Xây API luận giải AI theo mục C (giữ API key an toàn ở backend).
4. Xây giao diện cơ bản theo mục D (chưa cần D.1/D.2).
5. Sau khi Giai đoạn 1 chạy ổn và tôi xác nhận, mới chuyển sang Giai đoạn 2 (pipeline PDF→Markdown tự động, mục "Bối cảnh & dữ liệu có sẵn") rồi Giai đoạn 3 (D.1 thẻ minh họa, D.2 widget thời gian thực).
6. Nếu phát hiện thêm dữ kiện hữu ích nào trong tài liệu PDF (ví dụ phần "Luật tuần hoàn theo quẻ Thủy Trạch Tiết", phần bàn về mộng mị, tiên tri) mà có thể làm phong phú thêm phần luận giải AI, hãy đề xuất tích hợp thêm và giải thích vì sao — nhưng đưa vào backlog Giai đoạn 2/3, không chèn ngang vào Giai đoạn 1.
