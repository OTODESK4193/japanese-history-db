/* store.js — 学習記録（localStorage）と復習（間隔反復）ロジック。
 * 記録はこの端末にのみ保存され、サーバー通信は一切しない。 */
(function () {
  'use strict';
  var KEY = 'jh-static-v1';

  function freshState() {
    return {
      attempts: [],        // {kind:'hs'|'jhs'|'cloze'|'recall', id, correct, ts, unit, topic, type, difficulty}
      yearAttempts: [],    // {key:'year|event|dir', year, dir, correct, ts}
      termStudy: {},       // TERM-ID -> {known:bool, ts}
      yearSelf: {},        // 'year|event|dir' -> {known:bool, ts}（年号カードの自己判定）
      commentary: {},      // key -> {checked:[bool], read:bool}
      settings: { sessionSize: 10, fontSize: 'std', targetLevel: 'common', theme: 'auto', titleRankShown: null },
      session: null        // 進行中セッション（再開用）
    };
  }

  var state = freshState();
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      state = Object.assign(freshState(), parsed);
      state.settings = Object.assign(freshState().settings, parsed.settings || {});
    }
  } catch (e) { /* 壊れた記録は初期化する */ }

  /* テーマ（ライト／ダーク／端末に合わせる）。
   * 最終的な見た目は html[data-color-theme="light"|"dark"] で決まり、CSS変数はそちらで切り替わる。
   * （属性名はテーマ史ボタンの data-theme と衝突させないため data-color-theme とする）
   * 手動選択（light/dark）が OS の prefers-color-scheme より優先され、
   * 「端末に合わせる」(auto) のときだけ OS 設定に従い、OS 側の変更にも追随する。
   * 起動直後（描画前）に一度適用するため、このファイルの読み込み時点で実行する。 */
  function themeMedia() {
    try { return window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null; }
    catch (e) { return null; }
  }
  function resolveTheme() {
    var pref = state.settings.theme || 'auto';
    if (pref === 'dark') return 'dark';
    if (pref === 'light') return 'light';
    var mq = themeMedia();
    return mq && mq.matches ? 'dark' : 'light';
  }
  function applyTheme() {
    var resolved = resolveTheme();
    document.documentElement.setAttribute('data-color-theme', resolved);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#171410' : '#faf7f2');
  }
  applyTheme();
  (function watchOsTheme() {
    var mq = themeMedia();
    if (!mq) return;
    var onChange = function () {
      if ((state.settings.theme || 'auto') === 'auto') applyTheme();
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  })();

  var saveTimer = null;
  function save() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () {
      saveTimer = null;
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 容量超過時は諦める */ }
    }, 120);
  }
  function saveNow() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  var DAY = 24 * 60 * 60 * 1000;

  /* 間隔反復モデル:
   * - 最新の回答が不正解 → すぐ復習対象（期限到来）
   * - 1回連続正解 → 翌日に再出題候補（期限は最終回答+1日）
   * - 2回連続正解 → 卒業（復習リストから外れる）
   * 途中で間違えると連続正解は0に戻る。 */
  function reviewStatus(history) {
    if (!history.length) return { state: 'new', due: false, streak: 0, nextDue: null };
    var sorted = history.slice().sort(function (a, b) { return a.ts - b.ts; });
    var streak = 0;
    for (var i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].correct) streak++; else break;
    }
    var last = sorted[sorted.length - 1];
    if (!last.correct) return { state: 'due', due: true, streak: 0, nextDue: last.ts, lastTs: last.ts };
    if (streak >= 2) return { state: 'graduated', due: false, streak: streak, nextDue: null, lastTs: last.ts };
    var nextDue = last.ts + DAY;
    return { state: 'waiting', due: Date.now() >= nextDue, streak: streak, nextDue: nextDue, lastTs: last.ts };
  }

  function historyByItem(attempts, kind) {
    var map = {};
    attempts.forEach(function (a) {
      if (kind && a.kind !== kind) return;
      var key = a.kind + ':' + a.id;
      (map[key] = map[key] || []).push(a);
    });
    return map;
  }

  /* 問題系（hs/jhs/cloze）の復習状況を返す: key -> status
   * 想起ドリル（kind:'recall'）は用語ドリルであり、4択ランナーで扱えないため
   * 問題の復習には含めない（記録そのものは統計用に保持される）。 */
  function questionReviewMap() {
    var map = {};
    state.attempts.forEach(function (a) {
      if (a.kind !== 'hs' && a.kind !== 'jhs' && a.kind !== 'cloze') return;
      var key = a.kind + ':' + a.id;
      (map[key] = map[key] || []).push(a);
    });
    var out = {};
    Object.keys(map).forEach(function (key) { out[key] = reviewStatus(map[key]); });
    return out;
  }

  function yearReviewMap() {
    var map = {};
    state.yearAttempts.forEach(function (a) {
      (map[a.key] = map[a.key] || []).push(a);
    });
    var out = {};
    Object.keys(map).forEach(function (key) { out[key] = reviewStatus(map[key]); });
    return out;
  }

  function dueCount() {
    var n = 0;
    var qm = questionReviewMap();
    Object.keys(qm).forEach(function (k) { if (qm[k].due) n++; });
    var ym = yearReviewMap();
    Object.keys(ym).forEach(function (k) { if (ym[k].due) n++; });
    return n;
  }

  /* ---------------- 称号システム（20段階） ----------------
   * 学習ポイントは既存の記録からその場で算出する（記録形式は変えない）:
   *  (1) 正解したことのある問題の種類数（hs/jhs/cloze を通算、同一問題は1回だけ）
   *  (2) 単語帳で「覚えた」自己判定済みの用語数（termStudy.known）
   *  (3) 年号カードで「思い出せた」年号数（yearSelf.known、年号×出来事単位で数える）
   * ランクアップ表示済みの最高ランクだけは設定領域（settings.titleRankShown）に保持する。 */
  var TITLES = [
    { min: 0, name: '歴史見習い' },
    { min: 10, name: '村の語り部' },
    { min: 25, name: '寺子屋の秀才' },
    { min: 45, name: '藩校の優等生' },
    { min: 70, name: '史料の虫' },
    { min: 100, name: '歴史の旅人' },
    { min: 140, name: '郷土史ファン' },
    { min: 190, name: '史料ハンター' },
    { min: 250, name: '文化財の守り人' },
    { min: 320, name: '郷土史家' },
    { min: 400, name: '歴史研究員' },
    { min: 500, name: '学芸員' },
    { min: 620, name: '史料解読の達人' },
    { min: 760, name: '歴史の案内人' },
    { min: 1050, name: '歴史学者' },
    { min: 1540, name: '日本史の教授' },
    { min: 1980, name: '歴史博士' },
    { min: 2480, name: '日本史の生き字引' },
    { min: 2970, name: '歴史賢者' },
    { min: 3410, name: '歴史の伝説' }
  ];

  function pointsBreakdown() {
    var qset = {};
    state.attempts.forEach(function (a) {
      if ((a.kind === 'hs' || a.kind === 'jhs' || a.kind === 'cloze') && a.correct) {
        qset[a.kind + ':' + a.id] = true;
      }
    });
    var terms = 0;
    Object.keys(state.termStudy).forEach(function (k) {
      if (state.termStudy[k] && state.termStudy[k].known) terms++;
    });
    var yset = {};
    Object.keys(state.yearSelf).forEach(function (k) {
      if (!state.yearSelf[k] || !state.yearSelf[k].known) return;
      var parts = k.split('|'); // 'year|event|dir' → 方向違いは同じ年号として1件
      yset[parts[0] + '|' + parts[1]] = true;
    });
    var questions = Object.keys(qset).length;
    var years = Object.keys(yset).length;
    return { questions: questions, terms: terms, years: years, total: questions + terms + years };
  }

  function rankIndexFor(pts) {
    var idx = 0;
    for (var i = 0; i < TITLES.length; i++) if (pts >= TITLES[i].min) idx = i;
    return idx;
  }

  function rankInfo() {
    var b = pointsBreakdown();
    var idx = rankIndexFor(b.total);
    var next = TITLES[idx + 1] || null;
    return {
      breakdown: b, index: idx, title: TITLES[idx], next: next,
      toNext: next ? next.min - b.total : 0,
      progress: next ? (b.total - TITLES[idx].min) / (next.min - TITLES[idx].min) : 1
    };
  }

  /* 記録直後に呼ぶ。表示済みランクを超えたら新ランク情報を返し（呼び出し側が祝福表示を出す）、
   * そうでなければ null を返す。初回は現在ランクを静かに表示済みとして初期化する。 */
  function checkRankUp() {
    var info = rankInfo();
    var shown = state.settings.titleRankShown;
    if (shown === null || shown === undefined) {
      state.settings.titleRankShown = info.index;
      saveNow();
      return null;
    }
    if (info.index > shown) {
      state.settings.titleRankShown = info.index;
      saveNow();
      return info;
    }
    return null;
  }

  window.JHStore = {
    state: state,
    save: save,
    saveNow: saveNow,
    applyTheme: applyTheme,
    reviewStatus: reviewStatus,
    questionReviewMap: questionReviewMap,
    yearReviewMap: yearReviewMap,
    dueCount: dueCount,
    DAY: DAY,
    TITLES: TITLES,
    pointsBreakdown: pointsBreakdown,
    rankIndexFor: rankIndexFor,
    rankInfo: rankInfo,
    checkRankUp: checkRankUp,
    recordAttempt: function (a) { state.attempts.push(a); save(); },
    recordYearAttempt: function (a) { state.yearAttempts.push(a); save(); },
    resetAll: function () {
      state = freshState();
      window.JHStore.state = state;
      saveNow();
      applyTheme();
    }
  };
})();
