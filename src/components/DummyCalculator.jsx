import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import WinnerModal from './WinnerModal';
import HelpModal from './HelpModal';
import { saveActiveGame, subscribeToActiveGame, clearActiveGame, saveGameHistory, updateRoomState, subscribeToRoom } from '../services/db';

const WINNING_SCORE = 500;

function AnimatedScore({ value, className }) {
  let spring = useSpring(value, { mass: 0.8, stiffness: 75, damping: 15 });
  let display = useTransform(spring, (current) => Math.round(current));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span className={className}>{display}</motion.span>;
}

function checkPrice(num) {
  let sum = 0;
  if (num >= 0) {
    while (num >= 100) {
      num -= 100;
      sum += 1;
    }
    if (num >= 55) {
      sum += 1;
    }
  } else {
    while (num <= -100) {
      num += 100;
      sum -= 1;
    }
    if (num <= -55) {
      sum -= 1;
    }
  }
  return sum;
}

export default function DummyCalculator({ playerNames, roomId, onReset, onHistory }) {
  const [scores, setScores] = useState([0, 0, 0, 0]);
  const [inputs, setInputs] = useState(['0', '0', '0', '0']);
  const [log, setLog] = useState([]);
  const [winner, setWinner] = useState(null);
  const [winnerPrices, setWinnerPrices] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  
  // Load active game from Firestore (Room or Single)
  useEffect(() => {
    let unsubscribe;
    
    if (roomId) {
      // Multiplayer Mode
      unsubscribe = subscribeToRoom(roomId, (data) => {
        if (data) {
          setScores(data.scores || [0, 0, 0, 0]);
          setLog(data.log || []);
          // Sync player names if they change in the room (e.g. someone joins)
          if (data.playerNames && JSON.stringify(data.playerNames) !== JSON.stringify(playerNames)) {
             window.dispatchEvent(new CustomEvent('updatePlayerNames', { detail: data.playerNames }));
          }
        }
      });
    } else {
      // Single Player Mode
      unsubscribe = subscribeToActiveGame((data) => {
        if (data && data.active) {
          setScores(data.scores || [0, 0, 0, 0]);
          setLog(data.log || []);
        }
      });
    }

    return () => unsubscribe && unsubscribe();
  }, [roomId]); // Re-subscribe if roomId changes

  // Save active game to Firestore whenever state changes
  useEffect(() => {
    if (log.length > 0 || scores.some(s => s !== 0)) {
        if (roomId) {
            updateRoomState(roomId, {
                scores,
                log,
                playerNames // Keep names in sync
            });
        } else {
            saveActiveGame({
                active: true,
                playerNames,
                scores,
                log
            });
        }
    }
  }, [scores, log, playerNames, roomId]);

  const [editingIndex, setEditingIndex] = useState(null);
  const [editValues, setEditValues] = useState(['', '', '', '']);
  const [focusedInput, setFocusedInput] = useState(0);
  const [editingNameIndex, setEditingNameIndex] = useState(null);
  const [tempName, setTempName] = useState('');
  const inputRefs = useRef([]);

  const handleQuickAdd = (amount) => {
    const updated = [...inputs];
    const current = parseInt(updated[focusedInput]) || 0;
    updated[focusedInput] = String(current + amount);
    setInputs(updated);
    inputRefs.current[focusedInput]?.focus();
  };

  const handleEditName = (index) => {
    setEditingNameIndex(index);
    setTempName(playerNames[index]);
  };

  const handleSaveName = () => {
    if (!tempName.trim()) return;
    const newNames = [...playerNames];
    newNames[editingNameIndex] = tempName.trim();
    localStorage.setItem('playerNames', JSON.stringify(newNames));
    
    // Update locally
    window.dispatchEvent(new CustomEvent('updatePlayerNames', { detail: newNames }));
    
    // If in a room, update the room state so everyone sees the new name
    if (roomId) {
        updateRoomState(roomId, { playerNames: newNames });
    }
    
    setEditingNameIndex(null);
  };

  const handleCancelEditName = () => {
    setEditingNameIndex(null);
    setTempName('');
  };

  const recalcScores = (logData) => {
    const newScores = [0, 0, 0, 0];
    logData.forEach((entry) => {
      if (entry.type === 'round') {
        entry.values.forEach((v, i) => { newScores[i] += v; });
      }
    });
    return newScores;
  };

  const handleInputChange = (index, value) => {
    const updated = [...inputs];
    updated[index] = value;
    setInputs(updated);
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index < 3) {
        inputRefs.current[index + 1]?.focus();
      } else {
        handleCalculate();
      }
    }
  };

  const handleCalculate = useCallback(() => {
    if (inputs.some((v) => v === '' || isNaN(parseInt(v)))) {
      return;
    }

    const values = inputs.map((v) => parseInt(v));
    const newScores = scores.map((s, i) => s + values[i]);
    const newLog = [...log, { type: 'round', values }];

    // Check winner
    const winnerIndex = newScores.findIndex((s) => s >= WINNING_SCORE);
    if (winnerIndex !== -1) {
      const priceUnits = newScores.map((s) => checkPrice(s));
      newLog.push({ type: 'price_units', values: priceUnits });

      const prices = priceUnits.map((p, i) =>
        priceUnits.reduce((sum, other, j) => (i !== j ? sum + (p - other) : sum), 0)
      );
      newLog.push({ type: 'settlement', values: prices });

      setWinner(playerNames[winnerIndex]);
      setWinnerPrices(prices);

      // Save to game history (Cloud)
      const gameResult = {
        winner: playerNames[winnerIndex],
        rounds: newLog.filter(e => e.type === 'round').length,
        players: playerNames.map((name, idx) => ({
          name,
          score: newScores[idx],
          settlement: prices[idx],
        })),
      };
      saveGameHistory(gameResult);
    }

    setScores(newScores);
    setLog(newLog);
    // Local storage backup (optional, keeping it doesn't hurt)
    localStorage.setItem('gameScores', JSON.stringify(newScores));
    localStorage.setItem('gameLog', JSON.stringify(newLog));
    setInputs(['0', '0', '0', '0']);
    inputRefs.current[0]?.focus();
  }, [inputs, scores, log, playerNames]);

  const handleNewRound = () => {
    setScores([0, 0, 0, 0]);
    setInputs(['0', '0', '0', '0']);
    setLog([]);
    setWinner(null);
    setWinnerPrices(null);
    
    if (roomId) {
        updateRoomState(roomId, { scores: [0,0,0,0], log: [], winner: null });
    } else {
        clearActiveGame(); // Clear from cloud
    }
    
    localStorage.setItem('gameScores', JSON.stringify([0, 0, 0, 0]));
    localStorage.removeItem('gameLog');
    inputRefs.current[0]?.focus();
  };

  const handleUndo = () => {
    if (log.length === 0) return;
    if (!window.confirm('ย้อนกลับรอบล่าสุด?')) return;
    const lastRoundIndex = [...log].map((e, i) => ({ ...e, i })).filter(e => e.type === 'round').pop();
    if (!lastRoundIndex) return;
    const newLog = log.slice(0, lastRoundIndex.i);
    const newScores = recalcScores(newLog);
    setScores(newScores);
    setLog(newLog);
    setWinner(null);
    setWinnerPrices(null);
    localStorage.setItem('gameScores', JSON.stringify(newScores));
    localStorage.setItem('gameLog', JSON.stringify(newLog));
    inputRefs.current[0]?.focus();
  };

  const handleEditLog = (index) => {
    if (log[index].type !== 'round') return;
    setEditingIndex(index);
    setEditValues(log[index].values.map(String));
  };

  const handleSaveEdit = () => {
    if (editValues.some((v) => v === '' || isNaN(parseInt(v)))) return;
    const newLog = log.filter((e) => e.type === 'round').map((e, i) => {
      if (log.indexOf(e) === editingIndex) {
        return { ...e, values: editValues.map((v) => parseInt(v)) };
      }
      return e;
    });
    const newScores = recalcScores(newLog);
    setScores(newScores);
    setLog(newLog);
    setEditingIndex(null);
    localStorage.setItem('gameScores', JSON.stringify(newScores));
    localStorage.setItem('gameLog', JSON.stringify(newLog));
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
  };

  const handleResetAll = () => {
    if (!window.confirm('รีเซ็ตคะแนนทั้งหมด?')) return;
    setScores([0, 0, 0, 0]);
    setInputs(['0', '0', '0', '0']);
    setLog([]);
    setWinner(null);
    setWinnerPrices(null);
    
    if (roomId) {
        updateRoomState(roomId, { scores: [0,0,0,0], log: [], winner: null });
    } else {
        clearActiveGame(); // Clear from cloud
    }

    localStorage.setItem('gameScores', JSON.stringify([0, 0, 0, 0]));
    localStorage.removeItem('gameLog');
  };

  const getScoreColor = (score) => {
    if (score > 0) return 'text-[#1C4D8D]';
    if (score < 0) return 'text-red-500';
    return 'text-gray-300';
  };

  const getLogRowStyle = (type) => {
    switch (type) {
      case 'price_units':
        return 'bg-[#BDE8F5] text-[#1C4D8D]';
      case 'settlement':
        return 'bg-[#0F2854] text-white';
      default:
        return 'text-[#0F2854]';
    }
  };

  const getLogLabel = (type) => {
    switch (type) {
      case 'price_units':
        return 'ตอง';
      case 'settlement':
        return 'จ่าย';
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center pt-4 pb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-[#0F2854]">
            🃏 เครื่องคิดเลข ดัมมี่
          </h1>
          {roomId && (
            <div className="mt-2 inline-block px-3 py-1 bg-[#BDE8F5]/30 rounded-full border border-[#BDE8F5] text-[#1C4D8D] text-xs font-medium">
              🔑 ห้อง: <span className="font-bold tracking-widest">{roomId}</span>
            </div>
          )}
        </div>

        {/* Scoreboard */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-5 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {playerNames.map((name, i) => (
              <div key={i} className="text-center">
                <p className="text-[#4988C4] text-sm font-medium truncate mb-1">{name}</p>
                <p className={`text-3xl md:text-4xl font-bold tabular-nums ${getScoreColor(scores[i])}`}>
                  <AnimatedScore value={scores[i]} />
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Input Row */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-5 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 gap-y-6 mb-4">
            {inputs.map((val, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                {editingNameIndex === i ? (
                  <div className="flex gap-1 w-full">
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') handleCancelEditName(); }}
                      className="flex-1 px-1 py-0.5 text-xs font-medium bg-white border border-[#4988C4] text-[#0F2854] rounded focus:outline-none focus:ring-1 focus:ring-[#4988C4]"
                      autoFocus
                    />
                    <button onClick={handleSaveName} className="px-1 py-0.5 text-xs bg-[#1C4D8D] text-white rounded hover:bg-[#0F2854] cursor-pointer">✓</button>
                    <button onClick={handleCancelEditName} className="px-1 py-0.5 text-xs bg-gray-100 text-gray-500 rounded hover:bg-gray-200 cursor-pointer">✕</button>
                  </div>
                ) : (
                  <p 
                    onClick={() => handleEditName(i)}
                    className="text-[#4988C4] text-xs font-medium truncate w-full text-center cursor-pointer hover:text-[#1C4D8D] hover:bg-gray-50 rounded px-1 py-0.5 transition-all"
                  >
                    {playerNames[i]}
                  </p>
                )}
                {/* + buttons */}
                <div className="flex gap-1 w-full justify-center">
                  {[5, 10, 50, 100].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { const updated = [...inputs]; updated[i] = String((parseInt(updated[i]) || 0) + n); setInputs(updated); inputRefs.current[i]?.focus(); }}
                      className="flex-1 py-1 rounded-md text-[10px] font-bold bg-[#BDE8F5]/50 text-[#1C4D8D] border border-[#BDE8F5] hover:bg-[#BDE8F5] transition-all cursor-pointer leading-tight"
                    >
                      +{n}
                    </button>
                  ))}
                </div>
                {/* Input */}
                <input
                  ref={(el) => (inputRefs.current[i] = el)}
                  type="number"
                  value={val}
                  onChange={(e) => handleInputChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, i)}
                  onFocus={() => setFocusedInput(i)}
                  placeholder="0"
                  className={`w-full text-center text-xl font-semibold py-3 rounded-xl bg-gray-50 border text-[#0F2854] placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4988C4] focus:border-transparent transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${focusedInput === i ? 'border-[#4988C4]' : 'border-gray-200'}`}
                  autoFocus={i === 0}
                />
                {/* - buttons */}
                <div className="flex gap-1 w-full justify-center">
                  {[5, 10, 50, 100].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { const updated = [...inputs]; updated[i] = String((parseInt(updated[i]) || 0) - n); setInputs(updated); inputRefs.current[i]?.focus(); }}
                      className="flex-1 py-1 rounded-md text-[10px] font-bold bg-red-50 text-red-400 border border-red-100 hover:bg-red-100 transition-all cursor-pointer leading-tight"
                    >
                      −{n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCalculate}
              disabled={inputs.some((v) => v === '' || isNaN(parseInt(v)))}
              className="flex-1 py-3 rounded-xl font-semibold text-lg bg-[#1C4D8D] text-white hover:bg-[#0F2854] shadow-lg hover:shadow-[#1C4D8D]/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              คำนวณ
            </button>
            <button
              onClick={handleUndo}
              disabled={log.filter(e => e.type === 'round').length === 0}
              className="px-4 py-3 rounded-xl font-semibold text-lg bg-[#BDE8F5] text-[#1C4D8D] border border-[#4988C4]/20 hover:bg-[#4988C4] hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              ↩
            </button>
            <button
              onClick={handleResetAll}
              className="px-4 py-3 rounded-xl font-semibold text-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-all cursor-pointer"
            >
              รีเซ็ต
            </button>
          </div>
        </div>

        {/* Stats */}
        {log.filter(e => e.type === 'round').length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-5 mb-4">
            <h2 className="text-[#0F2854] font-semibold mb-3 text-sm uppercase tracking-wider">
              📊 สถิติ
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              {playerNames.map((name, i) => {
                const rounds = log.filter(e => e.type === 'round');
                const avg = rounds.length > 0
                  ? (rounds.reduce((sum, e) => sum + e.values[i], 0) / rounds.length).toFixed(1)
                  : '0';
                const max = rounds.length > 0 ? Math.max(...rounds.map(e => e.values[i])) : 0;
                const min = rounds.length > 0 ? Math.min(...rounds.map(e => e.values[i])) : 0;
                return (
                  <div key={i}>
                    <p className="text-[#4988C4] text-xs font-medium truncate mb-1">{name}</p>
                    <p className="text-[#0F2854] text-sm">เฉลี่ย <span className="font-bold">{avg}</span></p>
                    <p className="text-[#4988C4] text-xs">สูงสุด {max} / ต่ำสุด {min}</p>
                  </div>
                );
              })}
            </div>
            <p className="text-center text-xs text-gray-400 mt-2">
              รอบที่เล่น: {log.filter(e => e.type === 'round').length}
            </p>
          </div>
        )}

        {/* Log */}
        {log.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-5">
            <h2 className="text-[#0F2854] font-semibold mb-3 text-sm uppercase tracking-wider">
              📋 บันทึกคะแนน
            </h2>
            <div className="space-y-1">
              {log.map((entry, i) => (
                editingIndex === i ? (
                  <div key={i} className="grid grid-cols-4 gap-2 py-2 px-3 rounded-lg bg-[#BDE8F5]/30 border-2 border-[#4988C4]">
                    {editValues.map((val, j) => (
                      <input
                        key={j}
                        type="number"
                        value={val}
                        onChange={(e) => {
                          const updated = [...editValues];
                          updated[j] = e.target.value;
                          setEditValues(updated);
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') handleCancelEdit(); }}
                        className="w-full text-center text-base font-semibold py-1 rounded-lg bg-white border border-gray-200 text-[#0F2854] focus:outline-none focus:ring-2 focus:ring-[#4988C4] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        autoFocus={j === 0}
                      />
                    ))}
                    <div className="col-span-4 flex gap-2 mt-1">
                      <button onClick={handleSaveEdit} className="flex-1 py-1 rounded-lg bg-[#1C4D8D] text-white text-sm font-semibold hover:bg-[#0F2854] cursor-pointer">บันทึก</button>
                      <button onClick={handleCancelEdit} className="flex-1 py-1 rounded-lg bg-gray-100 text-gray-500 text-sm font-semibold hover:bg-gray-200 cursor-pointer">ยกเลิก</button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={i}
                    onClick={() => handleEditLog(i)}
                    className={`grid grid-cols-4 gap-3 py-2 px-3 rounded-lg ${getLogRowStyle(entry.type)} ${entry.type === 'round' ? 'cursor-pointer hover:ring-2 hover:ring-[#4988C4]/30' : ''}`}
                  >
                    {entry.values.map((val, j) => (
                      <div key={j} className="text-center font-semibold tabular-nums text-lg">
                        {getLogLabel(entry.type) && j === 0 && (
                          <span className="text-xs font-normal opacity-60 block -mb-1">
                            {getLogLabel(entry.type)}
                          </span>
                        )}
                        {val > 0 ? `+${val}` : val}
                      </div>
                    ))}
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        {/* Back to setup */}
        <div className="text-center mt-6 pb-8">
          <button
            onClick={onReset}
            className="text-[#4988C4] hover:text-[#0F2854] text-sm transition-all cursor-pointer"
          >
            ← เปลี่ยนผู้เล่น
          </button>
          <span className="text-gray-300 mx-2">|</span>
          <button
            onClick={onHistory}
            className="text-[#4988C4] hover:text-[#0F2854] text-sm transition-all cursor-pointer"
          >
            🏆 ประวัติเกม
          </button>
          <span className="text-gray-300 mx-2">|</span>
          <button
            onClick={() => setShowHelp(true)}
            className="text-[#4988C4] hover:text-[#0F2854] text-sm transition-all cursor-pointer"
          >
            ❓ วิธีใช้งาน
          </button>
        </div>
      </div>

      {/* Winner Modal */}
      {winner && (
        <WinnerModal
          winner={winner}
          prices={winnerPrices}
          playerNames={playerNames}
          onClose={handleNewRound}
        />
      )}

      {/* Help Modal */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
