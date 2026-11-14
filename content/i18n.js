/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
/* UI strings. English, German, Bahasa Indonesia. */
(function (root) {
  root.SpeakmiI18N = {
    en: {
      appName: "Speakmi",
      close: "Close", focus: "One chunk at a time", list: "Show all chunks", original: "Show original", restructured: "Back to restructured view",
      theme: "Theme", themeNames: { aurora: "Aurora", calm: "Calm", paper: "Paper", midnight: "Midnight" }, smaller: "Smaller text", larger: "Larger text",
      profile: "Reading profile", profiles: { adhd: "ADHD", dyslexia: "Dyslexia", autism: "Autism (literal)", mixed: "Mixed", general: "General" },
      summaryTitle: "In short", summaryBadge: "Key sentences, original wording", source: "Source", jump: "Show in original",
      sourceIn: "From: {s}", keyNumbers: "Numbers in this article", outline: "Outline", intro: "Introduction", part: "Part {n}", autoLabel: "automatic label",
      chunkOf: "Chunk {i} of {n}", about: "about {t}", sec: "{n} s", min: "{n} min", prev: "Previous", next: "Next",
      feedback: "This view is", tooLong: "Too long", tooShort: "Too short", lost: "I lost the thread",
      recap: "Where you are: {h}. Before this:", noHeading: "this part",
      hints: "Simpler-word hints", idioms: "Flag figures of speech", simpler: "Simpler: {w}", literal: "Figure of speech. Literal meaning: {m}",
      ai: "Plain-language rewrite (on-device AI, experimental)", aiNoApi: "On-device AI is not available in this browser. Speakmi keeps working in rule-based mode.",
      aiEnOnly: "AI rewriting is limited to English in this prototype. Rule-based mode is used for this article.", aiBusy: "Rewriting…", aiError: "AI rewrite failed: {e}",
      rewritten: "Rewritten", verified: "Verified: numbers, names and negations match the source", flagged: "Check before trusting: {i}",
      verbatim: "Original wording", showOrig: "Show original sentence", showRewrite: "Show rewritten sentence",
      fidelity: "Fidelity audit", fidelityLine: "{n} sentences shown: {v} in original wording, {ok} rewritten and verified, {bad} flagged.",
      fidelityNote: "Every point is anchored to a source sentence. Rewrites are checked for numbers, names and negations.",
      notEnough: "Speakmi could not find enough article text on this page.", noPage: "Speakmi cannot run on this page.",
      evidenceTitle: "Evidence behind these settings",
      issues: { "number-added": "number {v} is not in the source", "number-missing": "number {v} is missing", "name-added": "name {v} is not in the source", "negation-changed": "negation changed ({v})", "negation-added": "negation added" },
      popupRun: "Restructure this page", popupHint: "Works on articles. Text is processed on your device.", popupArticleLang: "Article language", auto: "Detect automatically", popupUi: "Interface language",
      popupFocus: "Start in one-chunk-at-a-time mode", popupAbout: "How it works and evidence", cannotRun: "Speakmi cannot run on this page (browser pages and stores are blocked by the browser).",
      start: "Start reading", bitesPlan: "{n} short parts · about {t}", timeLeft: "about {t} left", finish: "Finish",
      doneTitle: "You made it to the end", doneLine: "{n} parts read in about {t}.", highlights: "Your highlights", keyPointsRecap: "Key points", again: "Read again",
      tipMark: "Tip: tap any sentence to highlight it.", settings: "Settings", originalTitle: "Original text",
      planOpen: "Free · open source", popupOpen: "Free and open source. No account, no limits, nothing leaves your device.", 
      
      
      
      
      
      popupPrivacy: "Privacy", popupSupport: "Support", popupReset: "Reset today's count (for demos)", popupBeta: "Beta",
      streakLine: "{days}-day reading streak · {total} finished", langNames: { en: "English", de: "Deutsch", id: "Bahasa Indonesia" }
    },
    de: {
      appName: "Speakmi",
      close: "Schließen", focus: "Ein Abschnitt nach dem anderen", list: "Alle Abschnitte zeigen", original: "Original anzeigen", restructured: "Zurück zur aufbereiteten Ansicht",
      theme: "Farbschema", themeNames: { aurora: "Aurora", calm: "Ruhig", paper: "Papier", midnight: "Mitternacht" }, smaller: "Kleinere Schrift", larger: "Größere Schrift",
      profile: "Leseprofil", profiles: { adhd: "ADHS", dyslexia: "Legasthenie", autism: "Autismus (wörtlich)", mixed: "Gemischt", general: "Allgemein" },
      summaryTitle: "Kurz gesagt", summaryBadge: "Schlüsselsätze im Originalwortlaut", source: "Quelle", jump: "Im Original zeigen",
      sourceIn: "Aus: {s}", keyNumbers: "Zahlen in diesem Artikel", outline: "Gliederung", intro: "Einleitung", part: "Teil {n}", autoLabel: "automatische Überschrift",
      chunkOf: "Abschnitt {i} von {n}", about: "etwa {t}", sec: "{n} Sek.", min: "{n} Min.", prev: "Zurück", next: "Weiter",
      feedback: "Diese Ansicht ist", tooLong: "Zu lang", tooShort: "Zu kurz", lost: "Ich habe den Faden verloren",
      recap: "Wo Sie sind: {h}. Davor:", noHeading: "dieser Teil",
      hints: "Hinweise auf einfachere Wörter", idioms: "Redewendungen markieren", simpler: "Einfacher: {w}", literal: "Redewendung. Wörtlich gemeint: {m}",
      ai: "Einfache Sprache (KI auf dem Gerät, experimentell)", aiNoApi: "KI auf dem Gerät ist in diesem Browser nicht verfügbar. Speakmi arbeitet regelbasiert weiter.",
      aiEnOnly: "Das KI-Umschreiben ist in diesem Prototyp auf Englisch beschränkt. Für diesen Artikel gilt der regelbasierte Modus.", aiBusy: "Wird umgeschrieben…", aiError: "KI-Umschreiben fehlgeschlagen: {e}",
      rewritten: "Umgeschrieben", verified: "Geprüft: Zahlen, Namen und Verneinungen stimmen mit der Quelle überein", flagged: "Bitte prüfen: {i}",
      verbatim: "Originalwortlaut", showOrig: "Originalsatz zeigen", showRewrite: "Umgeschriebenen Satz zeigen",
      fidelity: "Treue-Prüfung", fidelityLine: "{n} Sätze angezeigt: {v} im Originalwortlaut, {ok} umgeschrieben und geprüft, {bad} markiert.",
      fidelityNote: "Jeder Punkt ist an einen Quellsatz gebunden. Umschreibungen werden auf Zahlen, Namen und Verneinungen geprüft.",
      notEnough: "Speakmi konnte auf dieser Seite nicht genug Artikeltext finden.", noPage: "Speakmi kann auf dieser Seite nicht laufen.",
      evidenceTitle: "Belege hinter diesen Einstellungen",
      issues: { "number-added": "Zahl {v} steht nicht in der Quelle", "number-missing": "Zahl {v} fehlt", "name-added": "Name {v} steht nicht in der Quelle", "negation-changed": "Verneinung verändert ({v})", "negation-added": "Verneinung hinzugefügt" },
      popupRun: "Diese Seite aufbereiten", popupHint: "Für Artikel. Der Text wird auf Ihrem Gerät verarbeitet.", popupArticleLang: "Sprache des Artikels", auto: "Automatisch erkennen", popupUi: "Sprache der Oberfläche",
      popupFocus: "Im Modus „ein Abschnitt nach dem anderen“ starten", popupAbout: "Funktionsweise und Belege", cannotRun: "Speakmi kann auf dieser Seite nicht laufen (Browserseiten und Stores sind gesperrt).",
      start: "Los geht's", bitesPlan: "{n} kurze Teile · etwa {t}", timeLeft: "noch etwa {t}", finish: "Fertig",
      doneTitle: "Geschafft, Sie sind am Ende", doneLine: "{n} Teile in etwa {t} gelesen.", highlights: "Ihre Markierungen", keyPointsRecap: "Kernpunkte", again: "Nochmal lesen",
      tipMark: "Tipp: Tippen Sie auf einen Satz, um ihn zu markieren.", settings: "Einstellungen", originalTitle: "Originaltext",
      planOpen: "Gratis · Open Source", popupOpen: "Kostenlos und Open Source. Kein Konto, keine Limits, nichts verlässt dein Gerät.", 
      
      
      
      
      
      popupPrivacy: "Datenschutz", popupSupport: "Support", popupReset: "Heutigen Zähler zurücksetzen (für Demos)", popupBeta: "Beta",
      streakLine: "{days} Tage in Folge gelesen · {total} abgeschlossen", langNames: { en: "English", de: "Deutsch", id: "Bahasa Indonesia" }
    },
    id: {
      appName: "Speakmi",
      close: "Tutup", focus: "Satu bagian sekali tampil", list: "Tampilkan semua bagian", original: "Lihat teks asli", restructured: "Kembali ke tampilan yang ditata",
      theme: "Tema", themeNames: { aurora: "Aurora", calm: "Tenang", paper: "Kertas", midnight: "Tengah malam" }, smaller: "Teks lebih kecil", larger: "Teks lebih besar",
      profile: "Profil membaca", profiles: { adhd: "ADHD", dyslexia: "Disleksia", autism: "Autisme (harfiah)", mixed: "Campuran", general: "Umum" },
      summaryTitle: "Singkatnya", summaryBadge: "Kalimat kunci, kata-kata asli", source: "Sumber", jump: "Lihat di teks asli",
      sourceIn: "Dari: {s}", keyNumbers: "Angka dalam artikel ini", outline: "Kerangka", intro: "Pendahuluan", part: "Bagian {n}", autoLabel: "label otomatis",
      chunkOf: "Bagian {i} dari {n}", about: "sekitar {t}", sec: "{n} dtk", min: "{n} mnt", prev: "Sebelumnya", next: "Berikutnya",
      feedback: "Tampilan ini", tooLong: "Terlalu panjang", tooShort: "Terlalu pendek", lost: "Saya kehilangan alur",
      recap: "Posisi Anda: {h}. Sebelumnya:", noHeading: "bagian ini",
      hints: "Petunjuk kata yang lebih sederhana", idioms: "Tandai ungkapan kiasan", simpler: "Lebih sederhana: {w}", literal: "Ungkapan kiasan. Arti harfiah: {m}",
      ai: "Tulis ulang dengan bahasa sederhana (AI di perangkat, eksperimental)", aiNoApi: "AI di perangkat tidak tersedia di browser ini. Speakmi tetap berjalan dengan mode berbasis aturan.",
      aiEnOnly: "Penulisan ulang AI dibatasi untuk bahasa Inggris pada prototipe ini. Artikel ini memakai mode berbasis aturan.", aiBusy: "Sedang ditulis ulang…", aiError: "Penulisan ulang AI gagal: {e}",
      rewritten: "Ditulis ulang", verified: "Terverifikasi: angka, nama, dan negasi sesuai dengan sumber", flagged: "Periksa dulu: {i}",
      verbatim: "Kata-kata asli", showOrig: "Lihat kalimat asli", showRewrite: "Lihat kalimat hasil tulis ulang",
      fidelity: "Audit kesetiaan", fidelityLine: "{n} kalimat ditampilkan: {v} dengan kata-kata asli, {ok} ditulis ulang dan terverifikasi, {bad} ditandai.",
      fidelityNote: "Setiap poin terhubung ke kalimat sumber. Hasil tulis ulang diperiksa untuk angka, nama, dan negasi.",
      notEnough: "Speakmi tidak menemukan cukup teks artikel di halaman ini.", noPage: "Speakmi tidak bisa berjalan di halaman ini.",
      evidenceTitle: "Bukti di balik pengaturan ini",
      issues: { "number-added": "angka {v} tidak ada di sumber", "number-missing": "angka {v} hilang", "name-added": "nama {v} tidak ada di sumber", "negation-changed": "negasi berubah ({v})", "negation-added": "negasi ditambahkan" },
      popupRun: "Tata ulang halaman ini", popupHint: "Untuk artikel. Teks diproses di perangkat Anda.", popupArticleLang: "Bahasa artikel", auto: "Deteksi otomatis", popupUi: "Bahasa antarmuka",
      popupFocus: "Mulai dengan mode satu bagian sekali tampil", popupAbout: "Cara kerja dan bukti", cannotRun: "Speakmi tidak bisa berjalan di halaman ini (halaman browser dan toko ekstensi diblokir oleh browser).",
      start: "Mulai membaca", bitesPlan: "{n} bagian pendek · sekitar {t}", timeLeft: "sisa sekitar {t}", finish: "Selesai",
      doneTitle: "Anda sampai di akhir", doneLine: "{n} bagian dibaca dalam sekitar {t}.", highlights: "Sorotan Anda", keyPointsRecap: "Poin utama", again: "Baca lagi",
      tipMark: "Tips: ketuk kalimat mana pun untuk menyorotnya.", settings: "Pengaturan", originalTitle: "Teks asli",
      planOpen: "Gratis · sumber terbuka", popupOpen: "Gratis dan sumber terbuka. Tanpa akun, tanpa batas, tidak ada data yang keluar dari perangkat.", 
      
      
      
      
      
      popupPrivacy: "Privasi", popupSupport: "Bantuan", popupReset: "Atur ulang hitungan hari ini (untuk demo)", popupBeta: "Beta",
      streakLine: "{days} hari berturut-turut membaca · {total} selesai", langNames: { en: "English", de: "Deutsch", id: "Bahasa Indonesia" }
    }
  };
})(typeof self !== "undefined" ? self : this);
