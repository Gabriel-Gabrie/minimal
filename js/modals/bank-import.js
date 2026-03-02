/* ══════════════════════════════════════════════
   BANK IMPORT  —  CSV + OFX/QFX parser
   Supports: TD, RBC, BMO, Scotiabank, CIBC,
             Tangerine, Simplii, EQ Bank,
             National Bank, Meridian CU,
             and any standard OFX/QFX file
══════════════════════════════════════════════ */

let _importParsed = [];   // [{date, desc, amount, type}]
let _importAccountId = ''; // wallet account to link imported transactions to

/* ── File entry point (called from Settings AND Tx tab) ─────── */
function openBankImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';  // allow re-upload of same file
    const reader = new FileReader();
    reader.onload = ev => {
        const raw = ev.target.result;
        try {
            const ext = file.name.split('.').pop().toLowerCase();
            if (ext === 'ofx' || ext === 'qfx') {
                _importParsed = _parseOFX(raw);
                _importParsed._bank = 'OFX / QFX (Standard)';
            } else {
                _importParsed = _parseCSV(raw);
            }
            if (_importParsed.length === 0) {
                showToast('No transactions found in file.', 'rose');
                return;
            }
            _openImportModal(file.name);
        } catch(err) {
            console.error('Import error:', err);
            showToast('Could not read file: ' + err.message, 'rose');
        }
    };
    reader.onerror = () => {
        showToast('Failed to read file.', 'rose');
    };
    reader.readAsText(file, 'utf-8');
    // Close any open modals
    hideDataModal();
}

/* ════════════════════════════════════════════
   OFX / QFX PARSER
   Handles SGML (OFX v1) and XML (OFX v2)
════════════════════════════════════════════ */
function _parseOFX(raw) {
    const txns = [];
    const text = raw.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    const isXML = /<\?xml/i.test(text) || /<OFX[>\s]/i.test(text);

    // ── XML OFX v2 ──────────────────────────────────
    if (isXML) {
        const blockRe = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
        let m;
        while ((m = blockRe.exec(text)) !== null) {
            _ofxBlock(m[1], txns);
        }
        return txns;
    }

    // ── SGML OFX v1 — two passes ────────────────────
    // Pass 1: regex for self-closing-style blocks
    const body = text.slice(text.indexOf('<'));
    const blockRe2 = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let m2;
    while ((m2 = blockRe2.exec(body)) !== null) {
        _ofxBlock(m2[1], txns);
    }

    // Pass 2: line-by-line accumulator (no closing tags)
    if (txns.length === 0) {
        const lines = body.split('\n');
        let cur = null;
        const emitCur = () => {
            if (!cur || !cur.TRNAMT) return;
            const amt  = parseFloat(cur.TRNAMT.replace(/[^\d.\-]/g,''));
            const date = _ofxDate(cur.DTPOSTED || cur.DTUSER || '');
            if (!isNaN(amt) && amt !== 0 && date) {
                const desc = [cur.NAME, cur.MEMO].filter(Boolean)
                              .filter((v,i,a)=>a.indexOf(v)===i).join(' – ') || 'Transaction';
                txns.push({ date, desc, amount: Math.abs(amt),
                            type: amt < 0 ? 'expense' : 'income',
                            raw: `${amt}|${desc}` });
            }
        };
        for (const line of lines) {
            const tag = line.match(/^<([A-Z]+)>(.*)/i);
            if (!tag) continue;
            const [, k, v] = tag;
            if (k.toUpperCase() === 'STMTTRN') { emitCur(); cur = {}; continue; }
            if (!cur) continue;
            cur[k.toUpperCase()] = v.trim();
        }
        emitCur(); // emit last transaction
    }
    return txns;
}

function _ofxBlock(block, out) {
    const get = tag => {
        const r = new RegExp(`<${tag}>([^<\n]+)`,'i');
        return (r.exec(block)?.[1] || '').trim();
    };
    const amtStr = get('TRNAMT');
    const date   = _ofxDate(get('DTPOSTED') || get('DTUSER'));
    const name   = get('NAME'); const memo = get('MEMO');
    const desc   = [name, memo].filter(Boolean)
                    .filter((v,i,a)=>a.indexOf(v)===i).join(' – ') || 'Transaction';
    const amount = parseFloat(amtStr.replace(/[^\d.\-]/g,''));
    if (!isNaN(amount) && amount !== 0 && date) {
        out.push({ date, desc, amount: Math.abs(amount),
                   type: amount < 0 ? 'expense' : 'income',
                   raw: `${amtStr}|${desc}` });
    }
}

