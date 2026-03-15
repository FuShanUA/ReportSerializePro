Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File ""D:\cc\Library\Tools\reportserialize-pro\demo\launch_reportserialize.ps1""", 0, False
