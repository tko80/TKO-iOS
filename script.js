document.addEventListener("DOMContentLoaded", function () {
    loadEntries();
    loadPreferredNames();
    document.getElementById("date").valueAsDate = new Date();
    document.getElementById("date").addEventListener("change", loadEntries);
});


function saveCompanyDeliveryStatus(entryId, checkbox) {
    try {
        const entries = ensureEntryIds(JSON.parse(localStorage.getItem("entries") || "[]"));
        const entry = entries.find(e => String(e.id) === String(entryId));
        if (!entry) return;

        if (checkbox.checked) {
            const now = new Date();
            entry.delivered = true;
            entry.deliveredAt = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
        } else {
            entry.delivered = false;
            delete entry.deliveredAt;
        }

        localStorage.setItem("entries", JSON.stringify(entries));

        const selectedDate = document.getElementById('date')?.value || entry.date;

        // Keep every currently expanded Name box open after a Delivered tick.
        // The totals are rebuilt below, so remember which town/name groups were open.
        const openGroups = new Set();
        document.querySelectorAll('#total-quantity .name-town-box').forEach(box => {
            const details = box.nextElementSibling;
            const key = box.dataset.groupKey;
            if (details && details.style.display === 'block' && key) {
                openGroups.add(key);
            }
        });

        calculateTotalQuantity(entries.filter(e => e.date === selectedDate), openGroups);
    } catch (error) {
        console.error('Delivery save error:', error);
    }
}

function updateDeliveryTimeDisplay(checkbox, timestamp) {
    const container = checkbox.parentElement;
    let timeSpan = container.querySelector('.delivery-time');
    
    if (!timeSpan) {
        timeSpan = document.createElement('span');
        timeSpan.className = 'delivery-time';
        timeSpan.style.marginLeft = '5px';
        timeSpan.style.color = '#666';
        timeSpan.style.fontSize = '12px';
        container.appendChild(timeSpan);
    }
    
    timeSpan.textContent = `(Delivered: ${timestamp})`;
}

// ✅ Delivery time display ကိုဖျက်ခြင်း
function removeDeliveryTimeDisplay(checkbox) {
    const container = checkbox.parentElement;
    const timeSpan = container.querySelector('.delivery-time');
    
    if (timeSpan) {
        container.removeChild(timeSpan);
    }
}

// ✅ Remaining quantity တွက်ချက်ပြီး update လုပ်ခြင်း
function updateRemainingQuantity(company, date, town, name) {
    // Get all entries for this name in this town on this date
    const entries = JSON.parse(localStorage.getItem("entries")) || [];
    const filteredEntries = entries.filter(entry => 
        entry.date === date &&
        entry.town === town &&
        entry.name === name
    );
    
    // Calculate total quantity
    const totalQuantity = filteredEntries.reduce((sum, entry) => sum + parseInt(entry.quantity), 0);
    
    // Calculate delivered quantity
    let deliveredQuantity = 0;
    filteredEntries.forEach(entry => {
        if (entry.delivered === true) {
            deliveredQuantity += Number(entry.quantity) || 0;
        }
    });
    
    // Calculate remaining quantity
    const remainingQuantity = totalQuantity - deliveredQuantity;
    
    // Update the UI
    updateRemainingDisplay(town, name, totalQuantity, remainingQuantity);
}

// ✅ Remaining quantity ကို UI မှာပြသခြင်း
function updateRemainingDisplay(town, name, totalQuantity, remainingQuantity) {
    const nameElement = document.querySelector(`#name-remaining-${town.replace(/\s+/g, '-')}-${name.replace(/\s+/g, '-')}`);
    
    if (nameElement) {
        if (remainingQuantity === 0) {
            nameElement.innerHTML = `
                <span style="color:black; font-weight:bold;">${name}</span> -
                <span style="color:red; font-weight:bold;">${totalQuantity}</span>
                <span style="color:green; font-weight:bold; margin-left: 5px;">✅</span>
            `;
        } else {
            nameElement.innerHTML = `
                <span style="color:black; font-weight:bold;">${name}</span> -
                <span style="color:red; font-weight:bold;">${totalQuantity}</span>
                 <span class="town-wise-remaining-label" style="color:#4b5563 !important;-webkit-text-fill-color:#4b5563 !important;font-weight:900;">(Remaining: </span><span class="town-wise-remaining-qty" style="color:#dc2626 !important;-webkit-text-fill-color:#dc2626 !important;font-weight:900;">${remainingQuantity}</span><span class="town-wise-remaining-label" style="color:#4b5563 !important;-webkit-text-fill-color:#4b5563 !important;font-weight:900;">)</span>
            `;
        }
    }
}

// ✅ Checkbox ဖန်တီးတဲ့နေရာမှာ ဒီ function ကိုခေါ်သုံးပါ
function createCompanyCheckbox(entry, index, container) {
    const checkboxContainer = document.createElement("div");
    checkboxContainer.style.display = "flex";
    checkboxContainer.style.alignItems = "center";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "company-delivery-checkbox";
    
    // Each Entry has its own delivery state. Never use company/name/quantity
    // as the key because duplicate entries must be counted independently.
    const deliveredTime = entry.delivered ? (entry.deliveredAt || '') : '';

    checkbox.checked = entry.delivered === true;

    checkbox.onchange = function() {
        saveCompanyDeliveryStatus(entry.id, this);
    };
    
    checkboxContainer.appendChild(checkbox);
    
    // Add delivery time if already delivered
    if (deliveredTime) {
        updateDeliveryTimeDisplay(checkbox, deliveredTime);
    }
    
    container.appendChild(checkboxContainer);
}
// ==================== ENTRY DELIVERY / REMARK SYSTEM ====================
function generateEntryId() {
    return 'entry_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

function ensureEntryIds(entries) {
    let changed = false;
    entries.forEach(entry => {
        if (!entry.id) {
            entry.id = generateEntryId();
            changed = true;
        }
        if (typeof entry.delivered !== 'boolean') entry.delivered = false;
    });
    if (changed) localStorage.setItem('entries', JSON.stringify(entries));
    return entries;
}

function saveRemarkEntry() {
    if (window.__remarkConfirmOpen === true) return;

    const company = String(document.getElementById('company')?.value || '').trim();
    const name = String(document.getElementById('name')?.value || '').trim();
    const town = String(document.getElementById('town')?.value || '').trim();
    const quantity = Number(document.getElementById('quantity')?.value || 0);
    const date = String(
        document.getElementById('date')?.value ||
        new Date().toISOString().slice(0, 10)
    ).trim();

    if (!company || !name || !town || !quantity || quantity < 1) {
        showModernPopup(
            'Please select Company, Name, Town and Quantity first.',
            'Remark'
        );
        return;
    }

    let remarks = [];
    try {
        const raw = JSON.parse(localStorage.getItem('remarkEntries') || '[]');
        remarks = Array.isArray(raw) ? raw : [];
    } catch (e) {
        remarks = [];
    }

    const norm = v => String(v ?? '').trim().toLowerCase();

    const duplicate = remarks.some(r =>
        norm(r.date) === norm(date) &&
        norm(r.company) === norm(company) &&
        norm(r.name) === norm(name) &&
        norm(r.town) === norm(town)
    );

    // Remark click NEVER saves directly.
    // It always opens a confirmation popup. Duplicate is clearly indicated.
    const title = duplicate ? '⚠️ Duplicate Remark' : 'Remark Confirmation';
    const message =
        (duplicate
            ? '<span class="remark-duplicate-warning">ဒီနေ့အတွက် အရောက်ပို့ခ Remark လုပ်ပြီးသားရှိပါတယ်။</span><br><br>'
            : 'ဒီနေ့အတွက် အရောက်ပို့ခ ရှင်းပြီးအဖြစ် မှတ်သားမယ်။<br><br>') +
        `<b>Company:</b> ${escapeRemarkText(company)}<br>` +
        `<b>Name:</b> ${escapeRemarkText(name)}<br>` +
        `<b>Town:</b> ${escapeRemarkText(town)}<br>` +
        `<b>Quantity:</b> ${quantity}<br><br>` +
        `<b>အရောက်ပို့ခ ရှင်းပြီး</b><br><br>` +
        (duplicate
            ? '<span class="remark-save-question"><span class="remark-save-question">ထပ်ပြီး Save လုပ်မလား?</span></span>'
            : 'Save လုပ်မလား?');

    showRemarkSaveConfirmation(title, message, () => {
        commitRemarkEntry({
            date, company, name, town, quantity
        });
    });
}

/* Confirmation popup used ONLY for Remark Save. */
function showRemarkSaveConfirmation(title, message, onConfirm) {
    window.__remarkConfirmOpen = true;

    const old = document.getElementById('remark-save-confirm');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'remark-save-confirm';
    overlay.style.cssText =
        'position:fixed;inset:0;z-index:2000000;' +
        'background:rgba(0,0,0,.72);display:flex;' +
        'align-items:center;justify-content:center;padding:18px;';

    overlay.innerHTML = `
        <div style="
            width:min(480px,94vw);
            background:#fff;
            border:2px solid #1683ff;
            border-radius:18px;
            box-shadow:0 18px 50px rgba(0,0,0,.45);
            overflow:hidden;
            color:#18212f;
            font-family:Arial,sans-serif;">
            <div style="
                padding:16px 20px;
                background:linear-gradient(135deg,#7b2cbf,#2563eb);
                color:#fff;
                font-size:22px;
                font-weight:800;">
                ${title}
                <button type="button" id="remarkConfirmClose" style="
                    float:right;border:0;border-radius:50%;
                    width:34px;height:34px;background:rgba(255,255,255,.2);
                    color:#fff;font-size:22px;font-weight:800;">×</button>
            </div>
            <div style="padding:24px 22px;font-size:17px;line-height:1.65;">
                ${message}
            </div>
            <div style="
                display:flex;gap:12px;padding:0 22px 22px;">
                <button type="button" id="remarkConfirmOK" style="
                    flex:1;border:0;border-radius:12px;padding:14px 10px;
                    background:linear-gradient(145deg,#22c55e,#15803d);
                    color:#fff;font-size:18px;font-weight:800;
                    box-shadow:0 5px 12px rgba(21,128,61,.3);">
                    OK — Save
                </button>
                <button type="button" id="remarkConfirmCancel" style="
                    flex:1;border:0;border-radius:12px;padding:14px 10px;
                    background:linear-gradient(145deg,#64748b,#374151);
                    color:#fff;font-size:18px;font-weight:800;">
                    Cancel
                </button>
            </div>
        </div>`;

    document.body.appendChild(overlay);

    const close = () => {
        overlay.remove();
        window.__remarkConfirmOpen = false;
    };

    overlay.querySelector('#remarkConfirmCancel').onclick = close;
    overlay.querySelector('#remarkConfirmClose').onclick = close;
    overlay.querySelector('#remarkConfirmOK').onclick = () => {
        close();
        onConfirm();
    };
}

/* Actual Remark save happens ONLY after OK is pressed. */
function commitRemarkEntry(data) {
    if (window.__remarkSaveInProgress === true) return;
    window.__remarkSaveInProgress = true;

    try {
        let remarkEntries = [];
        try {
            const raw = JSON.parse(localStorage.getItem('remarkEntries') || '[]');
            remarkEntries = Array.isArray(raw) ? raw : [];
        } catch (e) {
            remarkEntries = [];
        }

        const now = new Date().toLocaleString();

        remarkEntries.push({
            id: 'remark_' + Date.now().toString(36) + '_' +
                Math.random().toString(36).slice(2, 8),
            date: data.date,
            company: data.company,
            name: data.name,
            town: data.town,
            quantity: data.quantity,
            remarkAt: now,
            remarkPaidAt: now
        });

        localStorage.setItem(
            'remarkEntries',
            JSON.stringify(remarkEntries)
        );

        // Keep the matching Entry marked as delivery-fee paid.
        try {
            const entries = ensureEntryIds(
                JSON.parse(localStorage.getItem('entries') || '[]')
            );
            const norm = v => String(v ?? '').trim().toLowerCase();

            entries.forEach(entry => {
                if (
                    norm(entry.date) === norm(data.date) &&
                    norm(entry.company) === norm(data.company) &&
                    norm(entry.name) === norm(data.name) &&
                    norm(entry.town) === norm(data.town)
                ) {
                    entry.remarkPaid = true;
                    entry.remarkPaidAt = now;
                }
            });

            localStorage.setItem('entries', JSON.stringify(entries));
        } catch (e) {
            console.warn('Entry remark sync skipped:', e);
        }

        if (typeof loadEntries === 'function') {
            loadEntries();
        }

        showModernPopup(
            `✅ အရောက်ပို့ခ ရှင်းပြီး<br><br>${escapeRemarkText(data.name)} / ${escapeRemarkText(data.town)} / Qty ${data.quantity}`,
            'Remark Saved'
        );
    } catch (error) {
        console.error('Remark save error:', error);
        showModernPopup(
            'အရောက်ပို့ခ မှတ်တမ်း သိမ်း၍ မရပါ။',
            'Error'
        );
    } finally {
        window.setTimeout(() => {
            window.__remarkSaveInProgress = false;
        }, 350);
    }
}

function openRemarkSelection() {
    const modal = document.getElementById('remarkSelectionModal');
    const body = document.getElementById('remarkSelectionBody');
    const count = document.getElementById('remarkSelectionCount');
    const selectAll = document.getElementById('remarkSelectAll');

    if (!modal || !body) return;

    // Only show today's Entries that are in Preferred.
    const selectedDate = document.getElementById('date')?.value ||
        new Date().toISOString().slice(0, 10);

    const entries = ensureEntryIds(
        JSON.parse(localStorage.getItem('entries') || '[]')
    );

    // Preferred data may be stored under common keys. Use the existing
    // Preferred list if present; otherwise match the current Preferred
    // selections exposed by the page.
    let preferred = [];
    try {
        preferred = JSON.parse(localStorage.getItem('preferredEntries') || '[]');
        if (!Array.isArray(preferred)) preferred = [];
    } catch (e) {
        preferred = [];
    }

    const preferredIds = new Set(
        preferred.map(x => String(
            x?.id ?? x?.entryId ?? x
        ))
    );

    const preferredMatches = entries.filter(entry => {
        if (entry.date !== selectedDate) return false;

        // If Preferred IDs exist, use them. Also support Preferred records
        // saved by Company + Name + Town when no entry id is available.
        if (preferred.length) {
            if (preferredIds.has(String(entry.id))) return true;

            return preferred.some(p =>
                String(p?.company || '').trim() === String(entry.company || '').trim() &&
                String(p?.name || '').trim() === String(entry.name || '').trim() &&
                String(p?.town || '').trim() === String(entry.town || '').trim()
            );
        }

        return false;
    });

    body.innerHTML = '';

    if (!preferredMatches.length) {
        body.innerHTML =
            '<tr><td colspan="5" style="padding:25px;text-align:center;color:#777;font-weight:700;">ဒီနေ့ Preferred ထဲမှာ ရွေးထားတဲ့ Entry မရှိပါ။</td></tr>';
    } else {
        preferredMatches.forEach(entry => {
            const tr = document.createElement('tr');
            tr.style.borderTop = '1px solid #eee';

            tr.innerHTML = `
                <td style="padding:9px;text-align:center;">
                    <input type="checkbox"
                        class="remark-entry-checkbox"
                        data-entry-id="${String(entry.id).replace(/"/g, '&quot;')}"
                        onchange="updateRemarkSelectionCount()">
                </td>
                <td style="padding:9px;">${escapeRemarkText(entry.company)}</td>
                <td style="padding:9px;">${escapeRemarkText(entry.name)}</td>
                <td style="padding:9px;">${escapeRemarkText(entry.town)}</td>
                <td style="padding:9px;text-align:center;font-weight:700;">${Number(entry.quantity) || 0}</td>
            `;

            body.appendChild(tr);
        });
    }

    if (selectAll) selectAll.checked = false;
    if (count) count.textContent = '0 selected';

    modal.style.display = 'flex';
}

function escapeRemarkText(value) {
    return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function updateRemarkSelectionCount() {
    const boxes = Array.from(document.querySelectorAll('#remarkSelectionBody .remark-entry-checkbox:not(:disabled)'));
    const selected = boxes.filter(cb => cb.checked).length;
    const count = document.getElementById('remarkSelectionCount');
    if (count) count.textContent = `${selected} selected`;
    const all = document.getElementById('remarkSelectAll');
    if (all) all.checked = boxes.length > 0 && selected === boxes.length;
}

function toggleRemarkSelectionAll(master) {
    document.querySelectorAll('#remarkSelectionBody .remark-entry-checkbox:not(:disabled)')
        .forEach(cb => cb.checked = !!master.checked);
    updateRemarkSelectionCount();
}

function closeRemarkSelection() {
    const modal = document.getElementById('remarkSelectionModal');
    if (modal) modal.style.display = 'none';
}

function saveRemarkSelection() {
    try {
        const selected = Array.from(
            document.querySelectorAll('#remarkSelectionBody .remark-entry-checkbox:checked')
        );

        if (!selected.length) {
            showModernPopup(
                'Please select the Entries you want to mark as delivery-fee paid.',
                'Remark'
            );
            return;
        }

        const entries = ensureEntryIds(
            JSON.parse(localStorage.getItem('entries') || '[]')
        );
        const remarkEntries = JSON.parse(
            localStorage.getItem('remarkEntries') || '[]'
        );

        const ids = new Set(
            selected.map(cb => String(cb.dataset.entryId))
        );

        const normalize = value =>
            String(value || '').trim().toLowerCase();

        // The Remark button is for today's Preferred selections.
        const today = document.getElementById('date')?.value ||
            new Date().toISOString().slice(0, 10);

        const selectedEntries = entries.filter(entry =>
            ids.has(String(entry.id)) &&
            String(entry.date || '').trim() === today
        );

        if (!selectedEntries.length) {
            showModernPopup(
                'ဒီနေ့အတွက် Preferred Entry မရှိပါ။',
                'Remark'
            );
            return;
        }

        // Duplicate means ONLY the same DATE + Company + Name + Town.
        // Different dates are completely independent.
        const duplicateEntries = selectedEntries.filter(entry => {
            const company = normalize(entry.company);
            const name = normalize(entry.name);
            const town = normalize(entry.town);

            return remarkEntries.some(r =>
                String(r.date || '').trim() === today &&
                normalize(r.company) === company &&
                normalize(r.name) === name &&
                normalize(r.town) === town
            );
        });

        // IMPORTANT:
        // If today's Company + Name + Town has NOT been remarked before,
        // save immediately — no confirmation.
        // Confirmation is shown ONLY for today's duplicate.
        if (duplicateEntries.length) {
            const details = duplicateEntries.map(entry =>
                `${entry.company || ''} / ${entry.name || ''} / ${entry.town || ''} / Qty ${Number(entry.quantity) || 0}`
            ).join('\n');

            const confirmed = window.confirm(
                `⚠️ ဒီနေ့အတွက် Duplicate Remark ဖြစ်နေပါတယ်။\n\n` +
                `${details}\n\n` +
                `ဒီနေ့မှာ အရောက်ပို့ခ Remark လုပ်ပြီးသားပါ။\n` +
                `နောက်ထပ် Save လုပ်မလား?`
            );

            if (!confirmed) {
                return;
            }
        }

        const remarkAt = new Date().toLocaleString();
        let saved = 0;

        selectedEntries.forEach(entry => {
            entry.remarkPaid = true;
            entry.remarkPaidAt = remarkAt;

            remarkEntries.push({
                id: 'remark_' + Date.now().toString(36) + '_' +
                    Math.random().toString(36).slice(2, 8),
                entryId: entry.id,
                date: today,
                company: entry.company || '',
                name: entry.name || '',
                town: entry.town || '',
                quantity: Number(entry.quantity) || 0,
                remarkAt: remarkAt,
                remarkPaidAt: remarkAt
            });

            saved++;
        });

        localStorage.setItem('entries', JSON.stringify(entries));
        localStorage.setItem('remarkEntries', JSON.stringify(remarkEntries));

        if (typeof closeRemarkSelection === 'function') {
            closeRemarkSelection();
        }

        if (typeof loadEntries === 'function') {
            loadEntries();
        }

        showModernPopup(
            `${saved} Entry${saved === 1 ? '' : 'ies'} saved as delivery-fee paid remark.`,
            'Remark Saved'
        );
    } catch (error) {
        console.error('Remark save error:', error);
        showModernPopup('အရောက်ပို့ခ မှတ်သား၍ မရပါ။', 'Error');
    }
}

function toggleSelectAllEntries() {
    const boxes = Array.from(document.querySelectorAll('#entry-list .entry-select:not(:disabled)'));
    if (!boxes.length) {
        alert('There are no pending Entries to select.');
        return;
    }
    const shouldCheck = boxes.some(cb => !cb.checked);
    boxes.forEach(cb => cb.checked = shouldCheck);
}

function updateEntryRemarkCount() {
    const el = document.getElementById('entryRemarkCount');
    if (!el) return;
    const count = document.querySelectorAll('#entry-list .entry-select:checked').length;
    el.textContent = `${count} selected`;
}

// ==================== REMARK VIEWER ====================
// Displays Entries marked as delivery-fee paid by the Remark button.
// Remark is independent from Delivered / Total / Remaining.
function showRemarkViewer(selectedDate) {
    const modal = document.getElementById('remarkViewerModal');
    const body = document.getElementById('remarkViewerBody');
    if (!modal || !body) return;

    try {
        const allRemarks = JSON.parse(localStorage.getItem('remarkEntries') || '[]');
        const dateInput = document.getElementById('remarkViewerDate');

        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().slice(0, 10);
        }

        if (dateInput && selectedDate !== undefined) {
            dateInput.value = selectedDate || '';
        }

        const dateFilter = selectedDate !== undefined
            ? selectedDate
            : (dateInput ? dateInput.value : '');

        body.innerHTML = '';

        const remarks = allRemarks.filter(entry =>
            !dateFilter || String(entry.date || '') === String(dateFilter)
        );

        if (!remarks.length) {
            body.innerHTML =
                '<div class="remark-viewer-empty">📝 ရွေးထားတဲ့ရက်အတွက် အရောက်ပို့ခ မှတ်တမ်း မရှိသေးပါ။</div>';
            modal.style.display = 'flex';
            return;
        }

        // Date -> Name -> Entries
        const dateGroups = {};
        remarks.forEach(entry => {
            const date = entry.date || 'Unknown Date';
            const name = String(entry.name || 'မသိ').trim() || 'မသိ';

            if (!dateGroups[date]) dateGroups[date] = {};
            if (!dateGroups[date][name]) dateGroups[date][name] = {
                totalQuantity: 0,
                entries: []
            };

            dateGroups[date][name].entries.push(entry);
            dateGroups[date][name].totalQuantity += Number(entry.quantity) || 0;
        });

        Object.keys(dateGroups)
            .sort((a, b) => String(b).localeCompare(String(a)))
            .forEach(date => {
                const dateGroup = document.createElement('div');
                dateGroup.className = 'remark-viewer-group';

                const dateTitle = document.createElement('div');
                dateTitle.className = 'remark-viewer-group-title';
                dateTitle.textContent = `📅 ${date}`;
                dateGroup.appendChild(dateTitle);

                const nameSummary = document.createElement('div');
                nameSummary.className = 'remark-name-summary';

                Object.entries(dateGroups[date])
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .forEach(([name, data]) => {
                        const nameCard = document.createElement('div');
                        nameCard.className = 'remark-name-card';

                        const header = document.createElement('div');
                        header.className = 'remark-name-card-header';

                        const nameEl = document.createElement('div');
                        nameEl.className = 'remark-name-card-name';
                        nameEl.textContent = `👤 ${name}`;

                        // Show the delivery-fee paid message beside EVERY Name.
                        const paidEl = document.createElement('span');
                        paidEl.className = 'remark-name-paid';
                        paidEl.textContent = '✅ အရောက်ပို့ခ ရှင်းပြီး';

                        const nameInfo = document.createElement('div');
                        nameInfo.className = 'remark-name-info';
                        nameInfo.appendChild(nameEl);
                        nameInfo.appendChild(paidEl);

                        const qtyEl = document.createElement('div');
                        qtyEl.className = 'remark-name-card-qty';
                        qtyEl.textContent = `📦 Quantity: ${data.totalQuantity}`;

                        header.appendChild(nameInfo);
                        header.appendChild(qtyEl);
                        nameCard.appendChild(header);

                        // Keep details underneath, so existing delete/long-press
                        // functionality remains available for each saved record.
                        data.entries.forEach(entry => {
                            const item = document.createElement('div');
                            item.className = 'remark-viewer-item';

                            const cell = (label, value) => {
                                const el = document.createElement('div');
                                const lab = document.createElement('span');
                                lab.className = 'remark-viewer-label';
                                lab.textContent = label;
                                const val = document.createElement('span');
                                val.className = 'remark-viewer-value';
                                val.textContent = value == null ? '' : String(value);
                                el.appendChild(lab);
                                el.appendChild(val);
                                return el;
                            };

                            item.appendChild(cell('Company', entry.company || ''));
                            item.appendChild(cell('Town', entry.town || ''));
                            item.appendChild(cell('Quantity', Number(entry.quantity) || 0));

                            const del = document.createElement('button');
                            del.type = 'button';
                            del.className = 'remark-delete-btn';
                            del.textContent = '🗑️ Delete';
                            del.addEventListener('click', e => {
                                e.stopPropagation();
                                deleteRemarkViewerEntry(entry);
                            });
                            item.appendChild(del);

                            let timer = null;
                            const startPress = () => {
                                clearTimeout(timer);
                                timer = setTimeout(() => {
                                    item.classList.add('remark-long-pressed');
                                    if (navigator.vibrate) navigator.vibrate(45);
                                }, 650);
                            };
                            const cancelPress = () => clearTimeout(timer);

                            item.addEventListener('pointerdown', startPress);
                            item.addEventListener('pointerup', cancelPress);
                            item.addEventListener('pointercancel', cancelPress);
                            item.addEventListener('pointerleave', cancelPress);
                            item.addEventListener('contextmenu', e => {
                                e.preventDefault();
                                item.classList.add('remark-long-pressed');
                            });

                            nameCard.appendChild(item);
                        });

                        nameSummary.appendChild(nameCard);
                    });

                dateGroup.appendChild(nameSummary);

                const paidStatus = document.createElement('div');
                paidStatus.className = 'remark-paid-status';
                paidStatus.textContent = '✅ အရောက်ပို့ခ ရှင်းပြီး';
                dateGroup.appendChild(paidStatus);

                body.appendChild(dateGroup);
            });

        modal.style.display = 'flex';
    } catch (error) {
        console.error('Remark Viewer error:', error);
        body.innerHTML =
            '<div class="remark-viewer-empty">Remark မှတ်တမ်းကို ဖတ်၍ မရပါ။</div>';
        modal.style.display = 'flex';
    }
}

function filterRemarkViewerByDate(dateValue) {
    const value = dateValue || new Date().toISOString().slice(0, 10);
    showRemarkViewer(value);
}

function deleteRemarkViewerEntry(entryToDelete) {
    try {
        const remarks=JSON.parse(localStorage.getItem('remarkEntries')||'[]');
        const index=remarks.findIndex(r =>
            String(r.date||'')===String(entryToDelete.date||'') &&
            String(r.company||'')===String(entryToDelete.company||'') &&
            String(r.name||'')===String(entryToDelete.name||'') &&
            String(r.town||'')===String(entryToDelete.town||'') &&
            Number(r.quantity||0)===Number(entryToDelete.quantity||0) &&
            String(r.remarkAt||r.remarkPaidAt||'')===
            String(entryToDelete.remarkAt||entryToDelete.remarkPaidAt||'')
        );

        if(index===-1){
            showModernPopup('ဒီ Remark မှတ်တမ်းကို ရှာမတွေ့ပါ။','Delete');
            return;
        }

        if(!confirm(
            'ဒီ Remark မှတ်တမ်းကို ဖျက်မှာ သေချာပါသလား?\n\n' +
            `${entryToDelete.name||''} / ${entryToDelete.town||''} / Qty ${entryToDelete.quantity||0}`
        )) return;

        remarks.splice(index,1);
        localStorage.setItem('remarkEntries',JSON.stringify(remarks));

        const dateInput=document.getElementById('remarkViewerDate');
        showRemarkViewer(dateInput ? dateInput.value : '');
        showModernPopup('Remark မှတ်တမ်းကို ဖျက်ပြီးပါပြီ။','Deleted');
    } catch(error) {
        console.error('Remark delete error:',error);
        showModernPopup('Remark မှတ်တမ်းကို ဖျက်၍ မရပါ။','Error');
    }
}

function closeRemarkViewer() {
    const modal = document.getElementById('remarkViewerModal');
    if (modal) modal.style.display = 'none';
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') closeRemarkViewer();
});

