export default function WinnerModal({ winner, prices, playerNames, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 rounded-3xl shadow-2xl p-8 w-full max-w-md text-center animate-bounce-in">
        <span className="text-7xl block mb-4">🏆</span>
        <h2 className="text-3xl font-bold text-white mb-2">{winner} ชนะแล้ว!</h2>
        <p className="text-amber-100 mb-6">สรุปผลการเล่น</p>

        <div className="bg-white/20 backdrop-blur rounded-2xl p-4 mb-6">
          <div className="grid grid-cols-4 gap-2 text-sm">
            {playerNames.map((name, i) => (
              <div key={i} className="text-center">
                <p className="font-semibold text-white truncate">{name}</p>
                <p className={`text-2xl font-bold ${prices[i] >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                  {prices[i] > 0 ? '+' : ''}{prices[i]}
                </p>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="bg-white text-amber-600 font-semibold px-8 py-3 rounded-xl hover:bg-amber-50 transition-all shadow-lg cursor-pointer"
        >
          เล่นต่อ
        </button>
      </div>
    </div>
  );
}
