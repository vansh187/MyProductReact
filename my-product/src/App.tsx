import LandingPage from './components/LandingPage';
import { Routes, Route } from 'react-router-dom';
import './App.css'
import HomePage from './components/HomePage';
import ExploreFutureOptions from './components/ExploreFutureOptions';
import FuturesTerminal from './components/FuturesTerminal';
import OptionChain from './components/OptionChain';
import DashboardLayout from './components/dashboard/DashboardLayout';

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/explore/fno" element={<ExploreFutureOptions />} />
        <Route path="/terminal/fno" element={<FuturesTerminal />} />
        <Route path="/terminal/fno/chain" element={<OptionChain />} />
        <Route path="/dashboard" element={<DashboardLayout />} />
      </Routes>
    </>
  )
}

export default App
