/* どうとく「こんなとき どうする？」。Chiid.chiikuDoutoku
   場面の絵（SVG）と文を見て・聞いて、2つから えらぶ。×は付けない。
   のぞましいほう → ほめて星。もう一方 → やさしく理由を伝えて、もう一度えらべる。
   「あなたなら どうする？」の場面は正解なし（どちらも受けとめ、記録しない）。
   園児が見る文字は、ひらがなと記号だけ。通信は行わない。
   画面の部品は game.js が Chiid.chiikuUi として渡す（読み込み順：game.js のあと）。
   名前を Chiid.doutoku にしないのは、勉強アプリの「どうとく」がその名前を使うため。
   場面の言葉は docs/superpowers/specs/2026-11-10-chiiku-doutoku-design.md（やまとさん承認ずみ）。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'doutoku';
  var ROUND_SIZE = 5;          // 5場面ごとにごほうび画面
  var OPEN_SLOT = 2;           // 5場面のうち3つめを「あなたなら どうする？」にする
  var WAIT_GOOD = 1500;        // ほめたあと、次へ進むまで（ms）
  var OPEN_TAIL = 'おうちの ひとは どうするかな？ きいてみてね。';

  // 絵：[部品, x, y(足もと), 大きさ, オプション]。背景は bg。
  function ch(text, good, reply) { return { text: text, good: !!good, reply: reply }; }
  function op(text, reply) { return { text: text, good: false, reply: reply }; }

  var SCENES = [
    // A. あいさつ
    { id: 'ohayou', group: 'aisatsu', text: 'あさ、ようちえんで せんせいに あったよ。どうする？',
      bg: 'out', pic: [['school', 330, 205, 1], ['sensei', 230, 212, 1.35, { mood: 'happy' }], ['piyo', 110, 212, 1]],
      choices: [ch('「おはよう ございます」と いう', true, 'げんきな あいさつ、すてき！ せんせいも にっこり したよ。'),
        ch('だまって とおりすぎる', false, 'だまっていると、せんせいは ちょっと さみしいかも。「おはよう」って いえたら、すてきだね。')] },
    { id: 'arigatou', group: 'aisatsu', text: 'ともだちが、おとした ぼうしを ひろって くれたよ。どうする？',
      bg: 'out', pic: [['piyo', 120, 212, 1], ['usagi', 260, 212, 1, { mood: 'happy' }], ['hat', 222, 150, 1]],
      choices: [ch('「ありがとう」と いう', true, '「ありがとう」って いわれると、ともだちも うれしいね。'),
        ch('だまって かぶる', false, 'だまっていると、ともだちは「あれ？」って おもうかも。「ありがとう」って いえたら、すてきだね。')] },
    { id: 'gomenne', group: 'aisatsu', text: 'ともだちの えほんを、やぶっちゃった。どうする？',
      bg: 'in', pic: [['piyo', 110, 212, 1, { mood: 'sad' }], ['book', 200, 214, 1, { torn: true }], ['neko', 300, 212, 1, { mood: 'sad' }]],
      choices: [ch('「ごめんね」と いう', true, '「ごめんね」って いえて、えらいね。ともだちも ほっと するよ。'),
        ch('えほんを かくす', false, 'かくすと、ともだちは かなしいかも。「ごめんね」って いえたら、すてきだね。')] },
    { id: 'itadakimasu', group: 'aisatsu', text: 'ごはんの じかんだよ。どうする？',
      bg: 'in', pic: [['piyo', 120, 212, 1, { mood: 'happy' }], ['table', 260, 214, 1, { food: 'bowl' }]],
      choices: [ch('「いただきます」と いってから たべる', true, '「いただきます」、すてき！ つくった ひとも うれしいね。'),
        ch('すぐに たべはじめる', false, 'おなか すいたね。でも、たべる まえに「いただきます」って いえたら、すてきだね。')] },
    { id: 'sayounara', group: 'aisatsu', text: 'ようちえんから かえる じかん。せんせいが「さようなら」って いったよ。どうする？',
      bg: 'eve', pic: [['school', 330, 205, 1], ['sensei', 230, 212, 1.35, { mood: 'happy', wave: true }], ['piyo', 110, 212, 1]],
      choices: [ch('「さようなら」と てを ふる', true, 'すてきな あいさつ！ また あした あおうね。'),
        ch('しらんぷりして かえる', false, 'へんじが ないと、せんせいは さみしいかも。てを ふって「さようなら」って いえたら、すてきだね。')] },
    // B. じゅんばん
    { id: 'suberidai', group: 'junban', text: 'すべりだいに みんなが ならんでいるよ。どうする？',
      bg: 'out', pic: [['slide', 320, 212, 1], ['usagi', 238, 212, 0.9], ['kuma', 178, 212, 0.9], ['piyo', 80, 212, 0.9]],
      choices: [ch('うしろに ならんで まつ', true, 'じゅんばんを まてて、すてき！ もうすぐ ばんが くるよ。'),
        ch('まえに わりこむ', false, 'わりこむと、まっていた ともだちが かなしいかも。うしろに ならぼうね。')] },
    { id: 'buranko', group: 'junban', text: 'ともだちが ずっと ぶらんこに のっているよ。のりたいな。どうする？',
      bg: 'out', pic: [['swing', 270, 214, 1], ['neko', 270, 176, 0.75, { mood: 'happy' }], ['piyo', 100, 212, 1]],
      choices: [ch('「かわって」と たのむ', true, 'ことばで たのめて、すてき！ 「いいよ」って いって くれるかもね。'),
        ch('ぶらんこを ひっぱって とめる', false, 'ひっぱると、ともだちが おちて けがを するかも。「かわって」って たのもうね。')] },
    { id: 'onee-omocha', group: 'junban', text: 'おねえちゃんと、おなじ おもちゃで あそびたく なったよ。どうする？',
      bg: 'in', pic: [['piyo', 110, 212, 1], ['toycar', 200, 214, 1.2], ['onee', 295, 212, 1.15]],
      choices: [ch('「じゅんばんこ しよう。さきに どうぞ」と ゆずる', true, 'ゆずれて、やさしいね！ おねえちゃんも にこにこ。つぎは あなたの ばんだよ。'),
        ch('「さきに つかう！」と ひっぱる', false, 'ひっぱりあうと、ふたりとも かなしく なっちゃうかも。「じゅんばんこ しよう」って いえたら、すてきだね。')] },
    { id: 'onee-papa', group: 'junban', text: 'ぱぱが かえって きたよ。おねえちゃんも あなたも、ぱぱに おはなし したいな。どうする？',
      bg: 'in', pic: [['piyo', 90, 212, 1], ['papa', 210, 212, 1.4, { mood: 'happy' }], ['onee', 320, 212, 1.15, { mood: 'happy' }]],
      choices: [ch('おねえちゃんの おはなしが おわるまで まつ', true, 'まてて、えらいね！ おわったら、ぱぱは あなたの おはなしも ちゃんと きいて くれるよ。'),
        ch('おおきな こえで わりこむ', false, 'いっしょに はなすと、ぱぱは どっちの おはなしも きこえないかも。おねえちゃんが おわるまで まとうね。')] },
    // C. かして・どうぞ・やさしさ
    { id: 'kashite', group: 'kashite', text: 'ともだちの つみきで あそびたいな。どうする？',
      bg: 'in', pic: [['piyo', 110, 212, 1], ['blocks', 215, 214, 1], ['kuma', 300, 212, 1]],
      choices: [ch('「かして」と いう', true, '「かして」って いえて、すてき！'),
        ch('だまって とる', false, 'だまって とると、ともだちは びっくりして かなしいかも。「かして」って いおうね。')] },
    { id: 'douzo', group: 'kashite', text: 'ともだちが「かして」って いったよ。どうする？',
      bg: 'in', pic: [['piyo', 120, 212, 1], ['blocks', 195, 214, 1], ['usagi', 300, 212, 1]],
      choices: [ch('「どうぞ」と かす', true, 'やさしいね！ ともだちも にこにこ だよ。いま つかっているときは「あとでね」でも いいんだよ。'),
        ch('かかえて はなさない', false, 'ひとりじめ すると、ともだちは かなしいかも。「どうぞ」や「あとでね」って いえると いいね。')] },
    { id: 'daijoubu', group: 'kashite', text: 'ともだちが ころんで ないているよ。どうする？',
      bg: 'out', pic: [['piyo', 110, 212, 1], ['neko', 270, 214, 1, { mood: 'cry' }]],
      choices: [ch('「だいじょうぶ？」と こえを かける', true, 'やさしいね！ ともだちも げんきが でるよ。'),
        ch('みないふりを する', false, 'ともだちは いたくて こまっているかも。「だいじょうぶ？」って こえを かけたり、おとなを よんだり できると いいね。')] },
    // D. おかたづけ
    { id: 'katazuke', group: 'katazuke', text: 'あそびおわったよ。おもちゃが いっぱい。どうする？',
      bg: 'in', pic: [['piyo', 90, 212, 1], ['toys', 205, 214, 1], ['toybox', 325, 214, 1]],
      choices: [ch('おもちゃを はこに しまう', true, 'ぴかぴか！ つぎに あそぶときも すぐ みつかるね。'),
        ch('そのままにして いく', false, 'ちらかったままだと、ふんで けがを するかも。はこに しまおうね。')] },
    { id: 'kutsu', group: 'katazuke', text: 'おうちに かえって、くつを ぬいだよ。どうする？',
      bg: 'in', pic: [['door', 320, 214, 1], ['piyo', 120, 212, 1], ['shoes', 225, 216, 1]],
      choices: [ch('くつを そろえる', true, 'きれいに そろって、すてき！'),
        ch('ぬぎっぱなしに する', false, 'くつが ばらばらだと、つまずくかも。そろえておけると いいね。')] },
    { id: 'gomi', group: 'katazuke', text: 'おうちで おかしを たべおわったよ。ふくろが のこったね。どうする？',
      bg: 'in', pic: [['piyo', 100, 212, 1], ['bag', 205, 214, 1], ['trash', 320, 214, 1]],
      choices: [ch('ごみばこに すてる', true, 'すてき！ おへやが きれいに なるね。'),
        ch('ゆかに ぽいっと おく', false, 'ゆかに おいたままだと、おへやが ちらかっちゃう。ごみばこに すてようね。')] },
    { id: 'fuku', group: 'katazuke', text: 'おふろの まえに、ふくを ぬいだよ。どうする？',
      bg: 'in', pic: [['piyo', 100, 212, 1], ['clothes', 205, 214, 1], ['basket', 320, 214, 1]],
      choices: [ch('ぬいだ ふくを かごに いれる', true, 'すてき！ おせんたくが しやすく なるね。'),
        ch('ゆかに ぬぎっぱなしに する', false, 'ゆかに おいたままだと、あらう ふくが どれか わからなく なっちゃうかも。かごに いれようね。')] },
    { id: 'osara', group: 'katazuke', text: 'ごはんを たべおわったよ。どうする？',
      bg: 'in', pic: [['piyo', 110, 212, 1, { mood: 'happy' }], ['table', 260, 214, 1, { food: 'empty' }]],
      choices: [ch('おさらを だいどころへ そっと はこぶ', true, 'おてつだい、ありがとう！ とっても たすかるよ。'),
        ch('そのままにして あそびに いく', false, 'おさらが のこっていると、かたづける ひとが たいへんかも。はこべたら、すてきだね。')] },
    // E. てあらい・みのまわり
    { id: 'tearai', group: 'tearai', text: 'そとから かえったよ。おやつが あるね。どうする？',
      bg: 'in', pic: [['piyo', 100, 212, 1], ['table', 210, 214, 0.8, { food: 'cookie' }], ['sink', 330, 214, 1]],
      choices: [ch('てを あらってから たべる', true, 'すてき！ ばいきんが いなくなったね。'),
        ch('すぐに おやつを たべる', false, 'てには ばいきんが ついているかも。さきに てを あらおうね。')] },
    { id: 'toire', group: 'tearai', text: 'といれが おわったよ。どうする？',
      bg: 'in', pic: [['toilet', 120, 214, 1], ['piyo', 215, 212, 1], ['sink', 325, 214, 1]],
      choices: [ch('てを あらう', true, 'すてき！ てが きれいに なったね。'),
        ch('そのまま あそびに いく', false, 'てに ばいきんが ついているかも。てを あらってから あそぼうね。')] },
    { id: 'hamigaki', group: 'tearai', text: 'ねる じかんだよ。どうする？',
      bg: 'night', pic: [['piyo', 100, 212, 1, { mood: 'sleepy' }], ['brush', 195, 214, 1], ['bed', 315, 214, 1]],
      choices: [ch('はを みがいてから ねる', true, 'ぴかぴかの は、すてき！ むしばに ならないね。'),
        ch('そのまま ねる', false, 'はを みがかないと、むしばに なるかも。みがいてから ねようね。')] },
    { id: 'kushami', group: 'tearai', text: 'はなが むずむず。くしゃみが でそう！ どうする？',
      bg: 'in', pic: [['piyo', 150, 212, 1, { mood: 'sneeze' }], ['sneeze', 195, 160, 1], ['neko', 300, 212, 1]],
      choices: [ch('てや ひじで くちを おさえる', true, 'すてき！ まわりの ひとに ばいきんが とばないね。'),
        ch('そのまま くしゃみを する', false, 'そのままだと、まわりの ひとに ばいきんが とんじゃうかも。くちを おさえようね。')] },
    // F. あぶないこと
    { id: 'douro', group: 'abunai', text: 'ぼーるが どうろに ころがって いったよ。どうする？',
      bg: 'road', pic: [['piyo', 90, 196, 0.9], ['ball', 230, 222, 1], ['car', 345, 234, 1]],
      choices: [ch('とまって、おとなの ひとを よぶ', true, 'とまれて、えらいね！ どうろは くるまが くるから、おとなの ひとに とって もらおうね。'),
        ch('おいかけて どうろに でる', false, 'どうろは くるまが きて あぶないよ。とまって、おとなの ひとを よぼうね。')] },
    { id: 'shingou', group: 'abunai', text: 'しんごうが あかだよ。どうする？',
      bg: 'road', pic: [['piyo', 110, 196, 0.9], ['signal', 220, 196, 1], ['car', 330, 234, 1]],
      choices: [ch('とまって、あおに なるのを まつ', true, 'とまれて、えらいね！ あおに なったら、みぎと ひだりを みて わたろうね。'),
        ch('はしって わたる', false, 'あかの ときは、くるまが きて あぶないよ。あおに なるまで まとうね。')] },
    { id: 'shiranai', group: 'abunai', text: 'しらない ひとが「おかし あげるから、いっしょに いこう」って いったよ。どうする？',
      bg: 'out', pic: [['piyo', 110, 212, 1], ['hito', 280, 212, 1], ['bag', 246, 150, 0.6]],
      choices: [ch('「いかない！」と おおきな こえで いって、にげる', true, 'よく できたね！ おおきな こえを だして、にげて いいんだよ。すぐ おうちの ひとに おしえてね。'),
        ch('ついて いく', false, 'しらない ひとに ついていくと、おうちの ひとが とても しんぱい するよ。「いかない！」って おおきな こえで いって、おうちの ひとの ところへ にげようね。')] },
    { id: 'maigo', group: 'abunai', text: 'おみせで、おうちの ひとが みえなく なったよ。どうする？',
      bg: 'shop', pic: [['piyo', 140, 212, 1, { mood: 'cry' }], ['tenin', 290, 212, 1.35]],
      choices: [ch('その ばで まって、おみせの ひとに「まいごです」と いう', true, 'よく できたね！ おみせの ひとが いっしょに さがして くれるよ。'),
        ch('ひとりで おみせの そとへ さがしに いく', false, 'そとへ でると、もっと あえなく なるかも。その ばで まって、おみせの ひとに おしえてね。')] }
  ];

  // G.「あなたなら どうする？」（正解なし）
  var OPEN = [
    { id: 'hitori', group: 'open', open: true, text: 'ともだちが ひとりで、さみしそうに しているよ。あなたなら どうする？',
      bg: 'out', pic: [['piyo', 90, 212, 1], ['usagi', 165, 212, 0.9], ['neko', 315, 212, 1, { mood: 'sad' }]],
      choices: [op('「いっしょに あそぼう」と さそう', 'それも いいね！ さそって もらえたら、うれしいね。'),
        op('そっと となりに いく', 'それも いいね！ そばに いて くれるだけで、ほっと するね。')] },
    { id: 'kenka', group: 'open', open: true, text: 'ともだち ふたりが、おもちゃの とりあいで けんかを しているよ。あなたなら どうする？',
      bg: 'in', pic: [['piyo', 80, 212, 0.9], ['kuma', 180, 212, 1, { mood: 'angry' }], ['toycar', 245, 214, 1.1], ['usagi', 315, 212, 1, { mood: 'angry' }]],
      choices: [op('「じゅんばんこに しよう」と いう', 'それも いいね！ じゅんばんこなら、ふたりとも あそべるね。'),
        op('せんせいを よびに いく', 'それも いいね！ こまったときは、おとなに たすけて もらおうね。')] },
    { id: 'hitotsu', group: 'open', open: true, text: 'おかしが ひとつ。ともだちも たべたいって。あなたなら どうする？',
      bg: 'in', pic: [['piyo', 110, 212, 1], ['table', 205, 214, 0.8, { food: 'cookie' }], ['usagi', 305, 212, 1]],
      choices: [op('はんぶんこ する', 'それも いいね！ ふたりで たべると、おいしいね。'),
        op('じゃんけんで きめる', 'それも いいね！ じゃんけんなら、どっちが かっても なっとく できるね。')] },
    { id: 'ehen', group: 'open', open: true, text: 'かいた えを、ともだちに「へんなの」って いわれたよ。あなたなら どうする？',
      bg: 'in', pic: [['piyo', 110, 212, 1, { mood: 'sad' }], ['paper', 205, 214, 1], ['kuma', 305, 212, 1]],
      choices: [op('「そう いわれると かなしいよ」と つたえる', 'それも いいね！ きもちを ことばで つたえられるって、すてきだね。'),
        op('おうちの ひとに はなす', 'それも いいね！ いやな きもちは、おうちの ひとに きいて もらおうね。')] }
  ];

  function sceneById(id) {
    var all = SCENES.concat(OPEN);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  // 返事（読み上げと画面）。「あなたなら」の場面は、おうちの ひとに きく ことばを足す
  function replyFor(scene, choice) {
    return scene.open ? choice.reply + ' ' + OPEN_TAIL : choice.reply;
  }

  // 記録から：場面ごとの見た回数（seen）と、1回目に もう一方を えらんだ回数（missCounts）
  function progressFromLogs(logs) {
    var res = { seen: {}, missCounts: {} };
    (logs || []).forEach(function (e) {
      if (!e || e.area !== AREA) return;
      res.seen[e.itemId] = (res.seen[e.itemId] || 0) + 1;
      if (!e.correct) res.missCounts[e.itemId] = (res.missCounts[e.itemId] || 0) + 1;
    });
    return res;
  }

  // つぎの ふつうの場面。「見た回数 − もう一方を えらんだ回数」が いちばん少ない場面から えらぶ
  // （まだ見ていない場面が先。もう一方を えらんだことがある場面は早めに もう一度）。直前の場面は出さない。
  function pickScene(opts, rng) {
    opts = opts || {};
    rng = rng || Math.random;
    var seen = opts.seen || {}, miss = opts.missCounts || {};
    var list = SCENES.filter(function (s) { return s.id !== opts.lastId; });
    var best = Infinity, pool = [];
    list.forEach(function (s) {
      var v = (seen[s.id] || 0) - (miss[s.id] || 0);
      if (v < best) { best = v; pool = [s]; } else if (v === best) pool.push(s);
    });
    return pool[Math.floor(rng() * pool.length)];
  }

  function pickOpen(lastId, rng) {
    rng = rng || Math.random;
    var list = OPEN.filter(function (s) { return s.id !== lastId; });
    return list[Math.floor(rng() * list.length)];
  }

  // n 番目（0から）の場面を「あなたなら どうする？」にするか
  function isOpenSlot(n) { return n % ROUND_SIZE === OPEN_SLOT; }

  // 左右の並び（のぞましいほうが いつも左にならないように）。もとの配列は変えない
  function order(choices, rng) {
    rng = rng || Math.random;
    var a = choices.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- 絵（SVG の部品） ---------- */
  var INK = '#5a4632';
  var KINDS = {
    piyo: { body: '#ffd84d', belly: '#fff0b3', line: '#e0b21c' },
    usagi: { body: '#ffffff', belly: '#ffeef1', line: '#d8c6c6' },
    kuma: { body: '#c98b5a', belly: '#f0d2b0', line: '#9c6a42' },
    neko: { body: '#f6b26b', belly: '#fff3e0', line: '#c98a4a' }
  };

  function face(mood, beak) {
    var s = '';
    if (mood === 'happy') {
      s += '<path d="M-17 -52 q5 -7 10 0 M7 -52 q5 -7 10 0" class="dt-ln"/>';
    } else if (mood === 'cry' || mood === 'sneeze' || mood === 'sleepy') {
      s += '<path d="M-17 -53 q5 4 10 0 M7 -53 q5 4 10 0" class="dt-ln"/>';
    } else {
      s += '<circle cx="-12" cy="-52" r="4.5" fill="#3a3a3a"/><circle cx="12" cy="-52" r="4.5" fill="#3a3a3a"/>' +
           '<circle cx="-10.5" cy="-54" r="1.5" fill="#fff"/><circle cx="13.5" cy="-54" r="1.5" fill="#fff"/>';
    }
    if (mood === 'sad' || mood === 'cry') s += '<path d="M-19 -61 l9 -3 M19 -61 l-9 -3" class="dt-ln thin"/>';
    if (mood === 'angry') s += '<path d="M-19 -64 l9 4 M19 -64 l-9 4" class="dt-ln thin"/>';
    if (mood === 'cry') s += '<path d="M-14 -46 q-4 8 0 11 q4 -3 0 -11 Z M14 -46 q-4 8 0 11 q4 -3 0 -11 Z" fill="#7cc4f2"/>';
    s += '<ellipse cx="-23" cy="-43" rx="6" ry="3.5" fill="#ff9fb0" opacity=".8"/><ellipse cx="23" cy="-43" rx="6" ry="3.5" fill="#ff9fb0" opacity=".8"/>';
    var sadMouth = mood === 'sad' || mood === 'cry' || mood === 'angry';
    if (beak) {
      s += mood === 'happy' ? '<path d="M-7 -45 L7 -45 L0 -35 Z" fill="#ff8a3d"/>' : '<path d="M-6 -46 L6 -46 L0 -39 Z" fill="#ff8a3d"/>';
    } else {
      s += sadMouth ? '<path d="M-5 -36 q5 -5 10 0" class="dt-ln thin"/>' : '<path d="M-5 -40 q5 5 10 0" class="dt-ln thin"/>';
    }
    if (mood === 'sleepy') s += '<path d="M24 -84 h8 l-8 9 h8" class="dt-ln thin" stroke="#7aa6c9"/>';
    return s;
  }

  // ぴよ・うさぎ・くま・ねこ（足もとが 0、高さ 約90）
  function critter(kind, o) {
    o = o || {};
    var k = KINDS[kind];
    var beak = kind === 'piyo';
    var s = '<ellipse cx="0" cy="0" rx="30" ry="4" fill="rgba(0,0,0,.1)"/>';
    if (kind === 'usagi') {
      s += '<ellipse cx="-13" cy="-86" rx="8" ry="22" fill="' + k.body + '" stroke="' + k.line + '" stroke-width="2"/>' +
           '<ellipse cx="13" cy="-86" rx="8" ry="22" fill="' + k.body + '" stroke="' + k.line + '" stroke-width="2"/>' +
           '<ellipse cx="-13" cy="-86" rx="4" ry="15" fill="#ffc7d1"/><ellipse cx="13" cy="-86" rx="4" ry="15" fill="#ffc7d1"/>';
    } else if (kind === 'kuma') {
      s += '<circle cx="-24" cy="-72" r="11" fill="' + k.body + '"/><circle cx="24" cy="-72" r="11" fill="' + k.body + '"/>' +
           '<circle cx="-24" cy="-72" r="6" fill="' + k.belly + '"/><circle cx="24" cy="-72" r="6" fill="' + k.belly + '"/>';
    } else if (kind === 'neko') {
      s += '<path d="M-31 -62 L-24 -92 L-6 -76 Z M31 -62 L24 -92 L6 -76 Z" fill="' + k.body + '" stroke="' + k.line + '" stroke-width="2" stroke-linejoin="round"/>';
    } else {
      s += '<path d="M-2 -80 q-6 -13 4 -13 q-2 6 4 8" fill="#ffc21a"/>';
    }
    // て（はね）
    if (beak) {
      s += '<path d="M-33 -36 q-12 8 -4 18 q8 -2 9 -10 Z" fill="#ffc21a"/>';
      s += o.wave ? '<path d="M33 -44 q14 -14 8 -24 q-8 4 -11 12 Z" fill="#ffc21a"/>' : '<path d="M33 -36 q12 8 4 18 q-8 -2 -9 -10 Z" fill="#ffc21a"/>';
    } else {
      s += '<ellipse cx="-33" cy="-30" rx="7" ry="11" fill="' + k.body + '" stroke="' + k.line + '" stroke-width="2"/>';
      s += o.wave ? '<ellipse cx="36" cy="-62" rx="7" ry="11" transform="rotate(30 36 -62)" fill="' + k.body + '" stroke="' + k.line + '" stroke-width="2"/>'
                  : '<ellipse cx="33" cy="-30" rx="7" ry="11" fill="' + k.body + '" stroke="' + k.line + '" stroke-width="2"/>';
    }
    s += '<ellipse cx="0" cy="-42" rx="34" ry="40" fill="' + k.body + '" stroke="' + k.line + '" stroke-width="2"/>';
    s += '<ellipse cx="0" cy="-26" rx="21" ry="17" fill="' + k.belly + '"/>';
    if (o.apron) s += '<path d="M-20 -40 h40 v26 q-20 10 -40 0 Z" fill="' + o.apron + '"/><path d="M-16 -40 q16 -16 32 0" fill="none" stroke="' + o.apron + '" stroke-width="3"/>';
    if (o.tie) s += '<path d="M-4 -42 h8 l3 22 l-7 7 l-7 -7 Z" fill="#3c6bc4"/>';
    if (beak) s += '<path d="M-14 -2 l-3 6 M-9 -2 l0 6 M9 -2 l0 6 M14 -2 l3 6" stroke="#ff8a3d" stroke-width="3" stroke-linecap="round"/>';
    else s += '<ellipse cx="-14" cy="-3" rx="9" ry="4" fill="' + k.line + '"/><ellipse cx="14" cy="-3" rx="9" ry="4" fill="' + k.line + '"/>';
    if (!beak) {
      var nose = kind === 'kuma' ? '#5a3a24' : '#ff8fa3';
      s += '<ellipse cx="0" cy="-45" rx="3.5" ry="2.5" fill="' + nose + '"/>';
    }
    s += face(o.mood, beak);
    if (o.glasses) s += '<circle cx="-12" cy="-52" r="8" class="dt-ln thin" fill="none"/><circle cx="12" cy="-52" r="8" class="dt-ln thin" fill="none"/><path d="M-4 -52 h8" class="dt-ln thin"/>';
    if (o.ribbon) s += '<path d="M8 -84 l14 -8 v16 Z M8 -84 l-14 -8 v16 Z" fill="#ff5c7a"/><circle cx="8" cy="-84" r="4" fill="#e23d5d"/>';
    if (o.mood === 'sneeze') s += '<path d="M-30 -48 q12 -8 22 4" fill="#ffc21a"/>';
    return s;
  }

  // しらない ひと（こわくない、ふつうの おとな。高さ 約160）
  function person() {
    return '<ellipse cx="0" cy="0" rx="30" ry="4" fill="rgba(0,0,0,.1)"/>' +
      '<rect x="-13" y="-46" width="10" height="44" rx="4" fill="#4b4f63"/><rect x="3" y="-46" width="10" height="44" rx="4" fill="#4b4f63"/>' +
      '<rect x="-27" y="-116" width="54" height="80" rx="16" fill="#8d93b0"/>' +
      '<rect x="-38" y="-108" width="12" height="52" rx="6" fill="#8d93b0"/><rect x="26" y="-108" width="12" height="52" rx="6" fill="#8d93b0"/>' +
      '<circle cx="0" cy="-134" r="20" fill="#f3d2b5"/>' +
      '<rect x="-26" y="-148" width="52" height="7" rx="3" fill="#5a5f78"/><rect x="-16" y="-170" width="32" height="24" rx="6" fill="#5a5f78"/>' +
      '<circle cx="-7" cy="-134" r="2.6" fill="#3a3a3a"/><circle cx="7" cy="-134" r="2.6" fill="#3a3a3a"/>' +
      '<path d="M-6 -124 q6 3 12 0" class="dt-ln thin"/>';
  }

  var PROPS = {
    school: function () {
      return '<rect x="-60" y="-110" width="120" height="110" rx="6" fill="#ffe1b8" stroke="' + INK + '" stroke-width="2"/>' +
        '<path d="M-70 -108 L0 -150 L70 -108 Z" fill="#ff8f6b"/>' +
        '<circle cx="0" cy="-122" r="10" fill="#fff" stroke="' + INK + '" stroke-width="2"/><path d="M0 -122 v-6 M0 -122 h5" class="dt-ln thin"/>' +
        '<rect x="-46" y="-90" width="28" height="24" rx="3" fill="#bfe6ff"/><rect x="18" y="-90" width="28" height="24" rx="3" fill="#bfe6ff"/>' +
        '<rect x="-14" y="-46" width="28" height="46" rx="4" fill="#c98b5a"/>';
    },
    hat: function () {
      return '<path d="M-22 0 q22 -34 44 0 Z" fill="#ff7a59"/><path d="M-30 0 h44" stroke="#e05a3a" stroke-width="5" stroke-linecap="round"/>';
    },
    book: function (o) {
      var s = '<path d="M-36 0 L-36 -26 q18 -8 36 0 q18 -8 36 0 L36 0 q-18 -8 -36 0 q-18 -8 -36 0 Z" fill="#fff" stroke="' + INK + '" stroke-width="2"/>' +
        '<path d="M0 -26 V0" class="dt-ln thin"/><path d="M-28 -16 h18 M-28 -10 h14 M8 -16 h20" stroke="#9bc8e8" stroke-width="3" stroke-linecap="round"/>';
      if (o && o.torn) s += '<path d="M18 -28 l-4 6 l5 5 l-5 6 l4 6" fill="none" stroke="#e23d5d" stroke-width="2.5" stroke-linejoin="round"/>';
      return s;
    },
    table: function (o) {
      var s = '<rect x="-60" y="-46" width="120" height="10" rx="4" fill="#c98b5a"/>' +
        '<rect x="-52" y="-36" width="8" height="36" fill="#a8703f"/><rect x="44" y="-36" width="8" height="36" fill="#a8703f"/>';
      var f = o && o.food;
      if (f === 'bowl') {
        s += '<path d="M-24 -62 q0 16 24 16 q24 0 24 -16 Z" fill="#e8574a"/><path d="M-22 -62 q22 -14 44 0 Z" fill="#fff"/>' +
             '<path d="M30 -60 l26 -14 M32 -55 l26 -14" stroke="#a8703f" stroke-width="3" stroke-linecap="round"/>';
      } else if (f === 'cookie') {
        s += '<ellipse cx="0" cy="-49" rx="30" ry="6" fill="#fff" stroke="#d8c6c6" stroke-width="2"/>' +
             '<circle cx="0" cy="-58" r="12" fill="#d9a35e"/><circle cx="-4" cy="-61" r="2" fill="#7a4a24"/><circle cx="4" cy="-56" r="2" fill="#7a4a24"/>';
      } else {
        s += '<ellipse cx="-22" cy="-50" rx="22" ry="5" fill="#fff" stroke="#d8c6c6" stroke-width="2"/>' +
             '<path d="M10 -62 q0 14 18 14 q18 0 18 -14 Z" fill="#7ab8e8"/>';
      }
      return s;
    },
    slide: function () {
      return '<path d="M-60 0 V-110 M-36 0 V-110" stroke="#4c8fd6" stroke-width="6" stroke-linecap="round"/>' +
        '<path d="M-60 -30 h24 M-60 -55 h24 M-60 -80 h24 M-60 -105 h24" stroke="#4c8fd6" stroke-width="4"/>' +
        '<path d="M-36 -110 h12 q10 0 18 12 L60 -6 q4 6 -4 6 h-10 L-10 -92 q-6 -8 -14 -8 h-12 Z" fill="#ff9f43" stroke="#e07a1f" stroke-width="2"/>';
    },
    swing: function () {
      return '<path d="M-70 0 L-50 -130 L50 -130 L70 0" fill="none" stroke="#4c8fd6" stroke-width="7" stroke-linejoin="round"/>' +
        '<path d="M-20 -130 V-36 M20 -130 V-36" stroke="#9aa4b1" stroke-width="3"/>' +
        '<rect x="-30" y="-38" width="60" height="8" rx="3" fill="#c98b5a"/>';
    },
    toycar: function () {
      return '<rect x="-26" y="-22" width="52" height="16" rx="6" fill="#ff5c5c"/><path d="M-14 -22 l6 -12 h18 l6 12 Z" fill="#ff8f8f"/>' +
        '<circle cx="-14" cy="-5" r="6" fill="#3a3a3a"/><circle cx="14" cy="-5" r="6" fill="#3a3a3a"/>';
    },
    blocks: function () {
      return '<rect x="-30" y="-24" width="24" height="24" rx="3" fill="#ffcf3f" stroke="' + INK + '" stroke-width="1.5"/>' +
        '<rect x="-4" y="-24" width="24" height="24" rx="3" fill="#4c8fd6" stroke="' + INK + '" stroke-width="1.5"/>' +
        '<rect x="-18" y="-48" width="24" height="24" rx="3" fill="#03af7a" stroke="' + INK + '" stroke-width="1.5"/>' +
        '<path d="M-6 -72 l14 24 h-28 Z" fill="#ff7a59" stroke="' + INK + '" stroke-width="1.5" stroke-linejoin="round"/>';
    },
    toys: function () {
      return '<rect x="-56" y="-20" width="20" height="20" rx="3" fill="#ffcf3f" transform="rotate(-15 -46 -10)"/>' +
        '<rect x="-20" y="-18" width="18" height="18" rx="3" fill="#4c8fd6" transform="rotate(20 -11 -9)"/>' +
        '<circle cx="22" cy="-12" r="12" fill="#ff5c5c"/><path d="M10 -12 h24" stroke="#fff" stroke-width="3"/>' +
        '<path d="M40 0 l10 -20 l10 20 Z" fill="#03af7a"/><rect x="-44" y="-40" width="18" height="12" rx="3" fill="#ff9fb0" transform="rotate(30 -35 -34)"/>';
    },
    toybox: function () {
      return '<rect x="-40" y="-50" width="80" height="50" rx="6" fill="#7cc4f2" stroke="#3d8fc9" stroke-width="2"/>' +
        '<rect x="-46" y="-58" width="92" height="12" rx="4" fill="#4c8fd6"/><circle cx="0" cy="-26" r="9" fill="#ffd84d"/>';
    },
    door: function () {
      return '<rect x="-34" y="-150" width="68" height="150" rx="6" fill="#d9a35e" stroke="#a8703f" stroke-width="3"/>' +
        '<circle cx="20" cy="-76" r="5" fill="#ffd84d"/><rect x="-46" y="-6" width="92" height="6" fill="#c9b79c"/>';
    },
    shoes: function () {
      return '<path d="M-44 -2 q0 -16 14 -16 l10 6 q10 2 10 10 Z" fill="#ff7a59" transform="rotate(-25 -30 -8)"/>' +
        '<path d="M14 -2 q0 -16 14 -16 l10 6 q10 2 10 10 Z" fill="#ff7a59" transform="rotate(160 30 -8)"/>';
    },
    bag: function () {
      return '<path d="M-20 0 L-24 -46 l6 -4 l6 4 l6 -4 l6 4 l6 -4 l6 4 l6 -4 l6 4 L20 0 Z" fill="#ffb347" stroke="#e08a1f" stroke-width="2" stroke-linejoin="round"/>' +
        '<circle cx="0" cy="-22" r="9" fill="#fff"/><circle cx="0" cy="-22" r="5" fill="#ff5c5c"/>';
    },
    trash: function () {
      return '<path d="M-24 -54 h48 l-5 54 h-38 Z" fill="#8fcf9a" stroke="#4e9b5c" stroke-width="2"/>' +
        '<rect x="-28" y="-62" width="56" height="9" rx="4" fill="#4e9b5c"/><path d="M-8 -44 v34 M8 -44 v34" stroke="#4e9b5c" stroke-width="2"/>';
    },
    clothes: function () {
      return '<path d="M-30 -6 L-40 -26 l18 -12 q8 6 22 6 q14 0 22 -6 l18 12 l-10 20 l-10 -4 v10 h-40 v-10 Z" fill="#7cc4f2" stroke="#3d8fc9" stroke-width="2" stroke-linejoin="round" transform="rotate(-12)"/>';
    },
    basket: function () {
      return '<path d="M-36 -48 h72 l-8 48 h-56 Z" fill="#e8c38f" stroke="#b8925a" stroke-width="2"/>' +
        '<path d="M-32 -34 h64 M-30 -20 h60 M-29 -8 h58" stroke="#b8925a" stroke-width="2"/>';
    },
    sink: function () {
      return '<rect x="-34" y="-70" width="68" height="70" rx="6" fill="#e6eef5" stroke="#9fb3c4" stroke-width="2"/>' +
        '<path d="M-30 -70 q30 16 60 0" fill="#bcd4e6"/><path d="M-6 -100 h18 v10 h-6 v8" fill="none" stroke="#9fb3c4" stroke-width="6" stroke-linecap="round"/>' +
        '<path d="M6 -78 q-3 6 0 8 q3 -2 0 -8 Z M6 -66 q-3 6 0 8 q3 -2 0 -8 Z" fill="#7cc4f2"/>';
    },
    toilet: function () {
      return '<rect x="-30" y="-110" width="40" height="50" rx="6" fill="#fff" stroke="#9fb3c4" stroke-width="2"/>' +
        '<path d="M-34 -60 h64 q0 30 -28 34 v26 h-20 v-26 q-16 -6 -16 -34 Z" fill="#fff" stroke="#9fb3c4" stroke-width="2"/>';
    },
    brush: function () {
      return '<path d="M-16 0 l-4 -40 h32 l-4 40 Z" fill="#7cc4f2"/>' +
        '<rect x="-2" y="-84" width="7" height="50" rx="3" fill="#ff7a59" transform="rotate(12 1 -60)"/><rect x="0" y="-92" width="12" height="12" rx="2" fill="#fff" stroke="#9fb3c4" transform="rotate(12 6 -86)"/>';
    },
    bed: function () {
      return '<rect x="-56" y="-40" width="112" height="28" rx="6" fill="#fff" stroke="#9fb3c4" stroke-width="2"/>' +
        '<rect x="-50" y="-60" width="34" height="20" rx="8" fill="#ffeef1" stroke="#d8c6c6" stroke-width="2"/>' +
        '<rect x="-10" y="-50" width="66" height="18" rx="6" fill="#9bc8e8"/>' +
        '<rect x="-60" y="-80" width="10" height="80" rx="4" fill="#c98b5a"/><rect x="-60" y="-12" width="120" height="8" rx="3" fill="#c98b5a"/>';
    },
    sneeze: function () {
      return '<circle cx="0" cy="0" r="4" fill="#bfe6ff"/><circle cx="14" cy="-8" r="3" fill="#bfe6ff"/><circle cx="16" cy="8" r="3.5" fill="#bfe6ff"/>' +
        '<circle cx="28" cy="-2" r="2.5" fill="#bfe6ff"/><path d="M-8 -16 l8 4 M-8 16 l8 -4" stroke="#9bc8e8" stroke-width="3" stroke-linecap="round"/>';
    },
    ball: function () {
      return '<circle cx="0" cy="-14" r="14" fill="#ff5c5c"/><path d="M-14 -14 h28" stroke="#fff" stroke-width="4"/><path d="M-26 -10 h-10 M-26 -18 h-6" stroke="#bbb" stroke-width="2" stroke-linecap="round"/>';
    },
    car: function () {
      return '<rect x="-50" y="-30" width="100" height="22" rx="8" fill="#4c8fd6"/><path d="M-30 -30 l10 -18 h36 l12 18 Z" fill="#7cc4f2"/>' +
        '<circle cx="-28" cy="-8" r="9" fill="#3a3a3a"/><circle cx="28" cy="-8" r="9" fill="#3a3a3a"/><circle cx="-48" cy="-22" r="4" fill="#ffe27a"/>';
    },
    signal: function () {
      return '<rect x="-4" y="-150" width="8" height="150" fill="#7a808c"/>' +
        '<rect x="-40" y="-176" width="80" height="32" rx="14" fill="#4b4f63"/>' +
        '<circle cx="-24" cy="-160" r="10" fill="#6a8f74"/><circle cx="0" cy="-160" r="10" fill="#8f8a5a"/><circle cx="24" cy="-160" r="10" fill="#ff3b30"/>' +
        '<circle cx="24" cy="-160" r="15" fill="none" stroke="#ff3b30" stroke-width="2" opacity=".5"/>';
    },
    paper: function () {
      return '<rect x="-32" y="-10" width="64" height="10" rx="2" fill="#fff" stroke="#d8c6c6" stroke-width="2" transform="skewX(-20)"/>' +
        '<rect x="-30" y="-70" width="60" height="60" rx="3" fill="#fff" stroke="#d8c6c6" stroke-width="2"/>' +
        '<circle cx="0" cy="-44" r="8" fill="#ffd84d"/><circle cx="-10" cy="-44" r="6" fill="#ff9fb0"/><circle cx="10" cy="-44" r="6" fill="#ff9fb0"/>' +
        '<circle cx="0" cy="-54" r="6" fill="#ff9fb0"/><circle cx="0" cy="-34" r="6" fill="#ff9fb0"/><path d="M0 -30 v18" stroke="#03af7a" stroke-width="3"/>';
    }
  };

  var BG = {
    out: '<rect width="400" height="240" fill="#dff3ff"/><circle cx="50" cy="40" r="22" fill="#ffe27a"/>' +
         '<ellipse cx="300" cy="44" rx="34" ry="12" fill="#fff"/><rect y="170" width="400" height="70" fill="#bfe8a6"/>',
    eve: '<rect width="400" height="240" fill="#ffe2c4"/><circle cx="50" cy="150" r="24" fill="#ff9f6b"/>' +
         '<rect y="170" width="400" height="70" fill="#c9e3a0"/>',
    'in': '<rect width="400" height="240" fill="#fff4e0"/><rect x="24" y="30" width="70" height="56" rx="6" fill="#dff3ff" stroke="#e8c38f" stroke-width="4"/>' +
          '<rect y="170" width="400" height="70" fill="#f1d9b5"/><path d="M0 170 h400" stroke="#e1c296" stroke-width="3"/>',
    night: '<rect width="400" height="240" fill="#4a5a8a"/><rect x="24" y="30" width="70" height="56" rx="6" fill="#2c3766" stroke="#8a96c2" stroke-width="4"/>' +
           '<path d="M66 44 a12 12 0 1 0 8 20 a10 10 0 1 1 -8 -20 Z" fill="#ffe27a"/><rect y="170" width="400" height="70" fill="#c3b49a"/>',
    road: '<rect width="400" height="240" fill="#dff3ff"/><circle cx="350" cy="40" r="20" fill="#ffe27a"/>' +
          '<rect y="150" width="400" height="48" fill="#e8e1d4"/><rect y="198" width="400" height="42" fill="#8a8f99"/>' +
          '<path d="M10 220 h40 M90 220 h40 M170 220 h40 M250 220 h40 M330 220 h40" stroke="#fff" stroke-width="4"/>',
    shop: '<rect width="400" height="240" fill="#fffaf2"/>' +
          '<rect x="10" y="40" width="380" height="8" fill="#d9a35e"/><rect x="10" y="100" width="380" height="8" fill="#d9a35e"/>' +
          '<rect x="20" y="16" width="20" height="24" rx="3" fill="#ff9f6b"/><rect x="48" y="20" width="18" height="20" rx="3" fill="#7cc4f2"/><circle cx="88" cy="30" r="10" fill="#ffd84d"/>' +
          '<rect x="300" y="18" width="22" height="22" rx="3" fill="#8fcf9a"/><rect x="330" y="14" width="18" height="26" rx="3" fill="#ff9fb0"/><rect x="356" y="22" width="24" height="18" rx="3" fill="#ffcf3f"/>' +
          '<rect x="24" y="74" width="24" height="26" rx="3" fill="#ffcf3f"/><circle cx="70" cy="88" r="11" fill="#ff5c5c"/><rect x="320" y="76" width="22" height="24" rx="3" fill="#7cc4f2"/><rect x="350" y="80" width="26" height="20" rx="3" fill="#ff9f6b"/>' +
          '<rect y="170" width="400" height="70" fill="#e9e4da"/>'
  };

  function part(name, o) {
    if (KINDS[name]) return critter(name, o);
    if (name === 'onee') return critter('piyo', Object.assign({ ribbon: true }, o));
    if (name === 'papa') return critter('piyo', Object.assign({ tie: true, glasses: true }, o));
    if (name === 'sensei') return critter('kuma', Object.assign({ apron: '#ff9fb0' }, o));
    if (name === 'tenin') return critter('kuma', Object.assign({ apron: '#6cc08a' }, o));
    if (name === 'hito') return person();
    return PROPS[name] ? PROPS[name](o || {}) : '';
  }

  // 場面の絵（SVG 文字列）。文字は入れない
  function picSvg(scene) {
    var body = BG[scene.bg] || BG['in'];
    scene.pic.forEach(function (p) {
      body += '<g transform="translate(' + p[1] + ' ' + p[2] + ') scale(' + (p[3] || 1) + ')">' + part(p[0], p[4]) + '</g>';
    });
    return '<svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid meet">' + body + '</svg>';
  }

  /* ---------- 画面 ---------- */
  var st = null;   // { profileId, seen, missCounts, lastId, lastOpen, solved }

  function U() { return C.chiikuUi; }

  function start(profileId) {
    st = { profileId: profileId, seen: {}, missCounts: {}, lastId: null, lastOpen: null, solved: 0 };
    return Promise.resolve()
      .then(function () { return C.storage.getLogs(profileId); })
      .then(function (logs) { return logs || []; }, function () { return []; })
      .then(function (logs) {
        var p = progressFromLogs(logs);
        st.seen = p.seen; st.missCounts = p.missCounts;
        nextScene();
      });
  }

  function nextScene() {
    var ui = U();
    var over = false;
    try { over = C.timer.isOver(st.profileId); } catch (e) { over = false; }
    if (over) { ui.showRest(); return; }
    var scene;
    if (isOpenSlot(st.solved)) { scene = pickOpen(st.lastOpen); st.lastOpen = scene.id; }
    else { scene = pickScene({ seen: st.seen, missCounts: st.missCounts, lastId: st.lastId }); st.lastId = scene.id; }
    showScene(scene);
  }

  function showScene(scene) {
    var ui = U();
    var app = ui.newScreen('doutoku');
    var q = { scene: scene, missed: false, done: false, busy: false, readId: 0 };
    var hasVoice = false;
    try { hasVoice = C.voice.isAvailable(); } catch (e) { hasVoice = false; }
    app.classList.toggle('no-voice', !hasVoice);
    app.appendChild(ui.topBar({ home: true }));

    var main = ui.el('div', 'dt-main');
    var pic = ui.el('div', 'dt-pic');
    pic.innerHTML = picSvg(scene);
    main.appendChild(pic);

    var side = ui.el('div', 'dt-side');
    var talk = ui.el('div', 'dt-talk');
    var who = ui.el('div', 'q-chara dt-chara');
    var face = ui.chara('normal');
    who.appendChild(face);
    talk.appendChild(who);
    var bub = ui.bubble(scene.text);
    bub.classList.add('dt-text');
    talk.appendChild(bub);
    if (hasVoice) {
      var again = ui.button('icon-btn speak-btn', function () { ui.play('tap'); readAll(); });
      again.setAttribute('aria-label', 'もういちど きく');
      again.appendChild(ui.svg(ui.ICO.speaker));
      talk.appendChild(again);
    }
    side.appendChild(talk);

    var box = ui.el('div', 'dt-choices');
    var cards = [];
    order(scene.choices).forEach(function (c) {
      var wrap = ui.el('div', 'dt-choice');
      var pick = ui.button('dt-pick', function () { choose(c, pick); });
      pick.appendChild(ui.el('span', 'dt-pick-text', c.text));
      wrap.appendChild(pick);
      if (hasVoice) {
        var say = ui.button('icon-btn dt-say', function () {
          ui.play('tap');
          q.readId++;
          light(pick);
          ui.speak(c.text).then(function () { pick.classList.remove('reading'); });
        });
        say.setAttribute('aria-label', 'この こたえを きく');
        say.appendChild(ui.svg(ui.ICO.speaker));
        wrap.appendChild(say);
      }
      box.appendChild(wrap);
      cards.push({ choice: c, node: pick });
    });
    side.appendChild(box);
    main.appendChild(side);
    app.appendChild(main);

    function setFace(mood) {
      var f = ui.chara(mood);
      face.parentNode.replaceChild(f, face);
      face = f;
    }
    function light(node) {
      cards.forEach(function (cd) { cd.node.classList.toggle('reading', cd.node === node); });
    }
    // 場面の文を読んでから、カードを1枚ずつ光らせて読む（とちゅうで えらんだら止める）
    function readAll() {
      var id = ++q.readId;
      light(null);
      ui.speak(scene.text).then(function step0() {
        var i = 0;
        (function next() {
          if (id !== q.readId || q.done || i >= cards.length) { if (id === q.readId) light(null); return; }
          var cd = cards[i];
          light(cd.node);
          ui.speak((i === 0 ? '' : 'それとも、') + cd.choice.text).then(function () { i++; next(); });
        })();
      });
    }

    // 連打しても1回だけ受けつける。×は付けない
    function choose(c, node) {
      if (q.done || q.busy) return;
      q.readId++;
      light(null);
      var reply = replyFor(scene, c);
      bub.textContent = reply;
      if (c.good || scene.open) {
        q.done = true;
        ui.play('correct');
        node.classList.add('right');
        box.classList.add('settled');
        setFace('happy');
        var burst = ui.el('div', 'burst');
        for (var s = 0; s < 5; s++) burst.appendChild(ui.svg(ui.STAR, 'reward-star s' + s));
        node.appendChild(burst);
        finishScene(q);
        ui.speakThen(reply, WAIT_GOOD, afterScene);   // 言い終わってから次へ
      } else {
        q.busy = true;
        q.missed = true;
        ui.play('tap');
        node.classList.add('tried');
        setFace('think');
        var t0 = Date.now();
        ui.speak(reply).then(function () {
          ui.later(function () { q.busy = false; }, Math.max(0, 700 - (Date.now() - t0)));
        });
      }
    }
    readAll();
  }

  // 1場面ぶんの記録（1回目で のぞましいほうなら true）。「あなたなら」の場面は記録しない
  function finishScene(q) {
    var sc = q.scene;
    if (!sc.open) {
      var correct = !q.missed;
      try {
        var p = C.storage.logAnswer({ profileId: st.profileId, area: AREA, itemId: sc.id, correct: correct, level: 1 });
        if (p && p.catch) p.catch(function () {});
      } catch (e) { /* 保存できなくても続ける */ }
      st.seen[sc.id] = (st.seen[sc.id] || 0) + 1;
      if (!correct) st.missCounts[sc.id] = (st.missCounts[sc.id] || 0) + 1;
    }
    st.solved++;
  }

  function afterScene() {
    if (st.solved % ROUND_SIZE === 0) { showReward(); return; }
    nextScene();
  }

  function showReward() {
    var ui = U();
    var app = ui.newScreen('reward');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'reward-body');
    var stars = ui.el('div', 'stars');
    for (var i = 0; i < 3; i++) stars.appendChild(ui.svg(ui.STAR, 'reward-star s' + i));
    body.appendChild(stars);
    var row = ui.el('div', 'reward-row');
    row.appendChild(ui.chara('happy'));
    var info = ui.el('div', 'reward-info');
    info.appendChild(ui.el('p', 'reward-msg', 'すごい！'));
    var next = ui.button('btn-big btn-next', function () {
      if (next.disabled) return;
      next.disabled = true;
      ui.play('tap');
      nextScene();
    });
    next.setAttribute('aria-label', 'つぎへ');
    next.appendChild(ui.svg(ui.ICO.next));
    next.appendChild(ui.el('span', null, 'つぎへ'));
    info.appendChild(next);
    row.appendChild(info);
    body.appendChild(row);
    app.appendChild(body);
    ui.play('star');
    ui.speak('すごい！ たくさん かんがえたね');
  }

  C.chiikuDoutoku = {
    AREA: AREA, ROUND_SIZE: ROUND_SIZE, OPEN_SLOT: OPEN_SLOT, OPEN_TAIL: OPEN_TAIL, SCENES: SCENES, OPEN: OPEN,
    sceneById: sceneById, replyFor: replyFor, progressFromLogs: progressFromLogs, pickScene: pickScene,
    pickOpen: pickOpen, isOpenSlot: isOpenSlot, order: order, picSvg: picSvg, start: start,
    showScene: showScene   // 画面の確認用（場面を指定して開く）
  };
})();
