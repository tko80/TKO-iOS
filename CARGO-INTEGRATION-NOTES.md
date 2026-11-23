# TKO Cargo Records Integration

- Added Cargo Records as a separate module in the existing TKO dropdown menu.
- Cargo UI runs in an isolated iframe `srcdoc` so Cargo CSS/DOM/JavaScript do not collide with TKO.
- The iframe inherits the TKO document origin, allowing Cargo's existing localStorage-based records to persist in the same WebView origin.
- Original TKO JavaScript (`script.js`), native Swift files, backup/restore bridge, and Cargo Records application logic are retained unchanged.
- Visual refresh is CSS-only and appended to the TKO entry page.
- Cargo source is also retained at `TKO/WebApp/CargoRecords.html`.
