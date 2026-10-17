# KẾ HOẠCH XÂY DỰNG WEBSITE GIA PHẢ ONLINE

> Phiên bản: 2.1 · Ngày cập nhật: 17/10/2026 · Trạng thái: Bản nháp (đã sửa theo review lần 2)

### Lịch sử thay đổi
| Phiên bản | Ngày | Nội dung |
|---|---|---|
| 1.0 | 17/10/2026 | Bản nháp đầu tiên |
| 2.0 | 17/10/2026 | Sửa theo review: cập nhật căn cứ pháp lý (Luật BVDLCN 2025), thêm mục Pháp lý & dữ liệu cá nhân, thiết kế lại mô hình dữ liệu (quan hệ có hướng, hôn phối, thế thứ, ngày âm lịch, quyền riêng tư, cô lập tenant), thêm ma trận phân quyền, thu hẹp MVP, ước lượng lại tiến độ, bổ sung sao lưu/RPO-RTO, tiêu chí phát hành, mô hình kinh doanh có quota |
| 2.1 | 17/10/2026 | Sửa theo review lần 2: mốc pháp lý theo đợt dữ liệu thật, vai trò pháp lý theo luồng xử lý, trạng thái "chưa xác minh căn cứ", vai trò không vượt policy riêng tư, tách 2 loại xuất dữ liệu, hoàn tác tôn trọng yêu cầu xóa, bỏ `child_of_union`, tuần tự hóa sửa đồ thị, che tư liệu ảnh/PDF, điểm phục hồi nhất quán CSDL–file, đồng ý nhiều bên, đặc tả ngày, trích dẫn theo từng dữ kiện, ngân sách công theo FE/BE, SLA tách DR, vòng đời dữ liệu sau hết gói, ranh giới OCR/AI |

---

## 1. Tổng quan dự án

### 1.1. Bối cảnh
Gia phả là tài liệu quan trọng của mỗi dòng họ Việt Nam, ghi lại nguồn gốc, thế thứ, công đức tổ tiên và quan hệ huyết thống. Phần lớn gia phả vẫn ở dạng giấy (Hán Nôm hoặc Quốc ngữ), dễ thất lạc, khó cập nhật, khó chia sẻ cho con cháu ở xa.

### 1.2. Mục tiêu
- Số hóa gia phả: lưu trữ, cập nhật, tra cứu trực tuyến, **có nguồn chứng cứ và lịch sử thay đổi**.
- Trực quan hóa cây phả hệ nhiều đời.
- Kết nối thành viên: nhắc giỗ, sự kiện dòng họ.
- Bảo tồn tư liệu lâu dài: ảnh, bản scan gia phả gốc, lịch sử dòng họ — **có sao lưu và khả năng phục hồi toàn bộ**.
- Phù hợp đặc thù Việt Nam: âm lịch (kể cả tháng nhuận), ngày giỗ, đời/chi/phái, trưởng/thứ, nhiều hôn phối, con nuôi, nhận họ.
- **Tuân thủ pháp luật bảo vệ dữ liệu cá nhân ngay từ thiết kế (privacy by design).**

### 1.3. Đối tượng người dùng
| Nhóm | Mô tả | Nhu cầu chính |
|---|---|---|
| Ban quản lý họ (trưởng họ, đồng quản trị) | Chịu trách nhiệm gia phả | Tạo, quản lý, phân quyền, duyệt, chuyển giao quyền |
| Người chép phả / biên tập viên | Người nhập liệu, hiệu đính | Nhập hàng loạt, ghi nguồn, đối chiếu bản gốc |
| Thành viên dòng họ (nội & ngoại, cả nữ giới, con dâu, con rể) | Con cháu | Xem cây, tra cứu, đề xuất sửa nhánh mình, nhận nhắc giỗ |
| Khách | Người được mời/xem link công khai | Xem phần được chia sẻ |
| Quản trị hệ thống / hỗ trợ | Đội vận hành | Quản lý tài khoản, gói dịch vụ; truy cập dữ liệu họ chỉ khi được cấp phép và có ghi nhật ký |

### 1.4. Phạm vi
- **Trong phạm vi v1.0:** Web app responsive, nhiều dòng họ (multi-tenant), hồ sơ người & quan hệ, cây phả hệ, lịch giỗ âm lịch + email, tư liệu cơ bản, quyền riêng tư & quản lý đồng ý, lịch sử thay đổi & khôi phục, nhập/xuất Excel theo mẫu, xuất cây PDF/SVG.
- **Hoãn sang giai đoạn sau:** gợi ý xưng hô tự động, sách gia phả PDF, GEDCOM đầy đủ, SMS/Zalo, quỹ họ, bản đồ mộ, hợp nhất cây, app mobile.
- **Ngoài phạm vi toàn roadmap hiện tại:** OCR/nhận dạng chữ Hán Nôm tự động, ADN, mạng xã hội mở. (AI hỗ trợ nhập liệu ở giai đoạn sau chỉ áp dụng cho tài liệu chữ Quốc ngữ in/đánh máy; Hán Nôm vẫn nhập thủ công hoặc qua dịch vụ số hóa.)

---

## 2. Yêu cầu chức năng

### 2.1. Nhóm chức năng MVP (v1.0)
1. **Tài khoản & xác thực**
   - Đăng ký/đăng nhập bằng email + mật khẩu và Google (OTP SMS, Zalo: giai đoạn 2).
   - Vòng đời phiên: refresh token xoay vòng, thu hồi phiên, đăng xuất mọi thiết bị.
   - Khôi phục tài khoản an toàn; **bắt buộc MFA** cho chủ sở hữu/đồng quản trị/quản trị hệ thống.
   - Giới hạn tần suất đăng nhập, gửi email, lời mời.
2. **Quản lý dòng họ**
   - Tạo dòng họ: tên họ, nguyên quán, thủy tổ, mô tả, ảnh nhà thờ họ.
   - **Nhiều đồng quản trị**; chuyển giao quyền sở hữu; khôi phục quyền có xác minh khi chủ sở hữu mất liên lạc/qua đời.
   - Lời mời có hạn dùng, có thể thu hồi; vai trò theo ma trận quyền (mục 6).
3. **Hồ sơ người trong gia phả**
   - **Nhiều tên**: tên khai sinh, tên húy, tự, hiệu, thụy, tên gọi khác, tên theo thời kỳ; lưu được nguyên văn Hán Nôm (Unicode) và phiên âm.
   - Giới tính, **thế thứ (đời) ghi theo gia phả**, thứ tự trong anh chị em (cho phép "không rõ", sinh đôi), vai trò trưởng nam/trưởng chi.
   - Ngày sinh/mất theo cấu trúc ngày linh hoạt (mục 5.3): âm/dương, tháng nhuận, chỉ năm, khoảng, ước lượng, nguyên văn.
   - Trạng thái sống: **còn sống / đã mất / chưa rõ** (chưa rõ được bảo vệ như còn sống).
   - Nơi sinh, nơi an táng (cải táng, mộ gió), nghề nghiệp, học vị, tiểu sử, chân dung.
   - Hỗ trợ người khuyết danh/thất truyền (chỉ biết vị trí trong phả).
   - **Trích dẫn nguồn theo từng dữ kiện** (tên, ngày, quan hệ, thế thứ...): một dữ kiện có thể có nhiều nguồn, kể cả nguồn mâu thuẫn; trạng thái dữ kiện: đã xác nhận / chưa xác nhận / đang tranh chấp.
