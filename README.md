# 超能力者の証明

なぜか、あなたは全人類に超能力者だと信じさせなければならなくなった。
モニターに映ったマークを、伏せた4枚のカードから勘だけで当て続けるデスゲーム調の3Dブラウザゲーム。

- 当たると信者が4倍、外すと4分の1が離れる。0人でゲームオーバー
- 信者が世界人口(82億 − 消えた挑戦者の数)に届けばクリア
- 世界人口は全プレイヤー共通。誰かがゲームオーバーになるたびに1人減る

ビルド工程はありません。リポジトリをそのまま静的サイトとして置けば動きます。
Firebase を設定しなくても遊べます(その場合、世界人口はその端末の中だけで減ります)。

## 公開までの手順(持ち主がやること)

### 1. Firebase

1. [Firebase コンソール](https://console.firebase.google.com/)でプロジェクトを作る(無料の Spark プランのままでよい)
2. 「アプリを追加」→ ウェブ。表示された設定値のうち `apiKey` `authDomain` `projectId` `appId` を `src/config.js` の `firebaseConfig` に書き込む
3. Authentication → ログイン方法 → **匿名** を有効にする
4. Firestore Database を作成する(本番モード、リージョンは `asia-northeast1` など)
5. Firestore に文書を1つ手で作る：コレクション `meta`、ドキュメントID `vanished`、フィールド `count`(number)= `0`
6. セキュリティルールを反映する：
   ```bash
   npm install
   npx firebase login
   npx firebase use --add        # 作ったプロジェクトを選ぶ
   npm run test:rules            # ルールのテスト(Java が必要)
   npx firebase deploy --only firestore:rules
   ```
7. (おすすめ)App Check：reCAPTCHA v3 のサイトキーを取得し、App Check でウェブアプリに登録。サイトキーを `src/config.js` の `appCheckSiteKey` に書く。慣れてきたら Firestore の App Check を「適用」にする
8. Authentication → 設定 → 承認済みドメインに `nagashinocat.github.io` を追加

### 2. GitHub Pages

1. GitHub に公開リポジトリ `nagashinocat/chounouryokusha-no-shoumei` を作って push
2. Settings → Pages → Branch: `main` / `/ (root)` で公開
3. URL が違う場合は `index.html` の `og:url` `og:image` と `src/config.js` の `GAME_URL` を書き換える

## 開発

```bash
npm install
npm run serve      # http://127.0.0.1:4173
npm test           # ルール・確率などのテスト
npm run e2e        # 3D画面の操作テスト(Chrome)
```

- `?debug=rig` で必ず当たり、`?debug=miss` で必ず外れ(テスト用)
- OGP画像は `tools/og.html` を `node tools/og.mjs` で `og.png` に書き出す(サーバー起動中に)

## 素材

- 3D：three.js r170(MIT, `vendor/`)
- 音：すべて WebAudio で合成
