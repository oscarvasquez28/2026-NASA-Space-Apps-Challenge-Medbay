<#
.SYNOPSIS
    Fast, low-cost hackathon deployment of backend and frontend to Google Cloud Run.

.DESCRIPTION
    Deploys ./backend and ./frontend directly from source to Cloud Run.
    Automatically loads variables from .env in the repository root (or -EnvFile)
    if present; explicit CLI parameters and existing shell env vars take precedence.

.EXAMPLE
    .\scripts\deploy-gcp.ps1

.EXAMPLE
    .\scripts\deploy-gcp.ps1 -EnvFile .env.gcp -BackendMinInstances 1
#>
[CmdletBinding()]
param(
    [string]$EnvFile = "",
    [string]$ProjectId = "",
    [string]$Region = "",
    [string]$BackendService = "",
    [string]$FrontendService = "",
    [ValidateSet("", "deterministic", "hybrid", "ai_advisory")]
    [string]$TriageMode = "",
    [string]$GeminiApiKey = "",
    [string]$VertexAiModel = "",
    [string]$ElevenLabsApiKey = "",
    [string]$ElevenLabsVoiceId = "",
    [string]$GcsBucketName = "",
    [string]$OllamaBaseUrl = "",
    [string]$DatabaseUrl = "",
    [string]$AstronautIds = "",
    [ValidateSet("", "rest", "mock")]
    [string]$DataProvider = "",
    [Nullable[int]]$BackendMinInstances = $null
)

$ErrorActionPreference = "Stop"

function Read-DotEnvFile {
    param([Parameter(Mandatory)][string]$Path)
    $map = @{}
    foreach ($rawLine in Get-Content -LiteralPath $Path -Encoding UTF8) {
        $line = $rawLine.Trim()
        if (-not $line -or $line.StartsWith("#")) { continue }
        if ($line.StartsWith("export ")) { $line = $line.Substring(7).Trim() }
        $eqIdx = $line.IndexOf("=")
        if ($eqIdx -lt 1) { continue }
        $key = $line.Substring(0, $eqIdx).Trim()
        $val = $line.Substring($eqIdx + 1).Trim()
        if (($val.StartsWith('"') -and $val.EndsWith('"') -and $val.Length -ge 2) -or
            ($val.StartsWith("'") -and $val.EndsWith("'") -and $val.Length -ge 2)) {
            $val = $val.Substring(1, $val.Length - 2)
        }
        $map[$key] = $val
    }
    return $map
}

function Resolve-Setting {
    param(
        [string]$ParamValue,
        [string]$EnvName,
        [hashtable]$DotEnv,
        [string]$DefaultValue = ""
    )
    if ($ParamValue) { return $ParamValue }
    $envVal = [Environment]::GetEnvironmentVariable($EnvName)
    if ($envVal) { return $envVal }
    if ($DotEnv.ContainsKey($EnvName) -and $DotEnv[$EnvName]) { return $DotEnv[$EnvName] }
    return $DefaultValue
}

function Invoke-Gcloud {
    param([Parameter(Mandatory)][string[]]$GcloudArgs)
    # Windows PowerShell 5.1 treats stderr from native tools as terminating when ErrorActionPreference=Stop.
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & gcloud @GcloudArgs
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $prev
    }
    if ($code -ne 0) {
        $subcmd = ($GcloudArgs | Select-Object -First 3) -join " "
        throw "gcloud $subcmd failed with exit code $code."
    }
}

function Get-GcloudValue {
    param([Parameter(Mandatory)][string[]]$GcloudArgs)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $result = (& gcloud @GcloudArgs 2>$null)
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $prev
    }
    if ($code -ne 0) {
        throw "gcloud $($GcloudArgs -join ' ') failed with exit code $code."
    }
    return ($result | Out-String).Trim()
}

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    throw "Google Cloud CLI (gcloud) is not installed or not in PATH. Install it from https://cloud.google.com/sdk/docs/install"
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$BackendDir = Join-Path $RepoRoot "backend"
$FrontendDir = Join-Path $RepoRoot "frontend"

