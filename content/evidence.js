/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
/* Evidence labels. Every feature is graded by what the research says, not by what we hope. */
(function (root) {
  root.SpeakmiEvidence = [
    { feature: "Short chunks, clear headings, signalling", grade: "Strong", cls: "strong",
      note: "Segmenting and signalling principles in multimedia learning (Mayer, 2009). Effect for this tool is measured in our pilot." },
    { feature: "Removing page clutter (focus view)", grade: "Strong", cls: "strong",
      note: "Cognitive load theory: extraneous load reduces learning (Sweller, Ayres & Kalyuga, 2011)." },
    { feature: "Extra letter and word spacing (dyslexia, mixed profiles)", grade: "Moderate", cls: "moderate",
      note: "Extra-large letter spacing improved reading in dyslexic readers (Zorzi et al., 2012)." },
    { feature: "Simpler-word hints and figure-of-speech flags", grade: "Guidance", cls: "guidance",
      note: "Recommended by W3C cognitive accessibility guidance (COGA, 2021). Effect still to be measured." },
    { feature: "One chunk at a time", grade: "Untested", cls: "untested",
      note: "Plausible for attention differences. This is one of the questions the pilot answers." },
    { feature: "Specialised dyslexia fonts", grade: "Weak", cls: "weak",
      note: "Studies report little or no benefit (Marinus et al., 2016; Wery & Diliberto, 2017). Not included." }
  ];
})(typeof self !== "undefined" ? self : this);
