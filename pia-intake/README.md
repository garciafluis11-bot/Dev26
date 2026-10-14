# Privacy Check: PIA intake engine

A guided, plain-language intake for Privacy Impact Assessments (PIA / DPIA), written for people who don't know privacy terminology. It:

1. **Screens the project (threshold assessment).** About 15 yes/no questions decide whether the project needs nothing, a short record (low risk), a standard PIA, or a full DPIA.
2. **Asks only the questions that apply.** Deeper sections (rights, AI and automated decisions, monitoring) appear only for higher-risk projects or when earlier answers make them relevant.
3. **Triggers risks as people answer.** Each risk is mapped to NIST Privacy Framework v1.0 subcategories and to the NIST PRAM problematic data actions and problems for individuals, with practical mitigations.
4. **Generates the record for legal.** A Record of Processing Activities (all GDPR Article 30(1) fields plus US state-law fields), the screening decision, the risk register, the NIST alignment, an action plan, indicative applicable laws, open items, and a sign-off block.

Everything runs in the browser. Nothing is sent anywhere; assessments are saved in the browser's local storage until the user downloads them.

## Running it

No install or build step is needed.

- **Locally:** open `pia-intake/index.html` in a browser.
- **On an intranet / static host:** upload the `pia-intake` folder (GitHub Pages, SharePoint, S3, any web server).
- **As one file:** `node pia-intake/build.js` writes `pia-intake/dist/privacy-check.html`, a single self-contained file you can email or attach.

Fonts load from Google Fonts when online and fall back to system fonts offline.

## How the threshold works

| Outcome | Rule |
| --- | --- |
| **No assessment needed** | No personal data (including a double-check for cookies, device IDs, recordings, free text, location and logs). |
| **Low risk: no full PIA** | Personal data, no high-risk criteria, and at most one elevating factor. Users answer only the RoPA essentials. |
| **Standard PIA** | One EDPB high-risk criterion, or two or more elevating factors (new purpose, external sharing, international transfer). |
| **Full DPIA** | Two or more EDPB criteria, or any GDPR Art. 35(3) mandatory trigger (automated decisions with significant effects; large-scale special-category data; large-scale monitoring of public areas). |

The nine criteria come from the EDPB *Guidelines on DPIA* (WP248 rev.01). "Not sure" answers count as "yes" until someone confirms them, and they are listed for follow-up in the record. All thresholds are configurable in `js/config.js`.

## Risk scoring

- Each risk has a base likelihood and impact (1 to 5). Impact goes up by one when special-category data, children, vulnerable people, or more than 100,000 people are involved.
- Score = likelihood × impact. Bands: Low (≤5), Medium (≤11), High (≤19), Critical (20+).
- Users record a response per risk (Not started / Planned / In place / Risk accepted), an owner, a due date and notes. "Planned" and "In place" lower the residual likelihood by 2 ("planned" is shown as projected). Accepted risks require a justification for legal.
- Answers to questions that later become hidden (because an earlier answer changed) are ignored by the risk engine and the RoPA.

## Exports (last step)

| Export | Use |
| --- | --- |
| Download for Word (.doc) | Full report and RoPA, editable in Word. |
| Save as PDF | Prints only the report. |
| RoPA row (.csv) | One row per assessment; append rows to build a central register. |
| Web page (.html) | Standalone copy of the report. |
| Back up (.json) | Full assessment plus computed results; re-open it with "Open a backup". Also suitable for importing into GRC tools. |
| Copy buttons | RoPA as a tab-separated table (pastes into Excel/Sheets) and a plain-text summary for an email. |

## Customizing

| File | What to change |
| --- | --- |
| `js/config.js` | Organization name and contacts (pre-filled into every assessment), thresholds, risk bands. |
| `js/questions.js` | Question wording, help text, options, and when each question or section appears. |
| `js/risks.js` | Risk catalog: triggers, scores, NIST mappings, mitigations. |
| `js/glossary.js` | Plain-language definitions. Reference a term in any question as `[[shown text|key]]`. |
| `js/nist.js` | NIST Privacy Framework and PRAM reference text. |
| `js/report.js` | Report layout and export formats. |

## Tests

```sh
node --test pia-intake/tests/*.test.js
```

The tests cover the threshold tiers, mandatory triggers, conditional sections, risk triggering and scoring, residual risk, that every risk maps to a real NIST subcategory, glossary references, the Art. 30 RoPA fields, CSV escaping, and HTML escaping of user input.

## Limitations

- The applicable-law list is indicative and is labeled for legal to confirm. This tool supports, but does not replace, legal advice.
- Local storage is per browser and per device. Users should download a JSON backup to move between devices or share with colleagues.
- NIST subcategory text is paraphrased from Privacy Framework v1.0; check the [official framework](https://www.nist.gov/privacy-framework) for authoritative wording.
