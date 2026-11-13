/* views2.js — 入試問題／模試／中学復習／穴埋め／単語帳／辞書／年号カード／想起ドリル／
 * テーマ史／豆知識／復習リスト／成績 */
(function () {
  'use strict';
  var D = window.JHData.D;
  var esc = window.JHData.esc;
  var S = window.JHStore;
  var A = window.JHApp;
  var V = window.JHViews;
  var unitOf = V.unitOf;

  /* 称号ランクアップ時の祝福表示（自己判定の記録直後に呼ぶ） */
  function rankUpToast() {
    var up = S.checkRankUp();
    if (up) {
      A.toast('🎉 称号「' + up.title.name + '」にランクアップ！（学習ポイント ' + up.breakdown.total + '）');
    }
  }

  /* ---------------- 入試問題（絞り込み） ---------------- */
  var TYPES = ['通常', '整序', '会話・探究', '複数資料', '地図・図表', '写真・図版'];
  var examState = { types: {}, topic: '', diffs: {}, unit: '' };

  function examPool() {
    return D.hs.filter(function (q) {
      var tl = window.JHData.typeLabel(q);
      var typeOn = TYPES.some(function (t) { return examState.types[t]; });
      if (typeOn && !examState.types[tl]) return false;
      if (examState.topic && q.topic !== examState.topic) return false;
      var diffOn = ['基礎', '発展', '難関'].some(function (d) { return examState.diffs[d]; });
      if (diffOn && !examState.diffs[q.difficulty]) return false;
      if (examState.unit && unitOf(q) !== examState.unit) return false;
      return true;
    });
  }

  function renderExamSetup() {
    A.setTitle('入試問題');
    var topics = {};
    D.hs.forEach(function (q) { topics[q.topic] = (topics[q.topic] || 0) + 1; });
    var topicOpts = Object.keys(topics).sort().map(function (t) {
      return '<option value="' + esc(t) + '"' + (examState.topic === t ? ' selected' : '') + '>' + esc(t) + '（' + topics[t] + '）</option>';
    }).join('');
    var unitOpts = D.texts.map(function (t) {
      return '<option value="' + t.unit_id + '"' + (examState.unit === t.unit_id ? ' selected' : '') + '>' + t.unit_id + ' ' + esc(t.title) + '</option>';
    }).join('');
    var h = '<div class="card"><h3>出題の絞り込み</h3><div class="filter-box">' +
      '<label>形式</label><div class="chips" id="ex-types">' +
      TYPES.map(function (t) {
        return '<button class="chip' + (examState.types[t] ? ' on' : '') + '" data-t="' + t + '">' + t + '</button>';
      }).join('') + '</div>' +
      '<label>分野</label><select class="fsel" id="ex-topic"><option value="">すべての分野</option>' + topicOpts + '</select>' +
      '<label>難易度</label><div class="chips" id="ex-diffs">' +
      ['基礎', '発展', '難関'].map(function (d) {
        return '<button class="chip' + (examState.diffs[d] ? ' on' : '') + '" data-d="' + d + '">' + d + '</button>';
      }).join('') + '</div>' +
      '<label>単元</label><select class="fsel" id="ex-unit"><option value="">すべての単元</option>' + unitOpts + '</select>' +
      '<p id="ex-count" style="font-weight:700;margin:12px 0 4px"></p>' +
      '<p class="muted small">出題数は設定（現在 ' + S.state.settings.sessionSize + '問）が適用されます。志望レベル「' +
      (S.state.settings.targetLevel === 'hard' ? '難関二次中心' : '共通テスト中心') + '」で難易度の優先が変わります。</p>' +
      '<div class="btn-row"><button class="btn" id="ex-start">この条件で開始する</button></div></div></div>';
    document.getElementById('app-main').innerHTML = h;
    function upd() {
      document.getElementById('ex-count').textContent = '対象：' + examPool().length + '問';
    }
    document.querySelectorAll('#ex-types .chip').forEach(function (el) {
      el.addEventListener('click', function () {
        var t = el.getAttribute('data-t');
        examState.types[t] = !examState.types[t];
        el.classList.toggle('on', !!examState.types[t]);
        upd();
      });
    });
    document.querySelectorAll('#ex-diffs .chip').forEach(function (el) {
      el.addEventListener('click', function () {
        var d = el.getAttribute('data-d');
        examState.diffs[d] = !examState.diffs[d];
        el.classList.toggle('on', !!examState.diffs[d]);
        upd();
      });
    });
    document.getElementById('ex-topic').addEventListener('change', function (e) { examState.topic = e.target.value; upd(); });
    document.getElementById('ex-unit').addEventListener('change', function (e) { examState.unit = e.target.value; upd(); });
    document.getElementById('ex-start').addEventListener('click', function () {
      var pool = examPool();
      if (!pool.length) { A.toast('対象の問題がありません'); return; }
      var counts = {};
      S.state.attempts.forEach(function (a) { if (a.kind === 'hs') counts[a.id] = (counts[a.id] || 0) + 1; });
      pool.sort(function (a, b) {
        var ca = counts[a.id] || 0, cb = counts[b.id] || 0;
        if (ca !== cb) return ca - cb;
        return window.JHData.levelRank(a) - window.JHData.levelRank(b);
      });
      // 同一（回答回数, レベル）群の中だけシャッフルする
      var out = [], i = 0;
      while (i < pool.length) {
        var j = i + 1;
        while (j < pool.length && (counts[pool[j].id] || 0) === (counts[pool[i].id] || 0) &&
               window.JHData.levelRank(pool[j]) === window.JHData.levelRank(pool[i])) j++;
        out = out.concat(window.JHData.shuffle(pool.slice(i, j)));
        i = j;
      }
      var items = out.slice(0, S.state.settings.sessionSize).map(function (q) { return { kind: 'hs', id: q.id }; });
      A.push(function () { window.JHQuiz.start({ title: '入試問題', items: items, mode: 'exam' }); }, '入試問題');
    });
    upd();
  }

  /* ---------------- 模試 ---------------- */
  function startMock() {
    var units = D.texts.map(function (t) { return t.unit_id; });
    var pools = {};
    units.forEach(function (u) {
      pools[u] = window.JHData.prioritise(D.hs.filter(function (q) { return unitOf(q) === u; }), 'hs');
    });
    var picked = [], idx = {};
    var round = 0;
    while (picked.length < 32) {
      var progressed = false;
      for (var k = 0; k < units.length && picked.length < 32; k++) {
        var u = units[k];
        var p = pools[u][idx[u] || 0];
        if (p) { picked.push(p); idx[u] = (idx[u] || 0) + 1; progressed = true; }
      }
      round++;
      if (!progressed || round > 40) break;
    }
    if (!picked.length) { A.toast('問題がありません'); return; }
    A.push(function () {
      window.JHQuiz.start({
        title: '模試モード（32問）',
        items: picked.map(function (q) { return { kind: 'hs', id: q.id }; }),
        mock: true, mode: 'mock'
      });
    }, '模試モード');
  }

  /* ---------------- 中学復習 ---------------- */
  var JHS_ERAS = ['旧石器', '縄文', '弥生', '古墳', '飛鳥', '奈良', '平安', '鎌倉', '室町', '安土桃山', '江戸', '明治', '大正', '昭和', '平成', '現代'];
  function renderJhsSetup() {
    A.setTitle('中学復習');
    var h = '<p class="muted small">中学範囲の200問を時代別に復習します。</p><div class="chips">' +
      '<button class="chip" data-era="">すべての時代</button>' +
      JHS_ERAS.map(function (e) {
        var n = D.jhs.filter(function (q) { return q.era === e; }).length;
        return n ? '<button class="chip" data-era="' + e + '">' + e + '（' + n + '）</button>' : '';
      }).join('') + '</div>';
    document.getElementById('app-main').innerHTML = h;
    document.querySelectorAll('[data-era]').forEach(function (el) {
      el.addEventListener('click', function () {
        var era = el.getAttribute('data-era');
        var pool = window.JHData.prioritise(era ? D.jhs.filter(function (q) { return q.era === era; }) : D.jhs, 'jhs');
        var items = pool.slice(0, S.state.settings.sessionSize).map(function (q) { return { kind: 'jhs', id: q.id }; });
        A.push(function () {
          window.JHQuiz.start({ title: '中学復習' + (era ? '｜' + era : ''), items: items, mode: 'jhs' });
        }, '中学復習');
      });
    });
  }

  /* ---------------- 穴埋め ---------------- */
  function renderClozeSetup() {
    A.setTitle('穴埋め');
    var h = '<p class="muted small">単元テキストの要点から自動生成した穴埋め問題です（年号・数値は空欄にしません）。</p><div class="chips">' +
      '<button class="chip" data-cu="">すべての単元</button>' +
      D.texts.map(function (t) {
        var n = D.cloze.filter(function (c) { return c.unit === t.unit_id; }).length;
        return n ? '<button class="chip" data-cu="' + t.unit_id + '">' + t.unit_id + ' ' + esc(t.title) + '（' + n + '）</button>' : '';
      }).join('') + '</div>';
    document.getElementById('app-main').innerHTML = h;
    document.querySelectorAll('[data-cu]').forEach(function (el) {
      el.addEventListener('click', function () {
        var u = el.getAttribute('data-cu');
        var pool = window.JHData.prioritise(u ? D.cloze.filter(function (c) { return c.unit === u; }) : D.cloze, 'cloze');
        var items = pool.slice(0, S.state.settings.sessionSize).map(function (q) { return { kind: 'cloze', id: q.id }; });
        if (!items.length) { A.toast('問題がありません'); return; }
        A.push(function () { window.JHQuiz.start({ title: '穴埋め' + (u ? '｜' + u : ''), items: items, mode: 'cloze' }); }, '穴埋め');
      });
    });
  }

  /* ---------------- 単語帳 ---------------- */
  function weakTermIds() {
    // 関連問題の最新回答が不正解の用語＋「まだ」と自己判定した用語
    var latest = {};
    S.state.attempts.forEach(function (a) {
      if (a.kind === 'hs' || a.kind === 'jhs') latest[a.id] = a.correct;
    });
    var weak = {};
    D.glossary.forEach(function (t) {
      var bad = t.questions.some(function (qid) { return latest[qid] === false; });
      var self = S.state.termStudy[t.id];
      if (bad || (self && !self.known)) weak[t.id] = true;
    });
    return weak;
  }

  function renderCardsSetup() {
    A.setTitle('単語帳');
    var weak = weakTermIds();
    var knownCount = Object.keys(S.state.termStudy).filter(function (k) { return S.state.termStudy[k].known; }).length;
    var h = '<div class="card"><h3>全語デッキ</h3><p class="muted small">全 ' + D.glossary.length + ' 語が対象です。「覚えた」は ' + knownCount + ' 語。</p>' +
      '<button class="btn" id="cards-all">全語デッキを開始</button></div>' +
      '<div class="card"><h3>弱点デッキ</h3><p class="muted small">関連問題で間違えた用語と「まだ」の用語：' + Object.keys(weak).length + ' 語。</p>' +
      '<button class="btn" id="cards-weak">弱点デッキを開始</button></div>';
    document.getElementById('app-main').innerHTML = h;
    document.getElementById('cards-all').addEventListener('click', function () { runCards(D.glossary); });
    document.getElementById('cards-weak').addEventListener('click', function () {
      var deck = D.glossary.filter(function (t) { return weak[t.id]; });
      if (!deck.length) { A.toast('弱点デッキは空です'); return; }
      runCards(deck);
    });
  }

  function runCards(deck) {
    var cards = window.JHData.shuffle(deck);
    var i = 0, flipped = false;
    A.setTitle('単語帳（' + cards.length + '語）');
    function draw() {
      if (i >= cards.length) {
        document.getElementById('app-main').innerHTML = '<div class="card"><h3>デッキ終了</h3><p>' + cards.length + '語を確認しました。</p>' +
          '<div class="btn-row"><button class="btn" id="fc-home">ホームへ戻る</button></div></div>';
        document.getElementById('fc-home').addEventListener('click', function () { A.goHome(); });
        return;
      }
      var t = cards[i];
      var main = document.getElementById('app-main');
      var h = '<div class="qmeta"><span>' + (i + 1) + ' / ' + cards.length + '</span><span class="idlabel">' + esc(t.id) + '</span></div>' +
        '<div class="flashcard"><div class="fc-term">' + esc(t.term) + '</div>' +
        (t.reading ? '<div class="fc-read">' + esc(t.reading) + '</div>' : '') +
        (flipped ? '<div class="fc-def">' + esc(t.definition || t.gloss || '（定義は辞書で確認してください）') + '</div>' : '<p class="muted">タップで意味を表示</p>') +
        '</div>';
      if (!flipped) {
        h += '<div class="btn-row"><button class="btn" id="fc-flip">意味を見る</button></div>';
      } else {
        h += '<div class="btn-row"><button class="btn" id="fc-known">覚えた</button><button class="btn sub" id="fc-unknown">まだ</button>' +
          '<button class="btn sub" id="fc-sheet">用語シート</button></div>';
      }
      main.innerHTML = h;
      window.scrollTo(0, 0);
      var fl = document.getElementById('fc-flip');
      if (fl) fl.addEventListener('click', function () { flipped = true; draw(); });
      var kn = document.getElementById('fc-known');
      if (kn) kn.addEventListener('click', function () { judge(true); });
      var un = document.getElementById('fc-unknown');
      if (un) un.addEventListener('click', function () { judge(false); });
      var sh = document.getElementById('fc-sheet');
      if (sh) sh.addEventListener('click', function () { A.openTerm(t.term); });
    }
    function judge(known) {
      var t = cards[i];
      S.state.termStudy[t.id] = { known: known, ts: Date.now() };
      S.save();
      rankUpToast();
      i++; flipped = false; draw();
    }
    draw();
  }

  /* ---------------- 辞書 ---------------- */
  var dictShown = 100;
  function renderDict(prefill) {
    A.setTitle('辞書');
    var h = '<div class="search-box"><input id="dict-q" type="search" placeholder="用語・読み・定義で検索" value="' + esc(prefill || '') + '">' +
      '<button class="btn" id="dict-go">検索</button></div>' +
      '<p class="muted small" id="dict-count"></p><div id="dict-list"></div>' +
      '<div class="btn-row"><button class="btn sub" id="dict-more">続きを表示</button></div>';
    document.getElementById('app-main').innerHTML = h;
    function filtered() {
      var q = (document.getElementById('dict-q').value || '').trim();
      if (!q) return D.glossary;
      return D.glossary.filter(function (t) {
        return t.term.indexOf(q) >= 0 || (t.reading && t.reading.indexOf(q) >= 0) ||
          (t.definition && t.definition.indexOf(q) >= 0);
      });
    }
    function draw() {
      var list = filtered();
      document.getElementById('dict-count').textContent = list.length + '語';
      var slice = list.slice(0, dictShown);
      document.getElementById('dict-list').innerHTML = slice.map(function (t) {
        return '<button class="term-row" data-dterm="' + esc(t.term) + '"><span class="t-term">' + esc(t.term) + '</span>' +
          '<span class="t-read">' + esc(t.reading || '') + '</span><span class="t-gloss">' + esc(t.gloss || '') + '</span></button>';
      }).join('') || '<p class="muted">見つかりませんでした。</p>';
      document.getElementById('dict-more').style.display = list.length > dictShown ? '' : 'none';
      document.querySelectorAll('[data-dterm]').forEach(function (el) {
        el.addEventListener('click', function () { A.openTerm(el.getAttribute('data-dterm')); });
      });
    }
    document.getElementById('dict-go').addEventListener('click', function () { dictShown = 100; draw(); });
    document.getElementById('dict-q').addEventListener('input', function () { dictShown = 100; draw(); });
    document.getElementById('dict-more').addEventListener('click', function () { dictShown += 100; draw(); });
    draw();
  }

  /* ---------------- 年号カード ---------------- */
  function renderYearsSetup() {
    A.setTitle('年号カード');
    var eras = ['原始・古代', '中世', '近世', '近代', '現代'];
    var h = '<div class="card"><h3>出題方向</h3><div class="seg" id="yr-dir">' +
      '<button data-v="y2e" class="on">年号→出来事</button><button data-v="e2y">出来事→年号</button><button data-v="mix">ミックス</button></div>' +
      '<h3 style="margin-top:14px">時代</h3><div class="chips" id="yr-era">' +
      '<button class="chip on" data-e="">すべて</button>' +
      eras.map(function (e) {
        var n = D.years.filter(function (y) { return window.JHData.eraBucket(y.year) === e; }).length;
        return '<button class="chip" data-e="' + e + '">' + e + '（' + n + '）</button>';
      }).join('') + '</div>' +
      '<h3 style="margin-top:14px">単元</h3><select class="fsel" id="yr-unit"><option value="">すべての単元</option>' +
      D.texts.map(function (t) { return '<option value="' + t.unit_id + '">' + t.unit_id + ' ' + esc(t.title) + '</option>'; }).join('') + '</select>' +
      '<div class="btn-row"><button class="btn" id="yr-start">カードを開始</button></div></div>';
    document.getElementById('app-main').innerHTML = h;
    var dir = 'y2e', era = '';
    document.querySelectorAll('#yr-dir button').forEach(function (el) {
      el.addEventListener('click', function () {
        dir = el.getAttribute('data-v');
        document.querySelectorAll('#yr-dir button').forEach(function (b) { b.classList.toggle('on', b === el); });
      });
    });
    document.querySelectorAll('#yr-era .chip').forEach(function (el) {
      el.addEventListener('click', function () {
        era = el.getAttribute('data-e');
        document.querySelectorAll('#yr-era .chip').forEach(function (b) { b.classList.toggle('on', b === el); });
      });
    });
    document.getElementById('yr-start').addEventListener('click', function () {
      var unit = document.getElementById('yr-unit').value;
      var pool = D.years.filter(function (y) {
        if (era && window.JHData.eraBucket(y.year) !== era) return false;
        if (unit && (y.unit || '').indexOf(unit) !== 0) return false;
        return true;
      });
      if (!pool.length) { A.toast('対象の年号がありません'); return; }
      runYearCards(window.JHData.shuffle(pool), dir, '年号カード');
    });
  }

  function yearKey(y, dir) { return y.year + '|' + y.event + '|' + dir; }

  function runYearCards(cards, dirMode, title) {
    var i = 0, flipped = false;
    A.setTitle(title + '（' + cards.length + '件）');
    function dirFor(y) {
      if (dirMode !== 'mix') return dirMode;
      return (Math.abs(y.year * 31 + i * 7) % 2 === 0) ? 'y2e' : 'e2y';
    }
    function draw() {
      if (i >= cards.length) {
        document.getElementById('app-main').innerHTML = '<div class="card"><h3>カード終了</h3><p>' + cards.length + '件を確認しました。</p>' +
          '<div class="btn-row"><button class="btn" id="yc-home">ホームへ戻る</button></div></div>';
        document.getElementById('yc-home').addEventListener('click', function () { A.goHome(); });
        return;
      }
      var y = cards[i];
      var dir = dirFor(y);
      var front = dir === 'y2e'
        ? '<div class="fc-term">' + y.year + '年</div><div class="fc-read">' + esc(y.japanese_era || '') + '</div>'
        : '<div class="fc-term" style="font-size:1.25em">' + esc(y.event) + '</div>';
      var back = '';
      if (flipped) {
        back = dir === 'y2e'
          ? '<div class="fc-def"><strong>' + esc(y.event) + '</strong></div>'
          : '<div class="fc-def"><strong>' + y.year + '年</strong>（' + esc(y.japanese_era || '') + '）</div>';
        if (y.goro) {
          back += '<div class="fc-def">語呂：' + esc(y.goro.phrase) + V.goroBadge(y.goro) +
            (y.goro.note ? '<br><span class="small muted">' + esc(y.goro.note) + '</span>' : '') + '</div>';
        } else {
          back += '<div class="fc-def small muted">語呂はありません。時代：' + esc(window.JHData.eraBucket(y.year)) +
            '／単元：' + esc((y.unit || '').split(' ')[0]) + '</div>';
        }
        if (y.notes) back += '<div class="fc-def small">' + esc(y.notes) + '</div>';
        if (y.certainty && y.certainty !== '確定') back += '<div class="fc-def"><span class="badge warn">' + esc(y.certainty) + '</span></div>';
      }
      var h = '<div class="qmeta"><span>' + (i + 1) + ' / ' + cards.length + '</span><span>' + (dir === 'y2e' ? '年号→出来事' : '出来事→年号') + '</span></div>' +
        '<div class="flashcard">' + front + (flipped ? back : '<p class="muted">タップで答えを表示</p>') + '</div>';
      if (!flipped) h += '<div class="btn-row"><button class="btn" id="yc-flip">答えを見る</button></div>';
      else h += '<div class="btn-row"><button class="btn" id="yc-known">思い出せた</button><button class="btn sub" id="yc-unknown">分からなかった</button></div>';
      document.getElementById('app-main').innerHTML = h;
      window.scrollTo(0, 0);
      var fl = document.getElementById('yc-flip');
      if (fl) fl.addEventListener('click', function () { flipped = true; draw(); });
      var kn = document.getElementById('yc-known');
      if (kn) kn.addEventListener('click', function () { judge(true); });
      var un = document.getElementById('yc-unknown');
      if (un) un.addEventListener('click', function () { judge(false); });
      function judge(known) {
        var key = yearKey(y, dir);
        S.state.yearSelf[key] = { known: known, ts: Date.now() };
        S.recordYearAttempt({ key: key, year: y.year, dir: dir, correct: known, ts: Date.now() });
        rankUpToast();
        i++; flipped = false; draw();
      }
    }
    draw();
  }

  /* ---------------- 想起ドリル ---------------- */
  function startRecall() {
    var pool = D.glossary.filter(function (t) { return t.definition && t.status === 'verified'; });
    if (pool.length < 4) { A.toast('対象の用語が不足しています'); return; }
    var session = window.JHData.shuffle(pool).slice(0, S.state.settings.sessionSize);
    var i = 0, score = 0, answered = false;
    A.setTitle('用語想起ドリル');
    function draw() {
      var main = document.getElementById('app-main');
      if (i >= session.length) {
        main.innerHTML = '<div class="card"><h3>結果</h3><p style="font-size:1.4em;font-weight:700">' + score + ' / ' + session.length + ' 問正解</p>' +
          '<div class="btn-row"><button class="btn" id="rc-home">ホームへ戻る</button></div></div>';
        document.getElementById('rc-home').addEventListener('click', function () { A.goHome(); });
        return;
      }
      var t = session[i];
      var distract = window.JHData.shuffle(pool.filter(function (x) {
        return x.term !== t.term && x.category === t.category;
      })).slice(0, 3);
      if (distract.length < 3) {
        distract = distract.concat(window.JHData.shuffle(pool.filter(function (x) {
          return x.term !== t.term && x.category !== t.category;
        })).slice(0, 3 - distract.length));
      }
      var choices = window.JHData.shuffle([t].concat(distract));
      var h = '<div class="qmeta"><span>' + (i + 1) + ' / ' + session.length + '</span><span class="idlabel">' + esc(t.id) + '</span></div>' +
        '<div class="card"><p class="muted small">次の説明に当てはまる用語はどれか。</p><p style="font-weight:600">' + esc(t.definition) + '</p></div>' +
        '<div class="choices">' + choices.map(function (c, ci) {
          return '<button class="choice" data-rc="' + esc(c.term) + '"><span class="mark">' + 'ABCD'[ci] + '</span>' + esc(c.term) + '</button>';
        }).join('') + '</div><div id="rc-after"></div>';
      main.innerHTML = h;
      window.scrollTo(0, 0);
      answered = false;
      main.querySelectorAll('[data-rc]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (answered) return;
          answered = true;
          var ok = btn.getAttribute('data-rc') === t.term;
          if (ok) score++;
          S.recordAttempt({ kind: 'recall', id: t.id, correct: ok, ts: Date.now(), unit: '', topic: '想起ドリル', type: '想起', difficulty: '' });
          main.querySelectorAll('[data-rc]').forEach(function (b) {
            b.disabled = true;
            if (b.getAttribute('data-rc') === t.term) b.classList.add('correct');
            else if (b === btn) b.classList.add('wrong');
          });
          document.getElementById('rc-after').innerHTML =
            '<div class="judge ' + (ok ? 'ok' : 'ng') + '">' + (ok ? '○ 正解' : '✕ 不正解') + '</div>' +
            '<div class="chips"><button class="chip term" data-term="' + esc(t.term) + '">' + esc(t.term) + ' の用語シート</button></div>' +
            '<div class="btn-row"><button class="btn" id="rc-next">' + (i + 1 >= session.length ? '結果を見る' : '次へ') + '</button></div>';
          document.querySelectorAll('#rc-after [data-term]').forEach(function (el) {
            el.addEventListener('click', function () { A.openTerm(el.getAttribute('data-term')); });
          });
          document.getElementById('rc-next').addEventListener('click', function () { i++; draw(); });
        });
      });
    }
    A.push(draw, '用語想起ドリル');
  }

  /* ---------------- テーマ史 ---------------- */
  function renderThemes() {
    A.setTitle('テーマ史セット');
    var h = '<p class="muted small">テーマごとに問題を集めた通史演習です（既存問題の再編成）。</p>';
    window.JHData.THEMES.forEach(function (th) {
      var n = D.hs.filter(function (q) { return window.JHData.themeOf(q) === th.name; }).length;
      h += '<button class="unit-row" data-theme="' + esc(th.name) + '"><span class="u-t">' + esc(th.name) + '</span><span class="u-c">' + n + '問</span></button>';
    });
    document.getElementById('app-main').innerHTML = h;
    document.querySelectorAll('[data-theme]').forEach(function (el) {
      el.addEventListener('click', function () {
        var name = el.getAttribute('data-theme');
        var pool = window.JHData.prioritise(D.hs.filter(function (q) { return window.JHData.themeOf(q) === name; }), 'hs');
        var items = pool.slice(0, S.state.settings.sessionSize).map(function (q) { return { kind: 'hs', id: q.id }; });
        A.push(function () { window.JHQuiz.start({ title: 'テーマ史｜' + name, items: items, mode: 'theme' }); }, 'テーマ史');
      });
    });
  }

  /* ---------------- 豆知識 ---------------- */
  var STATUS_LABEL = { verified: '検証済み', tradition: '伝承', disputed: '諸説あり', legend: '伝承' };
  function renderTrivia(focusId) {
    A.setTitle('豆知識');
    var list = focusId ? D.trivia.filter(function (t) { return t.id === focusId; }) : D.trivia;
    var h = list.map(function (t) {
      var lbl = STATUS_LABEL[t.epistemic_status] || t.epistemic_status || '';
      return '<div class="card" id="trv-' + esc(t.id) + '"><h3>' + esc(t.title) +
        ' <span class="badge ' + (t.epistemic_status === 'verified' ? 'trad' : 'warn') + '">' + esc(lbl) + '</span></h3>' +
        '<p class="small muted">' + esc(t.id) + '／' + esc(t.category || '') + '</p>' +
        '<p style="white-space:pre-wrap">' + esc(t.body || '') + '</p>' +
        (t.why_interesting ? '<p class="small"><strong>なぜ面白いか：</strong>' + esc(t.why_interesting) + '</p>' : '') +
        (t.references ? '<p class="small muted">出典：' + esc(Array.isArray(t.references) ? t.references.join('／') : t.references) + '</p>' : '') +
        '</div>';
    }).join('');
    document.getElementById('app-main').innerHTML = h;
    if (focusId) {
      var el = document.getElementById('trv-' + focusId);
      if (el) setTimeout(function () { el.scrollIntoView(); }, 40);
    } else window.scrollTo(0, 0);
  }

  /* ---------------- 復習リスト ---------------- */
  function renderReview() {
    A.setTitle('復習リスト');
    var qm = S.questionReviewMap();
    var ym = S.yearReviewMap();
    var qItems = [], yItems = [];
    Object.keys(qm).forEach(function (key) {
      var st = qm[key];
      if (st.state === 'graduated' || st.state === 'new') return;
      var parts = key.split(':');
      qItems.push({ kind: parts[0], id: parts[1], st: st });
    });
    Object.keys(ym).forEach(function (key) {
      var st = ym[key];
      if (st.state === 'graduated' || st.state === 'new') return;
      yItems.push({ key: key, st: st });
    });
    qItems.sort(function (a, b) { return (b.st.due - a.st.due) || ((a.st.nextDue || 0) - (b.st.nextDue || 0)); });
    yItems.sort(function (a, b) { return (b.st.due - a.st.due) || ((a.st.nextDue || 0) - (b.st.nextDue || 0)); });
    function dueLabel(st) {
      if (st.due) return '<span class="badge warn">期限到来</span>';
      if (st.nextDue) return '<span class="badge auto">次回 ' + new Date(st.nextDue).toLocaleDateString('ja-JP') + '</span>';
      return '';
    }
    var h = '';
    var dueQ = qItems.filter(function (x) { return x.st.due; });
    h += '<div class="card"><h3>問題の復習（' + qItems.length + '件／期限到来 ' + dueQ.length + '件）</h3>' +
      '<p class="muted small">卒業条件は2回連続正解です。1回正解すると翌日に再出題候補になります。</p>' +
      (dueQ.length ? '<button class="btn" id="rv-start">期限到来分を復習する（' + dueQ.length + '件）</button>' : '<p class="muted">期限到来分はありません。</p>') + '</div>';
    if (qItems.length) {
      h += '<div class="card"><h3>復習対象の一覧</h3>' + qItems.map(function (x) {
        return '<div class="bar-row"><span class="b-lbl">' + esc(x.id) + '</span><span class="b-val" style="min-width:9em">' +
          (x.st.state === 'due' ? '要復習' : '連続正解 ' + x.st.streak + '回') + '</span>' + dueLabel(x.st) + '</div>';
      }).join('') + '</div>';
    }
    var dueY = yItems.filter(function (x) { return x.st.due; });
    h += '<div class="card"><h3>年号カードの復習（' + yItems.length + '件／期限到来 ' + dueY.length + '件）</h3>' +
      (dueY.length ? '<button class="btn" id="rv-year">期限到来分を復習する</button>' : '<p class="muted">期限到来分はありません。</p>') + '</div>';
    if (!qItems.length && !yItems.length) {
      h += '<div class="card"><p>復習対象はまだありません。問題を解くと、間違えた問題がここに集まります。</p></div>';
    }
    document.getElementById('app-main').innerHTML = h;
    var rs = document.getElementById('rv-start');
    if (rs) rs.addEventListener('click', function () {
      var items = dueQ.map(function (x) { return { kind: x.kind, id: x.id }; });
      A.push(function () { window.JHQuiz.start({ title: '復習', items: items, mode: 'review' }); }, '復習');
    });
    var ry = document.getElementById('rv-year');
    if (ry) ry.addEventListener('click', function () {
      A.push(function () { runYearCardsReview(dueY); }, '年号カード復習');
    });
  }

  function runYearCardsReview(dueY) {
    // dueY: [{key:'year|event|dir'}] をカード化する
    var cards = dueY.map(function (x) {
      var parts = x.key.split('|');
      var rec = D.years.filter(function (y) { return String(y.year) === parts[0] && y.event === parts[1]; })[0];
      return rec ? { rec: rec, dir: parts[2] } : null;
    }).filter(Boolean);
    if (!cards.length) { A.toast('対象がありません'); return; }
    var i = 0, flipped = false;
    A.setTitle('年号カード復習（' + cards.length + '件）');
    function draw() {
      if (i >= cards.length) {
        document.getElementById('app-main').innerHTML = '<div class="card"><h3>復習終了</h3><div class="btn-row"><button class="btn" id="yr-home">ホームへ戻る</button></div></div>';
        document.getElementById('yr-home').addEventListener('click', function () { A.goHome(); });
        return;
      }
      var c = cards[i], y = c.rec;
      var front = c.dir === 'y2e' ? '<div class="fc-term">' + y.year + '年</div>' : '<div class="fc-term" style="font-size:1.25em">' + esc(y.event) + '</div>';
      var back = '';
      if (flipped) {
        back = '<div class="fc-def"><strong>' + (c.dir === 'y2e' ? esc(y.event) : y.year + '年') + '</strong></div>' +
          (y.goro ? '<div class="fc-def">語呂：' + esc(y.goro.phrase) + V.goroBadge(y.goro) + '</div>' : '');
      }
      var h = '<div class="qmeta"><span>' + (i + 1) + ' / ' + cards.length + '</span></div>' +
        '<div class="flashcard">' + front + (flipped ? back : '<p class="muted">タップで答えを表示</p>') + '</div>' +
        (flipped
          ? '<div class="btn-row"><button class="btn" id="yr-known">思い出せた</button><button class="btn sub" id="yr-unknown">分からなかった</button></div>'
          : '<div class="btn-row"><button class="btn" id="yr-flip">答えを見る</button></div>');
      document.getElementById('app-main').innerHTML = h;
      var fl = document.getElementById('yr-flip');
      if (fl) fl.addEventListener('click', function () { flipped = true; draw(); });
      var kn = document.getElementById('yr-known');
      if (kn) kn.addEventListener('click', function () { judge(true); });
      var un = document.getElementById('yr-unknown');
      if (un) un.addEventListener('click', function () { judge(false); });
      function judge(known) {
        var key = y.year + '|' + y.event + '|' + c.dir;
        S.state.yearSelf[key] = { known: known, ts: Date.now() };
        S.recordYearAttempt({ key: key, year: y.year, dir: c.dir, correct: known, ts: Date.now() });
        rankUpToast();
        i++; flipped = false; draw();
      }
    }
    draw();
  }

  /* ---------------- 成績 ---------------- */
  function renderStats() {
    A.setTitle('成績');
    var atts = S.state.attempts;
    var total = atts.length, correct = atts.filter(function (a) { return a.correct; }).length;
    var ri = S.rankInfo();
    var h = '<div class="card rank-summary"><h3>称号</h3>' +
      '<div class="hr-rank-name">' + esc(ri.title.name) + '</div>' +
      '<p style="margin:6px 0 0">学習ポイント：' + ri.breakdown.total + '（問題 ' + ri.breakdown.questions + '種・用語 ' + ri.breakdown.terms + '語・年号 ' + ri.breakdown.years + '件）</p>' +
      (ri.next
        ? '<p class="muted small" style="margin:4px 0 0">次の称号「' + esc(ri.next.name) + '」まで あと ' + ri.toNext + ' ポイント</p>'
        : '<p class="muted small" style="margin:4px 0 0">最高ランクに到達しています</p>') +
      '<div class="btn-row"><button class="btn sub" id="st-titles">称号の一覧を見る</button></div></div>';
    h += '<div class="card"><h3>概要</h3><p>問題への回答：' + total + '回（正答率 ' +
      (total ? Math.round(correct / total * 100) : 0) + '%）<br>年号カード：' + S.state.yearAttempts.length + '回<br>' +
      '単語帳で「覚えた」：' + Object.keys(S.state.termStudy).filter(function (k) { return S.state.termStudy[k].known; }).length + '語</p></div>';
    function groupHtml(title, keyFn, filterKinds) {
      var map = {};
      atts.forEach(function (a) {
        if (filterKinds && filterKinds.indexOf(a.kind) < 0) return;
        var k = keyFn(a) || '―';
        map[k] = map[k] || { total: 0, correct: 0 };
        map[k].total++; if (a.correct) map[k].correct++;
      });
      var keys = Object.keys(map).sort(function (a, b) { return map[b].total - map[a].total; });
      if (!keys.length) return '';
      var s = '<div class="card"><h3>' + esc(title) + '</h3>';
      keys.slice(0, 20).forEach(function (k) {
        var v = map[k], pct = Math.round(v.correct / v.total * 100);
        s += '<div class="bar-row"><span class="b-lbl">' + esc(k) + '</span><span class="b-bar"><span style="display:block;width:' + pct + '%;height:100%"></span></span>' +
          '<span class="b-val">' + v.correct + '/' + v.total + '（' + pct + '%）</span></div>';
      });
      return s + '</div>';
    }
    h += groupHtml('単元別', function (a) { return a.unit; }, ['hs']);
    h += groupHtml('モード別', function (a) {
      return { hs: '高校問題', jhs: '中学復習', cloze: '穴埋め', recall: '想起ドリル' }[a.kind] || a.kind;
    });
    h += groupHtml('分野別（上位20）', function (a) { return a.topic; }, ['hs', 'jhs']);
    h += groupHtml('形式別', function (a) { return a.type; }, ['hs']);
    h += groupHtml('難易度別', function (a) { return a.difficulty; }, ['hs', 'jhs']);
    // 週次推移（直近8週）
    var now = Date.now();
    var rows = '';
    for (var w = 7; w >= 0; w--) {
      var start = now - (w + 1) * 7 * S.DAY, end = now - w * 7 * S.DAY;
      var inWeek = atts.filter(function (a) { return a.ts >= start && a.ts < end; });
      var c = inWeek.filter(function (a) { return a.correct; }).length;
      var d = new Date(start);
      rows += '<tr><td>' + (d.getMonth() + 1) + '/' + d.getDate() + '〜</td><td>' + inWeek.length + '</td><td>' +
        (inWeek.length ? Math.round(c / inWeek.length * 100) + '%' : '―') + '</td></tr>';
    }
    h += '<div class="card"><h3>週ごとの推移（直近8週）</h3><table class="trend"><tr><th>週</th><th>回答数</th><th>正答率</th></tr>' + rows + '</table></div>';
    // 苦手な単元（3回以上・正答率70%未満）
    var unitMap = {};
    atts.forEach(function (a) {
      if (a.kind !== 'hs' || !a.unit) return;
      unitMap[a.unit] = unitMap[a.unit] || { total: 0, correct: 0 };
      unitMap[a.unit].total++; if (a.correct) unitMap[a.unit].correct++;
    });
    var weakUnits = Object.keys(unitMap).filter(function (u) {
      var v = unitMap[u]; return v.total >= 3 && v.correct / v.total < 0.7;
    });
    if (weakUnits.length) {
      h += '<div class="card"><h3>苦手な単元</h3><p>' + weakUnits.map(function (u) {
        var v = unitMap[u];
        return esc(u) + '（' + v.correct + '/' + v.total + '）';
      }).join('、') + '</p></div>';
    }
    document.getElementById('app-main').innerHTML = h;
    window.scrollTo(0, 0);
    var stb = document.getElementById('st-titles');
    if (stb) stb.addEventListener('click', function () { A.push(V.renderTitles, '称号'); });
  }

  window.JHViews2 = {
    renderExamSetup: renderExamSetup, startMock: startMock,
    renderJhsSetup: renderJhsSetup, renderClozeSetup: renderClozeSetup,
    renderCardsSetup: renderCardsSetup, renderDict: renderDict,
    renderYearsSetup: renderYearsSetup, startRecall: startRecall,
    renderThemes: renderThemes, renderTrivia: renderTrivia,
    renderReview: renderReview, renderStats: renderStats,
    runYearCards: runYearCards
  };
})();
