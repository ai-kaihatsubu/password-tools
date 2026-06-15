/* ============================================
   パスワード強度チェッカー : app.js
   バニラJS / 外部依存なし
   - 入力パスワードは保存・送信しない（プライバシー核心）
   - 長さ・文字種・エントロピー(bit)・推定解読時間を算出
   - よくある弱いパスワード・連続文字・繰り返し文字を検出
   - ダーク/ライト切替（localStorage保存）・Proフラグ
   ============================================ */

(function () {
  "use strict";

  const STORAGE_KEY_THEME = "tf_theme"; // "light" | "dark"
  const STORAGE_KEY_PRO = "tf_pro";     // "1" で Pro 有効（擬似フラグ）

  /* ---------- テーマ切替 ---------- */
  function initTheme() {
    const toggle = document.getElementById("theme-toggle");
    const root = document.documentElement;

    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = saved || (prefersDark ? "dark" : "light");
    applyTheme(initial);

    if (toggle) {
      toggle.addEventListener("click", () => {
        const current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
        const next = current === "dark" ? "light" : "dark";
        applyTheme(next);
        localStorage.setItem(STORAGE_KEY_THEME, next);
      });
    }

    function applyTheme(theme) {
      if (theme === "dark") {
        root.setAttribute("data-theme", "dark");
        if (toggle) {
          toggle.setAttribute("aria-pressed", "true");
          toggle.innerHTML = '<span aria-hidden="true">☀️</span>';
        }
      } else {
        root.removeAttribute("data-theme");
        if (toggle) {
          toggle.setAttribute("aria-pressed", "false");
          toggle.innerHTML = '<span aria-hidden="true">🌙</span>';
        }
      }
    }
  }

  /* ---------- Pro判定（広告非表示など） ---------- */
  function isPro() {
    return localStorage.getItem(STORAGE_KEY_PRO) === "1";
  }

  function applyProState() {
    if (isPro()) {
      document.body.classList.add("is-pro");
      document.querySelectorAll(".ad-slot").forEach((el) => {
        el.style.display = "none";
      });
    }
  }

  /* ============================================
     パスワード強度判定ロジック
     ============================================ */

  // よくある弱いパスワード（漏えいパスワードリストに頻出する代表例）
  const COMMON_PASSWORDS = [
    "password", "123456", "12345678", "123456789", "1234567890",
    "qwerty", "qwertyuiop", "asdf", "asdfgh", "zxcvbn",
    "admin", "administrator", "letmein", "welcome", "monkey",
    "dragon", "master", "login", "abc123", "password1",
    "iloveyou", "111111", "000000", "123123", "1q2w3e4r",
    "passw0rd", "p@ssword", "p@ssw0rd", "qazwsx", "sunshine",
    "princess", "football", "baseball", "trustno1", "superman",
    "shadow", "michael", "ninja", "azerty", "987654321",
  ];

  // 連続文字（昇順）検出用の代表的なキー列
  const SEQUENCES = [
    "abcdefghijklmnopqrstuvwxyz",
    "0123456789",
    "qwertyuiop",
    "asdfghjkl",
    "zxcvbnm",
  ];

  /**
   * パスワードに含まれる文字種を判定する。
   * @param {string} pw
   * @returns {{lower:boolean, upper:boolean, digit:boolean, symbol:boolean}}
   */
  function detectCharsets(pw) {
    return {
      lower: /[a-z]/.test(pw),
      upper: /[A-Z]/.test(pw),
      digit: /[0-9]/.test(pw),
      symbol: /[^A-Za-z0-9]/.test(pw),
    };
  }

  /**
   * 使用文字種から1文字あたりの組み合わせ数（文字集合のサイズ）を算出する。
   * @param {{lower:boolean, upper:boolean, digit:boolean, symbol:boolean}} sets
   * @returns {number}
   */
  function charsetSize(sets) {
    let size = 0;
    if (sets.lower) size += 26;
    if (sets.upper) size += 26;
    if (sets.digit) size += 10;
    if (sets.symbol) size += 33; // 主要な記号の概算数
    return size;
  }

  /**
   * エントロピー(bit)を概算する。 entropy = length * log2(charsetSize)
   * @param {number} length
   * @param {number} poolSize
   * @returns {number}
   */
  function estimateEntropy(length, poolSize) {
    if (length === 0 || poolSize === 0) return 0;
    return length * Math.log2(poolSize);
  }

  /**
   * 3文字以上の連続した昇順/降順文字列が含まれるかを検出する。
   * 例: "abc", "cba", "123", "321"
   * @param {string} pw
   * @returns {boolean}
   */
  function hasSequentialChars(pw) {
    const lower = pw.toLowerCase();
    for (const seq of SEQUENCES) {
      for (let i = 0; i <= seq.length - 3; i++) {
        const fwd = seq.slice(i, i + 3);
        const bwd = fwd.split("").reverse().join("");
        if (lower.includes(fwd) || lower.includes(bwd)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 同じ文字が3回以上連続しているかを検出する。例: "aaa", "111"
   * @param {string} pw
   * @returns {boolean}
   */
  function hasRepeatedChars(pw) {
    return /(.)\1\1/.test(pw);
  }

  /**
   * よくある弱いパスワードに該当・類似するかを判定する。
   * @param {string} pw
   * @returns {boolean}
   */
  function isCommonPassword(pw) {
    const lower = pw.toLowerCase();
    return COMMON_PASSWORDS.some((common) => lower === common || lower.replace(/[\d!@#$%^&*]+$/, "") === common);
  }

  /**
   * 推定解読時間（秒）から人間が読みやすい文字列に変換する。
   * 想定: オフライン総当たり攻撃で1秒あたり10億回(1e9)試行するケース。
   * @param {number} seconds
   * @returns {string}
   */
  function formatCrackTime(seconds) {
    if (!isFinite(seconds) || seconds <= 0) return "瞬時";

    const units = [
      { label: "年", value: 60 * 60 * 24 * 365 },
      { label: "日", value: 60 * 60 * 24 },
      { label: "時間", value: 60 * 60 },
      { label: "分", value: 60 },
      { label: "秒", value: 1 },
    ];

    if (seconds < 1) return "1秒未満";

    // 非常に大きい年数は概算で表示
    const years = seconds / units[0].value;
    if (years >= 1e6) {
      return years.toExponential(1).replace("+", "") + "年（実質解読不可能）";
    }
    if (years >= 1) {
      return Math.round(years).toLocaleString("ja-JP") + "年";
    }

    for (const unit of units) {
      if (seconds >= unit.value) {
        const v = Math.max(1, Math.round(seconds / unit.value));
        return v.toLocaleString("ja-JP") + unit.label;
      }
    }
    return "1秒未満";
  }

  /**
   * パスワード全体を診断し、結果オブジェクトを返す。
   * @param {string} pw
   * @returns {object}
   */
  function analyzePassword(pw) {
    const length = pw.length;
    const sets = detectCharsets(pw);
    const pool = charsetSize(sets);
    const entropy = estimateEntropy(length, pool);

    // オフライン総当たり: 1秒あたり10億回(1e9)試行と仮定した推定解読時間
    const combinations = Math.pow(2, entropy);
    const crackSeconds = combinations / 1e9 / 2; // 平均で全探索空間の半分で発見と仮定

    const common = isCommonPassword(pw);
    const sequential = hasSequentialChars(pw);
    const repeated = hasRepeatedChars(pw);

    // issues: { text, level: "warn" | "ok" }
    const issues = [];

    if (length === 0) {
      return { length, sets, pool, entropy, crackSeconds, common, sequential, repeated, issues, level: 0, label: "未入力" };
    }

    if (common) {
      issues.push({ text: "よく使われる漏えいパスワードのパターンに該当・類似しています。使用しないでください。", level: "warn" });
    }
    if (length < 8) {
      issues.push({ text: `長さが${length}文字と短すぎます。12文字以上を推奨します。`, level: "warn" });
    } else if (length < 12) {
      issues.push({ text: `長さは${length}文字です。より安全にするには12文字以上を推奨します。`, level: "warn" });
    } else {
      issues.push({ text: `長さは${length}文字あり、十分な長さです。`, level: "ok" });
    }

    const setCount = [sets.lower, sets.upper, sets.digit, sets.symbol].filter(Boolean).length;
    if (setCount <= 1) {
      issues.push({ text: "1種類の文字種のみ使用されています。複数の文字種を組み合わせましょう。", level: "warn" });
    } else if (setCount === 2) {
      issues.push({ text: "2種類の文字種を使用していますが、さらに種類を増やすとより安全です。", level: "warn" });
    } else {
      issues.push({ text: `${setCount}種類の文字種を使用しており、バランスが良いです。`, level: "ok" });
    }

    if (sequential) {
      issues.push({ text: "「abc」「123」のような連続した文字列が含まれています。推測されやすいため避けましょう。", level: "warn" });
    }
    if (repeated) {
      issues.push({ text: "同じ文字が3回以上連続しています。繰り返しは避けましょう。", level: "warn" });
    }
    if (!sequential && !repeated && setCount >= 3 && length >= 12) {
      issues.push({ text: "連続文字・繰り返し文字は見つかりませんでした。", level: "ok" });
    }

    // 総合レベル判定 (0-5)
    let level = computeLevel(length, entropy, common, sequential, repeated, setCount);

    const labels = ["未入力", "非常に弱い", "弱い", "普通", "強い", "非常に強い"];

    return {
      length, sets, pool, entropy, crackSeconds,
      common, sequential, repeated, issues,
      level, label: labels[level],
    };
  }

  /**
   * 各要素から総合強度レベル(0-5)を算出する。
   * 0:未入力 1:非常に弱い 2:弱い 3:普通 4:強い 5:非常に強い
   */
  function computeLevel(length, entropy, common, sequential, repeated, setCount) {
    if (length === 0) return 0;

    // よくある弱いパスワードは即「非常に弱い」
    if (common) return 1;

    let score = 0;

    // エントロピーによる基礎点
    if (entropy < 28) score = 1;
    else if (entropy < 36) score = 2;
    else if (entropy < 60) score = 3;
    else if (entropy < 80) score = 4;
    else score = 5;

    // 文字種が少ない場合は減点
    if (setCount <= 1 && score > 2) score = 2;
    if (setCount === 2 && score > 3) score = 3;

    // 連続/繰り返しがある場合は1段階減点
    if (sequential || repeated) {
      score = Math.max(1, score - 1);
    }

    // 短すぎる場合は上限を制限
    if (length < 8 && score > 2) score = 2;
    if (length < 6 && score > 1) score = 1;

    return Math.min(5, Math.max(1, score));
  }

  /* ---------- UI更新 ---------- */
  function renderResult(result, els) {
    const { length, sets, entropy, crackSeconds, issues, level, label } = result;

    // 強度バー
    els.bar.className = "strength-bar-fill level-" + level;
    els.bar.style.width = Math.min(100, (level / 5) * 100) + "%";

    els.label.className = "strength-label level-" + level;
    els.label.textContent = "強度: " + label;

    if (length > 0) {
      els.entropy.textContent = "エントロピー: 約 " + Math.round(entropy) + " bit";
      els.crackTime.textContent = "推定解読時間（目安・オフライン総当たり想定）: " + formatCrackTime(crackSeconds);
    } else {
      els.entropy.textContent = "";
      els.crackTime.textContent = "";
    }

    // 詳細グリッド
    if (length > 0) {
      els.detailGrid.hidden = false;
      els.detailLength.textContent = String(length);

      const setLabels = [];
      if (sets.lower) setLabels.push("英小文字");
      if (sets.upper) setLabels.push("英大文字");
      if (sets.digit) setLabels.push("数字");
      if (sets.symbol) setLabels.push("記号");
      els.detailCharsets.textContent = setLabels.length ? setLabels.join("・") : "なし";

      els.detailEntropy.textContent = Math.round(entropy) + " bit";
      els.detailCrackTime.textContent = formatCrackTime(crackSeconds);
    } else {
      els.detailGrid.hidden = true;
    }

    // 文字種チェックリスト
    updateCheckItem(els.checkLower, sets.lower);
    updateCheckItem(els.checkUpper, sets.upper);
    updateCheckItem(els.checkDigit, sets.digit);
    updateCheckItem(els.checkSymbol, sets.symbol);

    // 弱点・改善提案
    els.issueList.innerHTML = "";
    if (length === 0) {
      const li = document.createElement("li");
      li.className = "empty-state";
      li.textContent = "パスワードを入力すると、弱点や改善提案がここに表示されます。";
      els.issueList.appendChild(li);
      return;
    }

    issues.forEach((issue) => {
      const li = document.createElement("li");
      li.className = issue.level === "ok" ? "is-ok" : "is-warn";
      const mark = document.createElement("span");
      mark.className = "mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = issue.level === "ok" ? "✓" : "!";
      const text = document.createElement("span");
      text.textContent = issue.text;
      li.appendChild(mark);
      li.appendChild(text);
      els.issueList.appendChild(li);
    });
  }

  function updateCheckItem(el, ok) {
    if (!el) return;
    const mark = el.querySelector(".mark");
    if (ok) {
      el.classList.add("is-ok");
      if (mark) mark.textContent = "✓";
    } else {
      el.classList.remove("is-ok");
      if (mark) mark.textContent = "○";
    }
  }

  /* ---------- ツール本体初期化 ---------- */
  function initTool() {
    const input = document.getElementById("password-input");
    const toggleBtn = document.getElementById("toggle-visibility-btn");
    if (!input) return;

    const els = {
      bar: document.getElementById("strength-bar"),
      label: document.getElementById("strength-label"),
      entropy: document.getElementById("entropy-value"),
      crackTime: document.getElementById("crack-time"),
      detailGrid: document.getElementById("detail-grid"),
      detailLength: document.getElementById("detail-length"),
      detailCharsets: document.getElementById("detail-charsets"),
      detailEntropy: document.getElementById("detail-entropy"),
      detailCrackTime: document.getElementById("detail-cracktime"),
      checkLower: document.getElementById("check-lower"),
      checkUpper: document.getElementById("check-upper"),
      checkDigit: document.getElementById("check-digit"),
      checkSymbol: document.getElementById("check-symbol"),
      issueList: document.getElementById("issue-list"),
    };

    function update() {
      const result = analyzePassword(input.value);
      renderResult(result, els);
    }

    input.addEventListener("input", update);

    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        const showing = input.type === "text";
        input.type = showing ? "password" : "text";
        toggleBtn.setAttribute("aria-pressed", showing ? "false" : "true");
        toggleBtn.textContent = showing ? "表示" : "隠す";
      });
    }

    // 初期表示
    update();
  }

  /* ---------- 起動 ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    applyProState();
    initTool();
  });

  // 他ファイルから利用できるよう公開
  window.ToolFactory = {
    isPro,
    STORAGE_KEY_PRO,
    STORAGE_KEY_THEME,
  };
})();
