export default function Logo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" className={className} aria-hidden="true">
      <path d="M3 5h7l6 14 6-14h7L19.5 28h-7L3 5z" />
    </svg>
  );
}