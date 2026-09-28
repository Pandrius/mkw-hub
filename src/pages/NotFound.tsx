import { Link } from 'react-router'
import { useI18n } from '../i18n'

export default function NotFound() {
  const { t } = useI18n()
  return (
    <div className="py-20 text-center">
      <p className="font-display text-6xl font-black text-kart-red">404</p>
      <p className="mt-2 text-lg">{t('notFound.text')}</p>
      <Link to="/" className="mt-6 btn-yellow">
        {t('notFound.back')}
      </Link>
    </div>
  )
}
