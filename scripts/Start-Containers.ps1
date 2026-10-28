$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    if(-not (Test-Path .env)) {
        $password='Sec0ps!'+[Guid]::NewGuid().ToString('N')
        $template=[IO.File]::ReadAllText((Join-Path $projectRoot '.env.example')).Replace('CHANGE_ME_StrongPassword_123!',$password)
        [IO.File]::WriteAllText((Join-Path $projectRoot '.env'),$template)
    }
    docker compose up -d --build
    if($LASTEXITCODE -ne 0) { throw 'Falha no Docker Compose. Consulte os logs.' }
    Write-Host 'SecOps Manager: http://localhost:3300'
} finally { Pop-Location }
