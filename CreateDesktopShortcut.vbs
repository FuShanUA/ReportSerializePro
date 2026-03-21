Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
strPath = objFSO.GetParentFolderName(WScript.ScriptFullName)

' 如果当前环境存在 D:\Desktop 则优先使用 (适配您的个人习惯)
' 否则回退到 Windows 默认分配的桌面路径 (适配其他用户的原生环境)
If objFSO.FolderExists("D:\Desktop") Then
    strDesktop = "D:\Desktop"
Else
    strDesktop = WshShell.SpecialFolders("Desktop")
End If

Set oShellLink = WshShell.CreateShortcut(strDesktop & "\深度报告连载神器.lnk")
oShellLink.TargetPath = strPath & "\RunReportSerializePro.vbs"
oShellLink.WindowStyle = 1
oShellLink.Description = "深度报告连载神器 (ReportSerialize Pro)"
oShellLink.WorkingDirectory = strPath
oShellLink.IconLocation = strPath & "\favicon_v2.ico"
oShellLink.Save

MsgBox "桌面快捷方式已成功创建到 " & strDesktop & "！" & vbCrLf & "Desktop shortcut has been successfully created!", 64, "安装完成 (Installation Complete)"
