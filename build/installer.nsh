; Overrides electron-builder's default "app is running" check.
;
; The default (app-builder-lib/templates/nsis/include/allowOnlyOneInstallerInstance.nsh)
; pops a modal asking the user to close the app, and if the process is still
; found after two retries it gives up with "Não é possível fechar o Aurora
; Downloader". A *minimized* window counts as running, so users who never
; actually quit the app hit that dead end with no way forward.
;
; Closing the app is something the installer can just do, so it does: ask
; politely first (WM_CLOSE, letting the app flush its state), then force it.

!macro customCheckAppRunning
  ; Check first: a fresh install is the common case, and the waits below are
  ; pure dead time when there is nothing to close.
  !insertmacro IS_POWERSHELL_AVAILABLE
  !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
  ${if} $R0 == 0
    DetailPrint `Encerrando o "${PRODUCT_NAME}"...`

    ; No /f — this sends WM_CLOSE, so the app runs its own shutdown path
    ; (window-all-closed → Discord disconnect → app.quit).
    nsExec::Exec `%SYSTEMROOT%\System32\taskkill.exe /im "${APP_EXECUTABLE_FILENAME}"`
    Pop $R0
    Sleep 2000

    ; Electron's helper processes (gpu/renderer/utility) share the executable
    ; name but have no window, so WM_CLOSE never reaches them — whatever is
    ; left after the graceful attempt has to be killed outright, /t to take
    ; the whole tree with it.
    nsExec::Exec `%SYSTEMROOT%\System32\taskkill.exe /f /t /im "${APP_EXECUTABLE_FILENAME}"`
    Pop $R0

    ; Windows releases the file handles slightly after the process objects
    ; die; overwriting the install folder too early still hits a sharing
    ; violation.
    Sleep 1500
  ${endif}
!macroend
