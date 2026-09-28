import { Link } from 'react-router'

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="font-display text-6xl font-black italic text-kart-red">404</p>
      <p className="mt-2 text-lg">Te has salido de la pista.</p>
      <Link to="/" className="mt-6 inline-block rounded-xl bg-kart-yellow px-5 py-3 font-bold text-bg">
        Volver al inicio
      </Link>
    </div>
  )
}
