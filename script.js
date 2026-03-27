// ════════════════════════════════════════
//  SUPABASE — live view sync
// ════════════════════════════════════════
const SUPABASE_URL = 'https://cwmcofpgzhhqbfmapkci.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3bWNvZnBnemhocWJmbWFwa2NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2OTQxMTQsImV4cCI6MjA4OTI3MDExNH0.Kd1fD8eyHJKAJShiqSy08MTgdpsn60YEOvJlJ3-y8mo';
const sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY) ?? null;

async function pushLiveState() {
  if (!sb) return;
  const stateStr = localStorage.getItem('fiveAlive_state');
  if (!stateStr) return;
  const state = JSON.parse(stateStr);
  const hasComp = Object.values(state.events||{}).some(ev => ev.phase === 'competition' || ev.phase === 'results');
  if (!hasComp) return;
  try {
    await sb.from('live_state').upsert({ id: 1, state, updated_at: new Date().toISOString() });
  } catch(e) {
    console.warn('Live sync error:', e);
  }
}

// ════════════════════════════════════════
//  EMBEDDED ATHLETE DATA (loaded from pdf-data.js)
// ════════════════════════════════════════
// PDF_DATA is now loaded from pdf-data.js and is empty by default
// Add ?test to the URL to load test data: http://localhost:8000?test

// ════════════════════════════════════════
//  TWO-EVENT STATE
// ════════════════════════════════════════
function makeEventState() {
  return {
    athletes: [],
    heights: [],
    hIdx: 0,
    rotation: [],
    waitList: [],
    cur: -1,
    ended: false,
    skippedMisses: {},
    setupHeights: [],
    phase: 'setup',  // 'setup', 'checkin', 'competition', 'results'
  };
}

const EVENTS = { girls: makeEventState(), boys: makeEventState() };
let activeEvent = 'girls';
function E() { return EVENTS[activeEvent]; }

// ════════════════════════════════════════
//  UNIT SYSTEM
// ════════════════════════════════════════
let unitSystem = 'metric';

function setUnit(u) {
  const startEl=document.getElementById('startM');
  const prevUnit=unitSystem;
  const norm=parseStartHeight();
  unitSystem = u;
  document.getElementById('unitMetric').style.background = u==='metric' ? 'var(--accent2)' : 'var(--surface2)';
  document.getElementById('unitMetric').style.color = u==='metric' ? '#0d0f14' : 'var(--dim)';
  document.getElementById('unitImperial').style.background = u==='imperial' ? 'var(--accent2)' : 'var(--surface2)';
  document.getElementById('unitImperial').style.color = u==='imperial' ? '#0d0f14' : 'var(--dim)';
  document.getElementById('startLabel').textContent = u==='metric' ? 'Starting Height (m)' : "Starting Height (ft'in)";
  if(norm!==null && prevUnit!==u) {
    if(u==='metric'){
      // norm was in inches (imperial), convert to meters
      startEl.value = (norm*2.54/100).toFixed(2);
    } else {
      // norm was in cm (metric), convert to total inches
      const totalIn=Math.round(norm/2.54);
      startEl.value = `${Math.floor(totalIn/12)}'${totalIn%12}"`;
    }
  } else if(norm===null) {
    startEl.value = u==='metric' ? '1.53' : "5'0\"";
  }
  buildIncChips(); buildRaiseChips(); rebuildHeights(); updateAthleteDropdowns();
}

const METRIC_INCS = [{v:1,l:'+1 cm'},{v:2,l:'+2 cm'},{v:3,l:'+3 cm',def:true},{v:5,l:'+5 cm'},{v:'custom',l:'Custom'}];
const IMPERIAL_INCS = [{v:1,l:'+1 in'},{v:2,l:'+2 in',def:true},{v:3,l:'+3 in'},{v:4,l:'+4 in'},{v:'custom',l:'Custom'}];
let selectedInc = 3;
let compRaiseVal = 3;

function buildIncChips() {
  const incs = unitSystem==='metric' ? METRIC_INCS : IMPERIAL_INCS;
  const def = incs.find(i=>i.def)||incs[0];
  selectedInc = def.v==='custom' ? 0 : def.v;
  const el = document.getElementById('incChips'); el.innerHTML='';
  incs.forEach(inc=>{
    const c=document.createElement('div'); c.className='inc-chip'+(inc.def?' selected':'');
    c.dataset.val=inc.v; c.textContent=inc.l; c.onclick=()=>selInc(c); el.appendChild(c);
  });
  document.getElementById('customIncUnit').textContent = unitSystem==='metric'?'cm':'in';
  document.getElementById('customRaiseUnit').textContent = unitSystem==='metric'?'cm':'in';
}

function buildRaiseChips() {
  const incs = unitSystem==='metric' ? METRIC_INCS : IMPERIAL_INCS;
  const def = incs.find(i=>i.def)||incs[0];
  compRaiseVal = def.v==='custom' ? 0 : def.v;
  const el = document.getElementById('raiseChips'); el.innerHTML='';
  incs.forEach(inc=>{
    const c=document.createElement('div');
    c.className='raise-chip'+(inc.def?' sel':'')+(inc.v==='custom'?' custom':'');
    c.dataset.val=inc.v; c.textContent=inc.v==='custom'?'Custom':`+${inc.v}`;
    c.onclick=()=>selRaise(c); el.appendChild(c);
  });
  updateRaisePreview();
}

function selInc(chip) {
  document.querySelectorAll('#incChips .inc-chip').forEach(c=>c.classList.remove('selected'));
  chip.classList.add('selected');
  const val=chip.dataset.val, wrap=document.getElementById('customIncWrap');
  if(val==='custom'){wrap.style.display='flex';selectedInc=parseFloat(document.getElementById('customIncVal').value)||0;}
  else{wrap.style.display='none';selectedInc=parseInt(val);}
  rebuildHeights();
}

