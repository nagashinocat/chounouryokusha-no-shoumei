# 念力ルート Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「超能力者の証明」に、観客が見ていない隙に道具や腕力で物を曲げていく「念力ルート」を足す。

**Architecture:** ルールと見張りの状態遷移、操作の判定は DOM と Three.js に依存しない純粋なモジュール(`src/nenriki/`)にして Vitest で固める。部屋・観客・舞台の広がり・BGM・世界人口・名前の仕組みは既存の部品を共有する。画面の流れは透視ルートと同じく「flow(純粋)+ view(描画の窓口)」に分ける。

**Tech Stack:** 既存と同じ(Three.js r170 を vendor、ES modules、Vitest、Playwright、Firebase)。

**Spec:** `docs/superpowers/specs/2026-11-19-nenriki-route-design.md`

## Global Constraints

- 物は10個、この順：スプーン、フォーク、鍵、鉄パイプ、道路標識、鉄骨、車、電車、東京タワー、自由の女神の腰
- 信者：開始4、曲げるごとに 40 → 400 → 4,000 → 40,000 → 400,000 → 4,000,000 → 40,000,000 → 400,000,000 → 世界人口(10個目でクリア)
- 道具と操作：腕力=こする、サンダー=長押し、バーナー=タッチ
- 疑い(0〜100)：見られて曲げると 腕力+8/秒、バーナー+25/回、サンダー+40/秒。痕跡(バーナー1.2秒・サンダー0.6秒)が目が戻った瞬間に残っていたら+10。見られていて何もしなければ−4/秒。100でゲームオーバー
- 速さ：サンダーは腕力の3倍、バーナーはその中間
- 見張り：見ている1.5〜3.5秒 → 見ていない1.5〜4秒 → 前触れ0.6秒(最終物で0.35秒)。物が進むほど「見ていない」と「前触れ」が短くなる
- 乱数は `src/rng.js` の `randomIndex` 系(crypto)
- 1プレイ4〜6分が目安
- ゲームオーバーの文・世界人口・認められた超能力者は透視ルートと共有。名前は1人1回
- 透視ルートの既存テストはすべて通ったままにする
- 文言は日本語。テスト用のデバッグモードは localhost でだけ効く

## Review Focus

1. 曲げている途中で2本目の指が触れる/道具ボタンを押す → 道具は1つだけが効き、ボタンを押すこと自体は曲げにならない(Task 3 にテスト)
2. ゲーム中に画面を切り替えて戻る → 離れていた時間で見張りが進んで見つかったり、疑いが一気に上がったりしない(Task 2 にテスト：dt を0.1秒で頭打ち)
3. こする操作でページがスクロールしたり拡大したりしない(Task 6 の e2e で `touch-action:none` とスクロール位置を確認)
4. 疑いと曲がり具合が範囲(0〜100、0〜1)の外に出ない(Task 1 にテスト)
5. 透視ルートが今までどおり遊べる(Task 4 で既存の全テストを流す)

---

## File Structure

```
src/nenriki/rules.js     物・道具・信者の表、ゲームの状態を進める純粋な関数
src/nenriki/watch.js     見張り(見ている/見ていない/前触れ)の状態遷移
src/nenriki/input.js     こする/長押し/タッチを「その瞬間の作業量」に変える
src/nenriki/flow.js      念力ルートの画面の流れ(view を受け取る)
src/nenriki/objects.js   10個の物の3D形状と曲げの変形
src/nenriki/view.js      3D・HUD・音をつなぐ窓口(flow から呼ばれる)
src/ui/screens.js        ルート選択画面、念力ルートのリザルト(既存に追加)
src/ui/hud.js            疑いゲージ・曲がり具合・道具ボタン(既存に追加)
src/audio.js             道具の音と警告音(既存に追加)
src/hall.js, counter.js  名前に route を足す(既存を変更)
src/app.js               ルート選択で透視/念力を切り替え(既存を変更)
firestore.rules          clearers に route を許す(既存を変更)
tests/nenriki-*.test.js, e2e/nenriki.spec.js
```

