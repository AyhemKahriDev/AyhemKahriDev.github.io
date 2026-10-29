/** Sunlit Paper Skies app shell: the game canvas remains primary while its studio stays contextual. */
import ErrorBoundary from "./components/ErrorBoundary";
import GameCanvas from "./components/GameCanvas";

function App() {
  return (
    <ErrorBoundary>
      <GameCanvas />
    </ErrorBoundary>
  );
}

export default App;
