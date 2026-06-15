/* ============================================
   パスワード生成ツール : app.js
   - crypto.getRandomValues による安全な乱数生成（rejection sampling）
   - 文字種トグル / 長さスライダー / オプション
   - 強度メーター（エントロピー概算）
   - 単体生成 / まとめて生成 / クリップボードコピー
   - ダーク/ライト切替・Proフラグ（雛形踏襲）
   - 設定情報は localStorage に保存
   - 名前付きパスワードは任意で localStorage にローカル保存（暗号化なし、外部送信なし）
   ============================================ */

(function () {
  "use strict";

  const STORAGE_KEY_THEME = "tf_theme"; // "light" | "dark"
  const STORAGE_KEY_PRO = "tf_pro";     // "1" で Pro 有効
  const STORAGE_KEY_SETTINGS = "pwgen_settings"; // 長さ・文字種など設定のみ保存
  const STORAGE_KEY_SAVED = "pwgen_saved_v1"; // 名前付き保存パスワード一覧

  const CHARSETS = {
    uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    lowercase: "abcdefghijklmnopqrstuvwxyz",
    numbers: "0123456789",
    symbols: "!@#$%^&*()-_=+[]{};:,.<>?/",
  };
  // 紛らわしい文字（除外オプション用）
  const AMBIGUOUS_CHARS = "0O1lI";

  const BULK_COUNT_FREE = 5;
  const BULK_COUNT_PRO = 50;

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

  function initProDevToggle() {
    const btn = document.getElementById("pro-dev-toggle");
    if (!btn) return;
    updateLabel();
    btn.addEventListener("click", () => {
      const next = isPro() ? "0" : "1";
      localStorage.setItem(STORAGE_KEY_PRO, next);
      location.reload();
    });
    function updateLabel() {
      btn.textContent = isPro()
        ? "Proフラグを切替（開発用）: 現在ON"
        : "Proフラグを切替（開発用）: 現在OFF";
    }
  }

  /* ---------- 安全な乱数（crypto.getRandomValues + rejection sampling） ---------- */

  // 0 <= n < max の範囲で、剰余バイアスのない整数を返す
  function secureRandomInt(max) {
    if (max <= 0 || max > 256) {
      throw new RangeError("secureRandomInt: max は 1〜256 の範囲で指定してください");
    }
    // max 以上の最小の2の累乗 - 1 をマスクとして使い、範囲外なら引き直す
    const range = 256 - (256 % max); // 0 <= byte < range を採用
    const buf = new Uint8Array(1);
    let byte;
    do {
      crypto.getRandomValues(buf);
      byte = buf[0];
    } while (byte >= range);
    return byte % max;
  }

  // 配列をFisher-Yatesでシャッフル（crypto由来の乱数を使用）
  function secureShuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = secureRandomInt(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function secureRandomChar(charset) {
    return charset[secureRandomInt(charset.length)];
  }

  /* ---------- 設定の読み込み / 保存（設定のみ。生成パスワードは保存しない） ---------- */
  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      // 保存失敗は無視（プライベートモード等）
    }
  }

  /* ---------- ツール本体 ---------- */
  function initTool() {
    const lengthSlider = document.getElementById("length-slider");
    const lengthInput = document.getElementById("length-input");
    const optUpper = document.getElementById("opt-uppercase");
    const optLower = document.getElementById("opt-lowercase");
    const optNumbers = document.getElementById("opt-numbers");
    const optSymbols = document.getElementById("opt-symbols");
    const optExcludeAmbiguous = document.getElementById("opt-exclude-ambiguous");
    const optRequireEach = document.getElementById("opt-require-each");
    const charsetError = document.getElementById("charset-error");

    const passwordOutput = document.getElementById("password-output");
    const copyMainBtn = document.getElementById("copy-main-btn");
    const regenerateBtn = document.getElementById("regenerate-btn");
    const copyFeedback = document.getElementById("copy-feedback");

    const strengthBar = document.getElementById("strength-bar");
    const strengthLabel = document.getElementById("strength-label");

    const bulkGenerateBtn = document.getElementById("bulk-generate-btn");
    const bulkList = document.getElementById("bulk-list");
    const bulkLimitNote = document.getElementById("bulk-limit-note");

    const saveNameInput = document.getElementById("save-name-input");
    const savePasswordBtn = document.getElementById("save-password-btn");
    const saveFeedback = document.getElementById("save-feedback");
    const savedEmpty = document.getElementById("saved-empty");
    const savedList = document.getElementById("saved-list");

    const charsetCheckboxes = [optUpper, optLower, optNumbers, optSymbols];

    /* ----- 設定の復元 ----- */
    const saved = loadSettings();
    if (saved) {
      if (typeof saved.length === "number") {
        lengthSlider.value = String(saved.length);
        lengthInput.value = String(saved.length);
      }
      if (typeof saved.uppercase === "boolean") optUpper.checked = saved.uppercase;
      if (typeof saved.lowercase === "boolean") optLower.checked = saved.lowercase;
      if (typeof saved.numbers === "boolean") optNumbers.checked = saved.numbers;
      if (typeof saved.symbols === "boolean") optSymbols.checked = saved.symbols;
      if (typeof saved.excludeAmbiguous === "boolean") optExcludeAmbiguous.checked = saved.excludeAmbiguous;
      if (typeof saved.requireEach === "boolean") optRequireEach.checked = saved.requireEach;
    }

    /* ----- 長さ: スライダーと数値入力の双方向同期 ----- */
    function setLength(value, source) {
      let v = parseInt(value, 10);
      if (isNaN(v)) v = 16;
      v = Math.min(64, Math.max(4, v));
      lengthSlider.value = String(v);
      lengthInput.value = String(v);
      return v;
    }

    lengthSlider.addEventListener("input", () => {
      setLength(lengthSlider.value);
      onSettingsChanged();
    });
    lengthInput.addEventListener("input", () => {
      setLength(lengthInput.value);
      onSettingsChanged();
    });
    lengthInput.addEventListener("blur", () => {
      setLength(lengthInput.value);
      onSettingsChanged();
    });

    /* ----- 文字種チェックボックス: 最低1つは必須 ----- */
    function getCheckedCharsetKeys() {
      const keys = [];
      if (optUpper.checked) keys.push("uppercase");
      if (optLower.checked) keys.push("lowercase");
      if (optNumbers.checked) keys.push("numbers");
      if (optSymbols.checked) keys.push("symbols");
      return keys;
    }

    function enforceMinOneCharset(changedCheckbox) {
      const checkedCount = charsetCheckboxes.filter((c) => c.checked).length;
      if (checkedCount === 0) {
        // 最後の1つはOFFにできない＝戻す
        if (changedCheckbox) changedCheckbox.checked = true;
        charsetError.hidden = false;
        return false;
      }
      charsetError.hidden = true;
      return true;
    }

    charsetCheckboxes.forEach((cb) => {
      cb.addEventListener("change", () => {
        enforceMinOneCharset(cb);
        onSettingsChanged();
      });
    });

    optExcludeAmbiguous.addEventListener("change", onSettingsChanged);
    optRequireEach.addEventListener("change", onSettingsChanged);

    /* ----- 文字セット構築（除外オプション適用） ----- */
    function buildCharsets() {
      const keys = getCheckedCharsetKeys();
      const result = {};
      keys.forEach((key) => {
        let chars = CHARSETS[key];
        if (optExcludeAmbiguous.checked) {
          chars = chars
            .split("")
            .filter((ch) => AMBIGUOUS_CHARS.indexOf(ch) === -1)
            .join("");
        }
        if (chars.length > 0) {
          result[key] = chars;
        }
      });
      return result;
    }

    /* ----- パスワード生成本体 ----- */
    function generatePassword(length) {
      const charsetMap = buildCharsets();
      const keys = Object.keys(charsetMap);
      if (keys.length === 0) {
        return null; // 文字種が選択されていない（通常は発生しない）
      }

      const allChars = keys.map((k) => charsetMap[k]).join("");
      const result = [];

      // 「各文字種を最低1文字含める」: 各セットから1文字ずつ確保（lengthが文字種数未満なら可能な範囲）
      if (optRequireEach.checked) {
        const requiredCount = Math.min(keys.length, length);
        const shuffledKeys = secureShuffle(keys.slice());
        for (let i = 0; i < requiredCount; i++) {
          result.push(secureRandomChar(charsetMap[shuffledKeys[i]]));
        }
      }

      while (result.length < length) {
        result.push(secureRandomChar(allChars));
      }

      return secureShuffle(result).join("");
    }

    /* ----- 強度メーター（エントロピー概算） ----- */
    function updateStrength(password, length) {
      const charsetMap = buildCharsets();
      const poolSize = Object.values(charsetMap).reduce((sum, s) => sum + s.length, 0);

      let entropy = 0;
      if (poolSize > 1 && length > 0) {
        entropy = length * Math.log2(poolSize);
      }

      let levelClass = "weak";
      let levelLabel = "弱い";
      if (entropy >= 100) {
        levelClass = "very-strong";
        levelLabel = "非常に強い";
      } else if (entropy >= 70) {
        levelClass = "strong";
        levelLabel = "強い";
      } else if (entropy >= 40) {
        levelClass = "medium";
        levelLabel = "普通";
      }

      strengthBar.className = "strength-bar-fill strength-bar-fill--" + levelClass;
      const pct = Math.min(100, Math.round((entropy / 120) * 100));
      strengthBar.style.width = pct + "%";
      strengthLabel.textContent =
        "強度: " + levelLabel + "（約 " + Math.round(entropy) + " bit）";
    }

    /* ----- 設定変更時: 自動再生成 + 保存 ----- */
    function onSettingsChanged() {
      if (!enforceMinOneCharset(null)) {
        // 文字種が0でも表示上は直前の状態を維持
      }
      persistSettings();
      regenerateMain();
    }

    function persistSettings() {
      saveSettings({
        length: parseInt(lengthInput.value, 10) || 16,
        uppercase: optUpper.checked,
        lowercase: optLower.checked,
        numbers: optNumbers.checked,
        symbols: optSymbols.checked,
        excludeAmbiguous: optExcludeAmbiguous.checked,
        requireEach: optRequireEach.checked,
      });
    }

    /* ----- メイン出力の再生成 ----- */
    function regenerateMain() {
      const length = setLength(lengthInput.value);
      const pw = generatePassword(length);
      if (pw === null) {
        passwordOutput.value = "";
        strengthLabel.textContent = "強度: -";
        strengthBar.style.width = "0%";
        return;
      }
      passwordOutput.value = pw;
      updateStrength(pw, length);
    }

    regenerateBtn.addEventListener("click", regenerateMain);

    /* ----- クリップボードコピー ----- */
    function copyText(text, feedbackEl) {
      const showFeedback = (msg) => {
        if (!feedbackEl) return;
        feedbackEl.textContent = msg;
        setTimeout(() => {
          feedbackEl.textContent = "";
        }, 2000);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          () => showFeedback("コピーしました"),
          () => fallbackCopy()
        );
      } else {
        fallbackCopy();
      }

      function fallbackCopy() {
        try {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.setAttribute("readonly", "");
          textarea.style.position = "fixed";
          textarea.style.left = "-9999px";
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
          showFeedback("コピーしました");
        } catch (e) {
          showFeedback("コピーに失敗しました");
        }
      }
    }

    copyMainBtn.addEventListener("click", () => {
      if (!passwordOutput.value) return;
      copyText(passwordOutput.value, copyFeedback);
    });

    /* ----- まとめて生成 ----- */
    function bulkGenerate() {
      const length = setLength(lengthInput.value);
      const count = isPro() ? BULK_COUNT_PRO : BULK_COUNT_FREE;
      bulkLimitNote.hidden = isPro();

      bulkList.innerHTML = "";
      for (let i = 0; i < count; i++) {
        const pw = generatePassword(length);
        if (pw === null) continue;

        const li = document.createElement("li");
        li.className = "bulk-item";

        const code = document.createElement("code");
        code.className = "bulk-item-text";
        code.textContent = pw;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-secondary bulk-copy-btn";
        btn.textContent = "コピー";

        const feedback = document.createElement("span");
        feedback.className = "bulk-item-feedback";
        feedback.setAttribute("role", "status");
        feedback.setAttribute("aria-live", "polite");

        btn.addEventListener("click", () => {
          copyText(pw, feedback);
        });

        li.appendChild(code);
        li.appendChild(btn);
        li.appendChild(feedback);
        bulkList.appendChild(li);
      }
    }

    bulkGenerateBtn.addEventListener("click", bulkGenerate);

    /* ----- 名前付きローカル保存 ----- */
    function loadSavedPasswords() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_SAVED);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }

    function persistSavedPasswords(list) {
      try {
        localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify(list));
      } catch (e) {
        // 保存失敗は無視（プライベートモード等）
      }
    }

    // 最初の1文字＋中間を伏字（最大10個）＋最後の1文字。1〜2文字は全伏字。
    function maskPassword(pw) {
      if (pw.length <= 2) {
        return "•".repeat(Math.max(pw.length, 1));
      }
      const middleLength = Math.min(pw.length - 2, 10);
      return pw[0] + "•".repeat(middleLength) + pw[pw.length - 1];
    }

    function renderSavedList() {
      const items = loadSavedPasswords();
      savedList.innerHTML = "";

      if (items.length === 0) {
        savedEmpty.hidden = false;
        savedList.hidden = true;
        return;
      }

      savedEmpty.hidden = true;
      savedList.hidden = false;

      items.forEach((item) => {
        const li = document.createElement("li");
        li.className = "saved-item";

        const nameSpan = document.createElement("span");
        nameSpan.className = "saved-item-name";
        nameSpan.textContent = item.name;

        const pwSpan = document.createElement("span");
        pwSpan.className = "saved-item-pw";
        pwSpan.textContent = maskPassword(item.password);

        let revealed = false;

        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "btn btn-secondary saved-item-toggle";
        toggleBtn.textContent = "表示";
        toggleBtn.setAttribute("aria-label", item.name + " のパスワードを表示/隠す");

        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "btn btn-secondary saved-item-copy";
        copyBtn.textContent = "コピー";

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "btn btn-secondary saved-item-delete";
        deleteBtn.textContent = "削除";

        const itemFeedback = document.createElement("span");
        itemFeedback.className = "saved-item-feedback";
        itemFeedback.setAttribute("role", "status");
        itemFeedback.setAttribute("aria-live", "polite");

        toggleBtn.addEventListener("click", () => {
          revealed = !revealed;
          pwSpan.textContent = revealed ? item.password : maskPassword(item.password);
          toggleBtn.textContent = revealed ? "隠す" : "表示";
        });

        copyBtn.addEventListener("click", () => {
          copyText(item.password, itemFeedback);
        });

        deleteBtn.addEventListener("click", () => {
          if (!window.confirm("「" + item.name + "」を削除しますか？")) return;
          const remaining = loadSavedPasswords().filter((i) => i.id !== item.id);
          persistSavedPasswords(remaining);
          renderSavedList();
        });

        li.appendChild(nameSpan);
        li.appendChild(pwSpan);
        li.appendChild(toggleBtn);
        li.appendChild(copyBtn);
        li.appendChild(deleteBtn);
        li.appendChild(itemFeedback);
        savedList.appendChild(li);
      });
    }

    savePasswordBtn.addEventListener("click", () => {
      const pw = passwordOutput.value;
      if (!pw) {
        saveFeedback.textContent = "先にパスワードを生成してください";
        setTimeout(() => {
          saveFeedback.textContent = "";
        }, 2000);
        return;
      }

      const name = saveNameInput.value.trim() || "（無題）";
      const items = loadSavedPasswords();
      const idBuf = new Uint32Array(1);
      crypto.getRandomValues(idBuf);
      items.push({
        id: Date.now() + "-" + idBuf[0],
        name: name,
        password: pw,
        createdAt: new Date().toISOString(),
      });
      persistSavedPasswords(items);
      saveNameInput.value = "";
      renderSavedList();

      saveFeedback.textContent = "保存しました";
      setTimeout(() => {
        saveFeedback.textContent = "";
      }, 2000);
    });

    /* ----- 初期生成 ----- */
    setLength(lengthInput.value);
    enforceMinOneCharset(null);
    regenerateMain();
    renderSavedList();
  }

  /* ---------- 起動 ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    applyProState();
    initProDevToggle();
    initTool();
  });

  // 他ファイルから利用できるよう公開
  window.ToolFactory = {
    isPro,
    STORAGE_KEY_PRO,
    STORAGE_KEY_THEME,
  };
})();
