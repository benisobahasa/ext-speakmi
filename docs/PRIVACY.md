# Privacy

- No account, analytics, advertising or tracking. No data is sold or shared.
- The extension makes **no network requests**. `npm run check` fails if `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` or similar appear in `content/` or `popup/`.
- Permissions: `activeTab` (act only on the page you click), `scripting` (inject the reader into that page), `storage` (keep your settings and streak on your device).
- The Firefox manifest declares `data_collection_permissions: none`.
- Website policy: <https://ext.speakmi.com/privacy.html>
