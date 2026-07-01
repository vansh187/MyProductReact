import LandingPage from './components/LandingPage';
import { Routes, Route } from 'react-router-dom';
import './App.css'
import HomePage from './components/HomePage';
import ExploreFutureOptions from './components/ExploreFutureOptions';
import FuturesTerminal from './components/FuturesTerminal';

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/explore/fno" element={<ExploreFutureOptions />} />
        <Route path="/terminal/fno" element={<FuturesTerminal />} />
      </Routes>
    </>
  )
}

export default App
