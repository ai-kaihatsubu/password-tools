# パスワード生成ツール（products/002-password-generator）

第2号製品。安全なパスワードをワンクリックで作成するツールです。
完全クライアントサイド・サーバー不要・オフライン動作（PWA対応）。

## 主な機能

- `crypto.getRandomValues` を用いた安全な乱数生成（rejection samplingで剰余バイアスを排除）
- 長さ設定（4〜64文字、スライダー＋数値入力で双方向同期）
- 文字種トグル（英大文字 / 英小文字 / 数字 / 記号、最低1種は必須）
- オプション
  - 紛らわしい文字を除外（0/O, 1/l/I など）
  - 選択した各文字種を最低1文字含める
- 生成ボタン＋オプション変更時の自動再生成
- まとめて生成（無料版5個、Pro版50個、各行コピー対応）
- 強度メーター（エントロピー概算、4段階・色分け表示）
- クリップボードコピー（`navigator.clipboard` + フォールバック、コピー時フィードバック）
- 名前付きローカル保存（生成パスワードに名前を付けてlocalStorageに保存、最初と最後の1文字以外を伏字にしたマスク表示リスト、表示/隠す切替・行ごとのコピー・削除）
- ダーク/ライトテーマ切替
- アクセシビリティ対応（ラベル、aria属性、キーボード操作、コントラスト）
- レスポンシブ・モバイルファースト
- PWA対応（ホーム画面に追加・オフライン動作）

## プライバシー設計（重要）

- 生成処理は端末内のみで行われ、**外部送信は一切行いません。**
- localStorageには「長さ・文字種・オプション・テーマ・Proフラグ」などの設定情報を保存します（キー: `pwgen_settings`）。
- 利用者が「このパスワードを保存」を使った場合のみ、名前とパスワードをlocalStorage（キー: `pwgen_saved_v1`）に**暗号化なし**で保存します。保存しない限り、生成したパスワードは再読み込みで消えます。

## 収益設計（現状はすべてプレースホルダ）

| レール | 実装箇所 | 状態 |
| --- | --- | --- |
| AdSense | `index.html` の `.ad-slot--top` / `.ad-slot--bottom`、`monetization.js` の `ADSENSE_CLIENT_ID` | プレースホルダ。お布施とは無関係（広告はお布施に関わらず表示） |
| アフィリエイト | `monetization.js` の `AFFILIATE_ITEMS`（「おすすめのパスワード管理ツール」枠、パスワード管理ツール/VPN） | プレースホルダURL、[PR]表記・`rel="sponsored nofollow noopener"`設定済み |
| Stripe (お布施) | `monetization.js` の `STRIPE_DONATION_URL`、`#ofuse-button` | 未設定時はボタン非表示 |

Pro動作確認用に、画面下部の「Proフラグを切替（開発用）」ボタンでlocalStorageの
`tf_ofuse`フラグを切り替えられます（開発用）。

## 公開手順（社長がやるキー登録一覧）

1. Googleアドセンスの審査申請・通過後、`monetization.js`の`ADSENSE_CLIENT_ID`と
   `index.html`内のコメントアウトされたAdSenseスクリプト・`<ins>`タグを有効化する
2. アフィリエイト提携（パスワード管理ツール・VPNサービス等）の承認後、`monetization.js`の
   `AFFILIATE_ITEMS`を実際のリンクに置き換える
3. Stripeでお布施用のPayment Linkを発行し、
   `monetization.js`の`STRIPE_DONATION_URL`に設定する
4. `operator.html`の運営者情報・特定商取引法に基づく表記のTODOを埋める
5. 公開先リポジトリ（password-generator）でGitHub Pagesを設定し、`canonical`/OGPのURL
   （`https://ai-kaihatsubu.github.io/password-generator/`）が実URLと一致していることを確認する
6. 開発用「Proフラグを切替」ボタンは公開前に削除またはコメントアウトを検討する
7. リーガル/リスクチェック（`approval-queue/pending/002-password-generator/`）と社長承認を経て公開する

## ファイル構成

- `index.html` … ページ本体（SEO・ツールUI・広告枠・アフィリ枠・Pro案内・使い方/FAQ）
- `style.css` … 共通スタイル＋本ツール固有のコンポーネント
- `app.js` … 生成ロジック（crypto.getRandomValues）・強度メーター・自動保存・テーマ切替
- `monetization.js` … 収益3レールの設定・レンダリング
- `manifest.webmanifest` / `sw.js` / `icons/` … PWA関連
- `privacy.html` / `terms.html` / `operator.html` … 法務ページ
