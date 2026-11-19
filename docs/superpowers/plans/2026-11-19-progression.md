# Bounce Bank 성장 요소 확장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** prestige(CASH OUT + 칩 상점), 패드 레벨, SPEED/피버, 추가 슬롯·신규 코인 3등급을 넣어 "중간중간 확 바뀌는" 성장 루프를 만든다.

**Architecture:** 모든 게임 코드는 `index.html` 한 파일에 둔다. 경제 공식·티어 데이터·세이브 마이그레이션은 `/*ECON*/ … /*ENDECON*/` 마커 사이의 **순수 블록**으로 모아, node 테스트와 경제 시뮬이 그 블록을 그대로 추출해 실행한다(공식 중복 0). 렌더/물리/UI는 브라우저에서 Playwright로 검증한다.

**Tech Stack:** Vanilla JS + Canvas 2D (빌드 없음), Node 24 (`node:vm`, `node:assert`), Playwright MCP.

**Spec:** `docs/superpowers/specs/2026-11-19-progression-design.md`

## Global Constraints

- 단일 `index.html`, 에셋 0개, 외부 라이브러리 0개. 180×320 논리 캔버스, 3×5 비트맵 폰트, 픽셀/네온 톤 유지.
- 폰은 `EX = H-320`만큼 월드·하단 패널이 아래로 translate됨 — 새 좌표/히트박스는 `EX` 반영.
- 한 줄 함수 안에 `//` 주석 금지. 주석은 `/* */`.
- 물리는 `STEP=1/120` 고정. 가속은 스텝 횟수로만.
- 화면 속도 상한 `SPEED_CAP=3`, 초과분은 수익 배율.
- `PRESTIGE_STAGE=6`, `FEVER_DUR=10`(초), `FEVER_CD=60`(초, 실시간), 패드 레벨 1~8, SPEED 레벨 0~10(+10%/lv), 상점 SPEED+ 0~5(+10%/lv), 슬롯 최대 12.
- 세이브 `KEY='bounceBank.v1'` 유지, `v:2`. 마이그레이션 전 원본을 `bounceBank.v1.bak`에 백업.
- 완료 시 `sw.js` `VERSION` `bb-3` → `bb-4`.
- 커밋은 레포 로컬 noreply 이메일(설정됨). push는 사용자 확인 후 SSH.

## Review Focus

1. **옛 세이브를 가진 폰** — 업데이트 후 첫 로드에서 stage/money/coins/pads가 그대로여야 한다. 필드 누락된 v1(`ips`·`best` 없음)도. → Task 1 `migrate` 테스트.
2. **긴 폰 화면(EX>0)에서 탭 위치** — 플레이필드 탭은 피버, 정보 줄 ◆ 영역은 BANK, 카드는 구매. 오탭 없어야 한다. → Task 5 Playwright 390×844 탭 검증.
3. **피버 중/CASH OUT 직후 앱 백그라운드** — 복귀 시 오프라인 수익이 부풀지 않아야 한다. → Task 5(피버 중 ips 고정), Task 7(CASH OUT 후 ips=0) evaluate 검증.
4. **합체 애니메이션·스폰 대기 중 CASH OUT** — 유령 코인/크래시 없이 깨끗이 리셋. → Task 7 검증 단계.
5. **후반 큰 수** — 배율이 겹치면 1e33(`AF`) 초과. 표시가 깨지거나 `NaN`이면 안 된다. → Task 1 `fmt` 테스트(1e40 → 지수 표기 폴백).

---

### Task 1: 순수 ECON 블록 + node 테스트 하네스

**Files:**
- Modify: `index.html:49-75` (data/공식 구간을 마커로 감싸고 순수화), 호출부 `:219,252-255,275,287-288,392,401`
- Create: `tools/econ.mjs` (블록 추출 로더), `tools/econ.test.mjs`

