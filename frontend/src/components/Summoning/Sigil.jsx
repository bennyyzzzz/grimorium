// Selo do Grimorium: anel rúnico tracejado, círculo interno e triângulo de invocação.
// Com `animated`, o anel e o triângulo giram em sentidos opostos.
export default function Sigil({ className = '', animated = false }) {
  return (
    <svg
      className={`sigil${animated ? ' sigil-animated' : ''} ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle className="sigil-ring" cx="12" cy="12" r="10.6" strokeDasharray="1.6 2.2" />
      <circle cx="12" cy="12" r="7.2" />
      <path className="sigil-triangle" d="M12 4.8 18.24 15.6H5.76Z" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
