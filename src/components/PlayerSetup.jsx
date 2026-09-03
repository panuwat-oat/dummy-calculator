import { useState, useEffect } from 'react';
import { getLastPlayerNames, saveLastPlayerNames } from '../services/db';
import { loginWithGoogle, logout, subscribeToAuth } from '../services/auth';
import HelpModal from './HelpModal';

export default function PlayerSetup({ onStart, onHistory }) {
  const [names, setNames] = useState(['', '', '', '']);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((u) => {
      setUser(u);
      if (u && names[0] === '') {
        const newNames = [...names];
        newNames[0] = u.displayName || '';
        setNames(newNames);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadNames = async () => {
      const local = localStorage.getItem('lastPlayerNames');
      if (local) {
        setNames(JSON.parse(local));
      }
      
      const cloudNames = await getLastPlayerNames();
      if (cloudNames) {
        setNames(cloudNames);
        localStorage.setItem('lastPlayerNames', JSON.stringify(cloudNames));
      }
    };
    loadNames();
  }, [user]);

  const handleChange = (index, value) => {
    const updated = [...names];
    updated[index] = value;
    setNames(updated);
  };

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (e) {
      setError('เข้าสู่ระบบไม่สำเร็จ');
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  const handleStartGame = async (e) => {
    e.preventDefault();
    setError('');
    
    if (names.some((n) => n.trim() === '')) {
      setError('กรุณากรอกชื่อให้ครบ 4 คน');
      return;
    }
    
    setLoading(true);
    const trimmedNames = names.map((n) => n.trim());
    localStorage.setItem('lastPlayerNames', JSON.stringify(trimmedNames));
    saveLastPlayerNames(trimmedNames);

    onStart(trimmedNames);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-3 py-4 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl p-5 sm:p-8 w-full max-w-lg border border-gray-100">
        <div className="text-center mb-4 sm:mb-6">
          <span className="text-4xl sm:text-6xl block mb-2 sm:mb-4">🃏</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F2854]">เครื่องคิดเลข ดัมมี่</h1>
          
          {user ? (
            <div className="mt-3 sm:mt-4 flex items-center justify-center gap-2">
              <img src={user.photoURL} alt="Profile" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full" />
              <span className="text-[#1C4D8D] font-medium text-base">{user.displayName}</span>
              <button onClick={handleLogout} className="text-sm text-red-400 hover:text-red-600 underline cursor-pointer">ออกจากระบบ</button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="mt-3 sm:mt-4 px-3 py-1.5 sm:px-4 sm:py-2 bg-white border border-gray-300 rounded-full text-gray-700 text-sm sm:text-base font-medium hover:bg-gray-50 flex items-center justify-center gap-2 mx-auto cursor-pointer"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              เข้าสู่ระบบด้วย Google
            </button>
          )}
        </div>

        <form onSubmit={handleStartGame} className="space-y-3 sm:space-y-4">
          <p className="text-[#4988C4] text-base text-center mb-1 sm:mb-2">
            กรอกชื่อผู้เล่นทั้ง 4 คน
          </p>
          {names.map((name, i) => (
            <div key={i} className="relative">
              <label className="text-[#1C4D8D] text-sm sm:text-base font-medium mb-1 block">
                ผู้เล่นคนที่ {i + 1} {i === 0 && user && '(คุณ)'}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleChange(i, e.target.value)}
                placeholder={`ชื่อผู้เล่น ${i + 1}`}
                className="w-full px-4 h-14 rounded-xl bg-gray-50 border border-gray-200 text-[#0F2854] text-base sm:text-lg placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4988C4] focus:border-transparent transition-all"
                autoFocus={i === 0}
              />
            </div>
          ))}

          {error && <p className="text-red-500 text-base text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`w-full h-14 rounded-xl font-semibold text-lg transition-all mt-4 sm:mt-6 cursor-pointer ${
              loading ? 'bg-gray-300 text-gray-500' : 'bg-[#1C4D8D] text-white hover:bg-[#0F2854] shadow-lg hover:shadow-[#1C4D8D]/30'
            }`}
          >
            {loading ? 'กำลังโหลด...' : '🎮 เริ่มเกม'}
          </button>
        </form>
        
        <div className="text-center mt-3 sm:mt-4 flex justify-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onHistory}
            className="text-[#4988C4] hover:text-[#0F2854] text-base transition-all cursor-pointer"
          >
            🏆 ดูประวัติเกม
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="text-[#4988C4] hover:text-[#0F2854] text-base transition-all cursor-pointer"
          >
            ❓ วิธีใช้งาน
          </button>
        </div>
      </div>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
