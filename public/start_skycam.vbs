Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c start_skycam.bat", 0
Set WshShell = Nothing