4. **Quan hệ**
   - Cha/mẹ – con có hướng, loại: đẻ / nuôi / thừa tự (nối tự) / chưa xác định.
   - Hôn phối riêng: thứ tự (chính thất, kế thất, thứ thất...), thời gian, trạng thái (đang, ly hôn, góa); tái hôn.
   - **Nguồn sự thật duy nhất:** quan hệ cha mẹ–con chỉ lưu ở cạnh cha mẹ–con; "con chung / con riêng của cuộc hôn phối nào" được **suy ra** từ cặp cha mẹ của con và bảng hôn phối, không lưu bảng liên kết riêng.
   - Cho phép cha/mẹ chưa rõ danh tính (người khuyết danh làm nút cha/mẹ).
   - Ràng buộc: không tự liên kết, không trùng cạnh, **không chu trình tổ tiên**; cảnh báo niên đại bất hợp lý (con sinh trước cha mẹ, chênh tuổi bất thường).
   - Mọi thao tác sửa đồ thị (thêm/xóa cạnh, nhập lô, hoàn tác) được **tuần tự hóa theo dòng họ** để kiểm tra chu trình luôn đúng khi nhiều người sửa đồng thời (mục 5.1).
5. **Cây phả hệ**
   - Một kiểu cây chính (dọc), thu gọn/mở rộng nhánh, zoom/pan, tìm và nhảy tới người; tải dần theo nhánh.
   - Chế độ xem: toàn họ, theo chi, tổ tiên của một người, hậu duệ của một người.
   - Thêm/sửa trên cây (thêm con, hôn phối, cha mẹ) theo quyền.
   - **Cách xem thay thế dạng danh sách/thụt lề** cho người cao tuổi, điện thoại nhỏ, trình đọc màn hình; thao tác bàn phím; nhãn chữ ngoài màu sắc.
6. **Tìm kiếm & tra cứu quan hệ**
   - Tìm theo tên (không dấu, mọi loại tên), đời, chi, năm sinh, quê quán — **chỉ trả về kết quả người xem có quyền thấy**.
   - Tra cứu quan hệ giữa 2 người dạng **giải thích được** (vd: "con của anh trai mẹ"), hiển thị đường đi trên cây. (Gợi ý cách xưng hô: giai đoạn 2, sau khi có bộ tình huống chuẩn do người am hiểu gia phả nghiệm thu.)
7. **Lịch giỗ & sự kiện**
   - Quy tắc giỗ tách khỏi ngày mất: ngày giỗ âm lịch, xử lý tháng nhuận, ngày 30 khi tháng thiếu, **ngày cúng thực tế** do họ cấu hình; hỗ trợ giỗ khi không biết năm mất.
   - Nhắc giỗ qua email và thông báo web.
   - Sự kiện dòng họ: họp họ, tảo mộ, khánh thành nhà thờ...
8. **Tư liệu**
   - Ảnh, PDF, bản scan gia phả gốc, gắn với người/sự kiện/nguồn chứng cứ.
   - Giới hạn dung lượng & định dạng, quét mã độc, xóa metadata vị trí ảnh, storage riêng tư + link ký có hạn.
   - **Tư liệu gốc mặc định chỉ ban quản lý/biên tập viên xem.** Muốn chia sẻ rộng hơn (toàn họ hoặc công khai) phải qua bước duyệt; nếu ảnh/scan chứa thông tin người được bảo vệ, biên tập viên tạo **bản che** (che thủ công trên công cụ trong app) và chỉ bản che được chia sẻ. Hệ thống không tự nhận diện tên trong ảnh/scan.
   - Trang giới thiệu: lịch sử dòng họ, tộc ước, câu đối, hoành phi (rich text đã làm sạch).
9. **Lịch sử thay đổi & khôi phục**
   - Mọi thay đổi ghi theo **giao dịch** (một thao tác có thể sửa nhiều người/quan hệ), ai sửa, khi nào, nguồn.
   - Chống ghi đè đồng thời bằng phiên bản bản ghi (optimistic locking).
   - Hoàn tác giao dịch có kiểm tra lại: ràng buộc đồ thị, **quyền hiện tại** của người hoàn tác (mục 6), policy riêng tư hiện tại, các thay đổi phát sinh sau giao dịch gốc (xung đột → yêu cầu xử lý thủ công).
   - **Hoàn tác và mọi đường phục hồi khác (nhập lại, khôi phục backup) không bao giờ phục hồi dữ liệu đã bị xóa/hạn chế theo yêu cầu của chủ thể dữ liệu** — kiểm tra với danh sách xóa (`erasure_registry`). Khi thực hiện yêu cầu xóa, nội dung tương ứng trong lịch sử thay đổi được làm sạch, chỉ giữ bằng chứng tối thiểu (ai yêu cầu, khi nào, đã xử lý) theo thời hạn pháp chế quy định.
   - Quy trình duyệt đầy đủ ở giai đoạn 2; trong v1.0, quyền sửa giới hạn cho biên tập viên được chỉ định, thành viên thường chỉ **đề xuất** qua form đơn giản.
10. **Quyền riêng tư & dữ liệu cá nhân** (chi tiết mục 4)
    - Ghi nhận căn cứ xử lý/đồng ý cho người còn sống, kể cả nhiều bên cùng đồng ý (trẻ em và người đại diện) và người không có tài khoản.
    - Người còn sống/chưa rõ được nhập hộ ở trạng thái **"chưa xác minh căn cứ"** cho đến khi có bằng chứng (mục 4.2).
    - Người trong gia phả (hoặc người đại diện) yêu cầu xem, sửa, ẩn, xóa, rút đồng ý.
    - Phân quyền hiển thị theo trường và theo đối tượng xem; áp dụng nhất quán cho API, tìm kiếm, cây, xuất file, trang công khai, cache.
11. **Nhập/xuất & chia sẻ**
    - Nhập Excel theo mẫu: **xem trước, báo lỗi theo dòng, phát hiện trùng, mã định danh ngoài để nhập lại không nhân đôi, nhập theo lô và hoàn tác cả lô**.
    - Xuất Excel; xuất cây ra PDF/SVG (vector) với giới hạn số người/khổ giấy đã chốt (mục 2.3).
    - Hai loại xuất dữ liệu, đặc tả và ghi nhật ký riêng:
      - **Xuất nghiệp vụ** (Excel, cây): luôn lọc theo quyền và policy riêng tư của người xuất.
      - **Bản chuyển giao toàn bộ** (JSON + tư liệu) để họ mang dữ liệu đi: chỉ chủ sở hữu, MFA, có lý do, tự động thông báo cho đồng quản trị; vẫn loại trừ dữ liệu đã bị xóa/hạn chế và người "chưa xác minh căn cứ" chưa được phép chuyển; link tải hết hạn sau 24 giờ.
    - Link chia sẻ công khai có hạn, có thể thu hồi; người còn sống/chưa rõ bị ẩn mặc định.

### 2.2. Giai đoạn 2 trở đi
- Quy trình duyệt thay đổi đầy đủ, so sánh phiên bản.
- Gợi ý cách xưng hô (nội/ngoại, vai vế, vùng miền) khi đủ dữ kiện.
- Sách gia phả PDF theo mẫu truyền thống (mục lục, đánh số, font Hán Nôm) — hạng mục riêng có nghiệm thu riêng.
- GEDCOM 7 nhập/xuất (công bố bảng ánh xạ & trường không bảo toàn).
- OTP SMS, Zalo OA/ZNS nhắc giỗ.
- Quỹ họ, bản đồ mộ phần/phân bố con cháu, bảng tin.
- Hợp nhất 2 cây, phát hiện trùng nâng cao; liên kết người xuyên dòng họ (cần đồng ý và chính sách đồng bộ).
- Giao diện song ngữ Việt/Anh, hiển thị song song Hán Nôm.
- App mobile; AI hỗ trợ nhập liệu từ ảnh tài liệu chữ Quốc ngữ (không bao gồm Hán Nôm — xem 1.4).

