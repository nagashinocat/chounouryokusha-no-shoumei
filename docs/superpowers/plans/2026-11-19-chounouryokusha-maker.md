# 超能力者メーカー Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホのブラウザで遊べる、全部3Dのデスゲーム調カード当てゲーム「超能力者メーカー」を作り、GitHub Pages で公開できる状態にする。世界人口は Firebase で全プレイヤー共通にする。

**Architecture:** ビルドなしの静的サイト(ES modules + importmap)。ゲームのルール・確率・挑戦者生成・保存は DOM と Three.js に依存しない純粋なモジュールにして Vitest でテストする。3D 描画(Three.js)と画面の流れ(`flow.js`)はその上に載せ、Playwright のスクショと操作で確かめる。共有カウンターは Firestore 文書1つ＋セキュリティルールで守り、ルールは Firebase エミュレーターでテストする。

**Tech Stack:** Three.js r170(CDN, importmap)、Firebase JS SDK v11 modular(gstatic CDN: app / auth 匿名 / firestore / app-check reCAPTCHA v3)、Vitest、Playwright(Chromium、スマホ縦 390×844)、firebase-tools エミュレーター＋@firebase/rules-unit-testing、GitHub Pages。

**Spec:** `docs/superpowers/specs/2026-11-19-chounouryokusha-maker-design.md`

## Global Constraints

- 文言はすべて日本語。ゲーム名「超能力者メーカー」
- カード4枚、図柄4種 `['circle','plus','wave','star']`(○・＋・波・☆)。正解は毎ラウンド1枚
- 正解位置は `crypto.getRandomValues` で一様に決める(`Math.random` 禁止)
- 信者は最初 **4人**。当たり ×4、外れ `Math.floor(n * 3 / 4)`、0でゲームオーバー
- 世界人口 = `8_200_000_000 − 消えた挑戦者の数`。信者 ≥ 世界人口でクリア
- 運命の選択：`n * 4 >= 世界人口` のラウンド
- 1ラウンドの演出は2〜3秒以内(運命の選択を除く)
- ゲームオーバー文：「彼の記録も記憶も、誰も持っていなかった。」(女性の挑戦者は「彼女の」)
- 初回の文：「なぜか、あなたは全人類に超能力者だと信じさせなければならなくなった。」/ 2回目以降：「次の挑戦者は、こいつだ。」
- 残酷な描写はしない
- サーバーは Firestore のみ、無料の Spark プラン。Cloud Functions は使わない
- スマホ縦画面が基本。外部ビルド工程なし(GitHub Pages にそのまま置ける)

## Review Focus

1. 演出中の連打・2本指タップ → ラウンドあたり判定は1回だけ(Task 5 にテスト)
2. Firebase に届かない(オフライン・広告ブロック・設定未入力) → ゲームは普通に遊べ、最後に分かった数で世界人口を表示(Task 4 にテスト)
3. ゲームの途中で他の人のゲームオーバーにより世界人口が減る → そのゲーム中は開始時の世界人口で判定し、表示も揺れない(Task 1 にテスト)
4. WebGL が使えない端末 → 真っ白ではなく「この端末では遊べません」の案内(Task 5 にテスト)
5. Web Share で画像が送れない環境(PC・一部ブラウザ) → 画像保存とXの投稿リンクに切り替え(Task 8 にテスト)

---

## File Structure

```
index.html                 importmap、canvas、UI用オーバーレイ
style.css
src/config.js              Firebase 設定値(プレースホルダ)、定数
src/rules.js               ゲーム状態とルール(純粋)
src/rng.js                 一様乱数
src/odds.js                確率とたとえ
src/challenger.js          挑戦者のランダム生成
src/storage.js             localStorage(最高記録・挑戦者番号・最後の消えた数)
src/counter.js             共有カウンター(Firebase)
src/tiers.js               信者数 → 舞台の段階
src/scene/stage.js         renderer・部屋・照明・モニター・カメラ
src/scene/cards.js         4枚のカード・めくり・タップ判定
src/scene/audience.js      仮面の観客・群衆・都市・地球、反応
src/scene/fx.js            カメラワーク・運命の選択・暗転
src/ui/hud.js              信者数・連続・世界人口
src/ui/screens.js          オープニング・挑戦者紹介・ゲームオーバー文・リザルト
src/share.js               結果画像生成と共有
src/audio.js               BGM・効果音
src/flow.js                画面の流れ(状態遷移)
src/main.js                起動
assets/audio/*, og.png
firestore.rules, firebase.json
tests/*.test.js            Vitest
tests/rules/*.test.js      ルールのテスト(エミュレーター)
e2e/*.spec.js              Playwright
README.md                  Firebase と Pages の設定手順
```