// ✅ Save Entry Function with iPhone notification sound

/* ===== SAVE ENTRY TEXT-TO-SPEECH v44 ===== */
function speakSavedEntry(company, name, town, quantity) {
    const text = name + ", " + town + ", Quantity " + quantity + ", Done.";
    try {
        if (window.AndroidTTS &&
            typeof window.AndroidTTS.speak === "function") {
            window.AndroidTTS.speak(text);
            return;
        }
        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.rate = 0.9;
            u.pitch = 1.0;
            u.volume = 1.0;
            window.speechSynthesis.speak(u);
        }
    } catch (e) {
        console.log("Save TTS error:", e);
    }
}

function saveEntry() {
    let date = document.getElementById("date").value;
    let company = document.getElementById("company").value;
    let name = document.getElementById("name").value;
    let town = document.getElementById("town").value;
    let quantity = document.getElementById("quantity").value;

    if (!date || !company || !name || !town || !quantity) {
        alert("Please fill all fields.");
        return;
    }

    let entries = ensureEntryIds(JSON.parse(localStorage.getItem("entries")) || []);
    const newEntry = {
        id: generateEntryId(),
        date, company, name, town, quantity,
        delivered: false
    };
    entries.push(newEntry);
    localStorage.setItem("entries", JSON.stringify(entries));

    // Smart Save: save Credit / Remark together with the main Entry.
    saveSmartExtrasForEntry(newEntry);

    // 🔊 Read the newly saved Company / Name / Town / Quantity.
    speakSavedEntry(company, name, town, quantity);

    // Reset quantity to 1 after saving
    document.getElementById("quantity").value = "1";

    loadEntries();
    showThumbUp();
    
    // ✅ iPhone notification sound ထည့်မယ်
    playSaveConfirmationSound();
}

// ✅ iPhone notification sound function

function smartEntryMatch(a, b) {
    const norm = v => String(v ?? '').trim().toLowerCase();
    return norm(a?.date) === norm(b?.date) &&
           norm(a?.company) === norm(b?.company) &&
           norm(a?.name) === norm(b?.name) &&
           norm(a?.town) === norm(b?.town) &&
           Number(a?.quantity || 0) === Number(b?.quantity || 0);
}

function saveSmartExtrasForEntry(entry) {
    const credit = document.getElementById('tkoSaveCredit')?.checked === true;
    const remark = document.getElementById('tkoSaveRemark')?.checked === true;
    if (!credit && !remark) return;

    if (credit) {
        try {
            const data = JSON.parse(localStorage.getItem('creditEntries') || '{}');
            if (!Array.isArray(data[entry.town])) data[entry.town] = [];
            data[entry.town].push({
                id: generateUniqueId(), entryId: entry.id,
                date: entry.date, company: entry.company, name: entry.name,
                town: entry.town, quantity: Number(entry.quantity) || 0,
                timestamp: new Date().toISOString()
            });
            localStorage.setItem('creditEntries', JSON.stringify(data));
        } catch (e) { console.error('Smart Credit save error:', e); }
    }

    if (remark) {
        try {
            const data = JSON.parse(localStorage.getItem('remarkEntries') || '[]');
            data.push({
                id: 'remark_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8),
                entryId: entry.id,
                date: entry.date, company: entry.company, name: entry.name,
                town: entry.town, quantity: Number(entry.quantity) || 0,
                remarkAt: new Date().toLocaleString(),
                remarkPaidAt: new Date().toLocaleString()
            });
            localStorage.setItem('remarkEntries', JSON.stringify(data));
            const entries = ensureEntryIds(JSON.parse(localStorage.getItem('entries') || '[]'));
            const target = entries.find(e => String(e.id) === String(entry.id));
            if (target) {
                target.remarkPaid = true;
                target.remarkPaidAt = new Date().toLocaleString();
                localStorage.setItem('entries', JSON.stringify(entries));
            }
        } catch (e) { console.error('Smart Remark save error:', e); }
    }

    // A Save click consumes the options so Remark/Credit are hidden again.
    const c = document.getElementById('tkoSaveCredit');
    const r = document.getElementById('tkoSaveRemark');
    if (c) c.checked = false;
    if (r) r.checked = false;
    refreshOpenSmartViews();
}

function removeSmartExtrasForEntry(entry) {
    if (!entry) return;
    try {
        const data = JSON.parse(localStorage.getItem('creditEntries') || '{}');
        Object.keys(data).forEach(town => {
            if (!Array.isArray(data[town])) return;
            data[town] = data[town].filter(x => !(x.entryId && String(x.entryId) === String(entry.id)));
            if (!data[town].length) delete data[town];
        });
        localStorage.setItem('creditEntries', JSON.stringify(data));
    } catch (e) { console.error('Smart Credit delete sync error:', e); }
    try {
        const data = JSON.parse(localStorage.getItem('remarkEntries') || '[]');
        const kept = data.filter(x => !(x.entryId && String(x.entryId) === String(entry.id)));
        localStorage.setItem('remarkEntries', JSON.stringify(kept));
    } catch (e) { console.error('Smart Remark delete sync error:', e); }
}

function refreshOpenSmartViews() {
    // Refresh only views that are already open. Do not open a popup as a side effect of Save/Edit.
    try {
        const creditModal = document.getElementById('creditModal');
        const creditVisible = creditModal && getComputedStyle(creditModal).display !== 'none';
        if (creditVisible && typeof showCreditList === 'function') {
            const activeTown = document.querySelector('.credit-tab.active')?.textContent?.replace(/\(\d+\)/,'').trim();
            const data = JSON.parse(localStorage.getItem('creditEntries') || '{}');
            populateCreditList(data);
            if (activeTown && data[activeTown]) {
                const tabs = Array.from(document.querySelectorAll('.credit-tab'));
                const tab = tabs.find(t => t.textContent.replace(/\(\d+\)/,'').trim() === activeTown);
                if (tab) switchCreditTab(activeTown, tab);
            }
        }
    } catch (e) { console.warn('Credit view refresh:', e); }
    try {
        const viewer = document.getElementById('remarkViewerModal');
        const viewerVisible = viewer && getComputedStyle(viewer).display !== 'none';
        if (viewerVisible && typeof showRemarkViewer === 'function') {
            const d = document.getElementById('remarkViewerDate')?.value || document.getElementById('date')?.value || '';
            showRemarkViewer(d);
        }
    } catch (e) { console.warn('Remark viewer refresh:', e); }
}

function openEntryEdit(entryId) {
    const entries = ensureEntryIds(JSON.parse(localStorage.getItem('entries') || '[]'));
    const entry = entries.find(e => String(e.id) === String(entryId));
    if (!entry) return;

    let credit = false, remark = false;
    try {
        const data = JSON.parse(localStorage.getItem('creditEntries') || '{}');
        Object.values(data).forEach(list => (Array.isArray(list) ? list : []).forEach(x => {
            if ((x.entryId && String(x.entryId) === String(entry.id)) || (!x.entryId && smartEntryMatch(x, entry))) credit = true;
        }));
    } catch(e) {}
    try {
        const data = JSON.parse(localStorage.getItem('remarkEntries') || '[]');
        remark = data.some(x => (x.entryId && String(x.entryId) === String(entry.id)) || (!x.entryId && smartEntryMatch(x, entry)));
    } catch(e) {}

    const old = document.getElementById('tkoEntryEditModal'); if (old) old.remove();
    const modal = document.createElement('div');
    modal.id = 'tkoEntryEditModal'; modal.className = 'tko-entry-edit-modal';
    modal.innerHTML = `
      <div class="tko-entry-edit-box">
        <h3>✏️ Edit Entry</h3>
        <label>Date</label><input id="tkoEditDate" class="tko-edit-field" type="date" value="${escapeHtmlSimple(entry.date || '')}">
        <label>Company</label><input id="tkoEditCompany" class="tko-edit-field" value="${escapeHtmlSimple(entry.company || '')}">
        <label>Name</label><input id="tkoEditName" class="tko-edit-field" value="${escapeHtmlSimple(entry.name || '')}">
        <label>Town</label><input id="tkoEditTown" class="tko-edit-field" value="${escapeHtmlSimple(entry.town || '')}">
        <label>Quantity</label><input id="tkoEditQuantity" class="tko-edit-field" type="number" min="1" value="${Number(entry.quantity)||1}">
        <div class="tko-edit-checks">
          <label><input type="checkbox" id="tkoEditCredit" ${credit ? 'checked' : ''}> 💳 Credit</label>
          <label><input type="checkbox" id="tkoEditRemark" ${remark ? 'checked' : ''}> 📝 Remark</label>
        </div>
        <div class="tko-edit-actions">
          <button type="button" id="tkoEditSave" style="background:#198754;color:#fff">Save</button>
          <button type="button" id="tkoEditDelete" style="background:#dc3545;color:#fff">Delete</button>
          <button type="button" id="tkoEditClose" style="background:#6c757d;color:#fff">Close</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelector('#tkoEditClose').onclick = () => modal.remove();
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#tkoEditDelete').onclick = () => { modal.remove(); deleteEntryById(entry.id); };

    modal.querySelector('#tkoEditSave').onclick = () => {
        const updated = {
            ...entry,
            date: document.getElementById('tkoEditDate').value,
            company: document.getElementById('tkoEditCompany').value.trim(),
            name: document.getElementById('tkoEditName').value.trim(),
            town: document.getElementById('tkoEditTown').value.trim(),
            quantity: document.getElementById('tkoEditQuantity').value
        };
        if (!updated.date || !updated.company || !updated.name || !updated.town || Number(updated.quantity) < 1) return;
        syncEditedEntryExtras(entry, updated,
            document.getElementById('tkoEditCredit').checked,
            document.getElementById('tkoEditRemark').checked
        );
        const idx = entries.findIndex(e => String(e.id) === String(entry.id));
        if (idx >= 0) entries[idx] = updated;
        localStorage.setItem('entries', JSON.stringify(entries));
        modal.remove();
        loadEntries();
        refreshOpenSmartViews();
    };
}

function syncEditedEntryExtras(oldEntry, newEntry, wantCredit, wantRemark) {
    try {
        const data = JSON.parse(localStorage.getItem('creditEntries') || '{}');
        Object.keys(data).forEach(town => {
            if (!Array.isArray(data[town])) return;
            data[town].forEach(x => {
                if ((x.entryId && String(x.entryId) === String(oldEntry.id)) || (!x.entryId && smartEntryMatch(x, oldEntry))) {
                    x.entryId = oldEntry.id;
                    x.date = newEntry.date; x.company = newEntry.company; x.name = newEntry.name; x.town = newEntry.town; x.quantity = Number(newEntry.quantity) || 0;
                }
            });
            data[town] = data[town].filter(x => !(x.entryId === oldEntry.id) || wantCredit);
            if (!data[town].length) delete data[town];
        });
        if (wantCredit && !Object.values(data).some(list => (Array.isArray(list) ? list : []).some(x => String(x.entryId || '') === String(oldEntry.id)))) {
            if (!Array.isArray(data[newEntry.town])) data[newEntry.town] = [];
            data[newEntry.town].push({id:generateUniqueId(),entryId:oldEntry.id,date:newEntry.date,company:newEntry.company,name:newEntry.name,town:newEntry.town,quantity:Number(newEntry.quantity)||0,timestamp:new Date().toISOString()});
        }
        localStorage.setItem('creditEntries', JSON.stringify(data));
    } catch(e) { console.error('Edit Credit sync:',e); }

    try {
        let data = JSON.parse(localStorage.getItem('remarkEntries') || '[]');
        let found = false;
        data.forEach(x => {
            if ((x.entryId && String(x.entryId) === String(oldEntry.id)) || (!x.entryId && smartEntryMatch(x, oldEntry))) {
                x.entryId = oldEntry.id;
                if (wantRemark) {
                    x.date=newEntry.date; x.company=newEntry.company; x.name=newEntry.name; x.town=newEntry.town; x.quantity=Number(newEntry.quantity)||0; found=true;
                }
            }
        });
        data = data.filter(x => !(x.entryId === oldEntry.id) || wantRemark);
        if (wantRemark && !found) data.push({id:'remark_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),entryId:oldEntry.id,date:newEntry.date,company:newEntry.company,name:newEntry.name,town:newEntry.town,quantity:Number(newEntry.quantity)||0,remarkAt:new Date().toLocaleString(),remarkPaidAt:new Date().toLocaleString()});
        localStorage.setItem('remarkEntries', JSON.stringify(data));
        newEntry.remarkPaid = wantRemark;
        if (wantRemark) newEntry.remarkPaidAt = new Date().toLocaleString(); else delete newEntry.remarkPaidAt;
    } catch(e) { console.error('Edit Remark sync:',e); }
}

// Name-only click: scrolling or touching the row itself never opens Edit.
document.addEventListener('click', function(e) {
    const nameLink = e.target.closest?.('.tko-entry-name-link');
    if (!nameLink) return;
    e.preventDefault();
    e.stopPropagation();
    openEntryEdit(nameLink.dataset.entryId);
}, true);

function loadEntries() {
    const selectedDate = document.getElementById("date")?.value || "";
    const tableBody = document.getElementById("entry-list");
    if (!tableBody) return;

    tableBody.innerHTML = "";
    const entries = ensureEntryIds(JSON.parse(localStorage.getItem("entries") || "[]"));
    const filteredEntries = entries.filter(entry => entry.date === selectedDate);

    filteredEntries.forEach(entry => {
        const row = tableBody.insertRow();
        const safeId = String(entry.id).replace(/'/g, "&#39;");
        row.innerHTML = `
            <td>${entry.company || ''}</td>
            <td><span class="tko-entry-name-link" data-entry-id="${safeId}">${escapeHtmlSimple(entry.name || '')}</span></td>
            <td>${entry.town || ''}</td>
            <td>${entry.quantity || 0}</td>
        `;
        row.dataset.entryId = String(entry.id);
        row.style.cursor = 'default';
    });

    calculateTotalQuantity(filteredEntries);
    updateTodayAtAGlance(filteredEntries);
}

// ===== Today at a Glance =====
// Shows only Town, today's total quantity, and quantity marked by Remark.
function updateTodayAtAGlance(filteredEntries) {
    const body = document.getElementById('today-glance-body');
    if (!body) return;

    const selectedDate = document.getElementById('date')?.value || '';
    const towns = {};

    (filteredEntries || []).forEach(entry => {
        const town = String(entry.town || 'Unknown').trim() || 'Unknown';
        if (!towns[town]) towns[town] = { total: 0, remark: 0 };
        towns[town].total += Number(entry.quantity) || 0;
    });

    let remarkEntries = [];
    try {
        const raw = JSON.parse(localStorage.getItem('remarkEntries') || '[]');
        remarkEntries = Array.isArray(raw) ? raw : [];
    } catch (e) {
        remarkEntries = [];
    }

    remarkEntries
        .filter(r => !selectedDate || String(r.date || '') === String(selectedDate))
        .forEach(r => {
            const town = String(r.town || 'Unknown').trim() || 'Unknown';
            if (!towns[town]) towns[town] = { total: 0, remark: 0 };
            towns[town].remark += Number(r.quantity) || 0;
        });

    body.innerHTML = '';

    const townNames = Object.keys(towns).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
    );

    if (!townNames.length) {
        body.innerHTML = `
            <tr>
                <td colspan="3" style="padding:10px 6px;text-align:center;color:#777;font-weight:600;">No entries</td>
            </tr>`;
        return;
    }

    townNames.forEach(town => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding:7px 6px;border-bottom:1px solid #eee;font-weight:700;color:#374151;">${escapeHtmlSimple(town)}</td>
            <td style="padding:7px 6px;border-bottom:1px solid #eee;text-align:center;font-weight:800;color:#dc2626;">${towns[town].total}</td>
            <td style="padding:7px 6px;border-bottom:1px solid #eee;text-align:center;font-weight:800;color:#8e44ad;">${towns[town].remark}</td>
        `;
        body.appendChild(row);
    });
}

function deleteEntryById(entryId) {
    let entries = ensureEntryIds(JSON.parse(localStorage.getItem("entries")) || []);
    const index = entries.findIndex(e => String(e.id) === String(entryId));
    if (index === -1) return;
    if (!confirm('Are you sure you want to delete this entry?')) return;
    const deletedEntry = entries[index];
    entries.splice(index, 1);
    localStorage.setItem("entries", JSON.stringify(entries));
    removeSmartExtrasForEntry(deletedEntry);
    loadEntries();
    refreshOpenSmartViews();
}

function deleteEntry(index) {
    const selectedDate = document.getElementById("date").value;
    const entries = ensureEntryIds(JSON.parse(localStorage.getItem("entries")) || []);
    const filtered = entries.filter(e => e.date === selectedDate);
    if (!filtered[index]) return;
    deleteEntryById(filtered[index].id);
}