**Interfaces:**
- Produces (ECON 블록, 전부 인자 명시·전역 상태 참조 금지):
  - `TIERS` (기존 8개 + NOVA/COSMOS/OMEGA 데이터 — 색/엠블럼은 Task 6에서 채우되 `v`는 10000/30000/100000, `r` 8/9/9), `EMB`
  - `goal(s)`, `stageMult(s)`, `coinCap(s,startCoins)`, `coinCost(n,s)`, `padCost(n)`, `lvCost(k)`, `speedCost(lv)`, `mergeCost(t,s)`
  - `chipsTotal(L)`, `chipGain(L,chipsEver)`, `chipMult(chipsEver)`, `speedTotal(speedLv,shopSpeed,fever)`, `speedSplit(total) -> [timeScale,incomeMul]`
  - `SHOP` = `[{id:'speed',n:'SPEED+',max:5,cost:[…]},{id:'slot',n:'PAD SLOT+',max:3,…},{id:'tier',n:'NEW TIER',max:3,…},{id:'start',n:'START+',max:5,…}]`
  - 상수 `PRESTIGE_STAGE, FEVER_DUR, FEVER_CD, SPEED_CAP, SPEED_MAX, PAD_LV_MAX, CHIP_K, CHIP_BONUS`
  - `migrate(raw) -> v2 save object | null`, `fmt(n)`
- Produces (게임 측 래퍼, 블록 밖): `incomeMult() = stageMult(stage)*chipMult(chipsEver)`
- `tools/econ.mjs`: `export function loadEcon() -> object` (index.html에서 마커 사이 텍스트를 읽어 `vm.runInNewContext(code + ';({…names})')`)

- [ ] **Step 1: Write the failing test** — `tools/econ.test.mjs`

```js
import assert from 'node:assert/strict';
import { loadEcon } from './econ.mjs';
const E = loadEcon();
// 기존 공식 보존
assert.equal(E.goal(1), 1e3); assert.equal(E.goal(10), 2.5e11 * 5);
assert.equal(E.coinCost(1, 1), 10); assert.equal(E.mergeCost(0, 1), 30);
assert.equal(E.coinCap(1, 0), 8); assert.equal(E.coinCap(20, 0), 30); assert.equal(E.coinCap(1, 11), 11);
// 속도 상한
assert.deepEqual(E.speedSplit(2), [2, 1]); assert.deepEqual(E.speedSplit(6), [3, 2]);
assert.equal(E.speedTotal(10, 5, true), 6);
// 칩: √, 쓴 칩과 무관한 배율
assert.equal(E.chipsTotal(E.CHIP_K * 100), 10);
assert.equal(E.chipGain(E.CHIP_K * 100, 4), 6); assert.equal(E.chipGain(E.CHIP_K * 100, 99), 0);
assert.equal(E.chipMult(10), 1 + E.CHIP_BONUS * 10);
// 마이그레이션 (Review Focus 1)
const v1 = { v: 1, money: 5e6, stage: 4, stageEarned: 1e6, tiers: [0, 2, 3], pads: 5, t: 123 };
const m = E.migrate(v1);
assert.equal(m.v, 2); assert.equal(m.stage, 4); assert.equal(m.money, 5e6); assert.equal(m.pads, 5);
assert.deepEqual(m.tiers, [0, 2, 3]); assert.deepEqual(m.padLv, Array(12).fill(1));
assert.equal(m.lifetime, 1e3 + 2e4 + 4e5 + 1e6); assert.equal(m.chips, 0); assert.equal(m.ips, 0);
assert.equal(E.migrate(m), m); assert.equal(E.migrate(null), null); assert.equal(E.migrate({ v: 9 }), null);
// 큰 수 (Review Focus 5)
assert.equal(E.fmt(1500), '1.5K'); assert.match(E.fmt(1e40), /^1(\.0+)?E40$/); assert.equal(E.fmt(Infinity), 'MAX');
console.log('econ ok');
```

- [ ] **Step 2: Run test to verify it fails**
Run: `node tools/econ.test.mjs` → Expected: FAIL (`tools/econ.mjs` 없음 / 마커 없음)