---

### Task 1: プロジェクトの土台とゲームのルール

**Files:**
- Create: `package.json`, `vitest.config.js`, `src/config.js`, `src/rules.js`, `tests/rules.test.js`, `.gitignore`
- 既存の `docs/` も含めて `git init` し、最初のコミットにする

**Interfaces:**
- Produces:
  - `config.js`: `BASE_POPULATION = 8_200_000_000`, `START_BELIEVERS = 4`, `SYMBOLS = ['circle','plus','wave','star']`
  - `rules.js`:
    - `createGame({ population: number }) -> Game` — `Game = { believers, streak, maxStreak, rounds, population, status: 'playing'|'cleared'|'over' }`
    - `isFateRound(game) -> boolean`
    - `applyGuess(game, hit: boolean) -> Game`(新しいオブジェクトを返す。`playing` 以外では変化しない)

- [ ] **Step 1: 失敗するテストを書く** (`tests/rules.test.js`)
  - `createGame({population: 100})` → `believers 4, streak 0, maxStreak 0, rounds 0, status 'playing'`
  - 当たり：4→16、streak 1、maxStreak 1、rounds 1
  - 外れ：16→12、7→5(切り捨て)、streak 0、maxStreak は保持
  - 信者1で外れ → 0、`status 'over'`
  - population 100、信者 32 で当たり → 128、`status 'cleared'`
  - `isFateRound`：population 100 で信者25 → true、24 → false
  - `status 'over'` の game に `applyGuess` → 同じ値のまま
  - Review Focus 3：`game.population` は生成時の値で固定され、`applyGuess` は外から人口を受け取らない
  - 82億で毎回当たり → 17回目で `cleared`(4^17 ≥ 8.2e9、4^16 < 8.2e9)
- [ ] **Step 2: 実行して失敗を確認** — `npx vitest run tests/rules.test.js` → FAIL(モジュールなし)
- [ ] **Step 3: `rules.js` を実装**
- [ ] **Step 4: 実行して通ることを確認** — 同じコマンド → PASS
- [ ] **Step 5: コミット** `feat: game rules`

### Task 2: 乱数と確率のたとえ

**Files:** Create `src/rng.js`, `src/odds.js`, `tests/rng.test.js`, `tests/odds.test.js`

**Interfaces:**
- Produces:
  - `rng.js`: `randomIndex(n: number, source = crypto) -> number`(0..n-1。棄却法で偏りをなくす)
  - `odds.js`: `oddsFor(streak: number) -> { denominator: number, percentText: string, analogy: string }`
    - `denominator = 4 ** streak`
    - `ANALOGIES: Array<{ denominator: number, text: string }>` — 1/4〜1/2×10^10 を対数でほぼ均等に覆う、身近なたとえ15個以上。文言は作り手が決める(例：1/16 前後「サイコロで2回続けて同じ目を…」に近い粒度)。数値は出典のある値を使う
    - 選び方：`|log(denominator) − log(a.denominator)|` が最小のもの。streak 0 は専用の文言(「何も起きなかったのと同じ確率です」など)

- [ ] **Step 1: 失敗するテストを書く**
  - `randomIndex(4, fake)`：fake が 0..2^32-1 の各値を返すとき、範囲外を返さない。上限近くの値は捨てて引き直す(fake に `0xFFFFFFFF` → 次の値を使う)
  - 実乱数で40万回 → 各位置の出現率が 0.25±0.005
  - `oddsFor(0..17)`：`denominator` が `4**n`、`analogy` が空でない
  - `oddsFor(10).denominator === 1048576`
  - 選んだたとえが本当に最も近い(全候補と比べるテスト)
  - `ANALOGIES` は denominator の昇順
