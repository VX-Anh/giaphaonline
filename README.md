# Gia Phả Online

Website số hóa và quản lý gia phả dòng họ Việt Nam. Kế hoạch đầy đủ: [docs/ke-hoach-xay-dung-gia-pha-online.md](docs/ke-hoach-xay-dung-gia-pha-online.md).

## Cấu trúc

```
apps/api   NestJS + PostgreSQL (PGlite khi dev)   – REST API tại http://localhost:4000/api
apps/web   Next.js + Tailwind                       – giao diện tại http://localhost:3000
docs/      kế hoạch dự án
```

## Chạy dev

Yêu cầu: Node.js ≥ 20. Không cần cài PostgreSQL khi dev — API dùng PGlite (PostgreSQL chạy nhúng), dữ liệu lưu ở `apps/api/data/pglite`.

```bash
npm install
npm run dev:api        # terminal 1
npm run dev:web        # terminal 2
node apps/api/scripts/seed-demo.mjs   # (tùy chọn) tạo dòng họ mẫu, tài khoản ghi trong file script
```

Biến môi trường API:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `DATABASE_URL` | (trống → PGlite file) | `postgres://…` để dùng PostgreSQL thật; `memory://` cho test |
| `JWT_SECRET` | secret dev | **Bắt buộc** khi `NODE_ENV=production` |
| `PORT` | 4000 | |
| `WEB_ORIGIN` | http://localhost:3000 | CORS, nhiều giá trị cách nhau bằng dấu phẩy |

Web: `NEXT_PUBLIC_API_URL` (mặc định `http://localhost:4000/api`).

## Test

```bash
npm test     # unit (âm lịch, policy riêng tư) + e2e API trên PGlite in-memory
```

## Đã triển khai (lát cắt Nền tảng + Sprint 1 trong mục 9 kế hoạch)

- Đăng ký/đăng nhập (Argon2id, JWT).
- Dòng họ, vai trò (chủ sở hữu, đồng quản trị, biên tập viên, thành viên, người xem); ngữ cảnh tenant luôn lấy từ quyền trong CSDL, không phải thành viên → 404.
- Người: nhiều tên (kèm Hán Nôm), đời thứ, thứ tự con, trạng thái sống/mất/chưa rõ, khuyết danh, ngày linh hoạt âm/dương (tháng nhuận, thiếu ngày/năm, khoảng) có ngày dương lịch dẫn xuất.
- Quan hệ cha mẹ – con có hướng (đẻ/nuôi/thừa tự), hôn phối riêng; khóa ngoại ghép `(family_id, id)` chặn tham chiếu chéo dòng họ; chống chu trình tổ tiên dưới khóa tuần tự hóa theo dòng họ; tối đa 2 cha mẹ đẻ.
- Policy riêng tư một chỗ (`apps/api/src/persons/policy.ts`): người còn sống/chưa rõ bị che với người xem; người "chưa xác minh căn cứ" chỉ người nhập và ban quản lý thấy; không lộ qua tìm kiếm/cây.
- Khóa lạc quan (version) khi sửa; lịch sử thay đổi theo giao dịch và hoàn tác, không bao giờ làm sống lại dữ liệu trong `erasure_registry`.
- Cây hậu duệ kèm phối ngẫu, xem dạng danh sách thụt lề thu gọn được (bàn phím, trình đọc màn hình).
- Lịch giỗ âm lịch (thuật toán Hồ Ngọc Đức), tháng nhuận → tháng thường, ngày 30 tháng thiếu → ngày 29.
- Bản đồ dòng họ (Leaflet + OpenStreetMap, lớp ảnh vệ tinh Esri): mộ phần, mộ cải táng, mộ gió, nơi sinh, nơi ở, nhà thờ họ, nguyên quán; lọc theo loại/đời; ghim bằng cách bấm lên bản đồ hoặc GPS; link "Chỉ đường" mở Google Maps. Người còn sống/chưa rõ: chỉ được gắn nơi sinh/nơi ở, tọa độ làm tròn ~10 km ngay khi lưu, không có ghi chú, khách không thấy; người chưa xác minh căn cứ không lên bản đồ.

## Chưa làm / khác kế hoạch (cần làm tiếp)

- Chưa có: chi/phái & biên tập nhánh, trích dẫn nguồn, tư liệu/upload, căn cứ đồng ý nhiều bên (`legal_bases`, `consent_parties`), luồng yêu cầu dữ liệu, nhập/xuất Excel, xuất PDF/SVG, email nhắc giỗ, MFA, refresh token, thanh toán.
- Ngày sinh/mất đang lưu dạng JSONB trên `persons` thay vì bảng `person_dates`; quy tắc giỗ dùng mặc định chung thay vì `commemorations` theo từng người.
- Chưa bật PostgreSQL RLS (lớp phòng thủ thứ hai, mục 5.6).
- Token lưu ở `localStorage`; production nên chuyển sang cookie httpOnly.
- Test chống chu trình đồng thời chạy trên PGlite (một kết nối) nên chưa chứng minh được hành vi nhiều kết nối; cần chạy lại trên PostgreSQL thật.
- Tìm kiếm không dấu đang lọc phía ứng dụng; với họ lớn cần `unaccent` + `pg_trgm`.
