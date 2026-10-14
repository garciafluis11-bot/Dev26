/*
 * Question bank. Every question is written for people with no privacy background.
 *
 * Section fields:
 *   id, title, intro, tiers (which assessment tiers see it), mode ('stepper' = one question at a time),
 *   showIf(answers, ctx) optional.
 * Question fields:
 *   id, type (text | email | date | textarea | single | multi | yesno | list), label, help, example, why,
 *   options [{value, label, hint, group, exclusive}], required, optional, tiers, showIf(answers, ctx),
 *   prefill(answers, ctx), columns (for list).
 * Text may reference glossary terms as [[shown text|glossary key]] or [[glossary key]].
 */
(function (root) {
  'use strict';
  var PIA = (root.PIA = root.PIA || {});

  var ALL = ['none', 'low', 'medium', 'high'];
  var PD = ['low', 'medium', 'high'];
  var DEEP = ['medium', 'high'];

  function has(arr, v) { return Array.isArray(arr) && arr.indexOf(v) !== -1; }
  function hasAny(arr, vals) { return Array.isArray(arr) && vals.some(function (v) { return arr.indexOf(v) !== -1; }); }

  var SENSITIVE_OPTIONS = [
    { value: 'health', label: 'Health or medical information', hint: 'Conditions, medications, disability, mental health, pregnancy, sick leave', group: 'Most sensitive' },
    { value: 'genetic', label: 'Genetic information', hint: 'DNA test results, family medical history', group: 'Most sensitive' },
    { value: 'biometric', label: 'Biometrics', hint: 'Fingerprints, face scans, voiceprints used to recognize someone', group: 'Most sensitive' },
    { value: 'racial', label: 'Race or ethnic origin', group: 'Most sensitive' },
    { value: 'religion', label: 'Religious or philosophical beliefs', group: 'Most sensitive' },
    { value: 'political', label: 'Political opinions', group: 'Most sensitive' },
    { value: 'union', label: 'Trade union membership', group: 'Most sensitive' },
    { value: 'sexual', label: 'Sex life or sexual orientation', group: 'Most sensitive' },
    { value: 'criminal', label: 'Criminal records or alleged offences', hint: 'Background checks, arrests, convictions', group: 'Most sensitive' },
    { value: 'govid', label: 'Government ID numbers', hint: 'Social Security, passport, driver\'s license, national ID', group: 'Also sensitive' },
    { value: 'financial', label: 'Financial account details', hint: 'Bank account, card numbers, credit history', group: 'Also sensitive' },
    { value: 'precise_location', label: 'Precise location', hint: 'GPS or anything accurate to a street or building', group: 'Also sensitive' }
  ];

  var sections = [
    {
      id: 'about',
      title: 'About your project',
      short: 'Project',
      intro: 'Let\'s start with the basics. Describe your project the way you\'d explain it to a colleague. No technical or legal language needed.',
      tiers: ALL,
      questions: [
        { id: 'project_name', type: 'text', label: 'What is your project called?', example: 'Customer loyalty app, New HR onboarding tool, Website chatbot', required: true },
        { id: 'project_description', type: 'textarea', label: 'In two or three sentences, what are you doing and why?', help: 'Explain it like you would to a friend: what is changing, who it is for, and what problem it solves.', example: 'We are launching a mobile app where customers collect points on purchases and get personalized offers.', required: true },
        { id: 'project_owner', type: 'text', label: 'Who is the main person responsible for this project?', help: 'This is usually the business owner, the person who can answer questions and make decisions about it.', required: true },
        { id: 'owner_email', type: 'email', label: 'Their email address', optional: true },
        { id: 'department', type: 'text', label: 'Which team or department is running it?', example: 'Marketing, HR, Customer Success', optional: true },
        {
          id: 'project_stage', type: 'single', label: 'Where is the project right now?',
          options: [
            { value: 'idea', label: 'Just an idea or early planning' },
            { value: 'building', label: 'Being designed or built' },
            { value: 'live', label: 'Already up and running' },
            { value: 'change', label: 'A change to something that already exists' }
          ],
          why: 'Privacy is cheapest to get right early. If the project is already live, any gaps we find need fixing quickly.'
        },
        { id: 'go_live', type: 'date', label: 'When will it start (or when did it start)?', optional: true }
      ]
    },

    {
      id: 'screening',
      title: 'Quick privacy check',
      short: 'Quick check',
      intro: 'These questions decide how much of an assessment you need. Most take a second to answer. If you\'re not sure, say so: we\'ll assume the cautious answer and flag it for someone to confirm.',
      tiers: ALL,
      mode: 'stepper',
      questions: [
        {
          id: 'sc_personal_data', type: 'yesno',
          label: 'Will this project use any information about people?',
          help: 'This means anyone: customers, employees, patients, students, website visitors, job applicants, suppliers\' staff. It counts even if you never see their name. Email addresses, IP addresses, device IDs, customer numbers, photos and voice recordings are all [[personal data]].',
          example: 'A sign-up form, a staff rota, website analytics, a customer survey, CCTV.',
          why: 'Privacy laws only apply when information can be linked to a person. If none is involved, you don\'t need an assessment.'
        },
        {
          id: 'sc_no_pd_check', type: 'multi',
          label: 'Just to double-check: will any of these be involved?',
          help: 'These are easy to miss, but each one counts as personal data.',
          showIf: function (a) { return a.sc_personal_data === 'no'; },
          options: [
            { value: 'online_ids', label: 'Cookies, IP addresses, device or advertising IDs' },
            { value: 'media', label: 'Photos, video, or voice recordings of people' },
            { value: 'free_text', label: 'Free-text boxes where people could type anything' },
            { value: 'location', label: 'Location data from phones, vehicles or devices' },
            { value: 'logs', label: 'User accounts, login records or activity logs' },
            { value: 'stats', label: 'Statistics about small groups (where someone could be singled out)' },
            { value: 'none', label: 'None of these', exclusive: true }
          ]
        },
        {
          id: 'sc_sensitive_types', type: 'multi',
          label: 'Will you use any especially [[sensitive information|sensitive data]]?',
          help: 'Tick everything that applies, even if it is only collected occasionally or typed into a notes field.',
          why: 'Misuse of sensitive information can lead to discrimination, embarrassment, or financial harm, so the law sets a higher bar for it.',
          showIf: function (a, f) { return f.personal; },
          options: SENSITIVE_OPTIONS.concat([
            { value: 'none', label: 'None of these', exclusive: true },
            { value: 'unsure', label: 'Not sure', exclusive: true }
          ])
        },
        {
          id: 'sc_children', type: 'yesno',
          label: 'Could any of the people be under 18?',
          help: 'Include children who might use the service even if it isn\'t meant for them, such as a public website or game.',
          why: 'Children get extra protection in law, and some rules need parental permission.',
          showIf: function (a, f) { return f.personal; }
        },
        {
          id: 'sc_vulnerable', type: 'yesno',
          label: 'Are any of the people in a vulnerable position or unable to easily say no?',
          help: 'For example: patients, elderly people, people with disabilities, people in financial difficulty, asylum seekers, or employees (who may feel unable to refuse their employer).',
          why: 'When people can\'t easily refuse or understand what\'s happening, the risk of harm is higher.',
          showIf: function (a, f) { return f.personal; }
        },
        {
          id: 'sc_scale', type: 'single',
          label: 'Roughly how many people\'s information is involved?',
          help: 'A best guess is fine. Count everyone over the life of the project, not just at launch.',
          showIf: function (a, f) { return f.personal; },
          options: [
            { value: 'lt100', label: 'Fewer than 100' },
            { value: '100-1k', label: '100 to 1,000' },
            { value: '1k-10k', label: '1,000 to 10,000' },
            { value: '10k-100k', label: '10,000 to 100,000' },
            { value: 'gt100k', label: 'More than 100,000' },
            { value: 'unsure', label: 'Not sure' }
          ]
        },
        {
          id: 'sc_monitoring', type: 'yesno',
          label: 'Will you watch, track, or record what people do, where they go, or how they behave?',
          help: 'Online or offline. For example: CCTV, tracking website or app behavior, monitoring employees\' emails or computers, location tracking, call recording, wearables.',
          showIf: function (a, f) { return f.personal; }
        },
        {
          id: 'sc_public_monitoring', type: 'yesno',
          label: 'Does any of that tracking happen in public or shared spaces, or on a large scale?',
          help: 'Streets, shops, campuses, offices, public Wi-Fi, or tracking large numbers of people online.',
          showIf: function (a, f) { return f.personal && (a.sc_monitoring === 'yes' || a.sc_monitoring === 'unsure'); }
        },
        {
          id: 'sc_profiling', type: 'yesno',
          label: 'Will a computer score, rank, rate, or make predictions about people?',
          help: 'For example: credit scores, fraud scores, recommending products based on behavior, predicting who will leave, rating job candidates, sorting customers into segments. This is called [[profiling]].',
          showIf: function (a, f) { return f.personal; }
        },
        {
          id: 'sc_auto_decision', type: 'yesno',
          label: 'Will the system make important decisions about people without a person checking them?',
          help: '"Important" means things that really affect someone: getting a job, a loan, insurance, a price, access to a service or benefit, or being flagged for investigation.',
          why: 'People have a legal right not to be subject to purely [[automated decisions|automated decision]] with serious effects, in many places.',
          showIf: function (a, f) { return f.personal; }
        },
        {
          id: 'sc_new_tech', type: 'yesno',
          label: 'Are you using new or unusual technology?',
          help: 'For example: AI or machine learning, generative AI, facial recognition, biometrics, smart devices, wearables, or connected vehicles.',
          showIf: function (a, f) { return f.personal; }
        },
        {
          id: 'sc_combine', type: 'yesno',
          label: 'Will you combine or match information from different places?',
          help: 'For example: joining your customer list with data bought from another company, linking website behavior to customer accounts, or merging two internal databases.',
          showIf: function (a, f) { return f.personal; }
        },
        {
          id: 'sc_new_use', type: 'yesno',
          label: 'Will you use information for a different reason than it was originally collected for?',
          help: 'For example: using support chat transcripts to train an AI, or using delivery addresses for marketing.',
          showIf: function (a, f) { return f.personal; }
        },
        {
          id: 'sc_prevent_rights', type: 'yesno',
          label: 'Could this stop someone from getting a service, a job, or a benefit, or from using a right?',
          showIf: function (a, f) { return f.personal; }
        },
        {
          id: 'sc_share_external', type: 'yesno',
          label: 'Will information go outside your organization?',
          help: 'Include vendors, cloud and software services, partners, agencies, and other companies in your group.',
          showIf: function (a, f) { return f.personal; }
        },
        {
          id: 'sc_international', type: 'yesno',
          label: 'Will information be stored in, or accessed from, another country?',
          help: 'Compared with where the people live. Many cloud services and support teams are based abroad. If you don\'t know where a vendor stores data, choose "Not sure".',
          showIf: function (a, f) { return f.personal; }
        }
      ]
    },

    {
      id: 'data',
      title: 'What information you\'ll use',
      short: 'Information',
      intro: 'Now let\'s be specific about the information. We\'ve pre-selected anything you told us in the quick check.',
      tiers: PD,
      questions: [
        {
          id: 'data_categories', type: 'multi',
          label: 'Which types of information will be used?',
          help: 'Tick everything, including information collected automatically by systems.',
          prefill: function (a) {
            var s = (a.sc_sensitive_types || []).filter(function (v) { return v !== 'none' && v !== 'unsure'; });
            var extra = [];
            if (has(a.sc_no_pd_check, 'online_ids')) extra.push('online_ids');
            if (has(a.sc_no_pd_check, 'media')) extra.push('media');
            if (has(a.sc_no_pd_check, 'location')) extra.push('location_approx');
            return s.concat(extra);
          },
          options: [
            { value: 'contact', label: 'Contact details', hint: 'Name, email, phone, postal address', group: 'Everyday information' },
            { value: 'identity', label: 'Identity details', hint: 'Date of birth, age, gender, signature', group: 'Everyday information' },
            { value: 'credentials', label: 'Account logins', hint: 'Usernames, passwords, security questions', group: 'Everyday information' },
            { value: 'online_ids', label: 'Online identifiers', hint: 'IP address, cookies, device or advertising IDs', group: 'Everyday information' },
            { value: 'location_approx', label: 'Approximate location', hint: 'City, region, country', group: 'Everyday information' },
            { value: 'behaviour', label: 'Behavior and preferences', hint: 'Purchases, clicks, usage, interests', group: 'Everyday information' },
            { value: 'communications', label: 'Content of messages', hint: 'Emails, chats, call recordings, survey comments', group: 'Everyday information' },
            { value: 'media', label: 'Photos, video, or voice', group: 'Everyday information' },
            { value: 'employment', label: 'Work information', hint: 'Job title, salary, performance, absence', group: 'Everyday information' },
            { value: 'education', label: 'Education information', hint: 'Grades, qualifications, student records', group: 'Everyday information' }
          ].concat(SENSITIVE_OPTIONS)
        },
        {
          id: 'data_elements', type: 'textarea', optional: true,
          label: 'If you know them, list the specific fields or data points.',
          example: 'First name, last name, email, loyalty number, purchase history, birthday month',
          why: 'Legal needs this level of detail for the official record. A rough list is fine.'
        },
        {
          id: 'systems', type: 'textarea', optional: true,
          label: 'Which systems, apps, or tools will store or use the information?',
          example: 'Salesforce, a new mobile app, Google Sheets, our data warehouse'
        },
        {
          id: 'data_minimization', type: 'single', tiers: DEEP,
          label: 'Could you still achieve your goal with less information?',
          help: 'Think about each item: would the project break without it? Could you use a less detailed version, like age range instead of birth date? This is [[data minimisation|minimisation]].',
          options: [
            { value: 'no', label: 'No, we need everything listed' },
            { value: 'possibly', label: 'Possibly, some of it is "nice to have"' },
            { value: 'unsure', label: 'Not sure' }
          ]
        },
        {
          id: 'data_accuracy', type: 'yesno', tiers: DEEP,
          label: 'If information is wrong or out of date, can it be easily corrected?'
        }
      ]
    },

    {
      id: 'people',
      title: 'Whose information',
      short: 'People',
      intro: 'Tell us about the people the information is about. The law calls them [[data subjects|data subject]].',
      tiers: PD,
      questions: [
        {
          id: 'subject_categories', type: 'multi',
          label: 'Whose information is it?',
          options: [
            { value: 'customers', label: 'Customers or clients' },
            { value: 'prospects', label: 'Potential customers or leads' },
            { value: 'users', label: 'Website or app users' },
            { value: 'employees', label: 'Employees' },
            { value: 'applicants', label: 'Job applicants' },
            { value: 'contractors', label: 'Contractors, temps, or volunteers' },
            { value: 'patients', label: 'Patients' },
            { value: 'students', label: 'Students' },
            { value: 'children_u13', label: 'Children under 13' },
            { value: 'children_13_17', label: 'Teenagers (13 to 17)' },
            { value: 'vulnerable_adults', label: 'Vulnerable adults' },
            { value: 'public', label: 'Members of the public' },
            { value: 'business_contacts', label: 'Contacts at suppliers or partners' },
            { value: 'other', label: 'Someone else' }
          ]
        },
        { id: 'subject_other', type: 'text', label: 'Who else?', showIf: function (a) { return has(a.subject_categories, 'other'); } },
        {
          id: 'subject_regions', type: 'multi',
          label: 'Where do these people live?',
          why: 'Different countries and states have different privacy laws. This tells legal which rules apply.',
          options: [
            { value: 'us', label: 'United States' },
            { value: 'eu', label: 'European Union / EEA' },
            { value: 'uk', label: 'United Kingdom' },
            { value: 'canada', label: 'Canada' },
            { value: 'latam', label: 'Latin America' },
            { value: 'apac', label: 'Asia-Pacific' },
            { value: 'other', label: 'Elsewhere' },
            { value: 'unsure', label: 'Not sure', exclusive: true }
          ]
        }
      ]
    },

    {
      id: 'purpose',
      title: 'Why you need it',
      short: 'Purpose',
      intro: 'Every use of personal data needs a clear reason and a legal basis. Don\'t worry, we\'ll translate.',
      tiers: PD,
      questions: [
        {
          id: 'purpose_categories', type: 'multi',
          label: 'What will the information be used for?',
          options: [
            { value: 'service', label: 'Providing a product or service people signed up for' },
            { value: 'support', label: 'Customer support' },
            { value: 'billing', label: 'Payments and billing' },
            { value: 'marketing', label: 'Marketing or advertising' },
            { value: 'analytics', label: 'Analytics or improving products' },
            { value: 'personalization', label: 'Personalizing content or offers' },
            { value: 'hr', label: 'Managing staff (HR, payroll, recruitment)' },
            { value: 'security', label: 'Security or fraud prevention' },
            { value: 'legal', label: 'Meeting legal or regulatory requirements' },
            { value: 'research', label: 'Research' },
            { value: 'ai_training', label: 'Training or improving AI models' },
            { value: 'other', label: 'Something else' }
          ]
        },
        { id: 'purpose_detail', type: 'textarea', label: 'Describe the purpose in your own words.', example: 'To award loyalty points on each purchase and send members offers based on what they buy.', optional: true },
        {
          id: 'purpose_expected', type: 'yesno',
          label: 'Would the people involved expect you to use their information this way?',
          help: 'Imagine explaining it to them. Would they nod, or be surprised or uncomfortable?',
          why: 'Using data in ways people don\'t expect is one of the most common causes of complaints and loss of trust.'
        },
        {
          id: 'legal_basis', type: 'single',
          label: 'Which of these best describes why you\'re allowed to use the information?',
          help: 'This is your [[lawful basis]]. Pick the closest fit, or choose "Not sure" and legal will decide.',
          options: [
            { value: 'contract', label: 'We need it to give people something they asked for', hint: 'Delivering an order, running their account, paying an employee' },
            { value: 'legal_obligation', label: 'A law or regulation requires us to', hint: 'Tax records, safety reporting, right-to-work checks' },
            { value: 'consent', label: 'People actively say yes (opt in) and can change their mind', hint: 'An unticked box they choose to tick' },
            { value: 'legitimate_interests', label: 'A reasonable business need that people would expect and that doesn\'t harm them', hint: 'Fraud prevention, network security, basic analytics' },
            { value: 'vital_interests', label: 'To protect someone\'s life or physical safety' },
            { value: 'public_task', label: 'We\'re a public body carrying out an official function' },
            { value: 'unsure', label: 'Not sure, legal should decide' }
          ]
        },
        {
          id: 'consent_mechanism', type: 'single',
          label: 'How will people give their permission?',
          showIf: function (a) { return a.legal_basis === 'consent'; },
          options: [
            { value: 'optin', label: 'They tick an empty box or click a clear "I agree" button' },
            { value: 'prechecked', label: 'A box is already ticked for them' },
            { value: 'implied', label: 'By using the service or continuing to browse' },
            { value: 'undecided', label: 'Not decided yet' }
          ]
        },
        {
          id: 'consent_withdraw', type: 'yesno',
          label: 'Can people easily change their mind later?',
          help: 'Withdrawing permission should be as easy as giving it, for example an unsubscribe link or a settings toggle.',
          showIf: function (a) { return a.legal_basis === 'consent'; }
        },
        {
          id: 'li_balancing', type: 'yesno',
          label: 'Has anyone written down why the business need outweighs any impact on people?',
          help: 'This is called a legitimate interests assessment. If not, the privacy team can help.',
          showIf: function (a) { return a.legal_basis === 'legitimate_interests'; }
        },
        {
          id: 'special_condition', type: 'single',
          label: 'Because you\'re using sensitive information, which of these also applies?',
          help: '[[Special category data|special category]] needs a second, specific justification on top of the lawful basis.',
          showIf: function (a, f) { return f.special; },
          options: [
            { value: 'explicit_consent', label: 'People explicitly agree to this specific use' },
            { value: 'employment', label: 'Employment or social security law requires it' },
            { value: 'health_care', label: 'Providing health or social care' },
            { value: 'public_interest', label: 'A substantial public interest set out in law', hint: 'Equal opportunities monitoring, fraud prevention, safeguarding' },
            { value: 'legal_claims', label: 'Establishing or defending legal claims' },
            { value: 'made_public', label: 'The person clearly made it public themselves' },
            { value: 'research', label: 'Research or statistics with safeguards' },
            { value: 'unsure', label: 'Not sure' }
          ]
        }
      ]
    },

    {
      id: 'collection',
      title: 'How you collect it & what people are told',
      short: 'Collection',
      intro: 'People have a right to know what happens to their information.',
      tiers: PD,
      questions: [
        {
          id: 'sources', type: 'multi',
          label: 'Where will the information come from?',
          options: [
            { value: 'direct', label: 'Directly from the person', hint: 'Forms, sign-ups, conversations' },
            { value: 'automatic', label: 'Collected automatically', hint: 'Cookies, app tracking, sensors, system logs' },
            { value: 'internal', label: 'Another team or system in our organization' },
            { value: 'third_party', label: 'Another company', hint: 'Partners, data providers, [[data brokers|data broker]], employers' },
            { value: 'public', label: 'Public sources', hint: 'Websites, social media, public registers' }
          ]
        },
        {
          id: 'notice', type: 'single',
          label: 'Will people be told about this use of their information when it\'s collected?',
          help: 'Usually through a [[privacy notice]], a message on a form, or a sign.',
          options: [
            { value: 'updated', label: 'Yes, we\'re writing or updating a privacy notice' },
            { value: 'existing', label: 'Yes, our existing privacy notice already covers it' },
            { value: 'not_yet', label: 'Not yet, but we can' },
            { value: 'no', label: 'No, or it isn\'t possible' },
            { value: 'unsure', label: 'Not sure' }
          ]
        },
        {
          id: 'notice_plain', type: 'yesno', tiers: DEEP,
          label: 'Is that explanation short, clear, and easy to find?',
          showIf: function (a) { return a.notice === 'updated' || a.notice === 'existing'; }
        },
        {
          id: 'cookies_consent', type: 'yesno',
          label: 'Do visitors get a choice before non-essential cookies or trackers are used?',
          help: 'For example a cookie banner with a real "reject" option.',
          showIf: function (a) { return has(a.data_categories, 'online_ids'); }
        }
      ]
    },

    {
      id: 'sharing',
      title: 'Who can see it',
      short: 'Sharing',
      intro: 'Information that travels further is harder to control. Tell us who will have access.',
      tiers: PD,
      questions: [
        {
          id: 'internal_access', type: 'single',
          label: 'Inside your organization, who will be able to see the information?',
          help: 'The principle of [[least privilege]] says only people who need it for their job should see it.',
          options: [
            { value: 'need', label: 'Only the people who need it for their job' },
            { value: 'team', label: 'Our whole team or department' },
            { value: 'broad', label: 'Many teams across the organization' },
            { value: 'undecided', label: 'Not decided yet' }
          ]
        },
        {
          id: 'recipients', type: 'multi',
          label: 'Which outside organizations will receive or be able to access it?',
          prefill: function (a) { return a.sc_share_external === 'no' ? ['none'] : undefined; },
          options: [
            { value: 'cloud', label: 'Cloud hosting or IT providers' },
            { value: 'saas', label: 'Software tools (SaaS)', hint: 'CRM, email, HR, survey tools' },
            { value: 'payments', label: 'Payment processors' },
            { value: 'analytics', label: 'Analytics providers' },
            { value: 'ad_partners', label: 'Advertising or marketing partners' },
            { value: 'data_brokers', label: 'Data brokers or list providers' },
            { value: 'advisers', label: 'Professional advisers', hint: 'Lawyers, auditors, consultants' },
            { value: 'affiliates', label: 'Other companies in our group' },
            { value: 'partners', label: 'Business partners who use it for their own purposes' },
            { value: 'government', label: 'Government, regulators, or law enforcement' },
            { value: 'public', label: 'Published or made public' },
            { value: 'none', label: 'Nobody outside our organization', exclusive: true }
          ]
        },
        {
          id: 'vendors', type: 'list',
          label: 'List the companies that will handle the information.',
          help: 'Add each vendor, partner, or service. A [[Data Processing Agreement|dpa]] is the contract that controls what a vendor can do with your data.',
          showIf: function (a) { return Array.isArray(a.recipients) && a.recipients.length > 0 && !has(a.recipients, 'none'); },
          columns: [
            { key: 'name', label: 'Company', type: 'text', placeholder: 'e.g. Salesforce' },
            { key: 'service', label: 'What they do', type: 'text', placeholder: 'e.g. CRM hosting' },
            { key: 'location', label: 'Country', type: 'text', placeholder: 'e.g. USA' },
            { key: 'dpa', label: 'Contract (DPA) in place?', type: 'select', options: [{ value: '', label: 'Choose' }, { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unsure', label: 'Not sure' }] }
          ]
        },
        {
          id: 'sell_share', type: 'yesno',
          label: 'Will you give information to others in exchange for money or any other benefit, or for targeted advertising?',
          help: 'US state laws call this [[selling or sharing|sale]], even if no money changes hands. Sending customer lists to ad platforms for targeting usually counts.',
          showIf: function (a) { return !has(a.recipients, 'none'); }
        },
        {
          id: 'vendor_ai_training', type: 'yesno', tiers: DEEP,
          label: 'Could any company you share with use the information for its own purposes, such as training its AI?',
          help: 'Check vendor terms. Many AI and software tools reserve this right unless you opt out.',
          showIf: function (a) { return Array.isArray(a.recipients) && a.recipients.length > 0 && !has(a.recipients, 'none'); }
        }
      ]
    },

    {
      id: 'transfers',
      title: 'Where it\'s stored',
      short: 'Location',
      intro: 'Where information is kept affects which laws apply and how it must be protected.',
      tiers: PD,
      questions: [
        {
          id: 'storage_locations', type: 'multi',
          label: 'In which countries will the information be stored or accessed?',
          help: 'Include where your vendors store data and where any support teams are based.',
          options: [
            { value: 'us', label: 'United States' },
            { value: 'eu', label: 'European Union / EEA' },
            { value: 'uk', label: 'United Kingdom' },
            { value: 'canada', label: 'Canada' },
            { value: 'india', label: 'India' },
            { value: 'apac', label: 'Elsewhere in Asia-Pacific' },
            { value: 'other', label: 'Other' },
            { value: 'unsure', label: 'Not sure', exclusive: true }
          ]
        },
        { id: 'storage_other', type: 'text', label: 'Which other countries?', showIf: function (a) { return has(a.storage_locations, 'other'); } },
        {
          id: 'transfer_mechanism', type: 'single',
          label: 'What protects the information when it moves between countries?',
          help: 'This is about [[international transfers|international transfer]]. Legal or procurement usually knows the answer. It\'s often in the vendor contract.',
          showIf: function (a, f) { return f.crossBorder; },
          options: [
            { value: 'adequacy', label: 'The destination is approved as "adequate" (incl. EU-US Data Privacy Framework)', hint: 'See [[adequacy]]' },
            { value: 'sccs', label: 'Standard Contractual Clauses in the contract', hint: 'See [[SCCs|sccs]]' },
            { value: 'bcrs', label: 'Binding Corporate Rules (within our group)' },
            { value: 'derogation', label: 'A one-off exception (e.g. explicit consent)' },
            { value: 'none', label: 'Nothing that I know of' },
            { value: 'unsure', label: 'Not sure' }
          ]
        },
        {
          id: 'transfer_tia', type: 'yesno', tiers: DEEP,
          label: 'Has a transfer risk check been done for countries outside the EU/UK?',
          help: 'A [[Transfer Impact Assessment|tia]] looks at things like foreign government access to data.',
          showIf: function (a, f) { return f.crossBorder && (a.transfer_mechanism === 'sccs' || a.transfer_mechanism === 'bcrs'); }
        }
      ]
    },

    {
      id: 'retention',
      title: 'How long you keep it',
      short: 'Retention',
      intro: 'Information shouldn\'t be kept forever "just in case". The longer you keep it, the bigger the risk.',
      tiers: PD,
      questions: [
        {
          id: 'retention_period', type: 'single',
          label: 'How long will you keep the information?',
          help: 'This is the [[retention period|retention]]. If different pieces are kept for different times, choose the longest and explain below.',
          options: [
            { value: 'lt30d', label: 'Less than a month' },
            { value: 'lt1y', label: 'Up to a year' },
            { value: '1-3y', label: '1 to 3 years' },
            { value: '3-7y', label: '3 to 7 years' },
            { value: 'gt7y', label: 'More than 7 years' },
            { value: 'indefinite', label: 'Forever, or no plan yet' },
            { value: 'unsure', label: 'Not sure' }
          ]
        },
        {
          id: 'retention_reason', type: 'text', label: 'Why that long?',
          example: 'Tax law requires 7 years; account data deleted 12 months after account closure',
          optional: true
        },
        {
          id: 'deletion_method', type: 'single',
          label: 'What happens when the time is up?',
          options: [
            { value: 'auto', label: 'Deleted automatically by the system' },
            { value: 'manual', label: 'Someone deletes it on a regular schedule' },
            { value: 'anonymised', label: 'It\'s [[anonymised|anonymisation]] so nobody can be identified' },
            { value: 'undecided', label: 'Not decided yet' }
          ]
        }
      ]
    },

    {
      id: 'security',
      title: 'Keeping it safe',
      short: 'Security',
      intro: 'You don\'t need to be a security expert. Tick what you know is in place, and leave the rest for your IT team to confirm.',
      tiers: PD,
      questions: [
        {
          id: 'security_controls', type: 'multi',
          label: 'Which of these protections will be in place?',
          options: [
            { value: 'encrypt_rest', label: 'Stored data is encrypted', hint: 'See [[encryption]]' },
            { value: 'encrypt_transit', label: 'Data is encrypted when sent (e.g. HTTPS)' },
            { value: 'mfa', label: 'Logins need more than a password', hint: '[[Multi-factor authentication|mfa]]' },
            { value: 'rbac', label: 'Access is limited by role' },
            { value: 'logging', label: 'Access is logged and monitored' },
            { value: 'access_review', label: 'Access is reviewed regularly' },
            { value: 'pseudonymisation', label: 'Names are replaced with codes where possible', hint: '[[Pseudonymisation|pseudonymisation]]' },
            { value: 'backups', label: 'Secure backups' },
            { value: 'testing', label: 'Security testing (scans, penetration tests)' },
            { value: 'training', label: 'Staff privacy and security training' },
            { value: 'dlp', label: 'Tools that stop data leaking (DLP)' }
          ]
        },
        {
          id: 'security_review', type: 'single',
          label: 'Has your IT or security team reviewed this project?',
          options: [
            { value: 'yes', label: 'Yes, it\'s been reviewed' },
            { value: 'scheduled', label: 'It\'s scheduled' },
            { value: 'no', label: 'No' },
            { value: 'unsure', label: 'Not sure' }
          ]
        },
        {
          id: 'test_with_real', type: 'yesno', tiers: DEEP,
          label: 'Will real people\'s information be used for testing or development?',
          help: 'Test environments are usually less protected. Fake or masked data is safer.'
        },
        {
          id: 'breach_plan', type: 'yesno',
          label: 'If information were lost, stolen, or sent to the wrong person, would your team know who to tell, straight away?',
          why: 'Some laws require regulators to be told within 72 hours, so the clock starts as soon as you find out.'
        }
      ]
    },

    {
      id: 'rights',
      title: 'People\'s choices and rights',
      short: 'Rights',
      intro: 'In many places people can ask to see, correct, or delete their information, or to opt out. Can your project support that?',
      tiers: DEEP,
      questions: [
        { id: 'rights_access', type: 'yesno', label: 'If someone asked for a copy of their information, could you find it all and send it within a month?' },
        { id: 'rights_correct', type: 'yesno', label: 'Could you correct someone\'s information if they told you it was wrong?' },
        { id: 'rights_delete', type: 'yesno', label: 'Could you delete someone\'s information if they asked, including from vendors\' systems?' },
        {
          id: 'rights_optout', type: 'yesno',
          label: 'Can people opt out of marketing, profiling, or selling and sharing of their data?',
          showIf: function (a, f) { return has(a.purpose_categories, 'marketing') || has(a.purpose_categories, 'personalization') || a.sell_share === 'yes' || f.profiling; }
        },
        { id: 'complaints', type: 'yesno', label: 'Is there a clear place people can go with questions or complaints about their information?' }
      ]
    },

    {
      id: 'automation',
      title: 'AI and automated decisions',
      short: 'AI & automation',
      intro: 'You told us the project involves scoring, automated decisions, or new technology. A few more questions about how it works.',
      tiers: DEEP,
      showIf: function (a, f) { return f.profiling || f.autoDecision || f.newTech || has(a.purpose_categories, 'ai_training'); },
      questions: [
        {
          id: 'ai_use', type: 'multi',
          label: 'Which of these describe the technology?',
          options: [
            { value: 'predictions', label: 'Makes predictions, scores, or recommendations about people' },
            { value: 'generative', label: 'Generative AI creating text, images, or summaries involving people' },
            { value: 'training', label: 'Personal data is used to train or fine-tune AI models' },
            { value: 'facial', label: 'Facial recognition or other biometric identification' },
            { value: 'emotion', label: 'Detects emotions, mood, or attention' },
            { value: 'chatbot', label: 'A chatbot or assistant talks with people' },
            { value: 'iot', label: 'Smart devices, sensors, or wearables' },
            { value: 'none', label: 'None of these', exclusive: true }
          ]
        },
        {
          id: 'human_review', type: 'single',
          label: 'Does a person review the system\'s results before they affect someone?',
          options: [
            { value: 'all', label: 'Yes, a person reviews every result and can overrule it' },
            { value: 'some', label: 'Only some results, or the review is a quick rubber stamp' },
            { value: 'none', label: 'No, results apply automatically' },
            { value: 'na', label: 'Not applicable, results don\'t affect individuals' }
          ]
        },
        {
          id: 'bias_testing', type: 'yesno',
          label: 'Has the system been tested to check it treats different groups of people fairly?',
          help: 'For example, checking whether results differ by age, gender, ethnicity, or disability.'
        },
        { id: 'explainability', type: 'yesno', label: 'Could you explain to a person, in plain words, why the system reached a result about them?' },
        { id: 'contest_decision', type: 'yesno', label: 'Can people challenge a result and have a person look at it again?' }
      ]
    },

    {
      id: 'monitoring',
      title: 'Monitoring details',
      short: 'Monitoring',
      intro: 'You told us the project involves watching or tracking people. Let\'s understand how.',
      tiers: DEEP,
      showIf: function (a, f) { return f.monitoring; },
      questions: [
        {
          id: 'monitoring_type', type: 'multi',
          label: 'What kind of monitoring?',
          options: [
            { value: 'cctv', label: 'CCTV or cameras' },
            { value: 'employee', label: 'Employee computer, email, or productivity monitoring' },
            { value: 'location', label: 'Location or vehicle tracking' },
            { value: 'online', label: 'Tracking behavior on websites or apps' },
            { value: 'calls', label: 'Call or meeting recording' },
            { value: 'keystroke', label: 'Keystroke logging or screen capture' },
            { value: 'wearables', label: 'Wearables or health tracking' }
          ]
        },
        { id: 'monitoring_aware', type: 'yesno', label: 'Will people clearly know they\'re being monitored?', help: 'Through signs, notices, policies, or on-screen messages.' },
        { id: 'monitoring_covert', type: 'yesno', label: 'Will any monitoring be done secretly?' },
        { id: 'monitoring_proportionate', type: 'textarea', optional: true, label: 'Why is monitoring needed, and why wouldn\'t something less intrusive work?' }
      ]
    },

    {
      id: 'record',
      title: 'Details for the record',
      short: 'Record',
      intro: 'Last step. A few details legal needs for the official [[Record of Processing Activities|ropa]].',
      tiers: PD,
      questions: [
        {
          id: 'org_name', type: 'text', label: 'What is your organization\'s legal name?',
          prefill: function () { return (PIA.config && PIA.config.organization.name) || undefined; }
        },
        {
          id: 'org_role', type: 'single',
          label: 'Which best describes your organization\'s role?',
          options: [
            { value: 'controller', label: 'We decide what information to collect and what to do with it', hint: 'You are the [[controller]]. This is the most common answer.' },
            { value: 'processor', label: 'We do this on behalf of another organization, following their instructions', hint: 'You are a [[processor]]' },
            { value: 'joint', label: 'We decide together with another organization', hint: '[[Joint controllers|joint controller]]' },
            { value: 'unsure', label: 'Not sure' }
          ]
        },
        {
          id: 'other_org', type: 'text', label: 'Which other organization?',
          showIf: function (a) { return a.org_role === 'processor' || a.org_role === 'joint'; }
        },
        {
          id: 'privacy_contact', type: 'text', label: 'Privacy team or Data Protection Officer contact', optional: true,
          prefill: function () { var o = PIA.config && PIA.config.organization; return (o && (o.dpoContact || o.privacyContact)) || undefined; }
        },
        { id: 'concerns', type: 'textarea', optional: true, label: 'Is there anything else that worries you, or that legal should know?' }
      ]
    }
  ];

  // Index questions by id for quick lookup.
  var byId = {};
  sections.forEach(function (s) {
    s.questions.forEach(function (q) { q.section = s.id; byId[q.id] = q; });
  });

  function optionLabel(qid, value) {
    var q = byId[qid];
    if (!q) return String(value);
    if (q.type === 'yesno') return { yes: 'Yes', no: 'No', unsure: 'Not sure' }[value] || String(value);
    var opt = (q.options || []).filter(function (o) { return o.value === value; })[0];
    return opt ? stripTerms(opt.label) : String(value);
  }

  function stripTerms(text) {
    return String(text).replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1');
  }

  PIA.questions = {
    sections: sections,
    byId: byId,
    optionLabel: optionLabel,
    stripTerms: stripTerms,
    SENSITIVE_OPTIONS: SENSITIVE_OPTIONS,
    hasAny: hasAny
  };
})(typeof window !== 'undefined' ? window : globalThis);
