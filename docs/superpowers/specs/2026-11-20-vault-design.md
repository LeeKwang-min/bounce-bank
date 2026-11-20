# Bounce Bank — VAULT (2차 환생) · 새 코인 등급 · 세이브 내보내기

작성일: 2026-11-20 · 대상: `index.html` (단일 파일, 에셋 0개) · 이전 설계: `2026-11-19-progression-design.md`

## 1. 의도와 이유

BOOST/AUTO 탭(dc04c83)을 넣은 지 하루 만에 AUTO를 전부 MAX 한 유저가 또 나왔다. 기존 데이터 탓만이 아니라 구조 문제다.
- 칩 수입이 판마다 약 2배 → 횟수 제한 있는 칩 항목은 몇 시간이면 소진 (시뮬: 신규 유저도 13판·3.3h에 AUTO 전부 MAX).
- 그 뒤는 BOUNCE+ 숫자뿐이고, 시뮬 16h 즈음 스테이지 52~53에서 판이 2h를 넘겨도 +0~1 스테이지 → 실제 끝.

사용자 답: 엔드 유저들은 **처음부터 다시 키우는 것도 좋아한다.** → 칩 상점까지 비우는 확실한 2차 환생을 넣고, ★ 보상으로 두 번째 오르막이 더 빠르고 새롭게.

## 2. 목표 / 비목표 / 반목표

**목표**
- 53 벽 전에 열리는 2차 환생(VAULT)으로 "다시 처음부터, 대신 더 빠르게 + 새 볼거리" 루프.
- OMEGA 다음 코인 등급 3개 — "NEW COIN!" 순간을 다시.
- 마지막 수동 반복(CASH OUT)도 AUTO로.
- 수십 시간 쌓은 진행을 지킬 세이브 내보내기/불러오기.

**비목표**: 업적, 도전 모드, 잭팟 이벤트, 클라우드 세이브, 3차 환생.

**반목표**
- 기존 세이브 손상·진행 손실 (실제 폰 유저 있음).
- VAULT 후 두 번째 오르막이 첫 번째보다 느리게 느껴짐.
- 1~30판(첫 오르막) 밸런스 변화 — 기존 시뮬 체크가 그대로 통과해야 함.
- 픽셀/네온 톤 붕괴, 코인 끼임.

## 3. 제약 (이전 설계와 동일)

단일 `index.html`, 180×320 논리 캔버스 + 3×5 비트맵 폰트(5×5 특수 글리프 가능), `EX` 반영, 한 줄 함수 안 `//` 금지, `sw.js` VERSION 올림(`bb-5`→`bb-6`), 물리 `STEP` 고정.

## 4. 검토한 접근

| 결정 | 고른 것 | 버린 것과 이유 |
|---|---|---|
| 엔드 콘텐츠 축 | **2차 환생 + 새 등급 + 세이브 내보내기** (사용자 승인) | 칩 항목 추가: 몇 시간이면 또 소진 / 53 벽 밸런스로 밀기: 숫자만 길어짐 |
| 초기화 범위 | **칩·누적 칩·누적 수익·BASE·BOOST 전부** (사용자: 재시작 좋아함) | BASE 유지: 처음부터 키우는 맛 감소 |
| 유지 | **AUTO 탭, ★, ★ 상점, best, 음소거** (Claude 판단: AUTO는 편의라 재시작을 지루하게 만들지 않게) | AUTO까지 초기화: 탭 노가다 반복 |
| ★ 상점 위치 | **BANK 4번째 탭 VAULT** (Claude 판단) | 별도 화면: 진입점만 늘어남 |

## 5. 설계

### 5.1 VAULT

- **해금**: 이번 판 `stage ≥ 40` 이고 받을 ★ ≥ 1. (시뮬 약 5h, 판이 20분 넘게 길어지기 시작하는 지점)
- **★ 계산** (CASH OUT과 같은 세제곱근):
  ```
  chipsAll     = 지금까지 받은 칩 총합 (VAULT로 안 줄어듦)
  pending      = 이번 판 CASH OUT 하면 받을 칩 (VAULT 시 함께 정산)
  starGain     = floor(cbrt((chipsAll + pending) / STAR_K)) - starsEver
  ```
  `STAR_K`는 첫 VAULT ★3~5가 되게 시뮬로. 같은 지점에서 반복하면 ★가 줄어 매번 더 멀리 가야 함.
