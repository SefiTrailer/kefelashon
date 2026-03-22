$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "Kefel Lashon Manager.lnk"
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)

# Get the directory where the script is located
$CurrentDir = Get-Location

$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = """$CurrentDir\run-manager.vbs"""
$Shortcut.WorkingDirectory = "$CurrentDir"
$Shortcut.Description = "Manage Kefel Lashon Servers"
$Shortcut.IconLocation = "shell32.dll, 44" # Computer icon
$Shortcut.Save()

Write-Host "✅ Shortcut created on Desktop: $ShortcutPath" -ForegroundColor Green
