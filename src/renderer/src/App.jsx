import { MotionConfig, motion } from "framer-motion";
import { useEffect } from "react";
import useResolvedTheme from "./hooks/useResolvedTheme.js";
import Sidebar from "./components/layout/Sidebar.jsx";
import Topbar from "./components/layout/Topbar.jsx";
import RightPanel from "./components/layout/RightPanel.jsx";
import Player from "./components/player/Player.jsx";
import ToastStack from "./components/ui/Toast.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import DownloadPage from "./pages/DownloadPage.jsx";
import QueuePage from "./pages/QueuePage.jsx";
import LibraryPage from "./pages/LibraryPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import EditorPage from "./pages/EditorPage.jsx";
import useUIStore from "./store/useUIStore.js";
import useDownloadStore from "./store/useDownloadStore.js";
import usePlayerStore from "./store/usePlayerStore.js";
import useProfileStore from "./store/useProfileStore.js";
import useMiniPlayerBridge from "./hooks/useMiniPlayerBridge.js";
import { applyAccent } from "./lib/accent.js";
import { motionTokens } from "./lib/motion.js";
import logger from "./lib/logger.js";

const pages = {
  download: DownloadPage,
  queue: QueuePage,
  library: LibraryPage,
  settings: SettingsPage,
  profile: ProfilePage,
  // Reached from a library item's scissors action rather than the sidebar —
  // the editor is always *about* something, so a nav entry leading to an empty
  // editor would be a dead end.
  editor: EditorPage,
};

export default function App() {
  const view = useUIStore((s) => s.view);
  const loadJobs = useDownloadStore((s) => s.loadJobs);
  const loadSettings = useDownloadStore((s) => s.loadSettings);
  const theme = useResolvedTheme();
  const pushToast = useUIStore((s) => s.pushToast);
  const playbackError = usePlayerStore((s) => s.playbackError);
  const loadProfile = useProfileStore((s) => s.loadProfile);
  const accentColor = useProfileStore((s) => s.profile?.accentColor);

  // Keeps the background mini player fed with playback state and acts on the
  // commands it sends back — this window owns the audio, so it owns both ends.
  useMiniPlayerBridge();

  useEffect(() => {
    logger.info("Aplicação iniciada");
    loadJobs();
    loadSettings();
    // Loaded here rather than only in ProfilePage: the accent colour it holds
    // paints the whole app, so waiting until the user opens Perfil would show
    // the default purple until then.
    loadProfile();
  }, [loadJobs, loadSettings, loadProfile]);

  // Repaints --accent/--accent-soft/--accent-deep, which every accent-coloured
  // class in the app resolves through (see tailwind.config.js).
  useEffect(() => {
    applyAccent(accentColor);
  }, [accentColor]);

  // Read by index.css ([data-theme="light"] overrides) and Tailwind's
  // darkMode:"class" utilities alike — set on <html> so it wins over
  // anything default-themed further down, including this component's own root.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (playbackError) pushToast({ tone: "error", message: playbackError });
  }, [playbackError, pushToast]);

  const Page = pages[view] ?? DownloadPage;

  return (
    <MotionConfig reducedMotion="user">
    <motion.div
      className="app-shell relative flex h-screen w-screen flex-col overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="ambient-field" aria-hidden="true" />
      <div className="relative flex min-h-0 flex-1">
        <Sidebar />
        <div className="workspace">
          <Topbar />
          <main className="workspace-main">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={motionTokens.normal}
            >
              <ErrorBoundary resetKey={view}>
                <Page />
              </ErrorBoundary>
            </motion.div>
          </main>
        </div>
        <RightPanel />
      </div>

      <Player />
      <ToastStack />
    </motion.div>
    </MotionConfig>
  );
}