- [ ] **Step 3: Implement** — `tools/econ.mjs` 로더 작성. `index.html`의 data~fmt 구간을 `/*ECON*/`…`/*ENDECON*/`로 감싸고, `coinCost/padCost/mergeCost/cap/mult`를 위 시그니처로 순수화(기존 값 동일), 신규 함수·상수·`SHOP`·`migrate` 추가. 비용/칩 상수는 시작값(스펙 5.7 표, `CHIP_K=1e6`, `CHIP_BONUS=0.1`, `padCost(n)=60*7^(n-1)`, `lvCost(k)=500*3^k`, `speedCost(lv)=200*4^lv`)으로 두고 Task 2에서 튜닝. `fmt`는 `UNITS` 소진 시 `m.mmE<exp>` 지수 표기. 모든 호출부를 새 시그니처/`incomeMult()`로 교체. `MAXT`는 지금은 `7` 유지(동적화는 Task 6).

- [ ] **Step 4: Run tests + 브라우저 스모크**
Run: `node tools/econ.test.mjs` → `econ ok`. Playwright로 `index.html#reset` 열어 콘솔 에러 0, 코인 스폰·카드 구매 동작 확인.

- [ ] **Step 5: Commit** — `git commit -m "Extract pure economy block with node tests"`

### Task 2: 경제 시뮬 + 수치 튜닝

**Files:**
- Create: `tools/sim.mjs`
- Modify: `index.html` ECON 블록 상수만

**Interfaces:**
- Consumes: `loadEcon()`의 모든 공식/상수/`SHOP`/`TIERS[].v`
- Produces: 튜닝된 `padCost, lvCost, speedCost, CHIP_K, CHIP_BONUS, SHOP[].cost`

- [ ] **Step 1: Write `tools/sim.mjs`** — 1초 스텝 greedy 플레이어, 피버 미사용. 모델:
  - 초당 수익 = Σcoins `TIERS[t].v` × 평균 `2^(padLv-1)`(활성 패드 평균) × `hitRate(padCount)` × `stageMult` × `chipMult` × `speedTotal` (timeScale과 incomeMul의 곱 = 총량).
  - `hitRate(p) = 0.73 + (2.0-0.73)*(min(p,9)-1)/8 + 0.12*max(0,p-9)` (메모리 실측 0.73~2/s/coin, 추가 슬롯은 추정).
  - 구매: 후보(ADD PAD / PAD LV+ / COIN / MERGE / SPEED) 중 `Δ수익/비용` 최대를 살 수 있을 때 구매.
  - CASH OUT: `stage ≥ PRESTIGE_STAGE` 이고 `chipGain ≥ max(5, chipsEver)` 일 때. 상점은 살 수 있는 가장 싼 항목부터.
  - 출력: 판별 표 `run | 스테이지별 도달 시각(분) | 칩 gain | chipMult`, 그리고 "눈에 띄는 이벤트"(패드 레벨업·새 등급·새 슬롯·스테이지업) 사이 최대 공백(분).
  - 마지막에 스펙 5.11 목표를 assert로 체크하고 PASS/FAIL 출력.

- [ ] **Step 2: Run to see current numbers**
Run: `node tools/sim.mjs` → 목표 대비 FAIL 항목 확인

- [ ] **Step 3: 상수 튜닝** — 스펙 5.11 표 전부 PASS 될 때까지 ECON 상수만 조정. `goal/coinCost/mergeCost`는 건드리지 않는 게 원칙, 불가피하면 이유를 커밋 메시지에.

- [ ] **Step 4: Verify**
Run: `node tools/sim.mjs && node tools/econ.test.mjs` → 모든 목표 PASS + `econ ok` (칩 테스트는 `CHIP_K` 상대값이라 튜닝 후에도 통과해야 함)

- [ ] **Step 5: Commit** — 시뮬 결과 표 요약을 커밋 본문에. `git commit -m "Add economy sim and tune progression constants"`

