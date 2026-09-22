import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { FAKE } from './lib/mode.ts';
import ChatPage from './pages/ChatPage.tsx';
import HealthPage from './pages/HealthPage.tsx';
import JoinPage from './pages/JoinPage.tsx';
import PeoplePage from './pages/PeoplePage.tsx';
import YouPage from './pages/YouPage.tsx';
import MockProvider from './realtime/MockProvider.tsx';
import RealtimeProvider from './realtime/RealtimeProvider.tsx';
import GlobalStyle from './ui/GlobalStyle.tsx';

// The routes, and the one socket above them. ?fake swaps that socket for a
// server running in this tab; the pages cannot tell which one they are under.
const Provider = FAKE ? MockProvider : RealtimeProvider;

export default function App() {
  return (
    <BrowserRouter>
      <GlobalStyle />
      {/* the provider wraps the routes, so the socket survives moving between pages */}
      <Provider>
        <Routes>
          <Route path="/" element={<JoinPage />} />
          <Route path="/people" element={<PeoplePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/you" element={<YouPage />} />
          <Route path="/health" element={<HealthPage />} />
        </Routes>
      </Provider>
    </BrowserRouter>
  );
}
