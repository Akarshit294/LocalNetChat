import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Health from './components/Health.tsx';
import Home from './components/Home.tsx';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/health" element={<Health />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
