# 드럼 튜너 iOS 빌드 도우미 (Windows용)
# 실제 빌드는 Expo 클라우드의 macOS 서버(EAS Build)에서 실행됩니다. 맥이 필요 없습니다.
# 실행: drum-tuner 폴더의 build-ios.bat 를 더블클릭하거나
#       powershell -ExecutionPolicy Bypass -File scripts\build-ios.ps1

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ProjectDir = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectDir

$EasVersion = '27.11.0'
function Eas { & npx --yes "eas-cli@$EasVersion" @args; if ($LASTEXITCODE -ne 0) { throw "eas $($args -join ' ') 실패 (코드 $LASTEXITCODE)" } }

function Step($text) { Write-Host ''; Write-Host "▶ $text" -ForegroundColor Cyan }
function Pause-Exit($code) { Write-Host ''; Read-Host '엔터를 누르면 창이 닫힙니다' | Out-Null; exit $code }

try {
  Step 'Node.js 확인'
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'Node.js가 없습니다. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요.' -ForegroundColor Yellow
    Pause-Exit 1
  }
  Write-Host "Node $(node -v)"

  Step '패키지 설치 (처음 한 번은 몇 분 걸립니다)'
  & npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'npm install 실패' }

  Step 'Expo 계정 로그인 확인'
  # Windows PowerShell 5.1 turns redirected native stderr into a terminating error under 'Stop'.
  $ErrorActionPreference = 'Continue'
  & npx --yes "eas-cli@$EasVersion" whoami 2>&1 | Out-Host
  $loggedIn = ($LASTEXITCODE -eq 0)
  $ErrorActionPreference = 'Stop'
  if (-not $loggedIn) {
    Write-Host 'Expo 계정으로 로그인합니다. 계정이 없으면 https://expo.dev/signup 에서 만드세요.'
    Eas login
  }

  $app = Get-Content app.json -Raw -Encoding UTF8 | ConvertFrom-Json
  if (-not $app.expo.extra.eas.projectId) {
    Step 'Expo 프로젝트 연결 (처음 한 번)'
    Eas init
    Write-Host 'app.json에 projectId가 추가되었습니다. 이 변경은 git에 커밋해 두세요.' -ForegroundColor Yellow
  }

  Write-Host ''
  Write-Host '무엇을 할까요?' -ForegroundColor Green
  Write-Host '  1) 내 아이폰 등록하기 (테스트 설치 전에 한 번)'
  Write-Host '  2) 테스트 빌드 → 등록한 아이폰에 설치 (preview)'
  Write-Host '  3) App Store / TestFlight 빌드 후 업로드 (production)'
  Write-Host '  4) 빌드 목록 보기'
  $choice = Read-Host '번호 입력'

  switch ($choice) {
    '1' {
      Step '아이폰 등록'
      Write-Host '아래에 나오는 QR 코드/링크를 아이폰 Safari로 열고 프로파일을 설치하세요.'
      Eas device:create
    }
    '2' {
      Step 'iOS 테스트 빌드 (Apple 개발자 계정 로그인을 물어보면 진행하세요)'
      Eas build --platform ios --profile preview
      Write-Host '빌드가 끝나면 나오는 링크/QR을 아이폰에서 열어 설치하세요.' -ForegroundColor Green
    }
    '3' {
      Step 'iOS 배포 빌드 + App Store Connect 업로드'
      Eas build --platform ios --profile production --auto-submit
      Write-Host '업로드가 끝나면 https://appstoreconnect.apple.com 에서 TestFlight/심사를 진행하세요.' -ForegroundColor Green
    }
    '4' { Eas build:list --platform ios --limit 5 }
    default { Write-Host '취소했습니다.' }
  }
  Pause-Exit 0
}
catch {
  Write-Host ''
  Write-Host "오류: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host '위 메시지를 복사해서 Claude에게 보여주세요.'
  Pause-Exit 1
}
