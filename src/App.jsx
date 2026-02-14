import { useState } from 'react';
import PlayerSetup from './components/PlayerSetup';
import DummyCalculator from './components/DummyCalculator';

function App() {
  const [playerNames, setPlayerNames] = useState(() => {
    const saved = localStorage.getItem('playerNames');
    return saved ? JSON.parse(saved) : null;
  });

  if (!playerNames) {
    return <PlayerSetup onStart={(names) => {
      localStorage.setItem('playerNames', JSON.stringify(names));
      setPlayerNames(names);
    }} />;
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
    />
  );
}

export default App;
