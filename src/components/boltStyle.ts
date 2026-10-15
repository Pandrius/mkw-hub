import { createContext } from 'react'
import { DEFAULT_BOLT_STYLE, type BoltStyle } from '../lib/titles'

/** Rayos que llevan los escudos especiales del jugador cuyo perfil se está viendo */
export const BoltStyleContext = createContext<BoltStyle>(DEFAULT_BOLT_STYLE)