function _ofxDate(s) {
    const d = s.replace(/[^\d]/g,'').slice(0,8);
    if (d.length < 8) return null;
    return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
}

/* ════════════════════════════════════════════
   CSV PARSER + BANK DETECTOR
════════════════════════════════════════════ */
function _parseCSV(raw) {
    const lines = raw.replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim().split('\n');
    if (lines.length < 2) throw new Error('File has fewer than 2 rows.');

    // Find the header row (skip metadata / blank rows up top)
    let headerIdx = 0;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
        const low = lines[i].toLowerCase();
        if (low.includes('date') || low.includes('posted') || low.includes('transaction')) {
            headerIdx = i; break;
        }
    }

    // Auto-detect delimiter from header row
    _csvDelim = _detectDelimiter(lines[headerIdx]);

    const header = _csvRow(lines[headerIdx]).map(h => h.toLowerCase().trim());
    const rows   = lines.slice(headerIdx + 1).map(_csvRow).filter(r => r.some(v => v.trim()));
    const bank   = _detectBank(header, lines.slice(0, headerIdx));
    const parsed = bank.parse(header, rows);
    parsed._bank = bank.name;
    return parsed;
}

/* ── CSV row parser (handles quoted fields, comma/tab/semicolon delimiters) ── */
let _csvDelim = ',';
function _detectDelimiter(headerLine) {
    const tabs = (headerLine.match(/\t/g) || []).length;
    const semis = (headerLine.match(/;/g) || []).length;
    const commas = (headerLine.match(/,/g) || []).length;
    if (tabs > commas && tabs > semis) return '\t';
    if (semis > commas && semis > tabs) return ';';
    return ',';
}
function _csvRow(line) {
    const delim = _csvDelim;
    const out = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQ && line[i+1] === '"') { cur += '"'; i++; }
            else inQ = !inQ;
        } else if (ch === delim && !inQ) { out.push(cur); cur = ''; }
        else cur += ch;
    }
    out.push(cur);
    return out.map(v => v.trim());
}

