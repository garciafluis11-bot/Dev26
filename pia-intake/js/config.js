/*
 * Organization settings for the Privacy Intake engine.
 * Edit these values to tailor the tool to your organization; no other file needs to change.
 */
(function (root) {
  'use strict';
  var PIA = (root.PIA = root.PIA || {});

  PIA.config = {
    appName: 'Privacy Check',
    tagline: 'A guided privacy intake. No privacy expertise needed.',

    // Pre-filled into every new assessment (people can still change them).
    organization: {
      name: '',            // Legal entity name, e.g. "Acme Corp Ltd."
      address: '',
      privacyContact: '',  // Privacy team mailbox
      dpoContact: '',      // Data Protection Officer (if you have one)
      legalContact: ''     // Where finished records are sent
    },

    threshold: {
      // EDPB WP248 rev.01: meeting two or more criteria means a DPIA is required in most cases.
      dpiaCriteria: 2,
      // One criterion triggers a standard PIA.
      piaCriteria: 1,
      // This many "elevating factors" (new use, external sharing, transfers) also trigger a standard PIA.
      piaElevatingFactors: 2,
      // Values of the screening "how many people" question treated as large scale.
      largeScale: ['10k-100k', 'gt100k'],
      veryLargeScale: ['gt100k'],
      // "Not sure" answers count as "yes" until someone confirms them.
      treatUnsureAsYes: true
    },

    risk: {
      // Inherent score = likelihood (1-5) x impact (1-5).
      bands: [
        { max: 5, label: 'Low' },
        { max: 11, label: 'Medium' },
        { max: 19, label: 'High' },
        { max: 25, label: 'Critical' }
      ],
      // How much an implemented (or planned) mitigation lowers likelihood.
      mitigationLikelihoodReduction: 2
    },

    storageKey: 'pia-intake:v1'
  };
})(typeof window !== 'undefined' ? window : globalThis);
