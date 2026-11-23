# 드럼 튜너 (iOS · Expo)

마이크로 드럼 소리를 듣고 음정(Hz)을 보여주는 튜닝 앱입니다. **Windows에서 개발하고**, iOS 빌드와 App Store 제출은 Expo 클라우드(EAS)가 맡습니다. 맥은 필요 없습니다.

## 기능

- **튜너**
  - 드럼을 치면 기본음(Hz), 음이름, 센트를 보여줍니다.
  - 목표 음정과 비교해서 "조이세요" 또는 "푸세요"라고 안내합니다.
  - 킥, 스네어, 탐, 플로어 드럼의 참고 음정 범위 프리셋이 들어 있습니다.
- **러그 튜닝**
  - 러그 앞을 하나씩 치면 러그별 음정을 저장하고 평균과 편차를 보여줍니다.
  - 평균보다 낮은 러그는 파랑(조이기), 높은 러그는 주황(풀기), 고른 러그는 초록으로 표시합니다.

## 동작 원리

1. **타격 감지:** 마이크 소리 크기가 주변 소음보다 갑자기 커지면 타격으로 봅니다.
2. **구간 잘라내기:** 스틱이 닿는 첫 20ms는 건너뛰고, 그 뒤 300ms를 분석 구간으로 씁니다.
3. **주파수 계산:** 분석 구간에 Hann 창을 씌우고 FFT를 돌린 다음, 스펙트럼 피크를 보간해서 주파수를 구합니다.
   드럼 배음은 정수배가 아니라서, 기타 튜너에서 쓰는 자기상관 방식보다 이 방법이 정확합니다.
4. **모드별 피크 선택:**
   - 튜너 모드: 충분히 강한 피크 중 가장 낮은 것(기본음)을 고릅니다.
   - 러그 모드: 가장 큰 피크를 고릅니다.

코드 위치:

| 파일 | 역할 |
| --- | --- |
| `src/audio/pitch.ts` | FFT 기반 음정 분석, 음이름 변환 |
| `src/audio/HitDetector.ts` | 실시간 타격 감지 |
| `src/audio/useDrumMic.ts` | `expo-audio`의 `useAudioStream`으로 마이크 PCM을 받아 분석기에 넘김 |
| `src/screens/*` | 튜너, 러그 튜닝 화면 |

## Windows에서 시작하기

### 1. 준비

- [Node.js LTS](https://nodejs.org)와 Git을 설치합니다.
- 아이폰에 **Expo Go** 앱을 설치합니다(App Store).

```powershell
git clone <이 저장소>
cd somepeople-reading-club\drum-tuner
npm install
```

### 2. 아이폰에서 바로 실행하기 (Expo Go)

```powershell
npx expo start --tunnel
```

1. 터미널에 QR 코드가 나타나면 아이폰 카메라로 찍습니다. Expo Go에서 앱이 열립니다.
2. **마이크 켜기**를 누르고 마이크 권한을 허용합니다.
3. 드럼을 쳐 봅니다.

코드를 저장하면 아이폰 화면에 바로 반영됩니다.

> 이 앱은 Expo SDK에 기본으로 들어 있는 `expo-audio`만 쓰기 때문에 Expo Go에서 실행됩니다. 나중에 Expo Go에 없는 네이티브 라이브러리를 추가하면 Expo Go 대신 개발 빌드가 필요합니다(`eas build --profile development`).

### 3. 실제 앱으로 빌드하기 (EAS)

[Apple Developer Program](https://developer.apple.com/programs/)(연 $99) 계정과 [Expo 계정](https://expo.dev/signup)이 필요합니다.

```powershell
npm install -g eas-cli
eas login
eas build:configure            # 처음 한 번
eas device:create              # 테스트할 아이폰 등록 (internal 배포용)
eas build -p ios --profile preview
```

빌드가 끝나면 링크나 QR 코드가 나옵니다. 아이폰에서 열면 앱이 설치됩니다. 인증서와 프로비저닝 프로파일은 EAS가 대신 만들어 줍니다.

### 4. App Store / TestFlight에 올리기

```powershell
eas build -p ios --profile production
eas submit -p ios --latest
```

`eas submit`은 빌드를 App Store Connect에 업로드합니다. 그 뒤 TestFlight 테스트와 심사 제출은 [App Store Connect](https://appstoreconnect.apple.com) 웹사이트에서 진행합니다.

### 번들 ID 바꾸기

`app.json`의 `ios.bundleIdentifier`(지금은 `com.somepeople.drumtuner`)는 App Store 전체에서 하나뿐이어야 합니다. 처음 빌드하기 전에 본인 것으로 바꾸세요. 예: `com.내이름.drumtuner`

## 개발 명령어

```powershell
npm test            # 음정 분석·타격 감지 테스트 (합성 드럼 소리로 검증)
npm run typecheck   # TypeScript 검사
```

## 튜닝 팁

- 조용한 곳에서, 휴대폰을 드럼에서 30cm~1m 떨어진 곳에 두세요.
- 러그 튜닝을 할 때는 반대쪽 헤드를 손으로 눌러 울림을 막아야 값이 안정됩니다.
- 프리셋 음정 범위는 참고용입니다. 원하는 소리에 맞춰 목표 음정을 직접 정하고, **방금 친 소리를 목표로** 버튼을 활용하세요.
