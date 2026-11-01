' Launch the journal with pythonw (no console window, nothing flashes).
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = base
On Error Resume Next
sh.Run "pythonw """ & base & "\main.py""", 0, False
If Err.Number <> 0 Then
    Err.Clear
    sh.Run "python """ & base & "\main.py""", 0, False
End If