- [ ] **Step 2: 失敗を確認** — `npx vitest run tests/rng.test.js tests/odds.test.js` → FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通ることを確認** → PASS
- [ ] **Step 5: コミット** `feat: rng and odds analogies`

### Task 3: 挑戦者・保存・舞台の段階

**Files:** Create `src/challenger.js`, `src/storage.js`, `src/tiers.js`, `tests/challenger.test.js`, `tests/storage.test.js`, `tests/tiers.test.js`

**Interfaces:**
- Produces:
  - `challenger.js`: `makeChallenger(number: number, pick = randomIndex) -> { number, name, age, job, gender: 'm'|'f', label }`
    - `label` 形式：`挑戦者 No.0042 佐藤 健一(38) 会社員`(番号は4桁ゼロ埋め)
    - 姓30・男名20・女名20・職業20以上のありふれた語。年齢 18〜75
  - `storage.js`(`localStorage` 例外時は記憶のみで動く):
    - `loadBest() -> number`, `saveBest(n)`(大きいときだけ更新)
    - `nextChallengerNumber() -> number`(1から。呼ぶたびに+1して保存)
    - `isFirstVisit() -> boolean`(挑戦者番号が1か)
    - `loadLastVanished() -> number`, `saveLastVanished(n)`
  - `tiers.js`: `tierFor(believers) -> 'room'|'theater'|'stadium'|'city'|'earth'`
    - 境界：≤100 room、≤10,000 theater、≤1,000,000 stadium、≤100,000,000 city、それ以上 earth
  - `gameOverText(gender) -> string` は `challenger.js` に置く(Global Constraints の文言)

- [ ] **Step 1: 失敗するテストを書く**
  - 固定の pick で `label` が形式どおり。番号 7 → `No.0007`
  - `gameOverText('f')` が「彼女の記録も記憶も、誰も持っていなかった。」
  - storage：`saveBest(5); saveBest(3); loadBest() === 5`。`nextChallengerNumber()` が 1,2,3…
  - `localStorage` が例外を投げる環境でも上の操作が落ちない
  - tiers：100→room、101→theater、10000→theater、10001→stadium、1e6→stadium、1e8→city、1e8+1→earth
- [ ] **Step 2: 失敗を確認** — `npx vitest run tests/challenger.test.js tests/storage.test.js tests/tiers.test.js` → FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通ることを確認** → PASS
- [ ] **Step 5: コミット** `feat: challenger, storage, tiers`

### Task 4: 共有カウンター(Firebase)とセキュリティルール

**Files:** Create `src/counter.js`, `firestore.rules`, `firebase.json`, `tests/counter.test.js`, `tests/rules/firestore.test.js`

**Data:**
- `meta/vanished` = `{ count: number }`(初期値 0 は README の手順で手動作成)
- `players/{uid}` = `{ lastAt: timestamp }`

**Interfaces:**
- Consumes: `storage.loadLastVanished/saveLastVanished`, `config.BASE_POPULATION`
- Produces:
  - `createCounter({ backend, storage }) -> { fetchPopulation(): Promise<{ population: number, vanished: number, live: boolean }>, reportVanished(): Promise<{ vanished: number, live: boolean }> }`
    - `backend` は `{ getCount(): Promise<number>, increment(): Promise<number> }`。本番は `firebaseBackend(config)` を同じファイルで export(匿名ログイン → 一括書き込みで `count +1` と `players/{uid}.lastAt = serverTimestamp()`)
    - 失敗・3秒タイムアウト・設定未入力(`apiKey` がプレースホルダ)のときは `live:false` で、`storage` の最後の値を返す。`reportVanished` は失敗時に手元の値を+1して保存(表示用)
    - App Check(reCAPTCHA v3)は `config.appCheckSiteKey` があるときだけ初期化

**ルール(`firestore.rules`):**
- `meta/vanished`：read は誰でも。update は認証済みで、`count` だけのキー、`count == 旧count + 1`、同じ書き込みで `players/{uid}.lastAt == request.time`(`getAfter`)、かつ以前の `lastAt` が無いか `request.time − 30秒` より前
- `players/{uid}`：本人だけ create/update。`lastAt == request.time`、同じ書き込みで `meta/vanished.count` が+1されていること(`getAfter`)
- それ以外は全部拒否

