/*
 * UI controller: rendering, navigation, autosave, glossary, exports.
 */
(function () {
  'use strict';
  var PIA = window.PIA;
  var E = PIA.engine, Q = PIA.questions, R = PIA.report, N = PIA.nist, cfg = PIA.config;
  var esc = R.esc;

  /* ---------- Storage (falls back to memory when localStorage is unavailable) ---------- */
  var memory = {};
  function loadAll() {
    try { var raw = localStorage.getItem(cfg.storageKey); return raw ? JSON.parse(raw) : memory; } catch (e) { return memory; }
  }
  function saveAll(all) {
    memory = all;
    try { localStorage.setItem(cfg.storageKey, JSON.stringify(all)); return true; } catch (e) { return false; }
  }

  // Inside the claude.ai artifact viewer, files are saved through its downloads capability, and printing is unavailable.
  var inViewer = !!(window.claude && typeof window.claude.use === 'function');
  var hostDownloads = null;

  var app = { view: 'home', cur: null, step: 'about', idx: 0, errors: {}, riskIds: [], navOpen: false };
  var saveTimer = null;

  function $(sel) { return document.querySelector(sel); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function now() { return new Date().toISOString(); }

  function newAssessment(answers) {
    var t = now();
    return { id: uid(), createdAt: t, updatedAt: t, status: 'draft', answers: answers || {}, risks: {}, step: 'about', idx: 0 };
  }

  function persist(immediate) {
    if (!app.cur) return;
    clearTimeout(saveTimer);
    var doSave = function () {
      app.cur.updatedAt = now();
      app.cur.step = app.step;
      app.cur.idx = app.idx;
      var all = loadAll();
      all[app.cur.id] = app.cur;
      var ok = saveAll(all);
      $('#save-state').textContent = ok ? 'Saved on this device' : 'Not saved: storage is unavailable, so download a backup';
    };
    if (immediate) doSave(); else { $('#save-state').textContent = 'Saving…'; saveTimer = setTimeout(doSave, 400); }
  }

  /* ---------- Text helpers ---------- */
  // Escape, then turn [[shown|key]] glossary references into buttons.
  function t(text) {
    return esc(text || '').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, function (m, shown, key) {
      var k = (key || shown).toLowerCase();
      return PIA.glossary[k] ? '<button type="button" class="term" data-term="' + esc(k) + '">' + shown + '</button>' : shown;
    });
  }
  function chip(label, cls, title) { return '<span class="chip ' + (cls || '') + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + esc(label) + '</span>'; }
  function ratingChip(r) { return chip(r, String(r).toLowerCase().replace(/\s+/g, '-')); }
  function isBlank(v) { return E.isBlank(v); }

  /* ---------- Steps ---------- */
  function screeningDone(a, c) {
    var sec = Q.sections[1];
    return c.screening.started && E.sectionProgress(sec, a, c).complete;
  }

  function getSteps(a, c) {
    var tier = c.screening.tier;
    var done = screeningDone(a, c);
    var steps = [
      { id: 'about', title: 'Project', kind: 'section' },
      { id: 'screening', title: 'Quick check', kind: 'section' },
      { id: 'threshold', title: 'Your result', kind: 'result', locked: !done }
    ];
    if (done && tier !== 'none') {
      E.visibleSections(a, c).forEach(function (s) {
        if (s.id !== 'about' && s.id !== 'screening') steps.push({ id: s.id, title: s.short || s.title, kind: 'section' });
      });
      steps.push({ id: 'risks', title: 'Risks & actions', kind: 'risks' });
    }
    steps.push({ id: 'report', title: tier === 'none' ? 'Screening record' : 'Record for legal', kind: 'report', locked: !done });
    steps.forEach(function (s) {
      var sec = Q.sections.filter(function (x) { return x.id === s.id; })[0];
      if (sec) { s.section = sec; s.done = E.sectionProgress(sec, a, c).complete; }
      else if (s.id === 'threshold') s.done = done;
      else if (s.id === 'risks') s.done = done && evaluate(c).every(function (r) { return r.status !== 'open'; });
      else if (s.id === 'report') s.done = app.cur.status === 'submitted';
    });
    return steps;
  }

  function evaluate(c) { return E.evaluateRisks(c.answers, c, app.cur.risks); }

  /* ---------- Rendering ---------- */
  function render() {
    var active = document.activeElement;
    var focusId = active && active.id;
    hidePopover();
    $('#app').innerHTML = app.view === 'home' ? renderHome() : renderAssessment();
    $('#topbar-title').textContent = app.view === 'home' ? cfg.tagline : (app.cur.answers.project_name || 'New assessment');
    if (app.view === 'home') $('#save-state').textContent = '';
    if (focusId) { var el = document.getElementById(focusId); if (el) el.focus({ preventScroll: true }); }
  }

  function context() {
    var a = app.cur.answers;
    var c = E.context(a);
    var sec = Q.sections.filter(function (s) { return s.id === app.step; })[0];
    if (sec && E.prefill(sec, a, c)) { c = E.context(a); persist(); }
    return c;
  }

  function renderAssessment() {
    var a = app.cur.answers;
    var c = context();
    var steps = getSteps(a, c);
    var cur = steps.filter(function (s) { return s.id === app.step; })[0];
    if (!cur || cur.locked) { app.step = cur && cur.locked ? 'screening' : 'about'; cur = steps.filter(function (s) { return s.id === app.step; })[0]; }
    var i = steps.indexOf(cur);
    var main;
    if (cur.kind === 'section') main = cur.section.mode === 'stepper' ? renderStepper(cur.section, a, c, steps, i) : renderSection(cur.section, a, c, steps, i);
    else if (cur.kind === 'result') main = renderThreshold(a, c, steps, i);
    else if (cur.kind === 'risks') main = renderRisks(a, c, steps, i);
    else main = renderReport(a, c, steps, i);
    return '<div class="layout">' +
      '<nav class="stepnav' + (app.navOpen ? ' open' : '') + '" id="stepnav" aria-label="Assessment steps">' + renderNav(steps, i) + '</nav>' +
      '<main class="main" id="main">' + main + '</main>' +
      '<aside class="insights" id="insights" aria-label="What we\'ve found so far">' + renderInsights(a, c) + '</aside>' +
      '</div>';
  }

  function renderNav(steps, current) {
    var done = steps.filter(function (s) { return s.done; }).length;
    var pct = Math.round((done / steps.length) * 100);
    var html = '<div class="stepnav-mobile"><span class="eyebrow">Step ' + (current + 1) + ' of ' + steps.length + '</span>' +
      '<button class="btn btn-small" type="button" data-action="toggle-nav" aria-expanded="' + app.navOpen + '">' + (app.navOpen ? 'Hide steps' : 'All steps') + '</button></div>';
    html += '<div><div class="eyebrow" style="margin-bottom:6px">' + pct + '% complete</div><div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="Progress"><span style="width:' + pct + '%"></span></div></div>';
    html += '<ol class="steps">' + steps.map(function (s, i) {
      return '<li><button class="step-btn" type="button" data-action="goto" data-step="' + s.id + '"' +
        (i === current ? ' aria-current="step"' : '') + (s.done ? ' data-done="true"' : '') + (s.locked ? ' disabled title="Finish the quick check first"' : '') + '>' +
        '<span class="step-dot" aria-hidden="true">' + (s.done ? '✓' : i + 1) + '</span><span>' + esc(s.title) + '</span></button></li>';
    }).join('') + '</ol>';
    return html;
  }

  function renderInsights(a, c) {
    var s = c.screening;
    var html = '<div class="insight"><span class="eyebrow">Assessment level</span>';
    if (!s.tier) html += '<p class="muted">Answer the quick check and we\'ll tell you how much assessment this project needs.</p>';
    else {
      html += '<div class="tier-badge ' + s.tierInfo.tone + '">' + esc(s.tierInfo.short) + '</div>';
      html += '<p class="muted" style="font-size:var(--step-0)">' + esc(s.criteriaMet.length) + ' of 9 high-risk criteria met' + (s.mandatory.length ? ', plus a mandatory DPIA trigger' : '') + '.' + (screeningDone(a, c) ? '' : ' Finish the quick check to confirm.') + '</p>';
    }
    html += '</div>';
    if (s.tier && s.tier !== 'none') {
      var risks = evaluate(c);
      html += '<div class="insight"><span class="eyebrow">Risks spotted (' + risks.length + ')</span>';
      if (!risks.length) html += '<p class="muted" style="font-size:var(--step-0)">Nothing yet. Risks appear here as you answer.</p>';
      else {
        html += '<ul class="insight-list">' + risks.slice(0, 6).map(function (r) {
          return '<li><span>' + esc(r.title) + '</span>' + ratingChip(r.rating) + '</li>';
        }).join('') + '</ul>';
        if (risks.length > 6) html += '<p class="muted" style="font-size:var(--step-0)">+ ' + (risks.length - 6) + ' more</p>';
        if (screeningDone(a, c)) html += '<button class="btn btn-small" type="button" data-action="goto" data-step="risks">Review risks</button>';
      }
      html += '</div>';
    }
    if (s.unsure.length) {
      html += '<div class="insight"><span class="eyebrow">To confirm (' + s.unsure.length + ')</span><p class="muted" style="font-size:var(--step-0)">You answered "not sure" to these. We\'re assuming the cautious answer until someone confirms.</p>' +
        '<ul class="insight-list">' + s.unsure.map(function (u) { return '<li><button class="term" type="button" data-action="jump-q" data-q="' + u.id + '">' + esc(u.label) + '</button></li>'; }).join('') + '</ul></div>';
    }
    html += '<p class="muted" style="font-size:var(--step-0)">Your answers save automatically in this browser. Use "Back up" on the last step to keep a copy.</p>';
    return html;
  }

  /* ----- Questions ----- */
  function renderQuestion(q, a, opts) {
    opts = opts || {};
    var v = a[q.id];
    var id = 'q_' + q.id;
    var invalid = app.errors[q.id];
    var labelTag = (q.type === 'text' || q.type === 'email' || q.type === 'date' || q.type === 'textarea') ? 'label for="' + id + '"' : 'div';
    var html = '<div class="qcard' + (invalid ? ' invalid' : '') + '" id="card_' + q.id + '">';
    html += '<' + labelTag + ' class="qlabel" id="lbl_' + q.id + '">' + t(q.label) + (q.optional ? ' <span class="opt">(optional)</span>' : '') + '</' + labelTag.split(' ')[0] + '>';
    if (q.help) html += '<p class="qhelp" id="help_' + q.id + '">' + t(q.help) + '</p>';
    var describedBy = q.help ? ' aria-describedby="help_' + q.id + '"' : '';

    switch (q.type) {
      case 'text': case 'email': case 'date':
        html += '<input class="input" id="' + id + '" type="' + q.type + '" data-q="' + q.id + '" value="' + esc(v || '') + '"' + describedBy + (q.required ? ' required' : '') + '>';
        break;
      case 'textarea':
        html += '<textarea class="textarea" id="' + id + '" data-q="' + q.id + '"' + describedBy + '>' + esc(v || '') + '</textarea>';
        break;
      case 'yesno':
        html += '<div class="choices yn" role="radiogroup" aria-labelledby="lbl_' + q.id + '">' +
          [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']].map(function (o) {
            return '<label class="choice"><input type="radio" name="' + id + '" id="' + id + '_' + o[0] + '" value="' + o[0] + '" data-q="' + q.id + '"' + (v === o[0] ? ' checked' : '') + '><span>' + o[1] + '</span></label>';
          }).join('') + '</div>';
        break;
      case 'single':
      case 'multi':
        var multi = q.type === 'multi';
        var lastGroup = null;
        html += '<div class="choices" role="' + (multi ? 'group' : 'radiogroup') + '" aria-labelledby="lbl_' + q.id + '">';
        q.options.forEach(function (o) {
          if (o.group && o.group !== lastGroup) { html += '<div class="choice-group-title eyebrow">' + esc(o.group) + '</div>'; lastGroup = o.group; }
          var checked = multi ? (Array.isArray(v) && v.indexOf(o.value) !== -1) : v === o.value;
          html += '<label class="choice"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="' + id + '" id="' + id + '_' + o.value + '" value="' + esc(o.value) + '" ' +
            (multi ? 'data-multi="' + q.id + '"' + (o.exclusive ? ' data-exclusive="true"' : '') : 'data-q="' + q.id + '"') + (checked ? ' checked' : '') + '>' +
            '<span class="choice-text"><span>' + t(o.label) + '</span>' + (o.hint ? '<span class="choice-hint">' + t(o.hint) + '</span>' : '') + '</span></label>';
        });
        html += '</div>';
        break;
      case 'list':
        var rows = Array.isArray(v) && v.length ? v : [{}];
        html += '<div class="listtable-wrap"><table class="listtable"><thead><tr>' + q.columns.map(function (col) { return '<th scope="col">' + esc(col.label) + '</th>'; }).join('') + '<th><span class="sr-only">Remove</span></th></tr></thead><tbody>';
        rows.forEach(function (row, ri) {
          html += '<tr>' + q.columns.map(function (col) {
            var cid = id + '_' + ri + '_' + col.key;
            var aria = ' aria-label="' + esc(col.label + ', row ' + (ri + 1)) + '"';
            if (col.type === 'select') {
              return '<td><select class="select" id="' + cid + '" data-list="' + q.id + '" data-row="' + ri + '" data-col="' + col.key + '"' + aria + '>' +
                col.options.map(function (o) { return '<option value="' + o.value + '"' + ((row[col.key] || '') === o.value ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('') + '</select></td>';
            }
            return '<td><input class="input" id="' + cid + '" data-list="' + q.id + '" data-row="' + ri + '" data-col="' + col.key + '" placeholder="' + esc(col.placeholder || '') + '" value="' + esc(row[col.key] || '') + '"' + aria + '></td>';
          }).join('') + '<td><button class="btn btn-small btn-ghost" type="button" data-action="list-remove" data-q="' + q.id + '" data-row="' + ri + '" aria-label="Remove row ' + (ri + 1) + '">✕</button></td></tr>';
        });
        html += '</tbody></table></div><div><button class="btn btn-small" type="button" data-action="list-add" data-q="' + q.id + '">+ Add another</button></div>';
        break;
    }

    if (invalid) html += '<p class="qerror">Please answer this question to continue.</p>';
    if (v === 'unsure' || (Array.isArray(v) && v.indexOf('unsure') !== -1)) {
      html += '<p class="unsure-note">No problem. We\'ll assume the cautious answer for now and list this as something to confirm.</p>';
    }
    if (q.example) html += '<p class="qexample"><strong>Example:</strong> ' + esc(q.example) + '</p>';
    if (q.why) html += '<details class="why"><summary>Why we ask</summary><div>' + t(q.why) + '</div></details>';
    html += '</div>';
    return html;
  }

  function renderSection(sec, a, c, steps, i) {
    var qs = E.visibleQuestions(sec, a, c);
    var html = '<div class="section-head"><span class="eyebrow">Step ' + (i + 1) + ' of ' + steps.length + '</span><h1>' + t(sec.title) + '</h1><p>' + t(sec.intro) + '</p></div>';
    html += '<div class="qlist">' + qs.map(function (q) { return renderQuestion(q, a); }).join('') + '</div>';
    html += footNav(steps, i);
    return html;
  }

  function footNav(steps, i, nextLabel) {
    var prev = steps[i - 1], next = steps[i + 1];
    return '<div class="footnav">' +
      (prev ? '<button class="btn" type="button" data-action="goto" data-step="' + prev.id + '">← ' + esc(prev.title) + '</button>' : '<span></span>') +
      (next ? '<button class="btn btn-primary" type="button" data-action="next">' + esc(nextLabel || 'Continue') + ' →</button>' : '') +
      '</div>';
  }

  /* ----- Quick check: one question at a time ----- */
  function renderStepper(sec, a, c, steps, i) {
    var qs = E.visibleQuestions(sec, a, c);
    app.idx = Math.max(0, Math.min(app.idx, qs.length - 1));
    var q = qs[app.idx];
    var html = '<div class="section-head"><span class="eyebrow">Step ' + (i + 1) + ' of ' + steps.length + '</span><h1>' + t(sec.title) + '</h1><p>' + t(sec.intro) + '</p></div>';
    html += '<div class="stepper">';
    html += '<div class="stepper-top"><span class="eyebrow">Question ' + (app.idx + 1) + ' of ' + qs.length + '</span><div class="pips">' +
      qs.map(function (x, k) {
        var v = a[x.id];
        var state = k === app.idx ? 'current' : (v === 'unsure' || (Array.isArray(v) && v.indexOf('unsure') !== -1)) ? 'unsure' : !isBlank(v) ? 'done' : 'todo';
        return '<button class="pip" type="button" data-action="pip" data-idx="' + k + '" data-state="' + state + '" aria-label="Question ' + (k + 1) + (state === 'done' ? ', answered' : '') + '"></button>';
      }).join('') + '</div></div>';
    html += renderQuestion(q, a, { stepper: true }).replace('class="qcard', 'class="qcard-flat');
    var answered = !isBlank(a[q.id]);
    var last = app.idx === qs.length - 1;
    html += '<div class="footnav"><button class="btn" type="button" data-action="stepper-back">← Back</button>' +
      '<button class="btn ' + (answered ? 'btn-primary' : '') + '" type="button" data-action="stepper-next">' + (answered ? (last ? 'See my result →' : 'Next →') : 'Skip for now') + '</button></div>';
    html += '</div>';
    return html;
  }

  function stepperAdvance() {
    var a = app.cur.answers, c = E.context(a);
    var qs = E.visibleQuestions(Q.sections[1], a, c);
    if (app.idx < qs.length - 1) { app.idx++; render(); focusMain(); return; }
    if (screeningDone(a, c)) { go('threshold'); return; }
    var first = qs.findIndex(function (q) { return isBlank(a[q.id]); });
    app.idx = first < 0 ? 0 : first;
    toast('A few questions are still unanswered', 'Answer them, or choose "Not sure", to see your result.');
    render(); focusMain();
  }

  /* ----- Threshold result ----- */
  function renderThreshold(a, c, steps, i) {
    var s = c.screening, info = s.tierInfo;
    var html = '<div class="verdict ' + info.tone + '"><span class="eyebrow">Your result</span><h1>' + esc(info.label) + '</h1><p>' + esc(info.summary) + '</p></div>';
    if (s.tier !== 'none') {
      html += '<div class="panel"><h2>How we decided</h2><p class="muted">Regulators use nine signs that a project could be high risk for people (EDPB guidelines). ' +
        'Two or more usually means a full DPIA. Some situations always require one under GDPR Article 35(3).</p><div class="criteria">' +
        s.criteria.map(function (cr) {
          var met = cr.met ? (cr.unconfirmed ? 'unsure' : 'true') : 'false';
          return '<div class="criterion" data-met="' + met + '"><span class="mark" aria-hidden="true">' + (cr.met ? (cr.unconfirmed ? '?' : '✓') : '–') + '</span><span>' + esc(cr.label) +
            '<span class="sr-only">: ' + (cr.met ? (cr.unconfirmed ? 'met, unconfirmed' : 'met') : 'not met') + '</span></span></div>';
        }).join('') + '</div>';
      if (s.mandatory.length) html += '<h3>Always requires a DPIA</h3><ul class="plain-list">' + s.mandatory.map(function (m) { return '<li>' + esc(m.label) + '</li>'; }).join('') + '</ul>';
      if (s.elevating.length) html += '<h3>Other factors that raise risk</h3><ul class="plain-list">' + s.elevating.map(function (e) { return '<li>' + esc(e.label) + (e.unconfirmed ? ' (not sure)' : '') + '</li>'; }).join('') + '</ul>';
      html += '</div>';
    }
    if (s.unsure.length) {
      html += '<div class="panel"><h2>Please confirm</h2><p class="muted">You weren\'t sure about these, so we assumed the cautious answer. If you find out the answer is "no", your result may change.</p><ul class="plain-list">' +
        s.unsure.map(function (u) { return '<li>' + esc(u.label) + ' <button class="btn btn-small btn-ghost" type="button" data-action="jump-q" data-q="' + u.id + '">Change answer</button></li>'; }).join('') + '</ul></div>';
    }
    html += '<div class="panel"><h2>What happens next</h2><ol class="plain-list">' + info.next.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ol></div>';
    html += footNav(steps, i, s.tier === 'none' ? 'Get screening record' : 'Continue');
    return html;
  }

  /* ----- Risks ----- */
  function renderRisks(a, c, steps, i) {
    var risks = evaluate(c);
    var sum = E.riskSummary(risks);
    var html = '<div class="section-head"><span class="eyebrow">Step ' + (i + 1) + ' of ' + steps.length + '</span><h1>Risks and actions</h1>' +
      '<p>Based on your answers, here is what could go wrong for the people involved, and what you can do about it. For each risk, choose a response and, if possible, name an owner.</p></div>';
    if (!risks.length) {
      html += '<div class="panel"><h2>No specific risks found</h2><p>Your answers didn\'t trigger any specific privacy risks. Continue to generate the record for legal.</p></div>';
      return html + footNav(steps, i);
    }
    // Heat map of inherent risk: rows = likelihood (5 at top), columns = impact.
    var grid = '<div class="heat" role="img" aria-label="Risk heat map: likelihood by impact">';
    for (var L = 5; L >= 1; L--) {
      grid += '<span class="axis">L' + L + '</span>';
      for (var I = 1; I <= 5; I++) {
        var n = risks.filter(function (r) { return r.likelihood === L && r.impact === I; }).length;
        grid += '<span class="cell ' + E.rating(L * I).toLowerCase() + (n ? '' : ' empty') + '">' + (n || '') + '</span>';
      }
    }
    grid += '<span></span>' + [1, 2, 3, 4, 5].map(function (x) { return '<span class="axis">I' + x + '</span>'; }).join('') + '</div>';
    var bands = cfg.risk.bands.map(function (b) { return b.label; });
    html += '<div class="panel"><div class="risk-summary">' + grid + '<div class="counts"><span class="eyebrow">' + risks.length + ' risks · before → after actions</span>' +
      bands.slice().reverse().map(function (b) { return '<div>' + ratingChip(b) + ' <span class="mono">' + sum.inherent[b] + ' → ' + sum.residual[b] + '</span></div>'; }).join('') +
      '<p class="muted" style="font-size:var(--step-0)">Likelihood (L) × impact (I), each scored 1 to 5. Mapped to the NIST Privacy Framework.</p></div></div></div>';

    html += risks.map(function (r) {
      var o = app.cur.risks[r.id] || {};
      var pre = 'risk_' + r.id;
      return '<article class="risk-card" data-rating="' + r.rating + '" id="card_' + r.id + '">' +
        '<div class="risk-head"><h3><span class="mono muted">' + r.id + '</span> ' + esc(r.title) + '</h3><div class="risk-scores">' +
        '<span class="muted">Now</span> ' + ratingChip(r.rating) + ' <span aria-hidden="true">→</span> <span class="muted">After</span> ' + ratingChip(r.residualRating) + (r.residualProjected ? ' <span class="muted">(projected)</span>' : '') + '</div></div>' +
        '<p>' + esc(r.description) + '</p>' +
        '<div class="risk-grid"><div><h4>Why we flagged it</h4><ul>' + r.reasons.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
        '<div><h4>What you can do</h4><ul>' + r.mitigations.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div></div>' +
        '<details class="why"><summary>NIST Privacy Framework mapping</summary><div style="display:grid;gap:8px">' +
        '<div class="risk-map">' + r.nist.map(function (x) { return chip(x, 'code', N.subcategories[x]); }).join('') + '</div>' +
        '<ul class="plain-list">' + r.nist.map(function (x) { return '<li><span class="mono">' + x + '</span> ' + esc(N.subcategories[x]) + ' <span class="muted">(' + esc(N.functions[N.functionOf(x)].name + ' · ' + N.categories[N.categoryOf(x)]) + ')</span></li>'; }).join('') + '</ul>' +
        '<div><strong>Problematic data actions:</strong> ' + r.actions.map(function (x) { return '<span title="' + esc(N.dataActions[x]) + '">' + esc(x) + '</span>'; }).join(', ') + '</div>' +
        '<div><strong>Possible problems for people:</strong> ' + r.problems.map(function (p) { return '<span title="' + esc(N.problems[p].desc) + '">' + esc(N.problems[p].label) + '</span>'; }).join(', ') + '</div>' +
        '<div class="muted">Likelihood ' + r.likelihood + ' × impact ' + r.impact + ' = ' + r.score + '</div></div></details>' +
        '<div class="response"><div class="eyebrow" id="' + pre + '_lbl">Your response</div><div class="status-pills" role="radiogroup" aria-labelledby="' + pre + '_lbl">' +
        Object.keys(E.STATUS).map(function (k) {
          return '<label class="choice"><input type="radio" name="' + pre + '_status" id="' + pre + '_' + k + '" value="' + k + '" data-risk-status="' + r.id + '"' + (r.status === k ? ' checked' : '') + '><span>' + E.STATUS[k] + '</span></label>';
        }).join('') + '</div>' +
        '<div class="response-fields">' +
        '<label for="' + pre + '_owner">Who will do it?<input class="input" id="' + pre + '_owner" data-risk-field="owner" data-risk="' + r.id + '" value="' + esc(o.owner || '') + '" placeholder="Name or team"></label>' +
        '<label for="' + pre + '_due">By when?<input class="input" type="date" id="' + pre + '_due" data-risk-field="due" data-risk="' + r.id + '" value="' + esc(o.due || '') + '"></label>' +
        '</div><label for="' + pre + '_notes">' + (r.status === 'accepted' ? 'Why is it OK to accept this risk? (required for legal)' : 'Notes') +
        '<textarea class="textarea" id="' + pre + '_notes" data-risk-field="notes" data-risk="' + r.id + '" style="min-height:64px">' + esc(o.notes || '') + '</textarea></label></div>' +
        '</article>';
    }).join('');
    return html + footNav(steps, i, 'Create the record');
  }

  /* ----- Report ----- */
  function renderReport(a, c, steps, i) {
    var s = c.screening;
    var unanswered = E.unanswered(a, c);
    var outstanding = unanswered.length + s.unsure.length;
    var submitted = app.cur.status === 'submitted';
    var html = '<div class="section-head"><span class="eyebrow">Step ' + (i + 1) + ' of ' + steps.length + '</span><h1>' + (s.tier === 'none' ? 'Your screening record' : 'Your record for legal') + '</h1>' +
      '<p>' + (s.tier === 'none' ? 'Keep this with your project documents.' : 'This contains the Record of Processing Activities (RoPA), the screening decision, the risk register and action plan. Download it and send it to legal.') + '</p></div>';
    html += '<div class="report-tools panel">';
    if (outstanding) html += '<p class="unsure-note">' + outstanding + ' item' + (outstanding > 1 ? 's' : '') + ' still to confirm or answer. They\'re listed in the record so legal can see them. You can still send it.</p>';
    html += '<div class="btn-row">' +
      (inViewer ? '' : '<button class="btn btn-primary" type="button" data-action="export-doc">Download for Word</button>' +
      '<button class="btn" type="button" data-action="export-pdf">Save as PDF</button>') +
      '<button class="btn" type="button" data-action="export-csv">Download RoPA row (CSV)</button>' +
      '<button class="btn" type="button" data-action="export-html">Download web page</button>' +
      '<button class="btn" type="button" data-action="export-json">Back up (JSON)</button></div>';
    if (inViewer) html += '<p class="muted" style="font-size:var(--step-0)">Word and PDF exports are available when the tool runs from your own site or computer. The web page download opens in Word too.</p>';
    html += '<div class="btn-row"><button class="btn btn-small" type="button" data-action="copy-ropa">Copy RoPA table for a spreadsheet</button>' +
      '<button class="btn btn-small" type="button" data-action="copy-summary">Copy summary for an email</button></div>';
    html += '<div class="btn-row">' + (submitted
      ? chip('Sent to legal on ' + (app.cur.submittedAt || '').slice(0, 10), 'ok') + ' <button class="btn btn-small btn-ghost" type="button" data-action="unsubmit">Mark as draft again</button>'
      : '<button class="btn btn-small" type="button" data-action="submit">I\'ve sent this to legal</button>') + '</div>';
    html += '</div>';
    html += '<div class="paper" id="report">' + R.build(app.cur) + '</div>';
    html += footNav(steps, i);
    return html;
  }

  /* ----- Home ----- */
  function renderHome() {
    var all = loadAll();
    var items = Object.keys(all).map(function (k) { return all[k]; }).sort(function (x, y) { return (y.updatedAt || '').localeCompare(x.updatedAt || ''); });
    var html = '<div class="home">';
    html += '<section class="hero"><div><span class="eyebrow">Privacy Impact Assessment intake</span><h1>Find out if your project needs a privacy assessment, in plain language.</h1>' +
      '<p>Answer simple questions about what you\'re building. We\'ll tell you whether a full assessment is needed, point out privacy risks and how to fix them, and create the record legal needs.</p>' +
      '<div class="btn-row"><button class="btn btn-primary" type="button" data-action="new">Start a new assessment</button>' +
      '<button class="btn" type="button" data-action="example">Explore a worked example</button></div></div>' +
      '<ol class="flow">' +
      '<li><div><strong>Quick check (2 minutes)</strong><span>About 15 yes/no questions decide whether you need nothing, a short record, a standard PIA, or a full DPIA.</span></div></li>' +
      '<li><div><strong>Guided questions</strong><span>Only the ones that apply to you. Every privacy term is explained, and "Not sure" is always an option.</span></div></li>' +
      '<li><div><strong>Risks and actions</strong><span>Risks appear as you answer, each mapped to the NIST Privacy Framework with practical fixes.</span></div></li>' +
      '<li><div><strong>Record for legal</strong><span>A Record of Processing Activities (GDPR Art. 30) and assessment report, ready for Word, PDF, or a spreadsheet.</span></div></li>' +
      '</ol></section>';

    html += '<section class="panel"><div class="btn-row" style="justify-content:space-between"><h2>Your assessments</h2>' +
      '<label class="btn btn-small" for="import-file">Open a backup (JSON)</label><input type="file" id="import-file" accept="application/json,.json" class="sr-only"></div>';
    if (!items.length) html += '<div class="empty">No assessments yet. Start a new one, or explore the worked example to see how it works.</div>';
    else {
      html += '<div class="saved-wrap"><table class="saved"><thead><tr><th>Project</th><th>Record</th><th>Level</th><th>Status</th><th>Updated</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
        items.map(function (it) {
          var s = E.context(it.answers || {}).screening;
          return '<tr><td><strong>' + esc((it.answers && it.answers.project_name) || 'Untitled') + '</strong></td><td class="mono">' + esc(E.recordId(it)) + '</td>' +
            '<td>' + (s.tierInfo ? chip(s.tierInfo.short, s.tierInfo.tone) : chip('Not screened')) + '</td>' +
            '<td>' + (it.status === 'submitted' ? chip('Sent to legal', 'ok') : chip('Draft')) + '</td>' +
            '<td>' + esc((it.updatedAt || '').slice(0, 10)) + '</td>' +
            '<td class="actions"><button class="btn btn-small" type="button" data-action="open" data-id="' + it.id + '">Open</button> ' +
            '<button class="btn btn-small btn-ghost btn-danger" type="button" data-action="delete" data-id="' + it.id + '">Delete</button></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    html += '</section>';

    html += '<section class="foundation" aria-label="What this is based on">' +
      '<div><strong>Threshold screening</strong>EDPB DPIA guidelines (WP248) nine high-risk criteria and the GDPR Article 35(3) mandatory triggers.</div>' +
      '<div><strong>Risk model</strong>NIST Privacy Framework v1.0 subcategories, with NIST PRAM problematic data actions and problems for individuals.</div>' +
      '<div><strong>Record of Processing</strong>Every GDPR Article 30(1) field, plus US state-law fields (sale/sharing, sensitive data) and indicative applicable laws.</div>' +
      '<div><strong>Private by design</strong>Everything stays in your browser. Nothing is sent anywhere until you download and share it.</div>' +
      '</section>';
    html += '</div>';
    return html;
  }

  /* ---------- Actions ---------- */
  function go(stepId) {
    app.step = stepId;
    app.errors = {};
    app.navOpen = false;
    if (stepId === 'screening') {
      var a = app.cur.answers, c = E.context(a);
      var qs = E.visibleQuestions(Q.sections[1], a, c);
      var first = qs.findIndex(function (q) { return isBlank(a[q.id]); });
      app.idx = first < 0 ? 0 : first;
    }
    persist();
    render();
    window.scrollTo({ top: 0 });
    focusMain();
  }

  function focusMain() {
    var h = document.querySelector('#main h1');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  function nextStep() {
    var a = app.cur.answers, c = E.context(a);
    var steps = getSteps(a, c);
    var i = steps.findIndex(function (s) { return s.id === app.step; });
    var cur = steps[i];
    if (cur && cur.section) {
      var missing = E.missingRequired(cur.section, a, c);
      if (missing.length) {
        app.errors = {};
        missing.forEach(function (q) { app.errors[q.id] = true; });
        render();
        var el = document.getElementById('q_' + missing[0].id);
        if (el) el.focus();
        toast('A required answer is missing', 'Please fill in the highlighted question.');
        return;
      }
    }
    if (steps[i + 1]) go(steps[i + 1].id);
  }

  function setAnswer(qid, value, opts) {
    var a = app.cur.answers;
    if (isBlank(value)) delete a[qid]; else a[qid] = value;
    delete app.errors[qid];
    persist();
    if (opts && opts.soft) { refreshSide(); } else { render(); }
    announceNewRisks();
  }

  function refreshSide() {
    var a = app.cur.answers, c = E.context(a);
    var steps = getSteps(a, c);
    var i = steps.findIndex(function (s) { return s.id === app.step; });
    var nav = $('#stepnav'), ins = $('#insights');
    if (nav) nav.innerHTML = renderNav(steps, i);
    if (ins) ins.innerHTML = renderInsights(a, c);
    $('#topbar-title').textContent = a.project_name || 'New assessment';
  }

  function announceNewRisks() {
    var c = E.context(app.cur.answers);
    if (!c.screening.tier || c.screening.tier === 'none') { app.riskIds = []; return; }
    var risks = evaluate(c);
    var ids = risks.map(function (r) { return r.id; });
    var fresh = risks.filter(function (r) { return app.riskIds.indexOf(r.id) === -1; });
    app.riskIds = ids;
    fresh.slice(0, 2).forEach(function (r) { toast('Risk spotted: ' + r.title, r.reasons[0] || ''); });
  }

  function openAssessment(state) {
    app.cur = state;
    app.cur.risks = app.cur.risks || {};
    app.cur.answers = app.cur.answers || {};
    app.view = 'assess';
    app.step = state.step || 'about';
    app.idx = state.idx || 0;
    app.errors = {};
    var c = E.context(state.answers);
    app.riskIds = c.screening.tier && c.screening.tier !== 'none' ? evaluate(c).map(function (r) { return r.id; }) : [];
    persist(true);
    render();
    window.scrollTo({ top: 0 });
  }

  function goHome() {
    if (app.cur) persist(true);
    app.view = 'home';
    app.cur = null;
    render();
    window.scrollTo({ top: 0 });
  }

  function slug(s) { return String(s || 'assessment').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'assessment'; }
  function fileBase() { return E.recordId(app.cur) + '-' + slug(app.cur.answers.project_name); }

  function download(name, content, type) {
    if (inViewer) {
      if (!hostDownloads) { toast('Downloads aren\'t available here', 'Use the copy buttons instead.'); return; }
      hostDownloads.save({ filename: name, data: content }).then(function () {
        toast('Saved ' + name, '');
      }, function (err) {
        if (err && err.code === 'declined') return;
        toast('Couldn\'t save ' + name, 'Use the copy buttons instead.');
      });
      return;
    }
    try {
      var blob = new Blob([content], { type: type });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url; link.download = name;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      toast('Downloading ' + name, 'If nothing downloads, your browser may be blocking it. Use the copy buttons instead.');
    } catch (e) {
      toast('Download failed', 'Use the copy buttons instead.');
    }
  }

  function copyText(text, what) {
    var done = function () { toast('Copied ' + what, 'Paste it wherever you need it.'); };
    var fallback = function () {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      if (ok) done(); else toast('Couldn\'t copy automatically', 'Select the text in the record below and copy it with your keyboard.');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  function ropaTSV() {
    var fields = E.buildRopa(app.cur).fields;
    var clean = function (s) { return String(s || '').replace(/[\t\r\n]+/g, ' '); };
    return 'Field\tEntry\tReference\n' + fields.map(function (f) { return clean(f.label) + '\t' + clean(f.value) + '\t' + clean(f.ref); }).join('\n');
  }

  function summaryText() {
    var ropa = E.buildRopa(app.cur);
    var c = ropa.ctx, s = c.screening, a = c.answers;
    var lines = [
      'Privacy assessment: ' + (a.project_name || 'Untitled') + ' (' + E.recordId(app.cur) + ')',
      'Owner: ' + [a.project_owner, a.department].filter(Boolean).join(', '),
      'Outcome: ' + (s.tierInfo ? s.tierInfo.label : 'Screening not complete'),
      'Why: ' + s.rationale.join(' ')
    ];
    if (s.tier !== 'none') {
      lines.push('Risks: ' + ropa.summary.total + ' identified. Highest before actions: ' + ropa.summary.highestInherent + '; after actions: ' + ropa.summary.highestResidual + '. Open actions: ' + ropa.summary.openActions + '.');
      ropa.risks.slice(0, 5).forEach(function (r) { lines.push('  - [' + r.rating + '] ' + r.title + ' (' + r.statusLabel + ')'); });
      if (ropa.laws.length) lines.push('Possibly applicable laws: ' + ropa.laws.map(function (l) { return l.law; }).join('; '));
    }
    var open = s.unsure.length + E.unanswered(a, c).length;
    if (open) lines.push('Items to confirm: ' + open);
    lines.push('', 'The full record (RoPA, risk register and action plan) is attached.');
    return lines.join('\n');
  }

  function ask(text, onYes, yesLabel) {
    var d = $('#confirm');
    $('#confirm-text').textContent = text;
    $('#confirm-yes').textContent = yesLabel || 'Confirm';
    var yes = $('#confirm-yes'), no = $('#confirm-no');
    var close = function () { yes.onclick = null; no.onclick = null; if (d.open) d.close(); };
    yes.onclick = function () { close(); onYes(); };
    no.onclick = close;
    if (d.showModal) d.showModal(); else onYes();
  }

  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var state = data && data.format === 'pia-intake/v1' ? data.assessment : data;
        if (!state || typeof state.answers !== 'object') throw new Error('bad');
        state.id = state.id || uid();
        var all = loadAll();
        all[state.id] = state; saveAll(all);
        toast('Backup opened', (state.answers.project_name || 'Assessment') + ' is ready to continue.');
        openAssessment(state);
      } catch (e) {
        toast('That file couldn\'t be opened', 'Choose a .json backup downloaded from this tool.');
      }
    };
    reader.readAsText(file);
  }

  /* ---------- Glossary, popover, toasts ---------- */
  function renderGlossary(filter) {
    var f = (filter || '').toLowerCase();
    var keys = Object.keys(PIA.glossary).sort(function (x, y) { return PIA.glossary[x].term.localeCompare(PIA.glossary[y].term); });
    $('#glossary-list').innerHTML = keys.filter(function (k) {
      var g = PIA.glossary[k]; return !f || g.term.toLowerCase().indexOf(f) !== -1 || g.def.toLowerCase().indexOf(f) !== -1;
    }).map(function (k) { var g = PIA.glossary[k]; return '<div><dt>' + esc(g.term) + '</dt><dd>' + esc(g.def) + '</dd></div>'; }).join('') || '<p class="muted">No matching terms.</p>';
  }

  function showPopover(btn) {
    var g = PIA.glossary[btn.getAttribute('data-term')];
    if (!g) return;
    var p = $('#popover');
    p.innerHTML = '<strong>' + esc(g.term) + '</strong>' + esc(g.def);
    p.hidden = false;
    var r = btn.getBoundingClientRect();
    var left = Math.max(16, Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - p.offsetWidth - 16));
    p.style.left = left + 'px';
    p.style.top = (r.bottom + window.scrollY + 8) + 'px';
    p.dataset.for = btn.getAttribute('data-term');
  }
  function hidePopover() { var p = $('#popover'); if (p) p.hidden = true; }

  function toast(title, body) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<strong>' + esc(title) + '</strong>' + (body ? esc(body) : '');
    $('#toasts').appendChild(el);
    setTimeout(function () { el.remove(); }, 5000);
  }

  /* ---------- Events ---------- */
  document.addEventListener('click', function (ev) {
    var term = ev.target.closest('[data-term]');
    if (term) { ev.preventDefault(); var p = $('#popover'); if (!p.hidden && p.dataset.for === term.getAttribute('data-term')) hidePopover(); else showPopover(term); return; }
    if (!ev.target.closest('#popover')) hidePopover();

    var btn = ev.target.closest('[data-action]');
    if (!btn) return;
    var act = btn.getAttribute('data-action');
    var a = app.cur && app.cur.answers;
    switch (act) {
      case 'home': goHome(); break;
      case 'glossary': renderGlossary(''); $('#glossary-search').value = ''; $('#glossary').showModal(); break;
      case 'close-glossary': $('#glossary').close(); break;
      case 'new': openAssessment(newAssessment(defaultAnswers())); break;
      case 'example': openAssessment(PIA.example()); toast('This is a worked example', 'Change any answer to see the result and risks update.'); break;
      case 'open': openAssessment(loadAll()[btn.getAttribute('data-id')]); break;
      case 'delete':
        var id = btn.getAttribute('data-id');
        var name = (loadAll()[id].answers || {}).project_name || 'this assessment';
        ask('Delete "' + name + '"? This removes it from this browser and can\'t be undone.', function () {
          var all = loadAll(); delete all[id]; saveAll(all); render(); toast('Deleted', name);
        }, 'Delete');
        break;
      case 'goto': go(btn.getAttribute('data-step')); break;
      case 'next': nextStep(); break;
      case 'toggle-nav': app.navOpen = !app.navOpen; render(); break;
      case 'stepper-next': stepperAdvance(); break;
      case 'stepper-back':
        if (app.idx > 0) { app.idx--; render(); focusMain(); } else go('about');
        break;
      case 'pip': app.idx = +btn.getAttribute('data-idx'); render(); break;
      case 'jump-q':
        var qid = btn.getAttribute('data-q');
        var q = Q.byId[qid];
        app.step = q.section; app.errors = {};
        if (q.section === 'screening') {
          var c = E.context(a);
          app.idx = Math.max(0, E.visibleQuestions(Q.sections[1], a, c).findIndex(function (x) { return x.id === qid; }));
        }
        render(); window.scrollTo({ top: 0 });
        break;
      case 'list-add':
        var list = (a[btn.getAttribute('data-q')] || [{}]).slice(); list.push({});
        a[btn.getAttribute('data-q')] = list; persist(); render();
        break;
      case 'list-remove':
        var l2 = (a[btn.getAttribute('data-q')] || []).slice(); l2.splice(+btn.getAttribute('data-row'), 1);
        setAnswer(btn.getAttribute('data-q'), l2);
        break;
      case 'export-doc': download(fileBase() + '.doc', R.toDoc(app.cur), 'application/msword'); break;
      case 'export-html': download(fileBase() + '.html', R.toHTML(app.cur), 'text/html'); break;
      case 'export-csv': download(fileBase() + '-ropa.csv', R.toCSV(app.cur), 'text/csv'); break;
      case 'export-json': download(fileBase() + '.json', R.toJSON(app.cur), 'application/json'); break;
      case 'export-pdf':
        toast('Choose "Save as PDF" as the printer', 'Only the record is printed.');
        setTimeout(function () { window.print(); }, 300);
        break;
      case 'copy-ropa': copyText(ropaTSV(), 'the RoPA table'); break;
      case 'copy-summary': copyText(summaryText(), 'the summary'); break;
      case 'submit':
        var c2 = E.context(a);
        var outstanding = E.unanswered(a, c2).length + c2.screening.unsure.length;
        var doSubmit = function () { app.cur.status = 'submitted'; app.cur.submittedAt = now(); persist(true); render(); toast('Marked as sent to legal', 'The record now shows it was submitted.'); };
        if (outstanding) ask(outstanding + ' item(s) are still unanswered or unconfirmed. They are listed in the record. Mark it as sent anyway?', doSubmit, 'Mark as sent');
        else doSubmit();
        break;
      case 'unsubmit': app.cur.status = 'draft'; delete app.cur.submittedAt; persist(true); render(); break;
    }
  });

  document.addEventListener('change', function (ev) {
    var el = ev.target;
    if (el.id === 'import-file' && el.files && el.files[0]) { importFile(el.files[0]); el.value = ''; return; }
    if (!app.cur) return;
    var a = app.cur.answers;

    if (el.matches('input[type=radio][data-q]')) {
      var qid = el.getAttribute('data-q');
      var q = Q.byId[qid];
      setAnswer(qid, el.value);
      if (app.step === 'screening' && q.section === 'screening') setTimeout(stepperAdvance, 280);
      return;
    }
    if (el.matches('input[type=checkbox][data-multi]')) {
      var mq = el.getAttribute('data-multi');
      var cur = Array.isArray(a[mq]) ? a[mq].slice() : [];
      var exclusiveVals = Q.byId[mq].options.filter(function (o) { return o.exclusive; }).map(function (o) { return o.value; });
      if (el.checked) {
        cur = exclusiveVals.indexOf(el.value) !== -1 ? [el.value] : cur.filter(function (v) { return exclusiveVals.indexOf(v) === -1; }).concat(el.value);
      } else cur = cur.filter(function (v) { return v !== el.value; });
      setAnswer(mq, cur);
      return;
    }
    if (el.matches('select[data-list]')) { updateList(el); render(); return; }
    if (el.matches('input[type=date][data-q]')) { setAnswer(el.getAttribute('data-q'), el.value, { soft: true }); return; }
    if (el.matches('input[data-risk-status]')) {
      var rid = el.getAttribute('data-risk-status');
      app.cur.risks[rid] = Object.assign({}, app.cur.risks[rid], { status: el.value });
      persist(); render();
      return;
    }
    if (el.matches('[data-risk-field]')) { updateRiskField(el); }
  });

  document.addEventListener('input', function (ev) {
    var el = ev.target;
    if (el.id === 'glossary-search') { renderGlossary(el.value); return; }
    if (!app.cur) return;
    if (el.matches('input[data-q]:not([type=radio]):not([type=checkbox]), textarea[data-q]')) {
      setAnswer(el.getAttribute('data-q'), el.value, { soft: true });
      return;
    }
    if (el.matches('input[data-list]')) { updateList(el); refreshSide(); return; }
    if (el.matches('[data-risk-field]')) updateRiskField(el);
  });

  function updateList(el) {
    var qid = el.getAttribute('data-list');
    var row = +el.getAttribute('data-row');
    var list = Array.isArray(app.cur.answers[qid]) ? app.cur.answers[qid].slice() : [];
    while (list.length <= row) list.push({});
    list[row] = Object.assign({}, list[row]);
    list[row][el.getAttribute('data-col')] = el.value;
    app.cur.answers[qid] = list;
    persist();
  }

  function updateRiskField(el) {
    var rid = el.getAttribute('data-risk');
    app.cur.risks[rid] = Object.assign({}, app.cur.risks[rid]);
    app.cur.risks[rid][el.getAttribute('data-risk-field')] = el.value;
    persist();
  }

  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') hidePopover(); });

  function defaultAnswers() {
    var o = cfg.organization;
    var a = {};
    if (o.name) a.org_name = o.name;
    if (o.dpoContact || o.privacyContact) a.privacy_contact = o.dpoContact || o.privacyContact;
    return a;
  }

  /* ---------- Worked example ---------- */
  PIA.example = function () {
    var s = newAssessment({
      project_name: 'Example: Member rewards app',
      project_description: 'A mobile app where shoppers collect points on purchases. It recommends personalized offers based on what members buy and where they shop.',
      project_owner: 'Jordan Lee', owner_email: 'jordan.lee@example.com', department: 'Marketing', project_stage: 'building', go_live: '2027-03-01',
      sc_personal_data: 'yes', sc_sensitive_types: ['precise_location'], sc_children: 'no', sc_vulnerable: 'no', sc_scale: 'gt100k',
      sc_monitoring: 'yes', sc_public_monitoring: 'no', sc_profiling: 'yes', sc_auto_decision: 'no', sc_new_tech: 'yes', sc_combine: 'unsure',
      sc_new_use: 'no', sc_prevent_rights: 'no', sc_share_external: 'yes', sc_international: 'yes',
      data_categories: ['contact', 'identity', 'credentials', 'online_ids', 'behaviour', 'precise_location'],
      data_elements: 'Name, email, phone, birthday month, member number, purchase history, store visits, app usage, device ID, GPS location while the app is open',
      systems: 'Rewards mobile app, CRM, cloud data warehouse, email platform',
      data_minimization: 'possibly', data_accuracy: 'yes',
      subject_categories: ['customers', 'users'], subject_regions: ['us', 'eu'],
      purpose_categories: ['service', 'marketing', 'personalization', 'analytics'],
      purpose_detail: 'Award points, send personalized offers, and measure which offers work.',
      purpose_expected: 'yes', legal_basis: 'consent', consent_mechanism: 'optin', consent_withdraw: 'yes',
      sources: ['direct', 'automatic'], notice: 'updated', notice_plain: 'yes', cookies_consent: 'yes',
      internal_access: 'team', recipients: ['cloud', 'saas', 'analytics'],
      vendors: [{ name: 'CloudHost Inc.', service: 'App and database hosting', location: 'USA', dpa: 'yes' }, { name: 'MailWave', service: 'Email campaigns', location: 'USA', dpa: 'unsure' }],
      sell_share: 'no', vendor_ai_training: 'unsure',
      storage_locations: ['us', 'eu'], transfer_mechanism: 'sccs', transfer_tia: 'no',
      retention_period: '1-3y', retention_reason: 'Deleted 24 months after the member closes their account', deletion_method: 'manual',
      security_controls: ['encrypt_rest', 'encrypt_transit', 'rbac', 'logging', 'backups'], security_review: 'scheduled', test_with_real: 'no', breach_plan: 'yes',
      rights_access: 'yes', rights_correct: 'yes', rights_delete: 'unsure', rights_optout: 'yes', complaints: 'yes',
      ai_use: ['predictions'], human_review: 'na', bias_testing: 'no', explainability: 'yes', contest_decision: 'yes',
      monitoring_type: ['location', 'online'], monitoring_aware: 'yes', monitoring_covert: 'no',
      org_name: 'Example Retail Co.', org_role: 'controller', privacy_contact: 'privacy@example.com'
    });
    s.risks = {
      R01: { status: 'planned', owner: 'Jordan Lee', due: '2027-01-15', notes: 'Drop birthday month and store GPS only at check-in.' },
      R20: { status: 'planned', owner: 'Procurement', due: '2026-12-01' }
    };
    s.step = 'threshold';
    return s;
  };

  /* ---------- Boot ---------- */
  document.getElementById('app-name').textContent = cfg.appName;
  var reportStyle = document.createElement('style');
  reportStyle.textContent = R.CSS;
  document.head.appendChild(reportStyle);
  render();
  if (inViewer) {
    window.claude.use('downloads').then(function (d) { hostDownloads = d; }, function () { hostDownloads = null; });
  }
})();
