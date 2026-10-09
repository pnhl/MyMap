param([Parameter(Mandatory=$true)][string]$ApkPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-DexString([byte[]]$Data, [uint32]$Index) {
    $table = [BitConverter]::ToUInt32($Data, 60)
    $position = [BitConverter]::ToUInt32($Data, $table + 4 * $Index)
    # Skip the unsigned LEB128 UTF-16 length. All queried descriptors are ASCII.
    do { $part = $Data[$position]; $position++ } while (($part -band 128) -ne 0)
    $end = $position
    while ($Data[$end] -ne 0) { $end++ }
    return [Text.Encoding]::UTF8.GetString($Data, $position, $end - $position)
}

$archive = [IO.Compression.ZipFile]::OpenRead([IO.Path]::GetFullPath($ApkPath))
$required = @{
    'Llivekit/org/jni_zero/JniInit;' = 'init'
    'Lexpo/modules/adapters/react/apploader/RNHeadlessAppLoader;' = '<init>'
}
$verified = @{}
try {
    foreach ($entry in $archive.Entries) {
        if ($entry.FullName -notmatch '^classes\d*\.dex$') { continue }
        $stream = $entry.Open()
        $memory = [IO.MemoryStream]::new()
        try { $stream.CopyTo($memory); $data = $memory.ToArray() }
        finally { $stream.Dispose(); $memory.Dispose() }
        if ([Text.Encoding]::ASCII.GetString($data, 0, 4) -ne "dex`n") {
            throw "Unsupported DEX format in $($entry.FullName)"
        }
        $typeTable = [BitConverter]::ToUInt32($data, 68)
        $classCount = [BitConverter]::ToUInt32($data, 96)
        $classTable = [BitConverter]::ToUInt32($data, 100)
        for ($i = 0; $i -lt $classCount; $i++) {
            $typeIndex = [BitConverter]::ToUInt32($data, $classTable + 32 * $i)
            $nameIndex = [BitConverter]::ToUInt32($data, $typeTable + 4 * $typeIndex)
            $descriptor = Read-DexString $data $nameIndex
            if (!$required.ContainsKey($descriptor)) { continue }
            # A string reference alone is insufficient: require a real class_def
            # and its non-obfuscated init method, called directly from JNI_OnLoad.
            $methodCount = [BitConverter]::ToUInt32($data, 88)
            $methodTable = [BitConverter]::ToUInt32($data, 92)
            for ($m = 0; $m -lt $methodCount; $m++) {
                $offset = $methodTable + 8 * $m
                if ([BitConverter]::ToUInt16($data, $offset) -ne $typeIndex) { continue }
                $methodName = Read-DexString $data ([BitConverter]::ToUInt32($data, $offset + 4))
                if ($methodName -eq $required[$descriptor]) { $verified[$descriptor] = $true; break }
            }
            if (!$verified.ContainsKey($descriptor)) { throw "Missing required method $descriptor $($required[$descriptor])" }
            if ($verified.Count -eq $required.Count) { break }
        }
        if ($verified.Count -eq $required.Count) { break }
    }
} finally { $archive.Dispose() }
$missing = @($required.Keys | Where-Object { !$verified.ContainsKey($_) })
if ($missing.Count -gt 0) { throw "Release startup check failed: missing class definitions in APK DEX: $($missing -join ', ')" }
Write-Output "Verified APK startup entries: LiveKit JniInit.init and Expo RNHeadlessAppLoader constructor — $ApkPath"