$dotEnvMap = @{}
if ($EnvFile) {
    $resolvedEnvPath = if ([System.IO.Path]::IsPathRooted($EnvFile)) { $EnvFile } else { Join-Path $RepoRoot $EnvFile }
    if (-not (Test-Path -LiteralPath $resolvedEnvPath)) {
        throw "Specified env file not found: $resolvedEnvPath"
    }
    Write-Host "==> Loading env file: $resolvedEnvPath" -ForegroundColor Cyan
    $dotEnvMap = Read-DotEnvFile -Path $resolvedEnvPath
}
else {
    $defaultEnvPath = Join-Path $RepoRoot ".env"
    if (Test-Path -LiteralPath $defaultEnvPath) {
        Write-Host "==> Loading default env file: $defaultEnvPath" -ForegroundColor Cyan
        $dotEnvMap = Read-DotEnvFile -Path $defaultEnvPath
    }
}

$ProjectId = Resolve-Setting $ProjectId "GCP_PROJECT_ID" $dotEnvMap
$Region = Resolve-Setting $Region "GCP_REGION" $dotEnvMap "us-central1"
$BackendService = Resolve-Setting $BackendService "CLOUD_RUN_BACKEND_SERVICE" $dotEnvMap "astronaut-triage-backend"
$FrontendService = Resolve-Setting $FrontendService "CLOUD_RUN_FRONTEND_SERVICE" $dotEnvMap "astronaut-triage-frontend"
$TriageMode = Resolve-Setting $TriageMode "TRIAGE_MODE" $dotEnvMap "deterministic"
$GeminiApiKey = Resolve-Setting $GeminiApiKey "GEMINI_API_KEY" $dotEnvMap
$VertexAiModel = Resolve-Setting $VertexAiModel "VERTEX_AI_MODEL" $dotEnvMap
$ElevenLabsApiKey = Resolve-Setting $ElevenLabsApiKey "ELEVENLABS_API_KEY" $dotEnvMap
$ElevenLabsVoiceId = Resolve-Setting $ElevenLabsVoiceId "ELEVENLABS_VOICE_ID" $dotEnvMap
$GcsBucketName = Resolve-Setting $GcsBucketName "GCS_BUCKET_NAME" $dotEnvMap
$OllamaBaseUrl = Resolve-Setting $OllamaBaseUrl "OLLAMA_BASE_URL" $dotEnvMap
if ($OllamaBaseUrl -eq "http://ollama:11434") {
    Write-Host "==> Ignoring local Docker OLLAMA_BASE_URL (http://ollama:11434) for Cloud Run." -ForegroundColor Yellow
    $OllamaBaseUrl = ""
}
$DatabaseUrl = Resolve-Setting $DatabaseUrl "DATABASE_URL" $dotEnvMap "sqlite+aiosqlite:///./astronaut_triage.db"
$AstronautIds = Resolve-Setting $AstronautIds "ASTRONAUT_IDS" $dotEnvMap "AST-01,AST-02,AST-03"
$DataProvider = Resolve-Setting $DataProvider "DATA_PROVIDER" $dotEnvMap "rest"

if ($null -eq $BackendMinInstances) {
    $minStr = Resolve-Setting "" "BACKEND_MIN_INSTANCES" $dotEnvMap "0"
    $BackendMinInstances = [int]$minStr
}

$activeAccount = Get-GcloudValue @("auth", "list", "--filter=status:ACTIVE", "--format=value(account)")
if (-not $activeAccount) {
    throw "No active gcloud account found. Run 'gcloud auth login' first."
}

if (-not $ProjectId) {
    $ProjectId = Get-GcloudValue @("config", "get-value", "project")
}
if (-not $ProjectId -or $ProjectId -eq "(unset)") {
    throw "No GCP project set. Pass -ProjectId <your-project-id> or set GCP_PROJECT_ID in .env."
}

