// Textos da interface. Preserve as variáveis {{...}} ao traduzir.
export default {
  "nav": {
    "download": "下载",
    "queue": "队列",
    "library": "媒体库",
    "settings": "设置",
    "profile": "个人资料"
  },
  "topbar": {
    "download": {
      "title": "下载媒体",
      "subtitle": "粘贴一个或多个链接。视频、歌曲或整个播放列表。"
    },
    "queue": {
      "title": "下载队列",
      "subtitle": "实时查看下载进度。"
    },
    "library": {
      "title": "媒体库",
      "subtitle": "你下载的一切内容，都在这里。"
    },
    "settings": {
      "title": "设置",
      "subtitle": "下载、转换和应用的相关设置。"
    },
    "profile": {
      "title": "个人资料",
      "subtitle": "本地资料、统计信息和资料备份。"
    },
    "editor": {
      "title": "裁剪与转换",
      "subtitle": "选择片段，并决定输出内容：视频、音频、GIF 或 WebP。"
    },
    "detailsPanel": "详情面板"
  },
  "rightPanel": {
    "heading": "接下来播放",
    "empty": "播放队列中没有内容"
  },
  "download": {
    "placeholder": "粘贴一个或多个 YouTube、Instagram 或 Twitch 链接（每行一个），或输入歌曲/视频名称进行搜索…",
    "searching": "搜索中…",
    "search": "搜索",
    "noResultsFor": "未找到与“{{query}}”相关的结果。",
    "needLinkOrQuery": "请粘贴 YouTube/Instagram/Twitch 链接，或输入歌曲/视频名称。",
    "analyzeFailed": "解析 {{url}} 失败：{{message}}",
    "emptyTitle": "还没有解析任何链接",
    "emptySubtitle": "粘贴链接或输入歌曲/视频名称，即可查看标题、频道、分辨率和可用格式。"
  },
  "resultCard": {
    "addedToQueue": "已添加到下载队列。",
    "addToQueueFailed": "无法添加到队列：{{error}}",
    "bestAvailable": "最佳可用画质",
    "playlistSuffix": " · 播放列表 · {{count}} 项",
    "video": "视频",
    "audio": "音频",
    "addToQueue": "添加到队列"
  },
  "queue": {
    "emptyTitle": "队列中还没有内容",
    "emptySubtitle": "在“下载”标签页中粘贴链接即可开始。"
  },
  "queueItem": {
    "audioLabel": "音频 · {{format}}",
    "videoLabel": "视频",
    "videoLabelRes": "视频 · {{resolution}}p",
    "eta": "剩余 {{eta}}",
    "pause": "暂停",
    "resume": "继续",
    "cancel": "取消",
    "openFolder": "打开文件夹",
    "remove": "移除",
    "status": {
      "aguardando": "等待中",
      "pausado": "已暂停",
      "baixando": "下载中",
      "convertendo": "转换中",
      "concluído": "已完成",
      "erro": "错误",
      "cancelado": "已取消"
    }
  },
  "library": {
    "addToPlaylist": "添加到播放列表",
    "cancelSelection": "取消选择",
    "searchPlaceholder": "按标题搜索…",
    "selected": {
      "other": "已选择 {{count}} 项"
    },
    "addAll": "全选",
    "noPlaylists": "没有播放列表",
    "addCount": "添加（{{count}}）",
    "missingTracksImported": {
      "other": "{{count}} 首歌曲尚未下载。导入自 {{file}}"
    },
    "missingTracks": {
      "other": "{{count}} 首歌曲尚未下载"
    },
    "tracksInPlaylist": {
      "other": "此播放列表中有 {{count}} 首歌曲"
    },
    "refresh": "刷新",
    "downloading": "下载中…",
    "downloadMissing": "下载缺失项",
    "export": "导出",
    "untitledTrack": "无标题曲目",
    "removeFromPlaylist": "从此播放列表中移除",
    "emptyTitle": "未找到任何项目",
    "emptySubtitle": "在“下载”标签页中下载一些内容，或调整筛选条件。",
    "queuedToast": {
      "other": "已将 {{count}} 首歌曲添加到队列。"
    },
    "alreadyLinkedToast": {
      "other": "{{count}} 首歌曲已在媒体库中，并已完成关联。"
    },
    "nothingToDownload": "没有可下载的内容。都已经在这里了。",
    "addedToPlaylistToast": {
      "other": "已将 {{count}} 首歌曲添加到播放列表。"
    },
    "noNewToAdd": "没有可添加的新歌曲（已在播放列表中）。",
    "duplicatesToast": "以下歌曲已存在于其他播放列表中：{{list}}。",
    "alreadyInPlaylists": "“{{title}}”（已在 {{playlists}}）",
    "andMore": "，另有 {{count}} 项",
    "playlistExported": "播放列表已导出。",
    "playlistUpdated": "播放列表已更新。"
  },
  "playlistRail": {
    "all": "全部",
    "favorites": "收藏",
    "missingCount": "缺失 {{count}} 项",
    "newPlaylistPlaceholder": "播放列表名称…",
    "newPlaylist": "新建播放列表",
    "importTitle": "从 .json 文件导入播放列表",
    "import": "导入",
    "deleteTitle": "删除播放列表",
    "cancel": "取消",
    "delete": "删除",
    "deleteConfirm": "确定要删除播放列表“{{name}}”吗？Playlists 文件夹中的对应文件将被永久删除，此操作无法撤销。已下载的歌曲仍会保留在媒体库中。",
    "deletedToast": "播放列表“{{name}}”已删除。",
    "renameTitle": "重命名播放列表",
    "renamePlaceholder": "新的播放列表名称…",
    "save": "保存",
    "renamedToast": "“{{from}}”已更名为“{{to}}”。",
    "renameFailed": "无法重命名播放列表。",
    "importedToast": {
      "other": "已导入 {{count}} 个播放列表。"
    },
    "noneImported": "未导入任何播放列表。"
  },
  "playlistMenu": {
    "empty": "还没有播放列表。",
    "newPlaylist": "新建播放列表",
    "newPlaylistPlaceholder": "新建播放列表…",
    "create": "创建",
    "addToPlaylist": "添加到播放列表",
    "alreadyIn": "“{{title}}”已在 {{playlists}} 中。"
  },
  "libraryItem": {
    "removed": "已移除",
    "fileMissing": "文件未找到",
    "redownload": "重新下载",
    "restore": "恢复",
    "purge": "删除媒体库记录",
    "removeMissing": "从媒体库中移除（文件未找到）",
    "trim": "裁剪 / 转换",
    "favorite": "收藏",
    "openFolder": "打开文件夹",
    "remove": "移除",
    "redownloadQueued": "“{{title}}”已添加到下载队列。",
    "redownloadFailed": "无法重新下载这首歌曲。"
  },
  "editor": {
    "back": "返回",
    "reading": "正在读取文件…",
    "sourceInfo": "{{duration}} · {{size}}",
    "noneTitle": "未选择文件",
    "noneDescription": "打开媒体库，点击条目上的剪刀按钮即可在此裁剪。",
    "preview": "预览",
    "pausePreview": "暂停",
    "selection": "{{start}} → {{end}} · 时长 {{duration}}",
    "outputTitle": "输出内容",
    "targetVideo": "视频",
    "targetAudio": "音频",
    "cutModeTitle": "裁剪方式",
    "precise": "精确",
    "fast": "快速",
    "preciseHint": "重新编码视频，在所选位置精确裁剪。速度较慢。",
    "fastHint": "不重新编码，但裁剪会对齐到最近的关键帧。起点可能提前几秒。",
    "audioFormatTitle": "音频格式",
    "keepFormat": "保持原样",
    "keepFormatHint": "复制原始音频，不改变音质。",
    "convertHint": "转换会重新编码音频，耗时更长。",
    "fpsTitle": "每秒帧数",
    "widthTitle": "宽度",
    "sizeEstimate": "预计大小：{{size}}",
    "tryWebp": "如果需要更小的文件，可以试试 WebP。",
    "export": "导出片段",
    "exporting": "正在导出… {{percent}}%",
    "cancel": "取消",
    "openResult": "打开文件（{{size}}）",
    "exportSuccess": "片段已导出（{{size}}）。",
    "exportFailed": "无法导出片段。"
  },
  "mini": {
    "nothingPlaying": "当前没有播放",
    "openToStart": "打开 Aurora 选择曲目",
    "openApp": "打开 Aurora",
    "hide": "隐藏迷你播放器",
    "play": "播放",
    "pause": "暂停",
    "previous": "上一首",
    "next": "下一首",
    "shuffle": "随机播放",
    "favorite": "收藏"
  },
  "player": {
    "closeVideo": "关闭视频",
    "shuffle": "随机播放",
    "previous": "上一首",
    "next": "下一首",
    "repeat": "循环播放",
    "hideVideo": "隐藏视频",
    "showVideo": "显示视频",
    "volume": "音量"
  },
  "settings": {
    "downloadFolderTitle": "默认下载文件夹",
    "change": "更改",
    "concurrencyTitle": "同时下载数",
    "concurrencySubtitle": "队列中同时下载的项目数（1-20）",
    "depsTitle": "依赖项（yt-dlp / ffmpeg）",
    "ffmpegPathTitle": "FFmpeg 可执行文件",
    "ffmpegBundled": "正在使用应用自带的 FFmpeg。",
    "ffmpegReset": "使用自带版本",
    "depsBundled": "这些工具已包含在应用中。你可以在这里检查 yt-dlp 更新。",
    "depsUpdating": "更新中…",
    "depsUpdate": "更新 yt-dlp",
    "depsUpToDate": "已是最新",
    "depsChecking": "检查中…",
    "depsCheck": "检查更新",
    "depsUpdateAvailable": "yt-dlp 有可用的新版本。",
    "depsAllUpToDate": "yt-dlp 已是最新版本。",
    "depsCheckFailed": "目前无法检查更新。",
    "depsYtdlpUpdated": "yt-dlp 已更新。",
    "depsYtdlpUpdateFailed": "目前无法更新 yt-dlp。",
    "discordTitle": "Discord Rich Presence",
    "discordSubtitle": "在你的 Discord 状态中显示正在收听的歌曲。",
    "discordPreviewLabel": "他人所见状态的预览：",
    "themeTitle": "主题",
    "themeSubtitle": "应用的浅色或深色外观。",
    "themeSwitchToDark": "切换到深色",
    "themeSwitchToLight": "切换到浅色",
    "languageTitle": "语言",
    "languageSubtitle": "应用界面的语言。",
    "playlistsTitle": "已导入的播放列表",
    "playlistsSubtitle": "在此文件夹中为每个播放列表放置一个 .json 文件（id、name、tracks），即可自动导入。",
    "playlistsOpenFolder": "打开文件夹"
  },
  "profile": {
    "changeAvatarTitle": "更改头像",
    "changeAvatarOverlay": "更改",
    "editHint": "点击以编辑",
    "createdAt": "资料创建于 {{date}}",
    "lastAccess": "最近访问于 {{date}}",
    "exportProfile": "导出资料",
    "importProfile": "导入资料",
    "accentTitle": "强调色",
    "accentSubtitle": "更改应用中按钮、光晕和高亮的颜色。",
    "accentCustom": "选择其他颜色",
    "statsDownloads": "已完成下载",
    "statsLibraryItems": "媒体库项目数",
    "statsSpaceUsed": "已占用空间",
    "statsPlaylists": "已创建播放列表",
    "importModalTitle": "导入资料",
    "importModalCancel": "取消",
    "importModalConfirm": "替换当前资料",
    "importModalCreatedAt": "创建于 {{date}}",
    "importModalBody": "此资料将替换当前资料（{{username}}）中的姓名、头像和偏好设置。媒体库和播放列表会保留。",
    "nameUpdated": "姓名已更新。",
    "avatarUpdated": "头像已更新。",
    "exportSuccess": "资料已导出。",
    "importReadFailed": "无法读取该资料文件。",
    "importSuccess": "资料已导入。"
  },
  "libraryStats": {
    "audioCount": {
      "other": "{{count}} 首歌曲"
    },
    "videoCount": {
      "other": "{{count}} 个视频"
    },
    "topFormat": "下载最多的格式",
    "longestPlaylist": "最长的播放列表",
    "trackCount": {
      "other": "{{count}} 首曲目"
    }
  },
  "richPresence": {
    "sourceLabel": "正在收听 {{appName}}",
    "empty": "当前没有正在播放的内容",
    "unavailable": "{{appName}} 当前不可用"
  },
  "errors": {
    "boundaryTitle": "此页面在加载时崩溃了。",
    "boundaryDetail": "{{message}}。完整详情见 设置 → 打开日志文件夹。"
  }
};
