import { useState } from 'react';

export default function PlayerSetup({ onStart }) {
  const [names, setNames] = useState(['', '', '', '']);

  const handleChange = (index, value) => {
    const updated = [...names];
    updated[index] = value;
    setNames(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (names.some((n) => n.trim() === '')) return;
    onStart(names.map((n) => n.trim()));
  };

  const allFilled = names.every((n) => n.trim() !== '');

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-fuchsia-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 w-full max-w-lg border border-white/20">
        <div className="text-center mb-8">
          <span className="text-6xl block mb-4">🃏</span>
          <h1 className="text-3xl font-bold text-white">เครื่องคิดเลข ดัมมี่</h1>
          <p className="text-purple-200 mt-2 text-sm">กรอกชื่อผู้เล่นทั้ง 4 คนเพื่อเริ่มเกม</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {names.map((name, i) => (
            <div key={i} className="relative">
              <label className="text-purple-200 text-sm font-medium mb-1 block">
                ผู้เล่นคนที่ {i + 1}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleChange(i, e.target.value)}
                placeholder={`ชื่อผู้เล่น ${i + 1}`}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-fuchsia-400 focus:border-transparent transition-all"
                autoFocus={i === 0}
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={!allFilled}
            className={`w-full py-3 rounded-xl font-semibold text-lg transition-all mt-6 ${
              allFilled
                ? 'bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white hover:from-fuchsia-600 hover:to-purple-700 shadow-lg hover:shadow-fuchsia-500/30 cursor-pointer'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            🎮 เริ่มเกม
          </button>
        </form>
      </div>
    </div>
  );
}