- [ ] **Step 1: 失敗するテストを書く**
  - `tests/counter.test.js`(偽の backend)
    - 正常：`fetchPopulation()` → `{ population: 8_200_000_000 − 12, vanished: 12, live: true }`。最後の値が保存される
    - Review Focus 2：backend が reject/応答なし(3秒)→ `live:false` で保存済みの値。例外は外に出ない
    - 設定未入力 → backend を呼ばずに `live:false`
    - `reportVanished` 失敗時、保存値が+1される
  - `tests/rules/firestore.test.js`(エミュレーター)
    - 認証済み・+1・players 同時書き込み → 成功
    - +2 → 拒否。未認証 → 拒否。players を書かずに count だけ → 拒否
    - 同じ uid で30秒以内の2回目 → 拒否
    - 他人の `players/{uid}` → 拒否
- [ ] **Step 2: 失敗を確認** — `npx vitest run tests/counter.test.js` → FAIL、`npx firebase emulators:exec --only firestore "npx vitest run tests/rules"` → FAIL(Java が無ければ先に入れる)
- [ ] **Step 3: `counter.js` と `firestore.rules` を実装**
- [ ] **Step 4: 両方のコマンドで PASS を確認**
- [ ] **Step 5: コミット** `feat: shared vanished counter with rules`

### Task 5: 3Dの部屋・モニター・カードとタップ

**Files:** Create `index.html`, `style.css`, `src/scene/stage.js`, `src/scene/cards.js`, `src/main.js`(仮), `playwright.config.js`, `e2e/scene.spec.js`, `tests/inputlock.test.js`

**Interfaces:**
- Consumes: `config.SYMBOLS`
- Produces:
  - `stage.js`: `createStage(canvas) -> { scene, camera, renderer, setMonitorSymbol(symbol), render(), onFrame(fn) }` または WebGL 不可なら `null`
    - 暗い窓のない部屋、真上のスポットライト1つ、中央テーブル、正面の壁にモニター。カメラは一人称でテーブルを見下ろす。手前に手元の影
  - `cards.js`: `createCards(stage) -> { deal(symbols: string[]): Promise<void>, onPick(fn: (index) => void), reveal(index, hit: boolean): Promise<void>, focus(index): Promise<void>, lock(), unlock() }`
    - 裏面は無地、表は4図柄。めくりは約0.4秒
    - タップは Raycaster。`lock()` 中は `onPick` を呼ばない
  - `createInputLock() -> { tryAcquire(): boolean, release() }` を `cards.js` から export(純粋。Review Focus 1)
- `index.html`：importmap で `three` を `https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js`。`?debug=rig` で常に当たり、`?debug=miss` で常に外れ(e2e 用。`flow` で使う)

- [ ] **Step 1: 失敗するテストを書く**
  - `tests/inputlock.test.js`：`tryAcquire()` 1回目 true、release 前の2回目 false、release 後 true
  - `e2e/scene.spec.js`(390×844)：起動後 canvas が描画される(スクショの中央付近が真っ黒一色でない)。4枚の位置をタップすると `onPick` が1回だけ発火(同じ位置に50ms間隔で3回タップしても1回)
  - Review Focus 4：WebGL を無効にした起動で「この端末では遊べません」の文が見える
- [ ] **Step 2: 失敗を確認** — `npx vitest run tests/inputlock.test.js` と `npx playwright test e2e/scene.spec.js` → FAIL
- [ ] **Step 3: 実装**(静的サーバは `npx http-server -p 4173`、playwright.config の webServer に設定)
- [ ] **Step 4: 通ることを確認** → PASS。スクショを目で見て、部屋・モニター・4枚が暗く緊張感のある見た目か確かめる
- [ ] **Step 5: コミット** `feat: 3d room, monitor and cards`

### Task 6: 仮面の観客と舞台の段階・反応

**Files:** Create `src/scene/audience.js`, `e2e/audience.spec.js`

