---
name: master-kinetic-ux-execution
overview: "Master plan hợp nhất để triển khai song song 2 hướng: Kinetic Editorial homepage rebuild và roadmap UX 10/10 toàn hệ thống."
todos:
  - id: stream-a-foundation-tokens
    content: Chuẩn hóa design tokens + typography Kinetic trên layout chính, đảm bảo tái sử dụng cho các trang khác
    status: pending
  - id: stream-a-homepage-rebuild
    content: Rebuild homepage theo visual Kinetic Editorial (hero, selected arenas, search strip, footer)
    status: pending
  - id: stream-b-funnel-optimization
    content: Tối ưu flow fields detail -> checkout -> confirmation để tăng completion rate
    status: pending
  - id: stream-b-mobile-a11y
    content: Hoàn thiện mobile navigation, keyboard accessibility, focus states và contrast
    status: pending
  - id: stream-c-trust-content
    content: Bổ sung trust pages, nội dung chính sách và nâng chất lượng thông tin sân
    status: pending
  - id: stream-c-performance
    content: Tối ưu perceived performance (ảnh, animation, loading, layout stability)
    status: pending
  - id: stream-d-measurement-abtest
    content: Thiết lập tracking baseline, A/B tests và vòng lặp tối ưu theo dữ liệu
    status: pending
isProject: false
---

# Master Plan: Kinetic + UX 10/10

## Mục tiêu hợp nhất
- Đưa sản phẩm lên chất lượng 10/10 cả về art direction lẫn hiệu quả chuyển đổi.
- Homepage trở thành “brand statement” theo Kinetic Editorial.
- Các trang còn lại đồng bộ token và được tối ưu UX thực dụng theo funnel.

## Phạm vi và file trọng tâm
- Homepage & layout:
  - [c:/Users/benja/Documents/Web-design-final/Web-design-final/views/home/index.ejs](c:/Users/benja/Documents/Web-design-final/Web-design-final/views/home/index.ejs)
  - [c:/Users/benja/Documents/Web-design-final/Web-design-final/views/layouts/main.ejs](c:/Users/benja/Documents/Web-design-final/Web-design-final/views/layouts/main.ejs)
- Funnel đặt sân:
  - [c:/Users/benja/Documents/Web-design-final/Web-design-final/views/fields/detail.ejs](c:/Users/benja/Documents/Web-design-final/Web-design-final/views/fields/detail.ejs)
  - [c:/Users/benja/Documents/Web-design-final/Web-design-final/views/bookings/checkout.ejs](c:/Users/benja/Documents/Web-design-final/Web-design-final/views/bookings/checkout.ejs)
  - [c:/Users/benja/Documents/Web-design-final/Web-design-final/views/bookings/confirmation.ejs](c:/Users/benja/Documents/Web-design-final/Web-design-final/views/bookings/confirmation.ejs)
  - [c:/Users/benja/Documents/Web-design-final/Web-design-final/public/js/timeslot.js](c:/Users/benja/Documents/Web-design-final/Web-design-final/public/js/timeslot.js)
- Đồng bộ toàn hệ:
  - [c:/Users/benja/Documents/Web-design-final/Web-design-final/views/layouts/admin.ejs](c:/Users/benja/Documents/Web-design-final/Web-design-final/views/layouts/admin.ejs)
  - [c:/Users/benja/Documents/Web-design-final/Web-design-final/views/layouts/owner.ejs](c:/Users/benja/Documents/Web-design-final/Web-design-final/views/layouts/owner.ejs)
  - [c:/Users/benja/Documents/Web-design-final/Web-design-final/views/auth/login.ejs](c:/Users/benja/Documents/Web-design-final/Web-design-final/views/auth/login.ejs)
  - [c:/Users/benja/Documents/Web-design-final/Web-design-final/views/auth/register.ejs](c:/Users/benja/Documents/Web-design-final/Web-design-final/views/auth/register.ejs)

## Workstream structure (build multiple song song)

### Stream A - Brand System & Homepage (Kinetic Editorial)
- Thiết lập token màu Kinetic (`primary`, `primary_container`, `secondary`, `background`, `surface_*`, `on_surface`).
- Áp typography system:
  - Inter Black Italic cho display/headline.
  - Inter Light cho body.
  - Space Grotesk uppercase cho label.
- Rebuild homepage theo composition mẫu:
  - Glass navigation pill.
  - Hero split headline + overlap imagery.
  - Selected arenas cards (no-line, hover lift + zoom).
  - Search strip rounded.
  - Footer `slate-950`.

### Stream B - Conversion Funnel UX
- Tối ưu `fields/detail`:
  - Giảm nhiễu, tăng rõ CTA chính.
  - Trạng thái slots nhất quán (loading/error/empty).
- Tối ưu `checkout` thành flow trực quan 2 bước.
- Tối ưu `confirmation/history` để tăng độ chắc chắn và minh bạch trạng thái.

### Stream C - Usability, Trust, Accessibility
- Hoàn thiện mobile navigation + active states + bỏ placeholder links.
- Chuẩn hóa focus ring, contrast, keyboard support (`aria`, `tabindex`, Enter/Space).
- Bổ sung trust content (điều khoản, bảo mật, liên hệ, chính sách đổi/hủy).

### Stream D - Metrics, Performance, Iteration
- Thiết lập baseline tracking:
  - Search submit, slot select, checkout enter, submit, confirmation view.
- Perceived performance pass:
  - Ảnh, animation, layout stability, skeleton/loading.
- A/B tests ưu tiên cho CTA và checkout copywriting.

## Nguyên tắc thiết kế bắt buộc
- Không dùng đường chia section bằng border 1px đặc.
- Ưu tiên cấu trúc bằng tonal layering + nesting.
- Glassmorphism chỉ áp dụng cho các phần tử floating trọng điểm.
- Shadow đậm chỉ dùng cho hover/floating; còn lại giữ ambient nhẹ.
- Transition cinematic trong dải `duration-300` đến `duration-700`.

## Lộ trình theo sprint
- Sprint 1: Stream A foundation + mobile nav nền tảng + baseline metrics.
- Sprint 2: Rebuild homepage hoàn chỉnh + funnel detail page improvements.
- Sprint 3: Checkout/confirmation optimization + accessibility pass.
- Sprint 4: Trust content + performance polish + A/B test iteration.

## Song song hóa công việc (multiple build lanes)
- Lane 1 (UI/Brand): Stream A.
- Lane 2 (Funnel/UX): Stream B.
- Lane 3 (Platform Quality): Stream C + phần performance của Stream D.
- Lane 4 (Data/Decision): tracking + dashboard + A/B test của Stream D.

## KPI chấp nhận
- Tăng completion funnel detail -> checkout -> confirmation từ 20% trở lên.
- Giảm drop-off checkout từ 25% trở lên.
- Mobile nav usability không còn điểm nghẽn chính.
- Accessibility baseline đạt chuẩn nội bộ (focus, keyboard, contrast).
- Visual homepage bám đúng Kinetic Editorial reference.
