import { useState, useRef, useCallback } from 'react';
import WinnerModal from './WinnerModal';

const WINNING_SCORE = 500;

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

export default function DummyCalculator({ playerNames, onReset }) {
  const [scores, setScores] = useState(() => {
    const saved = localStorage.getItem('gameScores');
    return saved ? JSON.parse(saved) : [0, 0, 0, 0];
  });
  const [inputs, setInputs] = useState(['', '', '', '']);
  const [log, setLog] = useState(() => {
    const saved = localStorage.getItem('gameLog');
    return saved ? JSON.parse(saved) : [];
  });
  const [winner, setWinner] = useState(null);
  const [winnerPrices, setWinnerPrices] = useState(null);
  const inputRefs = useRef([]);

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
    }

    setScores(newScores);
    setLog(newLog);
    localStorage.setItem('gameScores', JSON.stringify(newScores));
    localStorage.setItem('gameLog', JSON.stringify(newLog));
    setInputs(['', '', '', '']);
    inputRefs.current[0]?.focus();
  }, [inputs, scores, log, playerNames]);

  const handleNewRound = () => {
    setScores([0, 0, 0, 0]);
    setInputs(['', '', '', '']);
    setLog([]);
    setWinner(null);
    setWinnerPrices(null);
    localStorage.setItem('gameScores', JSON.stringify([0, 0, 0, 0]));
    localStorage.removeItem('gameLog');
    inputRefs.current[0]?.focus();
  };

  const handleUndo = () => {
    if (log.length === 0) return;
    const lastRoundIndex = [...log].map((e, i) => ({ ...e, i })).filter(e => e.type === 'round').pop();
    if (!lastRoundIndex) return;
    const newLog = log.slice(0, lastRoundIndex.i);
    const newScores = [0, 0, 0, 0];
    newLog.forEach((entry) => {
      if (entry.type === 'round') {
        entry.values.forEach((v, i) => { newScores[i] += v; });
      }
    });
    setScores(newScores);
    setLog(newLog);
    setWinner(null);
    setWinnerPrices(null);
    localStorage.setItem('gameScores', JSON.stringify(newScores));
    localStorage.setItem('gameLog', JSON.stringify(newLog));
    inputRefs.current[0]?.focus();
  };

  const handleResetAll = () => {
    setScores([0, 0, 0, 0]);
    setInputs(['', '', '', '']);
    setLog([]);
    setWinner(null);
    setWinnerPrices(null);
    localStorage.setItem('gameScores', JSON.stringify([0, 0, 0, 0]));
    localStorage.removeItem('gameLog');
  };

  const getScoreColor = (score) => {
    if (score > 0) return 'text-[#BDE8F5]';
    if (score < 0) return 'text-red-400';
    return 'text-white/60';
  };

  const getLogRowStyle = (type) => {
    switch (type) {
      case 'price_units':
        return 'bg-[#4988C4]/20 text-[#BDE8F5]';
      case 'settlement':
        return 'bg-[#0F2854]/40 text-white';
      default:
        return 'text-white/80';
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
    <div className="min-h-screen bg-gradient-to-br from-[#0F2854] via-[#1C4D8D] to-[#4988C4] p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center pt-4 pb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            🃏 เครื่องคิดเลข ดัมมี่
          </h1>
        </div>

        {/* Scoreboard */}
        <div className="bg-[#1C4D8D]/60 backdrop-blur-xl rounded-2xl border border-[#BDE8F5]/20 shadow-2xl p-5 mb-4">
          <div className="grid grid-cols-4 gap-3">
            {playerNames.map((name, i) => (
              <div key={i} className="text-center">
                <p className="text-[#BDE8F5] text-sm font-medium truncate mb-1">{name}</p>
                <p className={`text-3xl md:text-4xl font-bold tabular-nums ${getScoreColor(scores[i])}`}>
                  {scores[i]}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Input Row */}
        <div className="bg-[#1C4D8D]/60 backdrop-blur-xl rounded-2xl border border-[#BDE8F5]/20 shadow-2xl p-5 mb-4">
          <div className="grid grid-cols-4 gap-3 mb-4">
            {inputs.map((val, i) => (
              <input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                type="number"
                value={val}
                onChange={(e) => handleInputChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                placeholder="0"
                className="w-full text-center text-xl font-semibold py-3 rounded-xl bg-white/10 border border-[#BDE8F5]/20 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#4988C4] focus:border-transparent transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                autoFocus={i === 0}
              />
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCalculate}
              disabled={inputs.some((v) => v === '' || isNaN(parseInt(v)))}
              className="flex-1 py-3 rounded-xl font-semibold text-lg bg-gradient-to-r from-[#4988C4] to-[#1C4D8D] text-white hover:from-[#BDE8F5] hover:to-[#4988C4] hover:text-[#0F2854] shadow-lg hover:shadow-[#4988C4]/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              คำนวณ
            </button>
            <button
              onClick={handleUndo}
              disabled={log.filter(e => e.type === 'round').length === 0}
              className="px-4 py-3 rounded-xl font-semibold text-lg bg-[#4988C4]/20 text-[#BDE8F5] border border-[#4988C4]/30 hover:bg-[#4988C4]/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
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

        {/* Log */}
        {log.length > 0 && (
          <div className="bg-[#1C4D8D]/60 backdrop-blur-xl rounded-2xl border border-[#BDE8F5]/20 shadow-2xl p-5">
            <h2 className="text-white font-semibold mb-3 text-sm uppercase tracking-wider">
              📋 บันทึกคะแนน
            </h2>
            <div className="space-y-1">
              {log.map((entry, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-4 gap-3 py-2 px-3 rounded-lg ${getLogRowStyle(entry.type)}`}
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
              ))}
            </div>
          </div>
        )}

        {/* Back to setup */}
        <div className="text-center mt-6 pb-8">
          <button
            onClick={onReset}
            className="text-[#BDE8F5]/60 hover:text-white text-sm transition-all cursor-pointer"
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
          onClose={handleNewRound}
        />
      )}
    </div>
  );
}