**Interfaces:**
- Consumes: `stage`, `tiers.tierFor`
- Produces: `createAudience(stage) -> { setBelievers(n, { animate: boolean }), cheer(): Promise<void>, leave(fraction: number): Promise<void>, setTier(tier): Promise<void> }`
  - room/theater：顔のない白い仮面のローポリなマネキン。InstancedMesh で最大約300体。数は信者数に比例(上限で頭打ち)
  - cheer：一斉に立ち上がる・首を傾ける(0.6秒)。leave：該当数が背を向けて奥へ歩き消える(0.8秒)
  - stadium：壁が倒れて奥にスタジアム級の群衆(点・板ポリの集まり)
  - city：夜の都市の明かり。earth：宇宙から見た地球で、明かりの量が信者に比例
  - 段階の切り替えはカメラが引く1〜1.5秒の演出

- [ ] **Step 1: 失敗するテストを書く** — `e2e/audience.spec.js`：テスト用フック `window.__debug.setBelievers(n)` で 4 / 5,000 / 500,000 / 50,000,000 / 5,000,000,000 にしてスクショ5枚を保存。各スクショが前と違う(画素差が一定以上)
- [ ] **Step 2: 失敗を確認** — `npx playwright test e2e/audience.spec.js` → FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通ることを確認** → PASS。5枚を目で見て、人の3Dがチープではなく不気味に見えるか、iPhone 相当で 30fps 以上か(`stats` を一時表示して確認)
- [ ] **Step 5: コミット** `feat: masked audience and stage tiers`

### Task 7: 画面の流れ(オープニング〜ゲームオーバー)と運命の選択

**Files:** Create `src/flow.js`, `src/ui/hud.js`, `src/ui/screens.js`, `src/scene/fx.js`, `tests/flow.test.js`, `e2e/flow.spec.js`; Modify `src/main.js`

**Interfaces:**
- Consumes: Task 1〜6 のすべて、`counter`
- Produces:
  - `createFlow(deps) -> { start(): Promise<void> }`。`deps = { rules, rng, counter, storage, challenger, view }`。`view` は描画側の窓口(`showOpening(text)`, `showChallenger(label)`, `dealRound(symbols, target)`, `waitPick() -> index`, `showHit(game)`, `showMiss(game, leftCount)`, `fateRound()`, `showClear()`, `showGameOver(text, populationBefore, populationAfter)`, `showResult(result)`) — テストでは偽の view を渡す
  - 1ラウンドの流れ：モニターにお題 → 4枚を配る(図柄の並びは `randomIndex` でシャッフル。お題のカードが正解)→ タップ → 寄ってめくる → 当たり/外れの反応・数字トゥルル → 次へ。合計2〜3秒
  - 外れのとき画面が一瞬赤くなる
  - 運命の選択(`isFateRound`)：照明が落ちスポットライトが4枚だけ、カメラが回り込む、地球の明かりが脈打つ、心音。選ぶとスローでめくる。当たり→地球中が灯るクリア演出。外れ→通常の外れ
  - ゲームオーバー：最後の1人が去る → 暗転 → `gameOverText` → 世界人口カウンターが `8,200,000,000` 形式で1減る(`counter.reportVanished` の結果を使う)→ リザルト
  - 初回は初回の文、2回目以降は「次の挑戦者は、こいつだ。」＋ `label`
  - HUD：信者数(3桁区切り)、🔥連続、世界人口までのバー(対数目盛)
- `?debug=rig` / `?debug=miss` を `flow` の当たり判定に効かせる

- [ ] **Step 1: 失敗するテストを書く**
  - `tests/flow.test.js`(偽の view・counter)
    - 初回は `showOpening` に初回の文、2回目は `showChallenger`
    - 常に外れの rng → 4人→3→2→1→0 で `showGameOver` が `gameOverText(gender)` とともに呼ばれ、`reportVanished` が1回だけ呼ばれる
    - 常に当たり＋人口100 → 3回目が `fateRound`、4回目で `showClear`。`reportVanished` は呼ばれない
    - `showResult` に `maxStreak`, `oddsFor(maxStreak)`, 最終信者数, ラウンド数, 挑戦者, 消えた挑戦者の通し番号が渡る
    - 最高記録が `saveBest` される
  - `e2e/flow.spec.js`：`?debug=miss` で起動 → 4回タップ → ゲームオーバー文が出る → リザルトが出る。`?debug=rig` で17回タップ → 運命の選択の表示(要素 `data-fate`)→ クリア
