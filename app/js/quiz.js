/* quiz.js — クイズランナー（単元テスト／入試問題／中学復習／穴埋め／復習／模試／関連問題ジャンプ）
 * 通常モード: 回答直後に詳細解説を表示。模試モード: 全問回答後にまとめて採点する。
 * 進行中セッションは localStorage に保存され、再開できる。 */
(function () {
  'use strict';
  var D = window.JHData.D;
  var esc = window.JHData.esc;
  var S = window.JHStore;

  var cur = null; // {title, items, idx, answers, flags, mock, mode}

  function getQ(item) {
    if (item.kind === 'hs') return D.hsById[item.id];
    if (item.kind === 'jhs') return D.jhsById[item.id];
    if (item.kind === 'cloze') return D.clozeById[item.id];
    return null;
  }

  function qText(q, item) {
    if (item.kind === 'cloze') return q.text;
    return q.question.text;
  }

  function qChoices(q, item) {
    if (item.kind === 'cloze') {
      return q.choices.map(function (c, i) {
        return { id: 'ABCD'[i], text: c.text, is_correct: c.is_correct };
      });
    }
    return q.choices;
  }

  function qImage(q, item) {
    if (item.kind === 'cloze') return null;
    var idata = q.question.image_data;
    if (!q.question.has_image || !idata) return null;
    return idata;
  }

  function metaOf(q, item) {
    if (item.kind === 'cloze') {
      return { unit: q.unit, topic: '穴埋め', type: 'cloze', difficulty: '' };
    }
    return {
      unit: (q.unit || '').split(' ')[0] || '',
      topic: q.topic || '',
      type: window.JHData.typeLabel(q),
      difficulty: q.difficulty || ''
    };
  }

  /* 称号ランクアップ時の祝福表示（記録の直後に呼ぶ） */
  function rankUpToast() {
    var up = S.checkRankUp();
    if (up) {
      window.JHApp.rankUpToast(up); // トースト＋金粉・桜の祝福アニメーション
    }
  }

  function record(item, correct) {
    var q = getQ(item);
    var m = metaOf(q, item);
    S.recordAttempt({
      kind: item.kind, id: item.id, correct: correct, ts: Date.now(),
      unit: m.unit, topic: m.topic, type: m.type, difficulty: m.difficulty
    });
  }

  function persist() {
    if (!cur) { S.state.session = null; S.save(); return; }
    S.state.session = {
      title: cur.title, items: cur.items, idx: cur.idx,
      answers: cur.answers, flags: cur.flags, mock: cur.mock, mode: cur.mode
    };
    S.save();
  }

  function start(opts) {
    cur = {
      title: opts.title || '問題',
      items: opts.items,
      idx: 0,
      answers: {},
      flags: {},
      mock: !!opts.mock,
      mode: opts.mode || 'quiz'
    };
    persist();
    render();
  }

  function resume(sess) {
    cur = {
      title: sess.title, items: sess.items, idx: sess.idx || 0,
      answers: sess.answers || {}, flags: sess.flags || {},
      mock: !!sess.mock, mode: sess.mode || 'quiz'
    };
    render();
  }

  function imageHtml(q, item) {
    var idata = qImage(q, item);
    if (!idata) return '';
    var cap = esc(idata.title || '') +
      (idata.license ? '（' + esc(idata.license) + (idata.source_org ? '／' + esc(idata.source_org) : '') + '）' : '');
    if (idata.kind === 'diagram') {
      var svg = D.svgs[idata.file] || '';
      return '<figure class="qimg"><div class="svgbox" data-viewer-svg="' + esc(idata.file) + '">' + svg + '</div>' +
        '<figcaption>' + cap + '（タップで拡大）</figcaption></figure>';
    }
    if (idata.kind === 'photo') {
      var url = window.JHData.photoUrl(idata.file, 1024);
      return '<figure class="qimg"><img src="' + url + '" alt="' + esc(idata.title || '') + '" loading="lazy" data-viewer-img="' + esc(idata.file) + '">' +
        '<figcaption>' + cap + '（タップで拡大）</figcaption></figure>';
    }
    return '<p class="small"><a href="' + esc(idata.url) + '" target="_blank" rel="noopener">資料を見る：' + cap + '</a></p>';
  }

  function explainHtml(q, item, pickedId) {
    if (item.kind === 'cloze') {
      // 穴埋めは暗記シートの対象外（.no-mask: 中のリンク語句は通常表示・通常動作のまま）
      return '<div class="explain no-mask"><h4>解説（自動生成）</h4>' +
        '<p>空欄に入るのは「' + esc(q.answer) + '」です。</p>' +
        '<p class="small muted">元の文：' + window.JHData.linkTerms(q.source_point) + '</p>' +
        '<div class="chips"><button class="chip term" data-term="' + esc(q.answer) + '">' + esc(q.answer) + ' の用語解説</button>' +
        '<button class="chip" data-goto-section="' + esc(q.section_ref) + '">テキストで確認する</button></div></div>';
    }
    var ex = q.explanation || {};
    var h = '<div class="explain">';
    if (ex.summary) h += '<h4>要点</h4><p>' + window.JHData.linkTerms(ex.summary) + '</p>';
    if (ex.detailed) h += '<h4>詳しい解説</h4><p>' + window.JHData.linkTerms(ex.detailed) + '</p>';
    var reasons = ex.incorrect_reasons || {};
    var keys = Object.keys(reasons);
    if (keys.length) {
      h += '<h4>他の選択肢について</h4><ul class="why-list">';
      q.choices.forEach(function (c) {
        if (reasons[c.id]) h += '<li>「' + esc(c.text) + '」― ' + window.JHData.linkTerms(reasons[c.id]) + '</li>';
      });
      h += '</ul>';
    }
    if (ex.key_terms && ex.key_terms.length) {
      h += '<h4>キーターム</h4><div class="chips">';
      ex.key_terms.forEach(function (t) {
        h += '<button class="chip term" data-term="' + esc(t) + '">' + esc(t) + '</button>';
      });
      h += '</div>';
    }
    if (ex.cross_reference) {
      h += '<h4>関連</h4><p class="small">' + esc(ex.cross_reference) + '</p>';
      var m = /U\d{2}-S\d+/.exec(ex.cross_reference);
      var unit = (q.unit || '').split(' ')[0];
      if (unit) {
        h += '<div class="chips"><button class="chip" data-goto-section="' + esc(m ? m[0] : unit) + '">単元テキストを開く</button></div>';
      }
    }
    var sp = q.source_provenance || {};
    var prov = [];
    if (sp.primary_historical_source) prov.push('史料・出典：' + esc(sp.primary_historical_source));
    if (sp.exam_source) prov.push('出題について：' + esc(sp.exam_source));
    if (sp.archive_ref && sp.archive_ref !== '要登録') {
      if (/^https?:/.test(sp.archive_ref)) prov.push('アーカイブ：<a href="' + esc(sp.archive_ref) + '" target="_blank" rel="noopener">' + esc(sp.archive_ref) + '</a>');
      else prov.push('アーカイブ参照：' + esc(sp.archive_ref));
    }
    if (prov.length) h += '<h4>出典</h4><p class="small muted">' + prov.join('<br>') + '</p>';
    h += '</div>';
    return h;
  }

  function correctChoice(q, item) {
    var cs = qChoices(q, item);
    for (var i = 0; i < cs.length; i++) if (cs[i].is_correct) return cs[i];
    return cs[0];
  }

  function render() {
    var main = document.getElementById('app-main');
    window.JHApp.setTitle(cur.title);
    if (cur.idx >= cur.items.length) { renderResult(); return; }
    var item = cur.items[cur.idx];
    var q = getQ(item);
    if (!q) { cur.idx++; persist(); render(); return; }
    var ans = cur.answers[cur.idx];
    var graded = !cur.mock && ans && ans.graded;
    var total = cur.items.length;
    var rest = graded ? total - cur.idx - 1 : total - cur.idx; // 残り問数（採点済みなら現在の問題を除く）
    var h = '';
    h += '<div class="qmeta"><span>' + (cur.idx + 1) + ' / ' + total + ' 問</span>' +
      '<span class="q-left">あと' + rest + '問</span>' +
      '<span class="idlabel">' + esc(item.id) + '</span>' +
      window.JHApp.maskBtnHtml() +
      '<button class="flag-btn' + (cur.flags[cur.idx] ? ' on' : '') + '" id="q-flag">🚩 見直し</button></span></div>';
    h = h.replace('</span></div>', '</div>');
    var segs = '';
    for (var si = 0; si < total; si++) {
      var scls = si < cur.idx ? 'done' : (si === cur.idx ? (graded ? 'answered' : 'current') : '');
      segs += '<span class="seg' + (scls ? ' ' + scls : '') + '"></span>';
    }
    h += '<div class="segbar" role="progressbar" aria-valuenow="' + (cur.idx + (graded ? 1 : 0)) + '" aria-valuemin="0" aria-valuemax="' + total + '" aria-label="進捗">' + segs + '</div>';
    var m = metaOf(q, item);
    var chips = [];
    if (m.unit) chips.push(m.unit);
    if (m.topic && item.kind !== 'cloze') chips.push(m.topic);
    if (m.type && item.kind !== 'cloze') chips.push(m.type);
    if (m.difficulty) chips.push(m.difficulty);
    if (item.kind === 'cloze') chips.push('穴埋め（自動生成）');
    if (chips.length) h += '<div class="chips">' + chips.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') + '</div>';
    h += imageHtml(q, item);
    h += '<div class="qtext">' + esc(qText(q, item)) + '</div>';
    h += '<div class="choices">';
    qChoices(q, item).forEach(function (c, i) {
      var cls = 'choice';
      if (ans && ans.choiceId === c.id) cls += ' picked';
      var cmark = '';
      if (graded) {
        if (c.is_correct) { cls += ' correct'; cmark = '<span class="cmark ok" aria-label="正解">◯</span>'; }
        else if (ans.choiceId === c.id) { cls += ' wrong'; cmark = '<span class="cmark ng" aria-label="あなたの回答">✕</span>'; }
      }
      h += '<button class="' + cls + '" data-choice="' + esc(c.id) + '"' + (graded ? ' disabled' : '') + '>' +
        '<span class="mark">' + 'ABCD'[i] + '</span>' + esc(c.text) + cmark + '</button>';
    });
    h += '</div>';
    if (graded) {
      var cc = correctChoice(q, item);
      h += '<div class="explain-sheet" id="explain-sheet"><div class="es-grip" aria-hidden="true"></div>' +
        '<div class="judge ' + (ans.correct ? 'ok' : 'ng') + '"><span class="stamp ' + (ans.correct ? 'ok' : 'ng') +
        '" data-mark="' + (ans.correct ? '○' : '✕') + '">' + (ans.correct ? '○' : '✕') + '</span>' +
        (ans.correct ? '正解' : '不正解') + '</div>';
      h += '<p>正解は「' + esc(cc.text) + '」です。</p>';
      h += explainHtml(q, item, ans.choiceId);
      h += '<div class="es-foot"><div class="es-btns">' +
        '<button class="btn sub" id="q-show-question">問題を見る</button>' +
        '<button class="btn" id="q-next">' + (cur.idx + 1 >= total ? '結果を見る' : '次の問題へ') + '</button>' +
        '</div></div></div>';
      // 問題を見る: 解説シートを隠し、背後の問題文・選択肢（◯✕付き・読み取り専用）を表示する
      h += '<div class="explain-return" id="explain-return" hidden>' +
        '<button class="btn" id="q-back-explain">解説に戻る</button></div>';
    } else if (cur.mock) {
      h += '<div class="btn-row">' +
        (cur.idx > 0 ? '<button class="btn sub" id="q-prev">前の問題へ</button>' : '') +
        '<button class="btn" id="q-next">' + (cur.idx + 1 >= total ? '採点する' : '次の問題へ') + '</button></div>' +
        '<p class="small muted">模試モード：解説は採点後に表示されます。制限時間はありません。</p>';
    }
    main.innerHTML = h;
    window.scrollTo(0, 0);

    var flagBtn = document.getElementById('q-flag');
    if (flagBtn) flagBtn.addEventListener('click', function () {
      cur.flags[cur.idx] = !cur.flags[cur.idx];
      if (!cur.flags[cur.idx]) delete cur.flags[cur.idx];
      persist(); render();
    });
    main.querySelectorAll('[data-choice]').forEach(function (btn) {
      btn.addEventListener('click', function () { pick(btn.getAttribute('data-choice')); });
    });
    var next = document.getElementById('q-next');
    if (next) next.addEventListener('click', function () { cur.idx++; persist(); render(); });
    var prev = document.getElementById('q-prev');
    if (prev) prev.addEventListener('click', function () { cur.idx--; persist(); render(); });
    var showQ = document.getElementById('q-show-question');
    if (showQ) showQ.addEventListener('click', function () {
      var sheet = document.getElementById('explain-sheet');
      var ret = document.getElementById('explain-return');
      if (sheet) sheet.style.display = 'none';
      if (ret) ret.hidden = false;
      window.scrollTo(0, 0); // 問題文の先頭から見せる
    });
    var backEx = document.getElementById('q-back-explain');
    if (backEx) backEx.addEventListener('click', function () {
      var sheet = document.getElementById('explain-sheet');
      var ret = document.getElementById('explain-return');
      if (sheet) sheet.style.display = '';
      if (ret) ret.hidden = true;
    });
    bindExplainActions(main);
  }

  function pick(choiceId) {
    var item = cur.items[cur.idx];
    var q = getQ(item);
    var cs = qChoices(q, item);
    var picked = null;
    cs.forEach(function (c) { if (c.id === choiceId) picked = c; });
    if (!picked) return;
    if (cur.mock) {
      cur.answers[cur.idx] = { choiceId: choiceId, correct: !!picked.is_correct };
      persist(); render();
      return;
    }
    cur.answers[cur.idx] = { choiceId: choiceId, correct: !!picked.is_correct, graded: true };
    record(item, !!picked.is_correct);
    rankUpToast();
    persist();
    render();
  }

  function breakdown(rows, keyName) {
    var map = {};
    rows.forEach(function (r) {
      var k = r[keyName] || '―';
      map[k] = map[k] || { total: 0, correct: 0 };
      map[k].total++; if (r.correct) map[k].correct++;
    });
    return map;
  }

  function breakdownHtml(title, map) {
    var keys = Object.keys(map);
    if (!keys.length) return '';
    var h = '<h3>' + esc(title) + '別の内訳</h3>';
    keys.sort().forEach(function (k) {
      var v = map[k];
      var pct = Math.round(v.correct / v.total * 100);
      h += '<div class="bar-row"><span class="b-lbl">' + esc(k) + '</span>' +
        '<span class="b-bar"><span style="display:block;width:' + pct + '%;height:100%;background:var(--moss)"></span></span>' +
        '<span class="b-val">' + v.correct + '/' + v.total + '（' + pct + '%）</span></div>';
    });
    return h;
  }

  function renderResult() {
    var main = document.getElementById('app-main');
    window.JHApp.setTitle(cur.title + '｜結果');
    var rows = [];
    cur.items.forEach(function (item, i) {
      var q = getQ(item);
      var ans = cur.answers[i];
      var correct = !!(ans && ans.correct);
      if (cur.mock) {
        // 模試は結果表示の時点でまとめて記録する（未回答は不正解）
        if (!ans || !ans.recorded) {
          record(item, correct);
          cur.answers[i] = Object.assign({}, ans, { recorded: true });
        }
      }
      var m = metaOf(q, item);
      rows.push({
        item: item, idx: i, correct: correct, flagged: !!cur.flags[i],
        unit: m.unit, topic: m.topic, type: m.type, difficulty: m.difficulty,
        label: item.kind === 'cloze' ? q.answer : (q.question ? q.question.text.slice(0, 40) : item.id)
      });
    });
    if (cur.mock) { persist(); rankUpToast(); }
    var total = rows.length;
    var nCorrect = rows.filter(function (r) { return r.correct; }).length;
    var h = '<div class="card"><h3>結果</h3>' +
      '<p class="big" style="font-size:1.5em;font-weight:700">' + nCorrect + ' / ' + total + ' 問正解（' +
      (total ? Math.round(nCorrect / total * 100) : 0) + '%）</p></div>';
    if (cur.mock) {
      h += '<div class="card">' +
        breakdownHtml('単元', breakdown(rows, 'unit')) +
        breakdownHtml('分野', breakdown(rows, 'topic')) +
        breakdownHtml('形式', breakdown(rows, 'type')) +
        breakdownHtml('難易度', breakdown(rows, 'difficulty')) + '</div>';
    }
    var wrong = rows.filter(function (r) { return !r.correct; });
    var flagged = rows.filter(function (r) { return r.flagged; });
    function listHtml(title, list) {
      if (!list.length) return '';
      var s = '<div class="card"><h3>' + esc(title) + '（' + list.length + '問）</h3>';
      list.forEach(function (r) {
        s += '<button class="unit-row" data-review="' + r.idx + '"><span class="u-t">' +
          (r.correct ? '○' : '✕') + ' ' + esc(r.label) + '</span><span class="u-c">' + esc(r.item.id) + '</span></button>';
      });
      return s + '</div>';
    }
    h += listHtml('🚩 見直しフラグ', flagged);
    h += listHtml('間違えた問題', wrong);
    h += listHtml('全問題', rows);
    h += '<div class="btn-row">' +
      (wrong.length ? '<button class="btn" id="r-retry-wrong">間違えた問題を復習する</button>' : '') +
      '<button class="btn sub" id="r-home">ホームへ戻る</button></div>';
    main.innerHTML = h;
    window.scrollTo(0, 0);
    S.state.session = null; S.save();
    var finished = cur; cur = null;
    main.querySelectorAll('[data-review]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = Number(btn.getAttribute('data-review'));
        renderReview(finished, idx);
      });
    });
    var rw = document.getElementById('r-retry-wrong');
    if (rw) rw.addEventListener('click', function () {
      start({
        title: '間違えた問題の復習',
        items: wrong.map(function (r) { return r.item; }),
        mode: finished.mode
      });
    });
    var home = document.getElementById('r-home');
    if (home) home.addEventListener('click', function () { window.JHApp.goHome(); });
  }

  /* 結果画面から1問の解説を読み直す（記録はしない） */
  function renderReview(sess, idx) {
    var main = document.getElementById('app-main');
    var item = sess.items[idx];
    var q = getQ(item);
    var ans = sess.answers[idx];
    var cc = correctChoice(q, item);
    window.JHApp.setTitle('問題の確認');
    var h = '<div class="qmeta"><span class="idlabel">' + esc(item.id) + '</span>' +
      window.JHApp.maskBtnHtml() + '</div>';
    h += imageHtml(q, item);
    h += '<div class="qtext">' + esc(qText(q, item)) + '</div>';
    h += '<div class="choices">';
    qChoices(q, item).forEach(function (c, i) {
      var cls = 'choice';
      var cmark = '';
      if (c.is_correct) { cls += ' correct'; cmark = '<span class="cmark ok" aria-label="正解">◯</span>'; }
      else if (ans && ans.choiceId === c.id) { cls += ' wrong'; cmark = '<span class="cmark ng" aria-label="あなたの回答">✕</span>'; }
      h += '<button class="' + cls + '" disabled><span class="mark">' + 'ABCD'[i] + '</span>' + esc(c.text) + cmark + '</button>';
    });
    h += '</div>';
    h += '<div class="judge ' + (ans && ans.correct ? 'ok' : 'ng') + '">' +
      (ans ? '<span class="stamp ' + (ans.correct ? 'ok' : 'ng') + '" data-mark="' + (ans.correct ? '○' : '✕') + '">' +
        (ans.correct ? '○' : '✕') + '</span>' + (ans.correct ? '正解でした' : '不正解でした') : '未回答でした') + '</div>';
    h += '<p>正解は「' + esc(cc.text) + '」です。</p>';
    h += explainHtml(q, item, ans && ans.choiceId);
    h += '<div class="btn-row"><button class="btn" id="rv-back">結果に戻る</button></div>';
    main.innerHTML = h;
    window.scrollTo(0, 0);
    bindExplainActions(main);
    document.getElementById('rv-back').addEventListener('click', function () {
      cur = sess; cur.idx = cur.items.length; render();
    });
  }

  function bindExplainActions(root) {
    root.querySelectorAll('[data-term]').forEach(function (el) {
      el.addEventListener('click', function () { window.JHApp.openTerm(el.getAttribute('data-term')); });
    });
    root.querySelectorAll('.termlink').forEach(function (el) {
      el.addEventListener('click', function () { window.JHApp.openTerm(el.getAttribute('data-term')); });
    });
    root.querySelectorAll('[data-goto-section]').forEach(function (el) {
      el.addEventListener('click', function () {
        window.JHApp.openTextSection(el.getAttribute('data-goto-section'));
      });
    });
    root.querySelectorAll('[data-viewer-svg]').forEach(function (el) {
      el.addEventListener('click', function () {
        var file = el.getAttribute('data-viewer-svg');
        window.JHApp.openViewer({ svg: D.svgs[file], title: file });
      });
    });
    root.querySelectorAll('[data-viewer-img]').forEach(function (el) {
      el.addEventListener('click', function () {
        var file = el.getAttribute('data-viewer-img');
        window.JHApp.openViewer({ img: window.JHData.photoUrl(file, 1600), title: file });
      });
    });
  }

  window.JHQuiz = {
    start: start, resume: resume, bindExplainActions: bindExplainActions,
    getQ: getQ, explainHtml: explainHtml, imageHtml: imageHtml,
    isActive: function () { return !!cur; },
    activeMode: function () { return cur ? (cur.mode || '') : ''; },
    /* 関連問題ジャンプを中断して呼び出し元へ戻るための破棄（セッション保存も消す） */
    abandon: function () {
      cur = null;
      try { window.JHStore.state.session = null; window.JHStore.save(); } catch (e) { /* ignore */ }
    }
  };
})();