if ($DatabaseUrl -match "@db:") {
    Write-Warning "DATABASE_URL points to local Docker host '@db:' ($DatabaseUrl), which is unreachable from Cloud Run. Backend will fall back to ephemeral SQLite unless you set DATABASE_URL to your Supabase/Postgres URL."
}
elseif ($DatabaseUrl -match "^postgres(ql)?://") {
    $DatabaseUrl = $DatabaseUrl -replace "^postgres(ql)?://", "postgresql+asyncpg://"
    $DatabaseUrl = $DatabaseUrl -replace "([?&])sslmode=", "`$1ssl="
}

Write-Host "==> Using account: $activeAccount" -ForegroundColor Cyan
Write-Host "==> Project: $ProjectId | Region: $Region | Triage: $TriageMode" -ForegroundColor Cyan

Invoke-Gcloud @("config", "set", "project", $ProjectId)

Write-Host "==> Enabling Cloud Run, Cloud Build, and Artifact Registry APIs..." -ForegroundColor Cyan
Invoke-Gcloud @(
    "services", "enable",
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com"
)

# Use '~' as delimiter because DATABASE_URL may contain '@' and ASTRONAUT_IDS contains ','.
$backendEnvList = @(
    "ENVIRONMENT=production",
    "TRIAGE_MODE=$TriageMode",
    "DATABASE_URL=$DatabaseUrl",
    "OLLAMA_BASE_URL=$OllamaBaseUrl"
)
if ($GeminiApiKey) { $backendEnvList += "GEMINI_API_KEY=$GeminiApiKey" }
if ($VertexAiModel) { $backendEnvList += "VERTEX_AI_MODEL=$VertexAiModel" }
if ($ElevenLabsApiKey) { $backendEnvList += "ELEVENLABS_API_KEY=$ElevenLabsApiKey" }
if ($ElevenLabsVoiceId) { $backendEnvList += "ELEVENLABS_VOICE_ID=$ElevenLabsVoiceId" }
if ($GcsBucketName) { $backendEnvList += "GCS_BUCKET_NAME=$GcsBucketName" }
$backendEnvArg = "^~^" + ($backendEnvList -join "~")

Write-Host "==> Deploying backend ($BackendService) from $BackendDir..." -ForegroundColor Cyan
Invoke-Gcloud @(
    "run", "deploy", $BackendService,
    "--source", $BackendDir,
    "--region", $Region,
    "--allow-unauthenticated",
    "--port", "8080",
    "--memory", "1Gi",
    "--min-instances", "$BackendMinInstances",
    "--max-instances", "1",
    "--set-env-vars", $backendEnvArg
)

$backendUrl = Get-GcloudValue @(
    "run", "services", "describe", $BackendService,
    "--region", $Region,
    "--format", "value(status.url)"
)
Write-Host "==> Backend URL: $backendUrl" -ForegroundColor Green

$frontendEnvArg = "^~^PUBLIC_API_URL=$backendUrl~DATA_PROVIDER=$DataProvider~ASTRONAUT_IDS=$AstronautIds"

Write-Host "==> Deploying frontend ($FrontendService) from $FrontendDir..." -ForegroundColor Cyan
Invoke-Gcloud @(
    "run", "deploy", $FrontendService,
    "--source", $FrontendDir,
    "--region", $Region,
    "--allow-unauthenticated",
    "--port", "8080",
    "--memory", "512Mi",
    "--min-instances", "0",
    "--set-env-vars", $frontendEnvArg
)

$frontendUrl = Get-GcloudValue @(
    "run", "services", "describe", $FrontendService,
    "--region", $Region,
    "--format", "value(status.url)"
)

Write-Host "==> Updating backend CORS_ORIGINS to allow $frontendUrl..." -ForegroundColor Cyan
Invoke-Gcloud @(
    "run", "services", "update", $BackendService,
    "--region", $Region,
    "--update-env-vars", "CORS_ORIGINS=$frontendUrl"
)

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "  Frontend: $frontendUrl"
Write-Host "  Backend:  $backendUrl"
Write-Host "  Health:   $backendUrl/health"
