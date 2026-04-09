/**
 * timeslot.js — Client-side quản lý Time Slots
 * 
 * Sử dụng trên trang chi tiết sân (fields/detail.ejs)
 * Chức năng:
 *   1. Fetch danh sách slot qua AJAX khi đổi ngày
 *   2. Render slot với trạng thái màu sắc (available/pending/booked)
 *   3. Xử lý chọn slot và hiển thị tóm tắt đặt sân
 */

(function () {
  'use strict';

  // ===============================
  // DOM Elements
  // ===============================
  const dateInput = document.getElementById('slot-date');
  const slotsGrid = document.getElementById('slots-grid');
  const bookingSummary = document.getElementById('booking-summary');
  const summaryDate = document.getElementById('summary-date');
  const summaryTime = document.getElementById('summary-time');
  const summaryPrice = document.getElementById('summary-price');
  const btnBook = document.getElementById('btn-book');

  // State
  let selectedSlot = null;

  // ===============================
  // Khi đổi ngày → fetch slots mới
  // ===============================
  if (dateInput) {
    dateInput.addEventListener('change', function () {
      const date = this.value;
      if (!date) return;

      // Reset trạng thái
      selectedSlot = null;
      updateSummary();
      fetchSlots(date);
    });
  }

  // ===============================
  // Fetch slots từ API
  // ===============================
  async function fetchSlots(date) {
    // Hiển thị loading
    slotsGrid.innerHTML = `
      <div class="slots-loading" style="grid-column: 1 / -1;">
        <i class="fas fa-spinner"></i>
        <p style="margin-top: 0.5rem;">Đang tải khung giờ...</p>
      </div>
    `;

    try {
      const response = await fetch(`/fields/${FIELD_ID}/slots?date=${date}`);
      const result = await response.json();

      if (result.success) {
        renderSlots(result.data);
      } else {
        slotsGrid.innerHTML = `
          <div class="slots-loading" style="grid-column: 1 / -1; color: #ef4444;">
            <i class="fas fa-exclamation-circle"></i>
            <p style="margin-top: 0.5rem;">${result.message}</p>
          </div>
        `;
      }
    } catch (error) {
      console.error('Fetch slots error:', error);
      slotsGrid.innerHTML = `
        <div class="slots-loading" style="grid-column: 1 / -1; color: #ef4444;">
          <i class="fas fa-exclamation-circle"></i>
          <p style="margin-top: 0.5rem;">Lỗi kết nối. Vui lòng thử lại!</p>
        </div>
      `;
    }
  }

  // ===============================
  // Render slots vào grid
  // ===============================
  function renderSlots(slots) {
    slotsGrid.innerHTML = '';

    if (!slots || slots.length === 0) {
      slotsGrid.innerHTML = `
        <div class="slots-loading" style="grid-column: 1 / -1;">
          <i class="fas fa-calendar-times"></i>
          <p style="margin-top: 0.5rem;">Không có khung giờ nào.</p>
        </div>
      `;
      return;
    }

    slots.forEach((slot) => {
      const div = document.createElement('div');
      div.className = `slot-item slot-${slot.status}`;
      div.dataset.slotId = slot._id;
      div.dataset.start = slot.startTime;
      div.dataset.end = slot.endTime;
      div.dataset.status = slot.status;

      const statusText =
        slot.status === 'available'
          ? 'Trống'
          : slot.status === 'pending'
          ? 'Đang giữ'
          : 'Đã đặt';

      div.innerHTML = `
        <span class="slot-time">${slot.startTime} - ${slot.endTime}</span>
        <span class="slot-status">${statusText}</span>
      `;

      // Chỉ cho phép click vào slot available
      if (slot.status === 'available') {
        div.addEventListener('click', () => handleSlotClick(div, slot));
      }

      slotsGrid.appendChild(div);
    });
  }

  // ===============================
  // Xử lý click chọn slot
  // ===============================
  function handleSlotClick(element, slot) {
    // Bỏ chọn tất cả
    document.querySelectorAll('.slot-item').forEach((el) => {
      el.classList.remove('selected');
    });

    // Chọn slot mới
    element.classList.add('selected');
    selectedSlot = slot;
    updateSummary();
  }

  // ===============================
  // Cập nhật tóm tắt booking
  // ===============================
  function updateSummary() {
    if (selectedSlot) {
      bookingSummary.classList.add('show');
      summaryDate.textContent = dateInput.value;
      summaryTime.textContent = `${selectedSlot.startTime} - ${selectedSlot.endTime}`;
      summaryPrice.textContent = FIELD_PRICE.toLocaleString('vi-VN') + 'đ';
      btnBook.disabled = false;
    } else {
      bookingSummary.classList.remove('show');
      summaryTime.textContent = '—';
      btnBook.disabled = true;
    }
  }

  // ===============================
  // Xử lý bấm "Tiếp tục đặt sân"
  // ===============================
  if (btnBook) {
    btnBook.addEventListener('click', function () {
      if (!selectedSlot) {
        alert('Vui lòng chọn một khung giờ!');
        return;
      }

      // Chuyển hướng sang trang checkout (sẽ xử lý ở milestone tiếp theo)
      // Tạm thời: chuyển đến trang checkout với params
      const params = new URLSearchParams({
        field: FIELD_ID,
        slot: selectedSlot._id,
        date: dateInput.value,
        start: selectedSlot.startTime,
        end: selectedSlot.endTime,
      });

      // Kiểm tra đăng nhập (nếu chưa → redirect đến login)
      window.location.href = `/checkout?${params.toString()}`;
    });
  }

  // ===============================
  // Gắn sự kiện cho các slot render từ server (trang load lần đầu)
  // ===============================
  function initExistingSlots() {
    const existingSlots = document.querySelectorAll('.slot-item.slot-available');
    existingSlots.forEach((el) => {
      el.addEventListener('click', () => {
        const slot = {
          _id: el.dataset.slotId,
          startTime: el.dataset.start,
          endTime: el.dataset.end,
          status: el.dataset.status,
        };
        handleSlotClick(el, slot);
      });
    });
  }

  // Init
  initExistingSlots();
})();