- [ ] **Step 2: 失敗を確認** — `npx vitest run tests/flow.test.js`、`npx playwright test e2e/flow.spec.js` → FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通ることを確認** → PASS。運命の選択とゲームオーバーを録画(Playwright video)して目で見て、派手さと間の取り方を確かめる
- [ ] **Step 5: コミット** `feat: game flow, fate round, game over`

### Task 8: リザルトと共有

**Files:** Create `src/share.js`, `tests/share.test.js`, `og.png`(1200×630); Modify `src/ui/screens.js`, `index.html`(OGP メタ)

**Interfaces:**
- Consumes: `showResult` に渡る result
- Produces:
  - `drawResultImage(result, canvas) -> Promise<Blob>`(1080×1350 PNG)：ゲーム名、挑戦者 label、最大連続回数、「1/1,048,576」と確率のたとえ、最終信者数、「あなたは〇人目の消えた挑戦者」(ゲームオーバー時)またはクリア表記、URL
  - `shareResult(blob, text, url, env = { navigator, window }) -> Promise<'shared'|'fallback'>`：`navigator.canShare({files})` が true なら Web Share、そうでなければ画像のダウンロードと `https://x.com/intent/post?text=…&url=…` を開くボタンを出す
  - リザルト画面：数字がトゥルルと回って並ぶ → 確率とたとえ → 「共有する」「もう一度(次の挑戦者へ)」

- [ ] **Step 1: 失敗するテストを書く**(`tests/share.test.js`)
  - `canShare` が true の偽 navigator → `navigator.share` が files 付きで呼ばれ `'shared'`
  - Review Focus 5：`canShare` 無し／false → `'fallback'`、X の URL に text と url がエンコードされて入る
  - 共有文に最大連続回数と確率が入る
- [ ] **Step 2: 失敗を確認** — `npx vitest run tests/share.test.js` → FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通ることを確認** → PASS。e2e の `?debug=miss` で出したリザルト画像を保存し、目で見て文字が読めるか確かめる
- [ ] **Step 5: コミット** `feat: result screen and sharing`

### Task 9: 音

**Files:** Create `src/audio.js`, `assets/audio/*`; Modify `src/flow.js`(呼び出し)

**Interfaces:**
- Produces: `createAudio() -> { unlock(), bgm(on: boolean), play(name: 'flip'|'cheer'|'leave'|'heartbeat'|'clear'|'blackout') }`
  - 素材はライセンスが CC0 のもの。出典を `assets/audio/CREDITS.md` に書く。見つからない音は WebAudio で合成(低いドローン、心音)
  - 最初のタップで `unlock()`(iOS 対策)。右上に消音ボタン(状態は localStorage)

- [ ] **Step 1: 失敗するテストを書く** — `tests/flow.test.js` に追加：当たりで `play('cheer')`、外れで `play('leave')`、運命の選択で `play('heartbeat')`(偽の audio)
- [ ] **Step 2: 失敗を確認** — `npx vitest run tests/flow.test.js` → FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通ることを確認** → PASS。実機相当のブラウザで聞いて音量の釣り合いを確かめる
- [ ] **Step 5: コミット** `feat: audio`

### Task 10: 公開準備(Firebase と GitHub Pages)

**Files:** Create `README.md`; Modify `src/config.js`

- [ ] **Step 1: README に持ち主がする手順を書く**：Firebase プロジェクト作成 → Web アプリ追加 → 設定値を `config.js` へ → 匿名ログインを有効化 → Firestore 作成 → `meta/vanished {count: 0}` を作る → `firebase deploy --only firestore:rules` → App Check(reCAPTCHA v3)のサイトキー → GitHub リポジトリ `nagashinocat/chounouryokusha-maker` → Pages を main / root で有効化 → OGP の URL を書き換え
- [ ] **Step 2: 全テストを通す** — `npx vitest run` と `npx playwright test` → すべて PASS
- [ ] **Step 3: 設定未入力のままでも遊べることを確認**(Review Focus 2)— `npx http-server` で開き、1ゲーム最後まで遊べる
- [ ] **Step 4: コミット** `docs: setup guide`
- [ ] **Step 5: 持ち主に Firebase 設定値を入れてもらい、本番の共有カウンターが1減ることを確かめてから Pages に push する**
