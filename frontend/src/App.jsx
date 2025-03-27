import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TextUpload from './components/TextUpload';
import CharacterSelection from './components/CharacterSelection';
import ChatInterface from './components/ChatInterface';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <header className="app-header">
          <h1>AI Character Simulation</h1>
        </header>
        <main className="app-content">
          <Routes>
            <Route path="/" element={<TextUpload />} />
            <Route path="/characters" element={<CharacterSelection />} />
            <Route path="/chat/:characterId" element={<ChatInterface />} />
          </Routes>
        </main>
        <footer className="app-footer">
          <p>AI Character Simulation with Emotional Adaptation</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
