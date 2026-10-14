/*
 * Risk catalog. Each risk is triggered by answers and mapped to:
 *   - NIST Privacy Framework v1.0 subcategories (nist)
 *   - NIST PRAM problematic data actions (actions) and problems for individuals (problems)
 *
 * when(answers, ctx) returns an array of plain-language reasons; an empty array means "not triggered".
 * likelihood / impact are 1-5. adjust(answers, ctx) may return { likelihood, impact } deltas.
 * amplify: false opts out of the automatic sensitivity / scale modifiers applied by the engine.
 */
(function (root) {
  'use strict';
  var PIA = (root.PIA = root.PIA || {});

  function has(arr, v) { return Array.isArray(arr) && arr.indexOf(v) !== -1; }
  function hasAny(arr, vals) { return Array.isArray(arr) && vals.some(function (v) { return arr.indexOf(v) !== -1; }); }
  function notYes(v) { return v === 'no' || v === 'unsure'; }
  function yu(v) { return v === 'yes' || v === 'unsure'; }
  function reasons() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) { if (arguments[i][0]) out.push(arguments[i][1]); }
    return out;
  }
  function unsureNote(v) { return v === 'unsure' ? ' (answered "not sure")' : ''; }

  var KEY_CONTROLS = {
    encrypt_rest: 'Encrypt stored data (data at rest).',
    encrypt_transit: 'Encrypt data in transit (HTTPS/TLS everywhere, including internal APIs).',
    mfa: 'Require multi-factor authentication for anyone who can access the data.',
    rbac: 'Restrict access by role so people only see what their job needs.'
  };

  var risks = [
    {
      id: 'R01', title: 'Collecting more information than needed',
      description: 'The more you collect, the more there is to lose, misuse, or have to explain. Extra information raises the harm of any breach.',
      nist: ['ID.IM-P6', 'CT.DP-P4', 'GV.PO-P1'], actions: ['Insecurity', 'Surveillance'], problems: ['trust', 'dignity'],
      likelihood: 3, impact: 3,
      when: function (a) {
        var n = (a.data_categories || []).length;
        return reasons(
          [a.data_minimization === 'possibly', 'You said some information may be "nice to have" rather than essential.'],
          [a.data_minimization === 'unsure', 'It isn\'t yet clear whether all the information is necessary.'],
          [n >= 10, 'A wide range of information types (' + n + ') will be collected.']
        );
      },
      mitigations: ['Go through each data field and remove anything the project can work without.', 'Make non-essential fields optional and clearly labeled.', 'Use less precise versions where possible (age range instead of birth date, city instead of address).']
    },
    {
      id: 'R02', title: 'Sensitive information is involved',
      description: 'If sensitive information is exposed or misused, people can face discrimination, embarrassment, or financial harm. The law requires a stronger justification and stronger protection.',
      nist: ['ID.RA-P1', 'GV.PO-P5', 'PR.DS-P1', 'PR.AC-P4'], actions: ['Unanticipated Revelation', 'Stigmatization'], problems: ['dignity', 'discrimination', 'economic'],
      likelihood: 3, impact: 5, amplify: false,
      when: function (a, f) {
        return reasons(
          [f.special, 'Special-category or criminal record information: ' + f.specialLabels.join(', ') + '.'],
          [f.sensitiveOther, 'Other sensitive information: ' + f.sensitiveOtherLabels.join(', ') + '.'],
          [has(a.sc_sensitive_types, 'unsure'), 'It isn\'t yet confirmed whether sensitive information is involved.']
        );
      },
      mitigations: ['Have legal confirm the legal condition for using sensitive information before launch.', 'Limit access to named individuals who need it, and log all access.', 'Encrypt sensitive fields and separate them from everyday data.', 'Avoid free-text fields where people might enter sensitive details unnecessarily.']
    },
    {
      id: 'R03', title: 'Children\'s information',
      description: 'Children may not understand the risks or their rights. Laws such as COPPA (US) and GDPR Article 8 require parental consent and extra safeguards.',
      nist: ['ID.RA-P1', 'GV.PO-P5', 'CT.PO-P1', 'CM.AW-P1'], actions: ['Induced Disclosure', 'Surveillance'], problems: ['autonomy', 'dignity', 'physical'],
      likelihood: 3, impact: 4, amplify: false,
      when: function (a, f) {
        return reasons(
          [has(a.subject_categories, 'children_u13'), 'Children under 13 are included.'],
          [has(a.subject_categories, 'children_13_17'), 'Teenagers (13 to 17) are included.'],
          [f.children && !hasAny(a.subject_categories, ['children_u13', 'children_13_17']), 'Some people may be under 18' + unsureNote(a.sc_children) + '.']
        );
      },
      mitigations: ['Confirm the age of users and obtain verifiable parental consent where required (e.g. under 13 in the US).', 'Write a child-friendly explanation of what happens to their information.', 'Use high-privacy settings by default; switch off profiling, targeted ads and location sharing for minors.']
    },
    {
      id: 'R04', title: 'People in a vulnerable position',
      description: 'People who are vulnerable, or who can\'t easily refuse (like employees), may not be able to protect their own interests or freely agree.',
      nist: ['ID.RA-P1', 'CM.AW-P1', 'CT.PO-P3'], actions: ['Induced Disclosure', 'Unwarranted Restriction'], problems: ['autonomy', 'exclusion', 'dignity'],
      likelihood: 3, impact: 4, amplify: false,
      when: function (a) {
        return reasons(
          [yu(a.sc_vulnerable), 'Some people may be vulnerable or unable to easily say no' + unsureNote(a.sc_vulnerable) + '.'],
          [has(a.subject_categories, 'patients'), 'Patients are included.'],
          [has(a.subject_categories, 'vulnerable_adults'), 'Vulnerable adults are included.'],
          [has(a.subject_categories, 'employees') && a.legal_basis === 'consent', 'Employees are asked for consent, which may not be freely given because of the power imbalance.']
        );
      },
      mitigations: ['Don\'t rely on consent where people can\'t freely refuse; choose a different legal basis with legal.', 'Provide accessible explanations (plain language, other languages, accessible formats).', 'Give people an easy, safe way to raise concerns or object.']
    },
    {
      id: 'R05', title: 'Large-scale processing',
      description: 'The more people involved, the more people are harmed if something goes wrong, and the more attractive the data is to attackers.',
      nist: ['ID.RA-P4', 'PR.DS-P5', 'PR.PO-P7'], actions: ['Insecurity'], problems: ['economic', 'trust'],
      likelihood: 3, impact: 3, amplify: false,
      adjust: function (a, f) { return { likelihood: f.veryLarge ? 1 : 0, impact: f.veryLarge ? 1 : 0 }; },
      when: function (a, f) {
        return reasons(
          [f.largeScale && a.sc_scale !== 'unsure', 'Information about ' + PIA.questions.optionLabel('sc_scale', a.sc_scale).toLowerCase() + ' people.'],
          [a.sc_scale === 'unsure', 'The number of people involved isn\'t known yet, so we\'ve assumed it could be large.']
        );
      },
      mitigations: ['Split data so a single breach can\'t expose everyone.', 'Put alerts in place for unusually large downloads or exports.', 'Test the incident response plan against this system.']
    },
    {
      id: 'R06', title: 'People may not know what\'s happening',
      description: 'If people aren\'t told clearly how their information is used, they can\'t make informed choices. Lack of transparency is a common reason for regulatory fines.',
      nist: ['CM.AW-P1', 'CM.PO-P1', 'CM.AW-P3'], actions: ['Unanticipated Revelation'], problems: ['trust', 'autonomy'],
      likelihood: 4, impact: 3,
      when: function (a) {
        return reasons(
          [a.notice === 'not_yet', 'People haven\'t been told yet.'],
          [a.notice === 'no', 'People won\'t be told, or it isn\'t possible to tell them.'],
          [a.notice === 'unsure', 'It isn\'t clear whether people will be told.'],
          [a.notice_plain === 'no' || a.notice_plain === 'unsure', 'The explanation may not be short, clear, or easy to find.']
        );
      },
      mitigations: ['Update the privacy notice before launch to cover this use.', 'Add a short "just-in-time" message where information is collected.', 'Have someone outside the project read the notice and check it makes sense.']
    },
    {
      id: 'R07', title: 'Using information in unexpected ways',
      description: 'Using information for something people didn\'t expect, or for a new purpose, breaks trust and may breach the "purpose limitation" rule.',
      nist: ['ID.IM-P5', 'GV.PO-P1', 'CT.PO-P1'], actions: ['Appropriation'], problems: ['trust', 'autonomy'],
      likelihood: 4, impact: 3,
      when: function (a) {
        return reasons(
          [notYes(a.purpose_expected), 'People may not expect their information to be used this way' + unsureNote(a.purpose_expected) + '.'],
          [yu(a.sc_new_use), 'Information is being reused for a different reason than it was collected for' + unsureNote(a.sc_new_use) + '.']
        );
      },
      mitigations: ['Ask legal to check whether the new use is compatible with the original purpose.', 'Tell people about the new use before it starts and, where needed, ask for consent.', 'Keep datasets for different purposes separate.']
    },
    {
      id: 'R08', title: 'Legal basis not yet confirmed',
      description: 'Every use of personal data needs a legal basis. Without one, the processing may be unlawful from the start.',
      nist: ['GV.PO-P5', 'CT.PO-P1'], actions: ['Appropriation'], problems: ['trust', 'autonomy'],
      likelihood: 3, impact: 4,
      when: function (a) { return reasons([a.legal_basis === 'unsure', 'The legal basis hasn\'t been decided.']); },
      mitigations: ['Legal to confirm and document the legal basis before any data is collected.']
    },
    {
      id: 'R09', title: 'Permission (consent) may not be valid',
      description: 'Consent only counts if it\'s a clear, active, informed choice that people can take back. Pre-ticked boxes or "by continuing you agree" usually don\'t count.',
      nist: ['CT.PO-P1', 'CT.PO-P3', 'CM.AW-P1', 'CT.DM-P7'], actions: ['Induced Disclosure'], problems: ['autonomy', 'trust'],
      likelihood: 4, impact: 3,
      when: function (a) {
        if (a.legal_basis !== 'consent') return [];
        return reasons(
          [a.consent_mechanism === 'prechecked', 'Consent boxes are pre-ticked.'],
          [a.consent_mechanism === 'implied', 'Consent is assumed from using the service.'],
          [a.consent_mechanism === 'undecided', 'How consent will be collected isn\'t decided.'],
          [notYes(a.consent_withdraw), 'People may not be able to easily withdraw consent' + unsureNote(a.consent_withdraw) + '.']
        );
      },
      mitigations: ['Use an unticked box or a clear "I agree" button for each separate purpose.', 'Record who agreed, when, and to what wording.', 'Make withdrawing as easy as agreeing (one click or toggle), and stop processing when someone withdraws.']
    },
    {
      id: 'R10', title: 'Business-need justification not documented',
      description: 'Relying on "legitimate interests" requires a written balancing test showing the business need doesn\'t override people\'s rights.',
      nist: ['GV.PO-P5', 'ID.RA-P3'], actions: ['Appropriation'], problems: ['trust', 'autonomy'],
      likelihood: 3, impact: 3,
      when: function (a) {
        return a.legal_basis === 'legitimate_interests'
          ? reasons([notYes(a.li_balancing), 'No legitimate interests assessment has been documented' + unsureNote(a.li_balancing) + '.'])
          : [];
      },
      mitigations: ['Complete a legitimate interests assessment (purpose, necessity, balancing) with the privacy team.', 'Offer people a simple way to object.']
    },
    {
      id: 'R11', title: 'No confirmed justification for sensitive information',
      description: 'Sensitive (special-category) information needs a specific legal condition in addition to the legal basis. Without one, processing is prohibited under GDPR Article 9.',
      nist: ['GV.PO-P5'], actions: ['Appropriation', 'Stigmatization'], problems: ['dignity', 'discrimination'],
      likelihood: 3, impact: 5, amplify: false,
      when: function (a, f) { return f.special ? reasons([a.special_condition === 'unsure', 'The condition for using sensitive information isn\'t confirmed.']) : []; },
      mitigations: ['Legal to identify and document the Article 9 / Article 10 condition (and any national-law basis) before processing starts.']
    },
    {
      id: 'R12', title: 'Monitoring or tracking people',
      description: 'Watching or tracking people can feel intrusive, change how they behave, and reveal more about them than intended.',
      nist: ['CT.DP-P1', 'CT.DP-P3', 'CM.AW-P3', 'ID.RA-P3'], actions: ['Surveillance'], problems: ['autonomy', 'dignity', 'liberty'],
      likelihood: 4, impact: 4,
      adjust: function (a) { return { likelihood: notYes(a.monitoring_aware) ? 1 : 0, impact: 0 }; },
      when: function (a, f) {
        if (!f.monitoring) return [];
        var types = (a.monitoring_type || []).map(function (t) { return PIA.questions.optionLabel('monitoring_type', t).toLowerCase(); });
        return reasons(
          [true, types.length ? 'Monitoring involves: ' + types.join(', ') + '.' : 'The project involves watching or tracking people' + unsureNote(a.sc_monitoring) + '.'],
          [yu(a.sc_public_monitoring), 'Monitoring covers public or shared spaces, or happens at large scale.'],
          [notYes(a.monitoring_aware), 'People may not clearly know they are being monitored.']
        );
      },
      mitigations: ['Limit monitoring to what is strictly necessary: specific places, times, and people.', 'Tell people clearly (signs, policies, on-screen notices) before monitoring starts.', 'Aggregate or anonymise results where you don\'t need to know who did what.', 'Set short retention periods for recordings and logs.']
    },
    {
      id: 'R13', title: 'Secret monitoring',
      description: 'Covert monitoring is highly intrusive and is only lawful in narrow, exceptional circumstances with strict controls.',
      nist: ['CM.AW-P1', 'CM.AW-P3', 'GV.PO-P5'], actions: ['Surveillance', 'Unanticipated Revelation'], problems: ['dignity', 'autonomy', 'trust'],
      likelihood: 4, impact: 5,
      when: function (a) { return reasons([yu(a.monitoring_covert), 'Some monitoring may be done secretly' + unsureNote(a.monitoring_covert) + '.']); },
      mitigations: ['Avoid covert monitoring. If truly necessary (e.g. a specific criminal investigation), get written legal approval, limit it in time and scope, and document the justification.']
    },
    {
      id: 'R14', title: 'Automated decisions about people',
      description: 'Decisions made by a system without real human review can be wrong, unfair, or impossible to challenge, and can seriously affect people\'s lives.',
      nist: ['CT.DM-P10', 'ID.RA-P2', 'CM.AW-P8', 'GV.PO-P5'], actions: ['Distortion', 'Unwarranted Restriction'], problems: ['discrimination', 'economic', 'exclusion'],
      likelihood: 3, impact: 5,
      when: function (a, f) {
        return reasons(
          [f.autoDecision, 'Important decisions may be made without a person checking them' + unsureNote(a.sc_auto_decision) + '.'],
          [a.human_review === 'none', 'System results apply automatically with no human review.'],
          [a.human_review === 'some', 'Human review is partial or may be a rubber stamp.']
        );
      },
      mitigations: ['Have a trained person meaningfully review decisions, with authority to overrule the system.', 'Tell people when a decision is automated and how to ask for a human review.', 'Monitor decision outcomes regularly for errors.']
    },
    {
      id: 'R15', title: 'Unfair or biased outcomes',
      description: 'Scoring and AI systems can treat some groups unfairly, for example by age, gender, ethnicity, or disability, even when that isn\'t intended.',
      nist: ['ID.RA-P2', 'CT.DM-P10'], actions: ['Distortion'], problems: ['discrimination', 'exclusion'],
      likelihood: 3, impact: 4,
      when: function (a, f) {
        if (!(f.profiling || f.ai || f.autoDecision)) return [];
        return reasons([notYes(a.bias_testing), 'The system hasn\'t been tested for fair treatment of different groups' + unsureNote(a.bias_testing) + '.']);
      },
      mitigations: ['Test outcomes across groups before launch and regularly afterwards.', 'Check training data represents the people the system will be used on.', 'Remove inputs that act as stand-ins for protected characteristics (e.g. postcode for ethnicity).']
    },
    {
      id: 'R16', title: 'Results can\'t be explained or challenged',
      description: 'If nobody can explain why the system reached a result, people can\'t understand it, correct errors, or challenge unfair outcomes.',
      nist: ['CM.AW-P1', 'CM.AW-P8', 'CT.PO-P3'], actions: ['Unwarranted Restriction', 'Distortion'], problems: ['autonomy', 'exclusion'],
      likelihood: 3, impact: 4,
      when: function (a) {
        return reasons(
          [notYes(a.explainability), 'Results may not be explainable in plain words' + unsureNote(a.explainability) + '.'],
          [notYes(a.contest_decision), 'People may not be able to challenge a result' + unsureNote(a.contest_decision) + '.']
        );
      },
      mitigations: ['Document the main factors behind results and prepare a plain-language explanation.', 'Set up a process for people to challenge results and get a human review.']
    },
    {
      id: 'R17', title: 'Biometric or facial recognition',
      description: 'Biometrics can\'t be changed if leaked, and recognition technology can enable tracking and misidentification. Several US states (e.g. Illinois BIPA) allow people to sue directly.',
      nist: ['PR.DS-P1', 'CT.DP-P2', 'ID.RA-P1', 'GV.PO-P5'], actions: ['Surveillance', 'Insecurity', 'Re-identification'], problems: ['dignity', 'liberty', 'economic'],
      likelihood: 3, impact: 5, amplify: false,
      when: function (a) {
        return reasons(
          [has(a.data_categories, 'biometric') || has(a.sc_sensitive_types, 'biometric'), 'Biometric information is used.'],
          [has(a.ai_use, 'facial'), 'Facial recognition or biometric identification is used.'],
          [has(a.ai_use, 'emotion'), 'The system tries to detect emotions or mood.']
        );
      },
      mitigations: ['Offer a non-biometric alternative.', 'Store mathematical templates rather than raw images, ideally on the person\'s own device.', 'Get explicit written consent and publish a biometric retention and destruction policy.', 'Avoid emotion recognition. It is unreliable and banned in some settings under the EU AI Act.']
    },
    {
      id: 'R18', title: 'Personal information used to train AI',
      description: 'Once information is used to train a model it can be hard to remove, and models can sometimes repeat personal details they were trained on.',
      nist: ['ID.IM-P5', 'ID.DE-P3', 'CT.DP-P2', 'CT.DM-P4'], actions: ['Appropriation', 'Unanticipated Revelation', 'Re-identification'], problems: ['trust', 'dignity'],
      likelihood: 3, impact: 4,
      when: function (a) {
        return reasons(
          [has(a.ai_use, 'training') || has(a.purpose_categories, 'ai_training'), 'Personal information will be used to train or improve AI models.'],
          [yu(a.vendor_ai_training), 'A vendor may use the information for its own purposes, such as training its AI' + unsureNote(a.vendor_ai_training) + '.']
        );
      },
      mitigations: ['Remove or mask personal details before training.', 'Make sure vendor contracts prohibit training on your data (or opt out in settings).', 'Tell people about AI training and honor objections and deletion requests.', 'Test models for leakage of personal information.']
    },
    {
      id: 'R19', title: 'Combining information from different sources',
      description: 'Joining datasets can reveal far more about a person than any single source, and can re-identify people in "anonymous" data.',
      nist: ['CT.DP-P2', 'CT.DP-P3', 'ID.RA-P3', 'ID.IM-P8'], actions: ['Unanticipated Revelation', 'Re-identification'], problems: ['dignity', 'discrimination'],
      likelihood: 3, impact: 4,
      when: function (a) { return reasons([yu(a.sc_combine), 'Information from different sources will be combined or matched' + unsureNote(a.sc_combine) + '.']); },
      mitigations: ['Map exactly which datasets are joined and why.', 'Only join the fields needed; use codes instead of names to link records.', 'Check the combined use is compatible with what people were told for each source.']
    },
    {
      id: 'R20', title: 'Vendors without proper contracts',
      description: 'Without a contract, a vendor may use, keep, or share the information however they like, and you remain responsible.',
      nist: ['ID.DE-P2', 'ID.DE-P3', 'ID.DE-P5', 'GV.PO-P4'], actions: ['Insecurity', 'Appropriation'], problems: ['economic', 'trust'],
      likelihood: 3, impact: 4,
      when: function (a) {
        var vendors = (a.vendors || []).filter(function (v) { return v && v.name; });
        var missing = vendors.filter(function (v) { return v.dpa === 'no' || v.dpa === 'unsure' || !v.dpa; });
        var externalRecipients = Array.isArray(a.recipients) && a.recipients.length && !has(a.recipients, 'none');
        return reasons(
          [missing.length > 0, 'No confirmed contract (DPA) with: ' + missing.map(function (v) { return v.name; }).join(', ') + '.'],
          [externalRecipients && vendors.length === 0, 'Outside organizations will receive the information but haven\'t been identified yet.']
        );
      },
      mitigations: ['Put a Data Processing Agreement in place with every vendor before sharing data.', 'Run a vendor privacy and security review (questionnaire, certifications such as SOC 2 / ISO 27001).', 'Get a list of the vendor\'s own subcontractors and the right to audit.']
    },
    {
      id: 'R21', title: 'Selling or sharing information for advertising',
      description: 'Giving information to others for money, benefit, or targeted ads triggers opt-out rights under US state laws and usually needs consent in the EU/UK.',
      nist: ['CT.PO-P3', 'CM.AW-P1', 'CM.AW-P4', 'GV.PO-P5'], actions: ['Appropriation', 'Unanticipated Revelation'], problems: ['trust', 'autonomy', 'economic'],
      likelihood: 4, impact: 3,
      when: function (a) {
        return reasons(
          [yu(a.sell_share), 'Information may be sold or shared for targeted advertising' + unsureNote(a.sell_share) + '.'],
          [has(a.recipients, 'data_brokers'), 'Information goes to data brokers or list providers.'],
          [has(a.recipients, 'ad_partners'), 'Information goes to advertising or marketing partners.']
        );
      },
      mitigations: ['Provide a "Do Not Sell or Share My Personal Information" option and honor Global Privacy Control signals.', 'Get opt-in consent for targeted advertising where required (EU/UK, and sensitive data in US states).', 'Use contracts that limit what recipients can do with the information.']
    },
    {
      id: 'R22', title: 'Moving information across borders without safeguards',
      description: 'Sending EU/UK information abroad without an approved safeguard is unlawful, and foreign authorities may be able to access it.',
      nist: ['ID.IM-P7', 'GV.PO-P5', 'ID.DE-P3'], actions: ['Insecurity', 'Surveillance'], problems: ['trust', 'liberty'],
      likelihood: 3, impact: 3,
      when: function (a, f) {
        if (!f.crossBorder) return [];
        return reasons(
          [a.transfer_mechanism === 'none' || a.transfer_mechanism === 'unsure', 'No confirmed safeguard for international transfers.'],
          [a.transfer_mechanism === 'derogation', 'Relying on a one-off exception, which only suits occasional transfers.'],
          [notYes(a.transfer_tia), 'No transfer risk check has been done' + unsureNote(a.transfer_tia) + '.'],
          [has(a.storage_locations, 'unsure'), 'It isn\'t known where the information will be stored.']
        );
      },
      mitigations: ['Confirm where every vendor stores and accesses data.', 'Use Standard Contractual Clauses or an adequacy decision (e.g. EU-US Data Privacy Framework certification).', 'Complete a transfer impact assessment, and encrypt data with keys held in the home region where possible.']
    },
    {
      id: 'R23', title: 'Keeping information too long',
      description: 'Information kept longer than needed piles up risk, and storing data indefinitely breaches the "storage limitation" rule.',
      nist: ['CT.DM-P5', 'CT.PO-P4', 'GV.PO-P1'], actions: ['Insecurity', 'Appropriation'], problems: ['trust', 'economic'],
      likelihood: 4, impact: 3,
      when: function (a) {
        return reasons(
          [a.retention_period === 'indefinite', 'There is no plan to delete the information.'],
          [a.retention_period === 'unsure', 'The retention period isn\'t known.'],
          [a.retention_period === 'gt7y' && !a.retention_reason, 'Information is kept for more than 7 years without a stated reason.'],
          [a.deletion_method === 'undecided', 'How information will be deleted hasn\'t been decided.']
        );
      },
      mitigations: ['Set a retention period for each type of information, based on legal requirements and business need.', 'Automate deletion or anonymisation at the end of the period, including backups and vendor copies.']
    },
    {
      id: 'R24', title: 'Security protections may not be enough',
      description: 'Weak security is the most common way personal information gets exposed, leading to fraud, identity theft, and distress.',
      nist: ['PR.DS-P1', 'PR.DS-P2', 'PR.AC-P1', 'PR.AC-P4', 'PR.AC-P6'], actions: ['Insecurity'], problems: ['economic', 'dignity', 'trust'],
      likelihood: 3, impact: 4,
      adjust: function (a) {
        var missing = Object.keys(KEY_CONTROLS).filter(function (k) { return !has(a.security_controls, k); });
        return { likelihood: (missing.length >= 3 ? 1 : 0) + (a.security_review === 'no' ? 1 : 0), impact: 0 };
      },
      when: function (a) {
        if (a.security_controls === undefined && a.security_review === undefined) return [];
        var missing = Object.keys(KEY_CONTROLS).filter(function (k) { return !has(a.security_controls, k); });
        return reasons(
          [a.security_controls !== undefined && missing.length > 0, 'Basic protections not confirmed: ' + missing.map(function (k) { return PIA.questions.optionLabel('security_controls', k).toLowerCase(); }).join('; ') + '.'],
          [a.security_review === 'no', 'IT/security hasn\'t reviewed the project.'],
          [a.security_review === 'unsure', 'It isn\'t known whether IT/security has reviewed the project.']
        );
      },
      mitigations: function (a) {
        var list = Object.keys(KEY_CONTROLS).filter(function (k) { return !has(a.security_controls, k); }).map(function (k) { return KEY_CONTROLS[k]; });
        if (a.security_review !== 'yes') list.push('Book a security review with your IT/security team before launch.');
        return list.length ? list : ['Keep security controls under regular review.'];
      }
    },
    {
      id: 'R25', title: 'Too many people inside the organization can see it',
      description: 'Broad internal access increases the chance of snooping, mistakes, and insider misuse.',
      nist: ['PR.AC-P4', 'CT.DM-P8'], actions: ['Insecurity', 'Appropriation'], problems: ['dignity', 'trust'],
      likelihood: 3, impact: 3,
      when: function (a) {
        return reasons(
          [a.internal_access === 'broad', 'Many teams across the organization will have access.'],
          [a.internal_access === 'team', 'A whole team or department will have access, not just those who need it.'],
          [a.internal_access === 'undecided', 'Who will have access hasn\'t been decided.']
        );
      },
      mitigations: ['Grant access by role, on a need-to-know basis.', 'Log access and review the access list at least every quarter.']
    },
    {
      id: 'R26', title: 'Real information used in testing',
      description: 'Test and development environments usually have weaker protection and wider access than live systems.',
      nist: ['PR.DS-P7', 'CT.DP-P2'], actions: ['Insecurity'], problems: ['economic', 'trust'],
      likelihood: 3, impact: 3,
      when: function (a) { return reasons([yu(a.test_with_real), 'Real people\'s information may be used for testing' + unsureNote(a.test_with_real) + '.']); },
      mitigations: ['Use synthetic (fake) or masked data for testing.', 'If real data is unavoidable, protect the test environment like the live one and delete data after testing.']
    },
    {
      id: 'R27', title: 'Not ready to respond to a data breach',
      description: 'Many laws require regulators and affected people to be told quickly after a breach (72 hours under GDPR). Delays make harm worse and can lead to fines.',
      nist: ['PR.PO-P7', 'PR.PO-P8', 'CM.AW-P7'], actions: ['Insecurity'], problems: ['economic', 'trust'],
      likelihood: 2, impact: 4,
      when: function (a) { return reasons([notYes(a.breach_plan), 'The team may not know how to report a data incident straight away' + unsureNote(a.breach_plan) + '.']); },
      mitigations: ['Make sure everyone on the project knows how to report an incident immediately (who, how, and that it\'s urgent).', 'Include this system in the incident response plan and vendor contracts (vendors must notify you promptly).']
    },
    {
      id: 'R28', title: 'Can\'t meet people\'s privacy rights',
      description: 'People can ask to see, correct, or delete their information. If the system can\'t support that, you may miss legal deadlines (typically 30 to 45 days).',
      nist: ['CT.PO-P2', 'CT.PO-P3', 'CT.DM-P1', 'CT.DM-P3', 'CT.DM-P4'], actions: ['Unwarranted Restriction'], problems: ['autonomy', 'trust'],
      likelihood: 3, impact: 3,
      when: function (a) {
        return reasons(
          [notYes(a.rights_access), 'May not be able to provide people with a copy of their information' + unsureNote(a.rights_access) + '.'],
          [notYes(a.rights_correct), 'May not be able to correct information' + unsureNote(a.rights_correct) + '.'],
          [notYes(a.rights_delete), 'May not be able to delete information everywhere it\'s held' + unsureNote(a.rights_delete) + '.']
        );
      },
      mitigations: ['Make sure the system can search, export, correct, and delete one person\'s records.', 'Connect the system to your privacy request process, including vendors and backups.']
    },
    {
      id: 'R29', title: 'No way to opt out',
      description: 'People have rights to object to marketing and, in many places, to profiling and the sale or sharing of their data.',
      nist: ['CT.PO-P3', 'CM.AW-P1'], actions: ['Induced Disclosure', 'Appropriation'], problems: ['autonomy', 'trust'],
      likelihood: 3, impact: 3,
      when: function (a) { return reasons([notYes(a.rights_optout), 'People may not be able to opt out of marketing, profiling, or selling/sharing' + unsureNote(a.rights_optout) + '.']); },
      mitigations: ['Add simple opt-out controls (unsubscribe links, preference center, account settings).', 'Make sure opt-outs flow through to every system and vendor.']
    },
    {
      id: 'R30', title: 'Information collected from other sources',
      description: 'When information comes from someone other than the person, they may not know you have it, and it may be inaccurate or not lawfully obtained.',
      nist: ['ID.DE-P2', 'CM.AW-P6', 'CM.AW-P1'], actions: ['Distortion', 'Unanticipated Revelation'], problems: ['trust', 'autonomy'],
      likelihood: 3, impact: 3,
      when: function (a) {
        return reasons(
          [has(a.sources, 'third_party'), 'Information comes from other companies.'],
          [has(a.sources, 'public'), 'Information is gathered from public sources such as websites or social media.']
        );
      },
      mitigations: ['Check that the source collected the information lawfully and can share it with you.', 'Tell people you have their information (normally within one month under GDPR Article 14).', 'Record where each piece of information came from.']
    },
    {
      id: 'R31', title: 'Information may be inaccurate',
      description: 'Decisions based on wrong or out-of-date information can unfairly harm people.',
      nist: ['CT.DM-P3', 'CM.AW-P5'], actions: ['Distortion'], problems: ['economic', 'exclusion'],
      likelihood: 3, impact: 3,
      when: function (a) { return reasons([notYes(a.data_accuracy), 'Incorrect information may not be easy to fix' + unsureNote(a.data_accuracy) + '.']); },
      mitigations: ['Let people review and update their own information.', 'Pass corrections on to anyone the information was shared with.']
    },
    {
      id: 'R32', title: 'Online tracking without a real choice',
      description: 'Cookies and trackers that aren\'t strictly necessary require consent in the EU/UK, and some US laws require honoring opt-out signals.',
      nist: ['CT.PO-P1', 'CM.AW-P1', 'CT.DP-P4'], actions: ['Surveillance'], problems: ['autonomy', 'trust'],
      likelihood: 4, impact: 2,
      when: function (a) {
        return has(a.data_categories, 'online_ids')
          ? reasons([notYes(a.cookies_consent), 'Visitors may not get a real choice about cookies and trackers' + unsureNote(a.cookies_consent) + '.'])
          : [];
      },
      mitigations: ['Use a cookie banner with equally prominent "accept" and "reject" options.', 'Don\'t load non-essential trackers until people agree, and honor Global Privacy Control.']
    },
    {
      id: 'R33', title: 'Nowhere to raise concerns',
      description: 'Without a clear contact point, small concerns turn into regulatory complaints.',
      nist: ['GV.MT-P5', 'CM.AW-P2'], actions: ['Unwarranted Restriction'], problems: ['trust', 'exclusion'],
      likelihood: 2, impact: 3,
      when: function (a) { return reasons([notYes(a.complaints), 'There may be no clear place to raise questions or complaints' + unsureNote(a.complaints) + '.']); },
      mitigations: ['Publish a privacy contact (email or form) in the privacy notice and in the product.']
    }
  ];

  PIA.risks = risks;
})(typeof window !== 'undefined' ? window : globalThis);
