# BurgerPrints CRM Dashboard - Handover Backup (2026-05-28)

## 1) Mục tiêu project
- Dashboard/CRM cho BurgerPrints ngành POD fulfillment.
- Dữ liệu chính từ Google Sheet CRM qua Apps Script `/exec` hoặc CSV publish.
- Có thể chạy offline bằng dữ liệu mẫu trong file HTML.

## 2) File quan trọng
- `burgerprints-crm-lifecycle-dashboard.html` (dashboard chính + logic JS frontend)
- `burgerprints_crm_sync_v2.gs` (Google Apps Script sync dữ liệu)
- `burgerprints-crm-customer-dashboard.html` (dashboard khách hàng phụ)
- `CRM_RAW_TEMPLATE.csv` (mẫu dữ liệu)
- `SETUP_CRM_V2.md` (hướng dẫn setup)

## 3) Những thay đổi đã làm xong

### A. Fix runtime/sync
- Đã fix check kết quả sync stage từ Apps Script:
  - Không báo thành công giả.
  - Hiển thị đúng trạng thái khi sync lỗi/thành công.
- Đã thêm xử lý nhận response raw từ JSONP khi cần.

### B. Cột Stage
- Stage trong bảng tổng hợp là dropdown.
- Có màu theo từng stage.
- Có sync ngược lên Apps Script khi đổi stage.

### C. Cột "Status từ Sales"
- Đã thêm cột `Status từ Sales` vào bảng khách hàng tổng hợp.
- Đã làm dropdown để sửa tay.
- Có màu theo từng status.
- Có sync ngược lên Apps Script khi đổi status.

### D. Funnel
- Đã thêm hiển thị status theo từng stage trong khu funnel.
- Sau khi thử UI funnel mới, đã rollback về style funnel cũ theo yêu cầu.

### E. Cột "Đơn đã Paid (USD)" + CAC/ROAS/LTV
- Đã thêm cột nhập tay `Đơn đã Paid (USD)`.
- Khi đổi giá trị paid:
  - Recalc local cho CAC/ROAS/LTV theo logic hiện có.
  - Sync lên Apps Script.
- Đã chuẩn hóa format tiền theo kiểu `$number` (ví dụ `$150`), không dùng `US$`.

### F. Fix lỗi tiếng Việt bị vỡ
- Đã sửa lỗi mã hóa (mojibake) trong `burgerprints-crm-lifecycle-dashboard.html`.
- UI tiếng Việt đã đọc đúng lại.
- Có backup trước bước fix encoding:
  - `burgerprints-crm-lifecycle-dashboard.before-encoding-fix.bak`

## 4) Các action đã thêm trong Apps Script
Trong file `burgerprints_crm_sync_v2.gs`, đã có xử lý:
- `action=updateStage`
- `action=updateSalesStatus`
- `action=updatePaidValue`

Các update theo `customerKey` và ghi về sheet CRM tương ứng.

## 5) Trạng thái hiện tại (để mở máy mới làm tiếp)
- Dashboard mở local chạy được.
- Offline: dùng dữ liệu mẫu local.
- Online:
  - Nếu điền đúng Apps Script `/exec` thì load/sync được.
  - Nếu không có mạng hoặc URL sai thì chỉ chạy local.

## 6) Cách test nhanh sau khi chuyển máy
1. Mở file `burgerprints-crm-lifecycle-dashboard.html`.
2. `Ctrl+F5` để clear cache.
3. Kiểm tra text tiếng Việt đã đúng.
4. Đổi 1 Stage trong bảng:
   - Màu dropdown đổi đúng.
   - Status dưới cùng báo sync.
5. Đổi 1 `Status từ Sales`:
   - Dropdown màu đúng.
   - Sync status hoạt động.
6. Nhập `Đơn đã Paid (USD)`:
   - CAC/ROAS/LTV cập nhật local.
   - Có thông báo sync.

## 7) Gợi ý chuyển máy an toàn
- Copy toàn bộ folder:
  - `C:\Users\Admin\Documents\New project\pod-crm-web`
- Bao gồm luôn file backup này để tiếp tục đúng trạng thái.

## 8) Ghi chú quan trọng
- Không xóa file cũ.
- Không refactor lớn nếu chưa yêu cầu.
- Chỉ sửa từng bước nhỏ.
- Ưu tiên giữ ngữ cảnh tiếng Việt/BurgerPrints/POD.
