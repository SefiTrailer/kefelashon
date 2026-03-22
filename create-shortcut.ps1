$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "Kefel Lashon Manager.lnk"
$CurrentDir = Get-Location
$VbsPath = Join-Path $CurrentDir "run-manager.vbs"
$NodePath = (Get-Command node).Source
$MjsPath = Join-Path $CurrentDir "server-manager.mjs"

# Create the VBScript with absolute paths for reliability
$VbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
' Run the manager script invisibly (0 = hidden)
' Using absolute paths for node and the manager script
WshShell.Run """$NodePath"" ""$MjsPath""", 0, False
"@

$VbsContent | Out-File -FilePath $VbsPath -Encoding Ascii -Force

# Create the Shortcut
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)

$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = """$VbsPath"""
$Shortcut.WorkingDirectory = "$CurrentDir"
$Shortcut.Description = "Manage Kefel Lashon Servers"
$Shortcut.IconLocation = "shell32.dll, 44" # Computer icon
$Shortcut.Save()

Write-Host "✅ VBScript generated with absolute paths: $VbsPath" -ForegroundColor Cyan
Write-Host "✅ Shortcut updated on Desktop: $ShortcutPath" -ForegroundColor Green
