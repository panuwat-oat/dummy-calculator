import { useState } from 'react';

export default function PlayerSetup({ onStart, onHistory }) {
  const [names, setNames] = useState(() => {
    const saved = localStorage.getItem('lastPlayerNames');
    return saved ? JSON.parse(saved) : ['', '', '', ''];
  });

  const handleChange = (index, value) => {
    const updated = [...names];
    updated[index] = value;
    setNames(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (names.some((n) => n.trim() === '')) return;
    const trimmedNames = names.map((n) => n.trim());
    localStorage.setItem('lastPlayerNames', JSON.stringify(trimmedNames));
    onStart(trimmedNames);
  };

  const allFilled = names.every((n) => n.trim() !== '');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-lg border border-gray-100">
        <div className="text-center mb-8">
          <span className="text-6xl block mb-4">🃏</span>
          <h1 className="text-3xl font-bold text-[#0F2854]">เครื่องคิดเลข ดัมมี่</h1>
          <p className="text-[#4988C4] mt-2 text-sm">กรอกชื่อผู้เล่นทั้ง 4 คนเพื่อเริ่มเกม</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {names.map((name, i) => (
            <div key={i} className="relative">
              <label className="text-[#1C4D8D] text-sm font-medium mb-1 block">
                ผู้เล่นคนที่ {i + 1}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleChange(i, e.target.value)}
                placeholder={`ชื่อผู้เล่น ${i + 1}`}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[#0F2854] placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4988C4] focus:border-transparent transition-all"
                autoFocus={i === 0}
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={!allFilled}
            className={`w-full py-3 rounded-xl font-semibold text-lg transition-all mt-6 ${
              allFilled
                ? 'bg-[#1C4D8D] text-white hover:bg-[#0F2854] shadow-lg hover:shadow-[#1C4D8D]/30 cursor-pointer'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            }`}
          >
            🎮 เริ่มเกม
          </button>
        </form>
        <div className="text-center mt-4">
          <button
            onClick={onHistory}
            className="text-[#4988C4] hover:text-[#0F2854] text-sm transition-all cursor-pointer"
          >
            🏆 ดูประวัติเกม
          </button>
        </div>
      </div>
    </div>
  );
}
