/*
 * Assessment engine: threshold screening, context flags, risk evaluation, and RoPA generation.
 * Pure functions with no DOM access, so they can be unit-tested in Node.
 */
(function (root) {
  'use strict';
  var PIA = (root.PIA = root.PIA || {});
  var Q = PIA.questions;

  var ART9 = ['health', 'genetic', 'biometric', 'racial', 'religion', 'political', 'union', 'sexual'];
  var ART10 = ['criminal'];
  var OTHER_SENSITIVE = ['govid', 'financial', 'precise_location'];
  var TIER_ORDER = ['none', 'low', 'medium', 'high'];

  function arr(v) { return Array.isArray(v) ? v : []; }
  function has(a, v) { return arr(a).indexOf(v) !== -1; }
  function hasAny(a, vals) { return vals.some(function (v) { return has(a, v); }); }
  function uniq(list) { return list.filter(function (v, i) { return list.indexOf(v) === i; }); }
  function cfg() { return PIA.config; }
  function yu(v) { return v === 'yes' || (v === 'unsure' && cfg().threshold.treatUnsureAsYes); }
  function isBlank(v) {
    if (v === undefined || v === null || v === '') return true;
    if (Array.isArray(v)) return v.length === 0;
    return false;
  }

  /* ---------- Context flags ---------- */

  function computeFlags(a) {
    var sens = arr(a.sc_sensitive_types);
    var cats = arr(a.data_categories);
    var allSens = uniq(sens.concat(cats));
    var subj = arr(a.subject_categories);
    var regions = arr(a.subject_regions);
    var storage = arr(a.storage_locations);
    var recipients = arr(a.recipients);
    var t = cfg().threshold;

    var personal = a.sc_personal_data === 'yes' || a.sc_personal_data === 'unsure' ||
      (a.sc_personal_data === 'no' && arr(a.sc_no_pd_check).some(function (v) { return v !== 'none'; }));

    var specialKeys = allSens.filter(function (v) { return ART9.indexOf(v) !== -1 || ART10.indexOf(v) !== -1; });
    var otherKeys = allSens.filter(function (v) { return OTHER_SENSITIVE.indexOf(v) !== -1; });
    var label = function (k) { return Q.optionLabel('data_categories', k); };

    var eu = has(regions, 'eu'), uk = has(regions, 'uk');
    var crossBorder = yu(a.sc_international) ||
      ((eu || uk) && storage.some(function (s) { return s !== 'eu' && s !== 'uk'; }));

    return {
      personal: personal,
      special: specialKeys.length > 0,
      specialKeys: specialKeys,
      specialLabels: specialKeys.map(label),
      sensitiveOther: otherKeys.length > 0,
      sensitiveOtherLabels: otherKeys.map(label),
      sensitive: specialKeys.length > 0 || otherKeys.length > 0 || has(sens, 'unsure'),
      children: yu(a.sc_children) || hasAny(subj, ['children_u13', 'children_13_17']),
      childrenUnder13: has(subj, 'children_u13'),
      vulnerable: yu(a.sc_vulnerable) || hasAny(subj, ['patients', 'vulnerable_adults']),
      largeScale: t.largeScale.indexOf(a.sc_scale) !== -1 || (a.sc_scale === 'unsure' && t.treatUnsureAsYes),
      veryLarge: t.veryLargeScale.indexOf(a.sc_scale) !== -1,
      monitoring: yu(a.sc_monitoring),
      profiling: yu(a.sc_profiling),
      autoDecision: yu(a.sc_auto_decision),
      newTech: yu(a.sc_new_tech),
      ai: yu(a.sc_new_tech) || arr(a.ai_use).some(function (v) { return v !== 'none'; }) || has(a.purpose_categories, 'ai_training'),
      combine: yu(a.sc_combine),
      newUse: yu(a.sc_new_use),
      shareExternal: yu(a.sc_share_external) || recipients.some(function (r) { return r !== 'none'; }),
      eu: eu, uk: uk, us: has(regions, 'us'), canada: has(regions, 'canada'),
      crossBorder: crossBorder
    };
  }

  /* ---------- Threshold screening ---------- */

  // EDPB WP248 rev.01 criteria for processing "likely to result in a high risk".
  var CRITERIA = [
    { id: 'C1', label: 'Evaluation or scoring of people (profiling)', q: ['sc_profiling'], test: function (a) { return a.sc_profiling; } },
    { id: 'C2', label: 'Automated decisions with legal or similarly significant effects', q: ['sc_auto_decision'], test: function (a) { return a.sc_auto_decision; } },
    { id: 'C3', label: 'Systematic monitoring of people', q: ['sc_monitoring'], test: function (a) { return a.sc_monitoring; } },
    {
      id: 'C4', label: 'Sensitive or highly personal information', q: ['sc_sensitive_types'],
      test: function (a) {
        var s = arr(a.sc_sensitive_types);
        if (s.some(function (v) { return v !== 'none' && v !== 'unsure'; })) return 'yes';
        return has(s, 'unsure') ? 'unsure' : (s.length ? 'no' : undefined);
      }
    },
    { id: 'C5', label: 'Large-scale processing', q: ['sc_scale'], test: function (a) { return a.sc_scale === undefined ? undefined : a.sc_scale === 'unsure' ? 'unsure' : cfg().threshold.largeScale.indexOf(a.sc_scale) !== -1 ? 'yes' : 'no'; } },
    { id: 'C6', label: 'Matching or combining datasets', q: ['sc_combine'], test: function (a) { return a.sc_combine; } },
    {
      id: 'C7', label: 'Information about vulnerable people (including children)', q: ['sc_children', 'sc_vulnerable'],
      test: function (a) {
        if (a.sc_children === 'yes' || a.sc_vulnerable === 'yes') return 'yes';
        if (a.sc_children === 'unsure' || a.sc_vulnerable === 'unsure') return 'unsure';
        return a.sc_children === undefined && a.sc_vulnerable === undefined ? undefined : 'no';
      }
    },
    { id: 'C8', label: 'Innovative technology (AI, biometrics, IoT)', q: ['sc_new_tech'], test: function (a) { return a.sc_new_tech; } },
    { id: 'C9', label: 'Processing that can prevent people from using a service, right, or contract', q: ['sc_prevent_rights'], test: function (a) { return a.sc_prevent_rights; } }
  ];

  // GDPR Article 35(3): cases where a DPIA is always required.
  var MANDATORY = [
    {
      id: 'M1', label: 'Systematic, extensive evaluation with automated decisions that significantly affect people (GDPR Art. 35(3)(a))',
      test: function (a) { return yu(a.sc_auto_decision) && yu(a.sc_profiling); }
    },
    {
      id: 'M2', label: 'Large-scale use of special-category or criminal record information (GDPR Art. 35(3)(b))',
      test: function (a, f) {
        var s = arr(a.sc_sensitive_types);
        return f.largeScale && (hasAny(s, ART9.concat(ART10)) || (has(s, 'unsure') && cfg().threshold.treatUnsureAsYes));
      }
    },
    {
      id: 'M3', label: 'Systematic monitoring of publicly accessible areas on a large scale (GDPR Art. 35(3)(c))',
      test: function (a) { return yu(a.sc_monitoring) && yu(a.sc_public_monitoring); }
    }
  ];

  var ELEVATING = [
    { id: 'E1', label: 'Information reused for a new purpose', q: 'sc_new_use' },
    { id: 'E2', label: 'Information shared outside the organization', q: 'sc_share_external' },
    { id: 'E3', label: 'Information stored or accessed in another country', q: 'sc_international' }
  ];

  var TIERS = {
    none: {
      label: 'No assessment needed', short: 'Not needed', tone: 'ok',
      summary: 'Based on your answers, this project doesn\'t use personal data, so privacy laws don\'t apply and no assessment is needed.',
      next: ['Download the screening record and keep it with your project documents.', 'If the project changes, for example if you start collecting any information about people, run this check again.']
    },
    low: {
      label: 'Low risk: no full PIA needed', short: 'Low risk', tone: 'ok',
      summary: 'Good news: this looks like low-risk, routine use of personal data. You don\'t need a full Privacy Impact Assessment. We just need a few details so legal can add it to the Record of Processing Activities.',
      next: ['Answer the short record questions (about 5 minutes).', 'Review any risks we spot and the suggested actions.', 'Send the generated record to legal.']
    },
    medium: {
      label: 'Standard Privacy Impact Assessment (PIA) recommended', short: 'Standard PIA', tone: 'warn',
      summary: 'This project has some features that raise privacy risk. Please complete the full assessment so the risks can be understood and managed.',
      next: ['Complete the remaining sections (about 15 to 20 minutes).', 'Agree actions and owners for each risk.', 'Send the assessment and record to the privacy team and legal for review.']
    },
    high: {
      label: 'Full Data Protection Impact Assessment (DPIA) required', short: 'Full DPIA', tone: 'danger',
      summary: 'This project is likely to be high risk for the people involved. A full DPIA is required (GDPR Article 35 where it applies) and must be completed before the processing starts. Involve your privacy team or Data Protection Officer now.',
      next: ['Contact the privacy team or DPO to let them know a DPIA is under way.', 'Complete all remaining sections in detail.', 'Agree actions for every risk. If high risk remains after actions, the regulator may need to be consulted before launch (GDPR Article 36).']
    }
  };

  function screen(a, f) {
    var criteria = CRITERIA.map(function (c) {
      var v = c.test(a);
      return { id: c.id, label: c.label, questions: c.q, answer: v, met: v === 'yes' || (v === 'unsure' && cfg().threshold.treatUnsureAsYes), unconfirmed: v === 'unsure' };
    });
    var met = criteria.filter(function (c) { return c.met; });
    var mandatory = MANDATORY.filter(function (m) { return m.test(a, f); }).map(function (m) { return { id: m.id, label: m.label }; });
    var elevating = ELEVATING.filter(function (e) { return yu(a[e.q]); }).map(function (e) { return { id: e.id, label: e.label, unconfirmed: a[e.q] === 'unsure' }; });

    var unsure = [];
    Q.sections[1].questions.forEach(function (q) {
      var v = a[q.id];
      if (v === 'unsure' || has(v, 'unsure')) unsure.push({ id: q.id, label: Q.stripTerms(q.label) });
    });

    var started = a.sc_personal_data !== undefined;
    var t = cfg().threshold;
    var tier;
    if (!started) tier = null;
    else if (!f.personal) tier = 'none';
    else if (mandatory.length || met.length >= t.dpiaCriteria) tier = 'high';
    else if (met.length >= t.piaCriteria || elevating.length >= t.piaElevatingFactors) tier = 'medium';
    else tier = 'low';

    var rationale = [];
    if (tier === 'none') rationale.push('No personal data is involved.');
    mandatory.forEach(function (m) { rationale.push('Mandatory DPIA trigger: ' + m.label + '.'); });
    if (met.length) rationale.push(met.length + ' of 9 high-risk criteria met (EDPB guidelines; ' + t.dpiaCriteria + ' or more usually means a DPIA is required).');
    if (elevating.length) rationale.push(elevating.length + ' elevating factor' + (elevating.length > 1 ? 's' : '') + ': ' + elevating.map(function (e) { return e.label.toLowerCase(); }).join('; ') + '.');
    if (tier === 'low') rationale.push('No high-risk criteria met.');

    return {
      started: started,
      tier: tier,
      tierInfo: tier ? TIERS[tier] : null,
      criteria: criteria,
      criteriaMet: met,
      mandatory: mandatory,
      elevating: elevating,
      unsure: unsure,
      rationale: rationale
    };
  }

  /* ---------- Visibility ---------- */

  function sectionVisible(s, a, ctx) {
    var tier = ctx.screening.tier || 'low';
    if (s.tiers.indexOf(tier) === -1) return false;
    if (s.showIf && !s.showIf(a, ctx.flags)) return false;
    return true;
  }

  function questionVisible(q, a, ctx) {
    var tier = ctx.screening.tier || 'low';
    if (q.tiers && q.tiers.indexOf(tier) === -1) return false;
    if (q.showIf && !q.showIf(a, ctx.flags)) return false;
    return true;
  }

  function visibleSections(a, ctx) {
    return Q.sections.filter(function (s) { return sectionVisible(s, a, ctx); });
  }

  function visibleQuestions(section, a, ctx) {
    return section.questions.filter(function (q) { return questionVisible(q, a, ctx); });
  }

  /* ---------- Context (two passes: raw answers, then answers to visible questions only) ---------- */

  function rawContext(a) {
    var flags = computeFlags(a);
    var screening = screen(a, flags);
    flags.tier = screening.tier;
    return { flags: flags, screening: screening };
  }

  // Answers to questions that are hidden (e.g. the user changed an earlier answer) are ignored.
  function effectiveAnswers(a, ctx) {
    var out = {};
    visibleSections(a, ctx).forEach(function (s) {
      visibleQuestions(s, a, ctx).forEach(function (q) { if (!isBlank(a[q.id])) out[q.id] = a[q.id]; });
    });
    return out;
  }

  function context(a) {
    var first = rawContext(a);
    var eff = effectiveAnswers(a, first);
    var ctx = rawContext(eff);
    ctx.answers = eff;
    return ctx;
  }

  function prefill(section, a, ctx) {
    var changed = false;
    visibleQuestions(section, a, ctx).forEach(function (q) {
      if (q.prefill && a[q.id] === undefined) {
        var v = q.prefill(a, ctx.flags);
        if (v !== undefined && !(Array.isArray(v) && !v.length)) { a[q.id] = v; changed = true; }
      }
    });
    return changed;
  }

  function sectionProgress(section, a, ctx) {
    var qs = visibleQuestions(section, a, ctx).filter(function (q) { return !q.optional; });
    var answered = qs.filter(function (q) { return !isBlank(a[q.id]); }).length;
    return { answered: answered, total: qs.length, complete: answered === qs.length };
  }

  function missingRequired(section, a, ctx) {
    return visibleQuestions(section, a, ctx).filter(function (q) { return q.required && isBlank(a[q.id]); });
  }

  function unanswered(a, ctx) {
    var out = [];
    visibleSections(a, ctx).forEach(function (s) {
      visibleQuestions(s, a, ctx).forEach(function (q) {
        if (!q.optional && isBlank(a[q.id])) out.push({ section: s.title, id: q.id, label: Q.stripTerms(q.label) });
      });
    });
    return out;
  }

  /* ---------- Risk evaluation ---------- */

  function clamp(n) { return Math.max(1, Math.min(5, n)); }

  function rating(score) {
    var bands = cfg().risk.bands;
    for (var i = 0; i < bands.length; i++) if (score <= bands[i].max) return bands[i].label;
    return bands[bands.length - 1].label;
  }

  var STATUS = {
    open: 'Not started',
    planned: 'Planned',
    implemented: 'In place',
    accepted: 'Risk accepted'
  };

  function evaluateRisks(a, ctx, overrides) {
    overrides = overrides || {};
    var f = ctx.flags;
    var out = [];
    PIA.risks.forEach(function (r) {
      var why = r.when(a, f) || [];
      if (!why.length) return;
      var L = r.likelihood, I = r.impact;
      var adj = r.adjust ? r.adjust(a, f) : null;
      if (adj) { L += adj.likelihood || 0; I += adj.impact || 0; }
      // One impact bump when the people or data make harm more severe, or when very many people are affected.
      if (r.amplify !== false && (f.special || f.children || f.vulnerable || f.veryLarge)) I += 1;
      L = clamp(L); I = clamp(I);
      var score = L * I;
      var o = overrides[r.id] || {};
      var status = o.status || 'open';
      var reduce = cfg().risk.mitigationLikelihoodReduction;
      var rL = (status === 'implemented' || status === 'planned') ? clamp(L - reduce) : L;
      var rScore = rL * I;
      out.push({
        id: r.id,
        title: r.title,
        description: r.description,
        reasons: why,
        nist: r.nist,
        actions: r.actions,
        problems: r.problems,
        mitigations: typeof r.mitigations === 'function' ? r.mitigations(a, f) : r.mitigations,
        likelihood: L, impact: I, score: score, rating: rating(score),
        status: status, statusLabel: STATUS[status],
        owner: o.owner || '', due: o.due || '', notes: o.notes || '',
        residualLikelihood: rL, residualScore: rScore, residualRating: rating(rScore),
        residualProjected: status === 'planned'
      });
    });
    out.sort(function (x, y) { return y.score - x.score || x.id.localeCompare(y.id); });
    return out;
  }

  function riskSummary(risks) {
    var bands = cfg().risk.bands.map(function (b) { return b.label; });
    var count = function (key) {
      var c = {}; bands.forEach(function (b) { c[b] = 0; });
      risks.forEach(function (r) { c[r[key]] += 1; });
      return c;
    };
    var highest = function (key) {
      for (var i = bands.length - 1; i >= 0; i--) if (risks.some(function (r) { return r[key] === bands[i]; })) return bands[i];
      return 'None identified';
    };
    var byFunction = {};
    Object.keys(PIA.nist.functions).forEach(function (fn) { byFunction[fn] = 0; });
    var subs = {};
    risks.forEach(function (r) {
      var fns = uniq(r.nist.map(PIA.nist.functionOf));
      fns.forEach(function (fn) { byFunction[fn] += 1; });
      r.nist.forEach(function (s) { (subs[s] = subs[s] || []).push(r.id); });
    });
    return {
      total: risks.length,
      inherent: count('rating'),
      residual: count('residualRating'),
      highestInherent: highest('rating'),
      highestResidual: highest('residualRating'),
      openActions: risks.filter(function (r) { return r.status === 'open' || r.status === 'planned'; }).length,
      byFunction: byFunction,
      subcategories: subs
    };
  }

  /* ---------- Applicable law hints (indicative only) ---------- */

  function applicableLaws(a, f) {
    var out = [];
    var cats = arr(a.data_categories);
    var subj = arr(a.subject_categories);
    var purposes = arr(a.purpose_categories);
    if (f.eu) out.push({ law: 'EU General Data Protection Regulation (GDPR)', why: 'People in the EU/EEA.' });
    if (f.uk) out.push({ law: 'UK GDPR and Data Protection Act 2018', why: 'People in the UK.' });
    if ((f.eu || f.uk) && has(cats, 'online_ids')) out.push({ law: 'ePrivacy Directive / UK PECR (cookies and electronic marketing)', why: 'Online identifiers (cookies, device IDs) for EU/UK people.' });
    if (f.eu && (f.ai || f.autoDecision)) out.push({ law: 'EU AI Act', why: 'AI or automated decision-making affecting people in the EU.' });
    if (f.us) out.push({ law: 'US state comprehensive privacy laws (e.g. California CCPA/CPRA, Virginia, Colorado, Texas)', why: 'People in the US. Which states apply depends on where people live and your organization\'s size and data volumes.' });
    if (f.us && f.childrenUnder13) out.push({ law: 'Children\'s Online Privacy Protection Act (COPPA)', why: 'Children under 13 in the US.' });
    if (f.us && has(cats, 'health')) out.push({ law: 'HIPAA (if a covered entity or business associate) and state health-data laws (e.g. Washington My Health My Data Act)', why: 'Health information about people in the US.' });
    if (f.us && has(cats, 'biometric')) out.push({ law: 'State biometric privacy laws (e.g. Illinois BIPA, Texas CUBI)', why: 'Biometric information about people in the US.' });
    if (f.us && has(cats, 'financial')) out.push({ law: 'Gramm-Leach-Bliley Act (if a financial institution)', why: 'Financial account information about people in the US.' });
    if (f.us && (has(subj, 'students') || has(cats, 'education'))) out.push({ law: 'FERPA (if an educational institution or acting for one)', why: 'Student or education records in the US.' });
    if (f.us && purposes.indexOf('marketing') !== -1) out.push({ law: 'CAN-SPAM Act and TCPA (email, text, and call marketing)', why: 'Marketing to people in the US.' });
    if (f.us && (has(subj, 'applicants') || has(subj, 'employees')) && has(cats, 'criminal')) out.push({ law: 'Fair Credit Reporting Act and state "ban the box" laws', why: 'Background checks on US applicants or employees.' });
    if (f.canada) out.push({ law: 'PIPEDA and provincial laws (e.g. Quebec Law 25)', why: 'People in Canada.' });
    if (has(arr(a.subject_regions), 'latam')) out.push({ law: 'Latin American data protection laws (e.g. Brazil LGPD)', why: 'People in Latin America.' });
    if (has(arr(a.subject_regions), 'apac')) out.push({ law: 'Asia-Pacific data protection laws (e.g. Singapore PDPA, Australia Privacy Act, India DPDP Act)', why: 'People in Asia-Pacific.' });
    return out;
  }

  /* ---------- Display helpers ---------- */

  function answerText(qid, v) {
    var q = Q.byId[qid];
    if (isBlank(v)) return '';
    if (!q) return String(v);
    if (q.type === 'list') {
      return arr(v).filter(function (row) { return row && row.name; }).map(function (row) {
        var bits = [row.service, row.location, row.dpa ? 'DPA: ' + ({ yes: 'Yes', no: 'No', unsure: 'Not sure' }[row.dpa] || row.dpa) : ''].filter(Boolean);
        return row.name + (bits.length ? ' (' + bits.join(', ') + ')' : '');
      }).join('; ');
    }
    if (Array.isArray(v)) return v.map(function (x) { return Q.optionLabel(qid, x); }).join('; ');
    if (q.type === 'single' || q.type === 'yesno') return Q.optionLabel(qid, v);
    return String(v);
  }

  /* ---------- Record of Processing Activities ---------- */

  function recordId(state) {
    var d = new Date(state.createdAt || Date.now());
    var ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    return 'PIA-' + ymd + '-' + String(state.id || '').slice(-4).toUpperCase();
  }

  function buildRopa(state) {
    var raw = state.answers || {};
    var ctx = context(raw);
    var a = ctx.answers;
    var f = ctx.flags;
    var s = ctx.screening;
    var risks = evaluateRisks(a, ctx, state.risks);
    var sum = riskSummary(risks);
    var t = function (qid) { return answerText(qid, a[qid]); };
    var join = function () { return Array.prototype.slice.call(arguments).filter(Boolean).join(' | '); };
    var org = cfg().organization;

    var transfers;
    if (!f.crossBorder) transfers = 'None identified';
    else transfers = join('Countries: ' + (t('storage_locations') || 'not specified') + (a.storage_other ? ' (' + a.storage_other + ')' : ''), 'Safeguard: ' + (t('transfer_mechanism') || 'not specified'), a.transfer_tia ? 'Transfer impact assessment: ' + t('transfer_tia') : '');

    var assessment = s.tierInfo ? s.tierInfo.label : 'Screening not completed';

    var fields = [
      { key: 'record_id', label: 'Record ID', value: recordId(state) },
      { key: 'activity', label: 'Name of processing activity', ref: 'Art. 30(1)', value: a.project_name || '' },
      { key: 'description', label: 'Description', value: a.project_description || '' },
      { key: 'controller', label: 'Controller name and contact', ref: 'Art. 30(1)(a)', value: join(a.org_name || org.name, org.address, a.privacy_contact ? 'Privacy contact: ' + a.privacy_contact : '') },
      { key: 'role', label: 'Organization\'s role', value: join(t('org_role'), a.other_org ? 'Other party: ' + a.other_org : '') },
      { key: 'dpo', label: 'DPO / privacy contact', ref: 'Art. 30(1)(a)', value: a.privacy_contact || org.dpoContact || org.privacyContact || '' },
      { key: 'owner', label: 'Business owner', value: join(a.project_owner, a.owner_email, a.department) },
      { key: 'status', label: 'Project stage / start date', value: join(t('project_stage'), a.go_live) },
      { key: 'purposes', label: 'Purposes of processing', ref: 'Art. 30(1)(b)', value: join(t('purpose_categories'), a.purpose_detail) },
      { key: 'lawful_basis', label: 'Lawful basis (Art. 6)', value: legalBasisText(a) },
      { key: 'special_condition', label: 'Special-category / criminal data condition (Art. 9/10)', value: f.special ? (t('special_condition') || 'Not specified') : 'Not applicable' },
      { key: 'subjects', label: 'Categories of data subjects', ref: 'Art. 30(1)(c)', value: join(t('subject_categories'), a.subject_other) },
      { key: 'volume', label: 'Approximate number of people', value: t('sc_scale') },
      { key: 'regions', label: 'Where data subjects are located', value: t('subject_regions') },
      { key: 'data_categories', label: 'Categories of personal data', ref: 'Art. 30(1)(c)', value: t('data_categories') },
      { key: 'special_data', label: 'Sensitive / special-category data', value: f.special || f.sensitiveOther ? f.specialLabels.concat(f.sensitiveOtherLabels).join('; ') : 'None' },
      { key: 'data_elements', label: 'Data elements', value: a.data_elements || '' },
      { key: 'sources', label: 'Sources of data', value: t('sources') },
      { key: 'systems', label: 'Systems and applications', value: a.systems || '' },
      { key: 'internal_access', label: 'Internal access', value: t('internal_access') },
      { key: 'recipients', label: 'Categories of recipients', ref: 'Art. 30(1)(d)', value: t('recipients') },
      { key: 'vendors', label: 'Processors / third parties', value: t('vendors') },
      { key: 'sale_share', label: 'Sold or shared for targeted advertising (US)', value: t('sell_share') || 'No' },
      { key: 'transfers', label: 'Transfers to third countries and safeguards', ref: 'Art. 30(1)(e)', value: transfers },
      { key: 'retention', label: 'Retention period', ref: 'Art. 30(1)(f)', value: join(t('retention_period'), a.retention_reason) },
      { key: 'deletion', label: 'Deletion / disposal method', value: t('deletion_method') },
      { key: 'security', label: 'Technical and organizational security measures', ref: 'Art. 30(1)(g)', value: join(t('security_controls'), a.security_review ? 'Security review: ' + t('security_review') : '') },
      { key: 'adm', label: 'Automated decision-making / profiling', value: (f.autoDecision || f.profiling) ? join(f.profiling ? 'Profiling: yes' : '', f.autoDecision ? 'Automated decisions: yes' : '', a.human_review ? 'Human review: ' + t('human_review') : '') : 'No' },
      { key: 'notice', label: 'Transparency / privacy notice', value: t('notice') },
      { key: 'rights', label: 'Data subject rights supported', value: rightsText(a) },
      { key: 'assessment', label: 'Assessment outcome', value: assessment },
      { key: 'screening_rationale', label: 'Screening rationale', value: s.rationale.join(' ') },
      { key: 'risk_inherent', label: 'Highest inherent risk', value: sum.highestInherent },
      { key: 'risk_residual', label: 'Highest residual risk', value: sum.highestResidual },
      { key: 'risk_count', label: 'Risks identified / open actions', value: sum.total + ' / ' + sum.openActions },
      { key: 'laws', label: 'Potentially applicable laws (indicative)', value: applicableLaws(a, f).map(function (l) { return l.law; }).join('; ') },
      { key: 'record_status', label: 'Record status', value: state.status === 'submitted' ? 'Submitted to legal' + (state.submittedAt ? ' on ' + state.submittedAt.slice(0, 10) : '') : 'Draft' },
      { key: 'last_updated', label: 'Last updated', value: (state.updatedAt || '').slice(0, 10) }
    ];
    return { fields: fields, ctx: ctx, risks: risks, summary: sum, laws: applicableLaws(a, f) };
  }

  function legalBasisText(a) {
    if (!a.legal_basis) return '';
    var out = Q.optionLabel('legal_basis', a.legal_basis);
    var formal = {
      contract: 'Art. 6(1)(b) contract', legal_obligation: 'Art. 6(1)(c) legal obligation', consent: 'Art. 6(1)(a) consent',
      legitimate_interests: 'Art. 6(1)(f) legitimate interests', vital_interests: 'Art. 6(1)(d) vital interests', public_task: 'Art. 6(1)(e) public task'
    }[a.legal_basis];
    return formal ? formal + ' (' + out + ')' : 'To be confirmed by legal';
  }

  function rightsText(a) {
    var parts = [];
    [['rights_access', 'Access'], ['rights_correct', 'Correction'], ['rights_delete', 'Deletion'], ['rights_optout', 'Opt-out'], ['complaints', 'Complaints channel']].forEach(function (p) {
      if (a[p[0]]) parts.push(p[1] + ': ' + answerText(p[0], a[p[0]]));
    });
    return parts.join('; ');
  }

  PIA.engine = {
    TIERS: TIERS,
    TIER_ORDER: TIER_ORDER,
    STATUS: STATUS,
    CRITERIA: CRITERIA,
    computeFlags: computeFlags,
    screen: screen,
    context: context,
    visibleSections: visibleSections,
    visibleQuestions: visibleQuestions,
    questionVisible: questionVisible,
    prefill: prefill,
    sectionProgress: sectionProgress,
    missingRequired: missingRequired,
    unanswered: unanswered,
    evaluateRisks: evaluateRisks,
    riskSummary: riskSummary,
    rating: rating,
    applicableLaws: applicableLaws,
    answerText: answerText,
    buildRopa: buildRopa,
    recordId: recordId,
    isBlank: isBlank
  };
})(typeof window !== 'undefined' ? window : globalThis);
