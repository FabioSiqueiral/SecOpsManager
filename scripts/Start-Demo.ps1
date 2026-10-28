$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$nodeHome=Join-Path $projectRoot '.tools\node-v22.23.3-win-x64'
if(Test-Path (Join-Path $nodeHome 'node.exe')) { $env:PATH=$nodeHome+';'+$env:PATH }
Push-Location (Join-Path $projectRoot 'frontend')
try {
    if(-not (Test-Path node_modules)) { npm.cmd ci; if($LASTEXITCODE -ne 0) { throw 'Falha ao instalar dependências.' } }
    npm.cmd run dev
} finally { Pop-Location }