### Task 3: 세이브 v2 + 새 상태

**Files:**
- Modify: `index.html` state 구간(`:90-94`), `save()/load()`(`:280-290`)

**Interfaces:**
- Consumes: `migrate(raw)`
- Produces (전역 상태): `padLv:number[12]`, `speedLv`, `chips`, `chipsEver`, `lifetime`, `shop:{speed,slot,tier,start}`, `feverT`(남은 피버 초), `feverCD`(남은 쿨다운 초), `padSlots()`=`9+shop.slot`
- `earn()`은 `lifetime`에도 누적.

- [ ] **Step 1: Implement** — `load()`: raw 파싱 → `raw.v===1`이면 `bounceBank.v1.bak`에 원문 저장 → `migrate` → 상태 적용(`padCount`는 `clamp(…,1,padSlots())`). `save()`는 v2 전체 필드 저장.
- [ ] **Step 2: Verify (Playwright)** — `localStorage`에 Task 1 테스트의 `v1` 객체를 심고 새로고침 → evaluate로 `stage===4 && padCount===5 && coins.length===3 && lifetime>0`, `localStorage['bounceBank.v1.bak']` 존재. 새로고침 한 번 더 → 값 유지.
- [ ] **Step 3: Commit** — `git commit -m "Save format v2 with v1 migration and backup"`

### Task 4: 패드 레벨 + PAD 카드

**Files:**
- Modify: `index.html` `buildPadSprites`(`:118-129`), `earn`(`:219`), `padHit`(`:229-237`), `offers/act/addPad`(`:252-261`), `drawCardIcon/drawBottom`

**Interfaces:**
- Consumes: `padLv`, `lvCost(k)`, `PAD_LV_MAX`
- Produces: `padMult(i)=2**(padLv[i]-1)`, `levelUpPad()`(최저 레벨·최소 인덱스 패드 +1, fx 포함), `nextLvPad()->index|-1`
- `earn(c,x,y,padIndex)` — 시그니처에 패드 인덱스 추가.

- [ ] **Step 1: 스프라이트** — `buildPadSprites(p, lv)`: LV1은 현재 팔레트 그대로, LV2~8은 `TIERS[lv-1].c`(SILVER…PRISM) 색으로 스트라이프/면 채색, LV8은 PRISM처럼 프레임마다 hue 회전. 패드별로 레벨이 바뀔 때만 재빌드. `applyPalette`도 각 패드의 현재 레벨로 빌드.
- [ ] **Step 2: 수익·카드** — 바운스 수익 `TIERS[c.tier].v * padMult(i) * incomeMult() * speedIncome`(Task 5 전까지 `speedIncome=1`). PAD 카드: 빈 슬롯 있으면 `ADD PAD`(sub `n/padSlots()`), 없으면 `PAD LV+`(sub `LV`+대상 레벨, 아이콘 색=다음 레벨 색), 전부 8이면 `MAX`. 레벨업 fx: 패드 플래시 + 파티클 + `PAD LV3!` 팝업 + shake. 모든 활성 패드가 같은 레벨 L(≥2)에 처음 도달하면 배너 `ALL PADS <TIERS[L-1].n>!`.
- [ ] **Step 3: Verify (Playwright)** — evaluate `money=1e15` 후 PAD 카드 연타 → 9패드 후 LV+로 전환, `padLv` 최저부터 증가 확인. evaluate로 `padLv.fill(1..8)` 각각 스크린샷 → 8단계 외형이 서로 구분되고 픽셀 톤 유지. 콘솔 에러 0.
- [ ] **Step 4: Commit** — `git commit -m "Pad levels with tier-colored evolution"`

### Task 5: SPEED·피버·카드 4장 레이아웃

**Files:**
- Modify: `index.html` `frame()`(`:444`), `update()`, `drawBottom()`(`:391-406`), 입력(`:421-426`), `SFX`

