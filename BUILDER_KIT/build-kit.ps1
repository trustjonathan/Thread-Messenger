<#
.SYNOPSIS
    Thread Messenger Builder Kit — copies contract files into a sandbox directory.

.DESCRIPTION
    Copies the frozen contract files and the mock API into a target sandbox
    directory so builders (Lovable, Bolt, Replit, etc.) can develop UI features
    offline without touching the real Supabase backend.

    A stub src/lib/api.ts that re-exports the mock is also written so the
    sandbox resolves @/lib/apiClient correctly without credentials.

.PARAMETER TargetDir
    Path to the sandbox directory. The src/ sub-tree will be created inside it.

.PARAMETER Force
    Overwrite existing files without prompting.

.EXAMPLE
    .\BUILDER_KIT\build-kit.ps1 -TargetDir "C:\sandbox\my-feature"

.EXAMPLE
    .\BUILDER_KIT\build-kit.ps1 -TargetDir "C:\sandbox\my-feature" -Force

.NOTES
    NEVER commit the generated stub src/lib/api.ts back to main.
    NEVER add secrets to any copied file.
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory = $true, HelpMessage = "Target sandbox directory")]
    [string]$TargetDir,

    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Resolve source root (repo root is one level above BUILDER_KIT/) ──────────
$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot   = Split-Path -Parent $scriptDir

function Copy-ContractFile {
    param (
        [string]$RelativePath,
        [string]$Content = $null
    )

    $dest = Join-Path $TargetDir $RelativePath
    $destDir = Split-Path -Parent $dest

    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }

    if ($Content) {
        # Write generated content
        if ((Test-Path $dest) -and -not $Force) {
            Write-Warning "SKIP (already exists, use -Force to overwrite): $dest"
            return
        }
        Set-Content -Path $dest -Value $Content -Encoding UTF8
        Write-Host "  WROTE  $RelativePath"
    } else {
        # Copy from repo
        $src = Join-Path $repoRoot $RelativePath
        if (-not (Test-Path $src)) {
            Write-Error "Source file not found: $src"
            return
        }
        if ((Test-Path $dest) -and -not $Force) {
            Write-Warning "SKIP (already exists, use -Force to overwrite): $dest"
            return
        }
        Copy-Item -Path $src -Destination $dest -Force:$Force
        Write-Host "  COPIED $RelativePath"
    }
}

Write-Host ""
Write-Host "Thread Messenger Builder Kit"
Write-Host "============================="
Write-Host "Source : $repoRoot"
Write-Host "Target : $TargetDir"
Write-Host ""

# ── 1. Contract types ─────────────────────────────────────────────────────────
Write-Host "[ Contract types ]"
Copy-ContractFile "src\types\api.ts"
Copy-ContractFile "src\types\database.ts"

# ── 2. API client entry point ─────────────────────────────────────────────────
Write-Host ""
Write-Host "[ API client ]"
Copy-ContractFile "src\lib\apiClient.ts"
Copy-ContractFile "src\lib\api.mock.ts"

# ── 3. Stub api.ts that re-exports mock (sandbox only) ───────────────────────
Write-Host ""
Write-Host "[ Sandbox stub: src/lib/api.ts ]"
$stubContent = @"
/**
 * SANDBOX STUB — do not commit to main.
 *
 * In this sandbox, api.ts re-exports the mock so @/lib/apiClient resolves
 * correctly without real Supabase credentials.
 *
 * The real src/lib/api.ts (Supabase implementation) lives in the main repo.
 */
export * from './api.mock';
"@
Copy-ContractFile "src\lib\api.ts" -Content $stubContent

# ── 4. Env example (names only, no secrets) ───────────────────────────────────
Write-Host ""
Write-Host "[ .env.example ]"
Copy-ContractFile ".env.example"

Write-Host ""
Write-Host "Done. Next steps:"
Write-Host "  1. cd $TargetDir"
Write-Host "  2. npm install  (if package.json not yet present, copy it from the repo)"
Write-Host "  3. Set `$env:VITE_USE_MOCK_API = 'true'"
Write-Host "  4. npm run dev"
Write-Host ""
Write-Host "Remember: import ONLY from '@/lib/apiClient'. Never edit contract files."
Write-Host ""