### 2.3. Đặc tả cần chốt trong giai đoạn Thiết kế
- **Thế thứ:** mốc tổ (đời 1) của họ/chi, quy tắc tính cho con nuôi, thừa tự, phối ngẫu (phối ngẫu không mang thế thứ của họ), cho phép ghi đè theo gia phả gốc.
- **Chi/phái:** người thuộc chi theo người gốc chi + dòng hậu duệ; xử lý con gái, phối ngẫu, người thuộc nhiều đường; đổi gốc chi là thao tác đặc quyền.
- **Xuất cây:** khổ giấy hỗ trợ (A3, A1, A0), số người tối đa mỗi tờ, cách chia tờ và nối nhánh. Tiêu chí đọc được khi in thật: tên ≥ 8pt, năm sinh–mất ≥ 6pt, đường nối nét ≥ 0,5pt; vượt ngưỡng thì bắt buộc chia tờ.
- **Tập dữ liệu Excel mẫu** và quy tắc ánh xạ.

---

## 3. Yêu cầu phi chức năng

| Tiêu chí | Yêu cầu |
|---|---|
| Hiệu năng | p95 API < 500ms; trang đầu < 2,5s trên 4G/thiết bị tầm trung; mở nhánh 500 người < 1s |
| Quy mô | **Pilot:** 50 họ, 50.000 người tổng. **Năm 1:** 2.000 họ, 2 triệu người, 200 người dùng đồng thời. **Giới hạn mỗi họ:** 20.000 người (benchmark 50.000 trước khi nâng). Mục tiêu dài hạn xem xét lại theo số liệu thực |
| Bảo mật | HTTPS, Argon2id, MFA cho tài khoản đặc quyền, OWASP ASVS L2, cô lập tenant nhiều lớp (mục 5.6) |
| Dữ liệu cá nhân | Tuân thủ Luật Bảo vệ dữ liệu cá nhân 2025 và văn bản hướng dẫn (mục 4) |
| Sao lưu | **RPO CSDL ≤ 15 phút** (WAL/PITR); **RPO file ≤ 15 phút** (sao chép liên tục sang bucket tách biệt); **RPO nghiệp vụ toàn hệ thống ≤ 15 phút**. File lưu theo **khóa bất biến** (mỗi lần tải lên/sửa tạo khóa mới, không ghi đè), CSDL chỉ tham chiếu khóa bất biến ⇒ phục hồi CSDL về thời điểm T luôn trỏ đúng file. Sau phục hồi chạy **kiểm tra toàn vẹn** (mọi khóa file trong CSDL tồn tại, checksum khớp manifest). Bản sao ở tài khoản/khu vực tách biệt, chế độ bất biến; lưu 30 bản hằng ngày + 12 bản hằng tháng; diễn tập phục hồi toàn hệ thống mỗi quý |
| Khôi phục thảm họa (DR) | **RTO ≤ 8 giờ** cho sự cố mất toàn bộ môi trường. DR là mục tiêu riêng, **không tính vào SLA uptime** |
| Sẵn sàng (SLA) | Uptime ≥ 99,5% **đo theo tháng dương lịch** cho ứng dụng web + API (≈ 3,6 giờ ngừng/tháng); loại trừ bảo trì có báo trước ≥ 48 giờ (tối đa 4 giờ/tháng, ngoài 22h–6h) và sự kiện DR đã công bố |
| Khả dụng | WCAG 2.1 AA; chữ phóng 200% không vỡ; thao tác bàn phím; kiểm thử với người > 60 tuổi |
| Tương thích | Chrome, Safari, Edge, Firefox bản mới; màn hình ≥ 360px |
| SEO | Trang giới thiệu công khai có SSR; tuyệt đối không render dữ liệu người còn sống/chưa rõ |

---

## 4. Pháp lý & bảo vệ dữ liệu cá nhân

> **Căn cứ:** Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (hiệu lực 01/01/2026) và Nghị định 356/2025/NĐ-CP hướng dẫn thi hành (thay thế Nghị định 13/2023/NĐ-CP). *Cần luật sư/chuyên viên pháp chế xác nhận danh sách nghĩa vụ trước giai đoạn Beta.*

### 4.1. Vai trò theo từng luồng xử lý (đề xuất — pháp chế chốt trước tuần 7)
| Luồng xử lý | Ai quyết định mục đích & phương tiện | Ai trực tiếp xử lý | Vai trò đề xuất của nền tảng |
|---|---|---|---|
| Tài khoản, đăng nhập, thanh toán | Nền tảng | Nền tảng | Bên kiểm soát và xử lý |
| Nội dung gia phả do ban quản lý họ nhập (người, quan hệ, tư liệu) | Ban quản lý họ (mục đích lưu giữ phả hệ) + nền tảng (phương tiện, mặc định riêng tư, tính năng) | Nền tảng | Đồng kiểm soát hoặc bên xử lý — **phải chốt** |
| Nhắc giỗ, thông báo | Nền tảng (theo cài đặt người dùng) | Nền tảng + nhà cung cấp email | Bên kiểm soát và xử lý |
| Nhật ký bảo mật, giám sát lỗi | Nền tảng | Nền tảng + nhà cung cấp | Bên kiểm soát |
| Dịch vụ số hóa/nhập liệu thuê | Ban quản lý họ | Nền tảng (nhân sự dịch vụ) | Bên xử lý theo hợp đồng |

- Kết quả chốt được ánh xạ sang vai trò luật định của Luật 91/2025 và đưa vào điều khoản sử dụng, DPA, hồ sơ đánh giá tác động. Điều khoản "ban quản lý họ chịu trách nhiệm dữ liệu nhập hộ" **không thay thế** nghĩa vụ của nền tảng.
- Chỉ định **người phụ trách bảo vệ dữ liệu** của dự án ngay từ tuần 1.

