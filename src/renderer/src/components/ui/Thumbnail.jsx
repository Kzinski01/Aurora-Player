import { useState } from "react";
import { ImageOff, Music2 } from "lucide-react";
import clsx from "clsx";

export default function Thumbnail({ src, className, audio = false }) {
  const [loadedSrc, setLoadedSrc] = useState(null);
  const [failedSrc, setFailedSrc] = useState(null);
  const available = src && failedSrc !== src;
  const Icon = audio ? Music2 : ImageOff;
  return (
    <div className={clsx("media-thumbnail", available && loadedSrc !== src && "is-loading", className)}>
      <Icon size={20} aria-hidden="true" />
      {available && <img src={src} alt="" loading="lazy" onLoad={() => setLoadedSrc(src)} onError={() => setFailedSrc(src)} className={loadedSrc === src ? "is-loaded" : ""} />}
    </div>
  );
}
