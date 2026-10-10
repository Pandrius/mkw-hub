import { Route, Routes } from 'react-router'
import Layout from './components/Layout'
import Admin from './pages/Admin'
import EventDetail from './pages/EventDetail'
import Home from './pages/Home'
import MyTimes from './pages/MyTimes'
import NewEvent from './pages/NewEvent'
import NotFound from './pages/NotFound'
import Stats from './pages/Stats'
import TeamDetail from './pages/TeamDetail'
import Teams from './pages/Teams'
import TimeTrials from './pages/TimeTrials'
import TrackDetail from './pages/TrackDetail'
import ValidateWar from './pages/ValidateWar'
import Tracks from './pages/Tracks'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="pistas" element={<Tracks />} />
        <Route path="pistas/:trackId" element={<TrackDetail />} />
        <Route path="contrarreloj" element={<TimeTrials />} />
        <Route path="tiempos" element={<MyTimes />} />
        <Route path="estadisticas" element={<Stats />} />
        <Route path="estadisticas/:profileId" element={<Stats />} />
        <Route path="eventos/nuevo" element={<NewEvent />} />
        <Route path="eventos/:eventId" element={<EventDetail />} />
        <Route path="eventos/:eventId/validar" element={<ValidateWar />} />
        <Route path="equipos" element={<Teams />} />
        <Route path="equipos/:teamId" element={<TeamDetail />} />
        <Route path="admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
