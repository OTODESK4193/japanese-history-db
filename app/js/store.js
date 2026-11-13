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
      settings: { sessionSize: 10, fontSize: 'std', targetLevel: 'common' },
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

  window.JHStore = {
    state: state,
    save: save,
    saveNow: saveNow,
    reviewStatus: reviewStatus,
    questionReviewMap: questionReviewMap,
    yearReviewMap: yearReviewMap,
    dueCount: dueCount,
    DAY: DAY,
    recordAttempt: function (a) { state.attempts.push(a); save(); },
    recordYearAttempt: function (a) { state.yearAttempts.push(a); save(); },
    resetAll: function () {
      state = freshState();
      window.JHStore.state = state;
      saveNow();
    }
  };
})();
