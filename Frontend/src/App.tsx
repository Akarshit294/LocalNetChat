import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Health from './components/Health.tsx';
import JoinPage from './pages/JoinPage.tsx';
import PeoplePage from './pages/PeoplePage.tsx';
import YouPage from './pages/YouPage.tsx';
import RealtimeProvider from './realtime/RealtimeProvider.tsx';

function App() {
  return (
    <BrowserRouter>
      {/* the provider wraps the routes, so the socket survives moving between pages */}
      <RealtimeProvider>
        <Routes>
          <Route path="/" element={<JoinPage />} />
          <Route path="/people" element={<PeoplePage />} />
          <Route path="/you" element={<YouPage />} />
          <Route path="/health" element={<Health />} />
        </Routes>
      </RealtimeProvider>
    </BrowserRouter>
  )
}

export default App