**Interfaces:**
- Consumes: `speedTotal`, `speedSplit`, `speedCost`, `SPEED_MAX`, `FEVER_DUR`, `FEVER_CD`
- Produces: `timeScale`, `speedIncome`(매 프레임 `speedSplit(speedTotal(speedLv,shop.speed,feverT>0))`로 갱신), `startFever()`, 카드 4장 좌표 `cardX(i)=3+i*44`, 폭 42.

- [ ] **Step 1: 시간 스케일** — `frame()`에서 `acc += dt*timeScale`, 루프 상한은 ×3에서도 충분하게(예: 120). `update(dt)`를 `update(dt, sdt=dt*timeScale)`로: 스폰 쿨다운·still 감지·MERGES·coin `ph/sq/orb`는 `sdt`, 나머지는 `dt`.
- [ ] **Step 2: SPEED 카드 + 4장 레이아웃** — 카드 4장(이름 `PAD/COIN/MERGE/SPEED`, 아이콘 `»+`, sub `LV n`, 가격 scale2→1 폴백). 히트 테스트·`spark` 위치·키보드 `1-4` 갱신. 정보 줄: `$/S …` · `◆<chips> X<chipMult>`(x≈70~120, Task 7에서 탭 연결) · 피버 아이콘 · 음소거.
- [ ] **Step 3: 피버** — 플레이필드 탭(논리 y가 `24-EX` < y < `236`(EX 보정 후), 카드/정보 줄 제외) 시 `feverCD<=0`이면 `startFever()`: `feverT=FEVER_DUR`, `feverCD=FEVER_CD`, `FEVER!` 배너, 상승 아르페지오 SFX, 바구니 네온 무지개 펄스. 쿨다운 중이면 `READY IN 34S` 팝업. 피버 중 `ips` 갱신 스킵. 첫 실행(피버 미사용) 시 `TAP!` 힌트 1회. 키 `f`.
- [ ] **Step 4: Verify (Playwright, 390×844 + 1280×800)** — 카드 4장 가격 가독성 스크린샷. 플레이필드 탭 → `feverT>0`; 카드 탭 → 피버 안 걸림; 정보 줄 탭 → 피버 안 걸림 (Review Focus 2). `speedLv=10; shop.speed=5` + 피버 → `timeScale===3 && speedIncome===2`. 피버 중 `ips` 값 고정 (Review Focus 3). 콘솔 에러 0.
- [ ] **Step 5: Commit** — `git commit -m "Speed upgrade, tap fever, and four-card layout"`

### Task 6: 추가 슬롯 3개 + 신규 코인 3등급

**Files:**
- Modify: `index.html` `PADS`(`:88`), `TIERS`/`EMB`(ECON 블록), `bounceFx`/`update` fx 분기, `pairTier`, 카드 MERGE 표시

**Interfaces:**
- Consumes: `shop.slot`, `shop.tier`
- Produces: `PADS.length===12`, `maxTier()=7+shop.tier`(기존 `MAXT` 상수 대체), fx 키 `'nova'|'cosmos'|'omega'`

- [ ] **Step 1: 슬롯** — float 패드 3개를 `PADS`에 추가(빈 공간, 기존 패드·x=90 낙하선과 비겹침). 활성 슬롯 수는 `padSlots()`. 고스트 마커는 `padCount<padSlots()`일 때만.
- [ ] **Step 2: 등급** — NOVA/COSMOS/OMEGA 색·엠블럼·fx(스펙 5.8). `pairTier`·MERGE·`earn` 팝업 색은 `maxTier()` 기준. `buildCoin`은 11개 전부.
- [ ] **Step 3: Verify (Playwright)** — `shop.slot=3; padCount=12` 상태로 60초 관찰: 코인 끼임(still 반복) 없음, 패드 통과 없음, 스크린샷. 신규 3등급 코인을 evaluate로 스폰해 각 스크린샷(바운스 fx 포함). `shop.tier=0`이면 PRISM 쌍이 MERGE 불가.
- [ ] **Step 4: Commit** — `git commit -m "Three extra pad slots and NOVA/COSMOS/OMEGA tiers"`