/* ── Date normaliser → YYYY-MM-DD ─────────── */
function _normDate(s) {
    s = (s || '').trim().replace(/['"]/g,'');
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;                    // ISO
    // YYYY-MM-DD HH:MM:SS or with T separator
    var dtm = s.match(/^(\d{4}-\d{2}-\d{2})[T\s]\d{1,2}:\d{2}/);
    if (dtm) return dtm[1];
    // MM/DD/YYYY HH:MM:SS
    var dtm2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+\d{1,2}:\d{2}/);
    if (dtm2) return `${dtm2[3]}-${dtm2[1].padStart(2,'0')}-${dtm2[2].padStart(2,'0')}`;
    if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;  // YYYYMMDD
    let m;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);                 // MM/DD/YYYY
    if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);                 // MM/DD/YY
    if (m) { const yr = parseInt(m[3]) > 50 ? '19'+m[3] : '20'+m[3]; return `${yr}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`; }
    m = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);                     // YYYY/MM/DD
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);                   // DD-MM-YYYY or MM-DD-YYYY
    if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
    m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);                 // DD.MM.YYYY
    if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
    m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/);        // Jan 15, 2025
    if (m) { const mo = _moNum(m[1]); if (mo) return `${m[3]}-${mo}-${m[2].padStart(2,'0')}`; }
    m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/);          // 15 Jan 2025
    if (m) { const mo = _moNum(m[2]); if (mo) return `${m[3]}-${mo}-${m[1].padStart(2,'0')}`; }
    m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);              // 15-Jan-2025
    if (m) { const mo = _moNum(m[2]); if (mo) return `${m[3]}-${mo}-${m[1].padStart(2,'0')}`; }
    m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2})\/(\d{4})$/);          // Jan 15/2025
    if (m) { const mo = _moNum(m[1]); if (mo) return `${m[3]}-${mo}-${m[2].padStart(2,'0')}`; }
    m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);              // 15-Jan-25
    if (m) { const mo = _moNum(m[2]); const yr = parseInt(m[3]) > 50 ? '19'+m[3] : '20'+m[3]; if (mo) return `${yr}-${mo}-${m[1].padStart(2,'0')}`; }
    return null;
}
function _moNum(s) {
    const M = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
               jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
    return M[s.slice(0,3).toLowerCase()] || null;
}
function _amt(s) {
    return parseFloat((s||'').replace(/[$,\s"]/g,'').replace(/[^\d.\-]/g,'')) || 0;
}

/* ════════════════════════════════════════════
   BANK DETECTOR
   Order matters — more specific checks first
════════════════════════════════════════════ */
function _detectBank(h, metaLines) {
    const has  = (...keys) => keys.every(k => h.some(col => col.includes(k)));
    const col  = k => h.findIndex(c => c.includes(k));
    const meta = metaLines.join(' ').toLowerCase();

    // ── RBC ─ "account type" + "cad$" / "usd$" ─────
    if (has('account type') && (has('cad$') || has('usd$'))) return {
        name: 'RBC Royal Bank',
        parse(h, rows) {
            const iDate = col('transaction date'), iD1 = col('description 1'),
                  iD2   = col('description 2'),
                  iAmt  = h.findIndex(c => c.includes('cad$') || c.includes('usd$'));
            return rows.map(r => {
                const amount = _amt(r[iAmt]);
                const desc = [r[iD1], r[iD2]].filter(Boolean).join(' ').trim() || 'Transaction';
                return { date: _normDate(r[iDate]), desc, amount: Math.abs(amount),
                         type: amount < 0 ? 'expense' : 'income', raw: r.join(',') };
            }).filter(t => t.date && t.amount > 0);
        }
    };

    // ── BMO ─ "date posted" / "transaction amount" ──
    if (has('date posted') || (has('transaction amount') && has('description'))) return {
        name: 'BMO Bank of Montreal',
        parse(h, rows) {
            const iDate = col('date posted') !== -1 ? col('date posted') : col('date'),
                  iAmt  = col('transaction amount'), iDesc = col('description');
            return rows.map(r => {
                const amount = _amt(r[iAmt]);
                return { date: _normDate(r[iDate]), desc: r[iDesc] || 'Transaction',
                         amount: Math.abs(amount),
                         type: amount < 0 ? 'expense' : 'income', raw: r.join(',') };
            }).filter(t => t.date && t.amount > 0);
        }
    };

    // ── Scotiabank ─ "withdrawals" + "deposits" columns ─
    // Note: Meridian may also use this layout — both handled here
    if (has('withdrawals') && has('deposits')) return {
        name: 'Scotiabank',
        parse(h, rows) {
            const iDate = col('date'), iDesc = col('description'),
                  iWith = col('withdrawals'), iDep = col('deposits');
            return rows.map(r => {
                const w = _amt(r[iWith]), d = _amt(r[iDep]);
                const amount = w || d;
                return { date: _normDate(r[iDate]), desc: r[iDesc] || 'Transaction',
                         amount: Math.abs(amount), type: w ? 'expense' : 'income',
                         raw: r.join(',') };
            }).filter(t => t.date && t.amount > 0);
        }
    };

    // ── Meridian Credit Union ─ two possible layouts:
    //   Layout A: signed Amount + Balance (web portal CSV download)
    //   Layout B: Debit/Credit split + Balance (some account types)
    if (has('account name') || (has('description1') && has('description2'))) return {
        name: 'Meridian Credit Union',
        parse(h, rows) {
            const iDate  = col('date');
            const iDesc1 = h.findIndex(function(c) { return c.includes('description1'); });
            const iDesc2 = h.findIndex(function(c) { return c.includes('description2'); });
            const iAmt   = col('amount');
            return rows.map(function(r) {
                const amount = _amt(r[iAmt]);
                // Combine Description1 + Description2, skip "Other Reference #..." noise
                const d1 = (r[iDesc1] || '').trim();
                const d2 = (r[iDesc2] || '').trim();
                const skipD2 = /^other reference/i.test(d2) || /^confirmation/i.test(d2) || !d2;
                const desc = skipD2 ? (d1 || 'Transaction') : (d1 + ' – ' + d2);
                return { date: _normDate(r[iDate]), desc: desc || 'Transaction',
                         amount: Math.abs(amount),
                         type: amount < 0 ? 'expense' : 'income',
                         raw: r.join(',') };
            }).filter(function(t) { return t.date && t.amount > 0; });
        }
    };

    // ── Meridian / CIBC debit+credit split layout ──────────────────
    if (has('date') && has('description') && (has('debit') || has('credit')) && has('balance')) {
        return {
            name: 'Meridian Credit Union / CIBC',
            parse(h, rows) {
                const iDate = col('date'), iDesc = col('description'),
                      iDebit = col('debit'), iCredit = col('credit');
                return rows.map(r => {
                    const debit  = _amt(r[iDebit]);
                    const credit = _amt(r[iCredit]);
                    const amount = debit || credit;
                    return { date: _normDate(r[iDate]), desc: r[iDesc] || 'Transaction',
                             amount: Math.abs(amount), type: debit ? 'expense' : 'income',
                             raw: r.join(',') };
                }).filter(t => t.date && t.amount > 0);
            }
        };
    }

    // ── CIBC ─ date, description, debit, credit (no balance col) ─
    if (has('date') && has('description') && has('debit') && has('credit')) return {
        name: 'CIBC / Simplii Financial',
        parse(h, rows) {
            const iDate = col('date'), iDesc = col('description'),
                  iDebit = col('debit'), iCredit = col('credit');
            return rows.map(r => {
                const debit  = _amt(r[iDebit]);
                const credit = _amt(r[iCredit]);
                const amount = debit || credit;
                return { date: _normDate(r[iDate]), desc: r[iDesc] || 'Transaction',
                         amount: Math.abs(amount), type: debit ? 'expense' : 'income',
                         raw: r.join(',') };
            }).filter(t => t.date && t.amount > 0);
        }
    };

    // ── TD ─ date, description, debit, credit (≤5 cols, no balance) ─
    if (has('date') && has('description') && (has('debit') || has('credit')) && h.length <= 5) return {
        name: 'TD Bank',
        parse(h, rows) {
            const iDate = col('date'), iDesc = col('description'),
                  iDebit = col('debit'), iCredit = col('credit');
            return rows.map(r => {
                const debit  = _amt(r[iDebit]);
                const credit = _amt(r[iCredit]);
                const amount = debit || credit;
                return { date: _normDate(r[iDate]), desc: r[iDesc] || 'Transaction',
                         amount: Math.abs(amount), type: debit ? 'expense' : 'income',
                         raw: r.join(',') };
            }).filter(t => t.date && t.amount > 0);
        }
    };

    // ── Simplii Financial ─ "funds out" / "funds in" ─
    if (has('funds out') || has('funds in') || has('transaction details')) return {
        name: 'Simplii Financial',
        parse(h, rows) {
            const iDate = col('date'),
                  iDesc = col('transaction details') !== -1 ? col('transaction details') : col('description'),
                  iOut  = h.findIndex(c => c.includes('funds out')),
                  iIn   = h.findIndex(c => c.includes('funds in'));
            return rows.map(r => {
                const out = _amt(r[iOut]), inn = _amt(r[iIn]);
                const amount = out || inn;
                return { date: _normDate(r[iDate]), desc: r[iDesc] || 'Transaction',
                         amount: Math.abs(amount), type: out ? 'expense' : 'income',
                         raw: r.join(',') };
            }).filter(t => t.date && t.amount > 0);
        }
    };

    // ── Tangerine ─ "transaction type" + "name" + "memo" ─
    if (has('transaction') || (has('name') && has('memo') && has('amount'))) return {
        name: 'Tangerine Bank',
        parse(h, rows) {
            const iDate = col('date'),
                  iDesc = h.findIndex(c => c.includes('name') || c.includes('description')),
                  iMemo = col('memo'), iAmt = col('amount');
            return rows.map(r => {
                const amount = _amt(r[iAmt]);
                const desc = [r[iDesc], r[iMemo]].filter(v => v && v.trim())
                              .filter((v,i,a) => a.indexOf(v) === i).join(' – ').trim() || 'Transaction';
                return { date: _normDate(r[iDate]), desc, amount: Math.abs(amount),
                         type: amount < 0 ? 'expense' : 'income', raw: r.join(',') };
            }).filter(t => t.date && t.amount > 0);
        }
    };

    // ── EQ Bank ─ single signed "amount" column ─────
    if (has('date') && has('description') && has('amount') && !has('balance')) return {
        name: 'EQ Bank',
        parse(h, rows) {
            const iDate = col('date'), iDesc = col('description'), iAmt = col('amount');
            return rows.map(r => {
                const amount = _amt(r[iAmt]);
                return { date: _normDate(r[iDate]), desc: r[iDesc] || 'Transaction',
                         amount: Math.abs(amount),
                         type: amount < 0 ? 'expense' : 'income', raw: r.join(',') };
            }).filter(t => t.date && t.amount > 0);
        }
    };

    // ── National Bank ─ French headers ─────────────
    if (has('débit') || has('crédit') || has('date de transaction') || has('numero')) return {
        name: 'National Bank',
        parse(h, rows) {
            const iDate   = h.findIndex(c => c.includes('date')),
                  iDesc   = h.findIndex(c => c.includes('description')),
                  iDebit  = h.findIndex(c => c.includes('débit') || c.includes('debit')),
                  iCredit = h.findIndex(c => c.includes('crédit') || c.includes('credit'));
            return rows.map(r => {
                const debit  = _amt(r[iDebit]);
                const credit = _amt(r[iCredit]);
                const amount = debit || credit;
                return { date: _normDate(r[iDate]), desc: r[iDesc] || 'Transaction',
                         amount: Math.abs(amount), type: debit ? 'expense' : 'income',
                         raw: r.join(',') };
            }).filter(t => t.date && t.amount > 0);
        }
    };

    // ── Generic fallback ─────────────────────────────
    return {
        name: 'Unknown Bank',
        parse(h, rows) {
            const iDate   = h.findIndex(c => c.includes('date') || c.includes('posted'));
            const iDesc   = h.findIndex(c => c.includes('description') || c.includes('details') || c.includes('memo') || c.includes('payee') || c.includes('name') || c.includes('reference') || c.includes('narrative'));
            const iAmt    = h.findIndex(c => c.includes('amount') || c.includes('cad') || c.includes('usd') || c.includes('value') || c.includes('sum'));
            const iDebit  = h.findIndex(c => c.includes('debit') || c.includes('withdrawal') || c.includes('out'));
            const iCredit = h.findIndex(c => c.includes('credit') || c.includes('deposit') || c.includes('in'));
            if (iDate === -1)
                throw new Error('Could not find a date column. Columns found: ' + h.join(', '));
            if (iAmt === -1 && iDebit === -1 && iCredit === -1)
                throw new Error('Could not find amount, debit, or credit columns. Columns found: ' + h.join(', '));
            return rows.map(r => {
                let amount, type;
                if (iAmt !== -1) {
                    amount = _amt(r[iAmt]);
                    type = amount < 0 ? 'expense' : 'income';
                    amount = Math.abs(amount);
                } else {
                    const d = iDebit !== -1 ? _amt(r[iDebit]) : 0;
                    const cr = iCredit !== -1 ? _amt(r[iCredit]) : 0;
                    amount = d || cr; type = d ? 'expense' : 'income';
                }
                const desc = iDesc !== -1 ? (r[iDesc] || 'Transaction') : 'Transaction';
                return { date: _normDate(r[iDate]), desc,
                         amount: Math.abs(amount), type, raw: r.join(',') };
            }).filter(t => t && t.date && t.amount > 0);
        }
    };
}

/* ════════════════════════════════════════════
   IMPORT REVIEW MODAL
════════════════════════════════════════════ */

function _txFingerprint(t) {
    return `${t.date}|${Math.round(t.amount * 100)}|${(t.desc||'').trim().toLowerCase()}`;
}

// Build category options HTML
function _catOptHtml() {
    return Object.keys(expenseCategories).map(m =>
        `<option value="${m}">${mainEmojis[m]||'📁'} ${m}</option>`
    ).join('');
}
function _subOptHtml(main) {
    return (expenseCategories[main] || []).map(s =>
        `<option value="${s}">${s}</option>`
    ).join('');
}

function _openImportModal(filename) {
    var existing = new Set(transactions.map(_txFingerprint));
    _importParsed.forEach(function(t) { t.isDup = existing.has(_txFingerprint(t)); });

    var newCount = _importParsed.filter(function(t) { return !t.isDup; }).length;
    var dupCount = _importParsed.filter(function(t) { return  t.isDup; }).length;
    var bankName = _importParsed._bank || 'Unknown Bank';

    var firstMain = Object.keys(expenseCategories).filter(k => k !== 'Income')[0] || '';
    var firstSub  = (expenseCategories[firstMain] || [])[0] || '';
    _importParsed.forEach(function(t) {
        if (!t._main) t._main = firstMain;
        if (!t._sub)  t._sub  = firstSub;
    });

    // Reset account selection
    _importAccountId = '';

    document.getElementById('import-modal-subtitle').textContent = filename;
    document.getElementById('import-bank-label').textContent = '🏦 ' + bankName;
    document.getElementById('import-count-new').textContent = newCount + ' new';
    document.getElementById('import-count-dup').textContent = dupCount > 0
        ? dupCount + ' duplicate' + (dupCount > 1 ? 's' : '') : '';

    _importUpdateBtn();

    // Build expense category options (exclude Income section)
    var catOpts = Object.keys(expenseCategories).filter(k => k !== 'Income').map(function(m) {
        return '<option value="' + m + '">' + (mainEmojis[m] || '📁') + ' ' + m + '</option>';
    }).join('');

    // Build account selector
    var acctSel = document.getElementById('import-account-sel');
    if (acctSel) {
        var acctHtml = '<option value="">None</option>';
        walletAccounts.forEach(function(a) {
            acctHtml += '<option value="' + a.id + '">' + (a.icon || '🏦') + ' ' + a.name + '</option>';
        });
        acctSel.innerHTML = acctHtml;
        acctSel.value = '';
    }

    // Build batch category selectors
    var batchMainSel = document.getElementById('import-batch-main');
    if (batchMainSel) {
        batchMainSel.innerHTML = '<option value="">—</option>' + catOpts;
        batchMainSel.value = '';
    }
    var batchSubSel = document.getElementById('import-batch-sub');
    if (batchSubSel) { batchSubSel.innerHTML = '<option value="">—</option>'; batchSubSel.value = ''; }

    var list = document.getElementById('import-review-list');
    list.innerHTML = '';

    if (_importParsed.length === 0) {
        list.innerHTML = '<p class="text-zinc-600 text-sm text-center py-10">No transactions found.</p>';
        document.getElementById('bank-import-modal').classList.remove('hidden');
        return;
    }

    var byDate = {};
    _importParsed.forEach(function(t, i) {
        var d = t.date || 'unknown';
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push({ t: t, i: i });
    });

    Object.keys(byDate).sort().reverse().forEach(function(date) {
        var label = document.createElement('p');
        label.className = 'text-[10px] font-black tracking-widest text-zinc-600 uppercase px-1 py-2 mt-1';
        try {
            label.textContent = new Date(date + 'T12:00:00').toLocaleDateString('en-CA', {weekday:'short', month:'short', day:'numeric'});
        } catch(e) { label.textContent = date; }
        list.appendChild(label);

        byDate[date].forEach(function(entry) {
            var t = entry.t, idx = entry.i;
            var isExp = (t.type === 'expense');
            var row = document.createElement('div');
            row.className = 'rounded-2xl mb-2 overflow-hidden ' + (t.isDup ? 'opacity-30' : 'bg-zinc-900');
            row.id = 'import-row-' + idx;

            var topRow = '<div class="flex items-center gap-3 px-3 pt-3 ' + (t.isDup ? '' : 'pb-2') + '">'
                + '<div class="w-1 h-9 rounded-full shrink-0 ' + (isExp ? 'bg-rose-500' : 'bg-emerald-500') + '"></div>'
                + '<div class="flex-1 min-w-0">'
                + '<div class="text-sm font-medium truncate ' + (t.isDup ? 'line-through' : '') + '">' + _escHtml(t.desc) + '</div>'
                + '<div class="text-[11px] text-zinc-500 mt-0.5">' + (t.isDup ? 'Already imported' : date) + '</div>'
                + '</div>'
                + '<div class="text-sm font-semibold shrink-0 ' + (isExp ? 'text-zinc-200' : 'text-emerald-400') + '">'
                + (isExp ? '−' : '+') + '$' + t.amount.toFixed(2)
                + '</div></div>';

            var selRow = '';
            if (!t.isDup) {
                var subOptsNew = _subOptHtmlWithNew(t._main);
                var incOpts = (expenseCategories['Income'] || incomeCats).map(function(ic) {
                    return '<option value="' + ic + '"' + (t._incCat === ic ? ' selected' : '') + '>' + ic + '</option>';
                }).join('');
                selRow = '<div class="px-5 pb-3 pt-1 flex flex-wrap gap-2">'
                    + '<select class="import-type-sel flex-none w-24 bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500" data-idx="' + idx + '" onchange="_importTypeChange(this)">'
                    + '<option value="expense"' + (isExp ? ' selected' : '') + '>Expense</option>'
                    + '<option value="income"' + (!isExp ? ' selected' : '') + '>Income</option>'
                    + '<option value="excluded">Exclude</option>'
                    + '</select>'
                    + '<select class="import-main-sel flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500 ' + (!isExp ? 'hidden' : '') + '" data-idx="' + idx + '" onchange="_importMainChange(this)">'
                    + catOpts + '</select>'
                    + '<select class="import-sub-sel flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500 ' + (!isExp ? 'hidden' : '') + '" data-idx="' + idx + '" onchange="_importSubChange(this)">'
                    + subOptsNew + '</select>'
                    + '<select class="import-inc-sel flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500 ' + (isExp ? 'hidden' : '') + '" data-idx="' + idx + '">'
                    + incOpts + '</select>'
                    + '</div>';
            }

            row.innerHTML = topRow + selRow;

            if (!t.isDup) {
                var mainSel = row.querySelector('.import-main-sel');
                var subSel  = row.querySelector('.import-sub-sel');
                if (mainSel) mainSel.value = t._main;
                if (subSel)  subSel.value  = t._sub;
            }
            list.appendChild(row);
        });
    });

    document.getElementById('bank-import-modal').classList.remove('hidden');
}

function _importUpdateBtn() {
    var newCount = _importParsed.filter(function(t) { return !t.isDup; }).length;
    var btn = document.getElementById('import-confirm-btn');
    if (!btn) return;
    btn.textContent = newCount === 0
        ? 'Nothing new to import'
        : 'Import ' + newCount + ' Transaction' + (newCount > 1 ? 's' : '');
    btn.disabled = newCount === 0;
}

function _importBatchMain(sel) {
    if (!sel.value) return;
    var main = sel.value;
    var subSel = document.getElementById('import-batch-sub');
    if (subSel) { subSel.innerHTML = '<option value="">—</option>' + _subOptHtmlWithNew(main); subSel.value = ''; }
    // Apply to all non-duplicate expense rows
    _importParsed.forEach(function(t, i) {
        if (t.isDup || t.type !== 'expense') return;
        t._main = main;
        t._sub = (expenseCategories[main] || [])[0] || '';
        var row = document.getElementById('import-row-' + i);
        if (!row) return;
        var ms = row.querySelector('.import-main-sel');
        var ss = row.querySelector('.import-sub-sel');
        if (ms) ms.value = main;
        if (ss) { ss.innerHTML = _subOptHtmlWithNew(main); ss.value = t._sub; }
    });
}

function _importBatchSub(sel) {
    if (!sel.value || sel.value === '__new__') return;
    var sub = sel.value;
    var batchMain = document.getElementById('import-batch-main');
    var main = batchMain ? batchMain.value : '';
    if (!main) return;
    _importParsed.forEach(function(t, i) {
        if (t.isDup || t.type !== 'expense' || t._main !== main) return;
        t._sub = sub;
        var row = document.getElementById('import-row-' + i);
        if (!row) return;
        var ss = row.querySelector('.import-sub-sel');
        if (ss) ss.value = sub;
    });
}

function _importAccountChange(sel) {
    _importAccountId = sel.value;
}

function _escHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _importTypeChange(sel) {
    const idx    = parseInt(sel.dataset.idx);
    const t      = _importParsed[idx];
    t.type       = sel.value;
    const row    = sel.closest('div.rounded-2xl');
    const bar    = row.querySelector('.w-1');
    const amtEl  = row.querySelector('.text-sm.font-semibold.shrink-0');
    const mainS  = row.querySelector('.import-main-sel');
    const subS   = row.querySelector('.import-sub-sel');
    const incS   = row.querySelector('.import-inc-sel');
    const isExp  = t.type === 'expense';
    const isInc  = t.type === 'income';
    const isExcl = t.type === 'excluded';
    if (bar)   bar.className = 'w-1 h-9 rounded-full shrink-0 ' + (isExcl ? 'bg-zinc-600' : isInc ? 'bg-emerald-500' : 'bg-rose-500');
    if (amtEl) {
        amtEl.className  = 'text-sm font-semibold shrink-0 ' + (isExcl ? 'text-zinc-600 line-through' : isInc ? 'text-emerald-400' : 'text-zinc-200');
        amtEl.textContent = (isInc ? '+' : '−') + '$' + t.amount.toFixed(2);
    }
    if (mainS) mainS.classList.toggle('hidden', !isExp);
    if (subS)  subS.classList.toggle('hidden', !isExp);
    if (incS)  incS.classList.toggle('hidden', !isInc);
    const topDiv = row.querySelector('.flex.items-center.gap-3');
    if (topDiv) topDiv.style.opacity = isExcl ? '0.35' : '';
}

function _importMainChange(sel) {
    const idx  = parseInt(sel.dataset.idx);
    const t    = _importParsed[idx];
    t._main    = sel.value;
    const subs = expenseCategories[t._main] || [];
    t._sub     = subs[0] || '';
    const subS = sel.closest('div').querySelector('.import-sub-sel');
    if (subS) { subS.innerHTML = _subOptHtmlWithNew(t._main); subS.value = t._sub; }
}

function _subOptHtmlWithNew(main) {
    const opts = (expenseCategories[main] || []).map(function(s) {
        return '<option value="' + s + '">' + s + '</option>';
    }).join('');
    return opts + '<option value="__new__">✚ New category…</option>';
}

function _importSubChange(sel) {
    if (sel.value !== '__new__') return;
    const idx    = parseInt(sel.dataset.idx);
    const t      = _importParsed[idx];
    const row    = sel.closest('.rounded-2xl');
    const mainS  = row ? row.querySelector('.import-main-sel') : null;
    const main   = (mainS && mainS.value) || t._main;
    const name   = prompt('New category under "' + main + '":');
    if (!name || !name.trim()) {
        sel.value = (expenseCategories[main] || [])[0] || '';
        return;
    }
    const trimmed = name.trim();
    if (!expenseCategories[main]) expenseCategories[main] = [];
    if (!expenseCategories[main].includes(trimmed)) {
        expenseCategories[main].push(trimmed);
        saveData();
        sel.innerHTML = _subOptHtmlWithNew(main);
    }
    sel.value = trimmed;
    t._sub = trimmed;
}

function closeBankImport() {
    document.getElementById('bank-import-modal').classList.add('hidden');
    _importParsed = [];
}

function confirmBankImport() {
    // Sync final state from DOM selectors
    document.querySelectorAll('.import-type-sel').forEach(function(sel) {
        const i = parseInt(sel.dataset.idx);
        if (i >= 0 && !isNaN(i)) _importParsed[i].type = sel.value;
    });
    document.querySelectorAll('.import-main-sel').forEach(function(sel) {
        const i = parseInt(sel.dataset.idx);
        if (i >= 0 && !isNaN(i)) _importParsed[i]._main = sel.value;
    });
    document.querySelectorAll('.import-sub-sel').forEach(function(sel) {
        const i = parseInt(sel.dataset.idx);
        if (i >= 0 && !isNaN(i) && sel.value !== '__new__') _importParsed[i]._sub = sel.value;
    });
    document.querySelectorAll('.import-inc-sel').forEach(function(sel) {
        const i = parseInt(sel.dataset.idx);
        if (i >= 0 && !isNaN(i)) _importParsed[i]._incCat = sel.value;
    });

    const toImport = _importParsed.filter(function(t) { return !t.isDup && t.type !== 'excluded'; });
    const toExclude = _importParsed.filter(function(t) { return !t.isDup && t.type === 'excluded'; });
    if (toImport.length === 0 && toExclude.length === 0) { closeBankImport(); return; }

    // Get linked account
    var acctSel = document.getElementById('import-account-sel');
    var linkedAccId = (acctSel && acctSel.value) || _importAccountId || '';

    // Use incrementing IDs to avoid collision in tight loop
    let idBase = Date.now();

    // Import excluded transactions
    toExclude.slice().reverse().forEach(function(t, idx) {
        const tx = { id: idBase + idx + 0.5, amount: t.amount, date: t.date, desc: t.desc,
                     type: 'expense', excluded: true,
                     mainCategory: t._main || '', subCategory: t._sub || '' };
        if (linkedAccId) tx.walletAccountId = linkedAccId;
        transactions.unshift(tx);
    });

    // Import regular transactions
    toImport.slice().reverse().forEach(function(t, idx) {
        const tx = { id: idBase + idx + toExclude.length + 1,
                     amount: t.amount, date: t.date, desc: t.desc };
        if (t.type === 'income') {
            tx.type = 'income';
            tx.mainCategory = t._incCat || incomeCats[0] || 'Other';
            tx.subCategory = '';
        } else {
            tx.type = 'expense';
            tx.mainCategory = t._main || '';
            tx.subCategory = t._sub || '';
        }
        if (linkedAccId) {
            tx.walletAccountId = linkedAccId;
            // Update account balance
            if (!tx.excluded) _updateAccountBalances(tx, false);
        }
        transactions.unshift(tx);
    });

    const totalImported = toImport.length + toExclude.length;
    saveData();
    renderAll();
    closeBankImport();
    showToast('Imported ' + totalImported + ' transaction' + (totalImported > 1 ? 's' : ''), 'emerald');
}
