import { useState, useRef, useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import WinnerModal from './WinnerModal';
import HelpModal from './HelpModal';
import { saveActiveGame, subscribeToActiveGame, clearActiveGame, saveGameHistory } from '../services/db';

const WINNING_SCORE = 500;
const VISIBLE_LOG_ROWS = 8;

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

function buildGameState(rounds) {
  const scores = [0, 0, 0, 0];
  rounds.forEach((entry) => {
    entry.values.forEach((v, i) => { scores[i] += v; });
  });

  // Winner = highest score among those who reached WINNING_SCORE (ties fall back to lowest index)
  let winnerIndex = -1;
  scores.forEach((s, i) => {
    if (s >= WINNING_SCORE && (winnerIndex === -1 || s > scores[winnerIndex])) {
      winnerIndex = i;
    }
  });

  if (winnerIndex === -1) {
    return { scores, log: rounds, winnerIndex, prices: null };
  }

  const priceUnits = scores.map((s) => checkPrice(s));
  const prices = priceUnits.map((p, i) =>
    priceUnits.reduce((sum, other, j) => (i !== j ? sum + (p - other) : sum), 0)
  );

  return {
    scores,
    log: [...rounds, { type: 'price_units', values: priceUnits }, { type: 'settlement', values: prices }],
    winnerIndex,
    prices,
  };
}

export default function DummyCalculator({ playerNames, onReset, onHistory, onPlayerNamesChange }) {
  const [scores, setScores] = useState([0, 0, 0, 0]);
  const [inputs, setInputs] = useState(['0', '0', '0', '0']);
  const [log, setLog] = useState([]);
  const [winner, setWinner] = useState(null);
  const [winnerPrices, setWinnerPrices] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [unitRate, setUnitRate] = useState(() => {
    const saved = parseInt(localStorage.getItem('unitRate'));
    return Number.isNaN(saved) ? 5 : saved;
  });
  const isRemoteUpdate = useRef(false);
  const stateRef = useRef({ scores, log });
  const hasSavedGameRef = useRef(false);

  // Keep ref synced with state for subscription callbacks
  useEffect(() => {
    stateRef.current = { scores, log };
  }, [scores, log]);

  // Persist baht-per-unit rate locally
  useEffect(() => {
    localStorage.setItem('unitRate', String(unitRate));
  }, [unitRate]);

  // Load active game from Postgres API (Single Player), polled every 2s
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

        hasSavedGameRef.current = true;
      }
    });

    return () => unsubscribe && unsubscribe();
  }, []);

  // Save active game to Postgres API whenever state changes
  useEffect(() => {
    if (isRemoteUpdate.current) {
        isRemoteUpdate.current = false;
        return;
    }

    const hasGame = log.length > 0 || scores.some((s) => s !== 0);

    if (hasGame) {
        hasSavedGameRef.current = true;
        saveActiveGame({
            active: true,
            playerNames,
            scores,
            log
        });
    } else if (hasSavedGameRef.current) {
        // Board was cleared locally — tell the server, otherwise the poll restores the old game
        hasSavedGameRef.current = false;
        clearActiveGame();
    }
  }, [scores, log, playerNames]);

  const [editingIndex, setEditingIndex] = useState(null);
  const [editValues, setEditValues] = useState(['', '', '', '']);
  const [focusedInput, setFocusedInput] = useState(0);
  const [editingNameIndex, setEditingNameIndex] = useState(null);
  const [tempName, setTempName] = useState('');
  const inputRefs = useRef([]);

  const [showStats, setShowStats] = useState(false);
  const [showAllLog, setShowAllLog] = useState(false);
  const handleEditName = (index) => {
    setEditingNameIndex(index);
    setTempName(playerNames[index]);
  };

  const handleSaveName = () => {
    if (!tempName.trim()) return;
    const newNames = [...playerNames];
    newNames[editingNameIndex] = tempName.trim();
    onPlayerNamesChange(newNames);
    setEditingNameIndex(null);
  };

  const handleCancelEditName = () => {
    setEditingNameIndex(null);
    setTempName('');
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

  const handleCalculate = () => {
    if (inputs.some((v) => v === '' || isNaN(parseInt(v)))) {
      return;
    }

    const values = inputs.map((v) => parseInt(v));
    const rounds = [...log.filter((e) => e.type === 'round'), { type: 'round', values }];
    const result = buildGameState(rounds);

    if (result.winnerIndex !== -1) {
      setWinner(playerNames[result.winnerIndex]);
      setWinnerPrices(result.prices);

      // Save to game history (Cloud)
      const gameResult = {
        winner: playerNames[result.winnerIndex],
        rounds: rounds.length,
        players: playerNames.map((name, idx) => ({
          name,
          score: result.scores[idx],
          settlement: result.prices[idx],
        })),
      };
      saveGameHistory(gameResult);
    }

    setScores(result.scores);
    setLog(result.log);
    // Local storage backup (optional, keeping it doesn't hurt)
    localStorage.setItem('gameScores', JSON.stringify(result.scores));
    localStorage.setItem('gameLog', JSON.stringify(result.log));
    setInputs(['0', '0', '0', '0']);
    inputRefs.current[0]?.focus();
  };

  const handleNewRound = () => {
    setScores([0, 0, 0, 0]);
    setInputs(['0', '0', '0', '0']);
    setLog([]);
    setWinner(null);
    setWinnerPrices(null);

    clearActiveGame(); // Clear from cloud
    hasSavedGameRef.current = false;

    localStorage.setItem('gameScores', JSON.stringify([0, 0, 0, 0]));
    localStorage.removeItem('gameLog');
    inputRefs.current[0]?.focus();
  };

  const handleUndo = () => {
    if (log.length === 0) return;
    if (!window.confirm('ย้อนกลับรอบล่าสุด?')) return;
    const rounds = log.filter((e) => e.type === 'round');
    if (rounds.length === 0) return;
    const result = buildGameState(rounds.slice(0, -1));
    setScores(result.scores);
    setLog(result.log);
    setWinner(result.winnerIndex !== -1 ? playerNames[result.winnerIndex] : null);
    setWinnerPrices(result.prices);
    localStorage.setItem('gameScores', JSON.stringify(result.scores));
    localStorage.setItem('gameLog', JSON.stringify(result.log));
    inputRefs.current[0]?.focus();
  };

  const handleEditLog = (index) => {
    if (log[index].type !== 'round') return;
    setEditingIndex(index);
    setEditValues(log[index].values.map(String));
  };

  const handleSaveEdit = () => {
    if (editValues.some((v) => v === '' || isNaN(parseInt(v)))) return;
    const rounds = log.filter((e) => e.type === 'round').map((e, i) => {
      if (i === editingIndex) {
        return { type: 'round', values: editValues.map((v) => parseInt(v)) };
      }
      return e;
    });
    const result = buildGameState(rounds);
    setScores(result.scores);
    setLog(result.log);
    setWinner(result.winnerIndex !== -1 ? playerNames[result.winnerIndex] : null);
    setWinnerPrices(result.prices);
    setEditingIndex(null);
    localStorage.setItem('gameScores', JSON.stringify(result.scores));
    localStorage.setItem('gameLog', JSON.stringify(result.log));
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
    hasSavedGameRef.current = false;

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

  const roundEntries = log.filter((e) => e.type === 'round');
  const hasRounds = roundEntries.length > 0;
  const leaderIndex = hasRounds
    ? scores.reduce((best, s, i) => (s > scores[best] ? i : best), 0)
    : -1;
  const canCalculate = !inputs.some((v) => v === '' || isNaN(parseInt(v)));

  const indexedLog = log.map((entry, i) => ({ entry, i }));
  const visibleLog = showAllLog ? indexedLog : indexedLog.slice(-VISIBLE_LOG_ROWS);
  const hiddenLogCount = indexedLog.length - visibleLog.length;

  return (
    <div className="min-h-screen bg-gray-50 px-3 pb-10 sm:px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 py-3 sm:py-5">
          <h1 className="text-xl sm:text-3xl font-bold text-[#0F2854]">
            <span className="sm:hidden">🃏 ดัมมี่</span>
            <span className="hidden sm:inline">🃏 เครื่องคิดเลข ดัมมี่</span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={onHistory}
              className="px-3 py-2 rounded-lg text-sm font-medium text-[#1C4D8D] bg-white border border-gray-200 hover:bg-[#BDE8F5]/40 transition-all cursor-pointer"
            >
              🏆 <span className="hidden sm:inline">ประวัติ</span>
            </button>
            <button
              onClick={() => setShowHelp(true)}
              aria-label="วิธีใช้งาน"
              className="px-3 py-2 rounded-lg text-sm font-medium text-[#1C4D8D] bg-white border border-gray-200 hover:bg-[#BDE8F5]/40 transition-all cursor-pointer"
            >
              ❓
            </button>
          </div>
        </header>

        {/* Scoreboard */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-lg p-3 sm:p-5 mb-3 sm:mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            {playerNames.map((name, i) => {
              const isLeader = hasRounds && i === leaderIndex && scores[i] > 0;
              const progress = Math.max(0, Math.min(100, (scores[i] / WINNING_SCORE) * 100));
              return (
                <div
                  key={i}
                  className={`rounded-xl px-3 py-2.5 text-center transition-all ${
                    isLeader ? 'bg-[#BDE8F5]/50 ring-2 ring-[#4988C4]/40' : 'bg-gray-50'
                  }`}
                >
                  <p className="text-[#4988C4] text-sm sm:text-base font-medium truncate">
                    {isLeader ? '👑 ' : ''}{name}
                  </p>
                  <p className={`text-4xl sm:text-4xl font-bold tabular-nums leading-tight ${getScoreColor(scores[i])}`}>
                    <AnimatedScore value={scores[i]} />
                  </p>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#4988C4] transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Score entry — one row per player */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-lg p-3 sm:p-5 mb-3 sm:mb-4">
          <h2 className="text-[#0F2854] text-base sm:text-lg font-semibold mb-3">
            แต้มรอบนี้
          </h2>

          <div className="space-y-2.5 sm:space-y-3">
            {inputs.map((val, i) => (
              <div key={i} className="flex items-center gap-2.5 sm:gap-3">
                {editingNameIndex === i ? (
                  <div className="flex items-center gap-1.5 flex-1">
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') handleCancelEditName(); }}
                      className="flex-1 min-w-0 px-3 h-12 text-base font-medium bg-white border border-[#4988C4] text-[#0F2854] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4988C4]"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveName}
                      className="h-12 px-3 text-base rounded-xl bg-[#1C4D8D] text-white hover:bg-[#0F2854] cursor-pointer"
                    >
                      ✓
                    </button>
                    <button
                      onClick={handleCancelEditName}
                      className="h-12 px-3 text-base rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleEditName(i)}
                      title="แตะเพื่อแก้ชื่อ"
                      className="w-24 sm:w-36 shrink-0 h-14 px-3 rounded-xl text-left text-base sm:text-lg font-medium text-[#1C4D8D] bg-gray-50 border border-gray-200 truncate hover:bg-[#BDE8F5]/40 transition-all cursor-pointer"
                    >
                      {playerNames[i]}
                    </button>
                    <input
                      ref={(el) => (inputRefs.current[i] = el)}
                      type="number"
                      inputMode="numeric"
                      value={val}
                      onChange={(e) => handleInputChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, i)}
                      onFocus={() => setFocusedInput(i)}
                      placeholder="0"
                      className={`flex-1 min-w-0 h-14 text-center text-2xl sm:text-3xl font-semibold rounded-xl bg-gray-50 border text-[#0F2854] placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4988C4] focus:border-transparent transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                        focusedInput === i ? 'border-[#4988C4]' : 'border-gray-200'
                      }`}
                      autoFocus={i === 0}
                    />
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <button
            onClick={handleCalculate}
            disabled={!canCalculate}
            className="w-full mt-4 h-14 rounded-xl font-semibold text-lg sm:text-xl bg-[#1C4D8D] text-white hover:bg-[#0F2854] shadow-lg hover:shadow-[#1C4D8D]/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            คำนวณ
          </button>
          <div className="flex gap-2.5 mt-2.5">
            <button
              onClick={handleUndo}
              disabled={!hasRounds}
              className="flex-1 h-12 rounded-xl font-medium text-base bg-[#BDE8F5] text-[#1C4D8D] border border-[#4988C4]/20 hover:bg-[#4988C4] hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              ↩ ย้อนกลับ
            </button>
            <button
              onClick={handleResetAll}
              className="flex-1 h-12 rounded-xl font-medium text-base bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 transition-all cursor-pointer"
            >
              รีเซ็ต
            </button>
          </div>

          {/* Baht per unit */}
          <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-gray-100">
            <label htmlFor="unitRate" className="text-[#4988C4] text-base font-medium">
              อัตราจ่าย
            </label>
            <div className="flex items-center gap-2">
              <input
                id="unitRate"
                type="number"
                inputMode="numeric"
                value={unitRate}
                onChange={(e) => {
                  const parsed = parseInt(e.target.value);
                  setUnitRate(Number.isNaN(parsed) ? 0 : parsed);
                }}
                className="w-20 h-11 text-center text-base font-semibold rounded-xl bg-gray-50 border border-gray-200 text-[#0F2854] focus:outline-none focus:ring-2 focus:ring-[#4988C4] focus:border-transparent transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[#4988C4] text-base font-medium">บาท/หน่วย</span>
            </div>
          </div>
        </section>

        {/* Stats (collapsible) */}
        {hasRounds && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-lg mb-3 sm:mb-4">
            <button
              onClick={() => setShowStats((s) => !s)}
              className="w-full flex items-center justify-between gap-2 p-3 sm:p-5 cursor-pointer"
            >
              <span className="text-[#0F2854] text-base sm:text-lg font-semibold">
                📊 สถิติ
              </span>
              <span className="flex items-center gap-2 text-[#4988C4] text-sm">
                {roundEntries.length} รอบ
                <span className={`transition-transform ${showStats ? 'rotate-180' : ''}`}>▾</span>
              </span>
            </button>
            {showStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-3 pb-4 sm:px-5 sm:pb-5">
                {playerNames.map((name, i) => {
                  const avg = (roundEntries.reduce((sum, e) => sum + e.values[i], 0) / roundEntries.length).toFixed(1);
                  const max = Math.max(...roundEntries.map((e) => e.values[i]));
                  const min = Math.min(...roundEntries.map((e) => e.values[i]));
                  return (
                    <div key={i} className="rounded-xl bg-gray-50 px-3 py-2.5">
                      <p className="text-[#4988C4] text-sm font-medium truncate mb-1">{name}</p>
                      <p className="text-[#0F2854] text-base">
                        เฉลี่ย <span className="font-bold">{avg}</span>
                      </p>
                      <p className="text-[#4988C4] text-sm">สูงสุด {max} / ต่ำสุด {min}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Log */}
        {log.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-lg p-3 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-[#0F2854] text-base sm:text-lg font-semibold">
                📋 บันทึกคะแนน
              </h2>
              {hiddenLogCount > 0 && (
                <button
                  onClick={() => setShowAllLog(true)}
                  className="text-[#4988C4] hover:text-[#0F2854] text-sm underline cursor-pointer"
                >
                  ดูทั้งหมด ({indexedLog.length})
                </button>
              )}
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-4 gap-2 px-2 pb-2 border-b border-gray-100">
              {playerNames.map((name, j) => (
                <p key={j} className="text-center text-sm text-[#4988C4] font-medium truncate">
                  {name}
                </p>
              ))}
            </div>

            <div className="space-y-1.5 pt-2">
              {visibleLog.map(({ entry, i }) => (
                editingIndex === i ? (
                  <div key={i} className="bg-[#BDE8F5]/30 rounded-xl p-3 border-2 border-[#4988C4]">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                      {editValues.map((val, j) => (
                        <div key={j}>
                          <span className="block text-sm text-[#4988C4] mb-1 truncate">
                            {playerNames[j]}
                          </span>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={val}
                            onChange={(e) => {
                              const updated = [...editValues];
                              updated[j] = e.target.value;
                              setEditValues(updated);
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') handleCancelEdit(); }}
                            className="w-full h-12 text-center text-lg font-semibold rounded-xl bg-white border border-gray-200 text-[#0F2854] focus:outline-none focus:ring-2 focus:ring-[#4988C4] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            autoFocus={j === 0}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSaveEdit} className="flex-1 h-11 rounded-xl bg-[#1C4D8D] text-white text-base font-semibold hover:bg-[#0F2854] cursor-pointer">บันทึก</button>
                      <button onClick={handleCancelEdit} className="flex-1 h-11 rounded-xl bg-gray-100 text-gray-500 text-base font-semibold hover:bg-gray-200 cursor-pointer">ยกเลิก</button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={i}
                    onClick={() => handleEditLog(i)}
                    className={`rounded-xl py-2 px-2 ${getLogRowStyle(entry.type)} ${
                      entry.type === 'round' ? 'cursor-pointer hover:ring-2 hover:ring-[#4988C4]/30' : ''
                    }`}
                  >
                    {getLogLabel(entry.type) && (
                      <p className="text-sm font-medium opacity-70 mb-0.5 px-1">
                        {getLogLabel(entry.type)}
                      </p>
                    )}
                    <div className="grid grid-cols-4 gap-2">
                      {entry.values.map((val, j) => (
                        <div key={j} className="text-center font-semibold tabular-nums text-lg sm:text-xl">
                          {val > 0 ? `+${val}` : val}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>
          </section>
        )}

        {/* Back to setup */}
        <div className="text-center mt-5 pb-4">
          <button
            onClick={onReset}
            className="text-[#4988C4] hover:text-[#0F2854] text-base transition-all cursor-pointer"
          >
            ← เปลี่ยนผู้เล่น
          </button>
        </div>
      </div>

      {/* Winner Modal */}
      {winner && (
        <WinnerModal
          winner={winner}
          prices={winnerPrices}
          playerNames={playerNames}
          unitRate={unitRate}
          onClose={handleNewRound}
        />
      )}

      {/* Help Modal */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