function calculateTotalQuantity(filteredEntries, groupsToOpen = new Set()) {
    const totalDiv = document.getElementById("total-quantity");
    if (!totalDiv) return;

    totalDiv.innerHTML = "";
    if (!filteredEntries || filteredEntries.length === 0) {
        totalDiv.innerHTML = "<p style='color:red;font-weight:bold;'>No entries found for selected date.</p>";
        return;
    }

    const townGroups = {};
    filteredEntries.forEach(entry => {
        const town = entry.town || "Unknown";
        if (!townGroups[town]) townGroups[town] = [];
        townGroups[town].push(entry);
    });

    Object.keys(townGroups).forEach(town => {
        const townEntries = townGroups[town];
        const townTotal = townEntries.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
        const townDelivered = townEntries.reduce((sum, e) => {
            return sum + (e.delivered === true ? (Number(e.quantity) || 0) : 0);
        }, 0);
        const townRemaining = townTotal - townDelivered;
        const townId = town.replace(/[^a-zA-Z0-9_-]/g, '-');

        const townContainer = document.createElement('div');
        townContainer.className = 'town-container';
        townContainer.style.cssText = 'border:2px solid #d42aa6;border-radius:12px;padding:14px;margin-bottom:18px;background:#eef8ff;box-shadow:0 3px 10px rgba(0,0,0,.12);';

        const townHeader = document.createElement('div');
        townHeader.style.cssText = 'font-size:20px;font-weight:800;padding:8px 10px 12px;color:#5d4037;';
        townHeader.innerHTML = `🏙️ <span style="color:#8e44ad">${escapeHtmlSimple(town)}</span> <span style="color:#5d4037">-</span> <span style="color:#5d4037">${townTotal}</span> <span style="color:#e7b83b">|</span> <span id="delivered-${townId}" style="color:#2e7d32">${townDelivered}</span> <span style="color:#e7b83b">|</span> <span id="remaining-${townId}" style="color:#d84315">${townRemaining}</span>`;
        townContainer.appendChild(townHeader);

        const nameGroups = {};
        townEntries.forEach(entry => {
            const name = entry.name || 'Unknown';
            if (!nameGroups[name]) nameGroups[name] = [];
            nameGroups[name].push(entry);
        });

        Object.keys(nameGroups).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })).forEach(name => {
            const nameEntries = nameGroups[name];
            const nameTotal = nameEntries.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
            const deliveredEntries = nameEntries.filter(e => e.delivered === true);
            const nameDelivered = deliveredEntries.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
            const nameRemaining = nameTotal - nameDelivered;
            const allDelivered = nameEntries.length > 0 && nameDelivered === nameTotal;

            const wrapper = document.createElement('div');
            wrapper.style.marginBottom = '8px';

            // Stable key for this Town + Name group. It lets a Delivered tick
            // rebuild the totals without losing which arrow was opened.
            const groupKey = `${town}\u0000${name}`;

            const nameBox = document.createElement('div');
            nameBox.className = 'name-town-box' + (allDelivered ? ' completed' : '');
            nameBox.dataset.groupKey = groupKey;
            nameBox.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:9px;border:2px solid ${allDelivered ? '#9c27b0' : '#00a6b2'};background:${allDelivered ? '#c8c8c8' : '#eeeeee'};cursor:default;min-height:44px;box-sizing:border-box;`;

            const nameText = document.createElement('div');
            nameText.id = `name-remaining-${town.replace(/\s+/g,'-')}-${name.replace(/\s+/g,'-')}`;
            nameText.style.cssText = 'font-size:18px;font-weight:800;flex:1;line-height:1.25;';
            // Name = dark blue with a subtle 3D effect. Quantity = red for clear visibility.
            nameText.innerHTML = `<span class="town-wise-name-3d">${escapeHtmlSimple(name)}</span> <span class="town-wise-qty-red">- ${nameTotal}</span>${allDelivered ? '' : ` <span class="town-wise-remaining-label" style="color:#4b5563 !important;-webkit-text-fill-color:#4b5563 !important;font-weight:800;font-size:16px;">(Remaining: </span><span class="town-wise-remaining-qty" style="color:#dc2626 !important;-webkit-text-fill-color:#dc2626 !important;font-weight:900;font-size:16px;">${nameRemaining}</span><span class="town-wise-remaining-label" style="color:#4b5563 !important;-webkit-text-fill-color:#4b5563 !important;font-weight:800;font-size:16px;">)</span>`}`;
            nameBox.appendChild(nameText);

            if (allDelivered) {
                const done = document.createElement('span');
                done.textContent = '☑️  Done';
                done.style.cssText = 'color:#3035d9;font-size:18px;font-weight:800;margin-left:12px;white-space:nowrap;';
                nameBox.appendChild(done);
            }

            // The red arrow is ALWAYS present. Only the arrow controls
            // expand/collapse; clicking Delivered never closes the box.
            const arrow = document.createElement('span');
            arrow.className = 'name-arrow';
            arrow.textContent = groupsToOpen.has(groupKey) ? '▲' : '▼';
            arrow.setAttribute('role', 'button');
            arrow.setAttribute('aria-label', 'Expand or collapse details');
            arrow.style.cssText = 'color:#e51c3b;font-size:21px;font-weight:900;margin-left:12px;cursor:pointer;min-width:28px;text-align:center;user-select:none;';
            nameBox.appendChild(arrow);

            const details = document.createElement('div');
            details.style.cssText = 'display:none;background:#fff;border:1px solid #ddd;border-radius:8px;padding:8px 12px;margin-top:6px;';

            nameEntries.forEach(entry => {
                const timestamp = entry.delivered === true ? (entry.deliveredAt || '') : '';
                const companyRow = document.createElement('div');
                companyRow.style.cssText = 'display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid #eee;min-height:40px;';

                const companyText = document.createElement('span');
                companyText.style.cssText = 'color:#1026b7;font-size:18px;font-weight:800;flex:1;';
                companyText.textContent = `${entry.company || ''} - ${Number(entry.quantity) || 0}`;
                companyRow.appendChild(companyText);

                const check = document.createElement('input');
                check.type = 'checkbox';
                check.className = 'delivered-checkbox';
                check.checked = !!timestamp;
                check.style.cssText = 'width:24px;height:24px;accent-color:#1976d2;cursor:pointer;flex:0 0 auto;';
                check.addEventListener('click', ev => ev.stopPropagation());
                check.addEventListener('change', function(ev) {
                    ev.stopPropagation();
                    saveCompanyDeliveryStatus(entry.id, this);
                });
                companyRow.appendChild(check);

                if (timestamp) {
                    const time = document.createElement('span');
                    time.style.cssText = 'color:#777;font-style:italic;font-size:14px;white-space:nowrap;';
                    time.textContent = `(Delivered: ${timestamp})`;
                    companyRow.appendChild(time);
                }

                details.appendChild(companyRow);
            });

            // Only the red arrow opens/closes the details.
            // Delivered checkbox clicks are stopped separately above.
            arrow.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const open = details.style.display === 'block';
                details.style.display = open ? 'none' : 'block';
                arrow.textContent = open ? '▼' : '▲';
            });

            // Restore the exact open/closed state after a totals rebuild.
            if (groupsToOpen.has(groupKey)) {
                details.style.display = 'block';
            }

            wrapper.appendChild(nameBox);
            wrapper.appendChild(details);
            townContainer.appendChild(wrapper);
        });

        totalDiv.appendChild(townContainer);
    });
}

function escapeHtmlSimple(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[ch] || ch));
}


// ✅ CSS style ထည့်ပေးဖို့ function တစ်ခုလုပ်ပါ
function addCompletedStyles() {
    if (!document.getElementById('completed-styles')) {
        const style = document.createElement('style');
        style.id = 'completed-styles';
        style.innerHTML = `
            .name-town-box.completed {
                background-color: #827983ff !important;
                border: 2px solid #9c27b0 !important;
                opacity: 0.8;
                transition: all 0.3s ease;
            }
            
            .name-town-box.completed:hover {
                background-color: #827983ff !important;
                transform: scale(1.02);
            }
        `;
        document.head.appendChild(style);
    }
}

// ✅ DOM loaded မှာ CSS ထည့်ပေးပါ
document.addEventListener("DOMContentLoaded", function() {
    addCompletedStyles();
    
    // ✅ Load တစ်ချိန်လည်း completed item တွေကို style ပြန်ထည့်ပေးပါ
    setTimeout(() => {
        document.querySelectorAll('.name-town-box').forEach(box => {
            const checkboxes = box.querySelectorAll('.delivered-checkbox');
            const allChecked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
            
            if (allChecked) {
                box.classList.add('completed');
                box.style.backgroundColor = "#827983ff";
                box.style.border = "2px solid #d5ac32ff";
                box.style.opacity = "0.8";
            }
        });
    }, 100);
});																				
																							
// Helper function to update name remaining quantity without refreshing the entire page																							
function updateNameRemaining(nameTownBox, name, totalQuantity, town, selectedDate) {
    // Calculate delivered quantity for this name
    let nameDelivered = 0;
    let allChecked = true;

    // Get all entries for this name in this town
    let entries = JSON.parse(localStorage.getItem("entries")) || [];
    let filteredEntries = entries.filter(entry =>
        entry.date === selectedDate &&
        entry.town === town &&
        entry.name === name
    );

    filteredEntries.forEach(entry => {
        if (entry.delivered === true) {
            nameDelivered += Number(entry.quantity) || 0;
        } else {
            allChecked = false;
        }
    });

    let nameRemaining = totalQuantity - nameDelivered;

    // Update the name town box text
    let nameTownText = nameTownBox.querySelector("span:first-child");

    if (nameRemaining === 0) {
        nameTownText.innerHTML = `
        <span style="color:black; font-weight:bold;">${name}</span> -
        <span style="color:red; font-weight:bold;">${totalQuantity}</span>
        <span style="color:green; font-weight:bold; margin-left: 5px;">✅</span>
        `;
    } else {
        // ✅ ALWAYS show remaining quantity in RED BOLD
        nameTownText.innerHTML = `
        <span style="color:black; font-weight:bold;">${name}</span> -
        <span style="color:red; font-weight:bold;">${totalQuantity}</span>
         <span class="town-wise-remaining-label" style="color:#4b5563 !important;-webkit-text-fill-color:#4b5563 !important;font-weight:900;">(Remaining: </span><span class="town-wise-remaining-qty" style="color:#dc2626 !important;-webkit-text-fill-color:#dc2626 !important;font-weight:900;">${nameRemaining}</span><span class="town-wise-remaining-label" style="color:#4b5563 !important;-webkit-text-fill-color:#4b5563 !important;font-weight:900;">)</span>
        `;
    }

    // Update the background color based on check status
    if (allChecked) {
        nameTownBox.style.backgroundColor = "#a0bdc0ff"; // Light green
        nameTownBox.classList.add('completed');
    } else {
        nameTownBox.style.backgroundColor = "#a0bdc0ff";
        nameTownBox.classList.remove('completed');
    }
}																						
																							
// Update the background color based on check status																							
if (allChecked) {																							
nameTownBox.style.backgroundColor = "#a0bdc0ff"; // Light green																							
nameTownBox.classList.add('completed');																							
} else {																							
nameTownBox.style.backgroundColor = "#a0bdc0ff";																							
nameTownBox.classList.remove('completed');																							
}																							
																						
																							
// Helper function to update town delivered total display with remaining calculation																							
function updateTownDeliveredTotal(town, deliveredTotal, townTotal) {																							
const deliveredElement = document.getElementById(`delivered-${town.replace(/\s+/g, '-')}`);																							
const remainingElement = document.getElementById(`remaining-${town.replace(/\s+/g, '-')}`);																							
																							
if (deliveredElement && remainingElement) {																							
deliveredElement.textContent = deliveredTotal;																							
remainingElement.textContent = townTotal - deliveredTotal;																							
}																							
}																							
																																														
																									
/* ✅ Preferred Name Add & Load */
function addPreferred(type) {
    let inputId = `new-${type}`;
    let selectId = `${type}`;
    let value = document.getElementById(inputId).value.trim();

    if (!value) return;
    
    let preferredNames = JSON.parse(localStorage.getItem(type)) || [];
    if (!preferredNames.includes(value)) {
        preferredNames.push(value);
        localStorage.setItem(type, JSON.stringify(preferredNames));
        loadPreferredNames();
    } else {
        alert(`${type} already exists!`);
    }

    document.getElementById(inputId).value = "";
}

/* ✅ Preferred Name Add & Load - Modified with Dark Background & Bold White Text */

// ✅ STEP 2: Paste preferred data ကို normalize + duplicate remove
function normalizePreferredData(input) {

  let preferred = {
    company: [],
    name: [],
    town: []
  };

  // Case 1: Array only ( ["AA","BB"] )
  if (Array.isArray(input)) {
    preferred.company = [...new Set(input.filter(Boolean))];
    return preferred;
  }

  // Case 2: Object
  if (typeof input === "object" && input !== null) {

    // If wrapped inside preferred
    if (input.preferred) {
      input = input.preferred;
    }

    if (Array.isArray(input.company)) {
      preferred.company = [...new Set(input.company.filter(Boolean))];
    }

    if (Array.isArray(input.name)) {
      preferred.name = [...new Set(input.name.filter(Boolean))];
    }

    if (Array.isArray(input.town)) {
      preferred.town = [...new Set(input.town.filter(Boolean))];
    }
  }

  return preferred;
}
// ✅ STEP 3: Preferred names restore (NO duplicate)
function restorePreferredAnyFormat(data) {

  const preferred = data.preferred || {
    company: [],
    name: [],
    town: []
  };

  ["company", "name", "town"].forEach(type => {

    let current = JSON.parse(localStorage.getItem(type) || "[]");

    let incoming = Array.isArray(preferred[type]) 
      ? preferred[type] 
      : [];

    // Merge + remove duplicate
    let merged = [...new Set([...current, ...incoming])];

    localStorage.setItem(type, JSON.stringify(merged));
  });
}


/* ✅ 🔄 Refresh Function */



document.querySelectorAll('.check-container').forEach(container => {
    const checkbox = container.querySelector('input[type="checkbox"]');
    const label = container.querySelector('.name-town-quantity');

    if (checkbox && label) {
        container.appendChild(checkbox); // Checkbox ကို Name နောက်ဆုံးထည့်မယ်
    }
});
document.addEventListener("DOMContentLoaded", function () {
    loadEntries();
    loadPreferredNames();
    document.getElementById("date").valueAsDate = new Date();
    document.getElementById("date").addEventListener("change", loadEntries);
});
																
// ✅ Town Wise ကို နှိပ်လိုက်ရင် Town Wise Section ကို ပြမယ်

    // Separate delivered and pending items
    const deliveredItems = [];
    const pendingItems = [];
    
    Object.keys(nameGroups).forEach(name => {
        const group = nameGroups[name];
        const isFullyDelivered = group.entries.every(entry => {
            return localStorage.getItem(`delivered-${entry.entryKey}`);
        });

        if (isFullyDelivered) {
            deliveredItems.push({
                name: name,
                town: group.town,
                quantity: group.total
            });
        } else {
            pendingItems.push({
                name: name,
                town: group.town,
                quantity: group.total,
                entries: group.entries
            });
        }
    });

    // Calculate town totals
    const townTotal = pendingItems.reduce((sum, item) => sum + item.quantity, 0) + 
                     deliveredItems.reduce((sum, item) => sum + item.quantity, 0);
    const deliveredTotal = deliveredItems.reduce((sum, item) => sum + item.quantity, 0);

    // Create HTML content
    let html = `
    <div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #333;">
            ${town} - Total: <span style="color: red; font-weight: bold;">${townTotal}</span>
            (Delivered: <span style="color: green;">${deliveredTotal}</span> | 
            Pending: <span style="color: red;">${townTotal - deliveredTotal}</span>)
        </h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div>
                <h4 style="color: green; margin-bottom: 10px;">Delivered</h4>
                <div style="background: #f0fff0; padding: 10px; border-radius: 5px;">
                    ${deliveredItems.length > 0 ? 
                       deliveredItems.map(item => `
                           <div style="margin-bottom: 5px; padding: 8px; background: #e8f5e9; border-radius: 4px; border-left: 4px solid #2e7d32;">
                               ✔ ${item.name} - <span style="color: red; font-weight: bold;">${item.quantity}</span>
                           </div>
                       `).join('') : 
                       '<div style="color: #999;">No delivered items</div>'}
                </div>
            </div>
            
            <div>
                <h4 style="color: red; margin-bottom: 10px;">Pending</h4>
                <div style="background: #fff0f0; padding: 10px; border-radius: 5px;">
                    ${pendingItems.length > 0 ? 
                       pendingItems.map(item => `
                           <div style="margin-bottom: 10px; padding: 10px; background: #ffebee; border-radius: 6px; border-left: 4px solid #c62828;">
                               <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                   <span style="font-weight: bold;">${item.name}</span>
                                   <span style="color: red; font-weight: bold;">${item.quantity}</span>
                               </div>
                               <div style="display: flex; align-items: center;">
                                   <input type="checkbox" 
                                          style="margin-right: 8px; width: 16px; height: 16px;" 
                                          onchange="markGroupAsDelivered(event, '${town}', '${date}', ${JSON.stringify(item.entries.map(e => e.entryKey))})">
                                   <span style="font-size: 14px; color: #666;">Mark as delivered</span>
                               </div>
                           </div>
                       `).join('') : 
                       '<div style="color: #999;">No pending items</div>'}
                </div>
            </div>
        </div>
    </div>
    `;

    townContentDiv.innerHTML = html;
    



// ✅ New Company Button Function
function addNewCompany() {
    let companyName = prompt("Enter New Company Name:");
    if (companyName) {
        // ✅ Local Storage ထဲမှာ သိမ်းမယ်
        localStorage.setItem("lastCompany", companyName);

        alert("New Company Added: " + companyName);
    }
}

// ✅ Popup ပြ Function



// ✅ Notes ကို နှိပ်လိုက်ရင် Notes Box ကို ပြမယ်
function showNotes() {
    let notesBox = document.getElementById("notes");
    if (notesBox) {
        notesBox.scrollIntoView({ behavior: "smooth" });
    } else {
        alert("Notes Box Not Found!");
    }
}

// ✅ Shield Box ကို ဖွင့်မယ်


// ✅ Shield Box ကို ပိတ်မယ်


// ✅ Update Company Display Function
// Function to ensure company view text is visible
function fixCompanyViewText() {
    const companyContent = document.getElementById('companyContentView');
    if (companyContent) {
        // Force visible styles
        companyContent.style.color = '#2d3436';
        companyContent.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
        
        // Find all text elements and make them visible
        const textElements = companyContent.querySelectorAll('*');
        textElements.forEach(el => {
            el.style.color = '#2d3436';
            el.style.opacity = '1';
            el.style.visibility = 'visible';
        });
    }
}

// Call this when opening company view



// Also call when company data changes
function refreshCompanyView() {
    // Your existing refresh code...
    
    setTimeout(fixCompanyViewText, 100);
}
// ✅ Modified Open Shield Function
function openShield(title, content, showNav = false) {
    const shieldBox = document.getElementById("shield-box");
    const shieldTitle = document.getElementById("shield-title");
    const shieldBody = document.getElementById("shield-body");
    const navButtons = document.querySelector(".company-navigation");
    
    shieldTitle.textContent = title;
    shieldBody.innerHTML = content;
    
    // Show/hide navigation buttons
    navButtons.style.display = showNav && companyList.length > 1 ? "flex" : "none";
    
    shieldBox.style.display = "flex";
}

// ✅ Close Shield Function
function closeShield() {
    document.getElementById("shield-box").style.display = "none";
}

function filterByTown(name) {
    let selectedTown = document.getElementById("town-filter").value;
    let selectedDate = document.getElementById("date").value;
    let entries = JSON.parse(localStorage.getItem("entries")) || [];

    let filteredEntries = entries.filter(entry => 
        entry.name.trim() === name && entry.date === selectedDate
    );

    if (selectedTown !== "all") {
        filteredEntries = filteredEntries.filter(entry => entry.town === selectedTown);
    }

    let totalQuantity = filteredEntries.reduce((sum, entry) => sum + parseInt(entry.quantity), 0);
    
    let totalQuantityElement = document.querySelector("#total-quantity");
    if (totalQuantityElement) {
        totalQuantityElement.innerText = totalQuantity;
    }

    let resultHTML = `<ul>`;
    filteredEntries.forEach(entry => {
        resultHTML += `<li>${entry.company} | ${entry.town} | ${entry.quantity}</li>`;
    });
    resultHTML += `</ul>`;

    document.getElementById("filtered-results").innerHTML = resultHTML;
}

function showPopup(content) {
    let popup = document.createElement("div");
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.background = "white";
    popup.style.padding = "20px";
    popup.style.border = "2px solid black";
    popup.style.boxShadow = "0px 0px 10px rgba(0,0,0,0.3)";
    popup.style.zIndex = "1000";
    popup.style.textAlign = "center";

    popup.innerHTML = content + `<br><br><button onclick="closePopup()">Close</button>`;

    document.body.appendChild(popup);
}

function closePopup() {
    document.body.removeChild(document.body.lastChild);
}
// ✅ Notes Popup ပြရန်
function showNotesPopup() {
    let selectedDate = document.getElementById("date").value;
    let notes = localStorage.getItem("notes_" + selectedDate) || "";
    document.getElementById("popup-notes").value = notes;
    document.getElementById("notes-popup").style.display = "flex";
}

// ✅ Notes Popup ပိတ်ရန်
function closeNotesPopup() {
    document.getElementById("notes-popup").style.display = "none";
}

// ✅ Notes ကို သိမ်းရန်
function saveNotes() {
    let selectedDate = document.getElementById("date").value;
    let notes = document.getElementById("popup-notes").value;
    localStorage.setItem("notes_" + selectedDate, notes);
    alert("Notes saved successfully!");
    closeNotesPopup();
}

// ✅ Date ပြောင်းတိုင်း Notes ကို ပြန်တင်ရန်
document.getElementById("date").addEventListener("change", function() {
    let selectedDate = document.getElementById("date").value;
    let notes = localStorage.getItem("notes_" + selectedDate) || "";
    document.getElementById("popup-notes").value = notes;
});
// ✅ Menu Dropdown Toggle Function

/* ===== RESTORED WORKING CREDIT/LIST FROM EARLIER VERSION ===== */
function saveCreditEntry() {
    try {
        const company = document.getElementById('company').value;
        const name = document.getElementById('name').value;
        const town = document.getElementById('town').value;
        const quantity = document.getElementById('quantity').value;
        
        if (!company || !name || !town || !quantity) {
            showModernPopup("Please fill in all fields before saving credit entry", "Error");
            return;
        }
        
        // Create credit entry with unique ID
        const creditEntry = {
            id: generateUniqueId(),
            company,
            name,
            town,
            quantity: parseInt(quantity),
            date: new Date().toISOString().split('T')[0],
            timestamp: new Date().toISOString()
        };
        
        // Save to localStorage
        const creditData = JSON.parse(localStorage.getItem('creditEntries') || '{}');
        if (!creditData[town]) {
            creditData[town] = [];
        }
        
        creditData[town].push(creditEntry);
        localStorage.setItem('creditEntries', JSON.stringify(creditData));
        
        // Show success message
        showModernPopup(`Credit entry saved for ${company} in ${town}`, "Credit Saved");
        
        // Clear form
        document.getElementById('quantity').value = '1';
        
    } catch (error) {
        console.error('Error saving credit entry:', error);
        showModernPopup("Error saving credit entry", "Error");
    }
}

function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function showCreditList() {
    try {
        const creditData = JSON.parse(localStorage.getItem('creditEntries') || '{}');
        
        // Remove existing modal if any
        const existingModal = document.getElementById('creditModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create new modal
        const modal = document.createElement('div');
        modal.id = 'creditModal';
        modal.className = 'credit-modal';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="credit-modal-content">
                <div class="credit-modal-header">
                    <h3><i class="fas fa-credit-card"></i> Credit List</h3>
                    <button class="credit-close-btn" onclick="closeCreditModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="credit-modal-body">
                    <div class="credit-summary" id="creditSummary"></div>
                    <div class="credit-tabs" id="creditTabs"></div>
                    <div class="credit-list" id="creditList"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        populateCreditList(creditData);
        
    } catch (error) {
        console.error('Error showing credit list:', error);
        showModernPopup("Error showing credit list", "Error");
    }
}

function populateCreditList(creditData) {
    try {
        const tabsContainer = document.getElementById('creditTabs');
        const listContainer = document.getElementById('creditList');
        const summaryContainer = document.getElementById('creditSummary');
        
        if (!tabsContainer || !listContainer || !summaryContainer) {
            console.error('Required elements not found');
            return;
        }
        
        // Clear containers
        tabsContainer.innerHTML = '';
        listContainer.innerHTML = '';
        
        const towns = Object.keys(creditData).sort();
        
        // Calculate total credits
        let totalCredits = 0;
        let totalQuantity = 0;
        
        towns.forEach(town => {
            if (Array.isArray(creditData[town])) {
                creditData[town].forEach(entry => {
                    totalCredits++;
                    totalQuantity += entry.quantity || 0;
                });
            }
        });
        
        // Update summary
        summaryContainer.innerHTML = `
            <div class="credit-total">
                Total Credits: ${totalCredits} entries • Total Quantity: ${totalQuantity}
            </div>
        `;
        
        if (towns.length === 0) {
            listContainer.innerHTML = `
                <div class="credit-empty">
                    <i class="fas fa-credit-card"></i>
                    <p>No credit entries found</p>
                    <small>Use the "Credit" button to add entries</small>
                </div>
            `;
            return;
        }
        
        // Create tabs
        towns.forEach((town, index) => {
            const tab = document.createElement('button');
            tab.className = `credit-tab ${index === 0 ? 'active' : ''}`;
            
            const townEntries = creditData[town]?.length || 0;
            const townQuantity = Array.isArray(creditData[town]) ? 
                creditData[town].reduce((sum, entry) => sum + (entry.quantity || 0), 0) : 0;
            
            tab.innerHTML = `${town} <small>(${townEntries})</small>`;
            tab.onclick = () => switchCreditTab(town, tab);
            tabsContainer.appendChild(tab);
        });
        
        // Show first tab by default
        if (towns.length > 0) {
            displayCreditEntries(creditData[towns[0]], towns[0]);
        }
        
    } catch (error) {
        console.error('Error populating credit list:', error);
    }
}

function switchCreditTab(town, clickedTab) {
    try {
        // Update active tab
        document.querySelectorAll('.credit-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        clickedTab.classList.add('active');
        
        // Display entries for selected town
        const creditData = JSON.parse(localStorage.getItem('creditEntries') || '{}');
        displayCreditEntries(creditData[town] || [], town);
        
    } catch (error) {
        console.error('Error switching credit tab:', error);
    }
}

function displayCreditEntries(entries, town) {
    try {
        const listContainer = document.getElementById('creditList');
        if (!listContainer) return;
        
        if (!Array.isArray(entries) || entries.length === 0) {
            listContainer.innerHTML = `
                <div class="credit-empty">
                    <i class="fas fa-credit-card"></i>
                    <p>No credit entries for ${town}</p>
                </div>
            `;
            return;
        }
        
        // Sort entries by date (newest first)
        entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        listContainer.innerHTML = entries.map((entry, index) => `
            <div class="credit-item" data-id="${entry.id}">
                <div class="credit-item-header">
                    <span class="credit-company">${entry.company || 'N/A'}</span>
                    <span class="credit-quantity">Qty: ${entry.quantity || 0}</span>
                </div>
                <div class="credit-details">
                    <div><strong>Name:</strong> ${entry.name || 'N/A'}</div>
                    <div><strong>Town:</strong> ${entry.town || 'N/A'}</div>
                </div>
                <div class="credit-item-footer">
                    <div class="credit-date">
                        ${formatCreditDate(entry.date)} • #${index + 1}
                    </div>
                    <button class="credit-delete-btn" onclick="deleteCreditEntry('${entry.id}', '${town}')" title="Delete this entry">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error displaying credit entries:', error);
    }
}

function deleteCreditEntry(entryId, town) {
    if (!entryId) {
        showModernPopup("Cannot delete: Entry ID not found", "Error");
        return;
    }
    
    if (confirm("Are you sure you want to delete this credit entry?")) {
        try {
            const creditData = JSON.parse(localStorage.getItem('creditEntries') || '{}');
            
            if (creditData[town] && Array.isArray(creditData[town])) {
                // Find and remove the entry
                const initialLength = creditData[town].length;
                creditData[town] = creditData[town].filter(entry => entry.id !== entryId);
                
                if (creditData[town].length < initialLength) {
                    // Entry was deleted
                    if (creditData[town].length === 0) {
                        delete creditData[town];
                    }
                    
                    // Save updated data
                    localStorage.setItem('creditEntries', JSON.stringify(creditData));
                    
                    // Show success message
                    showModernPopup("Credit entry deleted successfully", "Deleted");
                    
                    // Refresh the display
                    const activeTab = document.querySelector('.credit-tab.active');
                    if (activeTab && creditData[town]) {
                        displayCreditEntries(creditData[town], town);
                    } else {
                        // If town was deleted or no active tab, reload entire list
                        populateCreditList(creditData);
                    }
                    
                } else {
                    showModernPopup("Entry not found", "Error");
                }
            } else {
                showModernPopup("Town data not found", "Error");
            }
            
        } catch (error) {
            console.error('Error deleting credit entry:', error);
            showModernPopup("Error deleting credit entry", "Error");
        }
    }
}

function formatCreditDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return 'Invalid Date';
    }
}

function closeCreditModal() {
    const modal = document.getElementById('creditModal');
    if (modal) {
        modal.remove();
    }
}


/* ===== END RESTORED CREDIT/LIST ===== */

function toggleMenu() {
    let menu = document.getElementById("menu-dropdown");
    menu.style.display = (menu.style.display === "block") ? "none" : "block";
}

// ✅ Theme Setting Function (Light / Dark Mode)


// ✅ Load Theme From Local Storage
document.addEventListener("DOMContentLoaded", function () {
    let savedTheme = localStorage.getItem("theme") || "light";
    setTheme(savedTheme);
});



function appendToDisplay(value) {
    document.getElementById("calc-display").value += value;
}

function clearDisplay() {
    document.getElementById("calc-display").value = "";
}

/* ==========================================================
   PREFERRED EDIT - ROBUST / NO GLOBAL EDIT STATE
   Uses the popup DOM itself to store edit information.
   This avoids WebView/global lexical-scope conflicts.
   ========================================================== */

function safePreferredArray(type) {
    try {
        const value = JSON.parse(localStorage.getItem(type) || '[]');
        return Array.isArray(value) ? value.map(v => String(v)) : [];
    } catch (e) {
        console.error('Preferred data error:', e);
        return [];
    }
}

function editPreferred(type) {
    try {
        const select = document.getElementById(type);
        if (!select) {
            showPreferredEditMessage('Edit control was not found.', 'Error');
            return false;
        }

        const oldValue = String(select.value || '').trim();
        if (!oldValue) {
            showPreferredEditMessage(`Please select a ${type} first.`, 'Select Item');
            return false;
        }

        const oldOverlay = document.getElementById('preferredEditOverlay');
        if (oldOverlay) oldOverlay.remove();

        const label = labelForPreferred(type);
        const overlay = document.createElement('div');
        overlay.id = 'preferredEditOverlay';
        overlay.className = 'preferred-edit-overlay';
        overlay.dataset.editType = type;
        overlay.dataset.oldValue = oldValue;

        overlay.innerHTML = `
            <div class="preferred-edit-card" role="dialog" aria-modal="true">
                <div class="preferred-edit-header">
                    <div class="preferred-edit-icon">✏️</div>
                    <div class="preferred-edit-title-wrap">
                        <div class="preferred-edit-title">Edit ${escapePreferredEditValue(label)}</div>
                        <div class="preferred-edit-subtitle">ရွေးထားသော ${escapePreferredEditValue(label)} ကို ပြင်ဆင်ပါ</div>
                    </div>
                    <button type="button" class="preferred-edit-close" id="preferredEditCloseBtn" aria-label="Close">✕</button>
                </div>
                <div class="preferred-edit-body">
                    <label class="preferred-edit-label" for="preferredEditInput">${escapePreferredEditValue(label)} Name</label>
                    <input id="preferredEditInput" class="preferred-edit-input" type="text" autocomplete="off" spellcheck="false">
                    <div class="preferred-edit-actions">
                        <button type="button" class="preferred-edit-cancel" id="preferredEditCancelBtn">✕ Cancel</button>
                        <button type="button" class="preferred-edit-save" id="preferredEditSaveBtn">✓ Save Changes</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const input = document.getElementById('preferredEditInput');
        const saveBtn = document.getElementById('preferredEditSaveBtn');
        const cancelBtn = document.getElementById('preferredEditCancelBtn');
        const closeBtn = document.getElementById('preferredEditCloseBtn');

        if (!input || !saveBtn || !cancelBtn || !closeBtn) {
            overlay.remove();
            showPreferredEditMessage('Unable to open Edit window.', 'Error');
            return false;
        }

        input.value = oldValue;

        saveBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            savePreferredEdit();
        });

        cancelBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            closePreferredEdit();
        });

        closeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            closePreferredEdit();
        });

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closePreferredEdit();
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                savePreferredEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closePreferredEdit();
            }
        });

        setTimeout(function() {
            input.focus();
            input.select();
        }, 80);

        return false;
    } catch (error) {
        console.error('editPreferred error:', error);
        showPreferredEditMessage('Edit failed: ' + error.message, 'Error');
        return false;
    }
}

function escapePreferredEditValue(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function closePreferredEdit() {
    const overlay = document.getElementById('preferredEditOverlay');
    if (overlay) overlay.remove();
}

function savePreferredEdit() {
    try {
        const overlay = document.getElementById('preferredEditOverlay');
        const input = document.getElementById('preferredEditInput');

        if (!overlay || !input) return false;

        const type = String(overlay.dataset.editType || '').trim();
        const oldValue = String(overlay.dataset.oldValue || '').trim();
        const newValue = String(input.value || '').trim();

        if (!type || !oldValue) {
            closePreferredEdit();
            showPreferredEditMessage('Edit information was lost. Please try again.', 'Error');
            return false;
        }

        if (!newValue) {
            input.focus();
            showPreferredEditMessage('အမည်အသစ် ထည့်ပေးပါ။', 'Required');
            return false;
        }

        if (newValue === oldValue) {
            closePreferredEdit();
            return true;
        }

        const preferredNames = safePreferredArray(type);
        const index = preferredNames.findIndex(v => String(v).trim() === oldValue);

        if (index === -1) {
            closePreferredEdit();
            showPreferredEditMessage('ရွေးထားသော item ကို မတွေ့တော့ပါ။', 'Error');
            return false;
        }

        const duplicate = preferredNames.some((v, i) =>
            i !== index && String(v).trim().toLowerCase() === newValue.toLowerCase()
        );

        if (duplicate) {
            input.focus();
            showPreferredEditMessage(`"${newValue}" already exists.`, 'Duplicate');
            return false;
        }

        preferredNames[index] = newValue;
        localStorage.setItem(type, JSON.stringify(preferredNames));

        // Update normal entries when the field exists.
        try {
            const raw = localStorage.getItem('entries');
            const entries = raw ? JSON.parse(raw) : [];
            if (Array.isArray(entries)) {
                let changed = false;
                entries.forEach(entry => {
                    if (entry && String(entry[type] ?? '').trim() === oldValue) {
                        entry[type] = newValue;
                        changed = true;
                    }
                });
                if (changed) localStorage.setItem('entries', JSON.stringify(entries));
            }
        } catch (e) {
            console.warn('Could not update existing entries:', e);
        }

        // Update credit entries when the field exists.
        try {
            const raw = localStorage.getItem('creditEntries');
            const creditData = raw ? JSON.parse(raw) : {};
            if (creditData && typeof creditData === 'object') {
                let changed = false;
                Object.keys(creditData).forEach(townKey => {
                    if (!Array.isArray(creditData[townKey])) return;
                    creditData[townKey].forEach(entry => {
                        if (entry && String(entry[type] ?? '').trim() === oldValue) {
                            entry[type] = newValue;
                            changed = true;
                        }
                    });
                });
                if (changed) localStorage.setItem('creditEntries', JSON.stringify(creditData));
            }
        } catch (e) {
            console.warn('Could not update credit entries:', e);
        }

        if (typeof loadPreferredNames === 'function') loadPreferredNames();
        const select = document.getElementById(type);
        if (select) select.value = newValue;
        if (typeof loadEntries === 'function') loadEntries();

        closePreferredEdit();

        if (typeof showModernPopup === 'function') {
            showModernPopup(`${labelForPreferred(type)} updated successfully!`, 'Updated');
        } else {
            window.alert(`${labelForPreferred(type)} updated successfully!`);
        }

        return true;
    } catch (error) {
        console.error('savePreferredEdit error:', error);
        showPreferredEditMessage('Save failed: ' + error.message, 'Error');
        return false;
    }
}

function labelForPreferred(type) {
    return String(type || '').charAt(0).toUpperCase() + String(type || '').slice(1);
}

function showPreferredEditMessage(message, title) {
    if (typeof showModernPopup === 'function') {
        showModernPopup(message, title || 'Information');
    } else if (typeof window.alert === 'function') {
        window.alert(message);
    } else {
        console.log((title || 'Information') + ': ' + message);
    }
}

/* ✅ Delete Preferred Name */
function deletePreferred(type) {
    let select = document.getElementById(type);
    let selectedOption = select.options[select.selectedIndex];
    
    if (!selectedOption || selectedOption.value === "") {
        alert(`Please select a ${type} to delete.`);
        return;
    }
    
    if (confirm(`Are you sure you want to delete "${selectedOption.value}"?`)) {
        let preferredNames = JSON.parse(localStorage.getItem(type)) || [];
        let updatedNames = preferredNames.filter(name => name !== selectedOption.value);
        
        localStorage.setItem(type, JSON.stringify(updatedNames));
        loadPreferredNames();
        alert(`${type} deleted successfully!`);
    }
}
/* ✅ Modified loadPreferredNames Function */
function loadPreferredNames() {
    ["company", "name", "town"].forEach(type => {
        let preferredNames = JSON.parse(localStorage.getItem(type)) || [];
        preferredNames.sort();
        let select = document.getElementById(type);
        
        // Save current selected value
        let currentValue = select.value;
        
        select.innerHTML = "<option value=''>Select or Add</option>";
        
        preferredNames.forEach(name => {
            let option = document.createElement("option");
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
        
        // Restore selection if it still exists
        if (currentValue && preferredNames.includes(currentValue)) {
            select.value = currentValue;
        }
    });
}

// ==============================================
// DAY-BY-DAY COPY FUNCTIONS - CORRECTED VERSION
// ==============================================

// ✅ 1. Day-by-Day Name Summary (Town-Wise) - FIXED
function copyDayByNameSummary() {
    try {
        console.log("copyDayByNameSummary function called");
        
        const entries = JSON.parse(localStorage.getItem("entries")) || [];
        console.log("Total entries found:", entries.length);
        
        if (entries.length === 0) {
            alert("📭 No entries found in storage.");
            return;
        }

        // Group by Date -> Town -> Name -> Company
        const dateData = {};
        entries.forEach(entry => {
            const { date, town, name, company, quantity } = entry;
            if (!date) return;
            
            if (!dateData[date]) dateData[date] = {};
            if (!dateData[date][town]) dateData[date][town] = {};
            if (!dateData[date][town][name]) dateData[date][town][name] = {};
            if (!dateData[date][town][name][company]) dateData[date][town][name][company] = 0;
            dateData[date][town][name][company] += parseInt(quantity) || 0;
        });

        // Sort dates
        const sortedDates = Object.keys(dateData).sort();
        console.log("Dates found:", sortedDates);

        if (sortedDates.length === 0) {
            alert("No valid dated entries found.");
            return;
        }

        let output = "DAY-BY-DAY NAME SUMMARY (Town-Wise)\n";
        output += "=".repeat(40) + "\n\n";

        sortedDates.forEach(date => {
            output += `📅 ${date}\n`;
            output += "─".repeat(40) + "\n";
            
            const towns = Object.keys(dateData[date]);
            if (towns.length === 0) return;
            
            for (const town of towns) {
                output += `🏙️ ${town}\n`;
                
                const names = Object.keys(dateData[date][town]);
                for (const name of names) {
                    output += `  👤 ${name}\n`;
                    
                    const companies = Object.keys(dateData[date][town][name]);
                    let nameTotal = 0;
                    
                    for (const company of companies) {
                        const qty = dateData[date][town][name][company];
                        nameTotal += qty;
                        output += `    ➤ ${company}: ${qty}\n`;
                    }
                    
                    output += `    📊 Total: ${nameTotal}\n\n`;
                }
            }
            output += "\n";
        });

        // Copy to clipboard
        navigator.clipboard.writeText(output)
            .then(() => {
                alert(`✅ Day-by-Day Name Summary copied!\n\n📅 Dates: ${sortedDates.length}\n📋 Ready to paste into Excel/Sheets.`);
            })
            .catch(err => {
                console.error("Clipboard error:", err);
                // Fallback method
                const textarea = document.createElement('textarea');
                textarea.value = output;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                alert("✅ Copied (using fallback method)!");
            });

    } catch (error) {
        console.error("Error in copyDayByNameSummary:", error);
        alert(`❌ Error: ${error.message}`);
    }
}

// ✅ 2. Day-by-Day Company Wise Summary - FIXED
function copyDayByCompanySummary() {
    try {
        console.log("copyDayByCompanySummary function called");
        
        const entries = JSON.parse(localStorage.getItem("entries")) || [];
        
        if (entries.length === 0) {
            alert("📭 No entries found.");
            return;
        }

        // Group by Date -> Company -> Town -> Name
        const dateData = {};
        entries.forEach(entry => {
            const { date, company, town, name, quantity } = entry;
            if (!date) return;
            
            if (!dateData[date]) dateData[date] = {};
            if (!dateData[date][company]) dateData[date][company] = {};
            if (!dateData[date][company][town]) dateData[date][company][town] = {};
            if (!dateData[date][company][town][name]) dateData[date][company][town][name] = 0;
            dateData[date][company][town][name] += parseInt(quantity) || 0;
        });

        // Sort dates
        const sortedDates = Object.keys(dateData).sort();

        let output = "DAY-BY-DAY COMPANY WISE SUMMARY\n";
        output += "=".repeat(40) + "\n\n";

        sortedDates.forEach(date => {
            output += `📅 ${date}\n`;
            output += "─".repeat(40) + "\n";
            
            const companies = Object.keys(dateData[date]);
            
            for (const company of companies) {
                let companyTotal = 0;
                output += `🏢 ${company}\n`;
                
                const towns = Object.keys(dateData[date][company]);
                for (const town of towns) {
                    output += `  🏙️ ${town}\n`;
                    
                    const names = Object.keys(dateData[date][company][town]);
                    for (const name of names) {
                        const qty = dateData[date][company][town][name];
                        companyTotal += qty;
                        output += `    👤 ${name}: ${qty}\n`;
                    }
                }
                
                output += `  📊 Company Total: ${companyTotal}\n\n`;
            }
            output += "\n";
        });

        // Copy to clipboard
        copyTextToClipboard(output, "Day-by-Day Company Summary");
        
    } catch (error) {
        console.error("Error:", error);
        alert(`❌ Error: ${error.message}`);
    }
}

// ✅ 3. Day-by-Day Excel Format - FIXED
function copyDayByDayExcel() {
    try {
        const entries = JSON.parse(localStorage.getItem("entries")) || [];
        
        if (entries.length === 0) {
            alert("📭 No entries found.");
            return;
        }

        // Sort entries by date
        const validEntries = entries.filter(e => e.date);
        validEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

        let output = "DAY-BY-DAY DETAILED REPORT\n";
        output += "=".repeat(30) + "\n\n";

        // Group by date
        const dateGroups = {};
        validEntries.forEach(entry => {
            const { date } = entry;
            if (!dateGroups[date]) dateGroups[date] = [];
            dateGroups[date].push(entry);
        });

        // 1. All entries
        output += "1. ALL ENTRIES\n";
        output += "Date\tCompany\tName\tTown\tQuantity\n";
        validEntries.forEach(entry => {
            output += `${entry.date}\t${entry.company}\t${entry.name}\t${entry.town}\t${entry.quantity}\n`;
        });

        output += "\n\n2. DAY-BY-DAY SUMMARIES\n";
        output += "=".repeat(25) + "\n\n";

        // 2. Daily summaries
        Object.keys(dateGroups).sort().forEach(date => {
            const dailyEntries = dateGroups[date];
            
            output += `📅 ${date}\n`;
            output += "─".repeat(30) + "\n";
            
            // Simple table format
            output += "Company\tName\tTown\tQuantity\n";
            dailyEntries.forEach(entry => {
                output += `${entry.company}\t${entry.name}\t${entry.town}\t${entry.quantity}\n`;
            });
            
            const dailyTotal = dailyEntries.reduce((sum, e) => sum + (parseInt(e.quantity) || 0), 0);
            output += `\n📊 Daily Total: ${dailyTotal}\n\n`;
        });

        // 3. Overall totals
        output += "3. OVERALL TOTALS\n";
        output += "=".repeat(20) + "\n\n";
        
        const overallTown = {};
        const overallCompany = {};
        
        validEntries.forEach(entry => {
            const qty = parseInt(entry.quantity) || 0;
            overallTown[entry.town] = (overallTown[entry.town] || 0) + qty;
            overallCompany[entry.company] = (overallCompany[entry.company] || 0) + qty;
        });
        
        output += "Town\tTotal\n";
        for (const town in overallTown) {
            output += `${town}\t${overallTown[town]}\n`;
        }
        
        output += "\nCompany\tTotal\n";
        for (const company in overallCompany) {
            output += `${company}\t${overallCompany[company]}\n`;
        }

        copyTextToClipboard(output, "Day-by-Day Excel Report");
        
    } catch (error) {
        console.error("Error:", error);
        alert(`❌ Error: ${error.message}`);
    }
}

function copyCompanySimple() {
    const selectedDate = document.getElementById("date").value;
    if (!selectedDate) {
        alert("📅 Please select a date first.");
        return;
    }
    
    const allEntries = JSON.parse(localStorage.getItem("entries") || "[]");
    const dailyEntries = allEntries.filter(entry => entry.date === selectedDate);
    
    if (dailyEntries.length === 0) {
        alert(`📭 No data found for ${selectedDate}`);
        return;
    }
    
    let output = `COMPANY REPORT - ${selectedDate}\n\n`;
    
    // Group by Company
    const companyMap = {};
    dailyEntries.forEach(entry => {
        if (!companyMap[entry.company]) {
            companyMap[entry.company] = {};
        }
        
        // Group by Name+Town
        const key = `${entry.name} (${entry.town})`;
        companyMap[entry.company][key] = (companyMap[entry.company][key] || 0) + parseInt(entry.quantity);
    });
    
    // Sort companies alphabetically
    const sortedCompanies = Object.keys(companyMap).sort();
    
    sortedCompanies.forEach(company => {
        const companyData = companyMap[company];
        let companyTotal = 0;
        
        output += `🏢 ${company}\n`;
        output += "─".repeat(40) + "\n";
        
        // Sort customers alphabetically
        const sortedCustomers = Object.keys(companyData).sort();
        
        sortedCustomers.forEach(customer => {
            const qty = companyData[customer];
            companyTotal += qty;
            output += `  ${customer}: ${qty}\n`;
        });
        
        output += `Total: ${companyTotal}\n\n`;
    });
    
    // Overall total
    const dailyTotal = dailyEntries.reduce((sum, e) => sum + parseInt(e.quantity), 0);
    output += `📊 DAILY TOTAL: ${dailyTotal}\n`;
    output += `Companies: ${sortedCompanies.length}\n`;
    output += `Entries: ${dailyEntries.length}\n`;
    
    // Simple copy
    copyToClipboardSimple(output, `✅ Company report for ${selectedDate} copied!`);
}

// ✅ SIMPLE TOWN COPY - WORKING VERSION
function copyTownDetailed() {
    const selectedDate = document.getElementById("date").value;
    if (!selectedDate) {
        alert("📅 Please select a date first.");
        return;
    }
    
    const allEntries = JSON.parse(localStorage.getItem("entries") || "[]");
    const dailyEntries = allEntries.filter(entry => entry.date === selectedDate);
    
    if (dailyEntries.length === 0) {
        alert(`📭 No data found for ${selectedDate}`);
        return;
    }
    
    let output = `TOWN REPORT - ${selectedDate}\n\n`;
    
    // Group by Town
    const townMap = {};
    dailyEntries.forEach(entry => {
        if (!townMap[entry.town]) {
            townMap[entry.town] = {};
        }
        
        // Group by Name+Company
        const key = `${entry.name} [${entry.company}]`;
        townMap[entry.town][key] = (townMap[entry.town][key] || 0) + parseInt(entry.quantity);
    });
    
    // Sort towns alphabetically
    const sortedTowns = Object.keys(townMap).sort();
    
    sortedTowns.forEach(town => {
        const townData = townMap[town];
        let townTotal = 0;
        
        output += `📍 ${town}\n`;
        output += "─".repeat(40) + "\n";
        
        // Sort customers alphabetically
        const sortedCustomers = Object.keys(townData).sort();
        
        sortedCustomers.forEach(customer => {
            const qty = townData[customer];
            townTotal += qty;
            output += `  ${customer}: ${qty}\n`;
        });
        
        output += `Total: ${townTotal}\n\n`;
    });
    
    // Overall total
    const dailyTotal = dailyEntries.reduce((sum, e) => sum + parseInt(e.quantity), 0);
    output += `📊 DAILY TOTAL: ${dailyTotal}\n`;
    output += `Towns: ${sortedTowns.length}\n`;
    output += `Entries: ${dailyEntries.length}\n`;
    
    // Simple copy
    copyToClipboardSimple(output, `✅ Town report for ${selectedDate} copied!`);
}

// ✅ SIMPLE EXCEL COPY - NO ERRORS
function copyExcelFormattedText() {
    const selectedDate = document.getElementById("date").value;
    if (!selectedDate) {
        alert("📅 Please select a date first.");
        return;
    }
    
    const [year, month] = selectedDate.split('-').slice(0, 2);
    const monthStart = `${year}-${month}-01`;
    const monthEnd = `${year}-${month}-${new Date(year, month, 0).getDate()}`;
    
    const allEntries = JSON.parse(localStorage.getItem("entries") || "[]");
    const monthEntries = allEntries.filter(entry => {
        const entryDate = entry.date;
        return entryDate >= monthStart && entryDate <= monthEnd;
    });
    
    if (monthEntries.length === 0) {
        alert(`📭 No data found for ${year}-${month}`);
        return;
    }
    
    // Group by date
    const entriesByDate = {};
    monthEntries.forEach(entry => {
        if (!entriesByDate[entry.date]) {
            entriesByDate[entry.date] = [];
        }
        entriesByDate[entry.date].push(entry);
    });
    
    const sortedDates = Object.keys(entriesByDate).sort();
    let output = `MONTHLY REPORT - ${year}-${month}\n\n`;
    
    // Section 1: Monthly Summary
    output += "SECTION 1 - MONTHLY SUMMARY\n";
    output += "Date\tTotal\tCompanies\tCustomers\tTowns\n";
    
    sortedDates.forEach(date => {
        const dailyEntries = entriesByDate[date];
        const dailyTotal = dailyEntries.reduce((sum, e) => sum + parseInt(e.quantity), 0);
        const companies = [...new Set(dailyEntries.map(e => e.company))];
        const customers = [...new Set(dailyEntries.map(e => e.name))];
        const towns = [...new Set(dailyEntries.map(e => e.town))];
        
        output += `${date}\t${dailyTotal}\t${companies.length}\t${customers.length}\t${towns.length}\n`;
    });
    
    const monthTotal = monthEntries.reduce((sum, e) => sum + parseInt(e.quantity), 0);
    const uniqueCompanies = [...new Set(monthEntries.map(e => e.company))];
    const uniqueCustomers = [...new Set(monthEntries.map(e => e.name))];
    const uniqueTowns = [...new Set(monthEntries.map(e => e.town))];
    
    output += `Monthly Total\t${monthTotal}\t${uniqueCompanies.length}\t${uniqueCustomers.length}\t${uniqueTowns.length}\n\n`;
    
    // Section 2: Company Details
    output += "SECTION 2 - COMPANY DETAILS\n\n";
    
    const companyGroups = {};
    monthEntries.forEach(entry => {
        if (!companyGroups[entry.company]) {
            companyGroups[entry.company] = [];
        }
        companyGroups[entry.company].push(entry);
    });
    
    Object.keys(companyGroups).sort().forEach(company => {
        const entries = companyGroups[company];
        const companyTotal = entries.reduce((sum, e) => sum + parseInt(e.quantity), 0);
        
        output += `Company: ${company} (Total: ${companyTotal})\n`;
        output += "Date\tCustomer\tTown\tQty\n";
        
        // Group by date
        const dateGroups = {};
        entries.forEach(entry => {
            if (!dateGroups[entry.date]) {
                dateGroups[entry.date] = {};
            }
            const key = `${entry.name}|${entry.town}`;
            dateGroups[entry.date][key] = (dateGroups[entry.date][key] || 0) + parseInt(entry.quantity);
        });
        
        Object.keys(dateGroups).sort().forEach(date => {
            Object.keys(dateGroups[date]).sort().forEach(key => {
                const [name, town] = key.split('|');
                output += `${date}\t${name}\t${town}\t${dateGroups[date][key]}\n`;
            });
        });
        
        output += "\n";
    });
    
    // Section 3: Daily Data
    output += "SECTION 3 - DAILY DATA\n\n";
    
    sortedDates.forEach(date => {
        const dailyEntries = entriesByDate[date];
        const dailyTotal = dailyEntries.reduce((sum, e) => sum + parseInt(e.quantity), 0);
        
        output += `Date: ${date} (Total: ${dailyTotal})\n`;
        output += "No\tCompany\tCustomer\tTown\tQty\n";
        
        // Group similar entries
        const grouped = {};
        dailyEntries.forEach(entry => {
            const key = `${entry.company}|${entry.name}|${entry.town}`;
            grouped[key] = (grouped[key] || 0) + parseInt(entry.quantity);
        });
        
        let index = 1;
        Object.keys(grouped).sort().forEach(key => {
            const [company, name, town] = key.split('|');
            output += `${index}\t${company}\t${name}\t${town}\t${grouped[key]}\n`;
            index++;
        });
        
        output += "\n";
    });
    
    // Copy
    copyToClipboardSimple(output, `✅ Monthly report for ${year}-${month} copied!`);
}

// ✅ SIMPLE COPY FUNCTION
function copyToClipboardSimple(text, message) {
    const textArea = document.createElement("textarea");
    textArea.value = text;

    // Keep the temporary copy field completely invisible/off-screen.
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "-9999px";
    textArea.style.width = "1px";
    textArea.style.height = "1px";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";
    document.body.appendChild(textArea);

    textArea.focus();
    textArea.select();

    try {
        const success = document.execCommand("copy");
        if (success) {
            // Keep the existing popup/message behavior.
            if (message) {
                alert(message);
            }
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(text)
                .then(() => {
                    if (message) alert(message);
                })
                .catch(() => {
                    prompt("Copy this text:", text);
                });
        } else {
            prompt("Copy this text:", text);
        }
    } catch (err) {
        alert("⚠️ Copy failed. Please try again.");
    } finally {
        // Remove the temporary field immediately so it never appears as a small box.
        if (textArea.parentNode) {
            textArea.parentNode.removeChild(textArea);
        }
    }
}

// ✅ DAILY COPY SIMPLE
function copyDailyExcel() {
    const selectedDate = document.getElementById("date").value;
    if (!selectedDate) {
        alert("📅 Please select a date first.");
        return;
    }
    
    const allEntries = JSON.parse(localStorage.getItem("entries") || "[]");
    const dailyEntries = allEntries.filter(entry => entry.date === selectedDate);
    
    if (dailyEntries.length === 0) {
        alert(`📭 No data found for ${selectedDate}`);
        return;
    }
    
    let output = `DAILY REPORT - ${selectedDate}\n\n`;
    
    // Simple table
    output += "No\tCompany\tCustomer\tTown\tQuantity\n";
    output += "─".repeat(50) + "\n";
    
    dailyEntries.forEach((entry, index) => {
        output += `${index + 1}\t${entry.company}\t${entry.name}\t${entry.town}\t${entry.quantity}\n`;
    });
    
    const totalQty = dailyEntries.reduce((sum, e) => sum + parseInt(e.quantity), 0);
    output += "\n" + "─".repeat(50) + "\n";
    output += `TOTAL: ${totalQty}\n`;
    output += `ENTRIES: ${dailyEntries.length}\n`;
    
    copyToClipboardSimple(output, `✅ Daily report for ${selectedDate} copied!`);
}


// Add test button to debug
function addTestButton() {
    if (!document.getElementById('testCopyBtn')) {
        const testBtn = document.createElement('button');
        testBtn.id = 'testCopyBtn';
        testBtn.textContent = '🛠️ Test Copy Functions';
        testBtn.style.position = 'fixed';
        testBtn.style.bottom = '10px';
        testBtn.style.right = '10px';
        testBtn.style.zIndex = '9999';
        testBtn.style.padding = '10px';
        testBtn.style.background = '#ff9800';
        testBtn.style.color = 'white';
        testBtn.style.border = 'none';
        testBtn.style.borderRadius = '5px';
        testBtn.style.cursor = 'pointer';
        testBtn.onclick = testAllCopyFunctions;
        
        document.body.appendChild(testBtn);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log("Day-by-Day Copy Functions loaded");
    addTestButton();
    
    // Make functions available globally
    window.copyDayByNameSummary = copyDayByNameSummary;
    window.copyDayByCompanySummary = copyDayByCompanySummary;
    window.copyDayByDayExcel = copyDayByDayExcel;
    window.copyCompleteMonthlyReport = copyCompleteMonthlyReport;
    window.testAllCopyFunctions = testAllCopyFunctions;
});

// ==============================================
// SIMPLIFIED VERSION - If above doesn't work
// ==============================================

// Ultra-simple version that definitely works
function simpleDayReport() {
    const entries = JSON.parse(localStorage.getItem("entries")) || [];
    
    if (entries.length === 0) {
        alert("No data found!");
        return;
    }
    
    let output = "Date\tCompany\tName\tTown\tQuantity\n";
    entries.forEach(e => {
        output += `${e.date || "No Date"}\t${e.company}\t${e.name}\t${e.town}\t${e.quantity}\n`;
    });
    
    // Copy using simple method
    const textarea = document.createElement('textarea');
    textarea.value = output;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    
    alert(`✅ Copied ${entries.length} entries!`);
}
function printTable() {
    const printContents = document.querySelector("table").outerHTML;
    const originalContents = document.body.innerHTML;
    document.body.innerHTML = printContents;
    window.print();
    document.body.innerHTML = originalContents;
    location.reload(); // ပြန် Refresh
}
function setTheme(mode) {
    document.body.classList.remove("light-mode", "dark-mode", "colorful-mode", "retro-mode", "neon-mode");
    document.body.classList.add(`${mode}-mode`);
    localStorage.setItem("theme", mode);
}

function changeTheme(value) {
    setTheme(value);
}

window.onload = () => {
    const savedTheme = localStorage.getItem("theme") || "light";
    setTheme(savedTheme);
    const themeSelect = document.getElementById("theme-select");
    if (themeSelect) themeSelect.value = savedTheme;
}
function copyNotes() {
    const notesText = document.getElementById("popup-notes").value;
    navigator.clipboard.writeText(notesText).then(() => {
        alert("Notes copied to clipboard!");
    });
}
function saveTableAsImage() {
    const table = document.querySelector("table");
    if (!table) {
        alert("No table found!");
        return;
    }

    html2canvas(table).then(canvas => {
        const link = document.createElement("a");
        link.download = "saved-entries.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
    });
}

function refreshEntries() {
    const entries = JSON.parse(localStorage.getItem("entries")) || [];

    const tableBody = document.getElementById("entry-list");
    const totalList = document.getElementById("total-quantity");

    tableBody.innerHTML = "";
    totalList.innerHTML = "";

    let totalQuantity = 0;

    entries.forEach((entry, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${entry.date}</td>
            <td>${entry.company}</td>
            <td><span class="tko-entry-name-link" data-entry-id="${String(entry.id || '').replace(/'/g, "&#39;")}">${escapeHtmlSimple(entry.name || '')}</span></td>
            <td>${entry.town}</td>
            <td>${entry.quantity}</td>
        `;
        row.dataset.entryId = String(entry.id || '');
        tableBody.appendChild(row);
        totalQuantity += Number(entry.quantity);
    });

    const totalItem = document.createElement("li");
    totalItem.textContent = `Total Quantity: ${totalQuantity}`;
    totalList.appendChild(totalItem);
}
function copyEntriesBySelectedDate() {
    const selectedDate = document.getElementById("date").value;
    if (!selectedDate) {
        alert("📅 Please select a date first.");
        return;
    }

    const entries = JSON.parse(localStorage.getItem("entries")) || [];
    const filteredEntries = entries.filter(entry => entry.date === selectedDate);

    if (filteredEntries.length === 0) {
        alert(`😕 No entries found for ${selectedDate}`);
        return;
    }

    // Create tab-separated values for Google Sheets
    let csvContent = "Date\tCompany\tName\tTown\tQuantity\n"; // Header row
    
    filteredEntries.forEach(entry => {
        csvContent += `${entry.date}\t${entry.company}\t${entry.name}\t${entry.town}\t${entry.quantity}\n`;
    });

    // Add summary section
    const companyTotals = {};
    const townTotals = {};
    
    filteredEntries.forEach(entry => {
        companyTotals[entry.company] = (companyTotals[entry.company] || 0) + parseInt(entry.quantity);
        townTotals[entry.town] = (townTotals[entry.town] || 0) + parseInt(entry.quantity);
    });

    csvContent += "\nCompany Totals:\n";
    for (const [company, total] of Object.entries(companyTotals)) {
        csvContent += `${company}\t${total}\n`;
    }

    csvContent += "\nTown Totals:\n";
    for (const [town, total] of Object.entries(townTotals)) {
        csvContent += `${town}\t${total}\n`;
    }

    // Copy to clipboard
    navigator.clipboard.writeText(csvContent)
        .then(() => {
            alert(`✅ Data for ${selectedDate} copied in Google Sheets format!\nPaste directly into Google Sheets.`);
        })
        .catch(err => {
            alert("❌ Copy failed: " + err);
        });
}
  function refreshUI() {
    // နေရာတိုင်းကို clear / reload တော့ theme မပျက်
    // ตัวอย่าง: Form တွေ reset, Table တွေ reload
    document.getElementById("company").value = "";
    document.getElementById("name").value = "";
    document.getElementById("town").value = "";
    document.getElementById("quantity").value = "";
    document.getElementById("search-box").value = "";
  
    // Entry List ပြန်ပြ
    loadEntries();
  
    // Theme, LocalStorage, Layout မထိဘူး!
  }
  function getTownWiseData(selectedDate) {
    const entries = JSON.parse(localStorage.getItem("entries")) || [];
    const dataByTown = {};
  
    entries.forEach(entry => {
      if (entry.date.startsWith(selectedDate)) {
        if (!dataByTown[entry.town]) dataByTown[entry.town] = {};
        if (!dataByTown[entry.town][entry.name]) dataByTown[entry.town][entry.name] = 0;
        dataByTown[entry.town][entry.name] += entry.quantity;
      }
    });
  
    return dataByTown;
  }
  
  function closeTownWisePopup() {
    document.getElementById("townWiseModal").style.display = "none";
  }

