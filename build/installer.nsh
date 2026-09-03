; ClassCore NSIS — Cleanup legacy per-user shortcuts
!macro customInit
  ; Switch to current user context to delete the old stale shortcut from the User Desktop
  SetShellVarContext current
  Delete "$DESKTOP\ClassCore.lnk"
  
  ; Switch back to all users context so standard installation (perMachine) continues properly
  SetShellVarContext all
!macroend