- **★ 효과**: `starMult = 1 + 1.0 × starsEver` (★ 써도 안 줄어듦). `permMult = chipMult × bounceMult × starMult`.
- **초기화**: 판 진행(resetRun 전부) + chips, chipsEver, lifetime → 0, BASE·BOOST 상점 레벨 → 0.
- **유지**: AUTO 상점 레벨·토글, stars, starsEver, chipsAll, ★ 상점, best, muted, feverEver.
- **확인 단계**: `VAULT EVERYTHING?` / `CHIPS, BASE, BOOST RESET` / `AUTO AND ★ KEPT` / `+N★ STAR X.. > X..` [YES][NO].
- **연출**: CASH OUT 연출(코인이 투입구로 빨려 들어감) + 더 큰 플래시·흔들림, 금빛 별 파티클 비, 배너 `VAULT! / +N★ / STAR X.. > X..`.

### 5.2 VAULT 탭 (BANK 4번째 탭, 비용 단위 ★)

탭 4개 `BASE / BOOST / AUTO / VAULT`. 1행 = VAULT 버튼(가로 전체), 2~4행 = ★ 항목.

| 항목 | 효과 | 최대 | 비용 시작값 |
|---|---|---|---|
| STAR TIER | 새 코인 등급 1개 해금 (등급 사다리 = 7 + NEW TIER + STAR TIER) | 3 | 1, 3, 8 |
| CHIP+ | CASH OUT 칩 ×(1 + 0.5×레벨) | 5 | 1, 2, 4, 8, 16 |
| AUTO CASH | 이번 판 칩으로 칩 배율이 2배가 되면 자동 CASH OUT. ON/OFF 토글. BANK 열려 있거나 VAULT 가능하면 멈춤 | 1 | 2 |

BANK 헤더: ★를 한 번이라도 받았으면 `◆10.1K ★3`.

### 5.3 새 코인 등급 (STAR TIER로 해금)

OMEGA 다음, 값 ×3 비율 유지(3e5, 1e6, 3e6), 반지름 9. 이름 후보 **AURORA / QUASAR / INFINITY**. 엠블럼·팔레트·fx는 기존 톤에 맞춰 빌더 판단:
- AURORA — 초록·청록·보라로 물결치는 몸체, 오로라 커튼 파티클.
- QUASAR — 밝은 코어 + 양방향 제트 빔.
- INFINITY — 흰 몸체 + 무지개 테두리, 8자 궤도 파티클, 마지막 등급다운 강한 연출.

`PAD_LV_MAX = TIERS.length (14)` — 패드도 새 색까지. NEW TIER 문구는 다음 해금 등급을 동적으로(`TIERS[maxTier()+1]`).

### 5.4 세이브 내보내기

- BANK 왼쪽 위 `DATA` 버튼 → 작은 창 `[COPY] [LOAD]`.
- COPY: `BB1:` + base64(JSON 세이브) 를 클립보드로. 실패 시 `prompt`로 보여줌.
- LOAD: `prompt`로 붙여넣기 → 디코드·`migrate()` 통과 시에만 저장 후 새로고침. 새로고침 전 `save()` 막음(덮어쓰기 방지). 불러온 세이브의 `t`는 지금으로(오프라인 수익 악용 방지). 실패 시 `BAD CODE`.

### 5.5 세이브

`v:2` 유지, 필드 추가: `stars`, `starsEver`, `chipsAll`, 상점 키 `stier`, `chipup`, `acash`, `autoOff.acash`. 없는 필드는 0 — 기존 세이브 그대로 로드. 기존 유저 `chipsAll`은 `chipsEver`로 시작(지금까지 칩을 인정).

## 6. 밸런스 목표 (시뮬)

| 구간 | 목표 |
|---|---|
| 1~30판 | 기존 체크 전부 통과 (VAULT 전엔 변화 없음) |
| 첫 VAULT | 시뮬 4~8h, ★3~5 |
| VAULT 직후 첫 CASH OUT | 15 sim-min 이내 |
| 두 번째 오르막 stage 40 | 첫 번째의 60% 이하 시간 |

시뮬 VAULT 정책: stage 40 도달 + ★ 획득이 starMult를 2배 이상 올릴 때(첫 회는 ★≥1이면 바로).

## 7. 빌더에게 맡기는 것

새 등급 3개의 정확한 이름·색·엠블럼·fx, VAULT 연출 세부, ★ 글리프, DATA 창 레이아웃, 비용·STAR_K 정확한 수치.

## 8. 검증

node 테스트(신규 공식) + 시뮬(6장 목표), 브라우저: 기존 세이브 로드, VAULT 확인→연출→초기화/유지 항목, ★ 상점 구매, 새 등급 3개 외형·fx, 패드 LV12~14, DATA COPY→LOAD 왕복, AUTO CASH.
