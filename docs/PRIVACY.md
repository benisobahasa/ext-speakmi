# Privacy

- No account, analytics, advertising or tracking. No data is sold or shared.
- The extension makes **no network requests of its own**. `npm run check` fails if `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` or similar appear in `content/`, `popup/` or `background/`.
- Permissions: `activeTab` (act only on the page you click), `scripting` (inject the reader into that page), `storage` (keep your settings and streak on your device).
- **Optional permission `trialML`** (Firefox's on-device AI). Asked for only when you press "Allow on-device AI" in the popup. You can withdraw it in the same place. Without it, nothing AI-related runs.
- **Model download.** If you switch the AI rewrite on and the model is not yet on your device, Firefox (not Speakmi) downloads it once from the model hub it uses (Hugging Face). That download contains no text from your pages. After that the AI works offline.
- **Your text.** Sentences are sent to the local engine in Firefox and nowhere else.
- The Firefox manifest declares `data_collection_permissions: none`.
- Website policy: <https://ext.speakmi.com/privacy.html>
