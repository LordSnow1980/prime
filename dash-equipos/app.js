let rawRows = [];

function norm(s){ return (s===undefined||s===null) ? '' : String(s).trim(); }

function getField(row, ...names){
  const keys = Object.keys(row);
  for(const name of names){
    const target = name.trim().toLowerCase();
    const key = keys.find(k => k.trim().toLowerCase() === target);
    if(key !== undefined) return row[key];
  }
  return '';
}

function classify(row){
  const region = norm(row['Region']).toUpperCase();
  const chasis = norm(row['Tipo de chasis']).toLowerCase();
  const pdv = norm(row['Nombre_PDV']).toUpperCase();
  const isCambaceo = pdv.includes('CAMBACEO');
  let tipo = 'desktop';
  if(chasis === 'laptop') tipo = isCambaceo ? 'cambaceo' : 'laptop';

  const osRaw = norm(getField(row, 'Sistema_Operativo F', 'Sistema Operativo'));
  let os = 'sin_dato';
  const osLower = osRaw.toLowerCase();
  if(osLower.includes('no es compatible') || osLower.includes('no compatible')) os = 'nocomp';
  else if(osLower.includes('windows 11')) os = 'win11';
  else if(osLower.includes('windows 10')) os = 'win10';

  return { region, tipo, os, pdv: row['Nombre_PDV'], equipo: row['Nombre'], serie: row['Número de serie'] };
}

function renderMigracion(parsed){
  const byRegion = {};
  let win10=0, win11=0, nocomp=0, sinDato=0;
  parsed.forEach(r=>{
    if(!byRegion[r.region]) byRegion[r.region] = {win10:0, win11:0, nocomp:0, sinDato:0};
    byRegion[r.region][r.os === 'sin_dato' ? 'sinDato' : r.os]++;
    if(r.os === 'win10') win10++;
    else if(r.os === 'win11') win11++;
    else if(r.os === 'nocomp') nocomp++;
    else sinDato++;
  });

  const total = win10 + win11 + nocomp + sinDato;
  const pctMigrado = total ? (win11 / total * 100) : 0;
  const pctWin10 = total ? (win10 / total * 100) : 0;

  document.getElementById('migTotal').textContent = total.toLocaleString('es-MX');
  document.getElementById('migWin11').textContent = win11.toLocaleString('es-MX');
  document.getElementById('migWin11Pct').textContent = pctMigrado.toFixed(1) + '% del total';
  document.getElementById('migWin10').textContent = win10.toLocaleString('es-MX');
  document.getElementById('migWin10Pct').textContent = pctWin10.toFixed(1) + '% pendiente';
  document.getElementById('migNoComp').textContent = nocomp.toLocaleString('es-MX');
  document.getElementById('migPctMigrado').textContent = pctMigrado.toFixed(1) + '%';

  const container = document.getElementById('migRegions');
  container.innerHTML = '';
  Object.keys(byRegion).sort().forEach(region=>{
    const d = byRegion[region];
    const rtotal = d.win10 + d.win11 + d.nocomp + d.sinDato;
    const pct = rtotal ? (d.win11 / rtotal * 100) : 0;
    const row = document.createElement('div');
    row.className = 'progrow';
    row.innerHTML = `<div class="rname">${region}</div><div class="progtrack"><div class="progfill" style="width:${pct.toFixed(1)}%"><span>${pct.toFixed(1)}%</span></div></div><div class="rtotal">${rtotal}</div><div class="rdetalle">Win10: ${d.win10} · No compatible Win 11: ${d.nocomp}</div>`;
    container.appendChild(row);
  });
}

function render(rows){
  const parsed = rows.map(classify).filter(r => r.region);
  const byRegion = {};
  let totDesktop=0, totLaptop=0, totCambaceo=0;

  parsed.forEach(r=>{
    if(!byRegion[r.region]) byRegion[r.region] = {desktop:0, laptop:0, cambaceo:0};
    byRegion[r.region][r.tipo]++;
    if(r.tipo==='desktop') totDesktop++;
    else if(r.tipo==='laptop') totLaptop++;
    else totCambaceo++;
  });

  const total = totDesktop + totLaptop + totCambaceo;
  document.getElementById('kpiTotal').textContent = total.toLocaleString('es-MX');
  document.getElementById('kpiDesktop').textContent = totDesktop.toLocaleString('es-MX');
  document.getElementById('kpiLaptop').textContent = totLaptop.toLocaleString('es-MX');
  document.getElementById('kpiCambaceo').textContent = totCambaceo.toLocaleString('es-MX');

  const regionsEl = document.getElementById('regions');
  regionsEl.innerHTML = '';
  Object.keys(byRegion).sort().forEach(region=>{
    const d = byRegion[region];
    const rtotal = d.desktop + d.laptop + d.cambaceo;
    const card = document.createElement('div');
    card.className = 'region-card';
    card.innerHTML = `<div class="rname">${region}</div><div class="rtotal"><span class="num">${rtotal.toLocaleString('es-MX')}</span><span class="lab">total equipos</span></div><div class="rows"><div class="row"><span class="k">PDV laptop</span><span class="v">${d.laptop}</span></div><div class="row"><span class="k">Cambaceo</span><span class="v">${d.cambaceo}</span></div><div class="row"><span class="k">Desktop</span><span class="v">${d.desktop}</span></div></div>`;
    regionsEl.appendChild(card);
  });

  window._parsedRows = parsed;
  populateRegionFilter(parsed);
  applyFilters();
  renderMigracion(parsed);
}