### 4.2. Nghĩa vụ & giải pháp
| Nghĩa vụ | Giải pháp trong sản phẩm/quy trình |
|---|---|
| Căn cứ xử lý / sự đồng ý theo mục đích | Bảng `legal_bases` (người, mục đích: lưu trong gia phả nội bộ / hiển thị trong họ / công khai / nhận thông báo; loại căn cứ: đồng ý hoặc căn cứ khác do pháp chế xác định; phiên bản nội dung thông báo) + `consent_parties` (từng bên xác nhận: danh tính, tư cách — bản thân/người đại diện/trẻ em, có hoặc không có tài khoản, kênh, bằng chứng, thời điểm, rút lúc nào). Rút của **một** bên bắt buộc làm căn cứ mất hiệu lực nếu căn cứ cần đủ các bên |
| Nhập hộ dữ liệu người khác | Người còn sống/chưa rõ được nhập hộ mang trạng thái **"chưa xác minh căn cứ"**: chỉ người nhập và ban quản lý họ thấy, không xuất hiện trong tìm kiếm, cây chung, xuất file, chia sẻ. Cam kết của người nhập hoặc việc "không công khai" **không** được coi là đủ. Sau khi bổ sung bằng chứng (đồng ý qua link/OTP, giấy xác nhận, hoặc căn cứ khác được pháp chế duyệt) mới hiển thị trong họ. Quá 90 ngày chưa xác minh → nhắc, quá 180 ngày → ẩn danh tự động |
| Trẻ em | Trẻ dưới 16 tuổi: ẩn mặc định; công bố cần đồng ý của người đại diện, và của trẻ khi từ đủ 7 tuổi |
| Quyền của chủ thể dữ liệu | Luồng yêu cầu xem/sửa/xóa/hạn chế/rút đồng ý, có SLA xử lý và nhật ký |
| Đánh giá tác động xử lý dữ liệu | Lập hồ sơ trước Beta, cập nhật khi đổi nhà cung cấp/tính năng |
| Chuyển dữ liệu ra nước ngoài | Lập bản đồ dữ liệu cho mọi nhà cung cấp (hosting, CDN, storage, email, Sentry...); ưu tiên hạ tầng trong nước cho dữ liệu chính; lập hồ sơ nếu có chuyển ra nước ngoài |
| Hợp đồng với bên xử lý | Ký DPA với từng nhà cung cấp |
| Sự cố dữ liệu | Quy trình phát hiện – đánh giá – thông báo cơ quan chức năng trong 72 giờ khi thuộc diện phải báo; thông báo người bị ảnh hưởng |
| Tối thiểu hóa & lưu trữ | Chỉ thu trường cần thiết; xóa thực sự khi có yêu cầu (kể cả bản xuất, cache, nội dung lịch sử thay đổi); `erasure_registry` được kiểm tra ở **mọi** đường phục hồi: hoàn tác, nhập lại, khôi phục backup |
| Truy cập nội bộ | Nhân viên hỗ trợ chỉ truy cập dữ liệu họ khi chủ họ cấp phép có thời hạn; ghi nhật ký đầy đủ |

### 4.3. Mốc pháp lý gắn với từng đợt dùng dữ liệu thật
| Mốc | Tuần | Điều kiện / bàn giao |
|---|---|---|
| L0 – Trước khi nhận gia phả mẫu | 1–2 | Pháp chế xác nhận cách nhận dữ liệu mẫu: thỏa thuận với dòng họ cung cấp, chỉ dùng cho thiết kế/kiểm thử nội bộ, **ẩn danh người còn sống/chưa rõ trước khi nhập hệ thống**, giới hạn người truy cập |
| L1 – Chốt vai trò & khung tuân thủ | 3–7 | Bảng vai trò mục 4.1 được chốt; bản đồ dữ liệu; danh sách nhà cung cấp và luồng xuyên biên giới; DPA nháp |
| L2 – Trước demo dữ liệu thật trên staging | 12 | Hồ sơ đánh giá tác động bản đầu (nếu pháp chế xác nhận phải lập từ khi bắt đầu xử lý); staging đạt test cô lập tenant |
| L3 – Điều kiện mở Beta | **trước tuần 20** | Điều khoản sử dụng, chính sách quyền riêng tư, hồ sơ đánh giá tác động hoàn chỉnh (và nộp nếu thuộc diện), DPA đã ký, quy trình sự cố đã diễn tập, luồng đồng ý & yêu cầu dữ liệu chạy được |
| L4 – Rà soát trước go-live | 20–24 | Chỉ cập nhật theo phản hồi beta; ký xác nhận của pháp chế |

Mọi ngoại lệ (vd dùng dữ liệu thật chưa ẩn danh) phải có văn bản xác nhận của pháp chế.

---

## 5. Thiết kế dữ liệu

### 5.1. Nguyên tắc
- Dữ liệu gia phả là **đồ thị có hướng** (cha mẹ → con) cộng với **hồ sơ hôn phối** riêng.
- Mọi bảng thuộc tenant có `family_id`; tham chiếu giữa các bảng dùng **khóa ngoại ghép `(family_id, id)`** để CSDL chặn tham chiếu chéo họ.
- Mọi bảng nghiệp vụ có `version` (optimistic locking) và được ghi lịch sử theo giao dịch.
- Ngày tháng lưu dữ liệu gốc như gia phả ghi; giá trị quy đổi là dữ liệu dẫn xuất.
- **Tuần tự hóa sửa đồ thị:** mọi giao dịch thay đổi `parent_child`, `unions`, nhập lô, hoàn tác lấy khóa `pg_advisory_xact_lock(family_id)` trước khi kiểm tra chu trình và ghi; giao dịch khác của cùng họ phải chờ. (Phương án dự phòng nếu PoC cho thấy nghẽn: SERIALIZABLE + retry toàn giao dịch.) Có kiểm thử đồng thời tạo chu trình A→B / B→A.

### 5.2. Bảng chính
| Bảng | Trường chính |
|---|---|
| `users` | id, email, phone, password_hash, mfa, status |
| `families` | id, name, surname, origin_place, founder_person_id, generation_anchor_person_id, generation_rules(JSON), lunar_rules(JSON), visibility, plan_id |
| `family_roles` | family_id, user_id, role (owner/co_admin/editor/branch_editor/member/viewer), scope_branch_id, granted_by, expires_at |
| `persons` | id, family_id, gender, living_status (alive/deceased/unknown), generation_recorded, generation_computed, sibling_order, sibling_order_note (unknown/twin...), is_lineage_heir, is_anonymous, biography, avatar_media_id, version |
| `person_names` | id, family_id, person_id, type (birth/taboo/courtesy/pen/posthumous/other), value_vi, value_han_nom, valid_from/to, is_primary |
| `person_dates` | id, family_id, person_id, kind (birth/death/burial/reburial), date (cấu trúc 5.3), place_id |
| `parent_child` | id, family_id, parent_id, child_id, type (biological/adoptive/heir_adoption/unknown) — UNIQUE(parent_id, child_id), CHECK parent≠child, kiểm tra chu trình tổ tiên dưới khóa theo họ; tối đa 2 cha/mẹ đẻ mỗi người. **Nguồn sự thật duy nhất** cho quan hệ cha mẹ–con |
| `unions` (hôn phối) | id, family_id, partner1_id, partner2_id, union_order (chính thất/kế thất/thứ thất...), start_date, end_date, end_reason (divorce/widowed). Con chung/con riêng là **view suy ra** từ `parent_child` + `unions`, không lưu riêng |
| `branches` | id, family_id, name, root_person_id, parent_branch_id |
| `branch_members` | family_id, branch_id, person_id, membership_type (lineage/spouse/manual) — được tính lại khi đổi quan hệ, đổi gốc là thao tác đặc quyền |
| `places` | id, family_id, name_current, name_historical, admin_code, lat/lng |
| `sources` | id, family_id, type (gia phả gốc/văn bia/lời kể...), title, media_id, source_reliability (độ tin cậy của **tài liệu**) |
| `citations` | id, family_id, source_id, target_type (person_name/person_date/parent_child/union/generation/...), target_id, page_or_locator, quoted_text, conclusion_confidence (độ chắc chắn của **kết luận**), status (confirmed/unconfirmed/disputed). Một dữ kiện có nhiều trích dẫn, kể cả mâu thuẫn |
| `commemorations` (giỗ) | id, family_id, person_id, lunar_month, lunar_day, leap_rule, missing_day_rule, observed_rule, note |
| `events` | id, family_id, title, type, date, recurrence, location, person_id |
| `media` / `media_links` | tư liệu (khóa bất biến, checksum, kích thước, mime, scan_status, audience, redacted_of_media_id cho bản che, review_status) và liên kết tới người/sự kiện/nguồn |
| `privacy_settings` | family_id, person_id, field, audience (family/branch/editors/public) |
| `persons.basis_status` | verified / unverified (chưa xác minh căn cứ) / not_required (đã mất) |
| `legal_bases` | id, family_id, person_id, purpose, basis_type, notice_version, status, effective_from, ended_at |
| `consent_parties` | id, legal_basis_id, party_capacity (self/representative/child), party_user_id (nullable), party_name, contact, channel, evidence_media_id, confirmed_at, withdrawn_at |
| `data_requests` | yêu cầu quyền chủ thể dữ liệu, người yêu cầu, tư cách, trạng thái, hạn xử lý |
| `erasure_registry` | family_id, target_type, target_id, scope (erase/restrict), request_id, executed_at — kiểm tra ở hoàn tác, nhập lại, khôi phục backup |
| `change_sets` / `change_items` | giao dịch thay đổi, tác giả, nguồn, trạng thái (applied/proposed/reverted), before/after từng bản ghi |
| `account_person_links` | user_id, family_id, person_id, verified_by, verified_at, revoked_at (không tự hợp nhất xuyên họ) |
| `notifications`, `audit_logs`, `subscriptions` | như thông thường |

