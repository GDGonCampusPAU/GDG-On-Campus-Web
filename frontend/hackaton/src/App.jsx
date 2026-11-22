import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import Register from './pages/Register.jsx'
import Schedule from './pages/Schedule.jsx'
import Team from './pages/Team.jsx'
import NotFound from './pages/NotFound.jsx'
import Admin from './pages/Admin.jsx'
import AdminJury from './pages/AdminJury.jsx'
import Application from './pages/Application.jsx'
import Jury from './pages/Jury.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="kayit" element={<Register />} />
        <Route path="basvurum" element={<Application />} />
        <Route path="program" element={<Schedule />} />
        <Route path="ekip" element={<Team />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="admin" element={<Admin />} />
      <Route path="admin/juri" element={<AdminJury />} />
      <Route path="juri/:token" element={<Jury />} />
    </Routes>
  )
}
