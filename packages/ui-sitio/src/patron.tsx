/** Trama decorativa (líneas diagonales) en el color del tema; se usa con opacidad baja en fondos. */
export function Patron({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 size-full ${className}`}
    >
      <defs>
        <pattern
          id="trama-diagonal"
          width="28"
          height="28"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="28" stroke="currentColor" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#trama-diagonal)" />
    </svg>
  )
}
