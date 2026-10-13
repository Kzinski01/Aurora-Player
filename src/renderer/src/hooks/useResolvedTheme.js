import { useEffect, useState } from "react";
import useDownloadStore from "../store/useDownloadStore.js";

export default function useResolvedTheme() {
  const preference = useDownloadStore((s) => s.settings.theme);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return preference === "system" ? (systemDark ? "dark" : "light") : preference === "light" ? "light" : "dark";
}