### 5.3. Cấu trúc ngày linh hoạt
```json
{
  "calendar": "lunar | solar",
  "year": 1890,            // null nếu không biết năm
  "month": 3,              // null nếu không biết
  "day": null,             // null nếu không biết
  "is_leap_month": false,  // chỉ có nghĩa khi calendar = lunar và month != null
  "qualifier": "exact | approximate | before | after",
  "range_end": null,       // cùng cấu trúc (calendar, year, month, day, is_leap_month) khi là khoảng "từ … đến …"
  "original_text": "Canh Dần niên, tam nguyệt",
  "solar_derived": {       // dữ liệu dẫn xuất, có thể null
    "from": "1890-04-19", "to": "1890-05-18",   // luôn là khoảng ngày ISO hợp lệ; from = to khi chính xác tới ngày
    "algorithm_version": "hnd-1.0"
  }
}
```
**Quy tắc hợp lệ:**
- Độ chính xác suy ra từ các thành phần có giá trị (năm–tháng–ngày, năm–tháng, chỉ năm, **tháng–ngày không có năm**, không rõ) — không lưu trường `precision` riêng để tránh mâu thuẫn.
- Có `day` thì phải có `month`; có `range_end` thì `range_end` ≥ điểm đầu và cùng `calendar`.
- `solar_derived` chỉ tính khi có năm; không đủ chính xác tới ngày thì là **khoảng** (vd cả tháng âm), thiếu năm thì để `null`.
- **Phạm vi lưu:** không giới hạn (lưu nguyên văn bất kỳ niên đại nào). **Phạm vi được phép quy đổi tự động:** năm 1800–2199 (đã kiểm thử với bảng tra); ngoài phạm vi chỉ lưu, không quy đổi.

Quy tắc giỗ lưu riêng trong `commemorations`, áp dụng được cả khi ngày mất chỉ biết tháng–ngày âm.

### 5.4. Thế thứ
- `generation_recorded`: đời ghi trong gia phả gốc (nguồn sự thật nếu có).
- `generation_computed`: tính từ mốc tổ theo quy tắc của họ; hiển thị cảnh báo khi lệch với giá trị ghi.
- Phối ngẫu không mang thế thứ của họ; con nuôi/thừa tự tính theo cấu hình.

### 5.5. Quyền riêng tư khi hiển thị
- Một lớp **policy duy nhất** lọc dữ liệu (theo trường + người xem + trạng thái căn cứ + danh sách xóa/hạn chế) dùng chung cho API, tìm kiếm, cây, xuất file, SSR, link công khai. **Vai trò (mục 6) chỉ cấp khả năng thao tác; dữ liệu trả về luôn đi qua policy** — không vai trò nào bỏ qua được.
- Người bị ẩn hiển thị dạng "Người được bảo vệ" trong cạnh quan hệ, kết quả tìm kiếm, và trong rich text **khi tên được gắn thẻ người** (trình soạn thảo tự gợi ý gắn thẻ khi gõ tên trùng người trong họ).
- **Giới hạn đã biết (cam kết thu hẹp):** hệ thống không tự che được tên trong văn bản tự do chưa gắn thẻ, ảnh, scan, PDF. Các nội dung này được kiểm soát bằng **phạm vi chia sẻ** (tư liệu gốc mặc định chỉ ban quản lý xem; chia sẻ rộng phải duyệt và dùng bản che thủ công — mục 2.1(8)), không bằng che tự động.
- Cache và file xuất gắn khóa theo `family_id` + phạm vi quyền.

### 5.6. Cô lập tenant
1. Khóa ngoại ghép `(family_id, id)` ở mọi tham chiếu nội bộ họ.
2. Tầng truy cập dữ liệu bắt buộc ngữ cảnh tenant lấy từ quyền đã xác minh (không lấy từ tham số client).
3. PostgreSQL Row-Level Security làm lớp phòng thủ thứ hai.
4. Job nền, cache, đường dẫn file storage mang `family_id` và kiểm tra quyền lại khi thực thi/tải.
5. Bộ test tự động thử truy cập chéo họ cho mọi endpoint.

---

## 6. Ma trận phân quyền (v1.0)

| Hành động | Chủ sở hữu | Đồng quản trị | Biên tập viên | Biên tập nhánh | Thành viên | Người xem |
|---|---|---|---|---|---|---|
| Xem người đã mất | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Xem người còn sống/chưa rõ (đã xác minh căn cứ) | theo policy | theo policy | theo policy | theo policy | theo policy | ✗ mặc định |
| Xem người "chưa xác minh căn cứ" | ✓ | ✓ | chỉ người đã nhập | chỉ người đã nhập | ✗ | ✗ |
| Thêm/sửa người | ✓ | ✓ | ✓ | trong nhánh | đề xuất | ✗ |
| Tạo/xóa quan hệ | ✓ | ✓ | ✓ | khi **cả hai đầu** trong nhánh | đề xuất | ✗ |
| Xóa người | ✓ | ✓ | ✓ (không có quan hệ) | ✗ | ✗ | ✗ |
| Đổi gốc chi, nối chi, chuyển nhánh | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Sửa tổ tiên chung ngoài nhánh | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Nhập Excel / hoàn tác lô | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Hoàn tác giao dịch của chính mình | ✓ | ✓ | ✓ | ✓ (nếu vẫn trong nhánh) | ✗ | ✗ |
| Hoàn tác giao dịch của người khác | ✓ | ✓ | ✓ (trừ thao tác đặc quyền) | ✗ | ✗ | ✗ |
| Duyệt chia sẻ tư liệu / tạo bản che | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Xuất nghiệp vụ (Excel, cây — đã lọc policy) | ✓ | ✓ | ✓ | ✓ | ✓ (cây) | ✓ nếu cho phép |
| Bản chuyển giao toàn bộ (mục 2.1(11)) | ✓ (+MFA) | ✗ | ✗ | ✗ | ✗ | ✗ |
| Cấp/thu hồi quyền | ✓ | ✓ (trừ chủ sở hữu) | ✗ | ✗ | ✗ | ✗ |
| Chuyển quyền sở hữu, xóa họ | ✓ (+MFA) | ✗ | ✗ | ✗ | ✗ | ✗ |
| Xử lý yêu cầu dữ liệu cá nhân | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

**Thứ tự ưu tiên:** danh sách xóa/hạn chế → trạng thái căn cứ → policy riêng tư → vai trò. Vai trò chỉ quyết định *được làm thao tác gì*; *được thấy dữ liệu gì* luôn do policy quyết định.

