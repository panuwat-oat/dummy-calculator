import { useState, useEffect } from 'react';
import PlayerSetup from './components/PlayerSetup';
import DummyCalculator from './components/DummyCalculator';
import GameHistory from './components/GameHistory';

function App() {
  const [playerNames, setPlayerNames] = useState(() => {
    const saved = localStorage.getItem('playerNames');
    return saved ? JSON.parse(saved) : null;
  });
  const [page, setPage] = useState('game');

  if (page === 'history') {
    return <GameHistory onBack={() => setPage('game')} />;
  }

  if (!playerNames) {
    return (
      <PlayerSetup 
        onStart={(names) => {
          localStorage.setItem('playerNames', JSON.stringify(names));
          setPlayerNames(names);
        }} 
        onHistory={() => setPage('history')} 
      />
    );
  }

  return (
    <DummyCalculator
      playerNames={playerNames}
      onReset={() => {
        localStorage.removeItem('playerNames');
        localStorage.removeItem('gameScores');
        localStorage.removeItem('gameLog');
        setPlayerNames(null);
      }}
      onHistory={() => setPage('history')}
    />
  );
}

export default App;