function populateRegionFilter(parsed){
  const select = document.getElementById('filterRegion');
  const current = select.value;
  const regions = Array.from(new Set(parsed.map(r => r.region))).sort();
  select.innerHTML = '<option value="">Región: todas</option>' + regions.map(r => `<option value="${r}">${r}</option>`).join('');
  if(regions.includes(current)) select.value = current;
}

function renderTable(rows){
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '';
  const frag = document.createDocumentFragment();
  rows.slice(0, 2000).forEach(r=>{
    const tr = document.createElement('tr');
    const badgeClass = r.tipo === 'desktop' ? 'desktop' : (r.tipo === 'cambaceo' ? 'cambaceo' : 'laptop');
    const badgeLabel = r.tipo === 'desktop' ? 'Desktop' : (r.tipo === 'cambaceo' ? 'Laptop cambaceo' : 'Laptop PDV');
    tr.innerHTML = `<td>${r.region}</td><td>${r.pdv || ''}</td><td>${r.equipo || ''}</td><td><span class="badge ${badgeClass}">${badgeLabel}</span></td><td>${r.serie || ''}</td>`;
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);
}

function getFilteredRows(){
  const q = document.getElementById('search').value.toLowerCase();
  const region = document.getElementById('filterRegion').value;
  const tipo = document.getElementById('filterTipo').value;
  const os = document.getElementById('filterOS').value;
  return (window._parsedRows||[]).filter(r=>{
    if(region && r.region !== region) return false;
    if(tipo && r.tipo !== tipo) return false;
    if(os && r.os !== os) return false;
    if(q){
      const hay = (r.region||'').toLowerCase().includes(q) || (r.pdv||'').toLowerCase().includes(q) || (r.equipo||'').toLowerCase().includes(q) || (String(r.serie)||'').toLowerCase().includes(q);
      if(!hay) return false;
    }
    return true;
  });
}

function applyFilters(){
  const filtered = getFilteredRows();
  renderTable(filtered);
  document.getElementById('resultCount').textContent = filtered.length.toLocaleString('es-MX') + ' resultado' + (filtered.length === 1 ? '' : 's');
}

document.getElementById('search').addEventListener('input', applyFilters);
document.getElementById('filterRegion').addEventListener('change', applyFilters);
document.getElementById('filterTipo').addEventListener('change', applyFilters);
document.getElementById('filterOS').addEventListener('change', applyFilters);

document.getElementById('exportCsv').addEventListener('click', ()=>{
  const rows = getFilteredRows();
  const header = 'Region,PDV,Equipo,Tipo,Serie\n';
  const body = rows.map(r => [r.region, r.pdv, r.equipo, r.tipo, r.serie].map(v => `"${(v||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([header + body], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'equipos_pdv_detalle.csv';
  a.click();
  URL.revokeObjectURL(url);
});

document.querySelectorAll('.tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    document.getElementById('view-equipos').style.display = view === 'equipos' ? 'block' : 'none';
    document.getElementById('view-migracion').style.display = view === 'migracion' ? 'block' : 'none';
  });
});

document.getElementById('fileInput').addEventListener('change', function(e){
  const file = e.target.files[0];
  if(!file) return;
  document.getElementById('fileStatus').textContent = 'Procesando ' + file.name + '...';
  const reader = new FileReader();
  reader.onload = function(evt){
    try{
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, {type:'array'});
      const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('consolidado')) || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(ws, {defval:''});
      rawRows = json;
      document.getElementById('fileStatus').textContent = file.name + ' · ' + json.length.toLocaleString('es-MX') + ' registros (' + sheetName + ') · guardando...';
      document.getElementById('empty').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      render(rawRows);
      persistReportViaPrime(json, file.name, sheetName);
    }catch(err){
      document.getElementById('fileStatus').textContent = 'Error al leer el archivo: ' + err.message;
    }
  };
  reader.readAsArrayBuffer(file);
});

async function persistReportViaPrime(rows, filename, sheetName){
  return saveReportToBackend(rows, filename, sheetName);
}
