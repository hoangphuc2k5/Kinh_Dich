# Mai Hoa Dịch Số

Ứng dụng Giai đoạn 1: an quẻ Mai Hoa Dịch Số, hiển thị quẻ gốc/quẻ biến và gọi DeepSeek ở backend để luận giải tổng hợp.

## Chạy local

```bash
npm install
npm run setup:python   # tạo .venv và cài pymupdf (chỉ cần 1 lần / máy mới)
npm run dev
```

Để website, backend DeepSeek và watcher PDF cùng chạy trong một cửa sổ:

```bash
npm run dev:all
```

Lệnh trên tự kiểm tra `.venv` trong project; nếu thiếu hoặc hỏng sẽ tạo lại và cài `requirements.txt`. Mang project sang máy khác chỉ cần `npm install` rồi `npm run dev:all` — không cần cài pymupdf toàn hệ thống.

Sau đó chỉ cần thả PDF vào `Data_Sach`. Watcher đợi file copy xong, dùng SHA-256 để bỏ qua file đã xử lý, và chỉ tạo lại Markdown khi nội dung PDF thay đổi. Ghi đè Python bằng biến `PYTHON_EXECUTABLE` nếu cần dùng interpreter khác.

Để bật AI, sao chép `.env.example` thành `.env`, điền `DEEPSEEK_API_KEY`, rồi chạy thêm `npm run server` ở terminal thứ hai. Model được cấu hình qua `DEEPSEEK_MODEL` (mặc định `deepseek-chat`), endpoint qua `DEEPSEEK_BASE_URL`.

## Tự động nạp PDF

Chạy `npm run setup:python` (hoặc để `dev:all` / `pipeline:pdf` tự chạy). Trên Windows cần cài **Python 3.10+** và Tesseract OCR riêng (gói ngôn ngữ `vie` trong `tessdata`). Chạy `npm run pipeline:pdf` để xử lý PDF mới/thay đổi; dùng `npm run pipeline:watch` để theo dõi `Data_Sach` liên tục. PDF có lớp text sẽ dùng `pymupdf4llm`; PDF scan sẽ dùng Tesseract `vie+eng`. Kết quả OCR cần được đọc rà lại trước khi làm nguồn AI.

## Dữ liệu sách

PDF gốc được giữ nguyên trong `Data_Sach`, ảnh trong `Data_Photo`. Pipeline ghi cache hash tại `data/.pdf-state.json`, tạo Markdown trong `data/markdown-processed/`, rồi chạy parser. Khi có Markdown đã kiểm duyệt, có thể chạy riêng `npm run parse:markdown`; script sẽ xuất `data/64-que.json`, `data/tai-lieu-tham-khao.json` và cảnh báo quẻ thiếu dữ liệu. Không nên dùng bản OCR chưa rà soát làm nguồn luận giải chính.

## Kiểm tra

`npm test` chạy unit test lõi an quẻ. `npm run build` kiểm tra TypeScript và bundle frontend.