---

### Task 1: 念力ルートのルール

**Files:** Create `src/nenriki/rules.js`, `tests/nenriki-rules.test.js`

**Interfaces:**
- Produces:
  - `OBJECTS: Array<{ id, name, work }>`(10個、work は曲げるのに必要な量。1プレイ4〜6分になるよう、最初は小さく後ろほど大きい)
  - `BELIEVERS_AFTER: number[]`(長さ9：40, 400, …, 400_000_000。10個目は世界人口)
  - `TOOLS = { arm, sander, burner }` 各 `{ rate, watchedPenalty, trace }`(rate は作業量の倍率：arm 1、burner 2、sander 3)
  - `createBendGame({ population }) -> BendGame`：`{ index: 0, progress: 0, suspicion: 0, maxSuspicion: 0, believers: 4, population, status: 'playing', traces: { burner: 0, sander: 0 }, elapsed: 0 }`
  - `stepBend(game, { dt, work, tool, taps, watching, eyesReturned }) -> BendGame`
    - `work`：その瞬間の作業量(腕力ならこすった量、サンダーなら押していた秒数、バーナーならタッチ回数×1)。`tool` のときだけ意味を持つ
    - 見られている間(`watching`)の作業：疑い += 腕力 8×秒 / サンダー 40×秒 / バーナー 25×回
    - 道具を使ったら痕跡タイマーを入れる(バーナー1.2秒、サンダー0.6秒)。`eyesReturned` の瞬間にタイマーが残っていれば疑い +10
    - 見られていて作業がなければ疑い −4×秒
    - 進み具合 += work × rate / OBJECTS[index].work。1以上で次の物へ(progress 0、believers は表の値、10個目で `status:'cleared'`)
    - 疑い ≥ 100 で `status:'over'`。疑いは0〜100、progress は0〜1に収める

- [ ] **Step 1: 失敗するテストを書く**
  - 物は10個で、名前の順が Global Constraints と同じ。最後は「自由の女神の腰」
  - 見られていない間に腕力で必要量ちょうどこする → スプーンが曲がり、believers 40、index 1
  - 見られて腕力1秒 → 疑い 8。サンダー1秒 → 40。バーナー1回 → 25
  - 見られて何もしない1秒 → 疑いが4下がる(0より下がらない)
  - バーナー使用直後0.5秒で目が戻る → +10。1.3秒後 → +0。サンダー0.5秒後 → +10、0.7秒後 → +0
  - サンダーは同じ秒数の腕力の3倍進む
  - 疑い95で見られてサンダー1秒 → 100で `over`、それ以上は増えない(Review Focus 4)
  - 9個曲げると信者 400,000,000、10個目で `cleared` かつ believers === population
  - `over`/`cleared` の後は何を渡しても変わらない
- [ ] **Step 2: 失敗を確認** — `npx vitest run tests/nenriki-rules.test.js` → FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通ることを確認** → PASS
- [ ] **Step 5: コミット** `feat(nenriki): rules`

### Task 2: 見張りの状態遷移

**Files:** Create `src/nenriki/watch.js`, `tests/nenriki-watch.test.js`

**Interfaces:**
- Produces: `createWatch({ index, rand = () => randomFloat() }) -> { state: 'watching'|'away'|'warning', cue: null|'monitor'|'cough'|'flicker', update(dt) -> { state, eyesReturned: boolean, changed: boolean }, setIndex(i) }`
  - `randomFloat()` を `src/rng.js` に追加(crypto で [0,1))
  - 時間：watching 1.5〜3.5秒、away は `lerp(4, 1.5, index/9)` を上限に下限1.5秒からの範囲、warning は `lerp(0.6, 0.35, index/9)`
  - watching → away になるときに cue を1つ選ぶ。warning → watching の瞬間に `eyesReturned: true`
  - `dt` は 0.1 秒で頭打ち(Review Focus 2)