Quản trị hệ thống: không có quyền đọc dữ liệu họ mặc định; chỉ truy cập qua phiên hỗ trợ được chủ họ cấp, có thời hạn và ghi nhật ký.

---

## 7. Kiến trúc & công nghệ

### 7.1. Kiến trúc tổng thể
```
[Trình duyệt]
     │ HTTPS
     ▼
[CDN/WAF] ──► [Next.js (SSR trang công khai + SPA ứng dụng)]
                     │
                     ▼
              [Backend modular monolith (NestJS) + Policy layer]
                     │
      ┌──────────────┼───────────────────┐
      ▼              ▼                   ▼
 [PostgreSQL     [Redis + BullMQ      [Object storage riêng tư
  + RLS + PITR]   worker: xuất file,   (khóa bất biến, ảnh, scan,
                  email, nhắc giỗ,     file xuất), quét mã độc,
                  nhập Excel]          sao chép liên tục sang
                                       bucket backup tách biệt]
```
Không dùng WebSocket ở v1.0 (chưa có nhu cầu cộng tác thời gian thực); dùng thông báo web qua polling/SSE.

### 7.2. Công nghệ đề xuất (chốt sau PoC)
| Lớp | Lựa chọn | Ghi chú |
|---|---|---|
| Frontend | Next.js + TypeScript + Tailwind + shadcn/ui | |
| Vẽ cây | **Ứng viên:** D3 (layout tự viết), React Flow + ELK, family-chart | Chọn sau PoC |
| Backend | NestJS, modular monolith + worker | |
| CSDL | PostgreSQL 16 (recursive CTE, RLS, `unaccent` + `pg_trgm`) | |
| ORM | Prisma hoặc Drizzle (cần hỗ trợ tốt RLS/khóa ghép — đánh giá trong PoC) | |
| Âm lịch | Thuật toán Hồ Ngọc Đức, có version, unit test với bảng tra 1800–2199 (phạm vi quy đổi được phép, mục 5.3) | |
| Xuất PDF/SVG | SVG phía server cho cây; Playwright cho trang in | Worker có giới hạn CPU/RAM/thời gian, chặn tải URL ngoài |
| Hạ tầng | Docker; ưu tiên cloud/IDC trong nước cho CSDL & storage | Theo bản đồ dữ liệu mục 4 |
| Giám sát | Sentry (lọc dữ liệu cá nhân), Prometheus/Grafana, Uptime Kuma | |

### 7.3. PoC kỹ thuật (trong giai đoạn Thiết kế, 2 tuần)
- Cây với dữ liệu khó: nhiều hôn phối, tổ tiên lặp (pedigree collapse), con nuôi, nhánh 25+ đời, thiếu dữ liệu; thao tác trên điện thoại.
- Benchmark truy vấn tổ tiên/hậu duệ, tìm kiếm trên họ 50.000 người.
- RLS + khóa ghép với ORM đã chọn; khóa tuần tự hóa theo họ khi nhập lô 5.000 người song song với người sửa khác.
- Xuất SVG/PDF cây 2.000 người khổ A0, **in thử thật** và kiểm tra tiêu chí đọc được (mục 2.3).
- Phục hồi PITR về thời điểm T + kiểm tra toàn vẹn file.
- Tiêu chí chọn: hiệu năng, giấy phép, mức bảo trì, khả năng tùy biến.

---

## 8. Danh sách màn hình
1. Landing page + bảng giá.
2. Đăng ký / Đăng nhập / MFA / Nhận lời mời.
3. Bảng điều khiển: các họ của tôi, giỗ sắp tới, hoạt động gần đây.
4. Trang giới thiệu dòng họ (lịch sử, nhà thờ họ, tộc ước).
5. **Cây phả hệ** + chế độ xem danh sách thay thế.
6. Hồ sơ người: tên, ngày, quan hệ, nguồn, tư liệu, lịch sử thay đổi.
7. Danh sách người dạng bảng (lọc đời/chi, xuất Excel).
8. Nhập Excel: tải lên → xem trước/lỗi → xử lý trùng → xác nhận.
9. Lịch giỗ & sự kiện (âm/dương).
10. Thư viện tư liệu.
11. Quản trị họ: thành viên & quyền, đề xuất sửa, lịch sử/hoàn tác, quyền riêng tư & đồng ý, yêu cầu dữ liệu, chuyển giao sở hữu.
12. Tài khoản cá nhân, gói dịch vụ, liên kết "đây là tôi".
13. Admin hệ thống.

Phong cách: trang nhã truyền thống – hiện đại (đỏ trầm/nâu gỗ/vàng kim), font hỗ trợ tiếng Việt và Hán Nôm, cỡ chữ lớn, tương phản đạt WCAG AA.

---

## 9. Kế hoạch triển khai & tiến độ

Tổng thời gian đến v1.0: **~26 tuần (~6 tháng)** với phạm vi MVP đã thu hẹp (mục 2.1). Sprint 2 tuần.

| Giai đoạn | Tuần | Công việc chính | Bàn giao |
|---|---|---|---|
| **0. Khởi động & khảo sát** | 1–3 | Phỏng vấn 10–15 người (trưởng họ, người chép phả, phụ nữ/con dâu, bên ngoại, Việt kiều); **mốc pháp lý L0** rồi mới thu 3–5 bộ gia phả thật (ẩn danh người còn sống); khảo sát mức sẵn lòng trả tiền | SRS, user stories, bộ dữ liệu mẫu đã ẩn danh, danh sách nghĩa vụ pháp lý |
| **1. Thiết kế + PoC** | 4–7 | UI/UX Figma, ERD chi tiết, ma trận quyền, đặc tả mục 2.3, PoC kỹ thuật (7.3, 1 FE + 1 BE), bản đồ dữ liệu, **mốc pháp lý L1** | Figma, ERD, OpenAPI, báo cáo PoC, quyết định công nghệ, backlog MVP đã ước lượng theo FE/BE |
| **2. Nền tảng** | 8–9 | Repo, CI/CD, môi trường, xác thực + MFA, tenant + RLS, policy layer, change_sets, backup PITR | Staging chạy được, test cô lập tenant |
| **3. Sprint 1** | 10–11 | Người, tên, ngày linh hoạt, quan hệ + ràng buộc, nguồn | Quản lý dữ liệu gia phả |
| **4. Sprint 2** | 12–13 | Cây phả hệ, chế độ danh sách, tìm kiếm có lọc quyền | Xem/sửa trên cây |
| **5. Sprint 3** | 14–15 | Chi/phái, thế thứ, phân quyền nhánh, lịch sử & hoàn tác, đề xuất sửa | Cộng tác an toàn |
| **6. Sprint 4** | 16–17 | Lịch giỗ âm lịch + email, tư liệu (upload an toàn, duyệt chia sẻ, bản che), quyền riêng tư, căn cứ/đồng ý nhiều bên, yêu cầu dữ liệu, `erasure_registry` | Lịch, tư liệu, riêng tư |
| **7. Sprint 5** | 18–19 | **BE:** nhập/xuất Excel, bản chuyển giao toàn bộ, thanh toán & gói. **FE:** màn nhập Excel, xuất cây SVG/PDF, link công khai. Hoàn tất **mốc pháp lý L3** | Feature freeze, đủ điều kiện mở beta |
| **8. Kiểm thử & Beta kín** | 20–24 | Beta chỉ mở khi đạt L3. QA, pentest, kiểm thử hiệu năng & khả dụng, diễn tập phục hồi; beta 10–20 họ dùng dữ liệu thật (đã có căn cứ); **mốc pháp lý L4** | Báo cáo kiểm thử, hồ sơ pháp lý cập nhật sau beta |
| **9. Ra mắt v1.0** | 25–26 | Sửa lỗi beta, tài liệu hướng dẫn/video, kênh hỗ trợ, marketing | Go-live |
| **10. Giai đoạn 2** | Tháng 7+ | Theo mục 2.2, ưu tiên theo phản hồi | Roadmap |

