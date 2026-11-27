/** Name avatars and team badge colors shared by Directory rows and the team leader popup. */

/** Deterministic pastel palette so the same team or name always gets the same color. */
function paletteIndex(value: string, size: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash % size;
}

const TEAM_BADGE_STYLES = [
    "border-blue-400/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    "border-cyan-400/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    "border-teal-400/40 bg-teal-500/10 text-teal-700 dark:text-teal-300",
    "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    "border-green-400/40 bg-green-500/10 text-green-700 dark:text-green-300",
    "border-lime-400/40 bg-lime-500/10 text-lime-700 dark:text-lime-300",
    "border-yellow-400/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
    "border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    "border-orange-400/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    "border-red-400/40 bg-red-500/10 text-red-700 dark:text-red-300",
    "border-rose-400/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    "border-pink-400/40 bg-pink-500/10 text-pink-700 dark:text-pink-300",
    "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
    "border-purple-400/40 bg-purple-500/10 text-purple-700 dark:text-purple-300",
    "border-violet-400/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    "border-indigo-400/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
    "border-sky-400/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    "border-fuchsia-300/40 bg-fuchsia-400/10 text-fuchsia-700 dark:text-fuchsia-300",
    "border-purple-300/40 bg-purple-400/10 text-purple-700 dark:text-purple-300",
    "border-rose-300/40 bg-rose-400/10 text-rose-700 dark:text-rose-300",
  ];

export function teamBadgeClassName(team: string): string {
  return TEAM_BADGE_STYLES[paletteIndex(team, TEAM_BADGE_STYLES.length)]!;
}

const AVATAR_STYLES = [
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
];

function avatarClassName(name: string): string {
  return AVATAR_STYLES[paletteIndex(name, AVATAR_STYLES.length)]!;
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

export function Avatar({ name, className = "size-8 text-xs" }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${className} ${avatarClassName(name)}`}
    >
      {initialsFor(name)}
    </span>
  );
}
