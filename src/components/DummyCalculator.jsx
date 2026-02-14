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

export default function DummyCalculator({ playerNames, onReset, onHistory }) {
  const [scores, setScores] = useState([0, 0, 0, 0]);
  const [inputs, setInputs] = useState(['0', '0', '0', '0']);
  const [log, setLog] = useState([]);
  const [winner, setWinner] = useState(null);
  const [winnerPrices, setWinnerPrices] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const isRemoteUpdate = useRef(false);
  const stateRef = useRef({ scores, log });

  // Keep ref synced with state for subscription callbacks
  useEffect(() => {
    stateRef.current = { scores, log };
  }, [scores, log]);
  
  // Load active game from Firestore (Single Player)
  useEffect(() => {
    let unsubscribe;
    
    unsubscribe = subscribeToActiveGame((data) => {
      if (data && data.active) {
        const newScores = data.scores || [0, 0, 0, 0];
        const newLog = data.log || [];
        
        const prevScores = stateRef.current.scores;
        const prevLog = stateRef.current.log;

        let hasChanges = false;

        if (JSON.stringify(prevScores) !== JSON.stringify(newScores)) {
            setScores(newScores);
            hasChanges = true;
        }
        
        if (JSON.stringify(prevLog) !== JSON.stringify(newLog)) {
            setLog(newLog);
            hasChanges = true;
        }

        if (hasChanges) {
            isRemoteUpdate.current = true;
        }
      }
    });

    return () => unsubscribe && unsubscribe();
  }, []);

  // Save active game to Firestore whenever state changes
  useEffect(() => {
    if (isRemoteUpdate.current) {
        isRemoteUpdate.current = false;
        return;
    }

    if (log.length > 0 || scores.some(s => s !== 0)) {
        saveActiveGame({
            active: true,
            playerNames,
            scores,
            log
        });
    }
  }, [scores, log, playerNames]);

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
    
    clearActiveGame(); // Clear from cloud
    
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
    
    clearActiveGame(); // Clear from cloud

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
    <div className="min-h-screen bg-gray-50 px-2 pt-1 pb-4 sm:px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center pt-2 pb-2 sm:pt-4 sm:pb-6">
          <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-[#0F2854]">
            🃏 เครื่องคิดเลข ดัมมี่
          </h1>
        </div>

        {/* Scoreboard - always 4 cols */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-lg p-2.5 mb-2 sm:p-5 sm:mb-4">
          <div className="grid grid-cols-4 gap-1 sm:gap-3">
            {playerNames.map((name, i) => (
              <div key={i} className="text-center">
                <p className="text-[#4988C4] text-[10px] sm:text-sm font-medium truncate mb-0.5 sm:mb-1">{name}</p>
                <p className={`text-xl sm:text-3xl md:text-4xl font-bold tabular-nums ${getScoreColor(scores[i])}`}>
                  <AnimatedScore value={scores[i]} />
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Input Row */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-lg p-2 mb-2 sm:p-5 sm:mb-4">
          <div className="grid grid-cols-2 gap-2 gap-y-3 mb-2.5 sm:gap-3 sm:gap-y-6 sm:mb-4 md:grid-cols-4">
            {inputs.map((val, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5 sm:gap-1.5">
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
                    className="text-[#4988C4] text-[10px] sm:text-xs font-medium truncate w-full text-center cursor-pointer hover:text-[#1C4D8D] hover:bg-gray-50 rounded px-1 py-0.5 transition-all"
                  >
                    {playerNames[i]}
                  </p>
                )}
                {/* + buttons */}
                <div className="flex gap-0.5 sm:gap-1 w-full justify-center">
                  {[5, 10, 50, 100].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { const updated = [...inputs]; updated[i] = String((parseInt(updated[i]) || 0) + n); setInputs(updated); inputRefs.current[i]?.focus(); }}
                      className="flex-1 py-0.5 sm:py-1 rounded text-[8px] sm:text-[10px] font-bold bg-[#BDE8F5]/50 text-[#1C4D8D] border border-[#BDE8F5] hover:bg-[#BDE8F5] active:bg-[#BDE8F5] transition-all cursor-pointer leading-tight"
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
                  className={`w-full text-center text-base sm:text-xl font-semibold py-2 sm:py-3 rounded-lg sm:rounded-xl bg-gray-50 border text-[#0F2854] placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4988C4] focus:border-transparent transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${focusedInput === i ? 'border-[#4988C4]' : 'border-gray-200'}`}
                  autoFocus={i === 0}
                />
                {/* - buttons */}
                <div className="flex gap-0.5 sm:gap-1 w-full justify-center">
                  {[5, 10, 50, 100].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { const updated = [...inputs]; updated[i] = String((parseInt(updated[i]) || 0) - n); setInputs(updated); inputRefs.current[i]?.focus(); }}
                      className="flex-1 py-0.5 sm:py-1 rounded text-[8px] sm:text-[10px] font-bold bg-red-50 text-red-400 border border-red-100 hover:bg-red-100 active:bg-red-100 transition-all cursor-pointer leading-tight"
                    >
                      −{n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={handleCalculate}
              disabled={inputs.some((v) => v === '' || isNaN(parseInt(v)))}
              className="flex-1 py-2 sm:py-3 rounded-xl font-semibold text-sm sm:text-lg bg-[#1C4D8D] text-white hover:bg-[#0F2854] shadow-lg hover:shadow-[#1C4D8D]/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              คำนวณ
            </button>
            <button
              onClick={handleUndo}
              disabled={log.filter(e => e.type === 'round').length === 0}
              className="px-3 py-2 sm:px-4 sm:py-3 rounded-xl font-semibold text-sm sm:text-lg bg-[#BDE8F5] text-[#1C4D8D] border border-[#4988C4]/20 hover:bg-[#4988C4] hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              ↩
            </button>
            <button
              onClick={handleResetAll}
              className="px-3 py-2 sm:px-4 sm:py-3 rounded-xl font-semibold text-xs sm:text-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-all cursor-pointer"
            >
              รีเซ็ต
            </button>
          </div>
        </div>

        {/* Stats */}
        {log.filter(e => e.type === 'round').length > 0 && (
          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-lg p-2.5 mb-2 sm:p-5 sm:mb-4">
            <h2 className="text-[#0F2854] font-semibold mb-2 sm:mb-3 text-xs sm:text-sm uppercase tracking-wider">
              📊 สถิติ
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-center">
              {playerNames.map((name, i) => {
                const rounds = log.filter(e => e.type === 'round');
                const avg = rounds.length > 0
                  ? (rounds.reduce((sum, e) => sum + e.values[i], 0) / rounds.length).toFixed(1)
                  : '0';
                const max = rounds.length > 0 ? Math.max(...rounds.map(e => e.values[i])) : 0;
                const min = rounds.length > 0 ? Math.min(...rounds.map(e => e.values[i])) : 0;
                return (
                  <div key={i}>
                    <p className="text-[#4988C4] text-[10px] sm:text-xs font-medium truncate mb-0.5">{name}</p>
                    <p className="text-[#0F2854] text-xs sm:text-sm">เฉลี่ย <span className="font-bold">{avg}</span></p>
                    <p className="text-[#4988C4] text-[10px] sm:text-xs">สูงสุด {max} / ต่ำสุด {min}</p>
                  </div>
                );
              })}
            </div>
            <p className="text-center text-[10px] sm:text-xs text-gray-400 mt-1.5 sm:mt-2">
              รอบที่เล่น: {log.filter(e => e.type === 'round').length}
            </p>
          </div>
        )}

        {/* Log */}
        {log.length > 0 && (
          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-lg p-2.5 sm:p-5">
            <h2 className="text-[#0F2854] font-semibold mb-2 sm:mb-3 text-xs sm:text-sm uppercase tracking-wider">
              📋 บันทึกคะแนน
            </h2>
            <div className="space-y-0.5 sm:space-y-1">
              {log.map((entry, i) => (
                editingIndex === i ? (
                  <div key={i} className="bg-[#BDE8F5]/30 rounded-lg p-2 border-2 border-[#4988C4]">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 mb-2">
                      {editValues.map((val, j) => (
                        <div key={j} className="relative">
                          <span className="sm:hidden text-[8px] text-[#4988C4] absolute -top-1.5 left-1 bg-white px-0.5">
                            {playerNames[j]}
                          </span>
                          <input
                            type="number"
                            value={val}
                            onChange={(e) => {
                              const updated = [...editValues];
                              updated[j] = e.target.value;
                              setEditValues(updated);
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') handleCancelEdit(); }}
                            className="w-full text-center text-sm sm:text-base font-semibold py-1 rounded-lg bg-white border border-gray-200 text-[#0F2854] focus:outline-none focus:ring-2 focus:ring-[#4988C4] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            autoFocus={j === 0}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSaveEdit} className="flex-1 py-1 rounded-lg bg-[#1C4D8D] text-white text-xs sm:text-sm font-semibold hover:bg-[#0F2854] cursor-pointer">บันทึก</button>
                      <button onClick={handleCancelEdit} className="flex-1 py-1 rounded-lg bg-gray-100 text-gray-500 text-xs sm:text-sm font-semibold hover:bg-gray-200 cursor-pointer">ยกเลิก</button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={i}
                    onClick={() => handleEditLog(i)}
                    className={`grid grid-cols-4 gap-1 sm:gap-3 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg ${getLogRowStyle(entry.type)} ${entry.type === 'round' ? 'cursor-pointer hover:ring-2 hover:ring-[#4988C4]/30' : ''}`}
                  >
                    {entry.values.map((val, j) => (
                      <div key={j} className="text-center font-semibold tabular-nums text-xs sm:text-lg">
                        {getLogLabel(entry.type) && j === 0 && (
                          <span className="text-[8px] sm:text-xs font-normal opacity-60 block -mb-0.5 sm:-mb-1">
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
        <div className="text-center mt-3 pb-6 sm:mt-6 sm:pb-8 flex justify-center items-center gap-1 sm:gap-0 flex-wrap">
          <button
            onClick={onReset}
            className="text-[#4988C4] hover:text-[#0F2854] text-[11px] sm:text-sm transition-all cursor-pointer"
          >
            ← เปลี่ยนผู้เล่น
          </button>
          <span className="text-gray-300 mx-1 sm:mx-2">|</span>
          <button
            onClick={onHistory}
            className="text-[#4988C4] hover:text-[#0F2854] text-[11px] sm:text-sm transition-all cursor-pointer"
          >
            🏆 ประวัติเกม
          </button>
          <span className="text-gray-300 mx-1 sm:mx-2">|</span>
          <button
            onClick={() => setShowHelp(true)}
            className="text-[#4988C4] hover:text-[#0F2854] text-[11px] sm:text-sm transition-all cursor-pointer"
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
