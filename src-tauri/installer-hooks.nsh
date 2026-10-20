!macro NSIS_HOOK_PREINSTALL
    ; Clean up legacy C# / Photino files if they exist in the installation directory
    RMDir /r "$INSTDIR\bin"
    RMDir /r "$INSTDIR\Profile"
    Delete "$INSTDIR\app.exe"
    Delete "$INSTDIR\WebView2Loader.dll"

    ; Clean up old versioned executables, backups, and temporary files from previous updates
    Delete "$INSTDIR\Rivo-v*.exe"
    Delete "$INSTDIR\*.old"
    Delete "$INSTDIR\*.tmp"
    Delete "$INSTDIR\*.bak"
    Delete "$INSTDIR\*.sig"
!macroend

!macro NSIS_HOOK_POSTINSTALL
    ; Purge leftover updater installer artifacts from Temp and AppData
    Delete "$LOCALAPPDATA\com.rivo.desktop\updater\*.exe"
    Delete "$LOCALAPPDATA\com.rivo.desktop\updater\*.zip"
    Delete "$LOCALAPPDATA\com.rivo.desktop\updater\*.tar.gz"
    Delete "$LOCALAPPDATA\com.rivo.desktop\updater\*.sig"
    Delete "$TEMP\Rivo*.exe"
    Delete "$TEMP\tauri-update*.exe"
!macroend