// ════════════════════════════════════════
//  HEIGHT UTILITIES
// ════════════════════════════════════════
function toNorm(h) {
  if(!h) return -1;
  const mM=String(h).match(/^([\d.]+)\s*m$/i); if(mM) return parseFloat(mM[1])*100;
  const ftIn=String(h).match(/(\d+)'(\d+)/); if(ftIn) return +ftIn[1]*12+ +ftIn[2];
  const ftOnly=String(h).match(/^(\d+)'\s*"?\s*$/); if(ftOnly) return +ftOnly[1]*12;
  const bare=parseFloat(h); return isNaN(bare)?-1:bare;
}
function toM(h){return toNorm(h);}

function normToDisplay(norm) {
  if(unitSystem==='metric') return (norm/100).toFixed(2)+' m';
  const ft=Math.floor(norm/12), inches=norm%12; return `${ft}'${inches}"`;
}

function parseStartHeight() {
  const raw=document.getElementById('startM').value.trim(); if(!raw) return null;
  if(unitSystem==='metric'){const v=parseFloat(raw);return isNaN(v)?null:v*100;}
  // Try to match: feet'inches (e.g., 5'10", 5'10, 5-10, 5 10)
  const ftIn=raw.match(/(\d+)['\s\-]+(\d+)/); if(ftIn) return +ftIn[1]*12+ +ftIn[2];
  // Try feet only (e.g., 5, 5', 5-) 
  const ftOnly=raw.match(/^(\d+)['"\s\-]*$/); if(ftOnly) return +ftOnly[1]*12;
  const bare=parseFloat(raw); return isNaN(bare)?null:bare;
}

// ════════════════════════════════════════
//  SETUP HEIGHT BUILDER
// ════════════════════════════════════════
let setupHeights = [];

function restoreDefaultStartH(){
  const el=document.getElementById('startM');
  if(!el.value.trim()){el.value=unitSystem==='metric'?'1.53':"5'0\"";rebuildHeights();}
}
function rebuildHeights() {
  const customChip=document.querySelector('#incChips .inc-chip[data-val="custom"]');
  if(customChip&&customChip.classList.contains('selected'))
    selectedInc=parseFloat(document.getElementById('customIncVal').value)||0;
  const startNorm=parseStartHeight(), n=parseInt(document.getElementById('numHeights').value)||8;
  if(startNorm===null||isNaN(startNorm)||selectedInc<=0){
    document.getElementById('heightPreview').innerHTML='<span style="color:var(--dim);font-size:13px">Enter a starting height to preview heights.</span>';
    setupHeights=[]; updateAthleteDropdowns(); return;
  }
  setupHeights=[];
  for(let i=0;i<n;i++) setupHeights.push(normToDisplay(Math.round(startNorm+i*selectedInc)));
  renderHeightPreview(); updateAthleteDropdowns();
}

function renderHeightPreview() {
  const el=document.getElementById('heightPreview');
  el.innerHTML=`<div class="preview-label">Heights Preview</div><div class="preview-pills" id="previewPills"></div>`;
  const pills=document.getElementById('previewPills');
  setupHeights.forEach((h,i)=>{
    const p=document.createElement('div'); p.className='hpill'+(i===0?' first':'');
    p.innerHTML=`${h} <button class="rm" onclick="removeSetupHeight(${i})">×</button>`;
    pills.appendChild(p);
  });
  const ab=document.createElement('button'); ab.className='add-height-btn'; ab.textContent='+ Add Height';
  ab.onclick=addCustomSetupHeight; pills.appendChild(ab);
}

function removeSetupHeight(idx){setupHeights.splice(idx,1);renderHeightPreview();updateAthleteDropdowns();}
function addCustomSetupHeight(){
  const hint=unitSystem==='metric'?'meters (e.g. 1.78)':"feet'inches (e.g. 5'10\")";
  const v=prompt(`Add height — enter in ${hint}:`); if(!v) return;
  let norm;
  if(unitSystem==='metric'){norm=Math.round(parseFloat(v)*100);}
  else{
    // Try feet'inches format first
    const ftIn=v.match(/(\d+)['\s\-]+(\d+)/);
    if(ftIn){norm=+ftIn[1]*12+ +ftIn[2];}
    else{
      // Try feet only
      const ftOnly=v.match(/^(\d+)['"\s\-]*$/);
      if(ftOnly){norm=+ftOnly[1]*12;}
      else{norm=parseFloat(v);}
    }
  }
  if(isNaN(norm)){toast('Invalid height');return;}
  setupHeights.push(normToDisplay(norm));
  setupHeights.sort((a,b)=>toNorm(a)-toNorm(b));
  renderHeightPreview(); updateAthleteDropdowns();
}

function updateAthleteDropdowns() {
  document.querySelectorAll('select[data-f="startH"]').forEach(sel=>{
    const cur=sel.value;
    sel.innerHTML='<option value="">— First height —</option>'+
      setupHeights.map(h=>`<option value="${h}"${h===cur?' selected':''}>${h}</option>`).join('');
  });
}

// ════════════════════════════════════════
//  ATHLETE SETUP TABLE
// ════════════════════════════════════════
let rc=0;
function addRow(name='',school='') {
  rc++;
  const id=rc, tbody=document.getElementById('athleteBody'), num=tbody.children.length+1;
  const tr=document.createElement('tr'); tr.id=`r${id}`;
  const opts='<option value="">— First height —</option>'+setupHeights.map(h=>`<option value="${h}">${h}</option>`).join('');
  tr.innerHTML=`
    <td class="anum">${num}</td>
    <td><input placeholder="Athlete name" value="${name}" data-f="name" style="font-size:13px;padding:7px 8px;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:6px;width:100%"></td>
    <td><input placeholder="SCHOOL" value="${school}" data-f="school" style="font-size:13px;padding:7px 8px;font-family:'DM Mono',monospace;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:6px;width:100%;text-transform:uppercase"></td>
    <td><button onclick="rmRow('r${id}')" style="background:transparent;border:1px solid var(--border);color:var(--dim);border-radius:5px;padding:5px 8px;cursor:pointer;font-size:14px;">×</button></td>
  `;
  tbody.appendChild(tr);
}
function rmRow(id){document.getElementById(id)?.remove();renumRows();}
function renumRows(){document.querySelectorAll('#athleteBody tr').forEach((r,i)=>{const n=r.querySelector('.anum');if(n)n.textContent=i+1;});}
function openBulk(){document.getElementById('bulkModal').classList.add('open');}
function closeBulk(){document.getElementById('bulkModal').classList.remove('open');document.getElementById('bulkText').value='';}
function doBulk(){
  document.getElementById('bulkText').value.split(/\n/).map(s=>s.trim()).filter(Boolean).forEach(line=>{
    const ci=line.indexOf(',');
    ci!==-1 ? addRow(line.slice(0,ci).trim(),line.slice(ci+1).trim()) : addRow(line.trim());
  });
  closeBulk();
}

// ════════════════════════════════════════
//  PDF IMPORT
// ════════════════════════════════════════
// Build text lines from normalized {str,x,y,w} items, top-to-bottom
function makeLines(items) {
  if (!items.length) return [];
  const rowMap = new Map();
  items.forEach(item => {
    const y = Math.round(item.y / 3) * 3;
    if (!rowMap.has(y)) rowMap.set(y, []);
    rowMap.get(y).push(item);
  });
  const ys = [...rowMap.keys()].sort((a, b) => b - a);
  return ys.map(y => {
    const cells = rowMap.get(y).sort((a, b) => a.x - b.x);
    let line = '', prevEnd = null;
    cells.forEach(c => {
      if (prevEnd !== null) line += (c.x - prevEnd) > 10 ? '  ' : ' ';
      line += c.str;
      prevEnd = c.x + c.w;
    });
    return line.trim();
  }).filter(Boolean);
}

function extractMeetData(rawItems) {
  const result = { meet: '', date: '', girls: [], boys: [] };
  // Normalize and deduplicate per-page (bold text renders as overlapping duplicates)
  const seen = new Set();
  const items = rawItems
    .filter(i => i.str && i.str.trim())
    .map(i => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width || 0, page: i._page || 1 }))
    .filter(i => {
      const key = `${i.page}|${i.str}|${Math.round(i.x/4)}|${Math.round(i.y/4)}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  if (!items.length) return result;

  // Meet name + date from top ~120pt of page 1
  const page1 = items.filter(i => i.page === 1);
  const maxY = Math.max(...page1.map(i => i.y));
  const headerText = page1.filter(i => i.y > maxY - 120)
    .sort((a, b) => a.x - b.x).map(i => i.str).join(' ');
  const meetMatch = headerText.match(/([A-Z][A-Za-z ]+?(?:Invitational|Championship|Classic|Relays?|Festival|Open|Invite))/);
  if (meetMatch) result.meet = meetMatch[1].trim();
  const headerNoTimestamp = headerText.replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4},?\s+\d{1,2}:\d{2}(\s*[AP]M)?/gi, '');
  const dateRaw = headerNoTimestamp.match(/\b(Jan\w*|Feb\w*|Mar\w*|Apr\w*|May|Jun\w*|Jul\w*|Aug\w*|Sep\w*|Oct\w*|Nov\w*|Dec\w*)\s+(\d{1,2}),?\s+(\d{4})\b/i) ||
    headerNoTimestamp.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (dateRaw) { const d = new Date(dateRaw[0]); if (!isNaN(d)) result.date = d.toISOString().split('T')[0]; }

  // Process page by page — Girls' HJ and Boys' HJ may be on separate pages
  const pageMap = new Map();
  items.forEach(i => {
    if (!pageMap.has(i.page)) pageMap.set(i.page, []);
    pageMap.get(i.page).push(i);
  });

  // For each page, find rows where the reconstructed text contains "High Jump"
  // (handles PDFs where "High" and "Jump" are separate text items) then process
  // each x-column independently to avoid bleeding from adjacent events.
  for (const [pageNum, pageItems] of pageMap) {
    // Build row map by snapped y
    const rowMap = new Map();
    pageItems.forEach(i => {
      const y = Math.round(i.y / 3) * 3;
      if (!rowMap.has(y)) rowMap.set(y, []);
      rowMap.get(y).push(i);
    });

    // Find rows whose combined text contains "High Jump"
    const hjRows = [];
    for (const [y, rowItems] of rowMap) {
      const rowText = rowItems.sort((a, b) => a.x - b.x).map(i => i.str).join(' ');
      if (/high\s*jump/i.test(rowText)) {
        hjRows.push({ y, colX: Math.min(...rowItems.map(i => i.x)) });
      }
    }
    if (!hjRows.length) {
      const pageText = [...rowMap.values()].map(r => r.sort((a,b)=>a.x-b.x).map(i=>i.str).join(' ')).join(' ');
      if (/boys?|girls?|high|jump/i.test(pageText)) console.log(`[PDF] page=${pageNum} hjRows=0 but has keywords — sample:`, pageText.slice(0,200));
      continue;
    }

    // Use page x-extent midpoint to separate left/right columns
    const pageMaxX = Math.max(...pageItems.map(i => i.x + (i.w || 0)));
    const pageMid  = pageMaxX / 2;

    const processHalf = (colItems, label) => {
      const lines = makeLines(colItems);
      const colText = lines.join(' ');
      console.log(`[PDF] page=${pageNum} ${label} items=${colItems.length}`, lines.slice(0, 6));
      if (/girls?/i.test(colText)) result.girls.push(...parseSection(lines, /girls?/i, pageNum));
      if (/boys?/i.test(colText))  result.boys.push(...parseSection(lines, /boys?/i, pageNum));
    };

    const processedCols = new Set();
    for (const hjRow of hjRows) {
      const colKey = Math.round(hjRow.colX / 200);
      if (processedCols.has(colKey)) continue;
      processedCols.add(colKey);
      const isRight = hjRow.colX > pageMid;
      processHalf(
        isRight ? pageItems.filter(i => i.x > pageMid - 20)
                : pageItems.filter(i => i.x <= pageMid + 20),
        `HJ x≈${Math.round(hjRow.colX)} pageMid=${Math.round(pageMid)}`
      );
    }

    // If only one column half was processed, also try the other half —
    // the opposite gender's HJ header may not have formed a clean row
    const foundLeft  = [...processedCols].some(k => k === 0);
    const foundRight = [...processedCols].some(k => k > 0);
    if (foundLeft && !foundRight) {
      processHalf(pageItems.filter(i => i.x > pageMid - 20), `right-fallback pageMid=${Math.round(pageMid)}`);
    } else if (foundRight && !foundLeft) {
      processHalf(pageItems.filter(i => i.x <= pageMid + 20), `left-fallback pageMid=${Math.round(pageMid)}`);
    }
  }

  // Deduplicate by name+school (bold rendering or repeated headers can cause duplicates)
  const dedup = arr => { const s = new Set(); return arr.filter(a => { const k = `${a.name}|${a.school}`; return s.has(k) ? false : (s.add(k), true); }); };
  result.girls = dedup(result.girls);
  result.boys  = dedup(result.boys);

  return result;
}

// Extract athletes from lines below the "High Jump" section header
function parseSection(lines, genderRe, pageNum) {
  // Prefer a short line with both "High Jump" and gender (avoids garbled index rows)
  let start = lines.findIndex(l => /high\s*jump/i.test(l) && genderRe.test(l) && l.length < 80);
  if (start === -1) start = lines.findIndex(l => /high\s*jump/i.test(l) && genderRe.test(l));
  if (start === -1) {
    // Fall back: find a "High Jump" line where gender appears within 3 surrounding lines
    const hjIdx = lines.findIndex(l => /high\s*jump/i.test(l));
    if (hjIdx !== -1) {
      const nearby = lines.slice(Math.max(0, hjIdx - 3), hjIdx + 4).join(' ');
      if (genderRe.test(nearby)) start = hjIdx;
    }
  }
  if (start === -1) return [];
  console.log(`[PDF] parseSection page=${pageNum} gender=${genderRe} start=${start} header="${lines[start]}" next5:`, lines.slice(start+1, start+6));
  const athletes = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    // Stop at any event section header: non-athlete line mentioning a track/field event type
    if (!/^\d/.test(l) && /\b(high\s*jump|relay|hurdle|vault|dash|discus|javelin|triple\s*jump|long\s*jump|shot\s*put)\b/i.test(l)) {
      console.log(`[PDF] parseSection stopped at line ${i}: "${l}"`);
      break;
    }
    const a = parseAthleteLine(l);
    if (a) athletes.push(a);
  }
  console.log(`[PDF] parseSection page=${pageNum} gender=${genderRe} found ${athletes.length} athletes`);
  return athletes;
}

function parseAthleteLine(line) {
  if (!line || line.length < 5) return null;
  // Skip section headers, flight labels, venue records
  if (/^(Flight\s|Venue\s|#\d)/i.test(line)) return null;
  // Strip trailing seed/result height: feet-inches (4-10.00) or metric (1.68m)
  const stripped = line
    .replace(/\s+\d{1,2}-\d{2}\.\d{2}$/, '')
    .replace(/\s+\d+\.\d{2,}m$/i, '')
    .trim();
  // Must start with a sequence number
  const seqMatch = stripped.match(/^(\d{1,3})\s+(.+)$/);
  if (!seqMatch) return null;
  // Strip grade year (9-12) that appears between athlete name and school in some PDF formats
  // e.g. "O'Hara, Sasha  10  LEGEND" → "O'Hara, Sasha  LEGEND"
  const rest = seqMatch[2].trim().replace(/\s+(9|10|11|12)(?=\s+[A-Z])/, '');
  // School is the last all-uppercase token(s) at the end (e.g. "SIMLA", "WOODLAND PARK")
  // Name precedes it in mixed case with possible comma (Last, First format)
  const schoolMatch = rest.match(/^(.+?)\s+([A-Z][A-Z0-9 &.'*\-]{1,50})$/);
  if (!schoolMatch) return null;
  let name = schoolMatch[1].trim();
  const school = schoolMatch[2].trim();
  // School must be all-caps (no lowercase letters)
  if (/[a-z]/.test(school)) return null;
  // School must have at least 2 uppercase letters (not just a digit or punctuation)
  if (!/[A-Z]{2}/.test(school)) return null;
  // Convert "Last, First" → "First Last"
  if (name.includes(',')) {
    const comma = name.indexOf(',');
    name = name.slice(comma + 1).trim() + ' ' + name.slice(0, comma).trim();
  }
  if (name.length > 3 && name.length < 60 && school.length >= 2) return { num: null, name, school };
  return null;
}

function handleDrop(e){e.preventDefault();const f=e.dataTransfer.files[0];if(f&&f.type==='application/pdf') parsePDF(f);}
function handlePDFUpload(e){const f=e.target.files[0];if(f) parsePDF(f);}

async function parsePDF(file) {
  if (!window.pdfjsLib) { toast('PDF import unavailable (no internet connection)'); return; }
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

    console.log('[PDF] numPages:', pdf.numPages);
    let allItems = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      if (i <= 2) console.log(`[PDF] page ${i} raw items:`, textContent.items.length);
      for (const item of textContent.items) {
        item._page = i;
        allItems.push(item);
      }
    }

    console.log('[PDF] allItems total:', allItems.length);
    console.log('[PDF] allItems sample:', allItems.slice(0,5).map(i=>({str:i.str, page:i._page, x:Math.round(i.transform[4]), y:Math.round(i.transform[5])})));
    // Find any items that mention High, Jump, Girls, Boys
    const keyItems = allItems.filter(i => /high|jump|girls?|boys?/i.test(i.str));
    console.log('[PDF] key items (High/Jump/Girls/Boys):', keyItems.map(i=>({str:i.str, page:i._page, x:Math.round(i.transform[4]), y:Math.round(i.transform[5])})));
    const parsedData = extractMeetData(allItems);
    console.log('[PDF] parsedData:', parsedData);

    document.getElementById('meetName').value = parsedData.meet;
    document.getElementById('meetDate').value = parsedData.date;
    
    EVENTS.girls.athletes = parsedData.girls.map((a,i)=>({
      id:i, num:i+1, name:a.name, school:a.school, startH:'', checkedInForComp:false,
      notCompeting:false, checkedOut:false, eliminated:false, bestH:null, attempts:{}
    }));
    EVENTS.boys.athletes = parsedData.boys.map((a,i)=>({
      id:i, num:i+1, name:a.name, school:a.school, startH:'', checkedInForComp:false,
      notCompeting:false, checkedOut:false, eliminated:false, bestH:null, attempts:{}
    }));
    EVENTS.girls.phase='setup'; EVENTS.boys.phase='setup';
    
    updateEventBadges();
    syncAthleteTableFromState();
    
    const res=document.getElementById('importResult');
    res.style.display='block';
    updateImportResultMessage();
    document.getElementById('eventTabs').style.display='flex';
    document.getElementById('tabGirls').style.display='flex';
    document.getElementById('tabBoys').style.display='flex';
    saveState();

    if (parsedData.girls.length === 0 && parsedData.boys.length === 0) {
      toast('⚠ No athletes found — PDF may be scanned. Try converting to text first, or enter athletes manually.');
    } else {
      toast(`✓ PDF imported — ${parsedData.girls.length} Girls, ${parsedData.boys.length} Boys`);
    }
  } catch (err) {
    console.error('PDF parsing error:', err);
    toast('⚠ Could not parse PDF. Using test data if available.');
    
    // Fallback to test data if parsing fails
    const data = PDF_DATA;
    document.getElementById('meetName').value = data.meet;
    document.getElementById('meetDate').value = data.date;
    
    EVENTS.girls.athletes = data.girls.map((a,i)=>({
      id:i, num:i+1, name:a.name, school:a.school, startH:'', checkedInForComp:false,
      notCompeting:false, checkedOut:false, eliminated:false, bestH:null, attempts:{}
    }));
    EVENTS.boys.athletes = data.boys.map((a,i)=>({
      id:i, num:i+1, name:a.name, school:a.school, startH:'', checkedInForComp:false,
      notCompeting:false, checkedOut:false, eliminated:false, bestH:null, attempts:{}
    }));
    EVENTS.girls.phase='setup'; EVENTS.boys.phase='setup';
    
    updateEventBadges();
    syncAthleteTableFromState();
    
    const res=document.getElementById('importResult');
    res.style.display='block';
    updateImportResultMessage();
    document.getElementById('eventTabs').style.display='flex';
    document.getElementById('tabGirls').style.display='flex';
    document.getElementById('tabBoys').style.display='flex';
    saveState();
  }
}

function syncAthleteTableFromState() {
  const tbody=document.getElementById('athleteBody'); tbody.innerHTML=''; rc=0;
  E().athletes.forEach(a=>addRow(a.name,a.school));
}

function updateEventBadges() {
  document.getElementById('badgeGirls').textContent=EVENTS.girls.athletes.length;
  document.getElementById('badgeBoys').textContent=EVENTS.boys.athletes.length;
}

// ════════════════════════════════════════
//  EVENT SWITCHING
// ════════════════════════════════════════
function switchEvent(ev) {
  updatePerGenderHeights();
  saveSetupToState();
  activeEvent=ev;
  document.getElementById('tabGirls').classList.toggle('active',ev==='girls');
  document.getElementById('tabBoys').classList.toggle('active',ev==='boys');
  document.getElementById('checkinEventLabel').textContent=ev==='girls'?'Girls High Jump':'Boys High Jump';
  syncAthleteTableFromState();
  
  // Restore per-gender bar heights for this event
  const phase = E().phase;
  if(phase === 'setup') {
    restorePerGenderHeights();
    showSetup();
  } else if(phase === 'checkin') {
    showCheckin(); renderCheckinGrid();
  } else if(phase === 'competition') {
    showComp();
    renderAll();
  } else if(phase === 'results') {
    showResults();
  }
}

function saveSetupToState() {
  const rows=document.querySelectorAll('#athleteBody tr');
  const athletes=[];
  rows.forEach((r,i)=>{
    const name=r.querySelector('[data-f="name"]')?.value.trim();
    const school=r.querySelector('[data-f="school"]')?.value.trim();
    if(name) {
      const existing = E().athletes[i];
      athletes.push(existing && existing.name===name ? existing : {
        id:i, num:existing?.num||null, name, school:school||'', startH:'', checkedInForComp:false,
        notCompeting:false, checkedOut:false, eliminated:false, bestH:null, attempts:{}
      });
    }
  });
  E().athletes=athletes;
  updateEventBadges();
  saveState();
}

// ════════════════════════════════════════
//  CHECK-IN
// ════════════════════════════════════════
let ciEditingId = null;

function goToCheckin() {
  saveSetupToState();
  if(!setupHeights.length){toast('Set bar heights first');return;}
  updatePerGenderHeights();
  E().setupHeights=[...setupHeights];
  E().phase = 'checkin';
  saveState();
  showCheckin();
  renderCheckinGrid();
}

function renderCheckinGrid() {
  const query=(document.getElementById('ciSearch').value||'').toLowerCase();
  const grid=document.getElementById('checkinGrid'); grid.innerHTML='';
  const athletes=E().athletes.filter(a=>!a.notCompeting||true);

  const filtered = athletes.filter(a=>
    !query || a.name.toLowerCase().includes(query) || a.school.toLowerCase().includes(query)
  );

  filtered.forEach(a=>{
    const card=document.createElement('div');
    let cls='ci-card';
    if(a.notCompeting) cls+=' not-competing';
    else if(a.checkedInForComp) cls+=' checked-in';
    card.className=cls;
    card.onclick=()=>openCiModal(a.id);
    card.innerHTML=`
      <span class="ci-status ${a.notCompeting?'out':a.checkedInForComp?'in':'out'}">${a.notCompeting?'DNS':a.checkedInForComp?'IN':'—'}</span>
      <div class="ci-name">${a.name}</div>
      <div class="ci-school">${a.school}</div>
      ${a.startH?`<div class="ci-startH">enters ${a.startH}</div>`:''}
    `;
    grid.appendChild(card);
  });

  const checkedIn=E().athletes.filter(a=>a.checkedInForComp&&!a.notCompeting).length;
  const noH=E().athletes.filter(a=>a.checkedInForComp&&!a.startH&&!a.notCompeting).length;
  document.getElementById('ciCheckedIn').textContent=checkedIn;
  document.getElementById('ciTotal').textContent=E().athletes.length;
  document.getElementById('ciNoHeight').textContent=noH;
}

function openCiModal(id) {
  const a=E().athletes.find(x=>x.id===id); if(!a) return;
  ciEditingId=id;
  document.getElementById('ciModalTitle').textContent=a.checkedInForComp?'Edit Check-In':'Check In Athlete';
  document.getElementById('ciModalName').textContent=a.name;
  document.getElementById('ciModalSchool').textContent=a.school;
  const sel=document.getElementById('ciStartH');
  const heights=E().setupHeights||setupHeights;
  sel.innerHTML='<option value="">— First height —</option>'+
    heights.map(h=>`<option value="${h}"${h===a.startH?' selected':''}>${h}</option>`).join('');
  document.getElementById('ciRemoveBtn').style.display=a.checkedInForComp?'inline-block':'none';
  document.getElementById('ciModal').classList.add('open');
}

function closeCiModal(){document.getElementById('ciModal').classList.remove('open');ciEditingId=null;}

function ciConfirm() {
  const a=E().athletes.find(x=>x.id===ciEditingId); if(!a) return;
  a.startH=document.getElementById('ciStartH').value;
  a.checkedInForComp=true; a.notCompeting=false;
  closeCiModal(); renderCheckinGrid(); saveState(); toast(`${a.name} checked in ✓`);
}

function ciRemove() {
  const a=E().athletes.find(x=>x.id===ciEditingId); if(!a) return;
  a.checkedInForComp=false; a.notCompeting=true; a.startH='';
  closeCiModal(); renderCheckinGrid(); saveState(); toast(`${a.name} marked DNS`);
}

function checkInAll() {
  E().athletes.forEach(a=>{if(!a.notCompeting){a.checkedInForComp=true;}});
  renderCheckinGrid(); saveState(); toast('All athletes checked in');
}
function checkOutAllCi() {
  E().athletes.forEach(a=>{a.checkedInForComp=false;a.notCompeting=false;});
  renderCheckinGrid(); saveState(); toast('All unchecked');
}

function openAddAthleteCi() {
  const heights=E().setupHeights||setupHeights;
  const sel=document.getElementById('aciStartH');
  sel.innerHTML='<option value="">— First height —</option>'+heights.map(h=>`<option value="${h}">${h}</option>`).join('');
  document.getElementById('aciName').value='';
  document.getElementById('aciSchool').value='';
  document.getElementById('addAthleteCiModal').classList.add('open');
  setTimeout(()=>document.getElementById('aciName').focus(),50);
}
function closeAddAthleteCi(){document.getElementById('addAthleteCiModal').classList.remove('open');}
function doAddAthleteCi() {
  const name=document.getElementById('aciName').value.trim();
  if(!name){toast('Enter athlete name');return;}
  const school=document.getElementById('aciSchool').value.trim().toUpperCase();
  const startH=document.getElementById('aciStartH').value;
  const id=Date.now();
  const num=Math.max(0,...E().athletes.map(a=>a.num||0))+1;
  E().athletes.push({id,num,name,school,startH,checkedInForComp:true,notCompeting:false,checkedOut:false,withdrawn:false,eliminated:false,bestH:null,attempts:{}});
  addRow(name,school); // keep hidden athleteBody table in sync for saveSetupToState
  closeAddAthleteCi(); renderCheckinGrid(); saveState(); toast(`${name} added & checked in ✓`);
}

// ════════════════════════════════════════
//  START COMPETITION
// ════════════════════════════════════════
function startComp() {
  const ev=E();
  const competing=ev.athletes.filter(a=>a.checkedInForComp&&!a.notCompeting);
  if(!competing.length){toast('No athletes checked in!');return;}
  const heights=ev.setupHeights||setupHeights;
  if(!heights.length){toast('No heights set!');return;}

  ev.heights=[...heights]; ev.hIdx=0; ev.ended=false; ev.skippedMisses={};
  ev.phase = 'competition';
  competing.forEach(a=>{a.eliminated=false;a.checkedOut=false;a.bestH=null;a.attempts={};});

  buildRotation();
  buildRaiseChips();
  saveState();
  showComp();
  renderAll();
  const gnd=activeEvent==='girls'?'Girls':'Boys';
  toast(`${gnd} High Jump started — ${competing.length} athletes`);
}

// ════════════════════════════════════════
//  RAISE BAR
// ════════════════════════════════════════
function selRaise(chip) {
  document.querySelectorAll('#raiseChips .raise-chip').forEach(c=>c.classList.remove('sel'));
  chip.classList.add('sel');
  const val=chip.dataset.val, wrap=document.getElementById('customRaiseWrap');
  if(val==='custom'){wrap.style.display='flex';compRaiseVal=parseFloat(document.getElementById('customRaiseVal').value)||0;}
  else{wrap.style.display='none';compRaiseVal=parseInt(val);}
  updateRaisePreview();
}

function updateRaisePreview() {
  const cc=document.querySelector('#raiseChips .raise-chip[data-val="custom"]');
  if(cc&&cc.classList.contains('sel')) compRaiseVal=parseFloat(document.getElementById('customRaiseVal').value)||0;
  const curN=toNorm(curH());
  if(curN<0||!compRaiseVal){
    document.getElementById('raiseNext').textContent='—';
    document.getElementById('raiseBtnH').textContent='—';
    document.getElementById('raiseBtn').disabled=true; return;
  }
  const nextStr=normToDisplay(Math.round(curN+compRaiseVal));
  document.getElementById('raiseNext').textContent=nextStr;
  document.getElementById('raiseBtnH').textContent=nextStr;
  document.getElementById('raiseBtn').disabled=false;
}

function raiseBar() {
  const curN=toNorm(curH()); if(curN<0||!compRaiseVal) return;
  const nextStr=normToDisplay(Math.round(curN+compRaiseVal));
  const ev=E();
  const existIdx=ev.heights.indexOf(nextStr);
  if(existIdx!==-1){ev.hIdx=existIdx;}
  else{ev.hIdx++;ev.heights.splice(ev.hIdx,0,nextStr);}
  buildRotation(); renderAll(); toast(`Bar raised to ${nextStr}`);
  saveState();
}

function prevH(){const ev=E();if(ev.hIdx>0){ev.hIdx--;buildRotation();renderAll();saveState();}}
function confirmLowerBar(){document.getElementById('lowerBarModal').classList.add('open');}
function closeLowerBarModal(){document.getElementById('lowerBarModal').classList.remove('open');}
function doLowerBar(){closeLowerBarModal();prevH();}

// ════════════════════════════════════════
//  ROTATION
// ════════════════════════════════════════
function curH(){return E().heights[E().hIdx]||'—';}
function getA(id){return E().athletes.find(a=>a.id===id)||null;}
function curJumper(){const ev=E();if(ev.cur===-1||ev.rotation[ev.cur]===undefined)return null;return getA(ev.rotation[ev.cur]);}

function eligible(a){
  if(a.eliminated||a.notCompeting||a.withdrawn||!a.checkedInForComp) return false;
  if(!a.startH) return true;
  return toNorm(curH())>=toNorm(a.startH);
}

function buildRotation() {
  const ev=E(), h=curH();
  const el=ev.athletes.filter(a=>{
    if(!eligible(a)||a.checkedOut) return false;
    const atts=a.attempts[h]||[];
    if(atts.includes('O')||atts.includes('P')) return false;
    if(atts.filter(x=>x==='X').length+getCarriedMisses(a.id)>=3) return false;
    return true;
  });
  const ids=el.map(a=>a.id);
  ev.rotation=ids.slice(0,Math.min(5,ids.length));
  ev.waitList=ids.slice(Math.min(5,ids.length));
  ev.cur=0; seekNext(false);
}

function seekNext(advance=true) {
  const ev=E();
  if(!ev.rotation.length){ev.cur=-1;return;}
  if(advance) ev.cur=(ev.cur===-1?0:(ev.cur+1)%ev.rotation.length);
  else if(ev.cur===-1) ev.cur=0;
  let tries=0;
  while(tries<ev.rotation.length){
    const a=getA(ev.rotation[ev.cur]);
    const h=curH();
    const atts=a.attempts[h]||[];
    // Skip if checked out, eliminated, or passed
    if(a && !a.checkedOut && !a.eliminated && !(atts.includes('P'))) return;
    ev.cur=(ev.cur+1)%ev.rotation.length; tries++;
  }
  ev.cur=-1;
}

function rotateToBack() {
  const ev=E();
  if(ev.cur===-1) return;
  if(ev.rotation.length>1){
    const current=ev.rotation[ev.cur];
    ev.rotation.splice(ev.cur,1);
    ev.rotation.push(current);
    ev.cur=0;
  }
  seekNext(false);
}

function refill(id) {
  const ev=E();
  const idx=ev.rotation.indexOf(id);
  if(idx!==-1) ev.rotation.splice(idx,1);
  while(ev.rotation.length<5&&ev.waitList.length>0){
    const nid=ev.waitList.shift(), a=getA(nid);
    if(a&&!a.eliminated){ev.rotation.push(nid);}
  }
  if(ev.cur!==-1&&ev.cur>=ev.rotation.length) ev.cur=0;
  seekNext(false);
}

function isHeightComplete() {
  const ev=E(), h=curH();
  const needsJump=ev.rotation.some(id=>{
    const a=getA(id);
    if(!a||a.eliminated||a.checkedOut) return false;
    const atts=a.attempts[h]||[];
    if(atts.includes('O')||atts.includes('P')) return false;
    if(atts.filter(x=>x==='X').length>=3) return false;
    return true;
  });
  const waitNeedsJump=ev.waitList.some(id=>{const a=getA(id);return a&&!a.eliminated&&!a.checkedOut;});
  return !needsJump&&!waitNeedsJump;
}

function isCompetitionOver() {
  const ev=E(); if(ev.ended) return false;
  const competing=ev.athletes.filter(a=>a.checkedInForComp&&!a.notCompeting);
  return competing.length>0&&competing.every(a=>a.eliminated);
}

// ════════════════════════════════════════
//  RECORDING
// ════════════════════════════════════════
function getCarriedMisses(id){return E().skippedMisses[id]||0;}
function clearCarriedMisses(id){delete E().skippedMisses[id];}

function record(result) {
  const j=curJumper(); if(!j||j.checkedOut) return;
  const h=curH();
  if(!j.attempts[h]) j.attempts[h]=[];
  const atts=j.attempts[h], carried=getCarriedMisses(j.id), attUsed=atts.length+carried;

  if(result==='O'){
    if(attUsed>=3){toast('No attempts remaining');return;}
    atts.push(result); clearCarriedMisses(j.id);
    j.bestH=h; toast(`✓ ${j.name} cleared ${h}!`); refill(j.id);
  } else if(result==='X'){
    if(attUsed>=3){toast('No attempts remaining');return;}
    atts.push(result);
    const totalMisses=atts.filter(x=>x==='X').length+carried;
    if(totalMisses>=3){clearCarriedMisses(j.id);j.eliminated=true;toast(`✗ ${j.name} out`);refill(j.id);}
    else{rotateToBack();}
  } else {
    const existMisses=atts.filter(x=>x==='X').length+carried;
    atts.push('P');
    if(existMisses>0) E().skippedMisses[j.id]=existMisses;
    else clearCarriedMisses(j.id);
    refill(j.id);
  }
  renderAll();
  saveState();
}

function withdrawAthlete(id){
  if(id===undefined||id===null) return;
  const a=getA(id); if(!a) return;
  if(!confirm(`Remove ${a.name} from the competition? This cannot be undone.`)) return;
  a.withdrawn=true;
  const ev=E();
  if(ev.rotation.includes(id)) refill(id);
  else {
    const wIdx=ev.waitList.indexOf(id);
    if(wIdx!==-1) ev.waitList.splice(wIdx,1);
  }
  toast(`${a.name} withdrawn`);
  renderAll();
  saveState();
}
function withdrawCurrentJumper(){
  const j=curJumper(); if(!j) return;
  withdrawAthlete(j.id);
}
function jumpASAP(id){
  const ev=E();
  let idx=ev.rotation.indexOf(id);
  if(idx===ev.cur) return;
  if(idx===-1){
    // athlete is in waitlist — move to rotation first
    const wIdx=ev.waitList.indexOf(id);
    if(wIdx===-1) return;
    ev.waitList.splice(wIdx,1);
    ev.rotation.push(id);
    idx=ev.rotation.length-1;
  }
  ev.rotation.splice(idx,1);
  if(ev.cur>idx) ev.cur--;
  const insertAt=ev.cur===-1?0:ev.cur+1;
  ev.rotation.splice(insertAt,0,id);
  renderAll();
  saveState();
}
function toggleCO(){
  const j=curJumper(); if(!j) return;
  if(j.checkedOut) checkIn(j.id);
  else checkOut(j.id);
}
function insertByBib(arr, id){
  const num=(getA(id)?.num)||Infinity;
  const idx=arr.findIndex(eid=>(getA(eid)?.num||Infinity)>num);
  if(idx===-1) arr.push(id); else arr.splice(idx,0,id);
}
function checkIn(id){
  const a=getA(id);if(!a)return;
  a.checkedOut=false;
  const ev=E();
  if(!ev.rotation.includes(id)&&!ev.waitList.includes(id)){
    if(ev.rotation.length<5) insertByBib(ev.rotation,id);
    else insertByBib(ev.waitList,id);
  }
  if(ev.cur===-1) seekNext(false);
  toast(`${a.name} checked in ✓`);
  renderAll();
  saveState();
}
function checkOut(id){
  const a=getA(id);if(!a)return;a.checkedOut=true;
  const ev=E();
  const idx=ev.rotation.indexOf(id);
  if(idx!==-1){
    ev.rotation.splice(idx,1);
    if(!ev.rotation.length){ev.cur=-1;}
    else{
      if(ev.cur>idx) ev.cur--;
      if(ev.cur>=ev.rotation.length) ev.cur=0;
    }
    // fill the open slot from the waitlist
    while(ev.rotation.length<5&&ev.waitList.length>0){
      const nid=ev.waitList.shift(), na=getA(nid);
      if(na&&!na.eliminated&&!na.checkedOut) ev.rotation.push(nid);
    }
    if(ev.rotation.length) seekNext(false);
  }
  toast(`${a.name} checked out`);
  renderAll();
  saveState();
}

function renderCheckedOutModal(){
  const modal=document.getElementById('checkedOutModal');
  const list=document.getElementById('checkedOutList');
  const co=E().athletes.filter(a=>a.checkedOut&&!a.eliminated);
  list.innerHTML='';
  if(!co.length){
    list.innerHTML='<div style="color:var(--dim);font-size:13px;padding:8px 0">No jumpers currently checked out.</div>';
  } else {
    co.forEach(a=>{
      const row=document.createElement('div');
      row.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)';
      row.innerHTML=`<span style="font-size:13px">${a.num?'#'+a.num+' ':''}${a.name}</span><button class="btn btn-blue" style="font-size:11px;padding:4px 10px" onclick="checkIn(${a.id})">↩ Check In</button>`;
      list.appendChild(row);
    });
  }
  modal.style.display='block';
}
function closeCheckedOutModal(){
  document.getElementById('checkedOutModal').style.display='none';
}

// ════════════════════════════════════════
//  PANELS
// ════════════════════════════════════════
function showSetup(){hide('checkin-panel');show('setup-panel');hide('competition-panel');hide('results-panel');E().phase='setup';setHdrBtns('setup');window.scrollTo(0,0);}
function showCheckin(){hide('setup-panel');show('checkin-panel');hide('competition-panel');hide('results-panel');E().phase='checkin';setHdrBtns('checkin');window.scrollTo(0,0);}
function showComp(){hide('setup-panel');hide('checkin-panel');show('competition-panel');hide('results-panel');E().phase='competition';setHdrBtns('comp');window.scrollTo(0,0);}
function showResults(){hide('setup-panel');hide('checkin-panel');hide('competition-panel');show('results-panel');E().phase='results';setHdrBtns('comp');renderResultsTable();window.scrollTo(0,0);}
function show(id){document.getElementById(id).style.display='block';}
function hide(id){document.getElementById(id).style.display='none';}

function setHdrBtns(screen) {
  const ci=document.getElementById('hdrCheckin'), ss=document.getElementById('hdrScoresheet'), ec=document.getElementById('hdrEndComp');
  const ev=E();
  const phase=ev.phase;
  if(phase==='setup' || phase==='checkin'){ci.style.display='none';ss.style.display='none';ec.style.display='none';}
  else if(phase==='competition'){
    ci.style.display='none';
    ss.style.display='inline-block';
    ec.style.display=ev.ended?'none':'inline-block';
  }
  else if(phase==='results'){
    ci.style.display='none';
    ss.style.display='inline-block';
    ec.style.display='none';
  }
}

function confirmEndComp(){
  const gnd=activeEvent==='girls'?'Girls':'Boys';
  document.getElementById('endCompTitle').textContent=`End ${gnd} High Jump?`;
  document.getElementById('endCompBody').textContent=`This finalizes ${gnd.toLowerCase()} results. You can still export after ending.`;
  document.getElementById('endCompBtn').textContent=`⏹ End ${gnd} High Jump`;
  document.getElementById('compOverBtn').textContent=`⏹ End ${gnd} High Jump &amp; Finalize Results`;
  document.getElementById('endCompModal').classList.add('open');
}
function closeEndModal(){document.getElementById('endCompModal').classList.remove('open');}
function doEndComp(){E().ended=true;E().phase='results';closeEndModal();saveState();showResults();const gnd=activeEvent==='girls'?'Girls':'Boys';toast(`${gnd} High Jump ended — results finalized`);}

// ════════════════════════════════════════
//  RENDER
// ════════════════════════════════════════
function renderStatus(){
  const ev=E();
  const active=ev.athletes.filter(a=>a.checkedInForComp&&!a.notCompeting&&!a.eliminated).length;
  const co=ev.athletes.filter(a=>a.checkedOut&&!a.eliminated).length;
  const h=curH()||'—';
  const remaining=ev.rotation.length+ev.waitList.length-(ev.cur!==-1?1:0);
  const stA=document.getElementById('stA'); if(stA) stA.textContent=`${active} active`;
  const stCO=document.getElementById('stCO'); if(stCO) stCO.textContent=`${co} checked out`;
  const stH=document.getElementById('stH'); if(stH) stH.textContent=h;
  const stR=document.getElementById('stR'); if(stR) stR.textContent=Math.max(0,remaining);
  const coBtn=document.getElementById('coBtn');
  if(coBtn) coBtn.textContent=co>0?`⇄ Checked Out Jumpers (${co})`:'⇄ Checked Out Jumpers';
}
function renderAll(){
  renderBar();renderJumper();renderQueue();renderBoard();renderStatus();renderCompOver();
  const m=document.getElementById('checkedOutModal');
  if(m&&m.style.display!=='none') renderCheckedOutModal();
}

function renderCompOver(){
  const over=isCompetitionOver();
  document.getElementById('compOverBanner').style.display=over?'block':'none';
  const ec=document.getElementById('hdrEndComp');
  over?ec.classList.add('btn-pulse'):ec.classList.remove('btn-pulse');
  if(over){
    const gnd=activeEvent==='girls'?'Girls':'Boys';
    document.getElementById('compOverBtn').textContent=`⏹ End ${gnd} High Jump & Finalize Results`;
  }
}

function renderBar(){
  const h=curH(); document.getElementById('barDisplay').textContent=h;
  const norm=toNorm(h); let conv='';
  if(norm>0){
    if(unitSystem==='metric'){const ti=Math.round(norm/2.54);conv=`${Math.floor(ti/12)}′${ti%12}″`;}
    else{conv=(norm*2.54/100).toFixed(2)+' m';}
  }
  document.getElementById('barSub').textContent=`Height ${E().hIdx+1} of ${E().heights.length}`+(conv?`  ·  ${conv}`:'');
  updateRaisePreview();
  const banner=document.getElementById('heightCompleteBanner');
  banner.style.display=isHeightComplete()?'block':'none';
  const hasAttempts=E().athletes.some(a=>(a.attempts[curH()]||[]).length>0);
  const lowerBtn=document.getElementById('lowerBarBtn');
  if(lowerBtn) lowerBtn.style.display=hasAttempts?'none':'block';
}

function renderJumper(){
  const j=curJumper(), card=document.getElementById('jumperCard');
  const bm=document.getElementById('bMake'), bx=document.getElementById('bMiss'), bp=document.getElementById('bPass'), bco=document.getElementById('bCO');
  const bwd=document.querySelector('.btn-danger[onclick="withdrawCurrentJumper()"]');
  if(!j){
    card.className='jumper-card none-card';
    document.getElementById('jName').textContent='No active jumper';
    document.getElementById('jMeta').textContent='All checked out or eliminated.';
    document.getElementById('jDots').innerHTML='';
    bm.disabled=bx.disabled=bp.disabled=true; bco.disabled=true;
    if(bwd) bwd.disabled=true;
    bco.textContent='⇄ Check Out'; bco.className='btn btn-warn'; return;
  }
  if(bwd) bwd.disabled=false;
  const h=curH(), atts=j.attempts[h]||[], isCO=j.checkedOut, carried=getCarriedMisses(j.id), attUsed=atts.length+carried;
  card.className=`jumper-card${isCO?' co-card':''}`;
  const numPfx=j.num?`<span style="color:var(--dim);font-size:13px;font-weight:400;">#${j.num}</span> `:'';
  document.getElementById('jName').innerHTML=numPfx+j.name+(isCO?'<span class="co-pill">OUT</span>':'');
  document.getElementById('jMeta').innerHTML=
    `<strong style="color:var(--accent2)">${j.school}</strong> &nbsp;·&nbsp; Best: ${j.bestH||'NH'}`+
    (j.startH?` &nbsp;·&nbsp; Entered: ${j.startH}`:'')+
    `<br>Attempt ${Math.min(attUsed+1,3)} of 3 at ${h}`+
    (carried>0?` &nbsp;<span style="color:var(--warn);font-size:11px">(${carried} miss${carried>1?'es':''} carried)</span>`:'');
  const dotsEl=document.getElementById('jDots'); dotsEl.innerHTML='';
  for(let i=0;i<carried;i++){
    const d=document.createElement('div'); d.className='dot ms';
    d.textContent='✗'; dotsEl.appendChild(d);
  }
  for(let i=0;i<3-carried;i++){
    const d=document.createElement('div'); d.className='dot'; const a=atts[i];
    if(a==='O'){d.classList.add('mk');d.textContent='✓';}
    else if(a==='X'){d.classList.add('ms');d.textContent='✗';}
    else if(a==='P'){d.classList.add('ps');d.textContent='P';}
    dotsEl.appendChild(d);
  }
  const dis=isCO||attUsed>=3;
  bm.disabled=bx.disabled=bp.disabled=dis; bco.disabled=false;
  bco.textContent=isCO?'✓ Check Back In':'⇄ Check Out'; bco.className=isCO?'btn btn-blue':'btn btn-warn';
}

function renderQueue(){
  const el=document.getElementById('queueEl'); el.innerHTML='';
  const h=curH(), ev=E();
  const hasCur=ev.cur!==-1;
  // When someone is actively jumping, they own the UP slot and the rest shift down
  const qLabels=hasCur?['DECK','HOLE','HOLD','5TH']:['UP','DECK','HOLE','HOLD','5TH'];

  // Render current jumper at the UP slot first
  if(hasCur){
    const curId=ev.rotation[ev.cur], curA=getA(curId);
    if(curA){
      const curAtts=curA.attempts[h]||[], curXc=curAtts.filter(x=>x==='X').length;
      const curInfo=curXc>0?'X'.repeat(curXc):'';
      const div=document.createElement('div'); div.className='qi q-cur';
      div.innerHTML=`<span class="qbadge b-up">UP</span><span class="qname">${curA.num?'#'+curA.num+' ':''}${curA.name}</span><span style="font-size:9px;font-weight:700;color:var(--accent2);flex-shrink:0;letter-spacing:.3px">▶ NOW</span><span class="qinfo">${curInfo}</span><button class="qbtn" onclick="checkOut(${curId})">⇄ Out</button><button class="qbtn" style="margin-left:6px;color:var(--danger)" onclick="withdrawAthlete(${curId})" title="Withdraw">✕</button>`;
      el.appendChild(div);
    }
  }

  let vis=0;
  ev.rotation.forEach((id,ri)=>{
    const a=getA(id); if(!a) return;
    const atts=a.attempts[h]||[], xc=atts.filter(x=>x==='X').length, cleared=atts.includes('O'), isCur=ri===ev.cur;
    if(isCur) return;
    const div=document.createElement('div');
    // When hasCur: non-current slots start at DECK (vis 0=DECK, 1=HOLE, 2=HOLD)
    // When !hasCur: all slots use full labels (vis 0=UP, 1=DECK, 2=HOLE, 3=HOLD)
    let cls='qi q-wait', bc='b-wait', label=qLabels[vis]||`${vis+(hasCur?2:1)}`;
    const deckSlot=hasCur?0:1, holeSlot=hasCur?1:2, holdSlot=hasCur?2:3;
    if(!hasCur&&vis===0){cls='qi q-cur';bc='b-up';}
    else if(vis===deckSlot){cls='qi q-deck';bc='b-deck';}
    else if(vis===holeSlot){cls='qi q-hole';bc='b-hole';}
    else if(vis===holdSlot){cls='qi q-hold';bc='b-hold';}
    vis++;
    const info=cleared?'✓':(xc>0?'X'.repeat(xc):'')+(atts.includes('P')&&!cleared?'P':'');
    div.className=cls;
    div.innerHTML=`<span class="qbadge ${bc}">${label}</span><span class="qname">${a.num?'#'+a.num+' ':''}${a.name}</span><span class="qinfo">${info}</span><button class="qbtn" onclick="checkOut(${id})">⇄ Out</button><button class="qbtn" style="margin-left:8px" onclick="jumpASAP(${id})">Jump ASAP</button><button class="qbtn" style="margin-left:8px;color:var(--danger)" onclick="withdrawAthlete(${id})" title="Withdraw from competition">✕</button>`;
    el.appendChild(div);
  });
  if(ev.waitList.length){
    const s=document.createElement('div');s.className='qsec';s.textContent=`Waiting (${ev.waitList.length})`;el.appendChild(s);
    let expandedWait = window.expandedWait || false;
    const maxShow = 4;
    const waitToShow = expandedWait ? ev.waitList : ev.waitList.slice(0,maxShow);
    waitToShow.forEach(id=>{
      const a=getA(id);if(!a)return;
      const d=document.createElement('div');d.className='qi q-wait';
      d.innerHTML=`<span class="qbadge b-wait">NEXT</span><span class="qname">${a.num?'#'+a.num+' ':''}${a.name}</span><button class="qbtn" style="margin-left:8px" onclick="jumpASAP(${id})">Jump ASAP</button><button class="qbtn" style="margin-left:8px;color:var(--danger)" onclick="withdrawAthlete(${id})" title="Withdraw">✕</button>`;
      el.appendChild(d);
    });
    if(!expandedWait && ev.waitList.length>maxShow){
      const m=document.createElement('div');m.style.cssText='font-size:11px;color:var(--dim);padding:3px 8px;cursor:pointer;text-decoration:underline;';
      m.textContent=`+${ev.waitList.length-maxShow} more`;
      m.onclick = function(){ window.expandedWait = true; renderAll(); };
      el.appendChild(m);
    } else if(expandedWait && ev.waitList.length>maxShow){
      const m=document.createElement('div');m.style.cssText='font-size:11px;color:var(--dim);padding:3px 8px;cursor:pointer;text-decoration:underline;';
      m.textContent=`Show less`;
      m.onclick = function(){ window.expandedWait = false; renderAll(); };
      el.appendChild(m);
    }
  }
  const notYet=ev.athletes.filter(a=>!a.eliminated&&!a.notCompeting&&a.checkedInForComp&&a.startH&&toNorm(h)<toNorm(a.startH)&&!ev.rotation.includes(a.id)&&!ev.waitList.includes(a.id));
  if(notYet.length){
    const s=document.createElement('div');s.className='qsec';s.textContent='Entering at higher height';el.appendChild(s);
    notYet.forEach(a=>{
      const d=document.createElement('div');d.className='qi q-ny';
      d.innerHTML=`<span class="qbadge b-ny">WAIT</span><span class="qname">${a.num?'#'+a.num+' ':''}${a.name}</span><span class="qinfo">enters ${a.startH}</span>`+
        `<button class="qbtn" style="margin-left:8px" onclick="addToWaitList(${a.id})">+ Add to Waitlist</button>`+
        `<button class="qbtn" style="margin-left:8px;color:var(--danger)" onclick="withdrawAthlete(${a.id})" title="Withdraw">✕</button>`;
      el.appendChild(d);
    });
  }
// Move jumper from waitlist to rotation
function moveToRotation(id) {
  const ev = E();
  const idx = ev.waitList.indexOf(id);
  if (idx !== -1) {
    ev.waitList.splice(idx, 1);
    ev.rotation.push(id);
    renderAll();
    saveState();
    toast('Jumper moved to rotation');
  }
}
window.moveToRotation = moveToRotation;

// Add jumper to current height's waitlist
function addToWaitList(id) {
  const ev = E();
  const a = getA(id); if(!a) return;
  if(ev.rotation.includes(id)||ev.waitList.includes(id)) return;
  a.startH = curH();
  if(ev.cur===-1 && ev.rotation.length<5){
    // No active jumper — drop straight into rotation and make them current
    ev.rotation.push(id);
    seekNext(false);
  } else {
    ev.waitList.push(id);
  }
  renderAll();
  saveState();
  toast(`${a.name} added — start height updated to ${curH()}`);
}
window.addToWaitList = addToWaitList;
  const elim=ev.athletes.filter(a=>a.eliminated);
  if(elim.length){
    const expandedElim=window.expandedElim||false;
    const s=document.createElement('div');s.className='qsec';s.style.cssText='cursor:pointer;display:flex;justify-content:space-between;align-items:center;';
    s.innerHTML=`<span>Eliminated (${elim.length})</span><span style="font-size:10px;color:var(--dim)">${expandedElim?'▲ hide':'▼ show'}</span>`;
    s.onclick=function(){window.expandedElim=!window.expandedElim;renderAll();};
    el.appendChild(s);
    if(expandedElim){
      elim.forEach(a=>{const d=document.createElement('div');d.className='qi q-out';d.innerHTML=`<span class="qbadge b-out">OUT</span><span class="qname">${a.num?'#'+a.num+' ':''}${a.name}</span><span class="qinfo">${a.bestH||'NH'}</span>`;el.appendChild(d);});
    }
  }
}

function renderBoard(){
  const ev=E(), hs=ev.heights.slice(0,ev.hIdx+1);
  document.getElementById('sHead').innerHTML=`<tr><th>#</th><th>Num</th><th>Athlete</th><th>School</th><th>Start Ht</th><th>Best</th>${hs.map(h=>`<th>${h}</th>`).join('')}</tr>`;
  const body=document.getElementById('sBody'); body.innerHTML='';
  ranked().forEach((a,i)=>{
    const tr=document.createElement('tr');
    const isCur=ev.rotation[ev.cur]===a.id;
    tr.className=isCur?'s-cur':a.checkedOut?'s-co':'';
    const pCls=i===0?'p1':i===1?'p2':i===2?'p3':'';
    const atH=hs.map(h=>{
      const at=a.attempts[h]||[];
      if(a.startH&&toNorm(a.startH)>toNorm(h)) return `<td><div class="achips"><span class="ac ac-s">P</span></div></td>`;
      if(!at.length) return `<td><div class="achips"><span class="ac" style="opacity:.2">—</span></div></td>`;
      return `<td><div class="achips">${at.map(x=>`<span class="ac ac-${x==='O'?'o':x==='X'?'x':'p'}">${x}</span>`).join('')}</div></td>`;
    }).join('');
    tr.innerHTML=`<td><span class="pnum ${pCls}">${a.eliminated?i+1:'—'}</span></td><td>${a.num||''}</td><td><strong>${a.name}</strong>${a.checkedOut?'<span class="co-pill" style="font-size:8px">OUT</span>':''}${a.withdrawn?'<span style="font-size:10px;color:var(--danger);margin-left:5px">WD</span>':''}</td><td style="font-size:11px;color:var(--dim);font-family:'DM Mono',monospace">${a.school}</td><td class="bh" style="color:var(--dim)">${a.startH||'—'}</td><td class="bh">${a.bestH||'NH'}</td>${atH}`;
    body.appendChild(tr);
  });
}

// ════════════════════════════════════════
//  RANKINGS & RESULTS
// ════════════════════════════════════════
function ranked(){
  const active=[...E().athletes.filter(a=>a.checkedInForComp&&!a.notCompeting&&!a.withdrawn)].sort((a,b)=>{
    const d=toNorm(b.bestH)-toNorm(a.bestH); if(d) return d;
    return tmiss(a)-tmiss(b);
  });
  const wd=E().athletes.filter(a=>a.checkedInForComp&&a.withdrawn);
  return [...active,...wd];
}
function tmiss(a){return Object.values(a.attempts).flat().filter(x=>x==='X').length;}
function getStartHt(a){
  if(a.startH) return a.startH;
  const ev=E();
  for(const h of ev.heights){
    if(a.attempts[h]&&a.attempts[h].length>0) return h;
  }
  return '—';
}
function renderResultsTable(){
  const ev=E(), mn=document.getElementById('meetName').value, md=document.getElementById('meetDate').value;
  const gender=activeEvent==='girls'?'Girls':'Boys';
  document.getElementById('rMeta').textContent=`${mn||'Meet'} · ${md||'Date TBD'} · ${gender} High Jump · Five Alive`;
  document.getElementById('resPanelTitle').textContent=ev.ended?`${gender} — Final Results`:`${gender} — Live Scoresheet`;
  document.getElementById('backToCompBtn').style.display=ev.ended?'none':'inline-block';
  document.getElementById('compEndedBanner').style.display=ev.ended?'block':'none';
  document.getElementById('compEndedText').textContent=`${gender} High Jump Ended`;
  const hs=ev.heights.slice(0,ev.hIdx+1), r=ranked();
  document.getElementById('rHead').innerHTML=`<th>Place</th><th>#</th><th>Athlete</th><th>School</th><th>Start Ht</th><th>Best</th>${hs.map(h=>`<th>${h}</th>`).join('')}<th>Misses</th>`;
  const body=document.getElementById('rBody'); body.innerHTML='';
  r.forEach((a,i)=>{
    const isWd=a.withdrawn;
    const place=isWd?'WD':i+1;
    const hCols=hs.map(h=>{const at=a.attempts[h]||[];const sht=getStartHt(a);if(sht!=='—'&&toNorm(sht)>toNorm(h))return`<td style="color:var(--dim)">—</td>`;return`<td>${at.join('')||'—'}</td>`;}).join('');
    const tr=document.createElement('tr');
    if(isWd) tr.style.opacity='0.45';
    tr.innerHTML=`<td>${place}</td><td style="color:var(--dim)">${a.num||''}</td><td class="nc">${a.name}${isWd?'<span style="font-size:10px;color:var(--danger);margin-left:5px">WD</span>':''}</td><td>${a.school}</td><td>${getStartHt(a)}</td><td><strong>${isWd?'WD':a.bestH||'NH'}</strong></td>${hCols}<td>${tmiss(a)}</td>`;
    body.appendChild(tr);
  });
}

// ════════════════════════════════════════
//  EXPORT
// ════════════════════════════════════════
function exportCSV(){
  const ev=E(), hs=ev.heights.slice(0,ev.hIdx+1), r=ranked();
  const mn=document.getElementById('meetName').value||'Meet', md=document.getElementById('meetDate').value||'';
  const gender=activeEvent==='girls'?'Girls':'Boys';
  let csv=`Five Alive High Jump Results\n"${mn}","${md}","${gender} High Jump"\n\nPlace,Bib#,Name,School,Starting Height,Best Height,${hs.join(',')},Total Misses\n`;
  r.forEach((a,i)=>{
    const sht=getStartHt(a);
    const hc=hs.map(h=>{const at=a.attempts[h]||[];if(sht!=='—'&&toNorm(sht)>toNorm(h))return'P';return at.join('')||'—';}).join(',');
    csv+=`${i+1},${a.num||''},"${a.name}","${a.school}","${sht==='—'?'':sht}","${a.bestH||'NH'}",${hc},${tmiss(a)}\n`;
  });
  const blob=new Blob([csv],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const lnk=document.createElement('a');lnk.href=url;lnk.download=`highjump-${gender}-${mn.replace(/\s/g,'_')}.csv`;lnk.click();URL.revokeObjectURL(url);
  toast('CSV exported!');
}

function exportPDF(){
  if (!window.jspdf) { toast('PDF export unavailable (no internet connection)'); return; }
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'letter'});
  const PAGE_W=279,MARGIN=12,USABLE=PAGE_W-MARGIN*2;
  const mn=document.getElementById('meetName').value||'High Jump Results';
  const md=document.getElementById('meetDate').value||'';
  const gender=activeEvent==='girls'?'Girls':'Boys';
  const ev=E(), hs=ev.heights.slice(0,ev.hIdx+1), r=ranked();
  doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text(`${gender.toUpperCase()} HIGH JUMP RESULTS`,MARGIN,16);
  doc.set
  const hColW=hs.length>0?Math.max(9,Math.floor((USABLE-fixedW)/hs.length)):12;
  const allCols=[...fixedCols,...hs.map(h=>({l:h,w:hColW})),...trailCols];
  const cw=allCols.map(c=>c.w);
  const rows=r.map((a,i)=>{const sht=getStartHt(a);return[String(i+1),a.name,a.school,sht,a.bestH||'NH',...hs.map(h=>{const at=a.attempts[h]||[];if(sht!=='—'&&toNorm(sht)>toNorm(h))return'P';return at.join('')||'—';}),String(tmiss(a))]});
  const rh=7;let y=34,x=MARGIN;
  doc.setFillColor(30,37,51);doc.setTextColor(200,200,200);doc.setFont('helvetica','bold');doc.setFontSize(7);
  doc.rect(MARGIN,y,cw.reduce((a,b)=>a+b,0),rh,'F');
  x=MARGIN;allCols.forEach((c,i)=>{doc.text(String(c.l),x+1.2,y+4.8);x+=cw[i];});
  doc.setTextColor(20,20,20);doc.setFont('helvetica','normal');
  rows.forEach((row,ri)=>{
    y+=rh;
    if(y>196){doc.addPage('letter','landscape');y=14;doc.setFillColor(30,37,51);doc.setTextColor(200,200,200);doc.setFont('helvetica','bold');x=MARGIN;doc.rect(MARGIN,y,cw.reduce((a,b)=>a+b,0),rh,'F');allCols.forEach((c,i)=>{doc.text(String(c.l),x+1.2,y+4.8);x+=cw[i];});doc.setTextColor(20,20,20);doc.setFont('helvetica','normal');y+=rh;}
    if(ri%2===0){doc.setFillColor(245,247,250);doc.rect(MARGIN,y,cw.reduce((a,b)=>a+b,0),rh,'F');}
    x=MARGIN;row.forEach((cell,ci)=>{let t=String(cell);while(t.length>1&&doc.getTextWidth(t)>cw[ci]-2)t=t.slice(0,-1);doc.text(t,x+1.2,y+4.8);x+=cw[ci];});
  });
  doc.setTextColor(150,150,150);doc.setFontSize(6.5);doc.text('Five Alive High Jump — Official Results',MARGIN,y+rh+5);
  doc.save(`highjump-${gender}-${mn.replace(/\s/g,'_')}.pdf`);
  toast('PDF exported!');
}

// ════════════════════════════════════════
//  TIMER
// ════════════════════════════════════════
let timerInterval=null, timerSeconds=0, timerState='idle';
function timerBubbleClick(){if(timerState==='running'){stopTimer();return;}if(timerState==='expired'){resetTimer();return;}document.getElementById('timerPresets').classList.toggle('open');}
function closeTimerPresets(){document.getElementById('timerPresets').classList.remove('open');}
function startTimer(s){closeTimerPresets();stopTimer();timerSeconds=s;timerState='running';updateTimerUI();timerInterval=setInterval(()=>{timerSeconds--;if(timerSeconds<=0){timerSeconds=0;timerState='expired';clearInterval(timerInterval);timerInterval=null;try{const ctx=new(window.AudioContext||window.webkitAudioContext)();[0,.3,.6].forEach(off=>{const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=880;g.gain.setValueAtTime(.4,ctx.currentTime+off);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+off+.25);o.start(ctx.currentTime+off);o.stop(ctx.currentTime+off+.25);});}catch(e){};}updateTimerUI();},1000);}
function stopTimer(){if(timerInterval){clearInterval(timerInterval);timerInterval=null;}timerState='idle';timerSeconds=0;updateTimerUI();}
function resetTimer(){stopTimer();}
function fmtTimer(s){return`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
function updateTimerUI(){
  const b=document.getElementById('timerBubble'), d=document.getElementById('timerDisplay'), sb=document.getElementById('timerStopBtn');
  b.className='timer-bubble'; d.className='timer-display'; d.style.color=''; b.style.borderColor='';
  if(timerState==='idle'){d.textContent='TIMER';sb.style.display='none';}
  else if(timerState==='running'){d.textContent=fmtTimer(timerSeconds);d.classList.add('running');b.classList.add('running');sb.style.display='inline-block';sb.textContent='■';if(timerSeconds<=30){d.style.color='var(--danger)';b.style.borderColor='var(--danger)';}}
  else{d.textContent='0:00';d.classList.add('flashing');b.classList.add('flashing');sb.style.display='inline-block';sb.textContent='✕';}
}

// ════════════════════════════════════════
//  HELP
// ════════════════════════════════════════
function showHelp(){document.getElementById('helpModal').classList.add('open');}
function closeHelp(){document.getElementById('helpModal').classList.remove('open');}
function switchTab(id){
  document.querySelectorAll('.hpane').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.htab').forEach(t=>t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.htab').forEach(t=>{if(t.getAttribute('onclick')===`switchTab('${id}')`)t.classList.add('active');});
}

function toast(msg){const t=document.getElementById('toastEl');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600);}

// ════════════════════════════════════════
//  SETUP LAYOUT & STATE MANAGEMENT
// ════════════════════════════════════════

function toggleAthleteTable(){
  const sec=document.getElementById('athleteTableSection');
  const btn=document.getElementById('athleteToggleBtn');
  const isHidden=sec.style.display==='none';
  sec.style.display=isHidden?'block':'none';
  btn.textContent=(isHidden?'▼':'▶')+' Manage Athletes';
}

function clearAllAthletes(){
  if(!confirm(`Clear all athletes from ${activeEvent} event?`)) return;
  E().athletes=[];
  syncAthleteTableFromState();
  saveState();
  toast(`✓ All ${activeEvent} athletes cleared`);
}

function openAddAthleteModal(){
  // For now, open the bulk add modal
  openBulk();
}

function updatePerGenderHeights(){
  const ev=E();
  
  // Store current heights before switching
  if(!ev.setupHeights){ev.setupHeights={};}
  ev.setupHeights.startM=document.getElementById('startM').value;
  ev.setupHeights.unit=unitSystem;
  ev.setupHeights.inc=selectedInc;
  ev.setupHeights.num=document.getElementById('numHeights').value;
  
  saveState();
}

function restorePerGenderHeights(){
  const ev=E();
  
  // Check if heights were previously saved for this gender
  if(ev.setupHeights && ev.setupHeights.startM){
    document.getElementById('startM').value=ev.setupHeights.startM;
    unitSystem=ev.setupHeights.unit||'metric';
    selectedInc=ev.setupHeights.inc||3;
    document.getElementById('numHeights').value=ev.setupHeights.num||8;
    setUnit(unitSystem);
  }
}

function safeShowSetup(){
  if(E().phase && E().phase !== 'setup'){
    if(!confirm(`⚠ Returning to Setup will discard all jump records. Continue?`)){
      return;
    }
  }
  showSetup();
}

function openCreateEventModal(){
  document.getElementById('createEventModal').classList.add('open');
}

function closeCreateEventModal(){
  document.getElementById('createEventModal').classList.remove('open');
}

function doCreateEvents(){
  const createGirls=document.getElementById('createGirls').checked;
  const createBoys=document.getElementById('createBoys').checked;
  if(!createGirls && !createBoys){ toast('⚠ Select at least one event'); return; }

  const meetName=document.getElementById('createMeetName').value.trim();
  const meetDate=document.getElementById('createMeetDate').value;
  if(meetName) document.getElementById('meetName').value=meetName;
  if(meetDate) document.getElementById('meetDate').value=meetDate;

  document.getElementById('eventTabs').style.display='flex';
  document.getElementById('tabGirls').style.display=createGirls?'flex':'none';
  document.getElementById('tabBoys').style.display=createBoys?'flex':'none';

  if(createGirls) switchEvent('girls');
  else switchEvent('boys');

  const res=document.getElementById('importResult');
  res.style.display='block';
  res.className='import-result import-result-loaded';
  const evLabel=[createGirls?'Girls':'',createBoys?'Boys':''].filter(Boolean).join(' & ');
  res.innerHTML=`✓ <strong>${meetName||'Event'}</strong> successfully created — ${evLabel} High Jump`;

  closeCreateEventModal();
  saveState();
}

// ════════════════════════════════════════
//  DATA PERSISTENCE
// ════════════════════════════════════════
const STORAGE_KEY='fiveAlive_state';
const STORAGE_EXPIRY_DAYS=30;

function saveState(){
  const state={
    timestamp:Date.now(),
    meetName:document.getElementById('meetName').value,
    meetDate:document.getElementById('meetDate').value,
    unitSystem:unitSystem,
    setupHeights:setupHeights,
    selectedInc:selectedInc,
    compRaiseVal:compRaiseVal,
    events:{}
  };
  for(const ev in EVENTS){
    state.events[ev]={
      athletes:EVENTS[ev].athletes,
      heights:EVENTS[ev].heights,
      hIdx:EVENTS[ev].hIdx,
      rotation:EVENTS[ev].rotation,
      waitList:EVENTS[ev].waitList,
      cur:EVENTS[ev].cur,
      ended:EVENTS[ev].ended,
      skippedMisses:EVENTS[ev].skippedMisses,
      setupHeights:EVENTS[ev].setupHeights,
      phase:EVENTS[ev].phase
    };
  }
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  pushLiveState();
}

function loadState(){
  const stored=localStorage.getItem(STORAGE_KEY);
  if(!stored) return false;
  try{
    const state=JSON.parse(stored);
    const age=(Date.now()-state.timestamp)/(1000*60*60*24);
    if(age>STORAGE_EXPIRY_DAYS){localStorage.removeItem(STORAGE_KEY);return false;}
    
    document.getElementById('meetName').value=state.meetName||'';
    document.getElementById('meetDate').value=state.meetDate||'';
    unitSystem=state.unitSystem||'metric';
    setupHeights=state.setupHeights||[];
    selectedInc=state.selectedInc||3;
    compRaiseVal=state.compRaiseVal||3;
    
    setUnit(unitSystem);
    
    for(const ev in state.events){
      EVENTS[ev]={...EVENTS[ev],...state.events[ev]};
    }
    return true;
  }catch(e){console.error('Failed to load state:',e);return false;}
}

function clearStoredData(){
  if(!confirm('Clear all data and reset the app? This will delete all athletes, jump records, meet info, and saved settings.')){
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function loadTestData(){
  const data=PDF_DATA_TEST;
  document.getElementById('meetName').value=data.meet;
  document.getElementById('meetDate').value=data.date;
  EVENTS.girls.athletes=data.girls.map((a,i)=>({id:i,num:a.num,name:a.name,school:a.school,startH:'',checkedInForComp:false,notCompeting:false,checkedOut:false,withdrawn:false,eliminated:false,bestH:null,attempts:{}}));
  EVENTS.boys.athletes=data.boys.map((a,i)=>({id:i,num:a.num,name:a.name,school:a.school,startH:'',checkedInForComp:false,notCompeting:false,checkedOut:false,withdrawn:false,eliminated:false,bestH:null,attempts:{}}));
  EVENTS.girls.phase='setup'; EVENTS.boys.phase='setup';
  updateEventBadges();
  syncAthleteTableFromState();
  document.getElementById('eventTabs').style.display='flex';
  document.getElementById('tabGirls').style.display='flex';
  document.getElementById('tabBoys').style.display='flex';
  switchEvent('girls');
  const res=document.getElementById('importResult');
  res.style.display='block';
  updateImportResultMessage();
  saveState();
  toast('Demo data loaded ✓');
}

function updateImportResultMessage(){
  const meetName=document.getElementById('meetName').value;
  const girlsCount=EVENTS.girls.athletes.length;
  const boysCount=EVENTS.boys.athletes.length;
  const hasData=girlsCount>0||boysCount>0;
  const resEl=document.getElementById('importResult');
  
  if(!hasData){
    resEl.className='import-result import-result-empty';
    resEl.innerHTML='⚠ No meet data loaded. Import a Meet PDF or click <strong>Create Event</strong> below to begin.';
  }else{
    resEl.className='import-result import-result-loaded';
    let msg=`✓ <strong>${meetName||'Meet'}</strong> pre-loaded`;
    if(girlsCount>0) msg+=` — <strong style="color:var(--success)">${girlsCount} Girls</strong>`;
    if(boysCount>0){
      if(girlsCount>0) msg+=` and <strong style="color:var(--accent2)">${boysCount} Boys</strong>`;
      else msg+=` — <strong style="color:var(--accent2)">${boysCount} Boys</strong>`;
    }
    msg+=` ready for check-in`;
    resEl.innerHTML=msg;
  }
}

// ── INIT ──
buildIncChips(); buildRaiseChips();

console.log('Initializing app - checking for saved state');
const stateLoaded = loadState();
console.log('State loaded:', stateLoaded);

if(!stateLoaded){
  // No saved state, use PDF data
  console.log('No saved state found, using PDF data');
  document.getElementById('meetName').value=PDF_DATA.meet;
  document.getElementById('meetDate').value=PDF_DATA.date;
  EVENTS.girls.athletes=PDF_DATA.girls.map((a,i)=>({id:i,num:a.num,name:a.name,school:a.school,startH:'',checkedInForComp:false,notCompeting:false,checkedOut:false,eliminated:false,bestH:null,attempts:{}}));
  EVENTS.boys.athletes=PDF_DATA.boys.map((a,i)=>({id:i,num:a.num,name:a.name,school:a.school,startH:'',checkedInForComp:false,notCompeting:false,checkedOut:false,eliminated:false,bestH:null,attempts:{}}));
}

// Initialize per-gender heights for each event
if(!EVENTS.girls.setupHeights){EVENTS.girls.setupHeights={};}
if(!EVENTS.boys.setupHeights){EVENTS.boys.setupHeights={};}

updateEventBadges();
syncAthleteTableFromState();
document.getElementById('eventTabs').style.display='flex';
document.getElementById('importResult').style.display='block';
updateImportResultMessage();
restorePerGenderHeights();
showSetup();
