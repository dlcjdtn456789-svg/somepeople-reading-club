# somepeople reading club — 카드뉴스 브랜드 가이드

## 캔버스
- 1080 x 1350px (인스타그램 4:5 캐러셀 표준)

## 컬러
- 배경(기본) `#F3EEE3` — 따뜻한 크림
- 배경(대비용, 가끔) `#EDE6D6`
- 본문 텍스트 `#2B2620` — 짙은 웜 블랙
- 보조 텍스트 `#8C8272` — 뮤트 브라운그레이 (라벨, 쪽번호, 워드마크)
- 포인트 `#B5673A` — 테라코타 (구분선, 강조 숫자/기호)
- 헤어라인 `#D8CFBC`

## 타이포그래피
- 폰트: Noto Serif KR (400/500/600/700)
- 표지 타이틀: 700, 84~96px
- 인용/감성 문장: 500~600, 44~56px, 넉넉한 줄간격(1.4~1.6)
- 리스트/설명: 400~500, 32~38px
- 라벨(영문 소문자+자간): 500, 18~20px, letter-spacing 3~4px, 보조색

## 레이아웃 원칙
- 여백을 크게 둔다 (좌우 최소 64px)
- 슬라이드당 한 가지 메시지만
- 매 슬라이드 좌상단에 워드마크 "somepeople reading club", 우하단에 쪽번호 "NN / 07"
- 표지/인용 슬라이드는 중앙 정렬, 리스트 슬라이드는 좌측 정렬

## 프로필 이미지
`profile.png` (1080x1080) — SPRC 모노그램 중심의 컴팩트한 원형 인장 디자인.
이중 테두리(테라코타 굵은 링 + 잉크색 얇은 링) 안에 큰 "SPRC" 모노그램,
그 아래 점 세 개(겹치지 않는 작은 원, 나란히) — "같은 순간, 같은 공간, 같은 책" 핵심 문구를 담담하게 도형화한 것.
(반복 수정 과정: ①테두리 도는 문구 다수 → 복잡해서 삭제 ②"2026" 연도 표기 → 불필요해서 삭제
③겹친 원 세 개 → 아우디 로고처럼 보여서 폐기 ④지금의 점 세 개로 확정, 2026-07-17)
인스타그램은 정사각형을 원형으로 크롭하므로 링이 안쪽에 여유 있게 들어가도록 설계함.
원본은 `profile.html` (인라인 SVG) — 수정 후 아래 캡처 방법으로 재생성.

## 매일 카드뉴스 만드는 법
1. `카드뉴스/YYYY-MM-DD/` 폴더 생성
2. 그날의 책, 장소, 감정/구절을 Claude에게 전달
3. 이 팔레트 기준으로 슬라이드별 HTML(01.html, 02.html …, 1080x1350) 생성
4. 헤드리스 Edge로 PNG 캡처 (PowerShell 사용 — Bash에서 직접 실행 시 쓰기 권한 오류가 조용히 발생할 수 있음, 또한 D: 드라이브의 HTML을 하위 프로세스가 직접 읽지 못하는 경우가 있어 먼저 스크래치패드(C:) 로 복사 후 캡처 → 완료된 PNG만 최종 폴더로 복사하는 순서 권장)
   ```powershell
   $exe = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
   foreach ($i in @("01","02","03")) {
     $prof = "작업폴더\prof_$i"   # 슬라이드마다 새 프로필 디렉터리 (재사용 시 액세스 거부 오류 발생)
     New-Item -ItemType Directory -Force -Path $prof | Out-Null
     Start-Process -FilePath $exe -ArgumentList @(
       "--headless=new","--disable-gpu","--no-sandbox",
       "--user-data-dir=$prof",
       "--screenshot=작업폴더\$i.png",
       "--window-size=1080,1350","--virtual-time-budget=8000",
       "file:///작업폴더/$i.html"
     ) -NoNewWindow -Wait
   }
   ```
5. `caption.txt`에 인스타그램 캡션 + 해시태그 저장
