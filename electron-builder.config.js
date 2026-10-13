// O empacotador inclui apenas as dependências de produção do aplicativo.
module.exports = {
  appId: "com.aurora.downloader",
  productName: "Aurora Downloader",
  electronVersion: require("electron/package.json").version,
  npmRebuild: false,
  asar: true,
  electronFuses: {
    runAsNode: false,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
  },
  asarUnpack: ["assets/intro.mp4"],
  directories: {
    output: "release",
  },
  files: [
    "package.json",
    "LICENSE",
    "src/main/**/*",
    "src/preload/**/*",
    "src/renderer/dist/**/*",
    "assets/**/*",
    "!src/renderer/src/**",
    "!src/renderer/node_modules/**",
    "!src/renderer/*.config.js",
    // The built copies of both entry points ship via src/renderer/dist above;
    // these are the unbuilt sources.
    "!src/renderer/index.html",
    "!src/renderer/mini.html",
    "!tests/**",
  ],
  extraResources: [
    { from: "THIRD_PARTY_NOTICES.md", to: "THIRD_PARTY_NOTICES.md" },
    { from: "third-party", to: "third-party" },
    { from: "resources/bin/yt-dlp.exe", to: "bin/yt-dlp.exe" },
    { from: "resources/bin/ffmpeg.exe", to: "bin/ffmpeg.exe" },
    { from: "resources/bin/ffprobe.exe", to: "bin/ffprobe.exe" },
  ],
  protocols: [
    {
      name: "Aurora Downloader",
      schemes: ["aurora"],
    },
  ],
  win: {
    target: "nsis",
    icon: "assets/icon.png",
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    include: "build/installer.nsh",
  },
};
