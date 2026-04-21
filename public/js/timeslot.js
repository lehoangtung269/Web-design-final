/**
 * timeslot.js — Client-side quản lý Time Slots
 * 
 * Sử dụng trên trang chi tiết sân (fields/detail.ejs)
 * Chức năng:
 *   1. Fetch danh sách slot qua AJAX khi đổi ngày
 *   2. Render slot với trạng thái (available/pending/booked) dùng Tailwind classes
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
  // Tailwind class presets
  // ===============================
  const SLOT_CLASSES = {
    base: 'slot-item',
    available: 'available',
    selected: 'selected-slot slot-pop',
    pending: 'pending',
    booked: 'booked',
  };

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
    slotsGrid.innerHTML = `
      <div class="col-span-2 text-center py-8 text-slate-400">
        <span class="material-symbols-outlined text-3xl animate-spin block mb-2">progress_activity</span>
        <p class="text-sm">Đang tải khung giờ...</p>
      </div>
    `;

    try {
      const response = await fetch(`/fields/${FIELD_ID}/slots?date=${date}`);
      const result = await response.json();

      if (result.success) {
        renderSlots(result.data);
      } else {
        slotsGrid.innerHTML = `
          <div class="col-span-2 text-center py-8 text-red-500">
            <span class="material-symbols-outlined text-3xl block mb-2">error</span>
            <p class="text-sm">${result.message}</p>
          </div>
        `;
      }
    } catch (error) {
      console.error('Fetch slots error:', error);
      slotsGrid.innerHTML = `
        <div class="col-span-2 text-center py-8 text-red-500">
          <span class="material-symbols-outlined text-3xl block mb-2">wifi_off</span>
          <p class="text-sm">Lỗi kết nối. Vui lòng thử lại!</p>
        </div>
      `;
    }
  }

  // ===============================
  // Render slots vào grid
  // ===============================
  function renderSlots(slots) {
    slotsGrid.innerHTML = '';
    const availableCountEl = document.getElementById('slot-available-count');
    if (availableCountEl) {
      const availableCount = (slots || []).filter((s) => s.status === 'available').length;
      availableCountEl.textContent = String(availableCount);
    }

    if (!slots || slots.length === 0) {
      slotsGrid.innerHTML = `
        <div class="col-span-2 text-center py-8 text-slate-400">
          <span class="material-symbols-outlined text-3xl block mb-2">event_busy</span>
          <p class="text-sm">Không có khung giờ nào.</p>
        </div>
      `;
      return;
    }

    slots.forEach((slot) => {
      const div = document.createElement('div');
      div.className = `${SLOT_CLASSES.base} ${SLOT_CLASSES[slot.status] || SLOT_CLASSES.booked}`;
      div.dataset.slotId = slot._id;
      div.dataset.start = slot.startTime;
      div.dataset.end = slot.endTime;
      div.dataset.status = slot.status;
      div.setAttribute('role', 'button');
      div.setAttribute('tabindex', slot.status === 'available' ? '0' : '-1');
      div.setAttribute('aria-label', `Khung gio ${slot.startTime} den ${slot.endTime}, trang thai ${slot.status}`);

      const statusText =
        slot.status === 'available'
          ? '✓ Trống'
          : slot.status === 'pending'
          ? '⏳ Đang giữ'
          : '✗ Đã đặt';

      div.innerHTML = `
        <span class="block text-xs font-bold">${slot.startTime} - ${slot.endTime}</span>
        <span class="slot-status-badge">${statusText}</span>
      `;

      // Chỉ cho phép click vào slot available
      if (slot.status === 'available') {
        div.addEventListener('click', () => handleSlotClick(div, slot));
        div.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSlotClick(div, slot);
          }
        });
      }

      slotsGrid.appendChild(div);
    });
  }

  // ===============================
  // Xử lý click chọn slot
  // ===============================
  function handleSlotClick(element, slot) {
    // Bỏ chọn tất cả — reset về available state
    document.querySelectorAll('.slot-item').forEach((el) => {
      if (el.dataset.status === 'available') {
        el.className = 'slot-item available';
      }
    });

    // Chọn slot mới
    element.className = 'slot-item selected-slot slot-pop';
    selectedSlot = slot;
    updateSummary();
    if (window.DatSanAnalytics) {
      window.DatSanAnalytics.track('slot_select', {
        fieldId: FIELD_ID,
        slotId: slot._id,
        start: slot.startTime,
        end: slot.endTime,
      });
    }
  }

  // ===============================
  // Cập nhật tóm tắt booking
  // ===============================
  function updateSummary() {
    if (selectedSlot) {
      bookingSummary.classList.remove('hidden');
      bookingSummary.classList.add('visible');
      summaryDate.textContent = dateInput.value;
      summaryTime.textContent = `${selectedSlot.startTime} - ${selectedSlot.endTime}`;
      summaryPrice.textContent = FIELD_PRICE.toLocaleString('vi-VN') + 'đ';
      btnBook.disabled = false;
      // Scroll to summary
      bookingSummary.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      bookingSummary.classList.add('hidden');
      bookingSummary.classList.remove('visible');
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

      const params = new URLSearchParams({
        field: FIELD_ID,
        slot: selectedSlot._id,
        date: dateInput.value,
        start: selectedSlot.startTime,
        end: selectedSlot.endTime,
      });
      if (window.DatSanAnalytics) {
        window.DatSanAnalytics.track('checkout_enter', {
          fieldId: FIELD_ID,
          slotId: selectedSlot._id,
          date: dateInput.value,
        });
      }
      window.location.href = `/checkout?${params.toString()}`;
    });
  }

  // ===============================
  // Gắn sự kiện cho các slot render từ server (trang load lần đầu)
  // ===============================
  function initExistingSlots() {
    const existingSlots = document.querySelectorAll('.slot-item');
    existingSlots.forEach((el) => {
      if (el.dataset.status === 'available') {
        el.addEventListener('click', () => {
          const slot = {
            _id: el.dataset.slotId,
            startTime: el.dataset.start,
            endTime: el.dataset.end,
            status: el.dataset.status,
          };
          handleSlotClick(el, slot);
        });
      }
    });
  }

  // Init
  initExistingSlots();
})();