### Task 7: BANK 화면 + CASH OUT

**Files:**
- Modify: `index.html` 입력, `update`, `render`, 새 함수들

**Interfaces:**
- Consumes: `chipGain`, `chipsTotal`, `SHOP`, `PRESTIGE_STAGE`, `coinCap`
- Produces: `bankOpen:boolean`, `confirmOpen:boolean`, `drawBank()`, `buyShop(id)`, `cashOut()`, `resetRun()`

- [ ] **Step 1: BANK 오버레이** — 정보 줄 ◆ 영역 탭(또는 `b`) → 열기. 게임은 뒤에서 계속. 레이아웃(스펙 5.7): `BANK` / 보유 칩·배율 / CASH OUT 버튼(`+N◆` 또는 `REACH STAGE 6`) / SHOP 4행(이름·레벨·효과·비용) / 닫기. 열려 있는 동안 카드·피버 입력 차단. CASH OUT 가능 + gain≥1이면 정보 줄 ◆ 깜빡임.
- [ ] **Step 2: 상점 구매** — `buyShop(id)`: 칩 차감, 레벨+1, 즉시 효과(슬롯은 바로 빈 슬롯, 등급은 바로 MERGE 가능, SPEED+는 바로 반영, START+는 다음 판부터).
- [ ] **Step 3: CASH OUT** — 확인 `RESET? +N◆ [YES][NO]` → `cashOut()`: `chips+=gain; chipsEver+=gain` → 연출(코인이 투입구로 빨려 들어감 ~0.8s, 화이트 플래시, 칩 카운터 롤업, 배너 `CASH OUT! / +N◆ / INCOME X…`) → `resetRun()`: `MERGES=[]; spawnQ=0`, money 0, stage 1, stageEarned 0, `padCount=1+shop.start`, `padLv.fill(1)`, `speedLv=0`, `feverT=feverCD=0`, `ips=secAcc=0`, 코인 = `1+2*shop.start`개 BRONZE 스폰 큐, `applyPalette()`, `save()`. 유지: chips, chipsEver, shop, lifetime, best, muted. 코인 상한은 `coinCap(stage, 1+2*shop.start)`.
- [ ] **Step 4: Verify (Playwright)** — evaluate `stage=6; lifetime=CHIP_K*400; chipsEver=0` → BANK에 `+20◆`. 합체 애니메이션 진행 중 + `spawnQ=3` 상태에서 CASH OUT (Review Focus 4) → 에러 0, `coins.length`가 시작 코인 수와 일치, `ips===0`(Review Focus 3), `chipMult(chipsEver)` 반영. 상점 각 항목 구매 후 효과 확인. BANK·확인창·CASH OUT 배너 스크린샷(390×844).
- [ ] **Step 5: Commit** — `git commit -m "BANK screen with chip shop and CASH OUT prestige"`

### Task 8: 마무리 — 디버그 해시, 전체 검증, 배포 준비

**Files:**
- Modify: `index.html` (`#debug`), `sw.js:2`
- Modify: 메모리 `bounce-bank-overview.md`

- [ ] **Step 1: `#debug`** — URL 해시 `#debug`일 때만 수익 ×1000 (테스트용, 세이브에 저장 안 함).
- [ ] **Step 2: 전체 검증** — `node tools/econ.test.mjs && node tools/sim.mjs` 통과. Playwright `#debug`로 1판 → CASH OUT → 2판 진행 플로우를 390×844에서 끝까지 실행, 콘솔 에러 0, 주요 장면 스크린샷.
- [ ] **Step 3: `sw.js` VERSION `bb-4`**
- [ ] **Step 4: Commit** — `git commit -m "Debug hash, final verification, bump SW cache to bb-4"`
- [ ] **Step 5: 메모리 갱신 + push 여부 사용자 확인**
