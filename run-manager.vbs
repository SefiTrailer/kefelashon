Set WshShell = CreateObject("WScript.Shell")
' Run the manager script invisibly (0 = hidden)
WshShell.Run "node server-manager.mjs", 0, False
