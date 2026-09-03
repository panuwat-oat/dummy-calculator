import { useState, useEffect } from 'react';
import { getGameHistory, clearGameHistory } from '../services/db';
import { subscribeToAuth } from '../services/auth';

export default function GameHistory({ onBack }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Listen for auth changes to ensure we fetch the right history
    const unsubscribe = subscribeToAuth((u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      // getGameHistory inside db.js checks auth.currentUser directly, 
      // but triggering this effect on 'user' change ensures we wait/retry 
      // when auth state settles.
      const data = await getGameHistory();
      setHistory(data);
      setLoading(false);
    };
    loadHistory();
  }, [user]); // Reload when user changes (login/logout/initial load)

  const handleClear = async () => {
    if (!window.confirm('ลบประวัติเกมทั้งหมด?')) return;
    await clearGameHistory();
    setHistory([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-[#0F2854] font-medium animate-pulse">กำลังโหลดข้อมูล...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-2 pt-1 pb-4 sm:px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center pt-2 pb-2 sm:pt-4 sm:pb-6">
          <h1 className="text-xl sm:text-3xl font-bold text-[#0F2854]">
            🏆 ประวัติเกม
          </h1>
        </div>

        {history.length === 0 ? (
          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-lg p-6 sm:p-8 text-center">
            <p className="text-gray-400 text-base sm:text-lg">ยังไม่มีประวัติเกม</p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {history.slice().reverse().map((game, i) => (
              <div key={i} className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-lg p-3 sm:p-5">
                <div className="flex justify-between items-center mb-2 sm:mb-3">
                  <span className="text-sm text-gray-400">
                    {new Date(game.date).toLocaleDateString('th-TH', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <span className="text-sm font-medium text-[#4988C4]">
                    {game.rounds} รอบ
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  {game.players.map((player, j) => (
                    <div key={j}>
                      <p className={`text-sm sm:text-base font-medium truncate mb-0.5 sm:mb-1 ${player.name === game.winner ? 'text-[#1C4D8D]' : 'text-[#4988C4]'}`}>
                        {player.name === game.winner ? '👑 ' : ''}{player.name}
                      </p>
                      <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${player.score > 0 ? 'text-[#1C4D8D]' : player.score < 0 ? 'text-red-500' : 'text-gray-300'}`}>
                        {player.score}
                      </p>
                      <p className={`text-sm sm:text-base font-semibold ${player.settlement >= 0 ? 'text-[#4988C4]' : 'text-red-400'}`}>
                        {player.settlement > 0 ? '+' : ''}{player.settlement}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-4 pb-6 sm:mt-6 sm:pb-8 flex justify-center gap-3 sm:gap-4">
          <button
            onClick={onBack}
            className="text-[#4988C4] hover:text-[#0F2854] text-base transition-all cursor-pointer"
          >
            ← กลับ
          </button>
          {history.length > 0 && (
            <button
              onClick={handleClear}
              className="text-red-400 hover:text-red-600 text-base transition-all cursor-pointer"
            >
              ลบประวัติทั้งหมด
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
