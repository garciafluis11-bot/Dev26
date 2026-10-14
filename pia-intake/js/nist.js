/*
 * NIST Privacy Framework v1.0 reference data (functions, categories, the subcategories this tool maps to)
 * and the NIST Privacy Risk Assessment Methodology (PRAM) catalogs of problematic data actions and problems.
 * Subcategory text is paraphrased; see https://www.nist.gov/privacy-framework for the authoritative wording.
 */
(function (root) {
  'use strict';
  var PIA = (root.PIA = root.PIA || {});

  var functions = {
    'ID-P': { name: 'Identify-P', desc: 'Understand how data is processed and the resulting privacy risks to individuals.' },
    'GV-P': { name: 'Govern-P', desc: 'Set up governance: policies, legal requirements, risk tolerance, and accountability.' },
    'CT-P': { name: 'Control-P', desc: 'Give the organization and individuals control over data with enough detail to manage privacy risk.' },
    'CM-P': { name: 'Communicate-P', desc: 'Help the organization and individuals understand how data is processed and the associated risks.' },
    'PR-P': { name: 'Protect-P', desc: 'Put data processing safeguards in place to prevent cybersecurity-related privacy events.' }
  };

  var categories = {
    'ID.IM-P': 'Inventory and Mapping',
    'ID.BE-P': 'Business Environment',
    'ID.RA-P': 'Risk Assessment',
    'ID.DE-P': 'Data Processing Ecosystem Risk Management',
    'GV.PO-P': 'Governance Policies, Processes, and Procedures',
    'GV.RM-P': 'Risk Management Strategy',
    'GV.AT-P': 'Awareness and Training',
    'GV.MT-P': 'Monitoring and Review',
    'CT.PO-P': 'Data Processing Policies, Processes, and Procedures',
    'CT.DM-P': 'Data Processing Management',
    'CT.DP-P': 'Disassociated Processing',
    'CM.PO-P': 'Communication Policies, Processes, and Procedures',
    'CM.AW-P': 'Data Processing Awareness',
    'PR.PO-P': 'Data Protection Policies, Processes, and Procedures',
    'PR.AC-P': 'Identity Management, Authentication, and Access Control',
    'PR.DS-P': 'Data Security',
    'PR.MA-P': 'Maintenance',
    'PR.PT-P': 'Protective Technology'
  };

  var subcategories = {
    'ID.IM-P4': 'Data actions of the systems, products, or services are inventoried.',
    'ID.IM-P5': 'The purposes for the data actions are inventoried.',
    'ID.IM-P6': 'Data elements within the data actions are inventoried.',
    'ID.IM-P7': 'The data processing environment is identified (e.g., geographic location, internal, cloud, third parties).',
    'ID.IM-P8': 'Data processing is mapped, illustrating the data actions and associated data elements.',
    'ID.RA-P1': 'Contextual factors are identified (e.g., individuals\' demographics and privacy interests, data sensitivity, visibility of processing).',
    'ID.RA-P2': 'Data analytic inputs and outputs are identified and evaluated for bias.',
    'ID.RA-P3': 'Potential problematic data actions and associated problems are identified.',
    'ID.RA-P4': 'Problematic data actions, likelihoods, and impacts are used to determine and prioritize risk.',
    'ID.RA-P5': 'Risk responses are identified, prioritized, and implemented.',
    'ID.DE-P2': 'Data processing ecosystem parties (e.g., service providers, partners) are identified, prioritized, and assessed.',
    'ID.DE-P3': 'Contracts with ecosystem parties are used to implement privacy objectives.',
    'ID.DE-P5': 'Ecosystem parties are routinely assessed (e.g., audits, test results) to confirm they meet obligations.',
    'GV.PO-P1': 'Organizational privacy values and policies (e.g., conditions on data uses, retention periods, individuals\' prerogatives) are established and communicated.',
    'GV.PO-P4': 'Privacy roles and responsibilities are coordinated and aligned with third-party stakeholders (e.g., service providers).',
    'GV.PO-P5': 'Legal, regulatory, and contractual requirements regarding privacy are understood and managed.',
    'GV.MT-P1': 'Privacy risk is re-evaluated on an ongoing basis and as key factors change.',
    'GV.MT-P3': 'Policies, processes, and procedures for assessing compliance with legal requirements and privacy policies are established.',
    'GV.MT-P5': 'Policies, processes, and procedures for receiving, tracking, and responding to complaints, concerns, and questions from individuals are established.',
    'CT.PO-P1': 'Policies for authorizing data processing (e.g., organizational decisions, individual consent), revoking authorizations, and maintaining authorizations are established.',
    'CT.PO-P2': 'Policies for enabling data review, transfer, sharing or disclosure, alteration, and deletion are established.',
    'CT.PO-P3': 'Policies for enabling individuals\' data processing preferences and requests are established.',
    'CT.PO-P4': 'A data life cycle to manage data is aligned and implemented with the system development life cycle.',
    'CT.DM-P1': 'Data elements can be accessed for review.',
    'CT.DM-P2': 'Data elements can be accessed for transmission or disclosure.',
    'CT.DM-P3': 'Data elements can be accessed for alteration.',
    'CT.DM-P4': 'Data elements can be accessed for deletion.',
    'CT.DM-P5': 'Data are destroyed according to policy.',
    'CT.DM-P7': 'Mechanisms for transmitting processing permissions and related data values with data elements are established.',
    'CT.DM-P8': 'Audit/log records are determined, documented, implemented, and reviewed in accordance with policy.',
    'CT.DM-P10': 'Stakeholder privacy preferences are included in algorithmic design objectives and outputs are evaluated against these preferences.',
    'CT.DP-P1': 'Data are processed to limit observability and linkability (e.g., on-device processing, privacy-preserving cryptography).',
    'CT.DP-P2': 'Data are processed to limit the identification of individuals (e.g., de-identification, tokenization).',
    'CT.DP-P3': 'Data are processed to limit the formulation of inferences about individuals\' behavior or activities.',
    'CT.DP-P4': 'System or device configurations permit selective collection or disclosure of data elements.',
    'CM.PO-P1': 'Transparency policies for communicating data processing purposes, practices, and associated privacy risks are established.',
    'CM.AW-P1': 'Mechanisms (e.g., notices, reports) for communicating data processing purposes, practices, risks, and options for individuals\' preferences and requests are established.',
    'CM.AW-P2': 'Mechanisms for obtaining feedback from individuals (e.g., surveys, focus groups) about data processing and privacy risks are established.',
    'CM.AW-P3': 'System/product/service design enables data processing visibility.',
    'CM.AW-P4': 'Records of data disclosures and sharing are maintained and can be accessed for review or transmission.',
    'CM.AW-P5': 'Data corrections or deletions can be communicated to individuals or organizations in the data processing ecosystem.',
    'CM.AW-P6': 'Data provenance and lineage are maintained and can be accessed for review or transmission.',
    'CM.AW-P7': 'Impacted individuals and organizations are notified about a privacy breach or event.',
    'CM.AW-P8': 'Individuals are provided with mitigation mechanisms (e.g., credit monitoring, consent withdrawal, data alteration or deletion) to address impacts of problematic data actions.',
    'PR.PO-P7': 'Response plans (incident response, business continuity) and recovery plans are established, in place, and managed.',
    'PR.PO-P8': 'Response and recovery plans are tested.',
    'PR.AC-P1': 'Identities and credentials are issued, managed, verified, revoked, and audited for authorized individuals, processes, and devices.',
    'PR.AC-P4': 'Access permissions and authorizations are managed, incorporating least privilege and separation of duties.',
    'PR.AC-P6': 'Individuals and devices are proofed and bound to credentials, and authenticated commensurate with risk.',
    'PR.DS-P1': 'Data-at-rest are protected.',
    'PR.DS-P2': 'Data-in-transit are protected.',
    'PR.DS-P3': 'Systems/products/services and associated data are formally managed throughout removal, transfers, and disposition.',
    'PR.DS-P5': 'Protections against data leaks are implemented.',
    'PR.DS-P7': 'The development and testing environment(s) are separate from the production environment.'
  };

  // NIST PRAM Catalog of Problematic Data Actions
  var dataActions = {
    'Appropriation': 'Personal information is used in ways that exceed an individual\'s expectation or authorization.',
    'Distortion': 'Inaccurate or misleadingly incomplete personal information is used or disseminated.',
    'Induced Disclosure': 'People feel pressured to share more personal information than they are comfortable with.',
    'Insecurity': 'Lapses in data security.',
    'Re-identification': 'De-identified data, or data otherwise disassociated from people, becomes identifiable again.',
    'Stigmatization': 'Personal information is linked to an actual identity in a way that creates a stigma.',
    'Surveillance': 'Tracking or monitoring of people that is disproportionate to the purpose or outcome of the service.',
    'Unanticipated Revelation': 'Data is used out of context and reveals or exposes people, or facets of them, in unexpected ways.',
    'Unwarranted Restriction': 'People are blocked from accessing their information, or kept unaware that it exists or how it is used.'
  };

  // NIST PRAM Catalog of Problems for Individuals
  var problems = {
    dignity: { label: 'Dignity loss', desc: 'Embarrassment, emotional distress, or loss of reputation.' },
    discrimination: { label: 'Discrimination', desc: 'Unfair or unethical differential treatment of people or groups.' },
    economic: { label: 'Economic loss', desc: 'Direct or indirect financial loss, such as fraud, lost opportunities, or higher prices.' },
    autonomy: { label: 'Loss of autonomy', desc: 'Needless changes in behavior, or loss of control over decisions about oneself.' },
    exclusion: { label: 'Exclusion', desc: 'Being denied knowledge of, or a say in, how one\'s information is used, or denied a service or benefit.' },
    liberty: { label: 'Loss of liberty', desc: 'Improper exposure to arrest or detention, or chilling of free expression and association.' },
    physical: { label: 'Physical harm', desc: 'Actual physical harm to a person, such as stalking or violence.' },
    trust: { label: 'Loss of trust', desc: 'Breach of implicit or explicit expectations about how data is handled, damaging the relationship.' }
  };

  function functionOf(subId) {
    var pre = subId.slice(0, 2);
    return { ID: 'ID-P', GV: 'GV-P', CT: 'CT-P', CM: 'CM-P', PR: 'PR-P' }[pre];
  }
  function categoryOf(subId) {
    return subId.replace(/\d+$/, '');
  }

  PIA.nist = {
    version: 'NIST Privacy Framework v1.0 (January 2020); NIST PRAM catalogs',
    functions: functions,
    categories: categories,
    subcategories: subcategories,
    dataActions: dataActions,
    problems: problems,
    functionOf: functionOf,
    categoryOf: categoryOf
  };
})(typeof window !== 'undefined' ? window : globalThis);
