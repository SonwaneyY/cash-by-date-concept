/* the product prototype: Where your money is.
   Plain JS, no dependencies. Dates are computed, not typed in:
   - a fixed "now" (Fri Oct 30, 2026, 2:15 PM ET or 11:40 AM ET, from the prototype control)
   - the 1 PM ET same-day cut-off for the Money Market Fund (help center)
   - business days that skip weekends and Federal Reserve holidays for 2026 and 2027
   - the later end of any range ("Promise the later date")
   Money is kept in integer cents, like the product's decimal Money class. */
(function () {
  'use strict';

  /* ---------- Calendar ---------- */
  var DAY_MS = 86400000;
  function day(y, m, d) { return Date.UTC(y, m - 1, d) / DAY_MS; }
  function toDate(n) { return new Date(n * DAY_MS); }
  function dow(n) { return toDate(n).getUTCDay(); }

  // Federal Reserve holidays. When a holiday falls on a Saturday the Fed stays open the Friday before,
  // so Jul 3, 2026 and Jun 18 / Dec 24, 2027 are business days.
  var HOLIDAYS = {};
  [
    [day(2026, 1, 1), "New Year’s Day"], [day(2026, 1, 19), 'Martin Luther King Jr. Day'],
    [day(2026, 2, 16), 'Presidents Day'], [day(2026, 5, 25), 'Memorial Day'],
    [day(2026, 6, 19), 'Juneteenth'], [day(2026, 9, 7), 'Labor Day'],
    [day(2026, 10, 12), 'Columbus Day'], [day(2026, 11, 11), 'Veterans Day'],
    [day(2026, 11, 26), 'Thanksgiving Day'], [day(2026, 12, 25), 'Christmas Day'],
    [day(2027, 1, 1), "New Year’s Day"], [day(2027, 1, 18), 'Martin Luther King Jr. Day'],
    [day(2027, 2, 15), 'Presidents Day'], [day(2027, 5, 31), 'Memorial Day'],
    [day(2027, 7, 5), 'Independence Day (observed)'], [day(2027, 9, 6), 'Labor Day'],
    [day(2027, 10, 11), 'Columbus Day'], [day(2027, 11, 11), 'Veterans Day'],
    [day(2027, 11, 25), 'Thanksgiving Day']
  ].forEach(function (h) { HOLIDAYS[h[0]] = h[1]; });
  var CAL_END = day(2027, 12, 31);

  function isBiz(n) { var w = dow(n); return w !== 0 && w !== 6 && !HOLIDAYS[n]; }
  function nextBiz(n) { do { n++; } while (!isBiz(n)); return n; }
  function prevBiz(n) { do { n--; } while (!isBiz(n)); return n; }
  function addBiz(n, k) { while (k-- > 0) n = nextBiz(n); return n; }
  function subBiz(n, k) { while (k-- > 0) n = prevBiz(n); return n; }

  var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var NOWS = {
    pm: { day: day(2026, 10, 30), min: 14 * 60 + 15, label: '2:15 PM ET' },
    am: { day: day(2026, 10, 30), min: 11 * 60 + 40, label: '11:40 AM ET' }
  };
  var CUTOFF = 13 * 60; // 1 PM ET
  var now = NOWS.pm;
  var YEAR = toDate(now.day).getUTCFullYear();

  // "Mon, Nov 2" (adds the year outside the current one)
  function fmtDay(n) {
    var t = toDate(n);
    var s = WD[t.getUTCDay()] + ', ' + MO[t.getUTCMonth()] + ' ' + t.getUTCDate();
    return t.getUTCFullYear() !== YEAR ? s + ', ' + t.getUTCFullYear() : s;
  }
  function fmtDayYear(n) { var t = toDate(n); return WD[t.getUTCDay()] + ', ' + MO[t.getUTCMonth()] + ' ' + t.getUTCDate() + ', ' + t.getUTCFullYear(); }
  function fmtMD(n) { var t = toDate(n); var s = MO[t.getUTCMonth()] + ' ' + t.getUTCDate(); return t.getUTCFullYear() !== YEAR ? s + ', ' + t.getUTCFullYear() : s; }
  function rel(n) { return n === now.day ? 'Today' : fmtDay(n); }
  function iso(n) { return toDate(n).toISOString().slice(0, 10); }
  function fromIso(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? day(+m[1], +m[2], +m[3]) : null; }

  /* ---------- Money (integer cents) ---------- */
  function usd(c) {
    var neg = c < 0; c = Math.abs(c);
    var s = Math.floor(c / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + String(c % 100).padStart(2, '0');
    return (neg ? '-$' : '$') + s;
  }
  function coin(c, code) { return usd(c).replace('$', '') + ' ' + code; }

  /* Compact amounts for glance figures only (revision 4). Anything someone acts on or reconciles stays exact.
     - Under $10,000: always exact.
     - K with 1 decimal, M and B with 2 decimals, always the same number of decimals.
     - 'floor' for amounts that promise cash by a date (never round up), 'round' (nearest) for balances.
     - A value that rounds up to 1,000 of its unit moves to the next unit ($999,960 is $1.00M, not $1,000.0K). */
  function compactText(c, mode) {
    if (c < 1000000) return usd(c);
    var f = mode === 'floor' ? Math.floor : Math.round;
    var k = f(c / 1e4);                         // tenths of $1K
    if (k < 10000) return '$' + (k / 10).toFixed(1) + 'K';
    var m = f(c / 1e6);                         // hundredths of $1M
    if (m < 100000) return '$' + (m / 100).toFixed(2) + 'M';
    return '$' + (f(c / 1e9) / 100).toFixed(2) + 'B';
  }
  // Visible: the compact figure. Hover or focus: the exact amount in the tooltip. Accessible name: the exact amount.
  function compact(c, mode) {
    var s = compactText(c, mode);
    if (s === usd(c)) return '<span>' + s + '</span>';
    return '<span class="cmp" tabindex="0" data-tip="' + usd(c) + '"><span aria-hidden="true">' + s + '</span><span class="sr-only">' + usd(c) + '</span></span>';
  }

  /* ---------- Unknowns: shown, never filled ---------- */
  var SEE = ' Not in public sources.';
  var PH = {
    custodian: ['Custodian to confirm', 'Which custodian holds U.S. T-bills and money market positions. BNY Pershing is sourced only for Gilts and Bunds.' + SEE],
    coverage: ['Coverage limit to confirm', 'The coverage wording and limit are not confirmed.' + SEE],
    sweepBanks: ['Sweep banks to confirm', 'Which banks are in the Insured Cash Sweep network.' + SEE],
    partnerBank: ['Partner bank to confirm', 'Which partner bank holds this account’s checking is not known.' + SEE],
    sweep: ['Sweep timing to confirm', 'How long cash takes to reach Business Checking when you withdraw from Insured Cash Sweep.' + SEE],
    sale: ['Sale settlement to confirm', 'How long selling a T-bill before maturity takes to settle and land in Business Checking.' + SEE],
    conversion: ['Conversion timing to confirm', 'How long USDC to USD conversion takes to land in Business Checking.' + SEE],
    ltCutoff: ['Order cut-off to confirm', 'The help center gives a 1 PM ET cut-off for the Money Market Fund only. For Liquid Treasuries none is stated, so days are counted from today.' + SEE],
    maturity: ['Maturity transfer to confirm', 'Whether this bill rolls over or transfers to Business Checking when it matures.' + SEE],
    usdcCustody: ['Custody to confirm', 'Who holds USDC balances for customers.' + SEE]
  };
  function ph(key) {
    var p = PH[key];
    return '<span class="ph" tabindex="0" data-tip="' + esc(p[1]) + '">[' + esc(p[0]) + ']</span>';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function icon(id, cls) { return '<svg class="i' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; }

  /* ---------- Scenario: Northwind Labs, Inc. ---------- */
  var GROUPS = [
    { id: 'deposits', name: 'Deposits at partner banks', sw: 'sw-1', icon: 'landmark', prot: 'insured',
      tip: 'Deposits at partner banks. The coverage limit and the banks in the sweep are still to confirm.' + '' },
    { id: 'securities', name: 'Securities in your brokerage account', sw: 'sw-2', icon: 'layers', prot: 'uninsured',
      tip: 'Securities held in your name in a brokerage account. The custodian is still to confirm.' },
    { id: 'stablecoins', name: 'Stablecoins', sw: 'sw-3', icon: 'coin', prot: 'uninsured',
      tip: 'USDC is a stablecoin, not a deposit.' }
  ];
  function groupOf(id) { for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].id === id) return GROUPS[i]; }

  /* The one protection treatment, used everywhere: two states with placeholder labels until counsel sets the wording.
     Never green (green means Approved/Completed in the product's map) and never orange. */
  var PROT = {
    insured: { label: '[Protection label A]', icon: 'shield-check' },
    uninsured: { label: '[Protection label B]', icon: 'shield-off' }
  };
  function prot(g, opts) {
    opts = opts || {};
    var p = PROT[g.prot];
    return '<span class="prot prot-' + g.prot + '"' + (opts.tip === false ? '' : ' data-tip="' + esc(g.tip) + '"') +
      (opts.focus ? ' tabindex="0"' : '') + '>' + icon(p.icon, 'i-12') + p.label + '</span>';
  }
  var MATURITY = day(2026, 12, 17);
  var HOLDINGS = [
    { id: 'checking', group: 'deposits', name: 'Business Checking', cents: 41288015, rule: 'now' },
    { id: 'ics', group: 'deposits', name: 'Insured Cash Sweep', cents: 185000000, rule: 'unknown', ph: 'sweep' },
    { id: 'mmf', group: 'securities', name: 'Money Market Fund', sub: 'DSHXX', cents: 120000000, rule: 'mmf' },
    { id: 'lt', group: 'securities', name: 'Liquid Treasuries', cents: 150000000, rule: 'lt' },
    { id: 'ust', group: 'securities', name: 'U.S. Treasuries', sub: '1 bill', cents: 100000000, face: true, rule: 'maturity' },
    { id: 'usdc', group: 'stablecoins', name: 'USDC', cents: 27763222, coin: 'USDC', rule: 'unknown', ph: 'conversion' }
  ];
  // Dev-only worst-case fixture for the break-ui pass: open index.html?data=worst. Not linked from the UI.
  if (/[?&]data=worst(&|$)/.test(location.search)) {
    HOLDINGS[0].cents = 350;                       // $3.50 left in checking
    HOLDINGS[1].cents = 2500000000000;             // $25,000,000,000.00 in the sweep
    HOLDINGS[2].cents = 99999999999;               // $999,999,999.99
    HOLDINGS[3].cents = 100;                       // $1.00 left after a withdrawal
    HOLDINGS[4].cents = 2475000000; HOLDINGS[4].sub = '12 bills, maturing Nov 5, 2026 to Oct 28, 2027';
    HOLDINGS[5].cents = 1;                         // 0.01 USDC dust
  }
  function byId(id) { for (var i = 0; i < HOLDINGS.length; i++) if (HOLDINGS[i].id === id) return HOLDINGS[i]; }

  /* The rule for each holding. Returns { late, early?, why } or null when the timing is unknown. */
  function cashBy(h) {
    var today = now.day;
    switch (h.rule) {
      case 'now': return { late: today, now: true };
      case 'mmf':
        if (isBiz(today) && now.min < CUTOFF) return { late: today, why: 'before' };
        return { late: nextBiz(today), why: isBiz(today) ? 'after' : 'closed' };
      case 'lt':
        var base = isBiz(today) ? today : nextBiz(today);
        return { early: addBiz(base, 1), late: addBiz(base, 2) };
      case 'maturity': return { late: MATURITY, maturity: true };
      default: return null;
    }
  }

  function amountHtml(h) {
    if (h.coin) return '<span>' + coin(h.cents, h.coin) + '</span><small>Counted 1:1 as ' + usd(h.cents) + '</small>';
    return '<span>' + usd(h.cents) + '</span>' + (h.face ? '<small>Face value</small>' : '');
  }

  function cashByHtml(h) {
    var cb = cashBy(h);
    if (!cb) return ph(h.ph);
    if (cb.now) return '<span>Available now</span>';
    if (h.rule === 'mmf') {
      return '<span>' + rel(cb.late) + '</span><small>' + (cb.why === 'before' ? 'If requested before 1 PM ET' : 'After the 1 PM ET cut-off') + '</small>';
    }
    if (h.rule === 'lt') return '<span>' + rel(cb.late) + '</span><small>As early as ' + rel(cb.early) + '</small>';
    if (cb.maturity) return '<span>Matures ' + fmtDay(cb.late) + '</span><small>Selling early ' + ph('sale') + '</small>';
    return '';
  }

  /* ---------- Render: card ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var totalCents = HOLDINGS.reduce(function (a, h) { return a + h.cents; }, 0);

  function groupCents(g) { return HOLDINGS.filter(function (h) { return h.group === g; }).reduce(function (a, h) { return a + h.cents; }, 0); }

  function renderCard() {
    $('total').innerHTML = compact(totalCents, 'round');

    // In Business Checking by today, the next business day, and the one after (later end of every range)
    var d0 = now.day, d1 = nextBiz(d0), d2 = nextBiz(d1);
    var inBy = function (d) { return HOLDINGS.reduce(function (a, h) { var cb = cashBy(h); return cb && cb.late <= d ? a + h.cents : a; }, 0); };
    var prev = 0;
    $('ladder').innerHTML = [d0, d1, d2].map(function (d, i) {
      var c = inBy(d), add = c - prev;
      var from = HOLDINGS.filter(function (h) { var cb = cashBy(h); return cb && cb.late <= d && (i === 0 || cb.late > [d0, d1][i - 1]); }).map(function (h) { return h.name; });
      var note = i === 0 ? (from.length > 1 ? 'Business Checking and ' + from.slice(1).join(', ') : 'Business Checking') : (add ? '+ ' + compact(add, 'floor') + ' ' + from.join(', ') : 'Nothing new arrives');
      prev = c;
      return '<li><span class="tile tile-sm" aria-hidden="true">' + icon(i === 0 ? 'wallet' : 'arrow-in') + '</span>' +
        '<span><b data-k="la' + i + '">' + compact(c, 'floor') + '</b><small data-k="ln' + i + '">' + note + '</small></span>' +
        '<span class="when" data-k="ld' + i + '">' + rel(d) + '</span></li>';
    }).join('');

    // Headline: the two questions, answered from the same numbers
    var dep = groupCents('deposits');
    $('lede').innerHTML = '<span class="num" data-k="lede1">' + compact(dep, 'round') + '</span> is [Protection label A]. ' +
      '<span class="num" data-k="lede2">' + compact(inBy(d1), 'floor') + '</span> can be in Business Checking <span data-k="lede3">' + (inBy(d0) === inBy(d1) ? 'today' : 'by ' + fmtDay(d1)) + '</span>.';

    $('legend').innerHTML = GROUPS.map(function (g) {
      return '<li><i class="' + g.sw + '" aria-hidden="true"></i><b>' + g.name + '</b><span class="num">' + compact(groupCents(g.id), 'round') + '</span><span class="legend-prot">' + prot(g, { focus: true }) + '</span></li>';
    }).join('');

    // Section summary: the same two states, totalled
    var sumBy = function (state) { return GROUPS.filter(function (g) { return g.prot === state; }).reduce(function (a, g) { return a + groupCents(g.id); }, 0); };
    $('protSummary').innerHTML =
      '<li>' + prot({ prot: 'insured', tip: GROUPS[0].tip }, { focus: true }) + '<span class="num">' + compact(sumBy('insured'), 'round') + '</span></li>' +
      '<li>' + prot({ prot: 'uninsured', tip: 'Securities and stablecoins. Wording to confirm.' }, { focus: true }) + '<span class="num">' + compact(sumBy('uninsured'), 'round') + '</span></li>';

    // Proportional bar, chart series colours, never orange
    $('splitbar').innerHTML = GROUPS.map(function (g) {
      var c = groupCents(g.id);
      return '<span class="' + g.sw + '" style="flex:' + c + '"></span>';
    }).join('');
    $('splitbar').setAttribute('aria-label', GROUPS.map(function (g) {
      return g.name + ' ' + Math.round(groupCents(g.id) / totalCents * 100) + '%';
    }).join(', '));

    var html = '<div class="h-head h-cols" role="row">' +
      '<span role="columnheader">Holding</span>' +
      '<span role="columnheader">Protection</span>' +
      '<span role="columnheader"><span class="tip-trigger" tabindex="0" data-tip="If you withdraw now, the date the cash is in Business Checking. For a range, the later end. Weekends and federal bank holidays don’t count.">Cash by ' + icon('info', 'i-12') + '</span></span>' +
      '<span role="columnheader" class="r">Amount</span><span aria-hidden="true"></span></div>';
    GROUPS.forEach(function (g) {
      html += '<div role="rowgroup">';
      var items = HOLDINGS.filter(function (h) { return h.group === g.id; });
      var share = Math.round(groupCents(g.id) / totalCents * 100);
      html += '<div class="h-group h-cols" role="row">' +
        '<span class="h-group-name" role="rowheader"><i class="sw ' + g.sw + '" aria-hidden="true"></i><b>' + g.name + '</b></span>' +
        '<span class="h-gprot" role="cell">' + prot(g, { focus: true }) + '</span>' +
        '<span class="h-share" role="cell"><span class="meter" aria-hidden="true"><span class="' + g.sw + '" style="width:' + Math.max(share, 1) + '%"></span></span>' + (share < 1 ? '<1' : share) + '% of total</span>' +
        '<span class="amt" role="cell">' + compact(groupCents(g.id), 'round') + '</span><span aria-hidden="true"></span></div>';
      items.forEach(function (h) {
        html += '<button type="button" class="h-row h-cols" role="row" data-open="' + h.id + '" aria-haspopup="dialog" aria-expanded="false">' +
          '<span class="h-name" role="cell"><b>' + h.name + '</b>' + (h.sub ? '<small>' + h.sub + '</small>' : '') + '</span>' +
          '<span class="h-prot" role="cell">' + prot(g, { tip: false }) + '</span>' +
          '<span class="cb" role="cell" data-k="cb-' + h.id + '">' + cashByHtml(h) + '</span>' +
          '<span class="amt" role="cell">' + amountHtml(h) + '</span>' +
          icon('chevron-right', 'chev') + '</button>';
      });
      html += '</div>';
    });
    $('holdings').innerHTML = html;
  }

  /* ---------- Holding panel content ---------- */
  var GROUP_BADGE = { deposits: 'Deposits at partner banks', securities: 'Securities in your brokerage account', stablecoins: 'Stablecoins' };

  function detailRows(rows) {
    return '<dl class="details">' + rows.map(function (r) { return '<div class="detail"><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>';
  }

  function withdrawBox(h) {
    var cb = cashBy(h), head, line;
    if (h.rule === 'now') { head = 'Available now'; line = 'This is your Business Checking balance.'; }
    else if (h.rule === 'mmf') {
      head = 'Cash in checking by ' + (cb.late === now.day ? 'today, ' + fmtDay(cb.late) : fmtDay(cb.late));
      line = cb.why === 'before'
        ? 'Same day, if requested before the 1 PM ET cut-off.'
        : cb.why === 'after'
          ? 'It’s after the 1 PM ET cut-off on a ' + WD_LONG[dow(now.day)] + ', so it counts from ' + WD_LONG[dow(cb.late)] + '.'
          : 'Banks are closed today, so it counts from ' + WD_LONG[dow(cb.late)] + '.';
    } else if (h.rule === 'lt') {
      head = 'Cash in checking by ' + fmtDay(cb.late);
      line = 'As early as ' + fmtDay(cb.early) + '. 1 to 2 business days, counted from today ' + ph('ltCutoff');
    } else if (h.rule === 'maturity') {
      head = 'If you sell now ' + ph('sale');
      line = 'Held to maturity, it pays its face value on ' + fmtDayYear(MATURITY) + '.';
    } else { head = ph(h.ph); line = 'No date is shown until the timing is confirmed.'; }
    return '<section class="withdraw" aria-label="If you withdraw now"><h3>If you withdraw now</h3><p class="balance-sm" data-k="wd-head">' + head + '</p><p data-k="wd-line">' + line + '</p></section>';
  }

  var PROTECT_SEC = '%p<span class="prot-note">Held in your name at %c</span>';
  function overview(h) {
    var rows;
    var g = groupOf(h.group);
    var sec = function () { return PROTECT_SEC.replace('%p', prot(g, { focus: true })).replace('%c', ph('custodian')); };
    switch (h.id) {
      case 'checking': rows = [
        ['Protection', prot(g, { focus: true })],
        ['Held at', ph('partnerBank')],
        ['How fast it becomes cash', 'Already in Business Checking']]; break;
      case 'ics': rows = [
        ['Protection', prot(g, { focus: true }) + '<span class="prot-note">' + ph('coverage') + '</span>'],
        ['Held at', ph('sweepBanks')],
        ['How fast it becomes cash', ph('sweep')]]; break;
      case 'mmf': rows = [
        ['Protection', sec()],
        ['Invests in', 'Dreyfus Institutional Preferred Government Money Market Fund (DSHXX)'],
        ['Held at', ph('custodian')],
        ['How fast it becomes cash', '0 to 1 business days. Same day if you withdraw before 1 PM US Eastern time.']]; break;
      case 'lt': rows = [
        ['Protection', sec()],
        ['Invests in', 'U.S. Treasury Bills with a target maturity of 3 weeks or less from the date of initial investment'],
        ['Held at', ph('custodian')],
        ['How fast it becomes cash', '1 to 2 business days'],
        ['Auto-roll', 'On. Next maturity ' + fmtDay(day(2026, 11, 19)) + ', then into new bills of 3 weeks or less.']]; break;
      case 'ust': rows = [
        ['Protection', sec()],
        ['Holding', 'One U.S. Treasury Bill, ' + usd(h.cents) + ' face value'],
        ['Matures', fmtDayYear(MATURITY)],
        ['At maturity', ph('maturity')],
        ['Selling early', ph('sale')]]; break;
      case 'usdc': rows = [
        ['Protection', prot(g, { focus: true })],
        ['Balance', coin(h.cents, 'USDC') + '. Counted as ' + usd(h.cents) + ' in your total, at 1 USDC = $1.00.'],
        ['Held at', ph('usdcCustody')],
        ['Converting to USD', ph('conversion')]]; break;
    }
    return withdrawBox(h) + detailRows(rows);
  }

  var ACTIVITY = {
    lt: [
      ['Thu, Nov 19', 'Roll', 'Into a new bill of 3 weeks or less', 'Auto-roll', null, ['blue', 'Queued']],
      ['Thu, Oct 29', 'Roll', 'Into a bill maturing Thu, Nov 19', 'Auto-roll', null, ['green', 'Completed']],
      ['Thu, Oct 8', 'Roll', 'Into a bill maturing Thu, Oct 29', 'Auto-roll', null, ['green', 'Completed']],
      ['Thu, Sep 17', 'Buy', 'From Business Checking', 'Dana Whitfield', 150000000, ['green', 'Completed']]
    ],
    mmf: [
      ['Thu, Oct 1', 'Buy', 'From Business Checking', 'Dana Whitfield', 20000000, ['green', 'Completed']],
      ['Fri, Aug 14', 'Buy', 'From Business Checking', 'Dana Whitfield', 100000000, ['green', 'Completed']]
    ]
  };
  function activity(h) {
    var rows = ACTIVITY[h.id];
    if (!rows) {
      return '<div class="empty"><span class="empty-icon">' + icon('inbox') + '</span><h3>No activity to display</h3><p>This prototype has sample activity for Liquid Treasuries and Money Market Fund only.</p></div>';
    }
    return '<table class="act"><thead><tr><th>Date</th><th>Activity</th><th class="hide-sm">Initiated by</th><th class="r hide-sm">Amount</th><th class="r">Status</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td class="tab">' + r[0] + '</td><td>' + r[1] + '<small>' + r[2] + '</small>' + (r[4] ? '<small class="show-sm tab">' + usd(r[4]) + '</small>' : '') + '</td><td class="hide-sm">' + r[3] + '</td>' +
          '<td class="r tab hide-sm">' + (r[4] ? usd(r[4]) : '-') + '</td><td class="r"><span class="badge badge-' + r[5][0] + '">' + r[5][1] + '</span></td></tr>';
      }).join('') + '</tbody></table>';
  }

  /* ---------- Dialog (revision 4: a centered modal, was a right side panel) ---------- */
  var panel = $('panel'), overlay = $('overlay');
  var panelState = null; // { kind: 'holding', id, tab } | { kind: 'planner' }
  var lastTrigger = null;

  function openPanel(state, trigger) {
    if (trigger) lastTrigger = trigger;
    panelState = state;
    renderPanel();
    markRows();
    if (panel.hidden) {
      panel.hidden = false;
      void panel.offsetWidth; // let the closed state paint so the fade and scale run
    }
    panel.dataset.open = 'true';
    overlay.dataset.open = 'true';
    document.body.style.overflow = 'hidden';
    setTimeout(function () { var t = $('panelTitle'); if (t) t.focus({ preventScroll: true }); }, 30);
  }
  function closePanel() {
    if (panel.hidden) return;
    panel.dataset.open = 'false';
    overlay.dataset.open = 'false';
    document.body.style.overflow = '';
    panelState = null;
    markRows();
    hideTip(true);
    setTimeout(function () { if (panel.dataset.open !== 'true') panel.hidden = true; }, 160); // exit is 150ms
    if (lastTrigger && !document.contains(lastTrigger) && lastTrigger.dataset && lastTrigger.dataset.open) {
      lastTrigger = document.querySelector('.h-row[data-open="' + lastTrigger.dataset.open + '"]'); // the card re-renders when "now" changes
    }
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus({ preventScroll: true });
  }
  function markRows() {
    document.querySelectorAll('.h-row').forEach(function (r) {
      r.setAttribute('aria-expanded', panelState && panelState.kind === 'holding' && panelState.id === r.dataset.open ? 'true' : 'false');
    });
  }

  function renderPanel() {
    if (!panelState) return;
    if (panelState.kind === 'holding') renderHolding(); else renderPlanner();
  }

  function renderHolding() {
    var h = byId(panelState.id), tab = panelState.tab || 'overview';
    var amt = h.coin ? coin(h.cents, h.coin) : usd(h.cents) + (h.face ? ' face' : '');
    var gIcon = GROUPS.filter(function (g) { return g.id === h.group; })[0].icon;
    $('panelHead').innerHTML = '<span class="tile" aria-hidden="true">' + icon(gIcon) + '</span><h2 class="panel-title" id="panelTitle" tabindex="-1">' + h.name + '</h2>' +
      '<div class="panel-sub"><span class="balance-md">' + amt + '</span>' + prot(groupOf(h.group), { focus: true }) + '<span class="badge badge-gray">' + GROUP_BADGE[h.group] + '</span></div>';
    $('panelBody').innerHTML =
      '<div class="tabs" role="tablist" aria-label="' + h.name + '">' +
      '<button class="tab-btn" role="tab" id="tab-ov" aria-controls="tp-ov" aria-selected="' + (tab === 'overview') + '" tabindex="' + (tab === 'overview' ? 0 : -1) + '" data-tab="overview">Overview</button>' +
      '<button class="tab-btn" role="tab" id="tab-ac" aria-controls="tp-ac" aria-selected="' + (tab === 'activity') + '" tabindex="' + (tab === 'activity' ? 0 : -1) + '" data-tab="activity">Activity</button></div>' +
      '<div class="tabpanel" role="tabpanel" id="tp-ov" aria-labelledby="tab-ov"' + (tab === 'overview' ? '' : ' hidden') + '>' + overview(h) + '</div>' +
      '<div class="tabpanel" role="tabpanel" id="tp-ac" aria-labelledby="tab-ac"' + (tab === 'activity' ? '' : ' hidden') + '>' + activity(h) + '</div>';
    $('panelFoot').innerHTML =
      '<button class="btn btn-outline" type="button" data-action="planner">' + icon('calendar') + 'Check cash by a date</button>' +
      '<span data-tip="You withdraw in the existing Treasury flow, which this prototype does not include." tabindex="0"><button class="btn btn-primary" type="button" disabled>Withdraw</button></span>';
  }

  /* ---------- Planner ---------- */
  var plan = { amount: '1,800,000.00', date: iso(day(2026, 11, 11)), result: null, errors: {}, stale: false, busy: false };

  function parseAmount(s) {
    var t = String(s || '').replace(/[$,\s]/g, '');
    if (t === '') return { err: 'Enter an amount' };
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return { err: 'Enter an amount in dollars, like 250,000.00' };
    var parts = t.split('.');
    var cents = parseInt(parts[0], 10) * 100 + (parts[1] ? parseInt(parts[1].padEnd(2, '0'), 10) : 0);
    if (!(cents > 0)) return { err: 'Enter an amount' };
    if (parts[0].length > 12) return { err: 'Enter an amount under $1,000,000,000,000.00' };
    return { cents: cents };
  }
  function validate() {
    var errs = {}, a = parseAmount(plan.amount), d = fromIso(plan.date);
    if (a.err) errs.amount = a.err;
    if (d === null) errs.date = 'Pick a date';
    else if (d < now.day) errs.date = 'Pick today or a later date';
    else if (d > CAL_END) errs.date = 'Pick a date in 2026 or 2027. The holiday calendar stops there.';
    return { errs: errs, cents: a.cents, day: d };
  }

  function compute(cents, target) {
    var res = { asked: target, target: target, adjust: null, used: [], late: [], notCounted: [], cents: cents };
    if (!isBiz(target)) {
      var p = prevBiz(target);
      res.adjust = HOLIDAYS[target]
        ? fmtMD(target) + ' is ' + HOLIDAYS[target] + ', a bank holiday. Plan for ' + fmtDay(p) + '.'
        : fmtMD(target) + ' is a ' + WD_LONG[dow(target)] + '. Plan for ' + fmtDay(p) + '.';
      res.target = p;
    }
    var t = res.target, left = cents;
    ['checking', 'mmf', 'lt', 'ust'].forEach(function (id) {
      var h = byId(id), cb = cashBy(h);
      if (cb.late > t) { res.late.push({ h: h, cb: cb }); return; }
      if (left <= 0) return;
      var take = Math.min(left, h.cents);
      left -= take;
      res.used.push({ h: h, cb: cb, take: take });
    });
    res.notCounted = [byId('ics'), byId('usdc')];
    res.short = Math.max(0, left);
    res.covered = cents - res.short;
    return res;
  }

  function requestBy(u, t) {
    var h = u.h;
    if (h.rule === 'now') return 'Already in Business Checking';
    if (h.rule === 'mmf') return 'Request before 1 PM ET ' + (t === now.day ? 'today' : 'on ' + fmtDay(t));
    if (h.rule === 'lt') {
      var r = subBiz(t, 2), base = isBiz(now.day) ? now.day : nextBiz(now.day);
      if (r <= base) return 'Request today';
      return 'Request by ' + fmtDay(r) + ' ' + ph('ltCutoff');
    }
    if (h.rule === 'maturity') return 'Matures ' + fmtDay(MATURITY) + ' ' + ph('maturity');
    return '';
  }

  function resultHtml(r) {
    var t = r.target, out = '';
    if (r.adjust) out += '<p class="adjust">' + icon('calendar') + '<span data-k="adj">' + r.adjust + '</span></p>';
    if (r.short === 0) {
      out += '<div><p class="verdict" data-k="verdict"><span class="num">' + usd(r.cents) + '</span> can be in Business Checking by ' + fmtDay(t) + '.</p>' +
        '<p class="verdict-sub">Using the holdings below, in this order. Nothing is sold or moved.</p></div>';
    } else {
      out += '<div><p class="verdict" data-k="verdict"><span class="num">' + usd(r.short) + '</span> short by ' + fmtDay(t) + '.</p>' +
        '<p class="verdict-sub">' + usd(r.covered) + ' of ' + usd(r.cents) + ' can be in Business Checking by then. Insured Cash Sweep and USDC are not counted until their timing is confirmed.</p></div>';
    }
    if (r.used.length) {
      out += '<div><p class="src-title"><span>From, in this order</span><span>Amount</span></p><ol>';
      r.used.forEach(function (u, i) {
        var of = u.take < u.h.cents ? '<small>of ' + usd(u.h.cents) + '</small>' : '';
        out += '<li class="src"><span class="src-n" aria-hidden="true">' + (i + 1) + '</span>' +
          '<span class="src-name"><span class="src-line">' + u.h.name + prot(groupOf(u.h.group), { focus: true }) + '</span><small data-k="rb-' + u.h.id + '">' + requestBy(u, t) + '</small></span>' +
          '<span class="amt"><b>' + usd(u.take) + '</b>' + of + '</span></li>';
      });
      out += '</ol><p class="src-total"><span>Total</span><span class="num">' + usd(r.covered) + '</span></p></div>';
    }
    if (r.late.length) {
      out += '<div><p class="src-title"><span>Left in place, can’t arrive by ' + fmtMD(t) + '</span><span>Amount</span></p><ul>';
      r.late.forEach(function (l) {
        var why = l.cb.maturity ? 'Matures ' + fmtDay(l.cb.late) + '. Selling early ' + ph('sale') : 'Earliest ' + fmtDay(l.cb.late);
        out += '<li class="src"><span class="src-n dash" aria-hidden="true">' + icon('x', 'i-12') + '</span><span class="src-name"><span class="src-line">' + l.h.name + prot(groupOf(l.h.group), { focus: true }) + '</span><small data-k="lt-' + l.h.id + '">' + why + '</small></span>' +
          '<span class="amt"><b>' + usd(l.h.cents) + '</b>' + (l.h.face ? '<small>Face value</small>' : '') + '</span></li>';
      });
      out += '</ul></div>';
    }
    out += '<div><p class="src-title"><span>Not counted, timing not confirmed</span><span>Amount</span></p><ul>';
    r.notCounted.forEach(function (h) {
      out += '<li class="src"><span class="src-n dash" aria-hidden="true">' + icon('info', 'i-12') + '</span><span class="src-name"><span class="src-line">' + h.name + prot(groupOf(h.group), { focus: true }) + '</span><small>' + ph(h.ph) + '</small></span>' +
        '<span class="amt"><b>' + (h.coin ? coin(h.cents, h.coin) : usd(h.cents)) + '</b></span></li>';
    });
    out += '</ul></div>';
    return out;
  }

  function renderPlanner() {
    $('panelHead').innerHTML = '<span class="tile" aria-hidden="true">' + icon('calendar') + '</span><h2 class="panel-title" id="panelTitle" tabindex="-1">Withdraw cash by a date</h2>' +
      '<p class="panel-desc">See which holdings can be in Business Checking by the date you need it, and when to ask for each. Nothing is sold or moved.</p>';
    var e = plan.errors;
    $('panelBody').innerHTML =
      '<form class="plan-form" id="planForm" novalidate>' +
      '<div class="field"><label for="amt">Amount</label><div class="input-wrap"><span class="input-prefix">$</span>' +
      '<input class="input input-money" id="amt" name="amt" inputmode="decimal" autocomplete="off" value="' + esc(plan.amount) + '" aria-invalid="' + !!e.amount + '" aria-describedby="amtErr"></div>' +
      '<p class="field-error" id="amtErr">' + (e.amount || '') + '</p></div>' +
      '<div class="field"><label for="dt">Needed in Business Checking by</label>' +
      '<input class="input" type="date" id="dt" name="dt" min="' + iso(now.day) + '" max="' + iso(CAL_END) + '" value="' + esc(plan.date) + '" aria-invalid="' + !!e.date + '" aria-describedby="dtErr">' +
      '<p class="field-error" id="dtErr">' + (e.date || '') + '</p></div>' +
      '<button class="btn btn-primary plan-submit" type="submit" id="planSubmit"' + (plan.busy ? ' aria-busy="true" disabled' : '') + '>' +
      '<svg class="i spinner" aria-hidden="true"><use href="#i-spinner"/></svg>Check date</button>' +
      '</form>' +
      '<p class="stale-line" id="staleLine"' + (plan.stale ? '' : ' hidden') + '>Inputs changed. Check again to update.</p>' +
      '<div class="result" id="result" aria-live="polite" data-stale="' + plan.stale + '">' + (plan.result ? resultHtml(plan.result) : '') + '</div>';
    $('panelFoot').innerHTML = '<span class="note">To withdraw, use the Treasury flow.</span><button class="btn btn-outline" type="button" data-action="close">Done</button>';
  }

  function runPlanner(fromUser) {
    var v = validate();
    plan.errors = v.errs;
    if (Object.keys(v.errs).length) {
      plan.stale = !!plan.result;
      renderPlanner();
      var bad = v.errs.amount ? $('amt') : $('dt');
      if (fromUser && bad) bad.focus();
      return;
    }
    if (!fromUser) { plan.result = compute(v.cents, v.day); plan.stale = false; renderPlanner(); return; }
    plan.busy = true; renderPlanner();
    setTimeout(function () {
      plan.busy = false;
      plan.result = compute(v.cents, v.day);
      plan.stale = false;
      plan.amount = usd(v.cents).replace('$', '');
      if (panelState && panelState.kind === 'planner') { renderPlanner(); $('planSubmit').focus(); }
    }, 350);
  }

  /* ---------- Events ---------- */
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-open], [data-action], [data-tab], [data-now], #openPlanner, #panelClose, #overlay, #menuBtn, #sheetOverlay, #protoToggle');
    if (!t) return;
    if (t.id === 'openPlanner') { openPanel({ kind: 'planner' }, t); return; }
    if (t.id === 'panelClose' || t.id === 'overlay') { closePanel(); return; }
    if (t.id === 'menuBtn') { setSheet(true); return; }
    if (t.id === 'sheetOverlay') { setSheet(false); return; }
    // The open panel and overlay also carry data-open="true", so only a real holding id opens a panel
    if (t.dataset.open && byId(t.dataset.open)) { openPanel({ kind: 'holding', id: t.dataset.open, tab: 'overview' }, t); return; }
    if (t.dataset.tab && panelState) { selectTab(t.dataset.tab, true); return; }
    if (t.dataset.action === 'planner') { openPanel({ kind: 'planner' }); return; }
    if (t.dataset.action === 'close') { closePanel(); return; }
    if (t.dataset.now) { setNow(t.dataset.now); }
    if (t.id === 'protoToggle') { var ex = $('proto').dataset.expanded === 'true'; $('proto').dataset.expanded = !ex; t.setAttribute('aria-expanded', !ex); }
  });

  function selectTab(tab, focus) {
    panelState.tab = tab;
    var ov = tab === 'overview';
    $('tab-ov').setAttribute('aria-selected', ov); $('tab-ov').tabIndex = ov ? 0 : -1;
    $('tab-ac').setAttribute('aria-selected', !ov); $('tab-ac').tabIndex = ov ? -1 : 0;
    $('tp-ov').hidden = !ov; $('tp-ac').hidden = ov;
    if (focus) (ov ? $('tab-ov') : $('tab-ac')).focus();
  }

  document.addEventListener('submit', function (ev) {
    if (ev.target.id !== 'planForm') return;
    ev.preventDefault();
    runPlanner(true);
  });
  document.addEventListener('input', function (ev) {
    if (ev.target.id === 'amt') plan.amount = ev.target.value;
    else if (ev.target.id === 'dt') plan.date = ev.target.value;
    else return;
    if (plan.result && !plan.stale) {
      plan.stale = true;
      $('result').dataset.stale = 'true';
      $('staleLine').hidden = false;
    }
    var errEl = ev.target.id === 'amt' ? $('amtErr') : $('dtErr');
    if (errEl.textContent) { errEl.textContent = ''; ev.target.setAttribute('aria-invalid', 'false'); }
  });
  document.addEventListener('focusout', function (ev) {
    if (ev.target.id !== 'amt') return;
    var a = parseAmount(ev.target.value);
    if (!a.err) { plan.amount = usd(a.cents).replace('$', ''); ev.target.value = plan.amount; }
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      if (tip.dataset.open === 'true') { hideTip(true); return; }
      if (!panel.hidden) { closePanel(); return; }
      if ($('sidebar').dataset.open === 'true') { setSheet(false); return; }
    }
    // Tabs: arrow keys
    if (ev.target.classList && ev.target.classList.contains('tab-btn') && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) {
      ev.preventDefault();
      selectTab(ev.target.dataset.tab === 'overview' ? 'activity' : 'overview', true);
    }
    // Focus trap inside the dialog
    if (ev.key === 'Tab' && !panel.hidden) {
      var f = Array.prototype.filter.call(panel.querySelectorAll('button:not([disabled]), input, [tabindex="0"]'), function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  });

  /* ---------- Mobile sheet ---------- */
  function setSheet(open) {
    $('sidebar').dataset.open = open; $('sheetOverlay').dataset.open = open;
    $('menuBtn').setAttribute('aria-expanded', open);
    if (open) $('sidebar').querySelector('.sb-item').focus(); else $('menuBtn').focus();
  }

  /* ---------- "Now" control: recompute, crossfade only what changed ---------- */
  function snapshot() {
    var m = {};
    document.querySelectorAll('[data-k]').forEach(function (el) { m[el.dataset.k] = el.textContent; });
    return m;
  }
  function setNow(k) {
    if (NOWS[k] === now) return;
    var before = snapshot();
    now = NOWS[k];
    document.querySelectorAll('#nowSeg button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.now === k); });
    renderCard();
    markRows();
    if (panelState) {
      if (panelState.kind === 'planner' && plan.result && !plan.stale) {
        var v = validate();
        plan.errors = v.errs;
        if (!Object.keys(v.errs).length) plan.result = compute(v.cents, v.day);
      }
      var tab = panelState.tab;
      renderPanel();
      if (panelState.kind === 'holding') selectTab(tab || 'overview', false);
    }
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('[data-k]').forEach(function (el) {
      if (before[el.dataset.k] === undefined || before[el.dataset.k] === el.textContent || !el.animate) return;
      el.animate(reduce
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 0, filter: 'blur(2px)' }, { opacity: 1, filter: 'blur(0)' }],
        { duration: 200, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
    });
  }

  /* ---------- Tooltip (inverted, code style) ---------- */
  var tip = $('tooltip'), tipTimer = null, tipFor = null, lastHide = 0;
  function showTip(el, instant) {
    clearTimeout(tipTimer);
    var go = function () {
      tipFor = el;
      tip.textContent = el.dataset.tip;
      tip.dataset.instant = instant || (Date.now() - lastHide < 400) ? 'true' : 'false';
      tip.style.left = '0px'; tip.style.top = '0px';
      var r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      var x = Math.min(Math.max(8, r.left + r.width / 2 - tw / 2), window.innerWidth - tw - 8);
      var above = r.top - th - 8 > 8;
      var y = above ? r.top - th - 6 : r.bottom + 6;
      tip.style.setProperty('--origin', (above ? 'bottom ' : 'top ') + Math.round(r.left + r.width / 2 - x) + 'px');
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
      tip.dataset.open = 'true';
    };
    if (instant || Date.now() - lastHide < 400) go(); else tipTimer = setTimeout(go, 300);
  }
  function hideTip(force) {
    clearTimeout(tipTimer);
    if (tip.dataset.open === 'true') lastHide = force ? 0 : Date.now();
    tip.dataset.open = 'false'; tipFor = null;
  }
  document.addEventListener('mouseover', function (ev) {
    var el = ev.target.closest('[data-tip]');
    if (el && el !== tipFor) showTip(el, false);
    else if (!el && tipFor) hideTip(false);
  });
  document.addEventListener('focusin', function (ev) {
    var el = ev.target.closest && ev.target.closest('[data-tip]');
    if (el && ev.target.matches(':focus-visible')) showTip(el, true); else if (tipFor) hideTip(false);
  });
  document.addEventListener('scroll', function () { if (tipFor) hideTip(true); }, true);

  /* ---------- Boot ---------- */
  renderCard();
  (function () { var v = validate(); plan.result = compute(v.cents, v.day); })();

  // Deep links for review and screenshots: #am, #planner, #holding-lt, #holding-lt-activity (combine with "&")
  (function () {
    var parts = location.hash.replace('#', '').split('&');
    if (parts.indexOf('am') > -1) setNow('am');
    parts.forEach(function (p) {
      if (p === 'planner') openPanel({ kind: 'planner' });
      var m = /^holding-(\w+?)(-activity)?$/.exec(p);
      if (m && byId(m[1])) openPanel({ kind: 'holding', id: m[1], tab: m[2] ? 'activity' : 'overview' });
    });
  })();

  // Debug hook for the self-check (not used by the UI)
  window.__proto = { compactText: compactText, compute: compute, cashBy: cashBy, byId: byId, fmtDay: fmtDay, day: day, setNow: setNow, isBiz: isBiz };
})();