- [ ] **Step 1: 失敗するテストを書く**
  - 固定の rand で、watching → away → warning → watching の順にまわる。各長さが範囲内
  - warning の長さが index 0 で0.6秒、index 9 で0.35秒
  - away の最長が index 0 で4秒、index 9 で1.5秒以下
  - eyesReturned は戻った1回のフレームだけ true
  - `update(30)`(30秒離れていた)でも 0.1 秒しか進まない
- [ ] **Step 2: 失敗を確認** — `npx vitest run tests/nenriki-watch.test.js` → FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通ることを確認** → PASS
- [ ] **Step 5: コミット** `feat(nenriki): watch state machine`

### Task 3: 操作(こする/長押し/タッチ)

**Files:** Create `src/nenriki/input.js`, `tests/nenriki-input.test.js`

**Interfaces:**
- Produces: `createBendInput() -> { setTool(t), down(id, x, y, t), move(id, x, y, t), up(id, t), take(now) -> { tool, work, taps } }`(DOM に依存しない。view がポインターイベントを渡す)
  - 腕力：最初に触れた指(主指)の移動距離 px を作業量に。1回の take で 600px を上限
  - サンダー：主指が押されている秒数
  - バーナー：主指を押して 250ms 以内に離したらタッチ1回
  - 2本目以降の指は無視。道具を切り替えたら主指をリセット(Review Focus 1)

- [ ] **Step 1: 失敗するテストを書く**
  - 腕力：100px 動かして take → work 100。2本目の指が200px動いても増えない
  - サンダー：1.5秒押して take → work 1.5(秒単位)。離したら増えない
  - バーナー：100ms で離す → taps 1。400ms 押して離す → taps 0
  - 押したまま道具を切り替える → 新しい道具では指を離して押し直すまで作業ゼロ
  - take した量は1回で消える
- [ ] **Step 2: 失敗を確認** — `npx vitest run tests/nenriki-input.test.js` → FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通ることを確認** → PASS
- [ ] **Step 5: コミット** `feat(nenriki): gesture input`

### Task 4: ルート選択と、名前のルート項目

**Files:** Modify `src/ui/screens.js`, `src/app.js`, `src/hall.js`, `src/counter.js`, `firestore.rules`, `style.css`; Tests `tests/hall.test.js`, `e2e/route.spec.js`, 既存 e2e(タイトルの後にルート選択を1回押す)

**Interfaces:**
- Produces:
  - `screens.route() -> Promise<'toushi'|'nenriki'>`(タイトルの後。2つのボタン：「透視ルート」副題「モニターのマークを、勘だけで当てろ」、「念力ルート」副題「見られていない隙に、曲げろ」)
  - `hall.submit(name, route)`、`hall.fetchEntries() -> Array<{ name, route }>`、`tickerText(entries)` と `creditPages(entries)` は名前の横に「(透視)」「(念力)」を添える。`fetchNames` は残す(互換)
  - `firebaseBackend().addClearer(name, route)` は `{ name, route, at }` を書く
  - `firestore.rules` の clearers：keys は `['name','route','at']` のみ、`route in ['toushi','nenriki']`
  - app：ルートが 'toushi' なら既存の flow、'nenriki' なら Task 6 の flow。2回目以降(次の挑戦者)は同じルートで続ける。リザルトに「ルートを選び直す」を足す
- 既存 e2e の「始める」までの手順に、ルート選択(透視ルート)を1回挟む

- [ ] **Step 1: 失敗するテストを書く**
  - hall：`submit('たろう','nenriki')` → `fetchEntries()` に `{name:'たろう', route:'nenriki'}`。`tickerText([{name:'たろう',route:'nenriki'}])` に「たろう(念力)」
  - `e2e/route.spec.js`：タイトルをタップ → 2つのボタン → 「透視ルート」で「始める」が出る / 「念力ルート」で念力ルートの最初の画面(`[data-nenriki]`)が出る
  - ルールのテスト(`tests/rules/`)に route の許可・不許可を足す(エミュレーターがある環境で `npm run test:rules`)
