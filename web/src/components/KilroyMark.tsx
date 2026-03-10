/**
 * The Kilroy dome-bot mark — robot peeking over a wall.
 * Single source of truth for every place the logo appears.
 */
export function KilroyMark({ size = 32, className }: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      {/* wall */}
      <line x1="4" y1="19" x2="28" y2="19"
        stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      {/* dome */}
      <path d="M10 19 C10 10, 22 10, 22 19"
        stroke="var(--accent)" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* antenna stem */}
      <line x1="16" y1="10" x2="16" y2="6"
        stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round" />
      {/* antenna tip */}
      <circle cx="16" cy="5" r="1.5" fill="var(--accent)" />
      {/* visor */}
      <rect x="12" y="14" width="8" height="3.5" rx="1.75"
        fill="var(--text-dim)" opacity="0.5" />
      {/* left eye */}
      <circle cx="14.5" cy="15.75" r="1.5" fill="var(--accent)" />
      {/* right eye */}
      <circle cx="17.5" cy="15.75" r="1.5" fill="var(--accent)" />
      {/* nose / wall peek */}
      <path d="M16 19 C16 21, 15.8 23, 16 26"
        stroke="var(--accent)" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}
