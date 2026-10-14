// Run with: node --test pia-intake/tests
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

['config', 'glossary', 'nist', 'questions', 'risks', 'engine', 'report'].forEach((f) =>
  require(path.join(__dirname, '..', 'js', f + '.js'))
);
const { engine, risks, nist, questions } = globalThis.PIA;

const lowRisk = {
  project_name: 'Supplier newsletter',
  sc_personal_data: 'yes',
  sc_sensitive_types: ['none'],
  sc_children: 'no',
  sc_vulnerable: 'no',
  sc_scale: '100-1k',
  sc_monitoring: 'no',
  sc_profiling: 'no',
  sc_auto_decision: 'no',
  sc_new_tech: 'no',
  sc_combine: 'no',
  sc_new_use: 'no',
  sc_prevent_rights: 'no',
  sc_share_external: 'yes',
  sc_international: 'no'
};

function tierOf(answers) {
  return engine.context(answers).screening.tier;
}

test('screening has not started until the first question is answered', () => {
  assert.equal(tierOf({}), null);
});

test('no personal data gives tier "none"', () => {
  assert.equal(tierOf({ sc_personal_data: 'no', sc_no_pd_check: ['none'] }), 'none');
});

test('hidden identifiers override a "no personal data" answer', () => {
  assert.equal(tierOf({ sc_personal_data: 'no', sc_no_pd_check: ['online_ids'] }), 'low');
});

test('routine processing is low risk', () => {
  assert.equal(tierOf(lowRisk), 'low');
});

test('one EDPB criterion gives a standard PIA', () => {
  assert.equal(tierOf({ ...lowRisk, sc_profiling: 'yes' }), 'medium');
});

test('two elevating factors give a standard PIA', () => {
  assert.equal(tierOf({ ...lowRisk, sc_international: 'yes' }), 'medium');
});

test('two EDPB criteria require a DPIA', () => {
  assert.equal(tierOf({ ...lowRisk, sc_profiling: 'yes', sc_new_tech: 'yes' }), 'high');
});

test('"not sure" counts as yes and is listed for confirmation', () => {
  const s = engine.context({ ...lowRisk, sc_combine: 'unsure' }).screening;
  assert.equal(s.tier, 'medium');
  assert.equal(s.criteriaMet[0].unconfirmed, true);
  assert.deepEqual(s.unsure.map((u) => u.id), ['sc_combine']);
});

test('Art. 35(3) mandatory triggers force a DPIA', () => {
  const s = engine.context({ ...lowRisk, sc_sensitive_types: ['health'], sc_scale: 'gt100k' }).screening;
  assert.equal(s.tier, 'high');
  assert.ok(s.mandatory.some((m) => m.id === 'M2'));
});

test('low tier hides the deeper PIA sections', () => {
  const ctx = engine.context(lowRisk);
  const ids = engine.visibleSections(lowRisk, ctx).map((s) => s.id);
  assert.ok(ids.includes('data') && ids.includes('record'));
  assert.ok(!ids.includes('rights'));
  assert.ok(!ids.includes('automation'));
});

test('high tier with monitoring and profiling shows the conditional sections', () => {
  const a = { ...lowRisk, sc_profiling: 'yes', sc_monitoring: 'yes' };
  const ids = engine.visibleSections(a, engine.context(a)).map((s) => s.id);
  assert.ok(ids.includes('rights') && ids.includes('automation') && ids.includes('monitoring'));
});

test('answers to questions that became hidden are ignored by the risk engine', () => {
  // Monitoring section answered, then screening changed so monitoring no longer applies.
  const a = { ...lowRisk, sc_monitoring: 'no', monitoring_covert: 'yes' };
  const ctx = engine.context(a);
  const ids = engine.evaluateRisks(ctx.answers, ctx).map((r) => r.id);
  assert.ok(!ids.includes('R13'));
});

test('risks trigger from answers and carry reasons', () => {
  const a = { ...lowRisk, sc_profiling: 'yes', sc_new_tech: 'yes', legal_basis: 'consent', consent_mechanism: 'prechecked', retention_period: 'indefinite' };
  const ctx = engine.context(a);
  const found = engine.evaluateRisks(ctx.answers, ctx);
  const ids = found.map((r) => r.id);
  assert.ok(ids.includes('R09'));
  assert.ok(ids.includes('R23'));
  found.forEach((r) => assert.ok(r.reasons.length > 0));
});