### Cột mốc
- M1 (tuần 3): Chốt yêu cầu MVP & nghĩa vụ pháp lý.
- M2 (tuần 7): Duyệt thiết kế, chốt công nghệ sau PoC, chốt vai trò pháp lý (L1), **backlog vừa ngân sách công từng nhóm** (mục 10).
- M3 (tuần 13): Demo cây phả hệ nội bộ với dữ liệu thật (sau L2).
- M4 (tuần 19): Feature freeze + đạt điều kiện mở beta (L3).
- M5 (tuần 24): Đạt tiêu chí phát hành (mục 13.3).
- M6 (tuần 26): Go-live v1.0.

**Nguyên tắc kiểm soát phạm vi:** nếu trễ, cắt tính năng theo thứ tự: link công khai → xuất PDF khổ lớn (giữ SVG) → thanh toán (mở miễn phí giai đoạn đầu); **không cắt** quyền riêng tư, lịch sử/hoàn tác, sao lưu.

---

## 10. Nhân sự

| Vai trò | Số lượng | Ghi chú |
|---|---|---|
| Product Owner / PM | 1 | |
| UI/UX Designer | 1 (toàn thời gian tuần 1–9, sau đó 50%) | |
| Frontend Developer | 2 | 1 người chuyên cây phả hệ/visualization |
| Backend Developer | 2 | 1 người phụ trách dữ liệu, quyền, bảo mật |
| QA/Tester | 1 (từ tuần 8) | Kèm tự động hóa E2E |
| DevOps | 0,5 | Backup, giám sát, hạ tầng |
| Tư vấn pháp lý dữ liệu cá nhân | thuê ngoài theo giờ | Theo các mốc L0–L4 (mục 4.3): tuần 1–7, 12, 17–19, 20–24 |
| Cố vấn gia phả / Hán Nôm | thuê ngoài theo giờ | Nghiệm thu thế thứ, ngày giỗ, dữ liệu mẫu |

### Ngân sách công (tuần 8–19, hệ số hiệu dụng ~0,7)
| Nhóm | Danh nghĩa | Hiệu dụng | Phân bổ dự kiến (tuần-người hiệu dụng) |
|---|---|---|---|
| Backend (2) | 24 | ~17 | Nền tảng/tenant/RLS/policy 4 · người–quan hệ–ngày–trích dẫn 4 · chi/thế thứ/quyền/lịch sử/hoàn tác 3,5 · giỗ/tư liệu/căn cứ/xóa 3 · nhập–xuất/thanh toán 2,5 |
| Frontend (2) | 24 | ~17 | Khung app/xác thực 2,5 · hồ sơ người & quan hệ 3,5 · cây + chế độ danh sách 5 · quản trị/quyền/lịch sử 2,5 · lịch/tư liệu/riêng tư 2 · nhập Excel/xuất/chia sẻ 1,5 |
| DevOps (0,5) | 6 | ~4 | CI/CD, môi trường, PITR + sao chép file, giám sát, diễn tập phục hồi |

- Tuần 4–7: 1 FE + 1 BE làm PoC (≈ 5,6 tuần-người hiệu dụng), 2 dev còn lại hỗ trợ thiết kế/ERD/OpenAPI và dựng khung dự án.
- Tại M2 (tuần 7), backlog MVP được ước lượng theo từng nhóm; **chỉ xác nhận lịch khi backlog mỗi nhóm ≤ ngân sách hiệu dụng của nhóm đó** (kèm dự phòng 10%). Nếu vượt: cắt theo thứ tự ở mục 9 hoặc bổ sung nhân sự.

---

## 11. Chi phí (tham khảo)

| Hạng mục | Ước tính |
|---|---|
| Nhân sự | Theo đơn giá nội bộ |
| Hạ tầng pilot (CSDL có PITR, storage có versioning, backup tách biệt, CDN) | 4–8 triệu VNĐ/tháng |
| Hạ tầng năm 1 (2.000 họ) | Ước tính lại sau benchmark; storage là chi phí biến đổi chính |
| Email giao dịch | 0,5–1 triệu VNĐ/tháng |
| Công cụ (Figma, Sentry, ...) | 1–2 triệu VNĐ/tháng |
| Pentest trước go-live | Theo báo giá |
| Tư vấn pháp lý, cố vấn gia phả | Theo giờ |
| Tên miền | ~0,5 triệu VNĐ/năm |

---

## 12. Mô hình kinh doanh (giả thuyết cần kiểm chứng ở giai đoạn 0)

### 12.1. Khách hàng trả tiền
Ban quản lý họ / quỹ họ (thanh toán theo năm), không phải từng thành viên.

### 12.2. Gói dịch vụ (giá là giả thuyết)
| Gói | Giới hạn | Giá dự kiến |
|---|---|---|
| Miễn phí | 1 họ, 300 người, 1GB tư liệu, xuất cây khổ A3 | 0 |
| Gia tộc | 5.000 người, 20GB, xuất khổ lớn, nhiều biên tập viên | ~1–2 triệu VNĐ/năm |
| Đại tộc | 20.000 người, 100GB, hỗ trợ ưu tiên | ~3–5 triệu VNĐ/năm |
| Mua thêm | Dung lượng, tin nhắn SMS/Zalo (khi ra mắt, tính theo lượng) | Theo đơn giá |

- Tên miền con của nền tảng (`ho-nguyen.giaphaonline.vn`) có ở các gói trả phí.
- **Tên miền riêng của họ** (vd `honguyen.vn`): tính năng riêng, giai đoạn 2, cần xác minh sở hữu, cấp TLS tự động, ánh xạ tenant, thu hồi khi hết hạn.
- **Vòng đời dữ liệu khi hết gói trả phí:**
  1. Ân hạn 30 ngày: dùng bình thường, nhắc gia hạn.
  2. Hạ về gói Miễn phí: nếu vượt quota → **chỉ đọc** trong 12 tháng, luôn xuất được dữ liệu.
  3. Sau 12 tháng không gia hạn/không giảm về trong quota → **lưu trữ lạnh** 24 tháng (không xem online, chỉ yêu cầu xuất bản chuyển giao).
  4. Hết lưu trữ lạnh → xóa vĩnh viễn. Báo trước qua email cho chủ sở hữu và đồng quản trị ở các mốc 90/30/7 ngày trước mỗi bước chuyển.
  - Chi phí lưu trữ chỉ đọc và lưu trữ lạnh được tính vào chi phí phục vụ mỗi họ trong mục 12.4.
- Hoàn tiền: theo tỷ lệ thời gian còn lại trong 30 ngày đầu.

### 12.3. Dịch vụ cộng thêm (hạch toán riêng)
Số hóa gia phả giấy (nhập liệu, dịch Hán Nôm), in cây khổ lớn, in sách gia phả.

