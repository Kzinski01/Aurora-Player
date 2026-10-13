// Textos da interface. Preserve as variáveis {{...}} ao traduzir.
export default {
  "nav": {
    "download": "Download",
    "queue": "Queue",
    "library": "Library",
    "settings": "Settings",
    "profile": "Profile"
  },
  "topbar": {
    "download": {
      "title": "Download media",
      "subtitle": "Paste one or more links. Videos, songs, or whole playlists."
    },
    "queue": {
      "title": "Download queue",
      "subtitle": "Track progress in real time."
    },
    "library": {
      "title": "Library",
      "subtitle": "Everything you've downloaded, in one place."
    },
    "settings": {
      "title": "Settings",
      "subtitle": "Download, conversion, and app preferences."
    },
    "profile": {
      "title": "Profile",
      "subtitle": "Your local profile, statistics and profile backup."
    },
    "editor": {
      "title": "Trim and convert",
      "subtitle": "Pick a range and choose what to produce: video, audio, GIF or WebP."
    },
    "detailsPanel": "Details panel"
  },
  "rightPanel": {
    "heading": "Up next",
    "empty": "Nothing in the playback queue"
  },
  "download": {
    "invalidLink": "Enter a valid HTTP or HTTPS link.",
    "placeholder": "Paste one or more YouTube, Instagram, or Twitch links (one per line), or type a song/video name to search…",
    "searching": "Searching…",
    "search": "Search",
    "noResultsFor": "No results found for \"{{query}}\".",
    "needLinkOrQuery": "Paste a YouTube/Instagram/Twitch link, or type the name of a song/video.",
    "analyzeFailed": "Failed to analyze {{url}}: {{message}}",
    "emptyTitle": "No links analyzed yet",
    "emptySubtitle": "Paste a link or type a song/video name to see its title, channel, resolutions, and available formats."
  },
  "resultCard": {
    "playlistFound": "Playlist found",
    "downloadPlaylist": "Download full playlist",
    "confirmPlaylist": "Confirm download",
    "onlyThisVideo": "Analyze this video only",
    "cancel": "Cancel",
    "addedToQueue": "Added to the download queue.",
    "addToQueueFailed": "Couldn't add to the queue: {{error}}",
    "bestAvailable": "best available",
    "playlistSuffix": " · Playlist · {{count}} items",
    "video": "Video",
    "audio": "Audio",
    "addToQueue": "Add to queue"
  },
  "queue": {
    "emptyTitle": "Nothing in the queue yet",
    "emptySubtitle": "Paste a link on the Download tab to get started."
  },
  "playlistDownload": {
    "itemCount": "Video {{index}} of {{total}}",
    "itemProgress": "Item progress",
    "totalProgress": "Overall progress",
    "summary": "{{completed}} completed · {{skipped}} skipped · {{total}} items"
  },
  "queueItem": {
    "audioLabel": "Audio · {{format}}",
    "videoLabel": "Video",
    "videoLabelRes": "Video · {{resolution}}p",
    "eta": "ETA {{eta}}",
    "pause": "Pause",
    "resume": "Resume",
    "cancel": "Cancel",
    "openFolder": "Open folder",
    "remove": "Remove",
    "status": {
      "aguardando": "Waiting",
      "pausado": "Paused",
      "baixando": "Downloading",
      "convertendo": "Converting",
      "concluído": "Done",
      "erro": "Error",
      "cancelado": "Canceled"
    }
  },
  "library": {
    "addToPlaylist": "Add to playlist",
    "cancelSelection": "Cancel selection",
    "searchPlaceholder": "Search by title…",
    "selected": {
      "one": "{{count}} selected",
      "other": "{{count}} selected"
    },
    "addAll": "Select all",
    "noPlaylists": "No playlists",
    "addCount": "Add ({{count}})",
    "missingTracksImported": {
      "one": "{{count}} song hasn't been downloaded yet. Imported from {{file}}",
      "other": "{{count}} songs haven't been downloaded yet. Imported from {{file}}"
    },
    "missingTracks": {
      "one": "{{count}} song hasn't been downloaded yet",
      "other": "{{count}} songs haven't been downloaded yet"
    },
    "tracksInPlaylist": {
      "one": "{{count}} song in this playlist",
      "other": "{{count}} songs in this playlist"
    },
    "refresh": "Refresh",
    "downloading": "Downloading…",
    "downloadMissing": "Download missing",
    "export": "Export",
    "untitledTrack": "Untitled track",
    "removeFromPlaylist": "Remove from this playlist",
    "emptyTitle": "No items found",
    "emptySubtitle": "Download something on the Download tab or adjust the filters.",
    "queuedToast": {
      "one": "{{count}} song added to the queue.",
      "other": "{{count}} songs added to the queue."
    },
    "alreadyLinkedToast": {
      "one": "{{count}} song was already in the library and has been linked.",
      "other": "{{count}} songs were already in the library and have been linked."
    },
    "nothingToDownload": "Nothing to download. It's all here already.",
    "addedToPlaylistToast": {
      "one": "{{count}} song added to the playlist.",
      "other": "{{count}} songs added to the playlist."
    },
    "noNewToAdd": "No new songs to add (already in the playlist).",
    "duplicatesToast": "Songs already in another playlist: {{list}}.",
    "alreadyInPlaylists": "\"{{title}}\" (already in {{playlists}})",
    "andMore": " and {{count}} more",
    "playlistExported": "Playlist exported.",
    "playlistUpdated": "Playlist updated."
  },
  "playlistRail": {
    "all": "All",
    "favorites": "Favorites",
    "missingCount": "{{count}} missing",
    "newPlaylistPlaceholder": "Playlist name…",
    "newPlaylist": "New playlist",
    "importTitle": "Import a playlist from a .json file",
    "import": "Import",
    "deleteTitle": "Delete playlist",
    "cancel": "Cancel",
    "delete": "Delete",
    "deleteConfirm": "Are you sure you want to delete the playlist \"{{name}}\"? Its file in the Playlists folder will be permanently deleted. This can't be undone. Songs already downloaded stay in your library.",
    "deletedToast": "Playlist \"{{name}}\" deleted.",
    "renameTitle": "Rename playlist",
    "renamePlaceholder": "New playlist name…",
    "save": "Save",
    "renamedToast": "\"{{from}}\" is now called \"{{to}}\".",
    "renameFailed": "Could not rename the playlist.",
    "importedToast": {
      "one": "{{count}} playlist imported.",
      "other": "{{count}} playlists imported."
    },
    "noneImported": "No playlists imported."
  },
  "playlistMenu": {
    "empty": "No playlists yet.",
    "newPlaylist": "New playlist",
    "newPlaylistPlaceholder": "New playlist…",
    "create": "Create",
    "addToPlaylist": "Add to playlist",
    "alreadyIn": "\"{{title}}\" is already in {{playlists}}."
  },
  "libraryItem": {
    "removed": "Removed",
    "fileMissing": "File not found",
    "redownload": "Download again",
    "restore": "Restore",
    "purge": "Delete library entry",
    "removeMissing": "Remove from library (file not found)",
    "trim": "Trim / convert",
    "favorite": "Favorite",
    "openFolder": "Open folder",
    "remove": "Remove",
    "redownloadQueued": "\"{{title}}\" added to the download queue.",
    "redownloadFailed": "Couldn't download that song again."
  },
  "editor": {
    "back": "Back",
    "reading": "Reading the file…",
    "sourceInfo": "{{duration}} · {{size}}",
    "noneTitle": "No file selected",
    "noneDescription": "Open the Library and use the scissors button on an item to trim it here.",
    "preview": "Preview",
    "pausePreview": "Pause",
    "selection": "{{start}} → {{end}} · {{duration}} long",
    "outputTitle": "What to produce",
    "targetVideo": "Video",
    "targetAudio": "Audio",
    "cutModeTitle": "Cut type",
    "precise": "Precise",
    "fast": "Fast",
    "preciseHint": "Re-encodes the video and cuts exactly where you chose. Slower.",
    "fastHint": "Re-encodes nothing, but the cut snaps to the nearest keyframe. The start may land a few seconds early.",
    "audioFormatTitle": "Audio format",
    "keepFormat": "Keep original",
    "keepFormatHint": "Copies the original audio without changing its quality.",
    "convertHint": "Converting re-encodes the audio and takes longer.",
    "fpsTitle": "Frames per second",
    "widthTitle": "Width",
    "sizeEstimate": "Estimated size: {{size}}",
    "tryWebp": "Try WebP if you need a smaller file.",
    "export": "Export clip",
    "exporting": "Exporting… {{percent}}%",
    "cancel": "Cancel",
    "openResult": "Open file ({{size}})",
    "exportSuccess": "Clip exported ({{size}}).",
    "exportFailed": "Could not export the clip."
  },
  "mini": {
    "nothingPlaying": "Nothing playing",
    "openToStart": "Open Aurora to pick a track",
    "openApp": "Open Aurora",
    "hide": "Hide the mini player",
    "play": "Play",
    "pause": "Pause",
    "previous": "Previous",
    "next": "Next",
    "shuffle": "Shuffle",
    "favorite": "Favorite"
  },
  "player": {
    "closeVideo": "Close video",
    "shuffle": "Shuffle",
    "previous": "Previous",
    "next": "Next",
    "repeat": "Repeat",
    "hideVideo": "Hide video",
    "showVideo": "Show video",
    "volume": "Volume"
  },
  "settings": {
    "downloadFolderTitle": "Default download folder",
    "change": "Change",
    "concurrencyTitle": "Simultaneous downloads",
    "concurrencySubtitle": "How many queue items download at the same time (1-20)",
    "depsTitle": "Dependencies (yt-dlp / ffmpeg)",
    "ffmpegPathTitle": "FFmpeg executable",
    "ffmpegBundled": "Using the FFmpeg included with the app.",
    "ffmpegReset": "Use bundled",
    "depsBundled": "These tools are included with the app. You can check for yt-dlp updates here.",
    "depsUpdating": "Updating…",
    "depsUpdate": "Update yt-dlp",
    "depsUpToDate": "up to date",
    "depsChecking": "Checking…",
    "depsCheck": "Check for updates",
    "depsUpdateAvailable": "A new version of yt-dlp is available.",
    "depsAllUpToDate": "yt-dlp is up to date.",
    "depsCheckFailed": "Couldn't check for updates right now.",
    "depsYtdlpUpdated": "yt-dlp updated.",
    "depsYtdlpUpdateFailed": "Couldn't update yt-dlp right now.",
    "discordTitle": "Discord Rich Presence",
    "discordSubtitle": "Shows the song you're listening to in your Discord status.",
    "discordPreviewLabel": "Preview of what others see in your status:",
    "themeTitle": "Theme",
    "themeSubtitle": "Light or dark appearance for the app.",
    "themeSwitchToDark": "Switch to dark",
    "themeSwitchToLight": "Switch to light",
    "languageTitle": "Language",
    "languageSubtitle": "The app's interface language.",
    "playlistsTitle": "Imported playlists",
    "playlistsSubtitle": "Drop a .json file per playlist in this folder (id, name, tracks) to import it automatically.",
    "playlistsOpenFolder": "Open folder"
  },
  "profile": {
    "changeAvatarTitle": "Change profile photo",
    "changeAvatarOverlay": "Change",
    "editHint": "Click to edit",
    "createdAt": "Profile created on {{date}}",
    "lastAccess": "Last accessed on {{date}}",
    "exportProfile": "Export profile",
    "importProfile": "Import profile",
    "accentTitle": "Accent colour",
    "accentSubtitle": "Changes the colour of buttons, glows and highlights across the app.",
    "accentCustom": "Pick another colour",
    "statsDownloads": "Downloads completed",
    "statsLibraryItems": "Items in library",
    "statsSpaceUsed": "Space used",
    "statsPlaylists": "Playlists created",
    "importModalTitle": "Import profile",
    "importModalCancel": "Cancel",
    "importModalConfirm": "Replace current profile",
    "importModalCreatedAt": "Created on {{date}}",
    "importModalBody": "This will replace your current profile ({{username}}), including its name, photo and preferences. Your library and playlists will be kept.",
    "nameUpdated": "Name updated.",
    "avatarUpdated": "Profile photo updated.",
    "exportSuccess": "Profile exported.",
    "importReadFailed": "Couldn't read that profile file.",
    "importSuccess": "Profile imported."
  },
  "libraryStats": {
    "audioCount": {
      "one": "{{count}} song",
      "other": "{{count}} songs"
    },
    "videoCount": {
      "one": "{{count}} video",
      "other": "{{count}} videos"
    },
    "topFormat": "Most downloaded format",
    "longestPlaylist": "Longest playlist",
    "trackCount": {
      "one": "{{count}} track",
      "other": "{{count}} tracks"
    }
  },
  "richPresence": {
    "sourceLabel": "Listening to {{appName}}",
    "empty": "Nothing playing right now",
    "unavailable": "{{appName}} isn't available"
  },
  "errors": {
    "boundaryTitle": "This screen crashed while loading.",
    "boundaryDetail": "{{message}}. Full details in Settings → Open logs folder."
  }
};
