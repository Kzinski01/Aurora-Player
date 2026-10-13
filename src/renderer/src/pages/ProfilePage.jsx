import { useEffect, useState } from "react";
import { User, Upload, Download, Library, HardDrive, ListMusic, DownloadCloud, Calendar, Clock, Check, Palette } from "lucide-react";
import Skeleton from "../components/ui/Skeleton.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import Modal from "../components/ui/Modal.jsx";
import useProfileStore from "../store/useProfileStore.js";
import useLibraryStore from "../store/useLibraryStore.js";
import useUIStore from "../store/useUIStore.js";
import { formatBytes, formatShortDate } from "../lib/format.js";
import { DEFAULT_ACCENT, isValidAccent } from "../lib/accent.js";
import { useTranslation } from "../i18n/index.js";

// A curated row rather than a free colour wheel: these all keep enough contrast
// against both themes' surfaces for white-on-accent buttons to stay readable,
// which an arbitrary picker (pale yellow, near-black) would not guarantee.
const ACCENT_PRESETS = [
  DEFAULT_ACCENT,
  "#4F8CFF",
  "#2FBFA0",
  "#E2574C",
  "#E8873A",
  "#D45D9E",
  "#8E7CFF",
  "#5A6470",
];

export default function ProfilePage() {
  const { profile, avatarUrl, loadProfile, setUsername, setPreferences, pickAvatar, exportProfile, pickImport, confirmImport, cancelImport, importPreview } =
    useProfileStore();
  const { stats, loadStats } = useLibraryStore();
  const pushToast = useUIStore((s) => s.pushToast);
  const { t } = useTranslation();
  const [nameDraft, setNameDraft] = useState("");
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    loadProfile();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile) setNameDraft(profile.username);
  }, [profile]);

  async function handleSaveName() {
    const trimmed = nameDraft.trim();
    setEditingName(false);
    if (!trimmed || trimmed === profile?.username) return;
    await setUsername(trimmed);
    pushToast({ tone: "success", message: t("profile.nameUpdated") });
  }

  async function handleAccent(hex) {
    if (!isValidAccent(hex) || hex === profile?.accentColor) return;
    // No toast: the entire UI recolours the instant this lands, which is
    // feedback enough — a toast on top would just be noise.
    await setPreferences({ accentColor: hex });
  }

  async function handleAvatar() {
    const ok = await pickAvatar();
    if (ok) pushToast({ tone: "success", message: t("profile.avatarUpdated") });
  }

  async function handleExport() {
    const res = await exportProfile();
    if (res.path) pushToast({ tone: "success", message: t("profile.exportSuccess") });
  }

  async function handleImportPick() {
    try {
      const payload = await pickImport();
      if (!payload) return; // dialog canceled
    } catch (e) {
      pushToast({ tone: "error", message: e.message || t("profile.importReadFailed") });
    }
  }

  async function handleImportConfirm() {
    await confirmImport();
    pushToast({ tone: "success", message: t("profile.importSuccess") });
  }

  if (!profile) return <div className="page-content"><Skeleton className="h-40" /><Skeleton className="h-28" /></div>;

  const previewAvatar = importPreview?.avatarBase64
    ? `data:image/*;base64,${importPreview.avatarBase64}`
    : null;

  return (
    <div className="page-content profile-page">
      <Card className="profile-hero">
        <button
          onClick={handleAvatar}
          title={t("profile.changeAvatarTitle")}
          className="group relative h-20 w-20 flex-none overflow-hidden rounded-full bg-ink/[0.06] ring-1 ring-ink/10"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-ink/30">
              <User size={28} />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            {t("profile.changeAvatarOverlay")}
          </div>
        </button>

        <div className="min-w-0 flex-1">
          {editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
              maxLength={40}
              className="w-full max-w-xs rounded-lg bg-ink/[0.06] border border-ink/[0.12] px-2.5 py-1 text-[16px] font-semibold text-ink outline-none focus:border-accent/50"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="profile-name truncate text-ink hover:text-accent-soft"
              title={t("profile.editHint")}
            >
              {profile.username}
            </button>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink/40">
            <span className="flex items-center gap-1.5">
              <Calendar size={12} /> {t("profile.createdAt", { date: formatShortDate(profile.createdAt) })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={12} /> {t("profile.lastAccess", { date: formatShortDate(profile.lastAccessAt) })}
            </span>
          </div>
        </div>

        <div className="flex flex-none gap-2">
          <Button variant="ghost" size="sm" onClick={handleExport}>
            <Download size={14} /> {t("profile.exportProfile")}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleImportPick}>
            <Upload size={14} /> {t("profile.importProfile")}
          </Button>
        </div>
      </Card>

      <Card className="profile-accent">
        <div className="min-w-[180px] flex-1">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            <Palette size={13} /> {t("profile.accentTitle")}
          </div>
          <div className="mt-1 text-[11.5px] text-ink/40">{t("profile.accentSubtitle")}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {ACCENT_PRESETS.map((hex) => {
            const selected = (profile.accentColor ?? DEFAULT_ACCENT).toUpperCase() === hex.toUpperCase();
            return (
              <button
                key={hex}
                onClick={() => handleAccent(hex)}
                title={hex}
                aria-label={hex}
                aria-pressed={selected}
                className="flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset ring-black/20 transition-transform duration-200 hover:scale-110"
                style={{ background: hex }}
              >
                {selected && <Check size={13} strokeWidth={3} className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />}
              </button>
            );
          })}

          {/* The native picker covers anything the presets don't, for people
              who already know the hex they want. */}
          <label
            title={t("profile.accentCustom")}
            className="relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full ring-1 ring-inset ring-ink/20 transition-transform duration-200 hover:scale-110"
            style={{ background: "conic-gradient(#E2574C,#E8873A,#E8D33A,#2FBFA0,#4F8CFF,#8E7CFF,#D45D9E,#E2574C)" }}
          >
            <input
              aria-label={t("profile.accentCustom")}
              type="color"
              value={profile.accentColor ?? DEFAULT_ACCENT}
              onChange={(e) => handleAccent(e.target.value.toUpperCase())}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </Card>

      {stats && stats.totalCount > 0 && (
        <Card className="profile-stat-grid divide-x divide-ink/[0.06] overflow-hidden">
          <StatTile icon={DownloadCloud} label={t("profile.statsDownloads")} value={String(profile.stats?.totalDownloads ?? 0)} />
          <StatTile icon={Library} label={t("profile.statsLibraryItems")} value={String(stats.totalCount)} />
          <StatTile icon={HardDrive} label={t("profile.statsSpaceUsed")} value={formatBytes(stats.totalSizeBytes)} />
          <StatTile icon={ListMusic} label={t("profile.statsPlaylists")} value={String(stats.playlistCount)} />
        </Card>
      )}

      <Modal
        open={!!importPreview}
        onClose={cancelImport}
        title={t("profile.importModalTitle")}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={cancelImport}>
              {t("profile.importModalCancel")}
            </Button>
            <Button variant="danger" size="sm" onClick={handleImportConfirm}>
              {t("profile.importModalConfirm")}
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 flex-none overflow-hidden rounded-full bg-ink/[0.06] ring-1 ring-ink/10">
            {previewAvatar ? (
              <img src={previewAvatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-ink/30">
                <User size={18} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-semibold text-ink">{importPreview?.profile?.username}</div>
            <div className="text-[11.5px] text-ink/40">
              {t("profile.importModalCreatedAt", { date: formatShortDate(importPreview?.profile?.createdAt) })}
            </div>
          </div>
        </div>
        <p className="mt-4 text-[13px] text-ink/70">{t("profile.importModalBody", { username: profile.username })}</p>
      </Modal>
    </div>
  );
}

function StatTile({ icon: Icon, label, value }) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-4">
      <div className="flex items-center gap-1.5 text-[11px] text-ink/40">
        <Icon size={12} />
        {label}
      </div>
      <div className="library-stat-value truncate">{value}</div>
    </div>
  );
}
