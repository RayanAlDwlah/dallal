/** The approved category icon set, ported from categories.html. */

const PATHS: Record<string, React.ReactNode> = {
  car: (
    <>
      <path d="M3 13l1.8-5.2A2 2 0 0 1 6.7 6.5h10.6a2 2 0 0 1 1.9 1.3L21 13v4.5a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1V17H6.5v.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M3.6 13h16.8" />
      <circle cx="7.2" cy="15.2" r=".9" />
      <circle cx="16.8" cy="15.2" r=".9" />
    </>
  ),
  plate: <path d="M9.2 4L7.6 20M16.4 4L14.8 20M4.6 9.2h14.8M3.9 14.8h14.8" />,
  estate: (
    <>
      <path d="M4 20V6.6a1 1 0 0 1 .72-.96l7-2.1a1 1 0 0 1 1.28.96V20" />
      <path d="M13 10.4h5.8a1 1 0 0 1 1 1V20" />
      <path d="M2.6 20h18.8" />
      <path d="M7 9h2M7 12.4h2M7 15.8h2M16 13.6h1.4M16 16.8h1.4" />
    </>
  ),
  watch: (
    <>
      <circle cx="12" cy="12" r="4.7" />
      <path d="M9.2 7.7L9.6 4.1a1 1 0 0 1 1-.9h2.8a1 1 0 0 1 1 .9l.4 3.6M9.2 16.3l.4 3.6a1 1 0 0 0 1 .9h2.8a1 1 0 0 0 1-.9l.4-3.6" />
      <path d="M12 9.9v2.3l1.5 1" />
    </>
  ),
  device: (
    <>
      <rect x="6.8" y="2.6" width="10.4" height="18.8" rx="2.3" />
      <path d="M10.5 5.4h3M11 18.5h2" />
    </>
  ),
  sofa: (
    <>
      <path d="M5 11V8.4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2V11" />
      <path d="M5 11a2.1 2.1 0 0 0-2.1 2.1v3.6h18.2v-3.6A2.1 2.1 0 0 0 19 11a2.1 2.1 0 0 0-2.1 2.1v1.1H7.1v-1.1A2.1 2.1 0 0 0 5 11z" />
      <path d="M5.2 16.7v2.6M18.8 16.7v2.6" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.4l1.42 2.88 3.18.46-2.3 2.24.54 3.17L12 14.66l-2.84 1.49.54-3.17-2.3-2.24 3.18-.46z" />
    </>
  ),
  livestock: (
    <>
      <circle cx="7.6" cy="8.6" r="1.9" />
      <circle cx="12" cy="6.7" r="1.9" />
      <circle cx="16.4" cy="8.6" r="1.9" />
      <path d="M12 11.2c-2.7 0-4.9 2-4.9 4.4 0 1.8 1.4 3 3.1 3 .74 0 1.24-.24 1.8-.24s1.06.24 1.8.24c1.7 0 3.1-1.2 3.1-3 0-2.4-2.2-4.4-4.9-4.4z" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 2.6v2.7M12 18.7v2.7M21.4 12h-2.7M5.3 12H2.6M18.65 5.35l-1.9 1.9M7.25 16.75l-1.9 1.9M18.65 18.65l-1.9-1.9M7.25 7.25l-1.9-1.9" />
    </>
  ),
  art: (
    <>
      <path d="M12 3.2c-5 0-9 3.8-9 8.6 0 4.5 3.4 7.7 7.4 7.7 1.6 0 2.4-.9 2.4-2 0-.6-.3-1-.3-1.6 0-.9.7-1.5 1.7-1.5H16c3 0 5-2 5-5.1 0-3.9-4-6.1-9-6.1z" />
      <circle cx="7.6" cy="11.2" r="1.05" />
      <circle cx="10.6" cy="7.7" r="1.05" />
      <circle cx="15" cy="8.2" r="1.05" />
      <circle cx="17.4" cy="11.7" r="1.05" />
    </>
  ),
  bag: (
    <>
      <path d="M4.6 8h14.8l1 12.4H3.6z" />
      <path d="M8.6 10.4V7.1a3.4 3.4 0 0 1 6.8 0v3.3" />
    </>
  ),
  tent: (
    <>
      <path d="M12 4l8.6 15.6H3.4z" />
      <path d="M12 10.6l5 9M12 10.6l-5 9" />
    </>
  ),
  box: (
    <>
      <path d="M3.5 7.6L12 3.6l8.5 4v8.8L12 20.4l-8.5-4z" />
      <path d="M3.5 7.6L12 11.6l8.5-4M12 11.6v8.8" />
    </>
  ),
  all: <path d="M4 5.5h6.5v6.5H4zM13.5 5.5H20V12h-6.5zM4 15h6.5v4.5H4zM13.5 15H20v4.5h-6.5z" />,
};

export function CategoryIcon({ icon, className }: { icon: string | null; className?: string }) {
  const paths = (icon && PATHS[icon]) || PATHS.box;
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths}
    </svg>
  );
}
