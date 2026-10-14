/*
 * Plain-language glossary. Question text references terms as [[shown text|key]] or [[key]].
 */
(function (root) {
  'use strict';
  var PIA = (root.PIA = root.PIA || {});

  PIA.glossary = {
    'personal data': {
      term: 'Personal data',
      def: 'Any information about a person who can be identified, directly (a name, an email) or indirectly (a device ID, a customer number, a photo, or a mix of details like job title + office + age). Also called "personal information" or "PII".'
    },
    'sensitive data': {
      term: 'Sensitive data',
      def: 'Information that could seriously hurt someone if misused: health, genetics, biometrics (fingerprints, face scans), race or ethnicity, religion, politics, union membership, sex life or sexual orientation, and criminal records. Many US laws also treat Social Security numbers, financial account numbers and precise location as sensitive.'
    },
    'special category': {
      term: 'Special category data',
      def: 'The EU/UK GDPR term for the most sensitive information: health, genetic, biometric (used to identify someone), racial or ethnic origin, political opinions, religious or philosophical beliefs, trade union membership, and sex life or sexual orientation. It needs an extra legal justification (GDPR Article 9).'
    },
    'processing': {
      term: 'Processing',
      def: 'Anything you do with personal data: collecting, storing, viewing, using, sharing, analyzing, or deleting it.'
    },
    'controller': {
      term: 'Controller',
      def: 'The organization that decides why and how personal data is used. It carries the main legal responsibility.'
    },
    'processor': {
      term: 'Processor',
      def: 'An organization that handles personal data on behalf of a controller and only follows its instructions, for example a cloud host or payroll provider.'
    },
    'joint controller': {
      term: 'Joint controllers',
      def: 'Two or more organizations that decide together why and how personal data is used. They need an arrangement setting out who does what.'
    },
    'data subject': {
      term: 'Data subject',
      def: 'The person the information is about: a customer, employee, patient, website visitor, and so on.'
    },
    'consent': {
      term: 'Consent',
      def: 'A clear, freely given "yes" from a person, such as ticking an empty box. It must be as easy to withdraw as to give, and pre-ticked boxes or silence do not count.'
    },
    'legitimate interests': {
      term: 'Legitimate interests',
      def: 'A legal basis for using data when you have a genuine business reason, the use is necessary, and it does not override people\'s rights or expectations. It requires a documented balancing test.'
    },
    'lawful basis': {
      term: 'Lawful basis',
      def: 'The legal reason that allows you to use personal data. Under GDPR there are six: consent, contract, legal obligation, vital interests, public task, and legitimate interests.'
    },
    'profiling': {
      term: 'Profiling',
      def: 'Using a computer to evaluate people, such as predicting their interests, reliability, health, performance, location or behavior, or putting them into segments or scores.'
    },
    'automated decision': {
      term: 'Automated decision',
      def: 'A decision made by a system with no meaningful human involvement. When it has a legal or similarly serious effect (hiring, credit, insurance, access to services), people get extra rights.'
    },
    'pseudonymisation': {
      term: 'Pseudonymisation',
      def: 'Replacing names and direct identifiers with a code, keeping the key separate. It lowers risk, but the data still counts as personal data.'
    },
    'anonymisation': {
      term: 'Anonymisation',
      def: 'Changing data so nobody can be identified by any reasonable means, ever. Truly anonymous data is no longer personal data, but this is harder to achieve than most people expect.'
    },
    'retention': {
      term: 'Retention period',
      def: 'How long you keep information before deleting or anonymising it.'
    },
    'dpa': {
      term: 'Data Processing Agreement (DPA)',
      def: 'A contract with a vendor that handles personal data for you. It sets out what they may do with it, how they protect it, and what happens at the end. GDPR Article 28 requires one.'
    },
    'international transfer': {
      term: 'International transfer',
      def: 'When personal data is sent to, stored in, or accessed from another country. Moving EU/UK data to many countries (including the US) needs a legal safeguard.'
    },
    'sccs': {
      term: 'Standard Contractual Clauses (SCCs)',
      def: 'Pre-approved contract terms that allow personal data to be transferred out of the EU/UK to countries without an "adequacy" decision.'
    },
    'adequacy': {
      term: 'Adequacy decision',
      def: 'A finding by the EU or UK that another country (or a certified US company under the Data Privacy Framework) protects data well enough that transfers can happen without extra contracts.'
    },
    'tia': {
      term: 'Transfer Impact Assessment (TIA)',
      def: 'A check of whether the laws in the destination country (for example, government access to data) undermine the protections in your transfer contract.'
    },
    'pia': {
      term: 'Privacy Impact Assessment (PIA)',
      def: 'A structured review of how a project uses personal data, what could go wrong for people, and what will be done about it.'
    },
    'dpia': {
      term: 'Data Protection Impact Assessment (DPIA)',
      def: 'The GDPR version of a PIA. It is legally required (Article 35) when processing is likely to result in high risk to people.'
    },
    'ropa': {
      term: 'Record of Processing Activities (RoPA)',
      def: 'The official register of how an organization uses personal data: what, why, whose, who it is shared with, where it goes, how long it is kept, and how it is protected. Required by GDPR Article 30 and used by legal for regulatory reporting.'
    },
    'encryption': {
      term: 'Encryption',
      def: 'Scrambling data so only people with the key can read it. "At rest" means stored data; "in transit" means data moving across networks (for example HTTPS).'
    },
    'mfa': {
      term: 'Multi-factor authentication (MFA)',
      def: 'Logging in with something extra beyond a password, like a code from your phone.'
    },
    'least privilege': {
      term: 'Least privilege',
      def: 'People and systems get access only to the data they truly need for their job, and nothing more.'
    },
    'minimisation': {
      term: 'Data minimisation',
      def: 'Only collecting and keeping the information you actually need for the purpose. Less data means less risk.'
    },
    'privacy notice': {
      term: 'Privacy notice',
      def: 'The explanation you give people about what you do with their data, such as a privacy policy, a sign, or a short message on a form.'
    },
    'data broker': {
      term: 'Data broker',
      def: 'A company that collects and sells information about people it has no direct relationship with.'
    },
    'biometric': {
      term: 'Biometric data',
      def: 'Measurements of someone\'s body or behavior used to identify them: fingerprints, face geometry, voiceprints, iris scans, gait.'
    },
    'monitoring': {
      term: 'Systematic monitoring',
      def: 'Regularly or continuously watching, tracking or recording people\'s behavior, location or activity: CCTV, tracking website behavior, employee monitoring, location tracking.'
    },
    'sale': {
      term: 'Selling or sharing (US)',
      def: 'Under California and other US state laws, "selling" includes giving personal data to another company for money or any other benefit, and "sharing" includes giving it for cross-context targeted advertising. People have a right to opt out.'
    },
    'nist pf': {
      term: 'NIST Privacy Framework',
      def: 'A voluntary US framework from the National Institute of Standards and Technology for managing privacy risk. It has five functions: Identify-P, Govern-P, Control-P, Communicate-P and Protect-P.'
    },
    'problematic data action': {
      term: 'Problematic data action',
      def: 'From the NIST Privacy Risk Assessment Methodology: an action a system takes with data that could cause a problem for people, such as surveillance, re-identification or unexpected disclosure.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
