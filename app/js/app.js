/* app.js — 画面遷移（ビュースタック）／用語シート／画像ビューア／設定／全体検索／起動 */
(function () {
  'use strict';
  var D = window.JHData.D;
  var esc = window.JHData.esc;
  var S = window.JHStore;

  var stack = []; // [{fn, title, y}] — y はその画面を離れた時点のスクロール位置
  var homeY = 0;    // ホーム画面のスクロール位置
  var mainEl = null, titleEl = null, backBtn = null;

  function setTitle(t) { if (titleEl) titleEl.textContent = t; }
  function syncBackBtn() { if (backBtn) backBtn.hidden = stack.length === 0; }

  /* 現在のスクロール位置（ブラウザ差異を吸収して最大値を取る） */
  function currentY() {
    var de = document.documentElement, b = document.body;
    return Math.max(window.scrollY || 0, de ? de.scrollTop || 0 : 0, b ? b.scrollTop || 0 : 0);
  }
  /* 復元は描画直後と、画像などの遅延レイアウト後にもう一度当てる */
  function applyScroll(y) {
    window.scrollTo(0, y);
    setTimeout(function () { window.scrollTo(0, y); }, 60);
  }
  /* ビュー切替前にテキスト画面の効果（読書プログレス等）を片付ける */
  function cleanupFx() {
    if (window.JHViews && window.JHViews.cleanupTextFx) window.JHViews.cleanupTextFx();
  }

  function renderTop() {
    var top = stack[stack.length - 1];
    if (!top) { goHome(); return; }
    setTitle(top.title);
    top.fn();
    syncBackBtn();
  }

  function push(fn, title) {
    // 離れる画面の位置を、その画面のスタック項目（なければホーム）に保存する
    if (stack.length) stack[stack.length - 1].y = currentY();
    else homeY = currentY();
    cleanupFx();
    stack.push({ fn: fn, title: title, y: 0 });
    renderTop();
    window.scrollTo(0, 0); // 新規に開いた画面は先頭から
  }

  function goHome() { goHomeAt(null); }
  function goHomeAt(restoreY) {
    cleanupFx();
    stack = [];
    setTitle('日本史学習アプリ');
    window.JHViews.renderHome();
    syncBackBtn();
    if (restoreY != null) applyScroll(restoreY);
    else window.scrollTo(0, 0);
  }

  function back() {
    if (window.JHQuiz && window.JHQuiz.isActive && window.JHQuiz.isActive()) {
      // 関連問題（1問ジャンプ）の最中なら、もとの画面へ戻って位置も復元する
      if (window.JHQuiz.activeMode && window.JHQuiz.activeMode() === 'jump') {
        window.JHQuiz.abandon();
      } else {
        // 通常のクイズ進行中はホームへ（セッションは保存済みで再開できる）
        goHome();
        return;
      }
    }
    if (!stack.length) return;
    stack.pop();
    cleanupFx();
    if (!stack.length) { goHomeAt(homeY); return; }
    var top = stack[stack.length - 1];
    setTitle(top.title);
    top.fn();
    syncBackBtn();
    applyScroll(top.y || 0); // 戻る経路でのみ元の位置に復元する
  }

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2200);
  }

  /* ランクアップ時の祝福: 金粉と桜の花びらが舞う（数秒で消え、操作は妨げない） */
  function celebrate() {
    if (document.getElementById('celebrate-layer')) return;
    var layer = document.createElement('div');
    layer.id = 'celebrate-layer';
    layer.setAttribute('aria-hidden', 'true');
    var h = '';
    for (var i = 0; i < 14; i++) {
      var dx = ((i * 47) % 160) - 80;
      var rot = 180 + ((i * 61) % 260);
      var delay = (i % 7) * 0.09;
      var left = 18 + ((i * 29) % 64);
      h += '<span class="petal ' + (i % 3 === 0 ? 'gold' : 'rose') + '" style="left:' + left + '%;--dx:' + dx +
        'px;--rot:' + rot + 'deg;animation-delay:' + delay + 's"></span>';
    }
    layer.innerHTML = h;
    document.body.appendChild(layer);
    setTimeout(function () { layer.remove(); }, 3400);
  }

  /* ランクアップ共通表示（トースト＋祝福アニメーション） */
  function rankUpToast(up) {
    if (!up) return;
    toast('🎉 称号「' + up.title.name + '」にランクアップ！（学習ポイント ' + up.breakdown.total + '）');
    celebrate();
  }

  /* ---------------- 用語シート ---------------- */
  var STATUS_LABEL = { verified: '検証済み', derived: '問題から作成', supplement: '補完辞書' };
  function openTerm(name) {
    var t = D.termByName[name];
    var body = document.getElementById('term-body');
    document.getElementById('term-title').textContent = name;
    if (!t) {
      body.innerHTML = '<p class="muted">辞書に登録がありません。</p>';
      document.getElementById('term-overlay').hidden = false;
      return;
    }
    var h = '';
    if (t.reading) h += '<p class="muted" style="margin:2px 0">' + esc(t.reading) + '</p>';
    if (t.gloss) h += '<p><strong>' + esc(t.gloss) + '</strong></p>';
    if (t.definition) h += '<p style="white-space:pre-wrap">' + esc(t.definition) + '</p>';
    h += '<p class="small muted">' + esc(t.id) +
      (t.category ? '／' + esc(t.category) : '') +
      '／状態：' + esc(STATUS_LABEL[t.status] || t.status || '') + '</p>';
    var self = S.state.termStudy[t.id];
    h += '<div class="btn-row"><button class="btn' + (self && self.known ? '' : ' sub') + '" id="ts-known">覚えた</button>' +
      '<button class="btn' + (self && !self.known ? '' : ' sub') + '" id="ts-unknown">まだ</button></div>';
    if (D.placeSet[t.term]) {
      h += '<p><a class="placelink" href="' + esc(window.JHData.mapsUrl(t.term)) + '" target="_blank" rel="noopener">⌖ Google マップで場所を見る</a></p>';
    }
    if (t.sections && t.sections.length) {
      h += '<h4>テキストの該当箇所</h4><div class="chips">' + t.sections.map(function (sec) {
        return '<button class="chip" data-ts-section="' + esc(sec) + '">' + esc(sec) + '</button>';
      }).join('') + '</div>';
    }
    if (t.questions && t.questions.length) {
      h += '<h4>関連問題</h4><div class="chips">' + t.questions.slice(0, 12).map(function (qid) {
        return '<button class="chip" data-ts-q="' + esc(qid) + '">' + esc(qid) + '</button>';
      }).join('') + '</div>';
    }
    if (t.sources && t.sources.length) {
      h += '<h4>出典</h4><ul class="small muted" style="margin:4px 0;padding-left:1.2em">' +
        t.sources.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
    }
    body.innerHTML = h;
    document.getElementById('term-overlay').hidden = false;
    document.getElementById('ts-known').addEventListener('click', function () { judgeTerm(t, true); });
    document.getElementById('ts-unknown').addEventListener('click', function () { judgeTerm(t, false); });
    body.querySelectorAll('[data-ts-section]').forEach(function (el) {
      el.addEventListener('click', function () {
        document.getElementById('term-overlay').hidden = true;
        openTextSection(el.getAttribute('data-ts-section'));
      });
    });
    body.querySelectorAll('[data-ts-q]').forEach(function (el) {
      el.addEventListener('click', function () {
        var qid = el.getAttribute('data-ts-q');
        document.getElementById('term-overlay').hidden = true;
        var kind = qid.indexOf('JHS') === 0 ? 'jhs' : 'hs';
        push(function () {
          window.JHQuiz.start({ title: '関連問題', items: [{ kind: kind, id: qid }], mode: 'jump' });
        }, '関連問題');
      });
    });
  }
  function judgeTerm(t, known) {
    S.state.termStudy[t.id] = { known: known, ts: Date.now() };
    S.save();
    var up = S.checkRankUp();
    if (up) rankUpToast(up);
    else toast(known ? '「覚えた」に記録しました' : '「まだ」に記録しました');
    openTerm(t.term);
  }

  /* ---------------- テキストへの遷移 ---------------- */
  function openTextSection(ref) {
    if (!ref) return;
    var m = /^U\d\d/.exec(ref);
    if (!m) return;
    var unit = m[0];
    var sec = ref.length > 3 ? ref.slice(4) : '';
    if (!D.textByUnit[unit]) return;
    push(function () { window.JHViews.renderText(unit, sec || undefined); }, unit + ' テキスト');
  }

  /* ---------------- 画像ビューア（ピンチズーム） ---------------- */
  var view = { scale: 1, tx: 0, ty: 0 };
  var pointers = {};
  var pinchDist = 0;
  function applyView() {
    var c = document.getElementById('viewer-content');
    c.style.transform = 'translate(' + view.tx + 'px,' + view.ty + 'px) scale(' + view.scale + ')';
  }
  function resetView() { view = { scale: 1, tx: 0, ty: 0 }; applyView(); }
  function openViewer(opts) {
    var content = document.getElementById('viewer-content');
    document.getElementById('viewer-title').textContent = opts.title || '';
    document.getElementById('viewer-caption').textContent = opts.caption || '';
    content.innerHTML = opts.svg ? opts.svg :
      '<img src="' + esc(opts.img || '') + '" alt="' + esc(opts.title || '') + '" style="max-width:100%;height:auto">';
    document.getElementById('viewer-overlay').hidden = false;
    resetView();
  }
  function closeViewer() { document.getElementById('viewer-overlay').hidden = true; }
  function bindViewer() {
    var stage = document.getElementById('viewer-stage');
    document.getElementById('viewer-close').addEventListener('click', closeViewer);
    stage.addEventListener('pointerdown', function (e) {
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', function (e) {
      if (!pointers[e.pointerId]) return;
      var prev = pointers[e.pointerId];
      var dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0) {
          view.scale = Math.min(3, Math.max(1, view.scale * d / pinchDist));
          applyView();
        }
        pinchDist = d;
      } else if (ids.length === 1 && view.scale > 1) {
        view.tx += dx; view.ty += dy;
        applyView();
      }
    });
    function release(e) {
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length < 2) pinchDist = 0;
    }
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    stage.addEventListener('dblclick', function () { resetView(); });
    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      view.scale = Math.min(3, Math.max(1, view.scale * (e.deltaY < 0 ? 1.12 : 0.89)));
      applyView();
    }, { passive: false });
  }

  /* ---------------- 全体検索 ---------------- */
  function renderSearch() {
    setTitle('全体検索');
    mainEl.innerHTML = '<div class="search-box"><input id="gs-q" type="search" placeholder="用語・セクション・問題を横断検索">' +
      '<button class="btn" id="gs-go">検索</button></div><div id="gs-results"><p class="muted">キーワードを入力してください。</p></div>';
    function run() {
      var q = (document.getElementById('gs-q').value || '').trim();
      var box = document.getElementById('gs-results');
      if (!q) { box.innerHTML = '<p class="muted">キーワードを入力してください。</p>'; return; }
      var h = '';
      var terms = D.glossary.filter(function (t) {
        return t.term.indexOf(q) >= 0 || (t.reading && t.reading.indexOf(q) >= 0) ||
          (t.definition && t.definition.indexOf(q) >= 0);
      }).slice(0, 30);
      if (terms.length) {
        h += '<div class="card"><h3>用語（' + terms.length + '件）</h3>' + terms.map(function (t) {
          return '<button class="term-row" data-gs-term="' + esc(t.term) + '"><span class="t-term">' + esc(t.term) + '</span>' +
            '<span class="t-read">' + esc(t.reading || '') + '</span><span class="t-gloss">' + esc(t.gloss || '') + '</span></button>';
        }).join('') + '</div>';
      }
      var secs = [];
      D.texts.forEach(function (t) {
        t.sections.forEach(function (s) {
          if (s.heading.indexOf(q) >= 0 || (s.body || '').indexOf(q) >= 0) {
            secs.push({ unit: t.unit_id, title: t.title, sec: s });
          }
        });
      });
      secs = secs.slice(0, 20);
      if (secs.length) {
        h += '<div class="card"><h3>テキストのセクション（' + secs.length + '件）</h3>' + secs.map(function (x) {
          return '<button class="term-row" data-gs-sec="' + x.unit + '-' + x.sec.id + '"><span class="t-term">' + esc(x.unit) + ' ' + esc(x.title) + '</span>' +
            '<span class="t-gloss">' + esc(x.sec.id) + ' ' + esc(x.sec.heading) + '</span></button>';
        }).join('') + '</div>';
      }
      var qs = D.hs.filter(function (x) {
        return ((x.question && x.question.text) || '').indexOf(q) >= 0 || (x.topic || '').indexOf(q) >= 0;
      }).slice(0, 15);
      if (qs.length) {
        h += '<div class="card"><h3>高校問題（' + qs.length + '件）</h3>' + qs.map(function (x) {
          return '<button class="term-row" data-gs-q="' + esc(x.id) + '"><span class="t-term">' + esc(((x.question.text || '').slice(0, 42))) + '…</span>' +
            '<span class="t-gloss">' + esc(x.id) + '</span></button>';
        }).join('') + '</div>';
      }
      box.innerHTML = h || '<p class="muted">見つかりませんでした。</p>';
      box.querySelectorAll('[data-gs-term]').forEach(function (el) {
        el.addEventListener('click', function () { openTerm(el.getAttribute('data-gs-term')); });
      });
      box.querySelectorAll('[data-gs-sec]').forEach(function (el) {
        el.addEventListener('click', function () { openTextSection(el.getAttribute('data-gs-sec')); });
      });
      box.querySelectorAll('[data-gs-q]').forEach(function (el) {
        el.addEventListener('click', function () {
          var qid = el.getAttribute('data-gs-q');
          push(function () { window.JHQuiz.start({ title: '検索結果の問題', items: [{ kind: 'hs', id: qid }], mode: 'jump' }); }, '問題');
        });
      });
    }
    document.getElementById('gs-go').addEventListener('click', run);
    document.getElementById('gs-q').addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
    document.getElementById('gs-q').focus();
  }

  /* ---------------- 設定 ---------------- */
  function syncSettingsUI() {
    var st = S.state.settings;
    document.querySelectorAll('#set-size button').forEach(function (b) {
      b.classList.toggle('on', Number(b.getAttribute('data-v')) === st.sessionSize);
    });
    document.querySelectorAll('#set-font button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-v') === st.fontSize);
    });
    document.querySelectorAll('#set-level button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-v') === st.targetLevel);
    });
  }
  function applyFont() {
    document.documentElement.dataset.font = S.state.settings.fontSize === 'large' ? 'large' : 'std';
  }
  function bindSettings() {
    document.getElementById('btn-settings').addEventListener('click', function () {
      syncSettingsUI();
      document.getElementById('settings-overlay').hidden = false;
    });
    document.querySelectorAll('[data-close]').forEach(function (el) {
      el.addEventListener('click', function () {
        document.getElementById(el.getAttribute('data-close')).hidden = true;
      });
    });
    document.querySelectorAll('.overlay').forEach(function (ov) {
      ov.addEventListener('click', function (e) { if (e.target === ov) ov.hidden = true; });
    });
    function seg(id, apply) {
      document.querySelectorAll('#' + id + ' button').forEach(function (b) {
        b.addEventListener('click', function () { apply(b.getAttribute('data-v')); syncSettingsUI(); });
      });
    }
    seg('set-size', function (v) { S.state.settings.sessionSize = Number(v); S.save(); });
    seg('set-font', function (v) { S.state.settings.fontSize = v; S.save(); applyFont(); });
    seg('set-level', function (v) { S.state.settings.targetLevel = v; S.save(); });
    document.getElementById('btn-reset-records').addEventListener('click', function () {
      if (!window.confirm('学習記録をすべて消去します。よろしいですか？')) return;
      S.resetAll();
      document.getElementById('settings-overlay').hidden = true;
      toast('記録を消去しました');
      goHome();
    });
  }

  /* ---------------- 起動 ---------------- */
  window.JHApp = {
    setTitle: setTitle, push: push, back: back, goHome: goHome,
    openTerm: openTerm, openTextSection: openTextSection,
    openViewer: openViewer, toast: toast,
    rankUpToast: rankUpToast, celebrate: celebrate, getScrollY: currentY
  };

  function boot() {
    mainEl = document.getElementById('app-main');
    titleEl = document.getElementById('header-title');
    backBtn = document.getElementById('btn-back');
    backBtn.addEventListener('click', back);
    document.getElementById('btn-search').addEventListener('click', function () { push(renderSearch, '全体検索'); });
    bindSettings();
    bindViewer();
    applyFont();
    window.JHData.loadAll().then(function () {
      goHome();
    }).catch(function (err) {
      mainEl.innerHTML = '<div class="card"><h3>読み込みに失敗しました</h3><p class="muted small">' + esc(err && err.message) + '</p>' +
        '<div class="btn-row"><button class="btn" id="boot-retry">再読み込み</button></div></div>';
      document.getElementById('boot-retry').addEventListener('click', function () { location.reload(); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
