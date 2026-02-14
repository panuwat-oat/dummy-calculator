import { useState, useEffect } from 'react';
import { getLastPlayerNames, saveLastPlayerNames, createRoom, checkRoomExists, joinRoom } from '../services/db';
import { loginWithGoogle, logout, subscribeToAuth } from '../services/auth';
import HelpModal from './HelpModal';

export default function PlayerSetup({ onStart, onHistory }) {
  const [names, setNames] = useState(['', '', '', '']);
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('single'); // 'single', 'create', 'join'
  const [joinRoomId, setJoinRoomId] = useState('');
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
    
    if (mode === 'join') {
      if (!joinRoomId.trim()) {
        setError('กรุณากรอกรหัสห้อง');
        return;
      }
      if (!names[0].trim()) {
        setError('กรุณากรอกชื่อของคุณ (ผู้เล่น 1)');
        return;
      }
      setLoading(true);
      const exists = await checkRoomExists(joinRoomId);
      if (!exists) {
        setError('ไม่พบห้องนี้');
        setLoading(false);
        return;
      }
      // For joining, we might only need the first name as "Me"
      // But preserving the array format for consistency
      const myName = names[0].trim();
      const updatedNames = await joinRoom(joinRoomId, myName); 
      
      // We pass the room ID to onStart
      onStart(updatedNames, joinRoomId);
      setLoading(false);
      return;
    }

    // Single Player Mode - Require all 4 names
    if (mode === 'single') {
      if (names.some((n) => n.trim() === '')) {
        setError('กรุณากรอกชื่อให้ครบ 4 คน');
        return;
      }
    }

    // Create Room Mode - Require only Host name (Player 1)
    if (mode === 'create') {
      if (!names[0].trim()) {
        setError('กรุณากรอกชื่อของคุณ (ผู้เล่น 1)');
        return;
      }
    }
    
    setLoading(true);
    const trimmedNames = names.map((n) => n.trim());
    localStorage.setItem('lastPlayerNames', JSON.stringify(trimmedNames));
    saveLastPlayerNames(trimmedNames);

    let roomId = null;
    if (mode === 'create') {
      try {
        roomId = await createRoom(trimmedNames);
      } catch (e) {
        console.error(e);
        if (e.message === 'Connection timeout') {
          setError('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่');
        } else {
          setError('สร้างห้องไม่สำเร็จ: ' + e.message);
        }
        setLoading(false);
        return;
      }
    }

    onStart(trimmedNames, roomId);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-lg border border-gray-100">
        <div className="text-center mb-6">
          <span className="text-6xl block mb-4">🃏</span>
          <h1 className="text-3xl font-bold text-[#0F2854]">เครื่องคิดเลข ดัมมี่</h1>
          
          {user ? (
            <div className="mt-4 flex items-center justify-center gap-2">
              <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" />
              <span className="text-[#1C4D8D] font-medium">{user.displayName}</span>
              <button onClick={handleLogout} className="text-xs text-red-400 hover:text-red-600 underline cursor-pointer">ออกจากระบบ</button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="mt-4 px-4 py-2 bg-white border border-gray-300 rounded-full text-gray-700 text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2 mx-auto cursor-pointer"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" className="w-4 h-4" />
              เข้าสู่ระบบด้วย Google
            </button>
          )}
        </div>

        {/* Mode Selection */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <button 
            onClick={() => setMode('single')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${mode === 'single' ? 'bg-white text-[#1C4D8D] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            เล่นคนเดียว
          </button>
          <button 
            onClick={() => setMode('create')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${mode === 'create' ? 'bg-white text-[#1C4D8D] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            สร้างห้อง
          </button>
          <button 
            onClick={() => setMode('join')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${mode === 'join' ? 'bg-white text-[#1C4D8D] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            แจมห้อง
          </button>
        </div>

        <form onSubmit={handleStartGame} className="space-y-4">
          {mode === 'join' ? (
            <div className="space-y-4">
              <div>
                <label className="text-[#1C4D8D] text-sm font-medium mb-1 block">รหัสห้อง (6 หลัก)</label>
                <input
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  placeholder="เช่น 123456"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[#0F2854] text-center text-2xl tracking-widest font-bold placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4988C4] focus:border-transparent transition-all"
                  maxLength={6}
                />
              </div>
              <div>
                <label className="text-[#1C4D8D] text-sm font-medium mb-1 block">ชื่อของคุณ</label>
                <input
                  type="text"
                  value={names[0]}
                  onChange={(e) => handleChange(0, e.target.value)}
                  placeholder="กรอกชื่อ"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[#0F2854] placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4988C4] focus:border-transparent transition-all"
                />
              </div>
            </div>
          ) : (
            <>
              <p className="text-[#4988C4] text-sm text-center mb-2">
                {mode === 'create' ? 'กรอกชื่อผู้เล่นเริ่มต้น (ชวนเพื่อนมาช่วยกรอกทีหลังได้)' : 'กรอกชื่อผู้เล่นทั้ง 4 คน'}
              </p>
              {names.map((name, i) => (
                <div key={i} className="relative">
                  <label className="text-[#1C4D8D] text-sm font-medium mb-1 block">
                    ผู้เล่นคนที่ {i + 1} {i === 0 && user && '(คุณ)'}
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
            </>
          )}

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-xl font-semibold text-lg transition-all mt-6 cursor-pointer ${
              loading ? 'bg-gray-300 text-gray-500' : 'bg-[#1C4D8D] text-white hover:bg-[#0F2854] shadow-lg hover:shadow-[#1C4D8D]/30'
            }`}
          >
            {loading ? 'กำลังโหลด...' : mode === 'join' ? '🚀 เข้าห้อง' : mode === 'create' ? '🏠 สร้างห้อง' : '🎮 เริ่มเกม'}
          </button>
        </form>
        
        <div className="text-center mt-4 flex justify-center gap-4">
          <button
            type="button"
            onClick={onHistory}
            className="text-[#4988C4] hover:text-[#0F2854] text-sm transition-all cursor-pointer"
          >
            🏆 ดูประวัติเกม
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="text-[#4988C4] hover:text-[#0F2854] text-sm transition-all cursor-pointer"
          >
            ❓ วิธีใช้งาน
          </button>
        </div>
      </div>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
