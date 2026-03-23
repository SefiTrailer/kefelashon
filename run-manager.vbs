Set WshShell = CreateObject("WScript.Shell")
' Run the manager script invisibly (0 = hidden)
' Using absolute paths for node and the manager script
WshShell.Run """C:\Program Files\nodejs\node.exe"" ""C:\Users\Sefi\projects\kefel-lashon\server-manager.mjs""", 0, False
