import { Library, HardDrive, FileAudio, ListMusic } from "lucide-react";
import Card from "../ui/Card.jsx";
import { formatBytes } from "../../lib/format.js";
import { useTranslation } from "../../i18n/index.js";

// "3 músicas · 1 vídeo" — omits a kind entirely when there is none of it, so a
// library of only songs doesn't advertise "0 vídeos".
function describeLibraryMix({ audioCount = 0, videoCount = 0 }, tn) {
  const parts = [];
  if (audioCount > 0) parts.push(tn("libraryStats.audioCount", audioCount));
  if (videoCount > 0) parts.push(tn("libraryStats.videoCount", videoCount));
  return parts.join(" · ");
}

export default function LibraryStatsCard({ stats }) {
  const { t, tn } = useTranslation();
  if (!stats || stats.totalCount === 0) return null;

  const tiles = [
    {
      label: t("profile.statsLibraryItems"),
      value: String(stats.totalCount),
      subtitle: describeLibraryMix(stats, tn),
      icon: Library,
    },
    { label: t("profile.statsSpaceUsed"), value: formatBytes(stats.totalSizeBytes), icon: HardDrive },
    { label: t("libraryStats.topFormat"), value: stats.topFormat || "—", icon: FileAudio },
    {
      label: t("libraryStats.longestPlaylist"),
      value: stats.longestPlaylist ? tn("libraryStats.trackCount", stats.longestPlaylist.trackCount) : "—",
      subtitle: stats.longestPlaylist?.name,
      icon: ListMusic,
    },
  ];

  return (
    <div className="library-stats">
      {tiles.map(({ label, value, subtitle, icon: Icon }) => (
        <div key={label} className="library-stat">
          <div className="flex items-center gap-1.5 text-[11px] text-ink/40">
            <Icon size={12} />
            {label}
          </div>
          <div className="library-stat-value truncate">{value}</div>
          {subtitle && <div className="truncate text-[11px] text-ink/35">{subtitle}</div>}
        </div>
      ))}
    </div>
  );
}
