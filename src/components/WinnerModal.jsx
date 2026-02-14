export default function WinnerModal({ winner, prices, playerNames, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-[#1C4D8D] via-[#4988C4] to-[#BDE8F5] rounded-3xl shadow-2xl p-8 w-full max-w-md text-center animate-bounce-in">
        <span className="text-7xl block mb-4">🏆</span>
        <h2 className="text-3xl font-bold text-white mb-2">{winner} ชนะแล้ว!</h2>
        <p className="text-[#BDE8F5] mb-6">สรุปผลการเล่น</p>

        <div className="bg-[#0F2854]/30 backdrop-blur rounded-2xl p-4 mb-6">
          <div className="grid grid-cols-4 gap-2 text-sm">
            {playerNames.map((name, i) => (
              <div key={i} className="text-center">
                <p className="font-semibold text-white truncate">{name}</p>
                <p className={`text-2xl font-bold ${prices[i] >= 0 ? 'text-white' : 'text-red-300'}`}>
                  {prices[i] > 0 ? '+' : ''}{prices[i]}
                </p>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="bg-white text-[#0F2854] font-semibold px-8 py-3 rounded-xl hover:bg-[#BDE8F5] transition-all shadow-lg cursor-pointer"
        >
          เล่นต่อ
        </button>
      </div>
    </div>
  );
}