- [ ] **Step 2: 失敗を確認** — `npx vitest run tests/hall.test.js` と `npx playwright test e2e/route.spec.js` → FAIL
- [ ] **Step 3: 実装**(念力ルート側は Task 6 まで、`[data-nenriki]` の仮画面でよい)
- [ ] **Step 4: 通ることを確認** — `npx vitest run` と `npx playwright test` がすべて PASS(Review Focus 5)
- [ ] **Step 5: コミット** `feat: route selection and route on recognized names`

### Task 5: 10個の物の3D形状と曲げ

**Files:** Create `src/nenriki/objects.js`, `e2e/nenriki-objects.spec.js`

**Interfaces:**
- Consumes: `stage`(既存)
- Produces: `buildObject(id) -> { group: THREE.Group, setBend(t: 0..1), size: number, place: 'table'|'room'|'outside', bendPoint: THREE.Vector3 }`
  - 形はブラウザ内で組み立てる(スプーン・フォーク・鍵は板と円柱、鉄パイプは円柱、標識は柱と板、鉄骨はI形、車・電車は箱の組み合わせ、東京タワーは格子の四角すい、自由の女神は台座・ローブの体・掲げた腕と松明・冠のシルエット)
  - `setBend(t)`：曲げる軸に沿って頂点を曲げる変形(t=1で90度前後)。自由の女神は腰から上が前へお辞儀する
  - `size` はカメラの引き具合に使う(スプーン 0.2 〜 自由の女神 90)

- [ ] **Step 1: 失敗するテストを書く** — `e2e/nenriki-objects.spec.js`：`?test=objects` で10個を順に `setBend(0)` と `setBend(1)` でスクショ。各物で0と1の画素差が一定以上(曲がって見える)。スクショ20枚を `test-results/obj-*.png` に保存
- [ ] **Step 2: 失敗を確認** — `npx playwright test e2e/nenriki-objects.spec.js` → FAIL
- [ ] **Step 3: 実装**(`main.js` に `?test=objects` の確認用の分岐を足す)
- [ ] **Step 4: 通ることを確認** → PASS。20枚を目で見て、何の物か分かるか、自由の女神がお辞儀に見えるかを確かめる
- [ ] **Step 5: コミット** `feat(nenriki): bendable objects`

### Task 6: 念力ルートの画面の流れ

**Files:** Create `src/nenriki/flow.js`, `src/nenriki/view.js`, `tests/nenriki-flow.test.js`, `e2e/nenriki.spec.js`; Modify `src/ui/hud.js`, `src/app.js`, `src/debug.js`, `style.css`

**Interfaces:**
- Consumes: Task 1〜5、既存の `counter`, `storage`, `hall`, `challenger`, `audience`, `stage`
- Produces:
  - `createBendFlow({ counter, storage, view, hall, rig = null, clock }) -> { start(): Promise<Result> }`
    - view：`showIntro(challenger)`, `presentObject(index)`, `frame() -> Promise<{ dt, input: { tool, work, taps } }>`(1フレームごと), `showWatch(state, cue, warning)`, `showProgress(game)`, `showBent(game)`, `showClear(game)`, `askNickname()`, `showGameOver(text, before, after)`, `showResult(result)`
    - 1フレームごとに `watch.update(dt)` → `stepBend` → view に反映。物が変わったら `watch.setIndex`
    - クリアで名前を聞き `hall.submit(name, 'nenriki')`、ゲームオーバーで `counter.reportVanished()`
    - Result：`{ route:'nenriki', bentCount, lastObject, elapsed, maxSuspicion, believers, cleared, vanishedNumber, nickname, challenger, best }`、自己ベストは曲げた数を `storage` に保存
  - HUD：疑いゲージ(赤いバー)、曲がり具合のバー、道具ボタン3つ(腕力/サンダー/バーナー)。曲げる場所は `touch-action:none`
  - 信者が増えたら `audience.setBelievers(n)` と `audio.setLayers(layersForTier(audience.tier))`(舞台の広がりとBGMの楽器を透視ルートと同じに)
  - 物の大きさ(`size`)と置き場所(`place`)に合わせてカメラを引く
  - モニター：砂嵐に「これを曲げろ：〇〇」
  - 観客：watching で赤い目が点灯、away で消灯して顔がそれる、warning で目がちらつき短い警告音
  - デバッグ(localhost のみ)：`?debug=bendrig`(見張りは常に away、1フレームで曲がる)、`?debug=caught`(見張りは常に watching)