html += `
  <div style="margin-bottom: 8px;">
    <span class="town-name">${name}</span> (${town}) - 
    <span class="town-qty">${nameTotals[name]}</span>
  </div>
`;

// ✅ Calculator Open & Close



// ✅ Calculator Logic



// ✅ Show Debt Popup
// Modified Debt Functions






function copyMonthlySummary() {
    const allEntries = JSON.parse(localStorage.getItem("entries") || "[]");

    if (!allEntries.length) {
        alert("📭 Save Entries မရှိသေးပါ။");
        return;
    }

    // Group entries by date
    const groupedByDate = {};

    allEntries.forEach(entry => {
        const date = entry.date || "Unknown";
        if (!groupedByDate[date]) groupedByDate[date] = [];
        groupedByDate[date].push(entry);
    });

    const allDates = Object.keys(groupedByDate).sort();
    let output = "TKO Monthly Summary (From Save Entries)\n\n";

    allDates.forEach(date => {
        const entries = groupedByDate[date];
        if (!entries || entries.length === 0) return;

        const townTotals = {};
        const companyTotals = {};
        const nameTownTotals = {};

        entries.forEach(entry => {
            const qty = parseInt(entry.quantity || 0);

            townTotals[entry.town] = (townTotals[entry.town] || 0) + qty;
            companyTotals[entry.company] = (companyTotals[entry.company] || 0) + qty;

            const key = `${entry.name} (${entry.town})`;
            nameTownTotals[key] = (nameTownTotals[key] || 0) + qty;
        });

        output += `Date: ${date}\n`;
        output += "Name\tTown\tCompany\tQuantity\n";
        entries.forEach(e => {
            output += `${e.name}\t${e.town}\t${e.company}\t${e.quantity}\n`;
        });

        output += "\nTown Wise\nTown\tTotal Quantity\n";
        for (let town in townTotals) {
            output += `${town}\t${townTotals[town]}\n`;
        }

        output += "\nCompany Wise\nCompany\tTotal Quantity\n";
        for (let comp in companyTotals) {
            output += `${comp}\t${companyTotals[comp]}\n`;
        }

        output += "\nName (Town) Wise\nName (Town)\tTotal Quantity\n";
        for (let nt in nameTownTotals) {
            output += `${nt}\t${nameTownTotals[nt]}\n`;
        }

        output += "\n-----------------------------\n\n";
    });

    navigator.clipboard.writeText(output).then(() => {
        alert("📋 တစ်လစာ Save Entries Summary ကို Copy လုပ်ပြီးပါပြီ! Excel / Sheets ထဲ Paste လုပ်နိုင်ပါပြီ။");
    });
}




function toggleRestoreBox() {
    const box = document.getElementById("restore-section");
    box.style.display = box.style.display === "none" ? "block" : "none";
}


  
  function closeDebtPopup() {
    document.getElementById("debt-overlay").style.display = "none";
  }


// ✅ Modified Debt Functions
function showDebtPopup() {
    document.getElementById("debt-overlay").style.display = "flex";
    
    // Load saved data
    const receiveData = localStorage.getItem("debt-receive") || "";
    const oweData = localStorage.getItem("debt-owe") || "";
    
    document.getElementById("debt-receive").value = receiveData;
    document.getElementById("debt-owe").value = oweData;
    
    // Set active tab from localStorage or default to "receive"
    const lastTab = localStorage.getItem("debt-tab") || "receive";
    switchDebtTab(lastTab);
}

function switchDebtTab(tab) {
    currentDebtTab = tab;
    localStorage.setItem("debt-tab", tab);
    
    // Toggle visibility
    document.getElementById("debt-receive").style.display = 
        tab === "receive" ? "block" : "none";
    document.getElementById("debt-owe").style.display = 
        tab === "owe" ? "block" : "none";
        
    // Update tab buttons
    document.getElementById("tab-receive").classList.toggle("active", tab === "receive");
    document.getElementById("tab-owe").classList.toggle("active", tab === "owe");
}

function clearDebt() {
    if (confirm("ဖျက်မှာသေချာလား?")) {
        document.getElementById("debt-receive").value = "";
        document.getElementById("debt-owe").value = "";
        localStorage.removeItem("debt-receive");
        localStorage.removeItem("debt-owe");
    }
}
function loadDebt() {
    const data = JSON.parse(localStorage.getItem("debt"));
    if (data) {
        document.getElementById("debt-receive").value = data.receive || "";
        document.getElementById("debt-owe").value = data.owe || "";
    }
}


document.addEventListener("DOMContentLoaded", () => {
    loadDebt();
});

function changeFontSize(size) {
    document.documentElement.style.setProperty('--app-font-size', size);
    localStorage.setItem('appFontSize', size);
  }
  // Load saved font size on app start
window.addEventListener('DOMContentLoaded', () => {
    const savedSize = localStorage.getItem('appFontSize');
    if (savedSize) {
      document.documentElement.style.setProperty('--app-font-size', savedSize);
      document.getElementById("font-size-select").value = savedSize;
    }
  });
  function backupPreferredToClipboard() {
    let company = JSON.parse(localStorage.getItem("company")) || [];
    let name = JSON.parse(localStorage.getItem("name")) || [];
    let town = JSON.parse(localStorage.getItem("town")) || [];

    let backup = {
        company,
        name,
        town
    };

    navigator.clipboard.writeText(JSON.stringify(backup, null, 2))
        .then(() => alert("Preferred Name Backup copied to clipboard!"))
        .catch(err => alert("Clipboard Copy Failed!"));
}
function restorePreferredFromClipboard() {
    let input = prompt("Paste your Preferred Name backup here:");
    if (!input) return;

    try {
        let data = JSON.parse(input);
        if (data.company && data.name && data.town) {
            localStorage.setItem("company", JSON.stringify(data.company));
            localStorage.setItem("name", JSON.stringify(data.name));
            localStorage.setItem("town", JSON.stringify(data.town));
            loadPreferredNames();
            alert("Preferred Names restored successfully!");
        } else {
            alert("Invalid data format!");
        }
    } catch (e) {
        alert("Error parsing backup data!");
    }
}

// ✅ Toggle Restore UI
function toggleNotesRestore() {
    const box = document.getElementById("notes-restore-section");
    box.style.display = box.style.display === "none" ? "block" : "none";
}

// ✅ Restore Notes – Only new dates
function restoreNotes() {
    const raw = document.getElementById("notes-restore-box").value;

    try {
        const incoming = JSON.parse(raw);
        const existing = JSON.parse(localStorage.getItem("notes") || "{}");

        let added = 0;

        for (const date in incoming) {
            if (!existing.hasOwnProperty(date)) {
                existing[date] = incoming[date];
                added++;
            }
        }

        if (added === 0) {
            alert("⚠️ Restore လုပ်မယ့် အသစ် Date မရှိပါ။");
            return;
        }

        localStorage.setItem("notes", JSON.stringify(existing));
        alert(`✅ Notes Restore ပြီးပါပြီ။ ${added} ခု အသစ်ထည့်ပြီးပါပြီ။`);
        document.getElementById("notes-restore-box").value = "";

    } catch (e) {
        alert("❌ JSON Format မှားနေပါတယ်။ Paste ပြန်စစ်ပါ။");
    }
}
function saveNoteForDate(date, noteText) {
    const notes = JSON.parse(localStorage.getItem("notes") || "{}");
    notes[date] = noteText;
    localStorage.setItem("notes", JSON.stringify(notes));
}

    
    // Auto-click the first town button if available
    if (townListDiv.firstChild) {
        townListDiv.firstChild.click();
    }

  
function saveDeliveredStatus(town, name, checkbox) {
    const key = `delivered-${btoa(`${town}-${name}`)}`;
    const parent = checkbox.closest("li");
    const infoSpan = parent.querySelector("span");

    // Remove old delivered time if exists
    const oldDelivered = infoSpan.querySelector(".delivered-time");
    if (oldDelivered) oldDelivered.remove();

    if (checkbox.checked) {
        const timestamp = new Date().toLocaleString();
        localStorage.setItem(key, timestamp);

        const newSpan = document.createElement("span");
        newSpan.className = "delivered-time";
        newSpan.style.color = "blue";
        newSpan.style.fontSize = "13px";
        newSpan.textContent = ` | Delivered: ${timestamp}`;
        infoSpan.appendChild(newSpan);
    } else {
        localStorage.removeItem(key);
    }
}


function playClickSound() {
    const sound = new Audio();
    sound.play().catch(e => console.log("Audio play error:", e));
}
function scrollToTop() {
    playClickSound(); //  play
    window.scrollTo({ top: 0, behavior: "smooth" });
}
function toggleEntries() {
    playClickSound(); // 

    const entrySection = document.getElementById("entries-section");
    const button = event.target;

    if (entrySection.style.display === "none") {
        entrySection.style.display = "block";
        button.textContent = "Hide Entries";
        loadEntries();
    } else {
        entrySection.style.display = "none";
        button.textContent = "Show Entries";
    }
}
function toggleTotals() {
    playClickSound(); // ✅ sound

    const totalDiv = document.getElementById("total-quantity");
    const button = event.target;

    if (totalDiv.style.display === "none") {
        totalDiv.style.display = "block";
        button.textContent = "Hide Totals";
        loadEntries(); // reload totals
    } else {
        totalDiv.style.display = "none";
        button.textContent = "Show Totals";
    }
}
function appendCalc(val) {
    const display = document.getElementById("calc-display");
    if (val === '×') val = '*';
    if (val === '÷') val = '/';
    display.value += val;
  }


  
  function calculateResult() {
    const display = document.getElementById("calc-display");
    try {
      display.value = eval(display.value);
    } catch {
      display.value = "Error";
    }
  }


  function toggleCalculator(show = true) {
    document.getElementById("calculator-popup").style.display = show ? "flex" : "none";
  }
  
  function copyResult() {
    const display = document.getElementById("calc-display");
    navigator.clipboard.writeText(display.value).then(() => {
      alert("📋 Result Copied!");
    });
  }
  function backupDateEntriesToClipboard() {
    const selectedDate = document.getElementById("date").value;
    let entries = JSON.parse(localStorage.getItem("entries")) || [];
    let filtered = entries.filter(e => e.date === selectedDate);
    if (filtered.length === 0) {
        alert("No entries for selected date!");
        return;
    }
    navigator.clipboard.writeText(JSON.stringify(filtered, null, 2))
        .then(() => alert("Selected Date Entries copied to clipboard!"))
        .catch(() => alert("Clipboard copy failed."));
}
function restoreDateEntriesFromClipboard() {
    let input = prompt("Paste your Date Entries backup here:");
    if (!input) return;
    try {
        let data = JSON.parse(input);
        if (Array.isArray(data)) {
            let entries = JSON.parse(localStorage.getItem("entries")) || [];
            entries = entries.concat(data);
            localStorage.setItem("entries", JSON.stringify(entries));
            loadEntries();
            alert("Entries restored successfully!");
        } else {
            alert("Invalid data format!");
        }
    } catch (e) {
        alert("Error parsing date entries!");
    }
}
// Backup all data for the selected month



// Show/Hide restore section



function hideRestoreMonthSection() {
    document.getElementById("restore-month-section").style.display = "none";
    document.getElementById("restore-month-status").textContent = "";
    document.getElementById("month-backup-file").value = "";
}

// Restore month data


companyEntries.forEach(entry => {
  companyContentDiv.innerHTML += `
    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding: 4px 0;">
      <span>${entry.name}</span>
      <span>${entry.town}</span>
      <span class="red-bold">${entry.quantity}</span>
    </div>
  `;
});

