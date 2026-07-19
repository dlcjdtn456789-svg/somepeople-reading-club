# 인스타그램 자동 게시

`publish_daily.js` — 오늘 날짜에 해당하는 `카드뉴스/YYYY-MM-DD` 폴더를 인스타그램 캐러셀로 자동 게시합니다.
GitHub Pages(`https://dlcjdtn456789-svg.github.io/somepeople-reading-club/`)에 이미지가 공개
호스팅되어 있어야 하고, Instagram Graph API를 통해 발행합니다.

## 필요한 것 (아직 준비 전)

1. **인스타그램 → 프로페셔널(비즈니스) 계정 전환**
2. **Facebook 페이지 연결**
3. **Meta 개발자 앱 생성** (developers.facebook.com, Instagram Graph API 제품 추가)
4. **액세스 토큰 발급** — 권한: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`. 장기(60일) 토큰으로 교환.
5. **IG 비즈니스 계정 ID 확인** — `/me/accounts` 응답에서 페이지의 `instagram_business_account.id` 값

이 다섯 가지가 끝나면 아래 두 값을 환경변수로 설정합니다 (Windows, 시스템 환경 변수 또는 사용자 환경 변수):

```
IG_ACCESS_TOKEN=발급받은 토큰
IG_BUSINESS_ID=IG 비즈니스 계정 ID
```

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

푸시 후 GitHub Pages가 다시 배포되기까지 1~2분 정도 걸립니다.

## 매일 자동 실행 (Windows 작업 스케줄러)

액세스 토큰까지 준비되면, 아래처럼 매일 정해진 시간에 자동 실행되도록 등록할 수 있습니다
(예: 매일 오전 9시). 필요하시면 말씀해주세요 — 등록까지 대신 진행해드릴 수 있습니다.

```powershell
$action = New-ScheduledTaskAction -Execute "node.exe" -Argument "automation\publish_daily.js" -WorkingDirectory "D:\이청수\somepeoplereadingclub"
$trigger = New-ScheduledTaskTrigger -Daily -At 9am
Register-ScheduledTask -TaskName "SomepeopleReadingClub-DailyPost" -Action $action -Trigger $trigger -RunLevel Highest
```

액세스 토큰은 이 스케줄 작업이 읽을 수 있도록 **사용자 환경 변수**로 등록해두어야 합니다
(작업 스케줄러가 새 세션에서 실행되므로, 스크립트 실행 시점의 셸 환경변수가 아니라 영구 환경변수여야 합니다).
