---
name: kinetic-home-rebuild-plan
overview: Kế hoạch tái thiết kế homepage theo phong cách Kinetic Editorial, đồng thời tạo nền design tokens để các trang khác có thể mở rộng nhất quán sau đó.
todos:
  - id: define-kinetic-tokens
    content: Chuẩn hóa màu, blur, glow, shadow, transition tokens trong layout chính
    status: pending
  - id: setup-typography-lockup
    content: Thiết lập Inter + Space Grotesk và class cho display/headline/body/label
    status: pending
  - id: rebuild-home-hero
    content: Xây hero mới với glass nav pill, headline kinetic, CTA và imagery overlap
    status: pending
  - id: rebuild-selected-arenas
    content: Xây section cards theo no-line rule và hover motion cinematic
    status: pending
  - id: rebuild-search-strip-footer
    content: Tạo search strip và footer slate-950 theo guideline
    status: pending
  - id: validate-funnel-compatibility
    content: Kiểm tra link/CTA homepage sang fields/detail/checkout không bị đứt
    status: pending
  - id: responsive-a11y-polish
    content: QA responsive, focus states, contrast và tối ưu motion trên mobile
    status: pending
isProject: false
---

# Kinetic Editorial Homepage Rebuild Plan

## Mục tiêu

- Rebuild trang chủ theo hướng art direction giống mẫu bạn gửi: editorial, kinetic, sang trọng, nhiều khoảng thở, typography nghiêng mạnh.
- Áp dụng đầy đủ nguyên tắc bạn đưa ra: no-line rule, glass/gradient rule, tonal layering, cinematic transitions.
- Thiết lập design tokens để homepage mới không bị hardcode rời rạc và có thể tái dùng cho các trang sau.

## Phạm vi triển khai

- Trong đợt này chỉ tập trung vào:
  - [c:/Users/benja/Documents/Web-design-final/Web-design-final/views/home/index.ejs](c:/Users/benja/Documents/Web-design-final/Web-design-final/views/home/index.ejs)
  - [c:/Users/benja/Documents/Web-design-final/Web-design-final/views/layouts/main.ejs](c:/Users/benja/Documents/Web-design-final/Web-design-final/views/layouts/main.ejs)
  - [c:/Users/benja/Documents/Web-design-final/Web-design-final/public/js/timeslot.js](c:/Users/benja/Documents/Web-design-final/Web-design-final/public/js/timeslot.js) (chỉ đảm bảo tương thích CTA/funnel từ homepage)
- Không đổi logic backend trong giai đoạn này.

## Kiến trúc UI mới cho Homepage

### 1) Global Token Layer (ưu tiên làm trước)

- Chuẩn hóa màu trong `tailwind.config` inline ở layout chính theo hệ token mới:
  - `primary` `#6a37d3`
  - `primary_container` `#ae8dff`
  - `secondary` `#00675c`
  - `background` `#f4f6ff`
  - `surface_container_low` `#ebf1ff`
  - `surface_container` `#dde9ff`
  - `surface_container_lowest` `#ffffff`
  - `on_surface` `#0b1c30`
  - `outline_variant` dùng opacity low cho ghost borders
- Thêm utility class cho:
  - Glass nav (`backdrop-blur >= 12px`, nền bán trong suốt)
  - Signature CTA glow
  - Ambient shadow low opacity
  - Transition cinematic `duration-300 -> duration-700`

### 2) Typography System

- Cập nhật font stack trong layout:
  - Inter cho display/headline/body
  - Space Grotesk cho labels kỹ thuật
- Thiết lập style class:
  - display/headline: Inter Black Italic + tracking âm
  - body: Inter Light (300)
  - label: Space Grotesk uppercase tracking rộng
- Áp dụng signature lockup cho section headers:
  - label-sm phía trên
  - headline-md italic phía dưới

### 3) Homepage Composition (theo mẫu)

- Hero mới gồm:
  - Floating navigation pill (glassmorphism)
  - Headline split 2 dòng (kinetic typography)
  - Một CTA chính rõ (`Explore Venues` / `Khám phá sân`)
  - Hình sân dạng overlap phá grid để tạo depth
- Section “Selected Arenas”:
  - Container tonal (`surface_container_low`)
  - Card trắng (`surface_container_lowest`) + image lớn
  - Hover card `-translate-y-2` + image `scale-110`
  - Metadata dùng nhãn + khoảng trắng, không dùng divider lines
- Search strip cuối trang:
  - Input dạng rounded-full trên nền sáng
  - CTA mũi tên dạng pill tím
  - Focus state ghost border sang `primary` 50% opacity
- Footer rework:
  - Dùng `slate-950` để neo toàn trang theo đúng guideline
  - Link/brand theo editorial minimal style

## Nguyên tắc bắt buộc trong implementation

- Không dùng đường viền 1px đặc để chia section.
- Ưu tiên phân tầng bằng background shift + nesting.
- Chỉ dùng shadow đậm cho trạng thái floating/hover quan trọng.
- Tránh pure black text; dùng `on_surface`.
- Giữ khoảng trắng lớn (nhất là giữa hero -> section cards -> search strip).

## Tương thích funnel đặt sân

- Giữ liên kết từ homepage đến:
  - `/fields`
  - `/fields/:id`
- Đảm bảo CTA mới không làm đứt flow hiện tại sang detail/checkout.

## QA Checklist

- Responsive: 375, 768, 1024, 1440.
- Visual parity với mẫu: nav pill, headline energy, card hover, footer anchor.
- Accessibility cơ bản:
  - Contrast đạt mức dùng được
  - Focus ring rõ cho link/button/input
  - Alt text ảnh meaningful
- Performance:
  - Hero images dùng kích thước hợp lý
  - Tránh animation dày đặc trên mobile

## Kế hoạch triển khai theo bước

- B1: Refactor tokens + typography ở layout chính.
- B2: Rebuild toàn bộ homepage sections theo composition mới.
- B3: Tinh chỉnh motion, overlap, spacing để ra đúng chất Kinetic Editorial.
- B4: QA responsive + accessibility + funnel navigation.
- B5: Polish cuối cùng theo screenshot reference.

## Deliverables

- Homepage mới đúng art direction Kinetic Editorial.
- Bộ token màu/chữ/elevation có thể tái dùng.
- Checklist QA hoàn thành cho desktop + mobile.
