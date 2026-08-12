import LandingPage from './components/LandingPage';
import { Routes, Route } from 'react-router-dom';
import './App.css'
import HomePage from './components/HomePage';
import ExploreFutureOptions from './components/ExploreFutureOptions';
import FuturesTerminal from './components/FuturesTerminal';
import OptionChain from './components/OptionChain';
import ExploreMutualFunds from './components/ExploreMutualFunds';
import MutualFundCollection from './components/MutualFundCollection';
import MutualFundSearch from './components/MutualFundSearch';
import MutualFundDetail from './components/MutualFundDetail';
import { ScrollToTop } from './components/ScrollToTop';
import DashboardLayout from './components/dashboard/DashboardLayout';

function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardLayout />} />
        <Route path="/explore/mutualfunds" element={<ExploreMutualFunds />} />
        <Route path="/explore/mutualfunds/collection/:key" element={<MutualFundCollection />} />
        <Route path="/explore/mutualfunds/search" element={<MutualFundSearch />} />
        <Route path="/explore/mutualfunds/fund/:schemeCode" element={<MutualFundDetail />} />
        <Route path="/explore/fno" element={<ExploreFutureOptions />} />
        <Route path="/terminal/fno" element={<FuturesTerminal />} />
        <Route path="/terminal/fno/chain" element={<OptionChain />} />
      </Routes>
    </>
  )
}

export default App
