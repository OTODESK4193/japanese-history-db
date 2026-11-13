/* data.js — 同梱データの読み込み・索引・共通ヘルパー */
(function () {
  'use strict';

  var D = {
    hs: [], jhs: [], texts: [], glossary: [], years: [], world: [],
    trivia: [], commentaries: [], cloze: [], svgs: {}, places: [], meta: {},
    hsById: {}, jhsById: {}, clozeById: {}, termByName: {}, termById: {},
    textByUnit: {}, triviaById: {}, placeSet: {},
    ready: false
  };

  function fetchJson(name) {
    return fetch('./data/' + name).then(function (r) {
      if (!r.ok) throw new Error(name + ' ' + r.status);
      return r.json();
    });
  }

  function loadAll() {
    return Promise.all([
      fetchJson('questions_hs.json'), fetchJson('questions_jhs.json'),
      fetchJson('texts.json'), fetchJson('glossary.json'),
      fetchJson('years.json'), fetchJson('world.json'),
      fetchJson('trivia.json'), fetchJson('commentaries.json'),
      fetchJson('cloze.json'), fetchJson('svg_texts.json'),
      fetchJson('places.json'), fetchJson('meta.json')
    ]).then(function (res) {
      D.hs = res[0]; D.jhs = res[1]; D.texts = res[2]; D.glossary = res[3];
      D.years = res[4]; D.world = res[5]; D.trivia = res[6];
      D.commentaries = res[7]; D.cloze = res[8]; D.svgs = res[9];
      D.places = res[10]; D.meta = res[11];
      D.hs.forEach(function (q) { D.hsById[q.id] = q; });
      D.jhs.forEach(function (q) { D.jhsById[q.id] = q; });
      D.cloze.forEach(function (q) { D.clozeById[q.id] = q; });
      D.glossary.forEach(function (t) { D.termByName[t.term] = t; D.termById[t.id] = t; });
      D.texts.forEach(function (t) { D.textByUnit[t.unit_id] = t; });
      D.trivia.forEach(function (t) { D.triviaById[t.id] = t; });
      D.places.forEach(function (p) { D.placeSet[p.name] = true; });
      D.ready = true;
      return D;
    });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function photoUrl(file, width) {
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/' +
      encodeURIComponent(file) + '?width=' + (width || 1024);
  }

  function mapsUrl(name) {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(name);
  }

  /* 出題順: 未回答優先 → 回答回数の少ない順 → 同群シャッフル（ホスト型と同じ） */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function attemptCounts(kind) {
    var map = {};
    window.JHStore.state.attempts.forEach(function (a) {
      if (a.kind !== kind) return;
      map[a.id] = (map[a.id] || 0) + 1;
    });
    return map;
  }

  function prioritise(questions, kind) {
    var counts = attemptCounts(kind);
    var groups = {};
    questions.forEach(function (q) {
      var c = counts[q.id] || 0;
      (groups[c] = groups[c] || []).push(q);
    });
    var out = [];
    Object.keys(groups).map(Number).sort(function (a, b) { return a - b; })
      .forEach(function (c) { out = out.concat(shuffle(groups[c])); });
    return out;
  }

  /* 志望レベルによる難易度の優先（入試問題モードの初期並び） */
  function levelRank(q) {
    var lv = window.JHStore.state.settings.targetLevel;
    if (lv === 'hard') return { '難関': 0, '発展': 1, '基礎': 2 }[q.difficulty] || 1;
    return { '基礎': 0, '発展': 1, '難関': 2 }[q.difficulty] || 1;
  }

  /* テーマ史セット（6テーマ）: topic と問題文のキーワードで分類する */
  var THEMES = [
    { name: '外交と対外交流', keys: ['外交', '対外', '貿易', '条約', '遣唐使', '遣隋使', '朝鮮', '中国', '唐', '宋', '元', '明', '清', 'ロシア', 'アメリカ', 'イギリス', 'オランダ', 'ポルトガル', 'スペイン', '国際', '連盟', '国連', '鎖国', '開国', '通商', '朝貢', '冊封', '倭寇', '南蛮', '紅毛', '琉球', '蝦夷', 'アイヌ', '交流'] },
    { name: '政治と制度', keys: ['律令', '官制', '幕府', '将軍', '大名', '藩', '朝廷', '天皇', '摂政', '関白', '院政', '選挙', '議会', '内閣', '憲法', '政党', '元老', '軍部', '統治', '制度', '改革', '維新', '太閤', '検地', '刀狩', '参勤', '身分', '荘園', '守護', '地頭', '封建'] },
    { name: '経済・産業・財政', keys: ['経済', '産業', '財政', '税', '貨幣', '商業', '農業', '工業', '金融', '市場', '価格', '米', '田', '年貢', '租', '庸', '調', '倹約', '享保', '寛政', '天保の改革', '殖産', '富国', '銀行', '会社', '恐慌', '公害', '高度成長', '所得', '貿易'] },
    { name: '社会と民衆の生活', keys: ['社会', '民衆', '生活', '人口', '都市', '村', '町人', '百姓', '一揆', '女性', '婦人', '教育', '学校', '労働', '農民', '文化財', '宗教', '信仰', '仏教', '神道', 'キリスト', '寺', '神社', '災害', '地震', '飢饉', '疫病', '医療', '福祉', '差別', '解放'] },
    { name: '文化・思想・学問', keys: ['文化', '文学', '絵画', '彫刻', '建築', '芸能', '学問', '思想', '国学', '蘭学', '儒学', '朱子学', '陽明学', '歌', '俳諧', '浮世絵', '歌舞伎', '人形浄瑠璃', '茶', '庭園', '書道', '史書', '物語', '日記', '随筆', '演劇', '出版', '新聞', '雑誌'] },
    { name: '戦争と紛争', keys: ['戦争', '戦い', '合戦', '軍', '兵', '侵攻', '占領', '敗戦', '終戦', '原爆', '空襲', '動員', '徴兵', '防人', '元寇', '応仁', '関ヶ原', '大坂の陣', '西南', '日清', '日露', '満州', '太平洋戦争', '第二次世界大戦', '第一次世界大戦', '冷戦', '朝鮮戦争', 'ベトナム'] }
  ];

  function themeOf(q) {
    var hay = (q.topic || '') + ' ' + (q.question && q.question.text || '');
    for (var i = 0; i < THEMES.length; i++) {
      for (var j = 0; j < THEMES[i].keys.length; j++) {
        if (hay.indexOf(THEMES[i].keys[j]) >= 0) return THEMES[i].name;
      }
    }
    return '政治と制度';
  }

  /* 形式の表示名 */
  function typeLabel(q) {
    var t = q.question && q.question.type;
    if (t === 'ordering') return '整序';
    if (t === 'dialogue') return '会話・探究';
    if (t === 'multi_source') return '複数資料';
    if (t === 'map') return '地図・図表';
    if (q.question && q.question.has_image) return '写真・図版';
    return '通常';
  }

  /* 用語リンク: 最長一致で本文中の辞書用語をリンク化する（初出のみ）。
   * 戻り値は HTML 文字列。 */
  var sortedTerms = null;
  function linkTerms(text) {
    if (!text) return '';
    if (!sortedTerms) {
      sortedTerms = D.glossary.map(function (g) { return g.term; })
        .filter(function (t) { return t.length >= 2; })
        .sort(function (a, b) { return b.length - a.length; });
    }
    var matches = []; // {start, end, term}
    var used = {};
    sortedTerms.forEach(function (term) {
      if (used[term]) return;
      var idx = text.indexOf(term);
      if (idx < 0) return;
      // 既存のマッチと重なる場合は、より長い語を優先（sortedTerms は長い順）
      for (var k = 0; k < matches.length; k++) {
        var m = matches[k];
        if (idx < m.end && idx + term.length > m.start) return;
      }
      matches.push({ start: idx, end: idx + term.length, term: term });
      used[term] = true;
    });
    if (!matches.length) return esc(text);
    matches.sort(function (a, b) { return a.start - b.start; });
    var out = '', pos = 0;
    matches.forEach(function (m) {
      out += esc(text.slice(pos, m.start));
      out += '<a class="termlink" data-term="' + esc(m.term) + '">' + esc(m.term) + '</a>';
      pos = m.end;
    });
    out += esc(text.slice(pos));
    return out;
  }

  function unitYears(unitId) {
    return D.years.filter(function (y) {
      return (y.unit || '').indexOf(unitId) === 0;
    }).sort(function (a, b) { return a.year - b.year; });
  }

  function eraBucket(year) {
    if (year < 1185) return '原始・古代';
    if (year < 1603) return '中世';
    if (year < 1868) return '近世';
    if (year < 1945) return '近代';
    return '現代';
  }

  window.JHData = {
    D: D, loadAll: loadAll, esc: esc, photoUrl: photoUrl, mapsUrl: mapsUrl,
    shuffle: shuffle, prioritise: prioritise, levelRank: levelRank,
    THEMES: THEMES, themeOf: themeOf, typeLabel: typeLabel,
    linkTerms: linkTerms, unitYears: unitYears, eraBucket: eraBucket
  };
})();
