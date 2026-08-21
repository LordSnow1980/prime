// PRIME MX HUB · Gestión editable de casos históricos v4
(function(){
  const CASE_COND=['Obsoleto','Dañado','Funcional (baja)','PENDIENTE DE CAPTURA'];
  const DEST_STATES=[['ENTREGADO_HUB','Entregado en HUB'],['ASIGNADO_HUB','HUB asignado'],['EN_PDV','Sigue en PDV'],['SIN_RESPUESTA','Sin respuesta'],['PENDIENTE','Pendiente']];
  const CASE_STATUS=['ABIERTO','CERRADO'];

  function badge(txt,kind=''){return `<span class="case-badge ${kind}">${esc(txt||'—')}</span>`}
  function addCaseStyles(){
    if(document.getElementById('caseStyles'))return;
    const s=document.createElement('style');s.id='caseStyles';s.textContent=`
      .case-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px}.case-badge{display:inline-flex;padding:3px 7px;border-radius:999px;border:1px solid var(--line2);font:600 9.5px var(--mono);color:var(--muted);background:var(--panel2)}.case-badge.open{color:#d69328;border-color:var(--ochre-line);background:var(--ochre-soft)}.case-badge.closed{color:#43b998;border-color:var(--pine-line);background:var(--pine-soft)}.case-badge.warn{color:#f0b75f;border-color:var(--ochre-line);background:var(--ochre-soft)}
      .case-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0 12px}.case-meta>div{border:1px solid var(--line);background:var(--panel2);border-radius:8px;padding:9px}.case-meta b{display:block;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:3px}.case-meta span{font-size:11.5px}
      .case-modal{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.68);display:none;align-items:flex-start;justify-content:center;padding:28px 16px;overflow:auto}.case-modal.show{display:flex}.case-box{width:min(980px,100%);background:var(--panel);border:1px solid var(--line2);border-radius:12px;box-shadow:var(--sh3);padding:18px}.case-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:12px}.case-head h2{margin:0;font-size:18px}.case-head p{margin:3px 0 0;color:var(--muted);font-size:11px}.case-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.case-grid .full{grid-column:1/-1}.case-eq{border:1px solid var(--line);border-radius:9px;padding:12px;margin-top:10px;background:var(--panel2)}.case-eq h4{margin:0 0 8px}.case-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}.case-photo-current{display:flex;align-items:center;gap:8px;margin:6px 0}.case-photo-current img{width:68px;height:52px;object-fit:cover;border-radius:6px;border:1px solid var(--line2)}.case-help{font-size:10.5px;color:var(--muted);margin-top:4px}.case-obs{min-height:76px;resize:vertical}.case-filter{max-width:180px}@media(max-width:760px){.case-grid,.case-meta{grid-template-columns:1fr}.case-grid .full{grid-column:auto}}
    `;document.head.appendChild(s);
  }
  function ensureCaseModal(){
    addCaseStyles();let m=document.getElementById('hubCaseModal');if(m)return m;
    m=document.createElement('div');m.id='hubCaseModal';m.className='case-modal';m.innerHTML='<div class="case-box" id="hubCaseBox"></div>';m.onclick=e=>{if(e.target===m)m.classList.remove('show')};document.body.appendChild(m);return m;
  }

  loadData=async function(){
    const [s,h,r,e]=await Promise.all([
      sb.from('hub_stores').select('id,nombre,clave').eq('activo',true).order('nombre'),
      sb.from('hub_locations').select('id,region,estado,ciudad,hub,responsable,telefono').eq('activo',true).order('region').order('hub'),
      sb.from('hub_requests').select('*').order('requested_at',{ascending:false}),
      sb.from('hub_equipment').select('*').order('created_at',{ascending:true})
    ]);
    for(const x of[s,h,r,e])if(x.error)throw x.error;
    stores=s.data||[];hubs=h.data||[];
    const paths=(e.data||[]).map(x=>x.foto_path).filter(Boolean),signed=new Map();
    if(paths.length){const su=await sb.storage.from('hub-evidencias').createSignedUrls(paths,900);if(!su.error)(su.data||[]).forEach((x,i)=>{if(x?.signedUrl)signed.set(paths[i],x.signedUrl)})}
    const by=new Map();(e.data||[]).forEach(x=>{if(!by.has(x.request_id))by.set(x.request_id,[]);by.get(x.request_id).push({id:x.id,type:x.tipo,serial:x.serial,condition:x.condicion,notes:x.notas||'',photoPath:x.foto_path,photo:signed.get(x.foto_path)||null,photoName:x.foto_name||'',photoSize:x.foto_size||0})});
    requests=(r.data||[]).map(x=>({
      id:x.id,folio:x.folio,date:x.requested_at,store:{id:x.store_id,name:x.store_nombre,key:x.store_clave||''},
      hub:{id:x.hub_id,name:x.hub_nombre,city:x.hub_ciudad||'',state:x.hub_estado||'',owner:x.hub_responsable||'',phone:x.hub_telefono||''},
      deliverer:x.entregado_por_nombre||'',createdBy:x.created_by,equipment:by.get(x.id)||[],
      process:x.proceso||'HUB',status:x.status||'ABIERTO',region:x.region||'',evidenceState:x.evidencia_estado||'PENDIENTE',destinationState:x.destino_estado||'PENDIENTE',observations:x.observaciones||'',origin:x.origen||'PORTAL',historic:!!x.historico
    }));
  };

  renderDashboard=function(){
    const eq=requests.reduce((n,r)=>n+r.equipment.length,0),open=requests.filter(r=>r.status==='ABIERTO').length;
    $('#kReq').textContent=requests.length;$('#kEq').textContent=eq;$('#kStore').textContent=stores.length;$('#kHub').textContent=hubs.length;
    const f=$('#recent');f.innerHTML=requests.length?requests.slice(0,7).map(r=>`<div class="feed-item"><b>${esc(r.store.name)}</b><span>${esc(r.folio)} · ${esc(r.status)} · ${esc(r.hub.name)} · ${fmt(r.date)}</span></div>`).join(''):'<div class="empty">Aún no hay solicitudes.</div>';
    const k=$('#kReq')?.parentElement?.querySelector('p');if(k)k.textContent=open+' abiertos · '+(requests.length-open)+' cerrados';
  };

  renderHistory=function(){
    addCaseStyles();
    const q=($('#histSearch').value||'').toLowerCase(),filter=$('#histStatus')?.value||'';
    const list=requests.filter(r=>(!filter||r.status===filter)&&(!q||(r.folio+' '+r.store.name+' '+r.store.key+' '+r.hub.name+' '+r.deliverer+' '+r.status+' '+r.region+' '+r.observations).toLowerCase().includes(q)));
    $('#histCount').textContent=`${requests.length} solicitudes · ${requests.filter(r=>r.status==='ABIERTO').length} abiertas`;
    if(!$('#histStatus')){const bar=$('#histSearch')?.parentElement;if(bar){const sel=document.createElement('select');sel.id='histStatus';sel.className='inp case-filter';sel.innerHTML='<option value="">Todos los status</option><option>ABIERTO</option><option>CERRADO</option>';sel.onchange=renderHistory;bar.insertBefore(sel,$('#exportCsv'));}}
    $('#historyList').innerHTML=list.map(r=>`<div class="req" id="r-${r.id}"><div class="reqtop" onclick="$('#r-${r.id}').classList.toggle('open')"><div><b>${esc(r.folio)} · ${esc(r.store.name)}</b><span>${esc(r.store.key||'')} · ${esc(r.region||'Sin región')} · ${esc(r.hub.name)}</span><div class="case-badges">${badge(r.status,r.status==='ABIERTO'?'open':'closed')}${badge(r.destinationState,r.destinationState==='EN_PDV'||r.destinationState==='SIN_RESPUESTA'?'warn':'')}${badge(r.evidenceState)}</div></div><div>${r.equipment.length} equipo(s)</div></div><div class="reqbody"><div class="case-meta"><div><b>Persona que entrega</b><span>${esc(r.deliverer||'—')}</span></div><div><b>Origen</b><span>${r.historic?'Histórico importado':'Captura portal'}</span></div><div><b>Destino</b><span>${esc(r.hub.name||'—')}</span></div><div><b>Observaciones</b><span>${esc(r.observations||'—')}</span></div></div><div class="table-wrap"><table><thead><tr><th>Foto</th><th>Tipo</th><th>Serie</th><th>Condición</th><th>Notas</th></tr></thead><tbody>${r.equipment.map(e=>`<tr><td>${e.photo?`<img class="thumb" src="${e.photo}" onclick="event.stopPropagation();showPhoto('${e.photo}')">`:'Pendiente'}</td><td>${esc(e.type)}</td><td>${esc(e.serial)}</td><td>${esc(e.condition)}</td><td>${esc(e.notes||'')}</td></tr>`).join('')}</tbody></table></div><div class="rowend"><button class="btn sm" onclick="printLetter('${r.id}')">Imprimir carta</button>${(role==='ADMIN'||role==='CAPTURA')?`<button class="btn pri sm" onclick="openHubCaseEditor('${r.id}')">Editar / Reasignar</button>`:''}${role==='ADMIN'?`<button class="btn bad sm" onclick="deleteRequest('${r.id}')">Eliminar</button>`:''}</div></div></div>`).join('')||'<div class="empty">No hay solicitudes con ese filtro.</div>';
  };

  exportCSV=function(){
    if(!requests.length)return toast('No hay solicitudes.',true);
    const rows=[['Ticket/Folio','Status','Región','PDV','Clave PDV','Estado destino','HUB','Evidencia','Persona entrega','Tipo','Serie','Condición','Notas','Observaciones']];
    requests.forEach(r=>r.equipment.forEach(e=>rows.push([r.folio,r.status,r.region,r.store.name,r.store.key,r.destinationState,r.hub.name,r.evidenceState,r.deliverer,e.type,e.serial,e.condition,e.notes,r.observations])));
    const csv='﻿'+rows.map(a=>a.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(',')).join('\r\n'),b=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='hub_'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(a.href);
  };

  window.openHubCaseEditor=function(id){
    if(role!=='ADMIN'&&role!=='CAPTURA')return toast('Tu rol es solo consulta.',true);
    const r=requests.find(x=>x.id===id);if(!r)return;
    const m=ensureCaseModal(),box=document.getElementById('hubCaseBox');
    const hubOpts=`<option value="KEEP">Conservar destino actual: ${esc(r.hub.name||'—')}</option><option value="">Sin HUB asignado</option>`+hubs.map(h=>`<option value="${h.id}" ${r.hub.id===h.id?'selected':''}>${esc(h.hub)} · ${esc(h.region)}</option>`).join('');
    box.innerHTML=`<div class="case-head"><div><h2>Editar / Reasignar · ${esc(r.folio)}</h2><p>${esc(r.store.name)} · ${esc(r.store.key)}</p></div><button class="btn sm" type="button" onclick="closeHubCaseEditor()">Cerrar</button></div><div class="case-grid"><div class="field"><label>Status</label><select id="ceStatus">${CASE_STATUS.map(x=>`<option ${x===r.status?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Región</label><input id="ceRegion" class="inp" value="${esc(r.region)}"></div><div class="field"><label>HUB / reasignación</label><select id="ceHub">${hubOpts}</select></div><div class="field"><label>Estado del destino</label><select id="ceDest">${DEST_STATES.map(([v,l])=>`<option value="${v}" ${v===r.destinationState?'selected':''}>${l}</option>`).join('')}</select></div><div class="field"><label>Persona que entrega</label><input id="ceDeliverer" class="inp" value="${esc(r.deliverer)}" placeholder="Nombre completo o pendiente"></div><div class="field"><label>Evidencia</label><select id="ceEvidence"><option ${r.evidenceState==='PENDIENTE'?'selected':''}>PENDIENTE</option><option ${r.evidenceState==='DECLARADA'?'selected':''}>DECLARADA</option><option ${r.evidenceState==='PARCIAL'?'selected':''}>PARCIAL</option><option ${r.evidenceState==='CARGADA'?'selected':''}>CARGADA</option><option ${r.evidenceState==='SIN_EVIDENCIA'?'selected':''}>SIN_EVIDENCIA</option></select></div><div class="field full"><label>Observaciones</label><textarea id="ceObs" class="inp case-obs">${esc(r.observations)}</textarea></div></div><h3 style="margin:14px 0 5px">Equipos</h3>${r.equipment.map((e,i)=>`<div class="case-eq" data-eqid="${e.id}"><h4>Equipo #${i+1}</h4><div class="case-grid"><div class="field"><label>Tipo</label><select class="ceType">${EQ_TYPES.map(x=>`<option ${x===e.type?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Serie</label><input class="inp ceSerial" value="${esc(e.serial)}"></div><div class="field"><label>Condición</label><select class="ceCond">${CASE_COND.map(x=>`<option ${x===e.condition?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Notas</label><input class="inp ceNotes" value="${esc(e.notes)}"></div><div class="field full"><label>Foto / evidencia</label>${e.photo?`<div class="case-photo-current"><img src="${e.photo}" onclick="showPhoto('${e.photo}')"><span>${esc(e.photoName||'Evidencia cargada')}</span></div>`:'<div class="case-help">Aún no hay archivo cargado.</div>'}<input class="inp cePhoto" type="file" accept="image/*" capture="environment"><div class="case-help">Puedes cargarla ahora o regresar después. No se exige para guardar otros cambios.</div></div></div></div>`).join('')}<div class="case-actions"><button class="btn" type="button" onclick="closeHubCaseEditor()">Cancelar</button><button id="saveCaseBtn" class="btn pri" type="button" onclick="saveHubCaseEdit('${r.id}')">Guardar cambios</button></div>`;
    m.classList.add('show');
  };
  window.closeHubCaseEditor=function(){document.getElementById('hubCaseModal')?.classList.remove('show')};

  window.saveHubCaseEdit=async function(id){
    if(role!=='ADMIN'&&role!=='CAPTURA')return;
    const r=requests.find(x=>x.id===id);if(!r)return;
    const btn=document.getElementById('saveCaseBtn');if(btn){btn.disabled=true;btn.textContent='Guardando…'}
    const uploads=[];
    try{
      const eqBoxes=[...document.querySelectorAll('#hubCaseBox .case-eq')];
      const eqPatches=[];
      for(const box of eqBoxes){
        const eqId=box.dataset.eqid,old=r.equipment.find(x=>x.id===eqId);let photoPatch={};const file=box.querySelector('.cePhoto')?.files?.[0];
        if(file){const p=await compressPhoto(file),z=dataUrlBlob(p.data),path=`${me.id}/${r.id}/${eqId}-${Date.now()}.${ext(z.mime)}`;const up=await sb.storage.from('hub-evidencias').upload(path,z.blob,{contentType:z.mime,upsert:false});if(up.error)throw up.error;uploads.push(path);photoPatch={foto_path:path,foto_name:p.name||file.name,foto_size:p.size||file.size};}
        eqPatches.push({id:eqId,patch:{tipo:box.querySelector('.ceType').value,serial:(box.querySelector('.ceSerial').value||'PENDIENTE DE CAPTURA').trim()||'PENDIENTE DE CAPTURA',condicion:box.querySelector('.ceCond').value,notas:(box.querySelector('.ceNotes').value||'').trim()||null,updated_by:me.id,...photoPatch},hasPhoto:!!(photoPatch.foto_path||old?.photoPath)});
      }
      for(const q of eqPatches){const u=await sb.from('hub_equipment').update(q.patch).eq('id',q.id);if(u.error)throw u.error;}
      const hubValue=$('#ceHub').value;let hubPatch={};
      if(hubValue==='KEEP'){hubPatch={hub_id:r.hub.id||null,hub_nombre:r.hub.name||'SIN HUB ASIGNADO',hub_ciudad:r.hub.city||null,hub_estado:r.hub.state||null,hub_responsable:r.hub.owner||null,hub_telefono:r.hub.phone||null};}
      else if(hubValue){const h=hubs.find(x=>String(x.id)===String(hubValue));if(!h)throw new Error('HUB no encontrado');hubPatch={hub_id:h.id,hub_nombre:h.hub,hub_ciudad:h.ciudad,hub_estado:h.estado,hub_responsable:h.responsable||null,hub_telefono:h.telefono||null};}
      else hubPatch={hub_id:null,hub_nombre:'SIN HUB ASIGNADO',hub_ciudad:null,hub_estado:null,hub_responsable:null,hub_telefono:null};
      const allPhotos=eqPatches.length&&eqPatches.every(x=>x.hasPhoto),somePhotos=eqPatches.some(x=>x.hasPhoto);let ev=$('#ceEvidence').value;if(allPhotos)ev='CARGADA';else if(somePhotos&&ev!=='CARGADA')ev='PARCIAL';
      const patch={status:$('#ceStatus').value,region:($('#ceRegion').value||'').trim()||null,destino_estado:$('#ceDest').value,evidencia_estado:ev,entregado_por_nombre:($('#ceDeliverer').value||'PENDIENTE DE CAPTURA').trim()||'PENDIENTE DE CAPTURA',observaciones:($('#ceObs').value||'').trim()||null,updated_by:me.id,...hubPatch};
      const u=await sb.from('hub_requests').update(patch).eq('id',id);if(u.error)throw u.error;
      await loadData();renderAll();closeHubCaseEditor();toast('Folio '+r.folio+' actualizado');
    }catch(err){console.error(err);if(uploads.length)await sb.storage.from('hub-evidencias').remove(uploads).catch(()=>{});toast('No se pudo guardar: '+(err.message||err),true)}finally{if(btn){btn.disabled=false;btn.textContent='Guardar cambios'}}
  };

  document.addEventListener('DOMContentLoaded',()=>{ensureCaseModal();});
})();
