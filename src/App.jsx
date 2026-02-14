import { useState } from 'react';
import PlayerSetup from './components/PlayerSetup';
import DummyCalculator from './components/DummyCalculator';

function App() {
  const [playerNames, setPlayerNames] = useState(null);

  if (!playerNames) {
    return <PlayerSetup onStart={setPlayerNames} />;
  }

  return (
    <DummyCalculator
      playerNames={playerNames}
      onReset={() => setPlayerNames(null)}
    />
  );
}

export default App;