// Save Button function with voice and popup only


					
// Function to handle marking as delivered					
function markAsDelivered(entryKey, checkbox, town, date) {					
if (checkbox.checked) {					
const timestamp = new Date().toLocaleString();					
localStorage.setItem(`delivered-${entryKey}`, timestamp);					
					
// Refresh the town view					
const entries = JSON.parse(localStorage.getItem("entries") || []);					
const filteredEntries = entries.filter(e => e.date === date && e.town === town);					
showTownEntries(town, filteredEntries, date);					
}					
}					
function openCompanyWisePopup() {
    const modal = document.getElementById("companyWiseModal");
    const companyListDiv = document.getElementById("companyButtonList");
    const companyContentDiv = document.getElementById("companyContentView");
    companyListDiv.innerHTML = "";
    companyContentDiv.innerHTML = "";
  
    let entries = JSON.parse(localStorage.getItem("entries") || []);
    let selectedDate = document.getElementById("date").value;
    let filteredEntries = entries.filter(e => e.date === selectedDate);
  
    let companyGroups = {};
    filteredEntries.forEach(entry => {
      if (!companyGroups[entry.company]) {
        companyGroups[entry.company] = { total: 0, towns: {} };
      }
  
      if (!companyGroups[entry.company].towns[entry.town]) {
        companyGroups[entry.company].towns[entry.town] = { total: 0, entries: [] };
      }
  
      companyGroups[entry.company].total += parseInt(entry.quantity);
      companyGroups[entry.company].towns[entry.town].total += parseInt(entry.quantity);
      companyGroups[entry.company].towns[entry.town].entries.push(entry);
    });
  
    const companyNames = Object.keys(companyGroups).reverse();
  
    let buttonContainer = document.createElement("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.overflowX = "auto";
    buttonContainer.style.gap = "10px";
    buttonContainer.style.marginBottom = "20px";
    buttonContainer.style.padding = "10px";
    buttonContainer.style.whiteSpace = "nowrap";
  
    companyNames.forEach((company, index) => {
      let btn = document.createElement("button");
      btn.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <span style="font-weight: bold; color: rgb(34, 15, 157); font-size: 16px;">${company}</span>
          <span style="color: red; font-weight: bold; font-size: 14px;">${companyGroups[company].total}</span>
        </div>
      `;
      btn.style.padding = "10px 20px";
      btn.style.border = "none";
      btn.style.borderRadius = "15px";
      btn.style.backgroundColor = "#03111eff";
      btn.style.cursor = "pointer";
      btn.style.minWidth = "120px";
      btn.style.boxShadow = "0 2px 5px rgba(0,0,0,0.1)";
      btn.style.transition = "all 0.3s ease";
  
      btn.onmouseover = () => {
        btn.style.transform = "scale(1.05)";
      };
      btn.onmouseout = () => {
        btn.style.transform = "scale(1)";
      };
  
      btn.onclick = () => {
        showCompanyDetails(company, companyGroups[company]);
      };
  
      buttonContainer.appendChild(btn);
      if (index === 0) btn.click(); // auto-click latest company
    });
  
    companyListDiv.appendChild(buttonContainer);
    modal.style.display = "flex";
}
  
function showCompanyDetails(company, data) {
    const container = document.getElementById("companyContentView");
    container.innerHTML = `
        <h3 style="color: darkblue; border-bottom: 1px solid #eeeeeeff; padding-bottom: 5px;">
            ${company} - Total: <span style="color: red; font-weight: bold;">${data.total}</span>
        </h3>
    `;
  
    Object.keys(data.towns).forEach(town => {
      let townSection = document.createElement("div");
      townSection.className = "company-section";
      townSection.style.marginTop = "15px";
  
      let townHeader = document.createElement("h4");
      townHeader.innerHTML = `
          ${town} - <span style="color: red; font-weight: bold;">${data.towns[town].total}</span>
      `;
      townHeader.style.margin = "0 0 5px 0";
      townHeader.style.color = "#791ad2ff";
      townSection.appendChild(townHeader);
  
      data.towns[town].entries.forEach(entry => {
        let p = document.createElement("p");
        p.innerHTML = `
            • ${entry.name}: <span style="color: red; font-weight: bold;">${entry.quantity}</span>
        `;
        p.style.margin = "3px 0";
        p.style.paddingLeft = "10px";
        townSection.appendChild(p);
      });
  
      container.appendChild(townSection);
    });
}

// In the openTownWisePopup function where you create town buttons
btn.style.cssText = `
    padding: 10px;
    border-radius: 5px;
    border: none;
    background: linear-gradient(to right, #3a7bd5, #00d2ff);
    color: white;
    cursor: pointer;
    flex-shrink: 0;
    font-weight: bold;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    transition: all 0.3s ease;
`;

// Add hover effect
btn.onmouseover = function() {
    this.style.transform = "scale(1.05)";
    this.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
};
btn.onmouseout = function() {
    this.style.transform = "scale(1)";
    this.style.boxShadow = "0 2px 5px rgba(0,0,0,0.1)";
};

    

function updateDeliveredStatus(nameTownBox, checkboxes) {
    let allChecked = checkboxes.every(checkbox => checkbox.checked);
    let statusText = nameTownBox.querySelector(".delivered-status");

    if (allChecked) {
        if (!statusText) {
            statusText = document.createElement("span");
            statusText.className = "delivered-status";
            statusText.innerHTML = "Done";  // Changed from "Delivered Done"
            statusText.style.color = "#1d07e1ff";  // Pink color for the heart
            statusText.style.fontWeight = "bold";
            statusText.style.marginLeft = "10px";
            statusText.style.fontSize = "1.1em";
            statusText.style.animation = "heartbeat 1s ease-in-out";
            nameTownBox.appendChild(statusText);
            
            // Add heartbeat animation
            const style = document.createElement('style');
            style.innerHTML = `
                @keyframes heartbeat {
                    0% { transform: scale(1); }
                    25% { transform: scale(1.1); }
                    50% { transform: scale(1); }
                    75% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }
            `;
            document.head.appendChild(style);
        }
    } else {
        if (statusText) {
            nameTownBox.removeChild(statusText);
        }
    }
}
// When creating the checkbox container
checkboxContainer.style.display = "flex";
checkboxContainer.style.alignItems = "center";
checkboxContainer.style.gap = "5px";
checkboxContainer.style.padding = "5px";
checkboxContainer.style.borderRadius = "4px";
checkboxContainer.style.backgroundColor = allChecked ? "#e8f5e9" : "transparent"; // Green background when all checked
checkboxContainer.style.transition = "background-color 0.3s ease";

// For the checkboxes
checkbox.style.accentColor = "#4CAF50"; // Green checkbox color
checkbox.style.width = "16px";
checkbox.style.height = "16px";
checkbox.style.cursor = "pointer";


function showTownEntries(town, entries, date) {
    const townContentDiv = document.getElementById("townContentView");

    let townTotal = 0;
    let deliveredTotal = 0;

    // ✅ Name(Town) အလိုက် Group
    const grouped = {};
    entries.forEach(entry => {
        const qty = parseInt(entry.quantity);
        townTotal += qty;

        const key = `${entry.name} (${entry.town})`;
        if (!grouped[key]) {
            grouped[key] = { qty: 0, delivered: 0, details: [] };
        }
        grouped[key].qty += qty;

        // Delivered check
        const storageKey = `delivered-${date}-${town}-${entry.name.replace(/[^a-zA-Z0-9]/g, "-")}`;
        const isDelivered = localStorage.getItem(storageKey);
        if (isDelivered) {
            grouped[key].delivered += qty;
            deliveredTotal += qty;
        }

        grouped[key].details.push(entry);
    });

    // HTML build
    let deliveredHTML = [];
    let pendingHTML = [];

    Object.keys(grouped).forEach((key, idx) => {
        const g = grouped[key];
        if (g.delivered >= g.qty) {
            deliveredHTML.push(`${key}: <span style="color:red;font-weight:bold;">${g.qty}</span>`);
        } else {
            pendingHTML.push(`
                <label style="display:flex;align-items:center;gap:5px;">
                    <input type="checkbox" onchange="markGroupAsDelivered('${date}','${town}','${key}')">
                    ${key}: <span style="color:red;font-weight:bold;">${g.qty}</span>
                </label>
            `);
        }
    });

    const html = `
        <div style="border:2px solid #ddd; border-radius:8px; padding:10px; margin-bottom:15px;">
            <h3 style="margin:0 0 10px 0;">
                ${town} - Total: <span style="color:red;font-weight:bold;">${townTotal}</span>
                (Delivered: <span style="color:green;">${deliveredTotal}</span> | 
                Pending: <span style="color:red;">${townTotal - deliveredTotal}</span>)
            </h3>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                <div>
                    <h4 style="color:green; margin:5px 0;">Delivered</h4>
                    <div style="background:#f0fff0; padding:8px; border-radius:5px;">
                        ${deliveredHTML.join('<br>') || '<span style="color:#999;">None</span>'}
                    </div>
                </div>
                <div>
                    <h4 style="color:red; margin:5px 0;">Pending</h4>
                    <div style="background:#fff0f0; padding:8px; border-radius:5px;">
                        ${pendingHTML.join('<br>') || '<span style="color:#999;">None</span>'}
                    </div>
                </div>
            </div>
        </div>
    `;

    townContentDiv.innerHTML = html;
}

// ✅ Group ကို Delivered ပြောင်း
function markGroupAsDelivered(date, town, groupKey) {
    const entries = JSON.parse(localStorage.getItem("entries")) || [];
    const keyName = groupKey.replace(/\s*\([^)]*\)\s*/, ""); // Name only
    const keyTown = groupKey.match(/\(([^)]+)\)/)[1]; // Town only

    entries.forEach((entry, idx) => {
        if (entry.date === date && entry.town === keyTown && entry.name === keyName) {
            const storageKey = `delivered-${date}-${town}-${entry.name.replace(/[^a-zA-Z0-9]/g, "-")}`;
            localStorage.setItem(storageKey, new Date().toLocaleString());
        }
    });

    const filtered = entries.filter(e => e.date === date && e.town === town);
    showTownEntries(town, filtered, date);
}
													
function markNameTownAsDelivered(name, town, date, checkbox) {
    if (checkbox.checked) {
        // Get all entries for this name+town combination
        const entries = JSON.parse(localStorage.getItem("entries")) || [];
        const filteredEntries = entries.filter(e => 
            e.date === date &&
            e.name === name &&
            e.town === town
        );

        // Mark all matching entries as delivered
        filteredEntries.forEach((entry, index) => {
            const entryKey = `${date}_${entry.name}_${entry.town}_${entry.quantity}_${index}`;
            const storageKey = `delivered-${entryKey}`;
            
            // Only mark if not already delivered
            if (!localStorage.getItem(storageKey)) {
                const timestamp = new Date().toLocaleString();
                localStorage.setItem(storageKey, timestamp);
            }
        });

        // Refresh the town view
        setTimeout(() => {
            const allEntries = JSON.parse(localStorage.getItem("entries")) || [];
            const townEntries = allEntries.filter(e => e.date === date && e.town === town);
            showTownEntries(town, townEntries, date);
        }, 300);
    }
}						
							
// ✅ Town Wise ကို နှိပ်လိုက်ရင် Town Wise Section ကို ပြမယ်
// ✅ Town Wise ကို နှိပ်လိုက်ရင် Town Wise Section ကို ပြမယ်
function openTownWisePopup() {
    // Town Wise popup: show town total + Remark Total + Credit Total.
    let oldModal = document.getElementById("townWiseNewModal");
    if (oldModal) oldModal.remove();

    const modal = document.createElement("div");
    modal.id = "townWiseNewModal";
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.backgroundColor = "rgba(0,0,0,0.6)";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.zIndex = "9999";

    const box = document.createElement("div");
    box.style.background = "#dfcdcdff";
    box.style.padding = "20px";
    box.style.borderRadius = "10px";
    box.style.maxHeight = "80vh";
    box.style.overflowY = "auto";
    box.style.minWidth = "300px";
    box.style.textAlign = "center";
    box.style.position = "relative";

    const selectedDate = document.getElementById("date")?.value || "";
    const entries = JSON.parse(localStorage.getItem("entries") || "[]");
    const filteredEntries = entries.filter(e => String(e.date || "") === String(selectedDate));

    // Today at a Glance title — show the numeric total quantity for all towns.
    const title = document.createElement("div");
    const todayTotalQuantity = filteredEntries.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
    title.innerHTML = `<strong>Today at a Glance</strong> <strong style="color:#dc2626 !important;-webkit-text-fill-color:#dc2626 !important;font-weight:900 !important;">${todayTotalQuantity}</strong>`;
    title.style.fontSize = "22px";
    title.style.color = "#263238";
    title.style.marginBottom = "14px";
    box.appendChild(title);

    const townListDiv = document.createElement("div");
    townListDiv.style.display = "flex";
    townListDiv.style.flexDirection = "column";
    townListDiv.style.alignItems = "stretch";
    townListDiv.style.gap = "10px";
    townListDiv.style.marginBottom = "15px";

    const townTotals = {};
    filteredEntries.forEach(entry => {
        const town = String(entry.town || "Unknown").trim() || "Unknown";
        if (!townTotals[town]) townTotals[town] = { total: 0, remark: 0 };
        townTotals[town].total += Number(entry.quantity) || 0;
    });

    let remarkEntries = [];
    try {
        const raw = JSON.parse(localStorage.getItem("remarkEntries") || "[]");
        remarkEntries = Array.isArray(raw) ? raw : [];
    } catch (e) {
        remarkEntries = [];
    }

    remarkEntries
        .filter(r => String(r.date || "") === String(selectedDate))
        .forEach(r => {
            const town = String(r.town || "Unknown").trim() || "Unknown";
            if (!townTotals[town]) townTotals[town] = { total: 0, remark: 0 };
            townTotals[town].remark += Number(r.quantity) || 0;
        });

    const townNames = Object.keys(townTotals).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })
    );

    townNames.forEach(town => {
        const data = townTotals[town];
        const btn = document.createElement("button");
        btn.className = "townWiseTopPopupBtn";
        const remarkPart = data.remark > 0
            ? ` <strong style="color:#8e44ad !important;-webkit-text-fill-color:#8e44ad !important;font-weight:900 !important;margin-left:10px;">Remark (${data.remark})</strong>`
            : "";
        btn.innerHTML = `<strong style="color:#1565c0 !important;-webkit-text-fill-color:#1565c0 !important;font-weight:900 !important;">${escapeHtmlSimple(town)} (${data.total})</strong>${remarkPart}`;
        btn.style.padding = "11px 14px";
        btn.style.border = "1px solid #ccc";
        btn.style.borderRadius = "8px";
        btn.style.background = "#f9f9f9";
        btn.style.cursor = "pointer";
        btn.style.width = "100%";
        btn.style.fontSize = "16px";
        btn.style.fontWeight = "900";
        townListDiv.appendChild(btn);
    });

    if (!townNames.length) {
        const empty = document.createElement("div");
        empty.textContent = "No entries";
        empty.style.color = "#777";
        empty.style.fontWeight = "700";
        empty.style.padding = "10px";
        townListDiv.appendChild(empty);
    }

    // Credit Total — use Credit List data, filtered by the selected date.
    // This matches the Credit List entry date so Today at a Glance shows
    // only Credit Quantity for the selected day.
    let creditTotal = 0;
    try {
        const creditData = JSON.parse(localStorage.getItem("creditEntries") || "{}");
        Object.values(creditData).forEach(townEntries => {
            if (!Array.isArray(townEntries)) return;
            townEntries.forEach(entry => {
                if (String(entry.date || "") === String(selectedDate || "")) {
                    creditTotal += Number(entry.quantity) || 0;
                }
            });
        });
    } catch (e) {
        console.error("Credit List date-filtered total error:", e);
    }

    const creditLine = document.createElement("div");
    creditLine.innerHTML = `💳 <strong>Credit Total: ${creditTotal}</strong>`;
    creditLine.style.marginTop = "4px";
    creditLine.style.marginBottom = "15px";
    creditLine.style.padding = "10px 12px";
    creditLine.style.borderRadius = "8px";
    creditLine.style.background = "#f9f9f9";
    creditLine.style.color = "#c0392b";
    creditLine.style.fontSize = "17px";
    box.appendChild(townListDiv);
    box.appendChild(creditLine);

    const closeBtn = document.createElement("button");
    closeBtn.className = "townWiseTopPopupClose";
    closeBtn.innerText = "Close";
    closeBtn.style.marginTop = "0";
    closeBtn.style.padding = "7px 18px";
    closeBtn.style.fontSize = "16px";
    closeBtn.style.border = "1px solid red";
    closeBtn.style.borderRadius = "4px";
    closeBtn.style.background = "#7a7474ff";
    closeBtn.style.color = "#1565c0";
    closeBtn.style.fontWeight = "900";
    closeBtn.style.cursor = "pointer";
    closeBtn.onclick = () => modal.remove();

    box.appendChild(closeBtn);
    modal.appendChild(box);
    document.body.appendChild(modal);
}



    // Create town buttons with only town name and quantity
    Object.keys(townTotals).forEach((town, index) => {
        let totalQty = townTotals[town];

        let btn = document.createElement("button");
        // MODIFIED: Show only town name and quantity with red bold quantity
        btn.innerHTML = `<strong>${town} </strong><strong style="color: red;">(${totalQty})</strong>`;
        btn.style.margin = "5px";
        btn.style.padding = "8px";
        btn.style.borderRadius = "5px";
        btn.style.textAlign = "center";
        btn.style.width = "140px";
    
        townListDiv.appendChild(btn);
    });

    modal.style.display = "flex";
function openCalculator() {
  const box = document.getElementById("calculator");
  if (!box) return;

  // Keep the calculator outside any transformed/app container so the modal
  // always covers the full screen and stays centered on phones/tablets.
  if (box.parentElement !== document.body) {
    document.body.appendChild(box);
  }

  box.style.position = "fixed";
  box.style.left = "0";
  box.style.top = "0";
  box.style.right = "0";
  box.style.bottom = "0";
  box.style.width = "100vw";
  box.style.height = "100vh";
  box.style.display = "flex";
  box.style.alignItems = "center";
  box.style.justifyContent = "center";
  box.style.zIndex = "2147483647";

  const d = document.getElementById("calc-display");
  if (d) {
    d.value = "0";
    d.scrollLeft = d.scrollWidth;
  }
  const e = document.getElementById("tko-calc-expression");
  if (e) e.textContent = "";
}

function closeCalculator() {
  const box = document.getElementById("calculator");
  if (box) box.style.display = "none";
}

function appendToCalc(value) {
  const display = document.getElementById("calc-display");
  if(!display)return;
  if(display.value === "0" && value !== ".") display.value = "";
  display.value += value;
  display.scrollLeft = display.scrollWidth;
}

function clearCalc() {
  const d=document.getElementById("calc-display");
  if(d) d.value='0';
  const e=document.getElementById("tko-calc-expression");
  if(e) e.textContent="";
}

function backspaceCalc() {
  const display = document.getElementById("calc-display");
  display.value = display.value.slice(0, -1);
  display.scrollLeft = display.scrollWidth;
}

function calculateCalc() {
  const display = document.getElementById("calc-display");
  try {
    display.value = eval(display.value);
  } catch {
    display.value = 'Error';
  }

  display.scrollLeft = display.scrollWidth;
}


// ===== TKO Standard Calculator helpers =====
let tkoCalcMemory = 0;
function tkoCalcNumber(){
  const n = Number(document.getElementById("calc-display")?.value || 0);
  return Number.isFinite(n) ? n : 0;
}
function tkoCalcSet(value, expression){
  const d=document.getElementById("calc-display");
  if(!d)return;
  d.value = String(value);
  d.scrollLeft=d.scrollWidth;
  const e=document.getElementById("tko-calc-expression");
  if(e && expression!==undefined) e.textContent=String(expression);
}
function percentCalc(){
  const d=document.getElementById("calc-display"); if(!d)return;
  const v=tkoCalcNumber(); tkoCalcSet(v/100, v + "%");
}
function reciprocalCalc(){
  const v=tkoCalcNumber();
  if(v===0){tkoCalcSet("Error","Cannot divide by zero");return;}
  tkoCalcSet(1/v,"1/"+v);
}
function squareCalc(){const v=tkoCalcNumber();tkoCalcSet(v*v,v+"²");}
function sqrtCalc(){const v=tkoCalcNumber();if(v<0){tkoCalcSet("Error","Invalid input");return;}tkoCalcSet(Math.sqrt(v),"√("+v+")");}
function toggleSignCalc(){const d=document.getElementById("calc-display");if(!d)return;const v=tkoCalcNumber();tkoCalcSet(v===0?0:-v,"±");}
function memoryClear(){tkoCalcMemory=0;}
function memoryRecall(){tkoCalcSet(tkoCalcMemory,"MR");}
function memoryAdd(){tkoCalcMemory+=tkoCalcNumber();}
function memorySubtract(){tkoCalcMemory-=tkoCalcNumber();}
function memoryStore(){tkoCalcMemory=tkoCalcNumber();}


		
function openDebtModal() {
  document.getElementById("debtModal").style.display = "block";

  // Load existing values
  document.getElementById("toReceive").value = localStorage.getItem("debtToReceive") || "";
  document.getElementById("toGive").value = localStorage.getItem("debtToGive") || "";
}

function closeDebtModal() {
  document.getElementById("debtModal").style.display = "none";
}

function saveDebt() {
  const toReceive = document.getElementById("toReceive").value;
  const toGive = document.getElementById("toGive").value;

  localStorage.setItem("debtToReceive", toReceive);
  localStorage.setItem("debtToGive", toGive);

  alert("✅ Saved");
  closeDebtModal();
  loadDebtSummary();
}

function loadDebtSummary() {
  document.getElementById("savedReceive").innerText = localStorage.getItem("debtToReceive") || "မရှိသေးပါ။";
  document.getElementById("savedGive").innerText = localStorage.getItem("debtToGive") || "မရှိသေးပါ။";
}

// Load summary on page load
window.onload = loadDebtSummary;
function closeCompanyWisePopup() {
    document.getElementById("companyWiseModal").style.display = "none";
}
// ============================================
// COMPLETE INCOME SYSTEM - FIXED & CENTERED
// ============================================

// ✅ 1. SHOW INCOME POPUP (FIXED - CENTERED)
function showIncomePopup() {
    console.log("showIncomePopup called");
    
    // Remove any existing password modal
    const existingModal = document.getElementById("incomePasswordModal");
    if (existingModal) existingModal.remove();
    
    // Create password modal
    const modal = document.createElement("div");
    modal.id = "incomePasswordModal";
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 99999;
    `;
    
    // Modal content - CENTERED
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 12px;
            padding: 30px;
            width: 350px;
            max-width: 90vw;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            position: relative;
        ">
            <h3 style="margin: 0 0 20px 0; text-align: center; color: #333;">
                Password လေး။😁😁😁
            </h3>
            
            <input type="password" 
                   id="incomePassword" 
                   placeholder="Password"
                   style="
                       width: 100%;
                       padding: 12px 15px;
                       margin-bottom: 20px;
                       border: 1px solid #ddd;
                       border-radius: 6px;
                       font-size: 16px;
                       box-sizing: border-box;
                   ">
            
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <button onclick="checkIncomePassword()" 
                        style="
                            flex: 1;
                            padding: 12px;
                            background: #4CAF50;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            font-size: 16px;
                            cursor: pointer;
                        ">
                    OK
                </button>
                <button onclick="closePasswordModal()" 
                        style="
                            flex: 1;
                            padding: 12px;
                            background: #f44336;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            font-size: 16px;
                            cursor: pointer;
                        ">
                    Cancel
                </button>
            </div>
            
            <div style="text-align: center;">
                <a href="#" onclick="showForgetPassword(); return false;" 
                   style="color: #2196F3; text-decoration: none; font-size: 14px;">
                    Forget Password?
                </a>
            </div>
            
          
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Focus and enter key
    setTimeout(() => {
        const input = document.getElementById("incomePassword");
        if (input) {
            input.focus();
            input.addEventListener("keypress", function(e) {
                if (e.key === "Enter") checkIncomePassword();
            });
        }
    }, 100);
}

// ✅ 2. CLOSE PASSWORD MODAL
function closePasswordModal() {
    const modal = document.getElementById("incomePasswordModal");
    if (modal) modal.remove();
}

// ✅ 3. CHECK PASSWORD
function checkIncomePassword() {
    const password = document.getElementById("incomePassword").value;
    const savedPassword = localStorage.getItem("incomePassword") || "232298";
    
    if (password === savedPassword) {
        closePasswordModal();
        showIncomeModal();
    } else {
        alert("Wrong password! Try Again");
        document.getElementById("incomePassword").value = "";
        document.getElementById("incomePassword").focus();
    }
}

// ✅ 4. CREATE INCOME MODAL (FIXED)
function createIncomeModal() {
    // Remove if exists
    const existing = document.getElementById("incomeModal");
    if (existing) existing.remove();
    
    const modal = document.createElement("div");
    modal.id = "incomeModal";
    modal.style.cssText = `
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.5);
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            padding: 25px;
            border-radius: 12px;
            width: 95%;
            max-width: 800px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            position: relative;
        ">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #2c3e50; display: flex; align-items: center; gap: 10px;">
                    💰 Income
                </h2>
                <div style="display: flex; gap: 10px;">
                    <button onclick="copyIncomeData()" 
                            style="
                                padding: 8px 15px;
                                background: #3498db;
                                color: white;
                                border: none;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 14px;
                            ">
                        📋 Copy
                    </button>
                    <button onclick="closeIncomeModal()" 
                            style="
                                padding: 8px 15px;
                                background: #e74c3c;
                                color: white;
                                border: none;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 14px;
                            ">
                        ✕ Close
                    </button>
                </div>
            </div>
            
            <!-- Input Section -->
            <div style="
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin-bottom: 20px;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 8px;
            ">
                <div style="flex: 1; min-width: 150px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Date</label>
                    <input type="date" id="income-date" 
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
                </div>
                
                <div style="flex: 2; min-width: 200px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Amount (MMK)</label>
                    <input type="number" id="income-amount" placeholder="Enter amount" 
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px;">
                </div>
                
                <div style="flex: 1; min-width: 100px; align-self: flex-end;">
                    <button onclick="addIncome()" 
                            style="
                                width: 100%;
                                padding: 12px;
                                background: #2ecc71;
                                color: white;
                                border: none;
                                border-radius: 6px;
                                font-weight: bold;
                                cursor: pointer;
                                font-size: 16px;
                            ">
                        ADD
                    </button>
                </div>
            </div>
            
            <!-- Income List -->
            <div id="income-list" style="
                max-height: 400px;
                overflow-y: auto;
                margin-bottom: 20px;
                border: 1px solid #eee;
                border-radius: 8px;
                padding: 15px;
                background: #f9f9f9;
            "></div>
            
            <!-- Summary -->
            <div style="
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <div>
                    <h3 style="margin: 0; color: #2c3e50;">
                        📅 Monthly Total: 
                        <span id="monthly-total" style="color: #e74c3c; font-weight: bold;">0</span> MMK
                    </h3>
                </div>
                <button onclick="showChangePasswordModal()" 
                        style="
                            padding: 8px 15px;
                            background: #9b59b6;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 14px;
                        ">
                    🔑 Change Password
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    return modal;
}

// ✅ 5. SHOW INCOME MODAL
function showIncomeModal() {
    let modal = document.getElementById("incomeModal");
    if (!modal) {
        modal = createIncomeModal();
    }
    modal.style.display = "flex";
    loadIncomeData();
    
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("income-date").value = today;
}

// ✅ 6. CLOSE INCOME MODAL
function closeIncomeModal() {
    const modal = document.getElementById("incomeModal");
    if (modal) modal.style.display = "none";
}

// ✅ 7. ADD INCOME
function addIncome() {
    const date = document.getElementById("income-date").value;
    const amount = document.getElementById("income-amount").value;
    
    if (!date || !amount) {
        alert("Please fill both date and amount");
        return;
    }
    
    if (amount <= 0) {
        alert("Please enter valid amount");
        return;
    }
    
    const incomeData = JSON.parse(localStorage.getItem("incomeRecords") || "{}");
    
    if (!incomeData[date]) {
        incomeData[date] = [];
    }
    
    incomeData[date].push({
        amount: parseInt(amount),
        timestamp: new Date().toLocaleString()
    });
    
    localStorage.setItem("incomeRecords", JSON.stringify(incomeData));
    document.getElementById("income-amount").value = "";
    loadIncomeData();
    
    
}

// ✅ 8. LOAD INCOME DATA
function loadIncomeData() {
    const incomeData = JSON.parse(localStorage.getItem("incomeRecords") || "{}");
    const incomeList = document.getElementById("income-list");
    const selectedDate = document.getElementById("date").value;
    const [currentYear, currentMonth] = selectedDate.split('-').slice(0, 2);
    
    incomeList.innerHTML = "";
    let monthlyTotal = 0;
    
    // Sort dates descending
    const sortedDates = Object.keys(incomeData).sort((a, b) => new Date(b) - new Date(a));
    
    if (sortedDates.length === 0) {
        incomeList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #999;">
                📭 No income records yet
            </div>
        `;
        document.getElementById("monthly-total").textContent = "0";
        return;
    }
    
    sortedDates.forEach(date => {
        const [year, month] = date.split('-').slice(0, 2);
        const isCurrentMonth = (year === currentYear && month === currentMonth);
        
        // Calculate total for this date
        const dateTotal = incomeData[date].reduce((sum, entry) => sum + entry.amount, 0);
        
        if (isCurrentMonth) {
            monthlyTotal += dateTotal;
        }
        
        // Create date entry
        const entryDiv = document.createElement("div");
        entryDiv.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 15px;
            margin-bottom: 8px;
            background: white;
            border-radius: 6px;
            border-left: 4px solid ${isCurrentMonth ? '#2ecc71' : '#95a5a6'};
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        `;
        
        entryDiv.innerHTML = `
            <div>
                <div style="font-weight: bold; color: #333;">${date}</div>
                <div style="font-size: 12px; color: #777;">
                    ${incomeData[date].length} record${incomeData[date].length > 1 ? 's' : ''}
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="color: #e74c3c; font-weight: bold; font-size: 16px;">
                    ${dateTotal.toLocaleString()} MMK
                </span>
                <button onclick="deleteAllIncomeForDate('${date}')" 
                        style="
                            color: #e74c3c;
                            background: none;
                            border: 1px solid #e74c3c;
                            border-radius: 4px;
                            width: 30px;
                            height: 30px;
                            cursor: pointer;
                            font-size: 14px;
                        ">
                    ✕
                </button>
            </div>
        `;
        
        incomeList.appendChild(entryDiv);
    });
    
    // Update monthly total
    document.getElementById("monthly-total").textContent = monthlyTotal.toLocaleString();
}

// ✅ 9. DELETE INCOME FOR DATE
function deleteAllIncomeForDate(date) {
    if (!confirm(`Delete all income records for ${date}?`)) return;
    
    const incomeData = JSON.parse(localStorage.getItem("incomeRecords") || "{}");
    delete incomeData[date];
    localStorage.setItem("incomeRecords", JSON.stringify(incomeData));
    loadIncomeData();
}

// ✅ 10. COPY INCOME DATA
function copyIncomeData() {
    const incomeData = JSON.parse(localStorage.getItem("incomeRecords") || "{}");
    const selectedDate = document.getElementById("date").value;
    const [currentYear, currentMonth] = selectedDate.split('-').slice(0, 2);
    
    let output = "📊 INCOME REPORT\n";
    output += "=".repeat(40) + "\n\n";
    
    let monthlyTotal = 0;
    const sortedDates = Object.keys(incomeData).sort((a, b) => new Date(a) - new Date(b));
    
    // Current month data
    output += `Month: ${currentYear}-${currentMonth}\n`;
    output += "-".repeat(30) + "\n";
    
    sortedDates.forEach(date => {
        const [year, month] = date.split('-').slice(0, 2);
        const isCurrentMonth = (year === currentYear && month === currentMonth);
        
        if (isCurrentMonth) {
            const dateTotal = incomeData[date].reduce((sum, entry) => sum + entry.amount, 0);
            monthlyTotal += dateTotal;
            
            output += `${date}: ${dateTotal.toLocaleString()} MMK\n`;
            incomeData[date].forEach(entry => {
                output += `  • ${entry.amount.toLocaleString()} MMK (${entry.timestamp})\n`;
            });
            output += "\n";
        }
    });
    
    output += `\nMonthly Total: ${monthlyTotal.toLocaleString()} MMK\n`;
    output += `Total Records: ${Object.keys(incomeData).length} dates\n`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(output).then(() => {
        alert("✅ Income data copied to clipboard!");
    }).catch(err => {
        // Fallback
        const textarea = document.createElement("textarea");
        textarea.value = output;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        alert("✅ Income data copied!");
    });
}

// ✅ 11. FORGET PASSWORD
function showForgetPassword() {
    closePasswordModal();
    
    const modal = document.createElement("div");
    modal.id = "forgetPasswordModal";
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 99999;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            padding: 25px;
            border-radius: 12px;
            width: 350px;
            max-width: 90vw;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            position: relative;
        ">
            <h3 style="margin: 0 0 15px 0; text-align: center; color: #333;">
                Reset Password
            </h3>
            
            <p style="color: #666; margin-bottom: 15px; font-size: 14px; text-align: center;">
               
            </p>
            
            <input type="text" 
                   id="securityCode" 
                   placeholder="Security Code"
                   style="
                       width: 100%;
                       padding: 12px 15px;
                       margin-bottom: 20px;
                       border: 1px solid #ddd;
                       border-radius: 6px;
                       font-size: 16px;
                       text-align: center;
                   ">
            
            <div style="display: flex; gap: 10px;">
                <button onclick="verifySecurityCode()" 
                        style="
                            flex: 1;
                            padding: 12px;
                            background: #4CAF50;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            font-size: 16px;
                            cursor: pointer;
                        ">
                    Verify
                </button>
                <button onclick="closeForgetPasswordModal()" 
                        style="
                            flex: 1;
                            padding: 12px;
                            background: #f44336;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            font-size: 16px;
                            cursor: pointer;
                        ">
                    Cancel
                </button>
            </div>
            
          
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => {
        document.getElementById("securityCode").focus();
    }, 100);
}

// ✅ 12. VERIFY SECURITY CODE
function verifySecurityCode() {
    const code = document.getElementById("securityCode").value;
    
    if (code === "reset123") {
        closeForgetPasswordModal();
        showChangePasswordModal();
    } else {
        alert("Invalid security code!");
        document.getElementById("securityCode").value = "";
        document.getElementById("securityCode").focus();
    }
}

// ✅ 13. CLOSE FORGET PASSWORD MODAL
function closeForgetPasswordModal() {
    const modal = document.getElementById("forgetPasswordModal");
    if (modal) modal.remove();
}

// ✅ 14. CHANGE PASSWORD MODAL
function showChangePasswordModal() {
    const modal = document.createElement("div");
    modal.id = "changePasswordModal";
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 99999;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            padding: 25px;
            border-radius: 12px;
            width: 350px;
            max-width: 90vw;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            position: relative;
        ">
            <h3 style="margin: 0 0 20px 0; text-align: center; color: #333;">
                Change Password
            </h3>
            
            <input type="password" 
                   id="newPassword" 
                   placeholder="New Password"
                   style="
                       width: 100%;
                       padding: 12px 2px;
                       margin-bottom: 10px;
                       border: 1px solid #ddd;
                       border-radius: 6px;
                       font-size: 16px;
                   ">
            
            <input type="password" 
                   id="confirmPassword" 
                   placeholder="Confirm Password"
                   style="
                       width: 100%;
                       padding: 12px 2px;
                       margin-bottom: 20px;
                       border: 1px solid #ddd;
                       border-radius: 6px;
                       font-size: 16px;
                   ">
            
            <div style="display: flex; gap: 10px;">
                <button onclick="saveNewPassword()" 
                        style="
                            flex: 1;
                            padding: 12px;
                            background: #4CAF50;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            font-size: 16px;
                            cursor: pointer;
                        ">
                    Save
                </button>
                <button onclick="closeChangePasswordModal()" 
                        style="
                            flex: 1;
                            padding: 12px;
                            background: #f44336;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            font-size: 16px;
                            cursor: pointer;
                        ">
                    Cancel
                </button>
            </div>
            
           
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => {
        document.getElementById("newPassword").focus();
    }, 100);
}

// ✅ 15. SAVE NEW PASSWORD
function saveNewPassword() {
    const newPass = document.getElementById("newPassword").value;
    const confirmPass = document.getElementById("confirmPassword").value;
    
    if (!newPass || !confirmPass) {
        alert("Please fill both fields");
        return;
    }
    
    if (newPass !== confirmPass) {
        alert("Passwords don't match!");
        return;
    }
    
    localStorage.setItem("incomePassword", newPass);
    alert("✅ Password changed successfully!");
    closeChangePasswordModal();
}

// ✅ 16. CLOSE CHANGE PASSWORD MODAL
function closeChangePasswordModal() {
    const modal = document.getElementById("changePasswordModal");
    if (modal) modal.remove();
}




// ✅ 18. INITIALIZE INCOME SYSTEM
document.addEventListener("DOMContentLoaded", function() {
    console.log("Income system loaded");
    
    // Make sure required elements exist
    if (!document.getElementById("incomeModal")) {
        createIncomeModal();
    }
    
    // Add global event listeners
    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape") {
            closePasswordModal();
            closeForgetPasswordModal();
            closeChangePasswordModal();
            closeIncomeModal();
        }
    });
});

// ✅ 19. CLEANUP FUNCTION
function cleanupAllModals() {
    const modals = [
        "incomePasswordModal",
        "forgetPasswordModal",
        "changePasswordModal",
        "incomeModal"
    ];
    
    modals.forEach(id => {
        const modal = document.getElementById(id);
        if (modal) modal.remove();
    });
}
function copyCurrentPreview(e) {
    // e parameter ကို လက်ခံမယ်
    const previewContent = document.getElementById('previewContent');
    if (!previewContent || previewContent.textContent === 'Select a name to see preview') {
        showModernPopup("No preview text to copy!", "Error");
        return;
    }
    
    const textToCopy = previewContent.textContent;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        // Show success message
        const successMsg = document.getElementById('successMessage');
        if (successMsg) {
            successMsg.style.display = 'block';
            // ... success message code
        }
        
        showModernPopup("Preview text copied to clipboard!", "Copied");
        
        // Use e parameter if available
        if (e && e.currentTarget) {
            const copyBtn = e.currentTarget;
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            copyBtn.style.background = '#27ae60';
            
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.style.background = '#3498db';
            }, 1500);
        }
        
    }).catch(err => {
        showModernPopup("Failed to copy: " + err, "Error");
    });
}
// Android အတွက် compatible save function
function saveEntryAndroid() {
    // Form data ရယူ
    const company = document.getElementById('company').value;
    const name = document.getElementById('name').value;
    const town = document.getElementById('town').value;
    const quantity = document.getElementById('quantity').value;
    
    // Validation
    if (!company || !name || !town || !quantity) {
        showModernPopup("ဘာကို Save ရမှာလဲ 😎", "Error");
        return;
    }
    
 
    
    // 2. Keep the normal Save popup for a regular save.
    // When Credit and/or Remark is selected, save quietly so no Viewer/detail popup opens.
    const smartCreditSelected = document.getElementById('tkoSaveCredit')?.checked === true;
    const smartRemarkSelected = document.getElementById('tkoSaveRemark')?.checked === true;
    if (!smartCreditSelected && !smartRemarkSelected) {
        showEntryDetailsPopup(company, name, town, quantity);

        // 3. Detail tones (TTS မလိုဘဲ)
        setTimeout(() => {
            playDetailTones(company, name, town, quantity);
        }, 800);
    }
    
    // 4. မူရင်း save function ကိုလည်း run မယ်
    if (typeof saveEntry === 'function') {
        saveEntry();
    }
    const smartCredit = document.getElementById('tkoSaveCredit');
    const smartRemark = document.getElementById('tkoSaveRemark');
    if (smartCredit) smartCredit.checked = false;
    if (smartRemark) smartRemark.checked = false;
}

// Beautiful Entry Details Popup Function for Android
// Floating Boxes Popup without White Background
function showEntryDetailsPopup(company, name, town, quantity) {
    // Remove existing popup if any
    const existingPopup = document.querySelector('.floating-boxes-popup');
    if (existingPopup) {
        existingPopup.remove();
    }
    
    // Create floating container
    const popup = document.createElement('div');
    popup.className = 'floating-boxes-popup';
    
    // Create floating boxes structure - NO WHITE BACKGROUND CONTAINER
    popup.innerHTML = `
        <!-- Success Box -->
        
        <!-- Company Box -->
        <div class="floating-detail-box floating-company">
            <div class="floating-box-icon">🏢</div>
            <div class="floating-box-content">
                <div class="floating-box-label">Company</div>
                <div class="floating-box-value">${company}</div>
            </div>
        </div>
        
        <!-- Name Box -->
        <div class="floating-detail-box floating-name">
            <div class="floating-box-icon">👤</div>
            <div class="floating-box-content">
                <div class="floating-box-label">Name</div>
                <div class="floating-box-value">${name}</div>
            </div>
        </div>
        
        <!-- Town Box -->
        <div class="floating-detail-box floating-town">
            <div class="floating-box-icon">🏘️</div>
            <div class="floating-box-content">
                <div class="floating-box-label">Town</div>
                <div class="floating-box-value">${town}</div>
            </div>
        </div>
        
        <!-- Quantity Box (Highlighted) -->
        <div class="floating-detail-box floating-quantity">
            <div class="floating-box-icon">📦</div>
            <div class="floating-box-content">
                <div class="floating-box-label">Quantity</div>
                <div class="floating-box-value">${quantity}</div>
            </div>
        </div>
        
        <!-- OK Button Box -->
        <div class="floating-ok-box" onclick="closeFloatingPopup()">
            <span>OK</span>
        </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .floating-boxes-popup {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 100000;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 15px;
            animation: floatingAppear 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        
        @keyframes floatingAppear {
            0% { 
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.3);
            }
            70% { 
                opacity: 1;
                transform: translate(-50%, -50%) scale(1.1);
            }
            100% { 
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }
        }
        
        /* Success Box */
        .floating-success-box {
            background: linear-gradient(135deg, #4CAF50, #2E7D32);
            border-radius: 20px;
            padding: 15px 30px;
            display: flex;
            align-items: center;
            gap: 15px;
            box-shadow: 
                0 15px 35px rgba(76, 175, 80, 0.4),
                0 0 0 1px rgba(255, 255, 255, 0.2),
                0 0 50px rgba(76, 175, 80, 0.3);
            cursor: pointer;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            animation: successFloat 3s ease-in-out infinite;
            backdrop-filter: blur(10px);
            border: 2px solid rgba(255, 255, 255, 0.3);
        }
        
        @keyframes successFloat {
            0%, 100% { 
                transform: translateY(0);
                box-shadow: 0 15px 35px rgba(76, 175, 80, 0.4);
            }
            50% { 
                transform: translateY(-10px);
                box-shadow: 0 25px 50px rgba(76, 175, 80, 0.6);
            }
        }
        
        .floating-success-box:hover {
            transform: scale(1.05) translateY(-5px);
            box-shadow: 0 25px 50px rgba(76, 175, 80, 0.6);
        }
        
        .floating-check {
            font-size: 32px;
            font-weight: bold;
            color: white;
            width: 50px;
            height: 50px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        }
        
        .floating-title {
            color: white;
            font-size: 24px;
            font-weight: 800;
            letter-spacing: 1px;
            text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        }
        
        /* Detail Boxes */
        .floating-detail-box {
            width: 280px;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 18px;
            padding: 18px 20px;
            display: flex;
            align-items: center;
            gap: 15px;
            box-shadow: 
                0 10px 30px rgba(0, 0, 0, 0.2),
                0 0 0 1px rgba(255, 255, 255, 0.1);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            backdrop-filter: blur(10px);
            border: 2px solid;
            animation: boxFloat 4s ease-in-out infinite;
            cursor: default;
        }
        
        .floating-detail-box:nth-child(2) { animation-delay: 0.1s; }
        .floating-detail-box:nth-child(3) { animation-delay: 0.2s; }
        .floating-detail-box:nth-child(4) { animation-delay: 0.3s; }
        .floating-detail-box:nth-child(5) { animation-delay: 0.4s; }
        
        @keyframes boxFloat {
            0%, 100% { 
                transform: translateY(0) rotate(0deg);
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            }
            50% { 
                transform: translateY(-8px) rotate(0.5deg);
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            }
        }
        
        .floating-detail-box:hover {
            transform: translateY(-5px) scale(1.02);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }
        
        /* Individual box colors */
        .floating-company {
            border-color: #3498db;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(52, 152, 219, 0.1));
        }
        
        .floating-name {
            border-color: #2ecc71;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(46, 204, 113, 0.1));
        }
        
        .floating-town {
            border-color: #e74c3c;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(231, 76, 60, 0.1));
        }
        
        .floating-quantity {
            border-color: #9b59b6;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(155, 89, 182, 0.1));
            animation: quantityPulse 2s ease-in-out infinite !important;
        }
        
        @keyframes quantityPulse {
            0%, 100% { 
                transform: scale(1);
                box-shadow: 0 15px 35px rgba(155, 89, 182, 0.4);
            }
            50% { 
                transform: scale(1.05);
                box-shadow: 0 25px 50px rgba(155, 89, 182, 0.6);
            }
        }
        
        .floating-box-icon {
            font-size: 24px;
            width: 50px;
            height: 50px;
            background: white;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15);
            flex-shrink: 0;
        }
        
        .floating-quantity .floating-box-icon {
            background: #f3e5f5;
        }
        
        .floating-box-content {
            flex: 1;
        }
        
        .floating-box-label {
            color: #666;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 5px;
            opacity: 0.8;
        }
        
        .floating-box-value {
            color: #2c3e50;
            font-size: 18px;
            font-weight: 800;
            line-height: 1.3;
        }
        
        .floating-quantity .floating-box-value {
            color: #9b59b6;
            font-size: 22px;
            font-weight: 900;
        }
        
        /* OK Button Box */
        .floating-ok-box {
            background: linear-gradient(135deg, #2196F3, #0D47A1);
            border-radius: 20px;
            padding: 18px 60px;
            color: white;
            font-size: 20px;
            font-weight: 800;
            text-align: center;
            cursor: pointer;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 
                0 15px 35px rgba(33, 150, 243, 0.4),
                0 0 0 1px rgba(255, 255, 255, 0.2);
            letter-spacing: 2px;
            text-transform: uppercase;
            backdrop-filter: blur(10px);
            border: 2px solid rgba(255, 255, 255, 0.3);
            animation: okButtonFloat 3s ease-in-out infinite;
            margin-top: 10px;
        }
        
        @keyframes okButtonFloat {
            0%, 100% { 
                transform: translateY(0);
                box-shadow: 0 15px 35px rgba(33, 150, 243, 0.4);
            }
            50% { 
                transform: translateY(-8px);
                box-shadow: 0 25px 50px rgba(33, 150, 243, 0.6);
            }
        }
        
        .floating-ok-box:hover {
            transform: scale(1.1) translateY(-5px);
            box-shadow: 0 25px 50px rgba(33, 150, 243, 0.6);
            background: linear-gradient(135deg, #0D47A1, #2196F3);
        }
        
        .floating-ok-box:active {
            transform: scale(0.95) translateY(0);
        }
        
        /* Mobile responsive */
        @media (max-width: 480px) {
            .floating-boxes-popup {
                gap: 12px;
            }
            
            .floating-success-box {
                padding: 12px 25px;
                border-radius: 15px;
            }
            
            .floating-check {
                width: 40px;
                height: 40px;
                font-size: 26px;
            }
            
            .floating-title {
                font-size: 20px;
            }
            
            .floating-detail-box {
                width: 250px;
                padding: 15px;
                border-radius: 15px;
            }
            
            .floating-box-icon {
                width: 40px;
                height: 40px;
                font-size: 20px;
            }
            
            .floating-box-label {
                font-size: 11px;
            }
            
            .floating-box-value {
                font-size: 16px;
            }
            
            .floating-quantity .floating-box-value {
                font-size: 20px;
            }
            
            .floating-ok-box {
                padding: 16px 50px;
                font-size: 18px;
                border-radius: 15px;
            }
        }
    `;
    
    // Add styles and popup to document
    document.head.appendChild(style);
    document.body.appendChild(popup);
    
    // Store style reference in popup for cleanup
    popup.styleElement = style;
    
    // Auto close after 5 seconds
    setTimeout(() => {
        closeFloatingPopup();
    }, 5000);
}

// Function to close the floating popup
function closeFloatingPopup() {
    const popup = document.querySelector('.floating-boxes-popup');
    if (popup) {
        // Get the associated style element
        const style = popup.styleElement;
        
        // Add closing animation
        popup.style.opacity = '0';
        popup.style.transform = 'translate(-50%, -50%) scale(0.5)';
        
        // Remove after animation completes
        setTimeout(() => {
            if (popup.parentNode) {
                popup.remove();
            }
            if (style && style.parentNode) {
                style.remove();
            }
        }, 300);
    }
}

// Add event listener for Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeFloatingPopup();
    }
});

// Close when clicking outside boxes
document.addEventListener('click', function(e) {
    const popup = document.querySelector('.floating-boxes-popup');
    if (popup && !popup.contains(e.target)) {
        closeFloatingPopup();
    }
});

// Function to close the Android popup
function closeAndroidPopup() {
    const popup = document.querySelector('.android-entry-popup');
    if (popup) {
        // Get the associated style element
        const style = popup.styleElement;
        
        // Add closing animation
        popup.style.opacity = '0';
        popup.style.transform = 'scale(0.95)';
        
        // Remove after animation completes
        setTimeout(() => {
            if (popup.parentNode) {
                popup.remove();
            }
            if (style && style.parentNode) {
                style.remove();
            }
        }, 300);
    }
}

// Add event listener for Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeAndroidPopup();
    }
});

// Close when clicking outside popup
document.addEventListener('click', function(e) {
    const popup = document.querySelector('.android-entry-popup');
    if (popup && e.target === popup) {
        closeAndroidPopup();
    }
});

// ✅ Save confirmation sound - iPhone notification
// ✅ iPhone notification sound ONLY
function playSaveConfirmationSound() {
    try {
        // iPhone notification sound
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/257/257-preview.mp3');
        audio.volume = 0.8;
        
        // Play the sound
        audio.play().catch(error => {
            console.log("iPhone sound play error:", error);
        });
        
    } catch (error) {
        console.log("Audio error:", error);
    }
}

// Detail tones for data

// စာသားကို musical tones အဖြစ်ပြောင်း
function playStringAsTones(text, audioCtx, startTime) {
    const chars = text.toUpperCase().split('');
    const baseFreq = 440; // A4 note
    
    chars.forEach((char, index) => {
        const charCode = char.charCodeAt(0);
        if (charCode >= 65 && charCode <= 90) { // A-Z
            const freq = baseFreq + ((charCode - 65) * 20);
            
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.frequency.value = freq;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0, startTime + index * 0.1);
            gainNode.gain.linearRampToValueAtTime(0.15, startTime + index * 0.1 + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + index * 0.1 + 0.08);
            
            oscillator.start(startTime + index * 0.1);
            oscillator.stop(startTime + index * 0.1 + 0.08);
        }
    });
}

// နံပါတ်ကို musical tones အဖြစ်ပြောင်း
function playNumberAsTones(number, audioCtx, startTime) {
    const digits = number.toString().split('');
    const scale = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
    
    digits.forEach((digit, index) => {
        const num = parseInt(digit);
        const freq = scale[num % scale.length];
        
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.frequency.value = freq;
        oscillator.type = 'triangle'; // Softer sound
        
        gainNode.gain.setValueAtTime(0, startTime + index * 0.2);
        gainNode.gain.linearRampToValueAtTime(0.2, startTime + index * 0.2 + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + index * 0.2 + 0.15);
        
        oscillator.start(startTime + index * 0.2);
        oscillator.stop(startTime + index * 0.2 + 0.15);
    });
}
// Audio မရရင် vibration သုံးမယ်
function playVibrationFeedback() {
    if (navigator.vibrate) {
        // Save success vibration pattern
        navigator.vibrate([100, 50, 100, 50, 100]);
    }
}

// Combined feedback function

// Function to format date as "January.4.2026"


// Function to update date display


// Function to show date picker


// Function to initialize date at midnight


// Event listener for date change
document.getElementById('date').addEventListener('change', function() {
    updateDateDisplay();
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeDateAtMidnight();
    updateDateDisplay();
});
// Function to format date as "January.4.2026"
function formatDateToCustom(dateString) {
    const date = new Date(dateString);
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    
    return `${month}.${day}.${year}`;
}

// Function to update date display
function updateDateDisplay() {
    const dateInput = document.getElementById('date');
    const dateDisplay = document.getElementById('date-display');
    
    if (dateInput && dateDisplay && dateInput.value) {
        dateDisplay.textContent = formatDateToCustom(dateInput.value);
    }
}

// Function to show date picker
function showDatePicker() {
    const dateInput = document.getElementById('date');
    if (dateInput) {
        dateInput.showPicker(); // This will open the native date picker
    }
}

// Function to initialize date at midnight
function initializeDateAtMidnight() {
    const dateInput = document.getElementById('date');
    if (dateInput) {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        
        dateInput.value = `${yyyy}-${mm}-${dd}`;
        updateDateDisplay();
        console.log('Date initialized to:', dateInput.value);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Add event listener for date change
    const dateInput = document.getElementById('date');
    if (dateInput) {
        dateInput.addEventListener('change', function() {
            updateDateDisplay();
        });
    }
    
    initializeDateAtMidnight();
    updateDateDisplay();
});



/* Final global exports for Android WebView / inline onclick handlers */
window.editPreferred = editPreferred;
window.closePreferredEdit = closePreferredEdit;
window.savePreferredEdit = savePreferredEdit;


// TKO Preferred Edit final bindings
window.editPreferred = editPreferred;
window.closePreferredEdit = closePreferredEdit;
window.savePreferredEdit = savePreferredEdit;


/* =========================================================
   FILE BACKUP / RESTORE — v37
   Full localStorage backup, including Entries, Delivered,
   Remark, Preferred, Credit, Notes, Todo, Debt and other
   app data. Existing data is not changed until Restore.
   ========================================================= */
function createFullBackupObject() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key == null) continue;
        const raw = localStorage.getItem(key);
        try {
            data[key] = JSON.parse(raw);
        } catch (_) {
            data[key] = raw;
        }
    }

    return {
        app: "TKO",
        backupVersion: 37,
        createdAt: new Date().toISOString(),
        storage: data
    };
}

function downloadJsonFile(filename, object) {
    const json = JSON.stringify(object, null, 2);
    // Android APK: use the native file picker so the backup can be
    // saved to a real file and moved to another device.
    if (window.AndroidBackup && typeof window.AndroidBackup.saveBackup === "function") {
        window.AndroidBackup.saveBackup(filename, json);
        return;
    }

    // Browser fallback.
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
    }, 1000);
}

/* Menu → Backup now downloads a .json file. */
function backupData() {
    try {
        const backup = createFullBackupObject();
        const d = new Date();
        const stamp =
            d.getFullYear() + "-" +
            String(d.getMonth() + 1).padStart(2, "0") + "-" +
            String(d.getDate()).padStart(2, "0") + "_" +
            String(d.getHours()).padStart(2, "0") +
            String(d.getMinutes()).padStart(2, "0");

        downloadJsonFile(`TKO_Backup_${stamp}.json`, backup);

        if (typeof showModernPopup === "function") {
            showModernPopup(
                "✅ Backup file created.\n\nAll saved app data has been included.",
                "Backup Complete"
            );
        } else {
            alert("✅ Backup file created.");
        }
    } catch (error) {
        console.error("Backup download error:", error);
        alert("❌ Backup file could not be created.");
    }
}

/* Restore from the file picker. */
function restoreBackupFile() {
    const input = document.getElementById("backup-file-input");
    const file = input && input.files ? input.files[0] : null;

    if (!file) {
        alert("📂 Please select a TKO backup JSON file first.");
        return;
    }

    const reader = new FileReader();

    reader.onload = function () {
        try {
            const parsed = JSON.parse(String(reader.result || ""));

            // Accept the new full-backup format.
            let storage = null;
            if (parsed && typeof parsed === "object" && parsed.storage &&
                typeof parsed.storage === "object" && !Array.isArray(parsed.storage)) {
                storage = parsed.storage;
            }
            // Also accept the older full-backup object format.
            else if (parsed && typeof parsed === "object" && !Array.isArray(parsed) &&
                     (parsed.entries || parsed.preferred || parsed.creditEntries ||
                      parsed.dateBasedNotes || parsed.todoData || parsed.debtData ||
                      parsed.remarkEntries)) {
                storage = {};
                if (parsed.entries !== undefined) storage.entries = parsed.entries;
                if (parsed.preferred !== undefined) storage.preferred = parsed.preferred;
                if (parsed.creditEntries !== undefined) storage.creditEntries = parsed.creditEntries;
                if (parsed.dateBasedNotes !== undefined) storage.dateBasedNotes = parsed.dateBasedNotes;
                if (parsed.todoData !== undefined) storage.todoData = parsed.todoData;
                if (parsed.debtData !== undefined) storage.debtData = parsed.debtData;
                if (parsed.remarkEntries !== undefined) storage.remarkEntries = parsed.remarkEntries;
            }
            // Accept the old simple Entries-array backup.
            else if (Array.isArray(parsed)) {
                storage = { entries: parsed };
            }

            if (!storage) {
                throw new Error("Unsupported backup format");
            }

            const keys = Object.keys(storage);
            if (!keys.length) {
                throw new Error("Backup contains no data");
            }

            const ok = confirm(
                "Restore this backup?\n\n" +
                "This will replace the current saved app data with the backup file."
            );
            if (!ok) return;

            localStorage.clear();

            keys.forEach(key => {
                const value = storage[key];
                if (typeof value === "string") {
                    // Preserve plain string localStorage values.
                    try {
                        JSON.parse(value);
                        localStorage.setItem(key, value);
                    } catch (_) {
                        localStorage.setItem(key, value);
                    }
                } else {
                    localStorage.setItem(key, JSON.stringify(value));
                }
            });

            if (typeof showModernPopup === "function") {
                showModernPopup(
                    "✅ Restore Successful!\n\n" +
                    keys.length + " saved data sections restored.\n\n" +
                    "The app will reload now.",
                    "Restore Complete"
                );
            } else {
                alert("✅ Restore Successful!");
            }

            setTimeout(() => location.reload(), 1000);
        } catch (error) {
            console.error("Backup restore error:", error);
            alert(
                "❌ Restore failed.\n\n" +
                "Please select a valid TKO backup JSON file."
            );
        }
    };

    reader.onerror = function () {
        alert("❌ Could not read the backup file.");
    };

    reader.readAsText(file);
}

/* Restore from the existing text box also accepts the new full format. */
function restoreData() {
    const box = document.getElementById("restore-box");
    if (!box) {
        alert("Restore box not found.");
        return;
    }

    const raw = box.value.trim();
    if (!raw) {
        alert("📋 Please paste backup data or use 'Restore Selected File'.");
        return;
    }

    try {
        const parsed = JSON.parse(raw);

        let storage = null;
        if (parsed && typeof parsed === "object" && parsed.storage &&
            typeof parsed.storage === "object" && !Array.isArray(parsed.storage)) {
            storage = parsed.storage;
        } else if (Array.isArray(parsed)) {
            storage = { entries: parsed };
        } else if (parsed && typeof parsed === "object") {
            storage = {};
            Object.keys(parsed).forEach(key => {
                if (key !== "app" && key !== "backupVersion" && key !== "createdAt") {
                    storage[key] = parsed[key];
                }
            });
        }

        if (!storage || !Object.keys(storage).length) {
            throw new Error("No restore data found");
        }

        if (!confirm("Restore this backup?\n\nCurrent saved data will be replaced.")) return;

        localStorage.clear();
        Object.keys(storage).forEach(key => {
            const value = storage[key];
            localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
        });

        box.value = "";
        showModernPopup("✅ Restore Successful!\n\nThe app will reload now.", "Restore Complete");
        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        console.error("Restore error:", error);
        showModernPopup(
            "❌ Restore Failed!\n\nPlease check the backup file/data format.",
            "Restore Error"
        );
    }
}


/* ===== NATIVE ANDROID RESTORE BRIDGE v39 ===== */
function restoreBackupJsonFromAndroid(jsonText) {
    try {
        const parsed = JSON.parse(String(jsonText || ""));
        let storage = null;

        if (parsed && typeof parsed === "object" && parsed.storage &&
            typeof parsed.storage === "object" && !Array.isArray(parsed.storage)) {
            storage = parsed.storage;
        } else if (Array.isArray(parsed)) {
            storage = { entries: parsed };
        } else if (parsed && typeof parsed === "object") {
            storage = {};
            Object.keys(parsed).forEach(key => {
                if (key !== "app" && key !== "backupVersion" && key !== "createdAt") {
                    storage[key] = parsed[key];
                }
            });
        }

        if (!storage || !Object.keys(storage).length) {
            throw new Error("No restore data found");
        }

        if (!confirm(
            "Restore this backup?\\n\\n" +
            "Current saved data will be replaced."
        )) return;

        localStorage.clear();

        Object.keys(storage).forEach(key => {
            const value = storage[key];
            localStorage.setItem(
                key,
                typeof value === "string" ? value : JSON.stringify(value)
            );
        });

        if (typeof showModernPopup === "function") {
            showModernPopup(
                "✅ Restore Successful!\\n\\n" +
                Object.keys(storage).length +
                " saved data sections restored.\\n\\nThe app will reload now.",
                "Restore Complete"
            );
        } else {
            alert("✅ Restore Successful!");
        }

        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        console.error("Native restore error:", error);
        if (typeof showModernPopup === "function") {
            showModernPopup(
                "❌ Restore Failed!\\n\\nPlease select a valid TKO backup JSON file.",
                "Restore Error"
            );
        } else {
            alert("❌ Restore Failed!");
        }
    }
}

async function shareCurrentPreviewToViber(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (event && event.stopPropagation) event.stopPropagation();

    const name = String(window.currentPreviewName || '').trim();
    const town = String(window.currentPreviewTown || '').trim();
    const previewText = String(window.currentPreviewText || '').trim();
    if (!name || !town || !previewText) {
        showModernPopup('Please select a Name first.', 'Share Viber');
        return;
    }
    if (typeof html2canvas !== 'function') {
        showModernPopup('Voucher image library is not ready. Please try again.', 'Share Viber');
        return;
    }

    const selectedDate = window.selectedDailyDate ||
        (document.getElementById('date')?.value || new Date().toISOString().slice(0, 10));
    const dateObj = new Date(selectedDate + 'T00:00:00');
    const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedDate = isNaN(dateObj.getTime())
        ? selectedDate
        : `${dateObj.getDate()}.${monthShort[dateObj.getMonth()]}.${dateObj.getFullYear()}`;

    const townRecord = window.townData && Number.isInteger(window.currentTownIndex)
        ? window.townData[window.currentTownIndex] : null;
    const nameData = townRecord?.data?.names?.[name] || null;
    const paidCompanyMap = {};

    try {
        const remarks = JSON.parse(localStorage.getItem('remarkEntries') || '[]');
        if (Array.isArray(remarks)) remarks.forEach(r => {
            if (String(r.date || '').trim() !== String(selectedDate).trim()) return;
            if (String(r.name || '').trim() !== name) return;
            if (String(r.town || '').trim() !== town) return;
            const company = String(r.company || '').trim();
            if (company) paidCompanyMap[company] = (Number(paidCompanyMap[company]) || 0) + (Number(r.quantity) || 0);
        });
    } catch (e) {
        console.warn('Could not read Remark payments for voucher:', e);
    }

    const paidRows = [];
    const unpaidRows = [];
    let totalQuantity = 0;
    let paidQuantity = 0;
    let unpaidQuantity = 0;

    function addCompany(companyValue, quantityValue) {
        const company = String(companyValue || '').trim();
        const qty = Math.max(0, Number(quantityValue) || 0);
        if (!company || qty <= 0) return;
        const paidQty = Math.min(Number(paidCompanyMap[company] || 0), qty);
        const pendingQty = Math.max(0, qty - paidQty);

        totalQuantity += qty;
        paidQuantity += paidQty;
        unpaidQuantity += pendingQty;

        if (paidQty > 0) {
            paidRows.push(
                `<div class="tko-voucher-row"><div class="tko-voucher-company">🏢 ${escapeRemarkText(company)}</div><div class="tko-voucher-qty">${paidQty} <span class="tko-voucher-check">✅</span></div></div>`
            );
        }
        if (pendingQty > 0) {
            unpaidRows.push(
                `<div class="tko-voucher-row"><div class="tko-voucher-company">🏢 ${escapeRemarkText(company)}</div><div class="tko-voucher-qty">${pendingQty}</div></div>`
            );
        }
    }

    if (nameData?.companies) {
        Object.entries(nameData.companies).forEach(([company, quantity]) => addCompany(company, quantity));
    } else {
        previewText.split('\n').map(x => x.trim()).filter(Boolean).forEach(line => {
            const clean = line.replace(/^🏛️\s*/, '');
            const m = clean.match(/^(.*?)\s*→\s*(\d+)/);
            if (m) addCompany(m[1].trim(), Number(m[2]) || 0);
        });
    }

    if (!totalQuantity) {
        const m = previewText.match(/Total\s*(?:→|:)\s*(\d+)/i);
        totalQuantity = m ? Number(m[1]) || 0 : 0;
    }

    const voucher = document.createElement('div');
    voucher.className = 'tko-voucher-capture';
    voucher.innerHTML = `
        <div class="tko-voucher-date tko-voucher-date-top">📅 Date: ${escapeRemarkText(formattedDate)}</div>
        <div class="tko-voucher-person">
            <div class="tko-voucher-name">✨ ${escapeRemarkText(name)} ✨</div>
            <div class="tko-voucher-town">📍 ${escapeRemarkText(town)}</div>
        </div>
        <div class="tko-voucher-total tko-voucher-grand-total">
            <span>📦 Total Quantity →</span><strong>${totalQuantity}</strong>
        </div>

        <section class="tko-voucher-paid-section">
            <div class="tko-voucher-section-title">
                <span>🚚🛥️🧍 (အရောက်ပို့ခရှင်းပြီး။)</span>
                <strong>📦 ${paidQuantity}</strong>
            </div>
            <div class="tko-voucher-section-list">
                ${paidRows.join('') || '<div class="tko-voucher-empty">No cleared company data</div>'}
            </div>
        </section>

        <div class="tko-voucher-handshake">•••••••••••• 🤝 ••••••••••••</div>

        <section class="tko-voucher-unpaid-section">
            <div class="tko-voucher-section-title">
                <span>(ပဲ့ထောင်ခ + လုပ်သားခ ရှင်းရန်ကျန်)</span>
                <strong>📦 ${unpaidQuantity}</strong>
            </div>
            <div class="tko-voucher-section-list">
                ${unpaidRows.join('') || '<div class="tko-voucher-empty">No remaining-fee data</div>'}
            </div>
        </section>

        <div class="tko-voucher-note">💬 အမှားအယွင်းရှိခဲ့ပါက ဆက်သွယ်ပေးပါခင်ဗျာ။ ✨</div>
    `;

    Object.assign(voucher.style, {
        position: 'fixed',
        left: '-100000px',
        top: '0',
        width: '720px',
        zIndex: '-1',
        display: 'block'
    });
    document.body.appendChild(voucher);

    const button = event?.currentTarget;
    const oldButtonText = button?.innerHTML;
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Voucher...';
    }

    try {
        if (document.fonts?.ready) await document.fonts.ready;
        const canvas = await html2canvas(voucher, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            logging: false,
            width: 720,
            windowWidth: 720
        });
        const blob = await new Promise((resolve, reject) =>
            canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG creation failed')), 'image/png', 1)
        );
        const fileName = `Voucher_${name.replace(/[^\w\u1000-\u109F-]+/g, '_')}_${selectedDate}.png`;
        const caption = '';

        if (window.AndroidViber && typeof window.AndroidViber.shareImageToViber === 'function') {
            window.AndroidViber.shareImageToViber(canvas.toDataURL('image/png', 1.0), fileName, caption);
            return;
        }

        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
            try {
                await navigator.share({ title: 'Tin Win Ko Voucher', text: caption, files: [file] });
                return;
            } catch (e) {
                if (e?.name === 'AbortError') return;
            }
        }

        const link = document.createElement('a');
        link.download = fileName;
        link.href = canvas.toDataURL('image/png', 1.0);
        document.body.appendChild(link);
        link.click();
        link.remove();
        showModernPopup('Voucher ကို သိမ်းပြီးပါပြီ။<br><br>Viber ထဲမှာ ပုံကိုရွေးပြီး ပို့နိုင်ပါတယ်။', 'Voucher Ready');
    } catch (error) {
        console.error('Voucher Viber share error:', error);
        showModernPopup('Voucher ဖန်တီး၍ Share မလုပ်နိုင်ပါ။<br><br>' + String(error?.message || error), 'Share Viber');
    } finally {
        voucher.remove();
        if (button) {
            button.disabled = false;
            button.innerHTML = oldButtonText || '<i class="fab fa-viber"></i> Share Viber';
        }
    }
}

/* ===== TKO GOOGLE SHEET SYNC ===== */
(function(){
  function getSyncUrl(){ return String(window.TKO_GOOGLE_SHEET_URL || '').trim(); }
  let syncPeriod = 'date';

  function getEntries(){
    try { const x=JSON.parse(localStorage.getItem('entries')||'[]'); return Array.isArray(x)?x:[]; } catch(e){ return []; }
  }
  function getRemarks(){
    try { const x=JSON.parse(localStorage.getItem('remarkEntries')||'[]'); return Array.isArray(x)?x:[]; } catch(e){ return []; }
  }
  function getCredits(){
    try { const x=JSON.parse(localStorage.getItem('creditEntries')||'{}'); return x&&typeof x==='object'?x:{}; } catch(e){ return {}; }
  }
  function norm(v){ return String(v||'').trim().toLowerCase(); }
  function sameBase(a,b){
    return norm(a.date)===norm(b.date)&&norm(a.company)===norm(b.company)&&norm(a.name)===norm(b.name)&&norm(a.town)===norm(b.town);
  }
  function remarkQty(entry, remarks){
    let total=0;
    remarks.forEach(r=>{
      if ((r.entryId && String(r.entryId)===String(entry.id)) || (!r.entryId && sameBase(r,entry))) total += Number(r.quantity)||0;
    });
    return total;
  }
  function creditQty(entry, credits){
    let total=0;
    Object.values(credits).forEach(list=>{
      if(!Array.isArray(list)) return;
      list.forEach(c=>{
        if ((c.entryId && String(c.entryId)===String(entry.id)) || (!c.entryId && sameBase(c,entry))) total += Number(c.quantity)||0;
      });
    });
    return total;
  }
  function setPeriodMode(mode){
    syncPeriod=mode;
    const d=document.getElementById('tkoSyncDateWrap'), m=document.getElementById('tkoSyncMonthWrap');
    if(d)d.style.display=mode==='date'?'block':'none';
    if(m)m.style.display=mode==='month'?'block':'none';
    document.getElementById('tkoSyncDateBtn')?.classList.toggle('active',mode==='date');
    document.getElementById('tkoSyncMonthBtn')?.classList.toggle('active',mode==='month');
  }
  window.setGoogleSheetSyncPeriod=setPeriodMode;
  window.openGoogleSheetSyncModal=function(){
    const modal=document.getElementById('tkoGoogleSheetSyncModal'); if(!modal)return;
    const date=document.getElementById('date')?.value || new Date().toISOString().slice(0,10);
    const month=date.slice(0,7);
    const d=document.getElementById('tkoSyncDate'), m=document.getElementById('tkoSyncMonth');
    if(d)d.value=date; if(m)m.value=month;
    setPeriodMode('date');
    const scope=document.getElementById('tkoSyncScope'); if(scope)scope.value='all';
    refreshGoogleSheetSyncValues();
    modal.style.display='flex';
  };
  window.closeGoogleSheetSyncModal=function(){
    const m=document.getElementById('tkoGoogleSheetSyncModal');
    if(!m)return;
    m.style.display='none';
    m.style.visibility='hidden';
    m.setAttribute('aria-hidden','true');
  };
  window.refreshGoogleSheetSyncValues=function(){
    const scope=document.getElementById('tkoSyncScope')?.value||'all';
    const wrap=document.getElementById('tkoSyncValueWrap'), label=document.getElementById('tkoSyncValueLabel'), select=document.getElementById('tkoSyncValue');
    if(!wrap||!select)return;
    if(scope==='all'){wrap.style.display='none';return;}
    wrap.style.display='block';
    label.textContent=scope==='company'?'Company':scope==='town'?'Town':'Name';
    const key=scope;
    const values=[...new Set(getEntries().map(e=>String(e[key]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));
    select.innerHTML=values.length?values.map(v=>`<option value="${escapeHtmlSimple(v)}">${escapeHtmlSimple(v)}</option>`).join(''):'<option value="">No data</option>';
  };
  function selectedPeriod(){
    if(syncPeriod==='month') return document.getElementById('tkoSyncMonth')?.value||'';
    return document.getElementById('tkoSyncDate')?.value||'';
  }
  function collectRows(){
    const period=selectedPeriod(), scope=document.getElementById('tkoSyncScope')?.value||'all', value=document.getElementById('tkoSyncValue')?.value||'';
    if(!period) return {rows:[],period,scope,value};
    const remarks=getRemarks(), credits=getCredits();
    let rows=getEntries().filter(e=> syncPeriod==='month' ? String(e.date||'').slice(0,7)===period : String(e.date||'')===period);
    if(scope!=='all') rows=rows.filter(e=>norm(e[scope])===norm(value));
    return {
      rows:rows.map(e=>({
        id:String(e.id||''),date:String(e.date||''),company:String(e.company||''),name:String(e.name||''),town:String(e.town||''),quantity:Number(e.quantity)||0,remarkQuantity:remarkQty(e,remarks),creditQuantity:creditQty(e,credits)
      })),
      period,scope,value
    };
  }
  window.syncSelectedDataToGoogleSheet=function(){
    const SYNC_URL = getSyncUrl();
    if(!SYNC_URL){ if(typeof showModernPopup==='function')showModernPopup('Google Sheet URL မရှိသေးပါ။','Google Sheet Sync'); else alert('Google Sheet URL မရှိသေးပါ။'); return; }
    const pack=collectRows();
    if(!pack.period){alert(syncPeriod==='month'?'Month ရွေးပေးပါ။':'Date ရွေးပေးပါ။');return;}
    if(pack.scope!=='all'&&!pack.value){alert('Sync လုပ်မယ့် '+pack.scope+' ကို ရွေးပေးပါ။');return;}
    if(!pack.rows.length){
      if(typeof showModernPopup==='function')showModernPopup('ရွေးထားတဲ့ Period / '+(pack.scope==='all'?'Data':pack.scope)+' အတွက် Entry မရှိပါ။','Google Sheet Sync'); else alert('No matching entries.');
      return;
    }

    const btn=document.querySelector('#tkoGoogleSheetSyncModal .tko-sheet-sync-main-btn');
    if(btn){btn.disabled=true;btn.textContent='☁️ Syncing...';}

    const iframeName='tkoSheetSyncFrame_'+Date.now();
    const iframe=document.createElement('iframe');
    iframe.name=iframeName;
    iframe.setAttribute('aria-hidden','true');
    iframe.style.cssText='position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
    document.body.appendChild(iframe);

    const form=document.createElement('form');
    form.method='POST';
    form.enctype='application/x-www-form-urlencoded';
    form.acceptCharset='UTF-8';
    form.action=SYNC_URL;
    form.target=iframeName;
    form.style.cssText='position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;opacity:0;pointer-events:none;';

    const input=document.createElement('input');
    input.type='hidden';
    input.name='payload';
    input.value=JSON.stringify({
      action:'sync',
      mode:syncPeriod,
      selectedDate:syncPeriod==='date'?pack.period:'',
      selectedMonth:syncPeriod==='month'?pack.period:'',
      scope:pack.scope,
      scopeValue:pack.value,
      rows:pack.rows
    });
    form.appendChild(input);
    document.body.appendChild(form);

    // Close the sync box immediately after the request is handed to the browser.
    // This prevents the modal from getting stuck while the cross-origin Web App responds.
    closeGoogleSheetSyncModal();

    try {
      form.submit();
    } catch(e) {
      console.error('Google Sheet form submit error:',e);
      if(btn){btn.disabled=false;btn.textContent='☁️ Sync to Google Sheet';}
      form.remove(); iframe.remove();
      if(typeof showModernPopup==='function')showModernPopup('Google Sheet Sync မအောင်မြင်ပါ။','Google Sheet Sync'); else alert('Google Sheet Sync failed.');
      return;
    }

    // We cannot read the cross-origin response, so show only that the request was sent.
    setTimeout(function(){
      form.remove();
      iframe.remove();
      if(btn){btn.disabled=false;btn.textContent='☁️ Sync to Google Sheet';}
      if(typeof showModernPopup==='function')showModernPopup(`☁️ Sync request ပို့ပြီးပါပြီ။<br><br>${syncPeriod==='month'?'Month':'Date'}: ${escapeHtmlSimple(pack.period)}<br>Rows: ${pack.rows.length}`,'Google Sheet Sync');
      else alert('Sync request sent.');
    },1800);
  };

  window.addEventListener('load',function(){
    const scope=document.getElementById('tkoSyncScope'); if(scope)scope.addEventListener('change',refreshGoogleSheetSyncValues);
  });
})();