- [ ] **Step 1: 失敗するテストを書く**
  - `tests/nenriki-flow.test.js`(偽の view・時計)
    - 常に away で作業を流し続けると10個曲がって `showClear` → `askNickname` → `hall.submit(名, 'nenriki')` → `showResult`
    - 常に watching でサンダーを押し続けると疑い100で `showGameOver` と `reportVanished` 1回
    - Result の項目が揃い、自己ベストが保存される
  - `e2e/nenriki.spec.js`
    - `?debug=bendrig`：ルート選択で念力 → 挑む → こすると物が次々曲がり、自由の女神の後に名前入力 → リザルトに「念力」
    - `?debug=caught`：長押しを続けると疑いゲージが満ちてゲームオーバーの文
    - 曲げる場所でこすってもページがスクロールしない(`window.scrollY` が0のまま、Review Focus 3)
- [ ] **Step 2: 失敗を確認** — `npx vitest run tests/nenriki-flow.test.js`、`npx playwright test e2e/nenriki.spec.js` → FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通ることを確認** → PASS。プレイを録画して、目をそらす合図と前触れが見て分かるかを目で確かめる
- [ ] **Step 5: コミット** `feat(nenriki): flow, HUD and watchers`

### Task 7: 道具の演出と音

**Files:** Modify `src/nenriki/view.js`, `src/audio.js`, `tests/audio.test.js`

**Interfaces:**
- Produces: `audio.play('rub'|'sander'|'burner'|'warn'|'bent')`、`audio.loop('sander', on)`(長押し中だけ鳴り続ける)
  - 見た目：サンダーは火花と粉、バーナーは青い炎と赤熱(痕跡の間は赤く光る)、腕力は手が震える

- [ ] **Step 1: 失敗するテストを書く** — 偽の AudioContext で `play('warn')` などが音を作ること、`loop('sander', true)` を2回呼んでも音が1本だけ、`loop(false)` で止まること
- [ ] **Step 2: 失敗を確認** — `npx vitest run tests/audio.test.js` → FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通ることを確認** → PASS。e2e の録画で演出を目で確かめる
- [ ] **Step 5: コミット** `feat(nenriki): tool effects and sounds`

### Task 8: クリア・ゲームオーバー・リザルト・共有

**Files:** Modify `src/nenriki/view.js`, `src/ui/screens.js`, `src/share.js`, `tests/share.test.js`, `e2e/nenriki.spec.js`

**Interfaces:**
- Produces:
  - クリア：自由の女神がお辞儀しきる → 地球の明かりが灯る(既存の `fx.clear` を使う)
  - ゲームオーバー：観客が全員立ち上がってこちらを指さす → 暗転 → 既存の文と人口の減り
  - `screens.result(r)` は `r.route === 'nenriki'` のとき：曲げた物の数と最後の物、時間、疑いの最高値、信者、自己ベスト
  - `shareText(r)`(念力)：`【超能力者の証明】念力で${lastObject}まで曲げた(疑い最高${maxSuspicion}%)`。結果画像も念力用の中身

- [ ] **Step 1: 失敗するテストを書く** — 念力の Result で `shareText` が上の形になる。e2e の bendrig でリザルトに「自由の女神の腰」
- [ ] **Step 2: 失敗を確認** → FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通ることを確認** — `npx vitest run` と `npx playwright test` がすべて PASS
- [ ] **Step 5: コミット** `feat(nenriki): clear, game over, result and share`
