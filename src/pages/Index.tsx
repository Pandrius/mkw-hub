import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import Home from './Home'
import Stats from './Stats'

/** Portada: con sesión iniciada es la página de estadísticas del jugador; sin sesión, la presentación de la web */
export default function Index() {
  const { t } = useI18n()
  const { profile, loading } = useAuth()
  if (loading) return <p className="text-muted">{t('common.loading')}</p>
  return profile ? <Stats /> : <Home />
}
