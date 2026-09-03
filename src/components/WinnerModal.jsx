import { useEffect } from 'react';
import confetti from 'canvas-confetti';

export default function WinnerModal({ winner, prices, playerNames, unitRate, onClose }) {
  useEffect(() => {
    // Trigger confetti
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#1C4D8D', '#4988C4', '#BDE8F5', '#FFD700']
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#1C4D8D', '#4988C4', '#BDE8F5', '#FFD700']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-8 w-full max-w-md text-center animate-bounce-in">
        <span className="text-6xl sm:text-7xl block mb-2 sm:mb-4">🏆</span>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#0F2854] mb-1 sm:mb-2">{winner} ชนะแล้ว!</h2>
        <p className="text-[#4988C4] text-base mb-4 sm:mb-6">สรุปผลการเล่น</p>

        <div className="bg-[#BDE8F5]/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {playerNames.map((name, i) => (
              <div key={i} className="text-center">
                <p className="font-semibold text-[#4988C4] truncate text-sm sm:text-base">{name}</p>
                <p className={`text-2xl sm:text-3xl font-bold ${prices[i] >= 0 ? 'text-[#1C4D8D]' : 'text-red-500'}`}>
                  {prices[i] > 0 ? '+' : ''}{prices[i] * unitRate}
                  <span className="text-base sm:text-lg">฿</span>
                </p>
                <p className="text-sm text-[#4988C4]">
                  {prices[i] > 0 ? '+' : ''}{prices[i]} หน่วย
                </p>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="bg-[#1C4D8D] text-white font-semibold px-8 py-3 sm:py-3.5 rounded-xl hover:bg-[#0F2854] transition-all shadow-lg cursor-pointer text-base sm:text-lg"
        >
          เล่นต่อ
        </button>
      </div>
    </div>
  );
}
