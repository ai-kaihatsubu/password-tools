/* ============================================
   パスワード生成ツール : monetization.js
   収益3レール（AdSense / アフィリエイト / Stripe）統合エンジン

   ★ 有効化は下の「設定ブロック(CONFIG)」だけ編集すればOK。HTMLの編集は不要です ★
     - 値が未設定（ca-pub-XXXX / スロットXXXX / 空文字 / example.com）の間は、
       各レールは自動的に「無効（準備中）」のまま安全に表示されます。
     - 実値を入れたレールだけが、ページ再読み込み時に自動でONになります。
   ============================================ */

(function () {
  "use strict";

  // ============================================================
  // ★★★ 設定ブロック：社長はここだけ編集してください ★★★
  // ============================================================
  const CONFIG = {
    // 1) Google AdSense（審査通過後に反映） 例: "ca-pub-1234567890123456"
    ADSENSE_CLIENT_ID: "ca-pub-6568622993777242",
    // 各広告ユニットのスロットID（管理画面で発行される10桁前後の数字）
    ADSENSE_SLOTS: { top: "XXXXXXXXXX", bottom: "XXXXXXXXXX" }, // TODO

    // 2) アフィリエイト（[PR]「おすすめのパスワード管理ツール」枠）
    //    url を実リンクに変えた項目だけが表示されます（example.com のままなら非表示）。
    AFFILIATE_ITEMS: [
      { label: "TODO: パスワード管理ツール 1（例: 1Password 等）", url: "https://example.com/affiliate-link-password-manager-1" }, // TODO
      { label: "TODO: パスワード管理ツール 2（例: Bitwarden 等）", url: "https://example.com/affiliate-link-password-manager-2" }, // TODO
      { label: "TODO: VPNサービス（セキュリティ強化の提案）", url: "https://example.com/affiliate-link-vpn-1" }, // TODO
    ],

    // 3) Stripe（Pro ¥480 買い切り）Payment Link発行後にURLを入れるとボタンが決済ページへ遷移
    STRIPE_PAYMENT_LINK_URL: "", // TODO 例: "https://buy.stripe.com/XXXXXXXX"
    PRO_PRICE_LABEL: "¥480 買い切り",
  };
  // ============================================================
  // 以下はエンジン（通常は編集不要）
  // ============================================================

  var isPlaceholderAd   = function (id)  { return !id || /X{4,}/.test(id); };
  var isPlaceholderSlot = function (s)   { return !s  || /X{4,}/.test(s); };
  var isPlaceholderAff  = function (url) { return !url || /example\.com/.test(url); };

  function isProUser() {
    try {
      if (window.ToolFactory && typeof window.ToolFactory.isPro === "function") {
        return window.ToolFactory.isPro();
      }
    } catch (e) {}
    return document.body.classList.contains("is-pro");
  }

  /* 1) AdSense：実IDがあり、Proでない時のみ動的に有効化 */
  function initAdsense() {
    if (isProUser()) return;
    if (isPlaceholderAd(CONFIG.ADSENSE_CLIENT_ID)) return;
    if (!document.querySelector("script[data-adsense-loader]")) {
      var s = document.createElement("script");
      s.async = true;
      s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(CONFIG.ADSENSE_CLIENT_ID);
      s.crossOrigin = "anonymous";
      s.setAttribute("data-adsense-loader", "1");
      document.head.appendChild(s);
    }
    document.querySelectorAll(".ad-slot").forEach(function (slot) {
      var pos = slot.getAttribute("data-ad-position") || "top";
      var slotId = (CONFIG.ADSENSE_SLOTS || {})[pos];
      if (isPlaceholderSlot(slotId)) return;
      slot.innerHTML = "";
      slot.removeAttribute("aria-hidden");
      var ins = document.createElement("ins");
      ins.className = "adsbygoogle";
      ins.style.display = "block";
      ins.setAttribute("data-ad-client", CONFIG.ADSENSE_CLIENT_ID);
      ins.setAttribute("data-ad-slot", slotId);
      ins.setAttribute("data-ad-format", "auto");
      ins.setAttribute("data-full-width-responsive", "true");
      slot.appendChild(ins);
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    });
  }

  /* 2) アフィリエイト：実URLの項目だけ描画。0件なら枠ごと非表示 */
  function renderAffiliateLinks() {
    var list = document.getElementById("affiliate-list");
    if (!list) return;
    var box = document.querySelector(".affiliate-box");
    var items = (CONFIG.AFFILIATE_ITEMS || []).filter(function (it) { return it && !isPlaceholderAff(it.url); });
    if (!items.length) { if (box) box.style.display = "none"; return; }
    if (box) box.style.display = "";
    list.innerHTML = "";
    items.forEach(function (it) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = it.url;
      a.textContent = it.label;
      a.rel = "sponsored nofollow noopener";
      a.target = "_blank";
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  /* 3) Stripe Payment Link（Proボタン） */
  function initProButton() {
    var btn = document.getElementById("pro-button");
    if (!btn) return;
    if (CONFIG.STRIPE_PAYMENT_LINK_URL) {
      btn.textContent = "Proを購入" + (CONFIG.PRO_PRICE_LABEL ? "（" + CONFIG.PRO_PRICE_LABEL + "）" : "");
    }
    btn.addEventListener("click", function () {
      if (!CONFIG.STRIPE_PAYMENT_LINK_URL) { alert("Pro機能は準備中です。公開までお待ちください。"); return; }
      window.open(CONFIG.STRIPE_PAYMENT_LINK_URL, "_blank", "noopener");
    });
  }

  /* 起動：アフィリ枠・Proボタンは即時、AdSenseはPro判定確定後(load)に実行 */
  document.addEventListener("DOMContentLoaded", function () {
    renderAffiliateLinks();
    initProButton();
  });
  window.addEventListener("load", function () {
    initAdsense();
  });

  window.ToolFactoryMonetization = { CONFIG: CONFIG };
})();
