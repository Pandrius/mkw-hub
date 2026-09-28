import { Link } from 'react-router'
import { useI18n } from '../i18n'

export default function NotFound() {
  const { t } = useI18n()
  return (
    <div className="py-20 text-center">
      <p className="font-display text-6xl font-black italic text-kart-red">404</p>
      <p className="mt-2 text-lg">{t('notFound.text')}</p>
      <Link to="/" className="mt-6 inline-block rounded-xl bg-kart-yellow px-5 py-3 font-bold text-bg">
        {t('notFound.back')}
      </Link>
    </div>
  )
}
