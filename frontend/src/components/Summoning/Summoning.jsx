import { LORE } from '../../constants/lore.js';
import Sigil from './Sigil.jsx';
import './Summoning.css';

// Indicador de carregamento temático: selo girando + texto ("Invocando…").
export default function Summoning({ text = LORE.summoning }) {
  return (
    <div className="summoning" role="status" aria-live="polite">
      <Sigil animated className="summoning-sigil" />
      <span>{text}</span>
    </div>
  );
}
