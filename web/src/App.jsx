import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Register from './pages/Register.jsx'
import Schedule from './pages/Schedule.jsx'
import Team from './pages/Team.jsx'

export default function App() {
  return (
    <Routes>
      <Route index element={<Home />} />
      <Route path="kayit" element={<Register />} />
      <Route path="program" element={<Schedule />} />
      <Route path="ekip" element={<Team />} />
    </Routes>
  )
}
