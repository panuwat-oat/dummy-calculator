import { useState, useEffect } from 'react';
import PlayerSetup from './components/PlayerSetup';
import DummyCalculator from './components/DummyCalculator';
import GameHistory from './components/GameHistory';

function App() {
  const [playerNames, setPlayerNames] = useState(() => {
    const saved = localStorage.getItem('playerNames');
    return saved ? JSON.parse(saved) : null;
  });
  const [roomId, setRoomId] = useState(localStorage.getItem('activeRoomId'));
  const [page, setPage] = useState('game');

  useEffect(() => {
    const handleUpdatePlayerNames = (e) => {
      setPlayerNames(e.detail);
    };
    window.addEventListener('updatePlayerNames', handleUpdatePlayerNames);
    return () => window.removeEventListener('updatePlayerNames', handleUpdatePlayerNames);
  }, []);

  if (page === 'history') {
    return <GameHistory onBack={() => setPage('game')} />;
  }

  if (!playerNames && !roomId) {
    return (
      <PlayerSetup 
        onStart={(names, id = null) => {
          localStorage.setItem('playerNames', JSON.stringify(names));
          if (id) {
            localStorage.setItem('activeRoomId', id);
            setRoomId(id);
          }
          setPlayerNames(names);
        }} 
        onHistory={() => setPage('history')} 
      />
    );
  }

  return (
    <DummyCalculator
      playerNames={playerNames}
      roomId={roomId}
      onReset={() => {
        localStorage.removeItem('playerNames');
        localStorage.removeItem('gameScores');
        localStorage.removeItem('gameLog');
        localStorage.removeItem('activeRoomId');
        setPlayerNames(null);
        setRoomId(null);
      }}
      onHistory={() => setPage('history')}
    />
  );
}

export default App;