test('sensitivity raises impact; mitigations lower residual risk', () => {
  const a = { ...lowRisk, sc_sensitive_types: ['health'], retention_period: 'indefinite' };
  const ctx = engine.context(a);
  const r = engine.evaluateRisks(ctx.answers, ctx).find((x) => x.id === 'R23');
  assert.equal(r.impact, 4); // base 3 + 1 for special-category data
  const mitigated = engine.evaluateRisks(ctx.answers, ctx, { R23: { status: 'implemented' } }).find((x) => x.id === 'R23');
  assert.ok(mitigated.residualScore < r.score);
  const accepted = engine.evaluateRisks(ctx.answers, ctx, { R23: { status: 'accepted' } }).find((x) => x.id === 'R23');
  assert.equal(accepted.residualScore, r.score);
});

test('vendors without a DPA are flagged by name', () => {
  const a = { ...lowRisk, recipients: ['saas'], vendors: [{ name: 'MailCo', dpa: 'no' }, { name: 'HostCo', dpa: 'yes' }] };
  const ctx = engine.context(a);
  const r = engine.evaluateRisks(ctx.answers, ctx).find((x) => x.id === 'R20');
  assert.match(r.reasons[0], /MailCo/);
  assert.doesNotMatch(r.reasons[0], /HostCo/);
});

test('every risk maps to known NIST PF subcategories, PRAM actions and problems', () => {
  risks.forEach((r) => {
    assert.ok(r.nist.length, r.id);
    r.nist.forEach((s) => assert.ok(nist.subcategories[s], `${r.id}: unknown subcategory ${s}`));
    r.actions.forEach((x) => assert.ok(nist.dataActions[x], `${r.id}: unknown action ${x}`));
    r.problems.forEach((x) => assert.ok(nist.problems[x], `${r.id}: unknown problem ${x}`));
  });
});

test('every question referenced by a glossary term resolves', () => {
  const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const texts = [];
  questions.sections.forEach((s) => {
    texts.push(s.intro);
    s.questions.forEach((q) => {
      texts.push(q.label, q.help || '', q.why || '');
      (q.options || []).forEach((o) => texts.push(o.label, o.hint || ''));
    });
  });
  texts.forEach((t) => {
    let m;
    while ((m = re.exec(t))) {
      const key = (m[2] || m[1]).toLowerCase();
      assert.ok(globalThis.PIA.glossary[key], `missing glossary term "${key}"`);
    }
  });
});

test('RoPA contains every GDPR Art. 30(1) field', () => {
  const a = { ...lowRisk, org_name: 'Acme', purpose_categories: ['marketing'], subject_categories: ['business_contacts'], data_categories: ['contact'], recipients: ['saas'], retention_period: '1-3y', security_controls: ['encrypt_rest'] };
  const ropa = engine.buildRopa({ id: 'abc123', createdAt: '2026-10-14T00:00:00Z', answers: a, risks: {} });
  const refs = ropa.fields.filter((f) => f.ref).map((f) => f.ref);
  ['Art. 30(1)(a)', 'Art. 30(1)(b)', 'Art. 30(1)(c)', 'Art. 30(1)(d)', 'Art. 30(1)(e)', 'Art. 30(1)(f)', 'Art. 30(1)(g)'].forEach((r) => assert.ok(refs.includes(r), r));
  const get = (k) => ropa.fields.find((f) => f.key === k).value;
  assert.equal(get('record_id'), 'PIA-20261014-C123');
  assert.match(get('controller'), /Acme/);
  assert.equal(get('assessment'), engine.TIERS.low.label);
});

test('report exports produce CSV and HTML', () => {
  const state = { id: 'x1', createdAt: '2026-10-14T00:00:00Z', answers: { ...lowRisk, project_name: 'Test, "quoted"' }, risks: {} };
  const csv = globalThis.PIA.report.toCSV(state);
  assert.match(csv, /"Test, ""quoted"""/);
  const html = globalThis.PIA.report.toHTML(state);
  assert.match(html, /Record of Processing Activities/);
  assert.doesNotMatch(html, /<script/i);
});

test('user text is escaped in the report', () => {
  const state = { id: 'x2', answers: { ...lowRisk, project_name: '<img src=x onerror=alert(1)>' }, risks: {} };
  const html = globalThis.PIA.report.toHTML(state);
  assert.ok(!html.includes('<img src=x'));
});
