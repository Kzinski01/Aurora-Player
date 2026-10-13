import { useEffect, useState } from "react";
import { FolderOpen, RefreshCw, DownloadCloud, CheckCircle2, Palette, Wrench, Plug, Download } from "lucide-react";
import clsx from "clsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import Slider from "../components/ui/Slider.jsx";
import Switch from "../components/ui/Switch.jsx";
import Dropdown from "../components/ui/Dropdown.jsx";
import RichPresenceCard from "../components/player/RichPresenceCard.jsx";
import aurora from "../lib/aurora.js";
import useDownloadStore from "../store/useDownloadStore.js";
import useUIStore from "../store/useUIStore.js";
import { useTranslation, SUPPORTED_LANGUAGES } from "../i18n/index.js";

function SettingRow({ title, subtitle, children }) {
  return <div className="setting-row"><div className="setting-copy"><div className="setting-title">{title}</div>{subtitle && <div className="setting-subtitle">{subtitle}</div>}</div><div className="setting-control">{children}</div></div>;
}
function SettingsGroup({ title, icon: Icon, children }) {
  return <section className="settings-group"><h2 className="settings-group-title"><Icon size={17} />{title}</h2><Card className="settings-rows">{children}</Card></section>;
}

export default function SettingsPage() {
  const { settings, loadSettings, patchSettings } = useDownloadStore();
  const pushToast = useUIStore((s) => s.pushToast);
  const { t } = useTranslation();
  const [concurrency, setConcurrency] = useState(3);
  const [deps, setDeps] = useState(null);
  const [checkingDeps, setCheckingDeps] = useState(false);
  const [updatingYtDlp, setUpdatingYtDlp] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (settings.maxConcurrent) setConcurrency(settings.maxConcurrent);
  }, [settings.maxConcurrent]);

  async function chooseFolder() {
    const dir = await aurora.chooseFolder();
    if (dir) await patchSettings({ downloadDir: dir });
  }

  async function chooseFfmpeg() {
    try {
      await aurora.chooseFfmpeg();
      await loadSettings();
      setDeps(null);
    } catch (error) {
      pushToast({ tone: "error", message: error.message });
    }
  }

  async function resetFfmpeg() {
    await aurora.resetFfmpeg();
    await loadSettings();
    setDeps(null);
  }

  async function handleCheckDeps() {
    setCheckingDeps(true);
    try {
      const res = await aurora.checkDependencyVersions();
      setDeps(res);
      if (res.checkError) pushToast({ tone: "error", message: res.checkError });
      else if (res.ytDlpUpdateAvailable) pushToast({ tone: "info", message: t("settings.depsUpdateAvailable") });
      else pushToast({ tone: "success", message: t("settings.depsAllUpToDate") });
    } catch (e) {
      pushToast({ tone: "error", message: t("settings.depsCheckFailed") });
    } finally {
      setCheckingDeps(false);
    }
  }

  async function handleUpdateYtDlp() {
    setUpdatingYtDlp(true);
    try {
      const res = await aurora.updateYtDlp();
      pushToast({ tone: "success", message: t("settings.depsYtdlpUpdated") });
      setDeps((d) => (d ? { ...d, ytDlpVersion: res.version, ytDlpUpdateAvailable: false } : d));
    } catch (e) {
      pushToast({ tone: "error", message: t("settings.depsYtdlpUpdateFailed") });
    } finally {
      setUpdatingYtDlp(false);
    }
  }

  return (
    <div className="page-content settings-page">
      <SettingsGroup title={t("nav.download")} icon={Download}>
        <SettingRow title={t("settings.downloadFolderTitle")} subtitle={settings.downloadDir}>
          <Button variant="ghost" size="sm" onClick={chooseFolder}>
            <FolderOpen size={14} /> {t("settings.change")}
          </Button>
        </SettingRow>

        <SettingRow title={t("settings.concurrencyTitle")} subtitle={t("settings.concurrencySubtitle")}>
          <div className="flex items-center gap-3">
            <Slider
              aria-label={t("settings.concurrencyTitle")}
              value={concurrency}
              min={1}
              max={20}
              onChange={async (v) => {
                setConcurrency(v);
                await aurora.setConcurrency(v);
                await loadSettings();
              }}
              className="w-40"
            />
            <span className="w-6 text-right text-[13px] tabular-nums text-ink/70">{concurrency}</span>
          </div>
        </SettingRow>

      </SettingsGroup>
      <SettingsGroup title={t("studio.tools")} icon={Wrench}>
        <SettingRow title={t("settings.ffmpegPathTitle")} subtitle={settings.ffmpegPath || t("settings.ffmpegBundled")}>
          <div className="flex items-center gap-2">
            {settings.ffmpegPath && <Button variant="ghost" size="sm" onClick={resetFfmpeg}>{t("settings.ffmpegReset")}</Button>}
            <Button variant="ghost" size="sm" onClick={chooseFfmpeg}>
              <FolderOpen size={14} /> {t("settings.change")}
            </Button>
          </div>
        </SettingRow>

        <SettingRow
          title={t("settings.depsTitle")}
          subtitle={
            deps
              ? [
                  deps.ytDlpVersion && `yt-dlp ${deps.ytDlpVersion}`,
                  deps.ffmpegVersion && `ffmpeg ${deps.ffmpegVersion}`,
                  deps.ffprobeVersion && `ffprobe ${deps.ffprobeVersion}`,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : t("settings.depsBundled")
          }
        >
          <div className="flex items-center gap-2">
            {deps?.ytDlpUpdateAvailable && (
              <Button size="sm" onClick={handleUpdateYtDlp} disabled={updatingYtDlp}>
                <DownloadCloud size={14} />
                {updatingYtDlp ? t("settings.depsUpdating") : t("settings.depsUpdate")}
              </Button>
            )}
            {deps && !deps.ytDlpUpdateAvailable && !deps.checkError && (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                <CheckCircle2 size={12} /> {t("settings.depsUpToDate")}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={handleCheckDeps} disabled={checkingDeps}>
              <RefreshCw size={14} className={clsx(checkingDeps && "animate-spin")} />
              {checkingDeps ? t("settings.depsChecking") : t("settings.depsCheck")}
            </Button>
          </div>
        </SettingRow>

      </SettingsGroup>
      <SettingsGroup title={t("studio.appearance")} icon={Palette}>
        <SettingRow title={t("settings.themeTitle")} subtitle={t("settings.themeSubtitle")}>
          <Dropdown className="w-52" label={t("settings.themeTitle")} value={settings.theme || "system"} options={["system", "light", "dark"].map(value => ({ value, label: t(`studio.${value}`) }))} onChange={theme => patchSettings({ theme })} />
        </SettingRow>

        <SettingRow title={t("settings.languageTitle")} subtitle={t("settings.languageSubtitle")}>
          <Dropdown
            className="w-52"
            value={settings.language || "pt-BR"}
            options={SUPPORTED_LANGUAGES.map((l) => ({ value: l.code, label: l.nativeName }))}
            onChange={(code) => patchSettings({ language: code })}
          />
        </SettingRow>

      </SettingsGroup>
      <SettingsGroup title={t("studio.integrations")} icon={Plug}>
        <SettingRow
          title={t("settings.discordTitle")}
          subtitle={t("settings.discordSubtitle")}
        >
          <Switch
            aria-label={t("settings.discordTitle")}
            checked={settings.discordRichPresence ?? true}
            onChange={(checked) => patchSettings({ discordRichPresence: checked })}
          />
        </SettingRow>

        {(settings.discordRichPresence ?? true) && (
          <div className="border-b border-ink/[0.05] py-4">
            <div className="mb-3 text-[12px] text-ink/40">{t("settings.discordPreviewLabel")}</div>
            <RichPresenceCard appName="Aurora Downloader" />
          </div>
        )}

        <SettingRow
          title={t("settings.playlistsTitle")}
          subtitle={t("settings.playlistsSubtitle")}
        >
          <Button variant="ghost" size="sm" onClick={() => aurora.openPlaylistsFolder()}>
            <FolderOpen size={14} /> {t("settings.playlistsOpenFolder")}
          </Button>
        </SettingRow>
      </SettingsGroup>
    </div>
  );
}
