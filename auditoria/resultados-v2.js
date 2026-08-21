// PRIME MX · Auditoría IT · Resultado posterior opcional v2.0
(function(){
'use strict';
const RESULT_BUCKET='audit-resultados';
const MAX_RESULT=10*1024*1024;

const baseNewAudit=newAudit;
newAudit=function(p){
  const a=baseNewAudit(p);
  a.totalScore='';a.totalScoreNA=false;a.score='';a.attAuditor='';
  a.resultPath=null;a.resultName='';a.resultMime='';a.resultSize=0;a.resultUploadedAt=null;a.resultUrl=null;
  return a;
};

const baseFromRow=fromRow;
fromRow=function(r){
  const a=baseFromRow(r);
  a.totalScore=r.total_score==null?'':Number(r.total_score);
  a.totalScoreNA=!!r.total_score_na;
  a.score=r.audit_score==null?'':Number(r.audit_score);
  a.attAuditor=r.att_auditor||'';
  a.historicalImported=!!r.historical_imported;
  a.resultPath=r.result_file_path||null;a.resultName=r.result_file_name||'';a.resultMime=r.result_file_mime||'';
  a.resultSize=Number(r.result_file_size||0);a.resultUploadedAt=r.result_uploaded_at||null;a.resultUrl=null;
  return a;
};

async function signResult(a){
  if(!a?.resultPath){if(a)a.resultUrl=null;return}
  const s=await sb.storage.from(RESULT_BUCKET).createSignedUrl(a.resultPath,3600);
  a.resultUrl=s.error?null:(s.data?.signedUrl||null);
}

const baseLoadAll=loadAll;
loadAll=async function(){await baseLoadAll();await Promise.all([...audits.values()].map(signResult));renderAll()};

function resultStyle(){
  if(document.getElementById('audit-result-style'))return;
  const s=document.createElement('style');s.id='audit-result-style';s.textContent=`
#audit-result-card{margin-top:14px}.result-grid{display:grid;grid-template-columns:repeat(2,minmax(220px,1fr));gap:14px;padding:16px}.result-score-wrap{display:flex;align-items:center;gap:8px}.result-score-wrap input{max-width:150px}.result-score-wrap span{font:600 12px var(--mono);color:var(--muted)}.result-file-box{border:1px dashed var(--line2);border-radius:10px;padding:12px;background:#fff;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:66px}.result-file-meta b{display:block;font-size:12px}.result-file-meta span{font-size:10.5px;color:var(--muted)}.result-actions{display:flex;gap:7px;flex-wrap:wrap}.result-note{padding:0 16px 16px;color:var(--muted);font-size:11px}.score-pill{display:inline-flex;padding:3px 8px;border-radius:20px;background:var(--brand-soft,#e6f3ef);color:var(--brand,#08775c);font-weight:700;white-space:nowrap}.score-na{background:#f1f3f2;color:#69756f}.score-pending{font-size:10px;color:var(--muted)}.na-line{display:flex;align-items:center;gap:7px;margin-top:8px;font-size:11px;color:var(--muted)}.na-line input{accent-color:var(--brand)}.result-full{grid-column:1/-1}@media(max-width:800px){.result-grid{grid-template-columns:1fr}.result-full{grid-column:auto}}
  `;document.head.appendChild(s);
}

function ensureResultCard(){
  resultStyle();let card=$('#audit-result-card');if(card)return card;
  card=document.createElement('div');card.id='audit-result-card';card.className='module';
  card.innerHTML=`<div class="module-head"><div><div class="module-title">Resultado de auditoría</div><div class="card-sub">Opcional · puede capturarse al cierre o actualizarse cuando AT&T entregue el resultado</div></div><div class="module-meta" id="result-meta">Pendiente</div></div>
  <div class="result-grid">
    <div><div class="field"><label>Calificación Total del PDV (0–100)</label><div class="result-score-wrap"><input id="a-total-score" type="number" min="0" max="100" step="0.01" class="control" placeholder="Ej. 94"><span>/ 100</span></div><label class="na-line"><input id="a-total-na" type="checkbox"> No aplicó</label></div></div>
    <div><div class="field"><label>Calificación Equipo de Cómputo (0–100)</label><div class="result-score-wrap"><input id="a-score" type="number" min="0" max="100" step="0.01" class="control" placeholder="Ej. 85"><span>/ 100</span></div></div></div>
    <div><div class="field"><label>Auditor AT&T</label><input id="a-att-auditor" class="control" placeholder="Nombre del auditor AT&T"></div></div>
    <div><div class="field"><label>Fecha de visita</label><input id="a-result-date" type="date" class="control"></div></div>
    <div class="result-full"><div class="field"><label>Hoja con resultado</label><div id="result-file-box" class="result-file-box"></div></div></div>
    <div class="result-full"><button id="save-result" class="btn primary small can-write" type="button">Guardar resultado</button></div>
  </div><div class="result-note">Estos datos no son obligatorios para cerrar una auditoría. Pueden agregarse o corregirse después sin modificar el checklist cerrado.</div>`;
  const root=document.querySelector('.audit-main');root?.appendChild(card);
  $('#save-result').onclick=()=>saveAuditResult(true);
  $('#a-total-na').onchange=()=>{const x=$('#a-total-score');if(x){x.disabled=!canWrite||$('#a-total-na').checked;if($('#a-total-na').checked)x.value=''}};
  return card;
}

function fmtResultDate(v){if(!v)return'';try{return new Date(v).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'})}catch(_){return''}}
function numberScore(v){return v!==''&&v!=null?Number(v).toLocaleString('es-MX',{maximumFractionDigits:2})+'%':'Pendiente'}
function totalText(a){return a?.totalScoreNA?'No aplicó':numberScore(a?.totalScore)}
function equipmentText(a){return numberScore(a?.score)}

function renderResultCard(a){
  const card=ensureResultCard();if(!card)return;card.classList.toggle('hidden',!a);if(!a)return;
  const total=$('#a-total-score'),na=$('#a-total-na'),eq=$('#a-score'),att=$('#a-att-auditor'),dt=$('#a-result-date');
  na.checked=!!a.totalScoreNA;total.value=a.totalScore===''?'':a.totalScore;eq.value=a.score===''?'':a.score;att.value=a.attAuditor||'';dt.value=a.date||'';
  na.disabled=!canWrite;total.disabled=!canWrite||na.checked;eq.disabled=!canWrite;att.disabled=!canWrite;dt.disabled=!canWrite;
  $('#save-result').classList.toggle('hidden',!canWrite);
  $('#result-meta').textContent=(a.totalScoreNA||a.totalScore!==''||a.score!=='')?`Total: ${totalText(a)} · Equipo: ${equipmentText(a)}`:(a.resultPath?'Hoja cargada':'Pendiente');
  const box=$('#result-file-box');
  if(a.resultPath){box.innerHTML=`<div class="result-file-meta"><b>${esc(a.resultName||'Hoja de resultado')}</b><span>${a.resultSize?Math.round(a.resultSize/1024)+' KB · ':''}${a.resultUploadedAt?esc(fmtResultDate(a.resultUploadedAt)):''}</span></div><div class="result-actions">${a.resultUrl?'<button class="btn small" id="view-result-file" type="button">Ver hoja</button>':''}${canWrite?'<button class="btn small soft" id="upload-result-file" type="button">Cambiar archivo</button>':''}</div>`}
  else{box.innerHTML=`<div class="result-file-meta"><b>Sin hoja de resultado</b><span>PDF, imagen o Excel · máximo 10 MB</span></div>${canWrite?'<div class="result-actions"><button class="btn small soft" id="upload-result-file" type="button">＋ Subir hoja</button></div>':''}`}
  $('#view-result-file')?.addEventListener('click',()=>{if(a.resultUrl)window.open(a.resultUrl,'_blank','noopener')});
  $('#upload-result-file')?.addEventListener('click',()=>chooseResultFile(a));
}

const baseLoadAuditForm=loadAuditForm;
loadAuditForm=function(){baseLoadAuditForm();renderResultCard(selectedAudit())};
const baseClearAuditForm=clearAuditForm;
clearAuditForm=function(){baseClearAuditForm();renderResultCard(null)};

function ensureUniverseHeaders(){
  const tr=document.querySelector('#view-universe table thead tr');if(!tr||tr.querySelector('[data-result-total-head]'))return;
  const action=tr.lastElementChild,obs=action?.previousElementSibling;
  const defs=[['resultTotalHead','Calif. Total'],['resultEquipmentHead','Equipo de Cómputo'],['resultAttHead','Auditor AT&T'],['resultFileHead','Resultado']];
  defs.forEach(([key,label])=>{const th=document.createElement('th');th.dataset[key]='1';th.textContent=label;tr.insertBefore(th,obs||action)});
}

const baseRenderUniverse=renderUniverse;
renderUniverse=function(){
  baseRenderUniverse();ensureUniverseHeaders();
  document.querySelectorAll('#universe-body tr').forEach(tr=>{
    if(tr.querySelector('[data-result-total-cell]'))return;
    const open=tr.querySelector('[data-open]'),key=open?.dataset.open,a=key?audits.get(key):null,cells=tr.children,obs=cells[cells.length-2];
    const totalTd=document.createElement('td'),eqTd=document.createElement('td'),attTd=document.createElement('td'),fileTd=document.createElement('td');
    totalTd.dataset.resultTotalCell='1';
    totalTd.innerHTML=a?(a.totalScoreNA?'<span class="score-pill score-na">No aplicó</span>':(a.totalScore!==''&&a.totalScore!=null?`<span class="score-pill">${esc(totalText(a))}</span>`:'<span class="score-pending">Pendiente</span>')):'—';
    eqTd.innerHTML=a?(a.score!==''&&a.score!=null?`<span class="score-pill">${esc(equipmentText(a))}</span>`:'<span class="score-pending">Pendiente</span>'):'—';
    attTd.innerHTML=a?.attAuditor?esc(a.attAuditor):'—';
    fileTd.innerHTML=a?.resultPath?(a.resultUrl?`<button class="btn small" data-result-open="${esc(key)}">Ver hoja</button>`:'<span class="score-pending">Archivo cargado</span>'):'—';
    [totalTd,eqTd,attTd,fileTd].forEach(td=>tr.insertBefore(td,obs));
  });
  document.querySelectorAll('[data-result-open]').forEach(b=>b.onclick=()=>{const a=audits.get(b.dataset.resultOpen);if(a?.resultUrl)window.open(a.resultUrl,'_blank','noopener')});
};

async function ensureAuditSaved(a){if(!a)return false;if(a.isNew){await saveAudit(false)}return !a.isNew}
function optionalScore(sel,label){const raw=String($(sel)?.value??'').trim();if(!raw)return null;const n=Number(raw);if(!Number.isFinite(n)||n<0||n>100)throw new Error(label+' debe estar entre 0 y 100.');return Math.round(n*100)/100}

async function saveAuditResult(notify=true){
  const a=selectedAudit();if(!a||!canWrite)return false;
  try{
    await ensureAuditSaved(a);
    const totalNA=!!$('#a-total-na')?.checked,total=totalNA?null:optionalScore('#a-total-score','La Calificación Total'),equipment=optionalScore('#a-score','La Calificación de Equipo de Cómputo');
    const auditor=String($('#a-att-auditor')?.value||'').trim(),date=String($('#a-result-date')?.value||'').trim()||null;
    const r=await sb.rpc('update_audit_result_v2',{p_audit_id:a.id,p_total_score:total,p_total_na:totalNA,p_equipment_score:equipment,p_att_auditor:auditor||null,p_audit_date:date,p_result_path:a.resultPath||null,p_result_name:a.resultName||null,p_result_mime:a.resultMime||null,p_result_size:a.resultSize||null});
    if(r.error)throw r.error;const row=r.data?.[0]||{};
    a.totalScore=row.total_score==null?'':Number(row.total_score);a.totalScoreNA=!!row.total_score_na;a.score=row.audit_score==null?'':Number(row.audit_score);a.attAuditor=row.att_auditor||'';a.date=row.audit_date||a.date;
    a.resultPath=row.result_file_path||null;a.resultName=row.result_file_name||'';a.resultMime=row.result_file_mime||'';a.resultSize=Number(row.result_file_size||0);a.resultUploadedAt=row.result_uploaded_at||null;
    if($('#a-date'))$('#a-date').value=a.date||'';
    await signResult(a);renderResultCard(a);renderUniverse();if(notify)toast('Resultado de auditoría guardado');return true;
  }catch(e){if(notify)alert(e.message||e);return false}
}

function mimeFor(file){if(file.type)return file.type;const ext=String(file.name||'').toLowerCase().split('.').pop();return ext==='pdf'?'application/pdf':ext==='png'?'image/png':ext==='webp'?'image/webp':(ext==='jpg'||ext==='jpeg')?'image/jpeg':ext==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':ext==='xls'?'application/vnd.ms-excel':''}
function allowedResult(file){const ext=String(file.name||'').toLowerCase().split('.').pop();return ['pdf','jpg','jpeg','png','webp','xlsx','xls'].includes(ext)}
function safeName(v){return String(v||'resultado').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-100)}
async function chooseResultFile(a){
  const inp=document.createElement('input');inp.type='file';inp.accept='.pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,application/pdf,image/jpeg,image/png,image/webp,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
  inp.onchange=async()=>{const f=inp.files?.[0];if(!f)return;if(f.size>MAX_RESULT)return alert('La hoja de resultado no puede superar 10 MB.');if(!allowedResult(f))return alert('Formato no permitido. Usa PDF, JPG, PNG, WebP, XLSX o XLS.');let uploaded=null;const old={path:a.resultPath,name:a.resultName,mime:a.resultMime,size:a.resultSize,at:a.resultUploadedAt,url:a.resultUrl};
    try{await ensureAuditSaved(a);const mime=mimeFor(f);if(!mime)throw new Error('No se pudo identificar el tipo de archivo.');const path=`${user.id}/${a.id}/${Date.now()}-${safeName(f.name)}`;const up=await sb.storage.from(RESULT_BUCKET).upload(path,f,{contentType:mime,upsert:false});if(up.error)throw up.error;uploaded=path;a.resultPath=path;a.resultName=f.name;a.resultMime=mime;a.resultSize=f.size;a.resultUploadedAt=new Date().toISOString();a.resultUrl=null;const ok=await saveAuditResult(false);if(!ok)throw new Error('No se pudo asociar la hoja con la auditoría.');if(old.path&&old.path!==path&&old.path.startsWith(user.id+'/'))await sb.storage.from(RESULT_BUCKET).remove([old.path]).catch(()=>{});toast('Hoja de resultado cargada')}
    catch(e){a.resultPath=old.path;a.resultName=old.name;a.resultMime=old.mime;a.resultSize=old.size;a.resultUploadedAt=old.at;a.resultUrl=old.url;if(uploaded)await sb.storage.from(RESULT_BUCKET).remove([uploaded]).catch(()=>{});renderResultCard(a);alert('No se pudo cargar la hoja: '+(e.message||e))}};
  inp.click();
}

resultStyle();
})();