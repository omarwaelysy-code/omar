$memberDefinition = @'
[DllImport("ntdll.dll")]
public static extern int NtQueryInformationProcess(
    IntPtr processHandle,
    int processInformationClass,
    ref PROCESS_BASIC_INFORMATION processInformation,
    int processInformationLength,
    ref int returnLength);

[DllImport("kernel32.dll")]
public static extern IntPtr OpenProcess(
    int dwDesiredAccess,
    bool bInheritHandle,
    int dwProcessId);

[DllImport("kernel32.dll")]
public static extern bool ReadProcessMemory(
    IntPtr hProcess,
    IntPtr lpBaseAddress,
    byte[] lpBuffer,
    int dwSize,
    ref int lpNumberOfBytesRead);

[DllImport("kernel32.dll")]
public static extern bool CloseHandle(IntPtr handle);

[StructLayout(LayoutKind.Sequential)]
public struct PROCESS_BASIC_INFORMATION {
    public IntPtr Reserved1;
    public IntPtr PebBaseAddress;
    public IntPtr Reserved2_0;
    public IntPtr Reserved2_1;
    public IntPtr UniqueProcessId;
    public IntPtr Reserved3;
}
'@

if (-not ([Ref].Assembly.GetType("ProcessEnv.Win32") -ne $null)) {
    Add-Type -MemberDefinition $memberDefinition -Name "Win32" -Namespace "ProcessEnv"
}

function Get-ProcessEnvironment {
    param(
        [Parameter(Mandatory=$true)]
        [int]$ProcessId
    )

    $PROCESS_QUERY_INFORMATION = 0x0400
    $PROCESS_VM_READ = 0x0010
    $access = $PROCESS_QUERY_INFORMATION -bor $PROCESS_VM_READ
    
    $hProcess = [ProcessEnv.Win32]::OpenProcess($access, $false, $ProcessId)
    if ($hProcess -eq [IntPtr]::Zero) {
        Write-Host "  Failed to open process $ProcessId"
        return
    }

    try {
        $pbi = New-Object ProcessEnv.Win32+PROCESS_BASIC_INFORMATION
        $rtnLen = 0
        $status = [ProcessEnv.Win32]::NtQueryInformationProcess($hProcess, 0, [ref]$pbi, [System.Runtime.InteropServices.Marshal]::SizeOf($pbi), [ref]$rtnLen)
        
        if ($status -ne 0) {
            Write-Host "  NtQueryInformationProcess failed with status $status"
            return
        }

        $pebAddr = $pbi.PebBaseAddress
        if ($pebAddr -eq [IntPtr]::Zero) {
            Write-Host "  PEB address is null"
            return
        }

        # Offset to ProcessParameters in PEB (64-bit: 0x20)
        $procParamsOffset = 0x20
        $procParamsPtrAddr = [IntPtr]($pebAddr.ToInt64() + $procParamsOffset)
        
        $ptrBuf = New-Object byte[] 8
        $bytesRead = 0
        if (-not [ProcessEnv.Win32]::ReadProcessMemory($hProcess, $procParamsPtrAddr, $ptrBuf, 8, [ref]$bytesRead)) {
            Write-Host "  Failed to read ProcessParameters pointer"
            return
        }
        
        $procParamsAddr = [IntPtr][BitConverter]::ToInt64($ptrBuf, 0)
        if ($procParamsAddr -eq [IntPtr]::Zero) {
            Write-Host "  ProcessParameters address is null"
            return
        }

        # Offset to Environment in RTL_USER_PROCESS_PARAMETERS (64-bit: 0x80)
        $envOffset = 0x80
        $envPtrAddr = [IntPtr]($procParamsAddr.ToInt64() + $envOffset)
        
        if (-not [ProcessEnv.Win32]::ReadProcessMemory($hProcess, $envPtrAddr, $ptrBuf, 8, [ref]$bytesRead)) {
            Write-Host "  Failed to read Environment pointer"
            return
        }
        
        $envAddr = [IntPtr][BitConverter]::ToInt64($ptrBuf, 0)
        if ($envAddr -eq [IntPtr]::Zero) {
            Write-Host "  Environment address is null"
            return
        }

        # Read environment block memory.
        $envSize = 32768
        $envBuf = New-Object byte[] $envSize
        if (-not [ProcessEnv.Win32]::ReadProcessMemory($hProcess, $envAddr, $envBuf, $envSize, [ref]$bytesRead)) {
            Write-Host "  Failed to read Environment block"
            return
        }

        $envStr = [System.Text.Encoding]::Unicode.GetString($envBuf, 0, $bytesRead)
        $vars = $envStr -split "`0"
        foreach ($var in $vars) {
            if (-not [string]::IsNullOrEmpty($var)) {
                Write-Output "  $var"
            }
        }
    }
    catch {
        Write-Host "  Error occurred: $_"
    }
    finally {
        [void][ProcessEnv.Win32]::CloseHandle($hProcess)
    }
}

Get-Process -Name "Antigravity" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Process ID: $($_.Id) ($($_.ProcessName))"
    Get-ProcessEnvironment -ProcessId $_.Id
}
