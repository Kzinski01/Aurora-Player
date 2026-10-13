const path = require("path");
const { fileURLToPath } = require("url");
const { validateMediaUrl } = require("./downloadInput");

function inside(file, directory) {
  const relative = path.relative(directory, file);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function configureSession(session, { root, avatarPath, isLibraryMediaPath }) {
  const publicDirectories = [path.join(root, "assets"), path.join(root, "src/renderer/dist")];
  const splashFiles = ["splash.html", "splash.js"].map((name) => path.join(root, "src/main", name));
  session.webRequest.onBeforeRequest((details, callback) => {
    try {
      const url = new URL(details.url);
      if (url.protocol === "file:") {
        const file = path.resolve(fileURLToPath(url));
        const allowed = publicDirectories.some((directory) => inside(file, directory)) || splashFiles.includes(file) ||
          (details.resourceType === "image" && file === avatarPath()) ||
          (details.resourceType === "media" && isLibraryMediaPath(file));
        callback({ cancel: !allowed });
      } else if (["http:", "https:"].includes(url.protocol)) {
        validateMediaUrl(url.href);
        callback({ cancel: url.protocol !== "https:" });
      } else {
        callback({ cancel: !["aurora-media:", "data:", "blob:", "devtools:"].includes(url.protocol) });
      }
    } catch {
      callback({ cancel: true });
    }
  });
}

module.exports = { configureSession, inside };
