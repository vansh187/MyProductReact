import LandingPage from './components/LandingPage';
import { Routes, Route } from 'react-router-dom';
import './App.css'
import HomePage from './components/HomePage';
import ExploreFutureOptions from './components/ExploreFutureOptions';

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/explore/fno" element={<ExploreFutureOptions />} />
      </Routes>
    </>
  )
}

export default App
