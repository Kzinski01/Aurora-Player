// Textos da interface. Preserve as variáveis {{...}} ao traduzir.
export default {
  "nav": {
    "download": "ダウンロード",
    "queue": "キュー",
    "library": "ライブラリ",
    "settings": "設定",
    "profile": "プロフィール"
  },
  "topbar": {
    "download": {
      "title": "メディアをダウンロード",
      "subtitle": "動画、曲、プレイリスト全体のリンクを1つ以上貼り付けてください。"
    },
    "queue": {
      "title": "ダウンロードキュー",
      "subtitle": "進行状況をリアルタイムで確認できます。"
    },
    "library": {
      "title": "ライブラリ",
      "subtitle": "ダウンロードしたものすべてを1か所に。"
    },
    "settings": {
      "title": "設定",
      "subtitle": "ダウンロード、変換、アプリの設定。"
    },
    "profile": {
      "title": "プロフィール",
      "subtitle": "ローカルプロフィール、統計情報、プロフィールのバックアップ。"
    },
    "editor": {
      "title": "切り出しと変換",
      "subtitle": "範囲を選び、出力形式を選択します：動画・音声・GIF・WebP。"
    },
    "detailsPanel": "詳細パネル"
  },
  "rightPanel": {
    "heading": "次に再生",
    "empty": "再生キューには何もありません"
  },
  "download": {
    "placeholder": "YouTube、Instagram、Twitchのリンクを1つ以上(1行に1件)貼り付けるか、曲・動画名を入力して検索してください…",
    "searching": "検索中…",
    "search": "検索",
    "noResultsFor": "「{{query}}」の検索結果が見つかりませんでした。",
    "needLinkOrQuery": "YouTube/Instagram/Twitchのリンクを貼り付けるか、曲・動画名を入力してください。",
    "analyzeFailed": "{{url}} の解析に失敗しました: {{message}}",
    "emptyTitle": "まだリンクが解析されていません",
    "emptySubtitle": "リンクを貼り付けるか曲・動画名を入力すると、タイトル、チャンネル、解像度、利用可能な形式が表示されます。"
  },
  "resultCard": {
    "addedToQueue": "ダウンロードキューに追加しました。",
    "addToQueueFailed": "キューに追加できませんでした: {{error}}",
    "bestAvailable": "利用可能な最高品質",
    "playlistSuffix": " · プレイリスト · {{count}} 件",
    "video": "動画",
    "audio": "音声",
    "addToQueue": "キューに追加"
  },
  "queue": {
    "emptyTitle": "まだキューには何もありません",
    "emptySubtitle": "「ダウンロード」タブでリンクを貼り付けて始めましょう。"
  },
  "queueItem": {
    "audioLabel": "音声 · {{format}}",
    "videoLabel": "動画",
    "videoLabelRes": "動画 · {{resolution}}p",
    "eta": "残り {{eta}}",
    "pause": "一時停止",
    "resume": "再開",
    "cancel": "キャンセル",
    "openFolder": "フォルダを開く",
    "remove": "削除",
    "status": {
      "aguardando": "待機中",
      "pausado": "一時停止中",
      "baixando": "ダウンロード中",
      "convertendo": "変換中",
      "concluído": "完了",
      "erro": "エラー",
      "cancelado": "キャンセル済み"
    }
  },
  "library": {
    "addToPlaylist": "プレイリストに追加",
    "cancelSelection": "選択を解除",
    "searchPlaceholder": "タイトルで検索…",
    "selected": {
      "other": "{{count}} 件選択中"
    },
    "addAll": "すべて選択",
    "noPlaylists": "プレイリストがありません",
    "addCount": "追加 ({{count}})",
    "missingTracksImported": {
      "other": "{{count}} 曲はまだダウンロードされていません。{{file}} からインポート"
    },
    "missingTracks": {
      "other": "{{count}} 曲はまだダウンロードされていません"
    },
    "tracksInPlaylist": {
      "other": "このプレイリストには {{count}} 曲あります"
    },
    "refresh": "更新",
    "downloading": "ダウンロード中…",
    "downloadMissing": "不足分をダウンロード",
    "export": "エクスポート",
    "untitledTrack": "タイトルなしのトラック",
    "removeFromPlaylist": "このプレイリストから削除",
    "emptyTitle": "アイテムが見つかりません",
    "emptySubtitle": "「ダウンロード」タブで何かダウンロードするか、フィルターを調整してください。",
    "queuedToast": {
      "other": "{{count}} 曲をキューに追加しました。"
    },
    "alreadyLinkedToast": {
      "other": "{{count}} 曲はすでにライブラリにあり、紐付けました。"
    },
    "nothingToDownload": "ダウンロードするものはありません。すべて揃っています。",
    "addedToPlaylistToast": {
      "other": "{{count}} 曲をプレイリストに追加しました。"
    },
    "noNewToAdd": "追加できる新しい曲はありません(すでにプレイリストにあります)。",
    "duplicatesToast": "他のプレイリストに既にある曲: {{list}}",
    "alreadyInPlaylists": "「{{title}}」(既に {{playlists}} にあります)",
    "andMore": " ほか {{count}} 件",
    "playlistExported": "プレイリストをエクスポートしました。",
    "playlistUpdated": "プレイリストを更新しました。"
  },
  "playlistRail": {
    "all": "すべて",
    "favorites": "お気に入り",
    "missingCount": "{{count}} 件不足",
    "newPlaylistPlaceholder": "プレイリスト名…",
    "newPlaylist": "新しいプレイリスト",
    "importTitle": ".jsonファイルからプレイリストをインポート",
    "import": "インポート",
    "deleteTitle": "プレイリストを削除",
    "cancel": "キャンセル",
    "delete": "削除",
    "deleteConfirm": "プレイリスト「{{name}}」を削除してもよろしいですか?Playlistsフォルダ内のファイルは完全に削除され、元に戻せません。ダウンロード済みの曲はライブラリに残ります。",
    "deletedToast": "プレイリスト「{{name}}」を削除しました。",
    "renameTitle": "プレイリスト名を変更",
    "renamePlaceholder": "新しいプレイリスト名…",
    "save": "保存",
    "renamedToast": "「{{from}}」を「{{to}}」に変更しました。",
    "renameFailed": "プレイリスト名を変更できませんでした。",
    "importedToast": {
      "other": "{{count}} 件のプレイリストをインポートしました。"
    },
    "noneImported": "インポートされたプレイリストはありません。"
  },
  "playlistMenu": {
    "empty": "まだプレイリストがありません。",
    "newPlaylist": "新しいプレイリスト",
    "newPlaylistPlaceholder": "新しいプレイリスト…",
    "create": "作成",
    "addToPlaylist": "プレイリストに追加",
    "alreadyIn": "「{{title}}」は既に {{playlists}} にあります。"
  },
  "libraryItem": {
    "removed": "削除済み",
    "fileMissing": "ファイルが見つかりません",
    "redownload": "再ダウンロード",
    "restore": "復元",
    "purge": "ライブラリの登録を削除",
    "removeMissing": "ライブラリから削除(ファイルが見つかりません)",
    "trim": "切り出し / 変換",
    "favorite": "お気に入り",
    "openFolder": "フォルダを開く",
    "remove": "削除",
    "redownloadQueued": "「{{title}}」をダウンロードキューに追加しました。",
    "redownloadFailed": "この曲を再ダウンロードできませんでした。"
  },
  "editor": {
    "back": "戻る",
    "reading": "ファイルを読み込み中…",
    "sourceInfo": "{{duration}} · {{size}}",
    "noneTitle": "ファイルが選択されていません",
    "noneDescription": "ライブラリでアイテムのハサミボタンを押すと、ここで切り出せます。",
    "preview": "プレビュー",
    "pausePreview": "一時停止",
    "selection": "{{start}} → {{end}} · 長さ {{duration}}",
    "outputTitle": "出力する形式",
    "targetVideo": "動画",
    "targetAudio": "音声",
    "cutModeTitle": "カットの種類",
    "precise": "正確",
    "fast": "高速",
    "preciseHint": "動画を再エンコードし、指定した位置で正確に切ります。時間がかかります。",
    "fastHint": "再エンコードしませんが、最も近いキーフレームに合わせて切るため、開始が数秒早くなることがあります。",
    "audioFormatTitle": "音声フォーマット",
    "keepFormat": "元のまま",
    "keepFormatHint": "元の音声を品質を変えずにコピーします。",
    "convertHint": "変換すると音声を再エンコードするため時間がかかります。",
    "fpsTitle": "フレームレート",
    "widthTitle": "幅",
    "sizeEstimate": "推定サイズ: {{size}}",
    "tryWebp": "ファイルを小さくしたい場合は WebP を試してください。",
    "export": "切り出して書き出す",
    "exporting": "書き出し中… {{percent}}%",
    "cancel": "キャンセル",
    "openResult": "ファイルを開く ({{size}})",
    "exportSuccess": "切り出しました ({{size}})。",
    "exportFailed": "切り出しに失敗しました。"
  },
  "mini": {
    "nothingPlaying": "再生中の曲はありません",
    "openToStart": "Aurora を開いて曲を選択してください",
    "openApp": "Aurora を開く",
    "hide": "ミニプレーヤーを隠す",
    "play": "再生",
    "pause": "一時停止",
    "previous": "前へ",
    "next": "次へ",
    "shuffle": "シャッフル",
    "favorite": "お気に入り"
  },
  "player": {
    "closeVideo": "動画を閉じる",
    "shuffle": "シャッフル",
    "previous": "前へ",
    "next": "次へ",
    "repeat": "リピート",
    "hideVideo": "動画を隠す",
    "showVideo": "動画を表示",
    "volume": "音量"
  },
  "settings": {
    "downloadFolderTitle": "既定のダウンロードフォルダ",
    "change": "変更",
    "concurrencyTitle": "同時ダウンロード数",
    "concurrencySubtitle": "キューのうち同時にダウンロードする件数(1〜20)",
    "depsTitle": "依存関係 (yt-dlp / ffmpeg)",
    "ffmpegPathTitle": "FFmpeg 実行ファイル",
    "ffmpegBundled": "アプリに付属する FFmpeg を使用中です。",
    "ffmpegReset": "付属版を使用",
    "depsBundled": "これらのツールはアプリに含まれています。ここで yt-dlp の更新を確認できます。",
    "depsUpdating": "更新中…",
    "depsUpdate": "yt-dlpを更新",
    "depsUpToDate": "最新です",
    "depsChecking": "確認中…",
    "depsCheck": "更新を確認",
    "depsUpdateAvailable": "yt-dlpの新しいバージョンがあります。",
    "depsAllUpToDate": "yt-dlp は最新です。",
    "depsCheckFailed": "現在、更新を確認できませんでした。",
    "depsYtdlpUpdated": "yt-dlpを更新しました。",
    "depsYtdlpUpdateFailed": "現在、yt-dlpを更新できませんでした。",
    "discordTitle": "Discord Rich Presence",
    "discordSubtitle": "再生中の曲をDiscordのステータスに表示します。",
    "discordPreviewLabel": "他の人に表示されるステータスのプレビュー:",
    "themeTitle": "テーマ",
    "themeSubtitle": "アプリの外観をライトまたはダークにします。",
    "themeSwitchToDark": "ダークに切り替え",
    "themeSwitchToLight": "ライトに切り替え",
    "languageTitle": "言語",
    "languageSubtitle": "アプリのインターフェース言語。",
    "playlistsTitle": "インポートされたプレイリスト",
    "playlistsSubtitle": "このフォルダにプレイリストごとの.jsonファイル(id, name, tracks)を置くと自動でインポートされます。",
    "playlistsOpenFolder": "フォルダを開く"
  },
  "profile": {
    "changeAvatarTitle": "プロフィール写真を変更",
    "changeAvatarOverlay": "変更",
    "editHint": "クリックして編集",
    "createdAt": "プロフィール作成日: {{date}}",
    "lastAccess": "最終アクセス: {{date}}",
    "exportProfile": "プロフィールをエクスポート",
    "importProfile": "プロフィールをインポート",
    "accentTitle": "アクセントカラー",
    "accentSubtitle": "アプリ全体のボタン・グロー・強調表示の色を変更します。",
    "accentCustom": "別の色を選ぶ",
    "statsDownloads": "完了したダウンロード",
    "statsLibraryItems": "ライブラリ内のアイテム数",
    "statsSpaceUsed": "使用容量",
    "statsPlaylists": "作成したプレイリスト数",
    "importModalTitle": "プロフィールをインポート",
    "importModalCancel": "キャンセル",
    "importModalConfirm": "現在のプロフィールを置き換える",
    "importModalCreatedAt": "作成日: {{date}}",
    "importModalBody": "現在のプロフィール({{username}})の名前、写真、設定が、このプロフィールに置き換わります。ライブラリとプレイリストは保持されます。",
    "nameUpdated": "名前を更新しました。",
    "avatarUpdated": "プロフィール写真を更新しました。",
    "exportSuccess": "プロフィールをエクスポートしました。",
    "importReadFailed": "このプロフィールファイルを読み込めませんでした。",
    "importSuccess": "プロフィールをインポートしました。"
  },
  "libraryStats": {
    "audioCount": {
      "other": "{{count}} 曲"
    },
    "videoCount": {
      "other": "{{count}} 本の動画"
    },
    "topFormat": "最もダウンロードされた形式",
    "longestPlaylist": "最長のプレイリスト",
    "trackCount": {
      "other": "{{count}} トラック"
    }
  },
  "richPresence": {
    "sourceLabel": "{{appName}} で再生中",
    "empty": "現在再生中のものはありません",
    "unavailable": "{{appName}} は利用できません"
  },
  "errors": {
    "boundaryTitle": "この画面は読み込み中にクラッシュしました。",
    "boundaryDetail": "{{message}}。詳細は 設定 → ログフォルダを開く をご覧ください。"
  }
};
