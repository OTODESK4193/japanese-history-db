/* views.js — 各画面の描画（ホーム／単元テキスト／各種モードの入口） */
(function () {
  'use strict';
  var D = window.JHData.D;
  var esc = window.JHData.esc;
  var S = window.JHStore;
  var A = window.JHApp;

  function unitOf(q) { return (q.unit || '').split(' ')[0]; }

  /* ---------------- ホーム ---------------- */
  function renderHome() {
    A.setTitle('日本史学習アプリ');
    var st = S.state;
    var due = S.dueCount();
    var totalAttempts = st.attempts.length + st.yearAttempts.length;
    var qTotal = st.attempts.length;
    var qCorrect = st.attempts.filter(function (a) { return a.correct; }).length;
    var rate = qTotal ? Math.round(qCorrect / qTotal * 100) : null;
    var h = '';
    // ヒーロー: 学習サマリと次にやることへの導線
    h += '<section class="hero"><div class="hero-top">' +
      '<div class="hero-mark">史</div>' +
      '<div><div class="hero-title">今日の学習</div>' +
      '<div class="hero-sub">記録はこの端末にだけ保存されます</div></div></div>' +
      '<div class="hero-stats">' +
      '<div class="hstat"><div class="hstat-num">' + totalAttempts + '</div><div class="hstat-lbl">総回答数</div></div>' +
      '<div class="hstat"><div class="hstat-num">' + (rate === null ? '―' : rate + '<span style="font-size:.55em">%</span>') + '</div><div class="hstat-lbl">正答率</div></div>' +
      '<div class="hstat"><div class="hstat-num' + (due > 0 ? ' accent' : '') + '">' + due + '</div><div class="hstat-lbl">今日の復習</div></div>' +
      '</div>';
    // 称号: 現在の称号・学習ポイント・次の称号までの進捗
    var ri = S.rankInfo();
    h += '<button class="hero-rank" id="home-rank"><span class="hr-rank-lbl">現在の称号</span>' +
      '<span class="hr-rank-name">' + esc(ri.title.name) + '</span>' +
      '<span class="hr-rank-pts">学習ポイント ' + ri.breakdown.total + '</span>' +
      (ri.next
        ? '<span class="rank-bar"><span style="width:' + Math.round(ri.progress * 100) + '%"></span></span>' +
          '<span class="hr-rank-next">次の称号「' + esc(ri.next.name) + '」まで あと ' + ri.toNext + ' ポイント</span>'
        : '<span class="hr-rank-next">最高ランク到達！</span>') +
      '<span class="hr-rank-go">称号の一覧を見る ›</span></button>';
    if (due > 0) {
      h += '<button class="hero-due" id="home-due"><span>復習の期限が来ている項目が ' + due + ' 件あります</span><span>›</span></button>';
    }
    if (st.session && st.session.items && st.session.items.length) {
      var done = Object.keys(st.session.answers || {}).length;
      h += '<div class="hero-resume" id="home-resume"><div class="hr-title">前回の続きがあります</div>' +
        '<p class="muted small">「' + esc(st.session.title) + '」 ' + (st.session.idx + 1) + '問目／全' + st.session.items.length + '問（回答済み ' + done + '問）</p>' +
        '<button class="btn" id="resume-btn">続きから再開する</button> ' +
        '<button class="btn sub" id="discard-btn">破棄する</button></div>';
    }
    h += '</section>';
    // モード: グループ見出しで整理し、主役モードに階層を付ける
    h += '<h2 class="group-title">問題演習</h2><div class="grid2">' +
      modeCard('exam', '入試問題', D.hs.length + '問', '形式・分野・難易度で絞り込み可', 'mode-accent') +
      modeCard('mock', '模試モード', '32問', '制限時間なし・一括採点', 'mode-steel') +
      modeCard('themes', 'テーマ史', '6テーマ', 'テーマごとに通史演習', '') +
      modeCard('jhs', '中学復習', D.jhs.length + '問', '時代別に中学範囲を復習', '') +
      modeCard('cloze', '穴埋め', D.cloze.length + '問', 'テキストから自動生成', '') +
      '</div>';
    h += '<h2 class="group-title">辞書とカード</h2><div class="grid2">' +
      modeCard('dict', '辞書', D.glossary.length + '語', '検索して用語を確認', '') +
      modeCard('cards', '単語帳', D.glossary.length + '語', '弱点デッキ・自己判定つき', '') +
      modeCard('years', '年号カード', D.years.length + '件', '語呂' + D.years.filter(function (y) { return y.goro; }).length + '件で暗記', '') +
      modeCard('recall', '想起ドリル', '', '定義から用語を当てる', '') +
      modeCard('trivia', '豆知識', D.trivia.length + '件', '認識状態ラベルつき', '') +
      '</div>';
    h += '<h2 class="group-title">記録と検索</h2><div class="grid2">' +
      modeCard('review', '復習リスト', due + '件が期限', '間隔反復・卒業は連続2回正解', 'mode-review') +
      modeCard('stats', '成績', totalAttempts + '回回答', '分野・形式・難易度別の内訳', '') +
      modeCard('search', '全体検索', '横断検索', '用語・セクション・問題をさがす', '') +
      '</div>';
    h += '<h2 class="group-title">単元テキストと単元テスト</h2>';
    D.texts.forEach(function (t) {
      var n = D.hs.filter(function (q) { return unitOf(q) === t.unit_id; }).length;
      var uAtt = st.attempts.filter(function (a) { return a.kind === 'hs' && a.unit === t.unit_id; });
      var uRate = uAtt.length ? Math.round(uAtt.filter(function (a) { return a.correct; }).length / uAtt.length * 100) : null;
      h += '<div class="unit-row"><span class="u-no">' + esc(t.unit_id) + '</span>' +
        '<span class="u-main"><span class="u-t">' + esc(t.title) + '</span>' +
        (t.subtitle ? '<span class="u-sub">' + esc(t.subtitle) + '</span>' : '') + '</span>' +
        (uRate !== null ? '<span class="pill">正答率 ' + uRate + '%</span>' : '') +
        '<button class="chip" data-unit-text="' + t.unit_id + '">テキスト</button>' +
        '<button class="chip" data-unit-test="' + t.unit_id + '">テスト ' + n + '問</button></div>';
    });
    h += '<p class="muted small" style="margin-top:16px">記録はこの端末にのみ保存されます（回答 ' + totalAttempts + ' 回）。</p>';
    document.getElementById('app-main').innerHTML = h;
    window.scrollTo(0, 0);
    bindHome();
  }

  function modeCard(mode, label, stat, sub, variant) {
    return '<div class="card tap mode-card' + (variant ? ' ' + variant : '') + '" data-mode="' + mode + '">' +
      '<div class="mc-label">' + esc(label) + '</div>' +
      '<div class="mc-sub">' + esc(sub) + '</div>' +
      (stat ? '<div class="mc-stat">' + esc(stat) + '</div>' : '') + '</div>';
  }

  function bindHome() {
    var main = document.getElementById('app-main');
    main.querySelectorAll('[data-mode]').forEach(function (el) {
      el.addEventListener('click', function () { goMode(el.getAttribute('data-mode')); });
    });
    main.querySelectorAll('[data-unit-text]').forEach(function (el) {
      el.addEventListener('click', function () { A.push(function () { renderText(el.getAttribute('data-unit-text')); }, '単元テキスト'); });
    });
    main.querySelectorAll('[data-unit-test]').forEach(function (el) {
      el.addEventListener('click', function () { startUnitTest(el.getAttribute('data-unit-test')); });
    });
    var rb = document.getElementById('resume-btn');
    if (rb) rb.addEventListener('click', function () {
      A.push(function () { window.JHQuiz.resume(S.state.session); }, S.state.session.title);
    });
    var db = document.getElementById('discard-btn');
    if (db) db.addEventListener('click', function () {
      S.state.session = null; S.save(); renderHome();
    });
    var due = document.getElementById('home-due');
    if (due) due.addEventListener('click', function () { A.push(window.JHViews2.renderReview, '復習リスト'); });
    var rk = document.getElementById('home-rank');
    if (rk) rk.addEventListener('click', function () { A.push(renderTitles, '称号'); });
  }

  /* ---------------- 称号一覧 ---------------- */
  function renderTitles() {
    A.setTitle('称号');
    var ri = S.rankInfo();
    var pts = ri.breakdown.total;
    var h = '<p class="muted small">学習ポイントに応じて20段階の称号が上がります。ポイントは「正解したことのある問題の種類数＋単語帳で『覚えた』用語数＋年号カードで『思い出せた』年号数」です。</p>' +
      '<div class="card rank-summary"><div class="hr-rank-lbl">現在の称号</div>' +
      '<div class="hr-rank-name">' + esc(ri.title.name) + '</div>' +
      '<p style="margin:6px 0 0">学習ポイント ' + pts + '（問題 ' + ri.breakdown.questions + '種・用語 ' + ri.breakdown.terms + '語・年号 ' + ri.breakdown.years + '件）</p>' +
      (ri.next ? '<p class="muted small" style="margin:4px 0 0">次の称号「' + esc(ri.next.name) + '」まで あと ' + ri.toNext + ' ポイント</p>' : '') +
      '</div>';
    h += S.TITLES.map(function (t, i) {
      var cls = 'rank-row' + (i === ri.index ? ' current' : (pts >= t.min ? ' reached' : ' locked'));
      var state = i === ri.index ? '現在' : (pts >= t.min ? '到達済み' : t.min + ' ポイント〜');
      return '<div class="' + cls + '"><span class="rk-no">' + (i + 1) + '</span>' +
        '<span class="rk-name">' + esc(t.name) + '</span>' +
        '<span class="rk-state">' + state + '</span></div>';
    }).join('');
    document.getElementById('app-main').innerHTML = h;
    window.scrollTo(0, 0);
  }

  function goMode(mode) {
    var V2 = window.JHViews2;
    if (mode === 'exam') A.push(V2.renderExamSetup, '入試問題');
    else if (mode === 'mock') V2.startMock();
    else if (mode === 'jhs') A.push(V2.renderJhsSetup, '中学復習');
    else if (mode === 'cloze') A.push(V2.renderClozeSetup, '穴埋め');
    else if (mode === 'cards') A.push(V2.renderCardsSetup, '単語帳');
    else if (mode === 'dict') A.push(function () { V2.renderDict(''); }, '辞書');
    else if (mode === 'years') A.push(V2.renderYearsSetup, '年号カード');
    else if (mode === 'recall') V2.startRecall();
    else if (mode === 'themes') A.push(V2.renderThemes, 'テーマ史');
    else if (mode === 'trivia') A.push(function () { V2.renderTrivia(''); }, '豆知識');
    else if (mode === 'review') A.push(V2.renderReview, '復習リスト');
    else if (mode === 'stats') A.push(V2.renderStats, '成績');
    else if (mode === 'search') document.getElementById('btn-search').click();
  }

  function startUnitTest(unitId) {
    var pool = window.JHData.prioritise(D.hs.filter(function (q) { return unitOf(q) === unitId; }), 'hs');
    var t = D.textByUnit[unitId];
    var items = pool.slice(0, S.state.settings.sessionSize)
      .map(function (q) { return { kind: 'hs', id: q.id }; });
    if (!items.length) { A.toast('問題がありません'); return; }
    A.push(function () {
      window.JHQuiz.start({ title: '単元テスト｜' + (t ? t.title : unitId), items: items, mode: 'unit' });
    }, '単元テスト');
  }

  /* ---------------- 単元テキスト ---------------- */
  var textState = {}; // unitId -> {tab:'body'|'timeline'|'years'|'desc', tlAxis:'日本'|'世界'|'両方', anchorYear}

  function renderText(unitId, sectionId) {
    var t = D.textByUnit[unitId];
    if (!t) { A.toast('テキストが見つかりません'); return; }
    var st = textState[unitId] || (textState[unitId] = { tab: 'body', tlAxis: '両方', anchorYear: null });
    A.setTitle(unitId + ' ' + t.title);
    var h = '<p class="muted small" style="margin:0">' + esc(t.subtitle || '') + '</p>';
    h += '<div class="chips" role="tablist">' +
      ['body:本文', 'timeline:年表', 'years:年号・語呂', 'desc:模範解答の解説'].map(function (s) {
        var kv = s.split(':');
        return '<button class="chip' + (st.tab === kv[0] ? ' on' : '') + '" data-ttab="' + kv[0] + '">' + kv[1] + '</button>';
      }).join('') + '</div>';
    h += '<div id="text-body"></div>';
    document.getElementById('app-main').innerHTML = h;
    document.querySelectorAll('[data-ttab]').forEach(function (el) {
      el.addEventListener('click', function () {
        st.tab = el.getAttribute('data-ttab');
        renderText(unitId);
      });
    });
    var body = document.getElementById('text-body');
    if (st.tab === 'body') renderTextBody(t, body, sectionId);
    else if (st.tab === 'timeline') renderTimeline(t, body, st);
    else if (st.tab === 'years') renderUnitYears(t, body);
    else renderCommentaries(t, body);
    if (sectionId && st.tab === 'body') {
      var target = document.getElementById('sec-' + sectionId);
      if (target) setTimeout(function () { target.scrollIntoView({ block: 'start' }); }, 60);
    }
  }

  function materialHtml(m) {
    var h = '<div class="material"><div class="m-title">' + esc(m.title || '') +
      ' <span class="badge auto">' + esc(m.kind || '') + '</span></div>';
    var d = m.display || { type: 'none' };
    if (d.type === 'diagram') {
      var svg = D.svgs[d.file] || '';
      if (svg) h += '<div class="svgbox" data-viewer-svg="' + esc(d.file) + '">' + svg + '</div><p class="small muted">タップで拡大表示</p>';
    } else if (d.type === 'photo') {
      h += '<img src="' + window.JHData.photoUrl(d.file, 1024) + '" alt="' + esc(m.title || '') + '" loading="lazy" data-viewer-img="' + esc(d.file) + '">';
    } else if (d.type === 'link') {
      h += '<p class="small"><a href="' + esc(d.url) + '" target="_blank" rel="noopener">資料を開く（外部サイト）</a></p>';
    } else if (d.type === 'trivia') {
      h += '<div class="chips">' + (d.ids || []).map(function (id) {
        var tr = D.triviaById[id];
        return tr ? '<button class="chip" data-trivia="' + id + '">' + esc(tr.title) + '</button>' : '';
      }).join('') + '</div>';
    }
    if (m.usage) h += '<p class="small muted">' + esc(m.usage) + '</p>';
    if (m.license_status) h += '<p class="small muted">ライセンス・出典：' + esc(m.license_status) + '</p>';
    if (d.type === 'photo') h += '<p class="small muted">出典：Wikimedia Commons（タップで拡大）</p>';
    return h + '</div>';
  }

  function renderTextBody(t, body, sectionId) {
    var h = '';
    if (t.intro) h += '<div class="card"><p style="margin:0">' + window.JHData.linkTerms(t.intro) + '</p></div>';
    var matsBySection = {};
    (t.materials || []).forEach(function (m) {
      var key = (m.section_ref || '').split('/')[0];
      (matsBySection[key] = matsBySection[key] || []).push(m);
    });
    t.sections.forEach(function (s) {
      h += '<section class="text-section" id="sec-' + esc(s.id) + '"><h2>' + esc(t.unit_id + '-' + s.id) + ' ' + esc(s.heading) +
        ' <span class="idlabel">' + esc(t.unit_id + '-' + s.id) + '</span></h2>';
      if (s.points && s.points.length) {
        h += '<ul class="points">' + s.points.map(function (p) {
          return '<li>' + window.JHData.linkTerms(p) + '</li>';
        }).join('') + '</ul>';
      }
      if (s.body) h += '<div class="body-text">' + window.JHData.linkTerms(s.body) + '</div>';
      if (s.key_terms && s.key_terms.length) {
        h += '<div class="chips">' + s.key_terms.map(function (k) {
          var term = (typeof k === 'object') ? k.term : String(k);
          return '<button class="chip term" data-term="' + esc(term) + '">' + esc(term) + '</button>';
        }).join('') + '</div>';
      }
      (matsBySection[s.id] || []).forEach(function (m) { h += materialHtml(m); });
      h += '</section>';
    });
    // どのセクションにも属さない資料
    var placed = {};
    Object.keys(matsBySection).forEach(function (k) {
      if (!t.sections.some(function (s) { return s.id === k; })) placed[k] = matsBySection[k];
    });
    var rest = [];
    Object.keys(placed).forEach(function (k) { rest = rest.concat(placed[k]); });
    if (rest.length) {
      h += '<section class="text-section"><h2>資料</h2>';
      rest.forEach(function (m) { h += materialHtml(m); });
      h += '</section>';
    }
    if (t.sources && t.sources.length) {
      h += '<section class="text-section"><h2>出典</h2><ul class="points">' +
        t.sources.map(function (s) {
          var name = s.name || s.title || String(s);
          var url = s.url || s.ref_url;
          return '<li>' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(name) + '</a>' : esc(name)) + '</li>';
        }).join('') + '</ul></section>';
    }
    body.innerHTML = h;
    bindTextActions(body);
  }

  function bindTextActions(root) {
    root.querySelectorAll('[data-term]').forEach(function (el) {
      el.addEventListener('click', function () { A.openTerm(el.getAttribute('data-term')); });
    });
    root.querySelectorAll('.termlink').forEach(function (el) {
      el.addEventListener('click', function () { A.openTerm(el.getAttribute('data-term')); });
    });
    root.querySelectorAll('[data-viewer-svg]').forEach(function (el) {
      el.addEventListener('click', function () {
        A.openViewer({ svg: D.svgs[el.getAttribute('data-viewer-svg')], title: '図解' });
      });
    });
    root.querySelectorAll('[data-viewer-img]').forEach(function (el) {
      el.addEventListener('click', function () {
        A.openViewer({ img: window.JHData.photoUrl(el.getAttribute('data-viewer-img'), 1600), title: '写真' });
      });
    });
    root.querySelectorAll('[data-trivia]').forEach(function (el) {
      el.addEventListener('click', function () { A.push(function () { window.JHViews2.renderTrivia(el.getAttribute('data-trivia')); }, '豆知識'); });
    });
  }

  /* 年表タブ: 日本／世界／両方。切替時は「いま見ている年代」に同期する */
  function renderTimeline(t, body, st) {
    var entries = (t.timeline || []).slice().sort(function (a, b) {
      return (a.year_sort || 0) - (b.year_sort || 0);
    });
    var h = '<div class="timeline-tabs">' +
      ['日本', '世界', '両方'].map(function (a) {
        return '<button data-axis="' + a + '"' + (st.tlAxis === a ? ' class="on"' : '') + '>' + a + '</button>';
      }).join('') + '</div>';
    h += '<p class="small muted" id="tl-anchor-label"></p>';
    h += '<div id="tl-list"></div>';
    body.innerHTML = h;
    var listEl = document.getElementById('tl-list');

    function draw(anchorYear) {
      var items = entries.filter(function (e) {
        return st.tlAxis === '両方' || e.axis === st.tlAxis;
      });
      listEl.innerHTML = items.map(function (e, i) {
        return '<div class="tl-item ' + (e.axis === '世界' ? 'world' : 'japan') + '" data-year="' + (e.year_sort || 0) + '" data-i="' + i + '">' +
          '<span class="tl-year">' + esc(e.year_display || '') + '</span>' +
          '<span>' + esc(e.event || '') + '<span class="tl-axis">' + esc(e.axis || '') + '</span>' +
          (e.contemporary_japan && st.tlAxis !== '日本' ? '<br><span class="small muted">日本では：' + esc(e.contemporary_japan) + '</span>' : '') +
          '</span></div>';
      }).join('') || '<p class="muted">この区分の年表項目はありません。</p>';
      if (anchorYear != null && items.length) {
        var best = 0, bd = Infinity;
        items.forEach(function (e, i) {
          var d = Math.abs((e.year_sort || 0) - anchorYear);
          if (d < bd) { bd = d; best = i; }
        });
        var el = listEl.querySelector('[data-i="' + best + '"]');
        if (el) {
          el.classList.add('anchor');
          setTimeout(function () { el.scrollIntoView({ block: 'center' }); }, 40);
        }
      }
      updateAnchorLabel();
    }

    function currentAnchorYear() {
      var els = listEl.querySelectorAll('.tl-item');
      for (var i = 0; i < els.length; i++) {
        var r = els[i].getBoundingClientRect();
        if (r.bottom > 130) return Number(els[i].getAttribute('data-year'));
      }
      return st.anchorYear;
    }
    function updateAnchorLabel() {
      var y = currentAnchorYear();
      if (y != null) st.anchorYear = y;
      var lbl = document.getElementById('tl-anchor-label');
      if (lbl) lbl.textContent = st.anchorYear != null ? ('いま読んでいる位置：' + st.anchorYear + '年ごろ') : '';
    }
    var scrollTimer = null;
    window.onscroll = function () {
      if (scrollTimer) return;
      scrollTimer = setTimeout(function () { scrollTimer = null; updateAnchorLabel(); }, 120);
    };
    body.querySelectorAll('[data-axis]').forEach(function (el) {
      el.addEventListener('click', function () {
        var anchor = currentAnchorYear();
        st.tlAxis = el.getAttribute('data-axis');
        renderTimeline(t, body, st);
        // 切替先でも同じ年代に着地する
        var list2 = document.getElementById('tl-list');
        var items = entries.filter(function (e) { return st.tlAxis === '両方' || e.axis === st.tlAxis; });
        var best = 0, bd = Infinity;
        items.forEach(function (e, i) {
          var d = Math.abs((e.year_sort || 0) - (anchor || 0));
          if (d < bd) { bd = d; best = i; }
        });
        var target = list2.querySelector('[data-i="' + best + '"]');
        if (target) {
          target.classList.add('anchor');
          setTimeout(function () { target.scrollIntoView({ block: 'center' }); }, 40);
        }
      });
    });
    draw(st.anchorYear);
  }

  function goroBadge(g) {
    if (!g) return '';
    var cls = g.origin === 'created' ? 'created' : 'trad';
    var lbl = g.origin === 'created' ? '当方作成' : '伝統ゴロ';
    return '<span class="badge ' + cls + '">' + lbl + '</span>';
  }

  function renderUnitYears(t, body) {
    var years = window.JHData.unitYears(t.unit_id);
    if (!years.length) { body.innerHTML = '<p class="muted">この単元の年号レコードはありません。</p>'; return; }
    body.innerHTML = years.map(function (y) {
      return '<div class="tl-item"><span class="tl-year">' + y.year + '年</span><span>' + esc(y.event) +
        (y.goro ? '<br><span class="small">語呂：' + esc(y.goro.phrase) + '</span>' + goroBadge(y.goro) : '') +
        (y.certainty && y.certainty !== '確定' ? '<span class="badge warn">' + esc(y.certainty) + '</span>' : '') +
        '</span></div>';
    }).join('');
  }

  function renderCommentaries(t, body) {
    var cu = D.commentaries.filter(function (u) { return u.unit === t.unit_id; })[0];
    if (!cu) { body.innerHTML = '<p class="muted">この単元の解説はありません。</p>'; return; }
    var h = '<p class="muted small">実際の大学入試の記述問題と模範解答を分析した学習コンテンツです。自分で答案を書く形式ではなく、満点答案に必要な要素を読み解きます。</p>';
    cu.commentaries.forEach(function (c, ci) {
      var key = t.unit_id + '-C' + ci;
      var saved = S.state.commentary[key] || { checked: [], read: false };
      h += '<div class="card"><h3>' + esc(c.theme || '') + ' <span class="badge auto">' + esc(c.answer_type || '') + '</span>' +
        (saved.read ? '<span class="badge trad">読了</span>' : '') + '</h3>';
      var ps = c.prompt_style || {};
      if (ps.prompt) h += '<p><strong>想定問題：</strong>' + esc(ps.prompt) + (ps.char_limit_design ? '（' + esc(String(ps.char_limit_design)) + '）' : '') + '</p>';
      if (ps.source_passage) {
        h += '<h4>史料（原文）</h4><p style="white-space:pre-wrap">' + esc(ps.source_passage) + '</p>';
        if (ps.source_glosses && ps.source_glosses.length) {
          h += '<h4>語注</h4><ul class="points">' + ps.source_glosses.map(function (g) {
            return '<li>' + esc(g.term) + '（' + esc(g.reading || '') + '）：' + esc(g.note || '') + '</li>';
          }).join('') + '</ul>';
        }
        if (ps.source_aux) h += '<p class="small muted">' + esc(ps.source_aux) + '</p>';
      }
      if (c.model_answer) h += '<h4>模範解答</h4><p style="white-space:pre-wrap">' + window.JHData.linkTerms(c.model_answer) + '</p>';
      if (c.elements && c.elements.length) {
        h += '<h4>満点答案の要素（自己チェック）</h4>';
        c.elements.forEach(function (el, ei) {
          var checked = saved.checked && saved.checked[ei];
          h += '<label class="checkline"><input type="checkbox" data-comm-check="' + key + ':' + ei + '"' + (checked ? ' checked' : '') + '>' +
            '<span><strong>' + esc(el.content) + '</strong><br><span class="small muted">なぜ必要か：' + esc(el.why_needed || '') +
            (el.if_missing ? '<br>欠けると：' + esc(el.if_missing) : '') + '</span></span></label>';
        });
      }
      if (c.commentary) {
        var ctext = Array.isArray(c.commentary) ? c.commentary.join('\n') : String(c.commentary);
        h += '<h4>解説</h4><p style="white-space:pre-wrap">' + window.JHData.linkTerms(ctext) + '</p>';
      }
      if (c.grounding && c.grounding.evidence_level) {
        h += '<p class="small muted">根拠：' + esc(typeof c.grounding.evidence_level === 'string' ? c.grounding.evidence_level : JSON.stringify(c.grounding.evidence_level)) + '</p>';
      }
      if (c.links && c.links.related_questions && c.links.related_questions.length) {
        h += '<div class="chips">' + c.links.related_questions.map(function (qid) {
          return '<button class="chip" data-jump-q="' + esc(qid) + '">' + esc(qid) + ' を解く</button>';
        }).join('') + '</div>';
      }
      h += '<div class="btn-row"><button class="btn sub" data-comm-read="' + key + '">' + (saved.read ? '読了を取り消す' : '読了にする') + '</button></div>';
      h += '</div>';
    });
    if (cu.analysis && cu.analysis.length) {
      h += '<h3>出題分析（' + cu.analysis.length + '件）</h3>';
      cu.analysis.forEach(function (r) {
        h += '<details class="analysis"><summary>' + esc(r.university || '') + ' ' + esc(r.year || '') + ' ' + esc(r.exam_part || '') + ' ― ' + esc(r.theme || '') + '</summary>' +
          '<p class="small">形式：' + esc((r.format && (r.format.char_limit || r.format.notes)) || r.answer_type || '') + '<br>根拠レベル：' + esc(r.evidence_level || '') + '</p>' +
          (r.elements_required ? '<p class="small"><strong>必要な要素：</strong></p><ul class="points">' + r.elements_required.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' : '') +
          (r.insufficiency_patterns ? '<p class="small"><strong>不足しがちな点：</strong></p><ul class="points">' + r.insufficiency_patterns.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' : '') +
          '</details>';
      });
    }
    body.innerHTML = h;
    bindTextActions(body);
    body.querySelectorAll('[data-comm-check]').forEach(function (el) {
      el.addEventListener('change', function () {
        var parts = el.getAttribute('data-comm-check').split(':');
        var key = parts[0], ei = Number(parts[1]);
        var rec = S.state.commentary[key] || (S.state.commentary[key] = { checked: [], read: false });
        rec.checked[ei] = el.checked;
        S.save();
      });
    });
    body.querySelectorAll('[data-comm-read]').forEach(function (el) {
      el.addEventListener('click', function () {
        var key = el.getAttribute('data-comm-read');
        var rec = S.state.commentary[key] || (S.state.commentary[key] = { checked: [], read: false });
        rec.read = !rec.read;
        S.saveNow();
        renderText(t.unit_id);
      });
    });
    body.querySelectorAll('[data-jump-q]').forEach(function (el) {
      el.addEventListener('click', function () {
        var qid = el.getAttribute('data-jump-q');
        A.push(function () {
          window.JHQuiz.start({ title: '関連問題', items: [{ kind: 'hs', id: qid }], mode: 'jump' });
        }, '関連問題');
      });
    });
  }

  window.JHViews = {
    renderHome: renderHome, renderText: renderText, goMode: goMode,
    renderTitles: renderTitles,
    startUnitTest: startUnitTest, bindTextActions: bindTextActions,
    goroBadge: goroBadge, unitOf: unitOf
  };
})();
