import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Health from './components/Health.tsx';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/health" element={<Health />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
