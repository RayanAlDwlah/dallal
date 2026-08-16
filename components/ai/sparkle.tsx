/** The one AI marker (ai.html): a purple-tinted square with a spark. Every
 * assistive surface carries it so generated content is never mistaken for
 * seller content. */
export function Sparkle({ className = "size-[26px]" }: { className?: string }) {
  return (
    <span
      className={`grid flex-none place-items-center rounded-[8px] bg-[rgba(124,58,237,.22)] ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className="size-[15px]"
        fill="none"
        stroke="#C4A6FF"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      </svg>
    </span>
  );
}
