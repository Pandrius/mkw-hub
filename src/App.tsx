import { Route, Routes } from 'react-router'
import Layout from './components/Layout'
import Admin from './pages/Admin'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
import Stats from './pages/Stats'
import Teams from './pages/Teams'
import TimeTrials from './pages/TimeTrials'
import TrackDetail from './pages/TrackDetail'
import Tracks from './pages/Tracks'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="pistas" element={<Tracks />} />
        <Route path="pistas/:trackId" element={<TrackDetail />} />
        <Route path="contrarreloj" element={<TimeTrials />} />
        <Route path="estadisticas" element={<Stats />} />
        <Route path="equipos" element={<Teams />} />
        <Route path="admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
