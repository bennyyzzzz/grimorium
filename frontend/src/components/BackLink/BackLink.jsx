import { Link } from 'react-router-dom';
import './BackLink.css';

function ChevronLeft() {
  return (
    <svg className="back-link-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M10 3.5 5.5 8l4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Botão de voltar: vira <Link> quando recebe `to`, ou <button> quando recebe `onClick`. */
export default function BackLink({ to, onClick, children }) {
  const content = (
    <>
      <ChevronLeft />
      <span>{children}</span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="back-link">
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className="back-link" onClick={onClick}>
      {content}
    </button>
  );
}
