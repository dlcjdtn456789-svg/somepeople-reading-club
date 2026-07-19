# 인스타그램 자동 게시

`publish_daily.js` — 오늘 날짜에 해당하는 `카드뉴스/YYYY-MM-DD` 폴더를 인스타그램 캐러셀로 자동 게시합니다.
GitHub Pages(`https://dlcjdtn456789-svg.github.io/somepeople-reading-club/`)에 이미지가 공개
호스팅되어 있어야 하고, **Instagram API with Instagram Login**(`graph.instagram.com`)을 통해 발행합니다.
(Facebook 페이지 연결이 필요한 옛날 방식 Graph API가 아닙니다.)

## 현재 상태 (2026-07-19 설정 완료)

- Meta 개발자 앱 "api" 생성, `somepeople_rc`를 Instagram 테스터로 등록·연결 완료
- 액세스 토큰 발급 완료, 사용자 환경 변수 `IG_ACCESS_TOKEN` / `IG_BUSINESS_ID`(=`28579476721654676`)로 저장됨
- Windows 작업 스케줄러에 **매일 오전 9시** 자동 실행 등록됨 (`SomepeopleReadingClub-DailyPost`)
- 07-17 ~ 07-19 카드뉴스 수동 게시 완료 (`automation/published.json` 참고), 07-20부터 스케줄러가 자동 진행

## 토큰 자동 갱신

Instagram 장기 토큰은 발급 후 약 60일간 유효하고, 24시간 이상 지난 토큰은 앱 시크릿 없이 갱신할 수 있습니다.
`publish_daily.js`는 **실행될 때마다 토큰을 자동 갱신**해서 `automation/token.json`에 저장합니다
(이 파일은 `.gitignore`에 포함되어 있어 저장소에는 올라가지 않습니다). 매일 실행되는 한 토큰은 만료되지 않습니다.
`IG_ACCESS_TOKEN` 환경변수는 `token.json`이 없을 때(최초 1회)만 쓰이는 부트스트랩 값입니다.

## 수동 실행

```
node automation/publish_daily.js
```

- 실행한 날짜(`YYYY-MM-DD`)와 이름이 같은 `카드뉴스` 폴더를 찾아 7장을 캐러셀로 발행합니다.
- 테스트 시 `PUBLISH_DATE_OVERRIDE=2026-07-17` 환경변수로 특정 날짜를 강제 지정할 수 있습니다.
- 발행 기록은 `automation/published.json`에 남아, 같은 날짜를 중복 발행하지 않습니다.

## 새 날짜 폴더 추가 시

카드뉴스를 새로 만들면 GitHub에 커밋·푸시해야 실제로 공개 URL이 생깁니다:

```
git add 카드뉴스/YYYY-MM-DD
git commit -m "Add YYYY-MM-DD card news"
git push
```

푸시 후 GitHub Pages가 다시 배포되기까지 1~2분 정도 걸립니다. 스케줄러가 매일 9시에 그날 폴더를 찾으므로,
전날 밤까지만 새 폴더를 올려두면 됩니다.

## 작업 스케줄러 관리

```powershell
# 상태 확인
Get-ScheduledTask -TaskName "SomepeopleReadingClub-DailyPost"

# 지금 바로 한 번 실행해보기 (오늘 날짜 폴더를 게시함)
Start-ScheduledTask -TaskName "SomepeopleReadingClub-DailyPost"

# 실행 기록 확인
Get-ScheduledTaskInfo -TaskName "SomepeopleReadingClub-DailyPost"

# 시간 변경 (예: 오전 10시로)
Set-ScheduledTask -TaskName "SomepeopleReadingClub-DailyPost" -Trigger (New-ScheduledTaskTrigger -Daily -At 10am)

# 완전히 중지하고 싶을 때
Unregister-ScheduledTask -TaskName "SomepeopleReadingClub-DailyPost" -Confirm:$false
```
