import { useEffect } from 'react';

export default function HelpModal({ onClose }) {
  // Prevent scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-bounce-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#0F2854] p-5 text-white flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            📚 วิธีใช้งาน
          </h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none cursor-pointer">
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-[#0F2854]">
          
          {/* Modes */}
          <section>
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-[#1C4D8D]">
              🎮 โหมดการเล่น
            </h3>
            <div className="space-y-3">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <p className="font-semibold text-sm mb-1">👤 เล่นคนเดียว (Single Player)</p>
                <p className="text-sm text-gray-500">
                  เล่นบนเครื่องเดียว กรอกคะแนนให้เพื่อนๆ ทุกคน เหมาะสำหรับส่งมือถือวนกันดู
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <p className="font-semibold text-sm mb-1">🏠 สร้างห้อง (Create Room)</p>
                <p className="text-sm text-gray-500">
                  คุณเป็นเจ้าของห้อง ได้รหัส 6 หลัก ส่งให้เพื่อน อีก 3 คน เพื่อเข้ามาจอยห้องเดียวกัน คะแนนจะขึ้นพร้อมกันทุกเครื่อง
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <p className="font-semibold text-sm mb-1">🚀 แจมห้อง (Join Room)</p>
                <p className="text-sm text-gray-500">
                  กรอกรหัสห้องที่เพื่อนส่งมา เพื่อเข้าไปดูและช่วยกรอกคะแนนในห้องนั้น
                </p>
              </div>
            </div>
          </section>

          {/* Scoring */}
          <section>
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-[#1C4D8D]">
              🧮 การคิดคะแนน
            </h3>
            <ul className="list-disc list-outside ml-5 space-y-1 text-sm text-gray-600">
              <li>กรอกคะแนนดิบที่ได้ในแต่ละรอบ (เช่น 120, -50)</li>
              <li>ระบบจะบวกคะแนนสะสมให้อัตโนมัติ</li>
              <li>เมื่อมีคนแต้มถึง <span className="font-bold text-[#1C4D8D]">500</span> เกมจะจบทันที</li>
              <li>
                ระบบจะคำนวณ <strong>ค่าตอง</strong> และ <strong>ค่าจ่าย</strong> ให้อัตโนมัติตามกติกามาตรฐาน
                (ทุก 100 แต้ม = 1 หน่วย, เศษเกิน 55 ปัดขึ้น)
              </li>
            </ul>
          </section>

          {/* Tips */}
          <section>
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-[#1C4D8D]">
              💡 ทริคการใช้งาน
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex gap-2">
                <span>📝</span>
                <span>กดที่ชื่อผู้เล่นเพื่อ <strong>แก้ไขชื่อ</strong> ได้ตลอดเวลา</span>
              </li>
              <li className="flex gap-2">
                <span>✏️</span>
                <span>กดที่แถวประวัติคะแนนเพื่อ <strong>แก้ไขคะแนนย้อนหลัง</strong></span>
              </li>
              <li className="flex gap-2">
                <span>↩️</span>
                <span>ปุ่ม <strong>Undo</strong> ใช้ย้อนกลับเมื่อกรอกผิดในรอบล่าสุด</span>
              </li>
            </ul>
          </section>

        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 text-center border-t border-gray-100">
          <button 
            onClick={onClose}
            className="w-full py-2 bg-[#1C4D8D] text-white rounded-xl font-semibold hover:bg-[#0F2854] transition-all cursor-pointer"
          >
            เข้าใจแล้ว
          </button>
        </div>
      </div>
    </div>
  );
}
