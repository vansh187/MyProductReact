
import LandingPage from './components/LandingPage';
import {  Routes,Route } from 'react-router-dom';
import './App.css'
import Home from './components/Home';
function App() {

  return (
    <>
      <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/home" element={<Home />} />
    </Routes>
    </>
  )
}

export default App
