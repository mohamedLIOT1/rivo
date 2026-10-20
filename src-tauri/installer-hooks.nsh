!macro NSIS_HOOK_PREINSTALL
    ; Clean up legacy C# / Photino files if they exist in the installation directory
    RMDir /r "$INSTDIR\bin"
    RMDir /r "$INSTDIR\Profile"
    Delete "$INSTDIR\app.exe"
    Delete "$INSTDIR\WebView2Loader.dll"
!macroend
