const TimeSlot = require('../models/TimeSlot');

/**
 * Dọn dẹp slot bị kẹt trạng thái "pending" quá 15 phút.
 * Chạy định kỳ mỗi 5 phút từ app.js.
 *
 * Khi user đóng tab hoặc mạng bị ngắt sau khi slot chuyển pending,
 * slot sẽ không bao giờ trở về available nếu không có cơ chế cleanup.
 */
const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 phút
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 phút

async function cleanupStalePendingSlots() {
    try {
        const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

        const result = await TimeSlot.updateMany(
            {
                status: 'pending',
                updatedAt: { $lt: cutoff },
            },
            {
                $set: {
                    status: 'available',
                    bookedBy: null,
                },
            }
        );

        if (result.modifiedCount > 0) {
            console.log(`🧹 Cleanup: Đã nhả ${result.modifiedCount} slot pending bị kẹt.`);
        }
    } catch (error) {
        console.error('❌ Cleanup Pending Slots Error:', error);
    }
}

/**
 * Khởi động interval dọn dẹp.
 * Gọi hàm này một lần từ app.js sau khi kết nối DB.
 */
function startCleanupInterval() {
    // Chạy lần đầu ngay khi server start
    cleanupStalePendingSlots();

    // Sau đó chạy mỗi 5 phút
    setInterval(cleanupStalePendingSlots, CLEANUP_INTERVAL_MS);
    console.log('✅ Cleanup scheduler: Chạy mỗi 5 phút, xóa slot pending > 15 phút.');
}

module.exports = { startCleanupInterval, cleanupStalePendingSlots };