### 12.4. Cần lập trước go-live
Bảng doanh thu/chi phí theo 3 kịch bản (thận trọng/cơ sở/lạc quan), hoàn thành **trước M2 (tuần 7)** dựa trên số liệu khảo sát giai đoạn 0: chi phí phục vụ mỗi họ đang hoạt động, mỗi họ miễn phí, mỗi họ ở trạng thái chỉ đọc/lưu trữ lạnh (storage, backup, email, hỗ trợ); tỷ lệ chuyển đổi miễn phí → trả phí; điểm hòa vốn.

---

## 13. Kiểm thử & đảm bảo chất lượng

### 13.1. Chiến lược
- Unit test cho logic quan hệ, thế thứ, âm lịch, policy quyền (ưu tiên độ phủ theo **ca nghiệp vụ**, không chỉ % coverage).
- Property-based test cho ràng buộc đồ thị (không chu trình tổ tiên, xuất–nhập bảo toàn dữ liệu).
- E2E (Playwright): tạo họ → thêm người → xem cây → nhập Excel → hoàn tác → xuất.
- Hiệu năng trên **dữ liệu thật đã ẩn danh** + dữ liệu sinh có cấu trúc khó, quy mô 50.000 người/họ.
- Bảo mật: OWASP ASVS L2, pentest bên ngoài, test truy cập chéo tenant tự động.
- Khả dụng: ≥ 8 người dùng > 60 tuổi, kiểm tra WCAG AA.

### 13.2. Bộ ca kiểm thử bắt buộc
Chu trình tổ tiên (kể cả **hai giao dịch đồng thời** tạo A→B và B→A); nhiều hôn phối + con riêng (view suy ra đúng); tổ tiên lặp; con nuôi/thừa tự; người khuyết danh; ngày tháng nhuận, ngày 30 tháng thiếu, chỉ biết năm, chỉ biết tháng–ngày, khoảng ngày, ngoài phạm vi quy đổi; giỗ không biết năm mất; sửa đồng thời; biên tập nhánh tạo quan hệ ra ngoài nhánh; rò người được bảo vệ/"chưa xác minh căn cứ" qua tìm kiếm/cạnh quan hệ/xuất file/cache/SSR; vai trò cao không vượt policy; tải tư liệu gốc không qua duyệt; nhập lại Excel không nhân đôi; hoàn tác lô nhập; **hoàn tác/nhập lại/khôi phục backup không làm sống lại dữ liệu đã xóa theo yêu cầu**; rút đồng ý của một trong nhiều bên; phục hồi PITR về thời điểm T với file khớp.

### 13.3. Tiêu chí phát hành
- 0 lỗi mức Nghiêm trọng/Cao mở (bảo mật, rò dữ liệu, mất dữ liệu, sai quan hệ).
- Toàn bộ ca bắt buộc 13.2 đạt.
- Diễn tập phục hồi toàn hệ thống thành công: đạt **RTO**, đạt **RPO** (mất dữ liệu ≤ 15 phút) và **kiểm tra toàn vẹn CSDL–file** không lỗi.
- Mốc pháp lý L3 đã đạt trước beta, L4 đã ký trước go-live.
- Đạt chỉ tiêu hiệu năng mục 3 trên môi trường staging tương đương production.

---

## 14. Rủi ro & biện pháp

| Rủi ro | Mức | Phụ trách | Tín hiệu theo dõi | Biện pháp |
|---|---|---|---|---|
| Vi phạm pháp luật dữ liệu cá nhân | Cao | PO + pháp chế | Kết quả rà soát, khiếu nại | Mục 4; hồ sơ trước Beta; mặc định riêng tư |
| Rò dữ liệu người còn sống / chéo tenant | Cao | Tech lead | Test cô lập, pentest, log truy cập bất thường | Policy layer duy nhất, khóa ghép, RLS, test tự động |
| Sai hoặc mất dữ liệu phả hệ do sửa/nhập | Cao | Backend lead | Số lần hoàn tác, báo lỗi người dùng | Ràng buộc đồ thị, change_sets, hoàn tác, xem trước nhập, PITR |
| Mất tư liệu/không phục hồi được | Cao | DevOps | Kết quả diễn tập phục hồi | Backup đồng bộ CSDL+file, bản sao tách biệt, diễn tập hằng quý |
| Mô hình quan hệ/thế thứ không khớp thực tế các họ | Cao | PO + cố vấn gia phả | Phản hồi beta, số trường hợp phải "lách" | Khảo sát giai đoạn 0, dữ liệu mẫu thật, mô hình mở rộng được |
| Trễ tiến độ | Cao | PM | Velocity so với backlog đã ước lượng | MVP thu hẹp, thứ tự cắt phạm vi đã chốt (mục 9) |
| Cây lớn hiển thị chậm/khó dùng trên điện thoại | Trung bình | FE lead | Kết quả PoC & benchmark | PoC sớm, tải theo nhánh, chế độ danh sách |
| Quy đổi âm lịch / quy tắc giỗ sai tập tục | Trung bình | BE + cố vấn | Phản hồi người dùng | Test bảng tra, quy tắc giỗ cấu hình được, ngày cúng thực tế |
| Tranh chấp quyền quản trị trong họ | Trung bình | PO + hỗ trợ | Yêu cầu hỗ trợ | Đồng quản trị, chuyển giao, quy trình khôi phục quyền có xác minh |
| Người cao tuổi khó sử dụng | Trung bình | Designer | Kiểm thử khả dụng | WCAG AA, chế độ danh sách, video hướng dẫn, hỗ trợ nhập liệu |
| Không đủ doanh thu | Trung bình | PO | Tỷ lệ chuyển đổi beta | Kiểm chứng giá ở giai đoạn 0, dịch vụ cộng thêm |
| Lạm dụng OTP/email, upload độc hại | Thấp–TB | Tech lead | Chi phí gửi tin, cảnh báo quét | Giới hạn tần suất, ngân sách gửi, quét mã độc |

---

## 15. Vận hành sau ra mắt
- Giám sát lỗi & hiệu năng; **lịch trực** (giờ hành chính + trực ngoài giờ cho sự cố mức Cao) — điều chỉnh cam kết theo nhân lực thực tế.
- Sao lưu theo mục 3; diễn tập phục hồi hằng quý (đo RTO, RPO, toàn vẹn CSDL–file); áp dụng `erasure_registry` sau mọi lần khôi phục.
- Báo cáo uptime theo tháng theo định nghĩa SLA ở mục 3.
- Chạy định kỳ tác vụ vòng đời dữ liệu (chỉ đọc → lưu trữ lạnh → xóa) và nhắc xác minh căn cứ.
- Quy trình sự cố dữ liệu cá nhân (thông báo trong 72 giờ khi thuộc diện).
- Kênh hỗ trợ: email, Zalo OA, trung tâm trợ giúp, video hướng dẫn.
- Phát hành cập nhật 2–4 tuần/lần.
- KPI: số họ mới, số người trong gia phả, MAU, tỷ lệ chuyển đổi trả phí, tỷ lệ giữ chân, thời gian xử lý yêu cầu dữ liệu, số sự cố.

---

## 16. Bước tiếp theo
1. Duyệt kế hoạch v2.1 với các bên liên quan.
2. Thuê tư vấn pháp lý để xác nhận nghĩa vụ theo Luật BVDLCN 2025 và Nghị định 356/2025, bắt đầu từ mốc L0.
3. Tìm 3–5 dòng họ đồng ý cung cấp gia phả thật làm dữ liệu mẫu (theo điều kiện L0) và tham gia beta.
4. Bố trí nhân sự, công cụ dự án; bắt đầu Giai đoạn 0.
5. Đăng ký tên miền (vd `giaphaonline.vn`).
