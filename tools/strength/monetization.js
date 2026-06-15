/* ============================================
   パスワード強度チェッカー : monetization.js
   収益3レールを1ファイルで管理
   1) AdSense  2) アフィリエイト  3) Stripe Payment Link (Pro)
   すべてプレースホルダ / 設定変数で外出し
   ============================================ */

(function () {
  "use strict";

  /* ============================================
     設定（社長が値を入れる箇所）
     ============================================ */
  var ADSENSE_CLIENT_ID = "ca-pub-6568622993777242";

  var CONFIG = {
    // 1) AdSense
    ADSENSE_CLIENT_ID: ADSENSE_CLIENT_ID,

    // 2) アフィリエイト
    // TODO: 提携先のアフィリエイトリンクに置き換える（パスワード管理ツール関連）
    AFFILIATE_ITEMS: [
      {
        label: "TODO: パスワード管理ツール（おすすめ商品名 1）",
        url: "https://example.com/affiliate-link-1", // TODO
      },
      {
        label: "TODO: 二段階認証セキュリティキー（おすすめ商品名 2）",
        url: "https://example.com/affiliate-link-2", // TODO
      },
    ],

    // 3) Stripe
    // TODO: Stripe Payment LinkのURLを設定する
    STRIPE_PAYMENT_LINK_URL: "", // TODO 例: "https://buy.stripe.com/XXXXXXXX"
  };

  /* ---------- 1) AdSense ローダー ----------
     Pro利用者には読み込まない。二重読み込みを防止。 ---------- */
  (function () {
    try {
      var p = window.ToolFactory && window.ToolFactory.isPro && window.ToolFactory.isPro();
      if (ADSENSE_CLIENT_ID && !p && !document.querySelector('script[src*="adsbygoogle.js"]')) {
        var s = document.createElement("script");
        s.async = true;
        s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + ADSENSE_CLIENT_ID;
        s.crossOrigin = "anonymous";
        document.head.appendChild(s);
      }
    } catch (e) {}
  })();

  /* ---------- 2) アフィリエイト枠レンダリング ---------- */
  function renderAffiliateLinks() {
    var list = document.getElementById("affiliate-list");
    if (!list) return;

    list.innerHTML = "";
    CONFIG.AFFILIATE_ITEMS.forEach(function (item) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = item.url;
      a.textContent = item.label;
      a.rel = "sponsored nofollow noopener";
      a.target = "_blank";
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  /* ---------- 3) Stripe Payment Link（Proボタン） ---------- */
  function initProButton() {
    var btn = document.getElementById("pro-button");
    if (!btn) return;

    btn.addEventListener("click", function () {
      if (!CONFIG.STRIPE_PAYMENT_LINK_URL) {
        // TODO: Stripe Payment Link 発行後、CONFIG.STRIPE_PAYMENT_LINK_URLを設定すると
        //       このボタンが実際の決済ページへ遷移するようになる。
        alert("Pro機能（広告非表示）は準備中です。公開までお待ちください。¥480予定。");
        return;
      }
      window.open(CONFIG.STRIPE_PAYMENT_LINK_URL, "_blank", "noopener");
    });
  }

  /* ---------- 起動 ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    renderAffiliateLinks();
    initProButton();
  });

  window.ToolFactoryMonetization = { CONFIG: CONFIG };
})();
