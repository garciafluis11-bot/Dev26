/*
 * Report generation: the legal-ready Record of Processing Activities (RoPA) plus the assessment report.
 * Exports: standalone HTML (print to PDF), Word-compatible .doc, CSV (one RoPA row), JSON (full, re-importable).
 */
(function (root) {
  'use strict';
  var PIA = (root.PIA = root.PIA || {});
  var E = PIA.engine;
  var Q = PIA.questions;
  var N = PIA.nist;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c];
    });
  }
  function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }
  function chip(label, cls) { return '<span class="r-chip ' + (cls || '') + '">' + esc(label) + '</span>'; }
  function ratingChip(r) { return chip(r, 'r-' + String(r).toLowerCase().replace(/\s+/g, '-')); }
  function fmtDate(iso) { return iso ? new Date(iso).toISOString().slice(0, 10) : ''; }
  function list(items) { return items.length ? '<ul>' + items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>' : ''; }

  var REPORT_CSS = [
    '.pia-report{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1d2433;line-height:1.5;font-size:14px;max-width:1000px;margin:0 auto}',
    '.pia-report h1{font-size:24px;margin:0 0 4px}.pia-report h2{font-size:18px;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid #e3e7ef}',
    '.pia-report h3{font-size:15px;margin:18px 0 6px}.pia-report p{margin:6px 0}',
    '.pia-report table{width:100%;border-collapse:collapse;margin:8px 0;font-size:13px}',
    '.pia-report th,.pia-report td{border:1px solid #d6dbe5;padding:6px 8px;text-align:left;vertical-align:top}',
    '.pia-report th{background:#f2f4f8;font-weight:600}',
    '.pia-report .r-meta{color:#5b6475;font-size:13px}.pia-report .r-muted{color:#5b6475}',
    '.pia-report .r-banner{border-radius:8px;padding:12px 16px;margin:14px 0;border:1px solid}',
    '.pia-report .r-ok{background:#e9f7ef;border-color:#9fd4b4}.pia-report .r-warn{background:#fff6e0;border-color:#f0cf7a}.pia-report .r-danger{background:#fdecec;border-color:#ef9a9a}',
    '.pia-report .r-chip{display:inline-block;padding:1px 8px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid #c9d0dd;background:#f2f4f8;margin:1px 2px 1px 0;white-space:nowrap}',
    '.pia-report .r-low{background:#e9f7ef;border-color:#9fd4b4;color:#1e6b3a}.pia-report .r-medium{background:#fff6e0;border-color:#f0cf7a;color:#7a5600}',
    '.pia-report .r-high{background:#ffe9dc;border-color:#f3a77c;color:#8a3a0c}.pia-report .r-critical{background:#fdecec;border-color:#ef9a9a;color:#8f1d1d}',
    '.pia-report .r-none-identified{background:#f2f4f8}',
    '.pia-report .r-ref{color:#5b6475;font-size:12px;white-space:nowrap}',
    '.pia-report .r-sign td{height:42px}',
    '.pia-report ul{margin:4px 0;padding-left:20px}',
    '.pia-report .r-key{width:30%}',
    '@media print{.pia-report{font-size:11px}.pia-report h2{break-after:avoid}.pia-report tr{break-inside:avoid}}'
  ].join('\n');

  function build(state) {
    var ropa = E.buildRopa(state);
    var ctx = ropa.ctx;
    var a = ctx.answers;
    var s = ctx.screening;
    var tier = s.tier;
    var tierInfo = s.tierInfo;
    var risks = ropa.risks;
    var sum = ropa.summary;
    var unanswered = E.unanswered(a, ctx);
    var out = [];

    // Header
    out.push('<div class="pia-report">');
    out.push('<h1>' + esc(a.project_name || 'Untitled project') + '</h1>');
    out.push('<p class="r-meta">Privacy Impact Assessment &amp; Record of Processing Activities &middot; Record ' + esc(E.recordId(state)) +
      ' &middot; Created ' + esc(fmtDate(state.createdAt)) + ' &middot; Updated ' + esc(fmtDate(state.updatedAt)) +
      ' &middot; Status: <strong>' + (state.status === 'submitted' ? 'Submitted to legal' : 'Draft') + '</strong></p>');

    // 1. Summary
    out.push('<h2>1. Summary</h2>');
    if (tierInfo) {
      out.push('<div class="r-banner r-' + tierInfo.tone + '"><strong>' + esc(tierInfo.label) + '</strong><br>' + esc(tierInfo.summary) + '</div>');
    } else {
      out.push('<div class="r-banner r-warn"><strong>Screening not completed.</strong></div>');
    }
    out.push('<table><tbody>');
    out.push('<tr><th class="r-key">Business owner</th><td>' + esc([a.project_owner, a.owner_email, a.department].filter(Boolean).join(', ')) + '</td></tr>');
    out.push('<tr><th>Description</th><td>' + nl2br(a.project_description) + '</td></tr>');
    out.push('<tr><th>Why this outcome</th><td>' + list(s.rationale.map(esc)) + '</td></tr>');
    if (tier !== 'none') {
      out.push('<tr><th>Risks identified</th><td>' + sum.total + ' (' + cfgBands().map(function (b) { return sum.inherent[b] + ' ' + b.toLowerCase(); }).join(', ') + ')</td></tr>');
      out.push('<tr><th>Highest risk before / after actions</th><td>' + ratingChip(sum.highestInherent) + ' &rarr; ' + ratingChip(sum.highestResidual) + '</td></tr>');
      out.push('<tr><th>Open actions</th><td>' + sum.openActions + '</td></tr>');
    }
    out.push('<tr><th>Items to confirm</th><td>' + (s.unsure.length + unanswered.length) + '</td></tr>');
    out.push('</tbody></table>');
    if (tier === 'high' && (sum.highestResidual === 'High' || sum.highestResidual === 'Critical') && (ctx.flags.eu || ctx.flags.uk)) {
      out.push('<div class="r-banner r-danger"><strong>Prior consultation may be required.</strong> High risk remains after planned actions. Under GDPR Article 36, the supervisory authority must be consulted before processing starts if the risk cannot be sufficiently reduced.</div>');
    }

    // 2. RoPA
    var n = 2;
    if (tier === 'none') {
      out.push('<h2>' + n++ + '. Record of Processing Activities</h2><p>Not required: no personal data is processed. This screening record documents that decision.</p>');
    } else {
      out.push('<h2>' + n++ + '. Record of Processing Activities</h2>');
      out.push('<p class="r-muted">Structured to GDPR Article 30(1) for controllers, with additional fields for US state law and internal reporting.</p>');
      out.push('<table><thead><tr><th class="r-key">Field</th><th>Entry</th><th>Ref.</th></tr></thead><tbody>');
      ropa.fields.forEach(function (f) {
        out.push('<tr><th>' + esc(f.label) + '</th><td>' + (f.value ? nl2br(f.value) : '<span class="r-muted">Not provided</span>') + '</td><td class="r-ref">' + esc(f.ref || '') + '</td></tr>');
      });
      out.push('</tbody></table>');
    }

    // 3. Screening
    out.push('<h2>' + n++ + '. Threshold screening record</h2>');
    out.push('<p class="r-muted">High-risk criteria from the EDPB Guidelines on DPIA (WP248 rev.01). Meeting ' + PIA.config.threshold.dpiaCriteria +
      ' or more criteria, or any GDPR Art. 35(3) trigger, requires a full DPIA; one criterion, or ' + PIA.config.threshold.piaElevatingFactors + ' elevating factors, requires a standard PIA. "Not sure" answers are treated as "yes" until confirmed.</p>');
    out.push('<table><thead><tr><th>Criterion</th><th>Answer</th><th>Met?</th></tr></thead><tbody>');
    s.criteria.forEach(function (c) {
      var ans = c.questions.map(function (qid) { return E.answerText(qid, a[qid]); }).filter(Boolean).join(' / ');
      out.push('<tr><td>' + esc(c.id + ' ' + c.label) + '</td><td>' + esc(ans || 'Not answered') + '</td><td>' + (c.met ? (c.unconfirmed ? chip('Yes (unconfirmed)', 'r-medium') : chip('Yes', 'r-high')) : 'No') + '</td></tr>');
    });
    out.push('</tbody></table>');
    if (s.mandatory.length) out.push('<h3>Mandatory DPIA triggers</h3>' + list(s.mandatory.map(function (m) { return esc(m.label); })));
    if (s.elevating.length) out.push('<h3>Elevating factors</h3>' + list(s.elevating.map(function (e) { return esc(e.label) + (e.unconfirmed ? ' (unconfirmed)' : ''); })));

    if (tier !== 'none') {
      // 4. Risk register
      out.push('<h2>' + n++ + '. Risk register</h2>');
      if (!risks.length) {
        out.push('<p>No specific risks were triggered by the answers given.</p>');
      } else {
        out.push('<p class="r-muted">Likelihood and impact are scored 1 to 5 (score = L &times; I). Mapped to the ' + esc(N.version) + '.</p>');
        out.push('<table><thead><tr><th>ID</th><th>Risk and why it was flagged</th><th>NIST PF subcategories</th><th>Problematic data actions / problems for individuals</th><th>Inherent</th><th>Response</th><th>Residual</th></tr></thead><tbody>');
        risks.forEach(function (r) {
          out.push('<tr><td>' + esc(r.id) + '</td><td><strong>' + esc(r.title) + '</strong>' + list(r.reasons.map(esc)) + '</td>' +
            '<td>' + r.nist.map(function (x) { return '<span title="' + esc(N.subcategories[x]) + '">' + esc(x) + '</span>'; }).join('<br>') + '</td>' +
            '<td>' + esc(r.actions.join(', ')) + '<br><span class="r-muted">' + esc(r.problems.map(function (p) { return N.problems[p].label; }).join(', ')) + '</span></td>' +
            '<td>' + ratingChip(r.rating) + '<br><span class="r-muted">L' + r.likelihood + ' &times; I' + r.impact + ' = ' + r.score + '</span></td>' +
            '<td>' + esc(r.statusLabel) + (r.owner ? '<br>Owner: ' + esc(r.owner) : '') + (r.due ? '<br>Due: ' + esc(r.due) : '') + (r.notes ? '<br><span class="r-muted">' + nl2br(r.notes) + '</span>' : '') + '</td>' +
            '<td>' + ratingChip(r.residualRating) + (r.residualProjected ? '<br><span class="r-muted">projected</span>' : '') + '</td></tr>');
        });
        out.push('</tbody></table>');
      }

      // 5. NIST PF coverage
      out.push('<h2>' + n++ + '. NIST Privacy Framework alignment</h2>');
      out.push('<table><thead><tr><th>Function</th><th>Risks</th><th>Subcategories needing attention</th></tr></thead><tbody>');
      Object.keys(N.functions).forEach(function (fn) {
        var subs = Object.keys(sum.subcategories).filter(function (x) { return N.functionOf(x) === fn; }).sort();
        out.push('<tr><td><strong>' + esc(N.functions[fn].name) + '</strong><br><span class="r-muted">' + esc(N.functions[fn].desc) + '</span></td><td>' + sum.byFunction[fn] + '</td><td>' +
          (subs.length ? subs.map(function (x) { return '<strong>' + esc(x) + '</strong> ' + esc(N.subcategories[x]) + ' <span class="r-muted">(' + esc(sum.subcategories[x].join(', ')) + ')</span>'; }).join('<br>') : '<span class="r-muted">None flagged</span>') + '</td></tr>');
      });
      out.push('</tbody></table>');

      // 6. Action plan
      out.push('<h2>' + n++ + '. Action plan</h2>');
      var open = risks.filter(function (r) { return r.status !== 'implemented'; });
      if (!open.length) out.push('<p>No open actions.</p>');
      else {
        out.push('<table><thead><tr><th>Risk</th><th>Recommended actions</th><th>Status</th><th>Owner</th><th>Due</th></tr></thead><tbody>');
        open.forEach(function (r) {
          out.push('<tr><td>' + esc(r.id + ' ' + r.title) + '</td><td>' + list(r.mitigations.map(esc)) + '</td><td>' + esc(r.statusLabel) + '</td><td>' + esc(r.owner) + '</td><td>' + esc(r.due) + '</td></tr>');
        });
        out.push('</tbody></table>');
      }

      // 7. Applicable laws
      out.push('<h2>' + n++ + '. Potentially applicable laws</h2>');
      out.push('<p class="r-muted">Indicative only, generated from the answers. Legal to confirm.</p>');
      out.push(ropa.laws.length ? '<table><thead><tr><th>Law</th><th>Why it may apply</th></tr></thead><tbody>' + ropa.laws.map(function (l) { return '<tr><td>' + esc(l.law) + '</td><td>' + esc(l.why) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p>None identified. Check where data subjects are located.</p>');
    }

    // Items to confirm
    out.push('<h2>' + n++ + '. Items to confirm</h2>');
    if (!s.unsure.length && !unanswered.length) out.push('<p>None. All questions answered.</p>');
    if (s.unsure.length) out.push('<h3>Answered "not sure" (treated as yes)</h3>' + list(s.unsure.map(function (u) { return esc(u.label); })));
    if (unanswered.length) out.push('<h3>Not answered</h3>' + list(unanswered.map(function (u) { return esc(u.section + ': ' + u.label); })));
    if (a.concerns) out.push('<h3>Concerns raised by the project team</h3><p>' + nl2br(a.concerns) + '</p>');

    // Appendix: Q&A
    out.push('<h2>' + n++ + '. Appendix: all answers</h2>');
    E.visibleSections(a, ctx).forEach(function (sec) {
      var rows = E.visibleQuestions(sec, a, ctx).map(function (q) {
        var v = E.answerText(q.id, a[q.id]);
        return '<tr><td class="r-key">' + esc(Q.stripTerms(q.label)) + '</td><td>' + (v ? nl2br(v) : '<span class="r-muted">Not answered</span>') + '</td></tr>';
      });
      out.push('<h3>' + esc(Q.stripTerms(sec.title)) + '</h3><table><tbody>' + rows.join('') + '</tbody></table>');
    });

    // Sign-off
    out.push('<h2>' + n++ + '. Review and sign-off</h2>');
    out.push('<table class="r-sign"><thead><tr><th>Role</th><th>Name</th><th>Decision / comments</th><th>Date</th></tr></thead><tbody>' +
      ['Business owner', 'Privacy team / DPO', 'Information security', 'Legal'].map(function (r) { return '<tr><td>' + r + '</td><td></td><td></td><td></td></tr>'; }).join('') +
      '</tbody></table>');
    out.push('<p class="r-muted">Generated by ' + esc(PIA.config.appName) + '. This assessment supports, but does not replace, legal advice.</p>');
    out.push('</div>');
    return out.join('\n');
  }

  function cfgBands() { return PIA.config.risk.bands.map(function (b) { return b.label; }); }

  function toHTML(state) {
    var title = 'PIA & RoPA: ' + ((state.answers && state.answers.project_name) || 'Untitled');
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) +
      '</title><style>body{margin:24px;background:#fff}' + REPORT_CSS + '</style></head><body>' + build(state) + '</body></html>';
  }

  // Word opens HTML saved with a .doc extension; this keeps tables and headings intact.
  function toDoc(state) {
    return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>' +
      REPORT_CSS + ' body{font-family:Calibri,Arial,sans-serif}</style></head><body>' + build(state) + '</body></html>';
  }

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  // One row per processing activity, so rows from many assessments can be appended into a central register.
  function toCSV(state) {
    var fields = E.buildRopa(state).fields;
    return '﻿' + [fields.map(function (f) { return csvCell(f.label); }).join(','), fields.map(function (f) { return csvCell(f.value); }).join(',')].join('\r\n') + '\r\n';
  }

  function toJSON(state) {
    var ropa = E.buildRopa(state);
    return JSON.stringify({
      format: 'pia-intake/v1',
      exportedAt: new Date().toISOString(),
      assessment: state,
      computed: {
        recordId: E.recordId(state),
        tier: ropa.ctx.screening.tier,
        screening: {
          rationale: ropa.ctx.screening.rationale,
          criteriaMet: ropa.ctx.screening.criteriaMet.map(function (c) { return c.id; }),
          mandatory: ropa.ctx.screening.mandatory.map(function (m) { return m.id; }),
          unsure: ropa.ctx.screening.unsure.map(function (u) { return u.id; })
        },
        ropa: ropa.fields.reduce(function (o, f) { o[f.key] = f.value; return o; }, {}),
        risks: ropa.risks.map(function (r) {
          return { id: r.id, title: r.title, reasons: r.reasons, nist: r.nist, problematicDataActions: r.actions, problems: r.problems, likelihood: r.likelihood, impact: r.impact, score: r.score, rating: r.rating, status: r.status, owner: r.owner, due: r.due, residualRating: r.residualRating };
        }),
        applicableLaws: ropa.laws
      }
    }, null, 2);
  }

  PIA.report = { build: build, toHTML: toHTML, toDoc: toDoc, toCSV: toCSV, toJSON: toJSON, esc: esc, CSS: REPORT_CSS };
})(typeof window !== 'undefined' ? window : globalThis);
