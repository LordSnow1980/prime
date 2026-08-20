// PRIME MX · Adquisición — reasignación + respaldos manuales/automáticos.
(function(){
  let pdvCatalog=[];
  let activeReassignId=null;

  function nowStamp(){
    const d=new Date();
    const p=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  async function loadPdvCatalog(){
    if(pdvCatalog.length) return pdvCatalog;
    const q=await sb.from('hub_stores').select('nombre,clave').eq('activo',true).order('nombre');
    if(!q.error) pdvCatalog=(q.data||[]).map(x=>x.nombre).filter(Boolean);
    ['Almacen Toluca','Corporativo Mazaryk'].forEach(x=>{if(!pdvCatalog.includes(x))pdvCatalog.push(x)});
    return pdvCatalog;
  }

  function ensureUi(){
    const topUser=document.querySelector('.top .user');
    if(topUser&&!document.getElementById('manualBackupBtn')){
      const state=document.createElement('span');
      state.id='backupState'; state.className='backup-state'; state.textContent='Auto respaldo activo';
      const btn=document.createElement('button');
      btn.id='manualBackupBtn'; btn.className='btn backup'; btn.textContent='↧ Respaldo manual';
      btn.onclick=manualBackup;
      topUser.insertBefore(state,topUser.lastElementChild);
      topUser.insertBefore(btn,topUser.lastElementChild);
    }

    if(!document.getElementById('adqPdvList')){
      const dl=document.createElement('datalist'); dl.id='adqPdvList'; document.body.appendChild(dl);
      loadPdvCatalog().then(list=>{dl.innerHTML=list.map(x=>`<option value="${esc(x)}"></option>`).join('')});
    }
    const bulk=document.getElementById('bPDV'); if(bulk) bulk.setAttribute('list','adqPdvList');

    if(!document.getElementById('reassignModal')){
      const wrap=document.createElement('div');
      wrap.id='reassignModal'; wrap.className='modal-backdrop hidden';
      wrap.innerHTML=`<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="reassignTitle">
        <div class="modal-head"><div><h3 id="reassignTitle">Reasignar equipo</h3><div class="muted" id="reassignSub"></div></div><button class="modal-close" id="reassignClose">×</button></div>
        <div class="modal-body">
          <div class="modal-current" id="reassignCurrent"></div>
          <div class="modal-grid">
            <label class="full">Nuevo PDV / ubicación<input id="reassignPdv" type="text" list="adqPdvList" placeholder="Busca o escribe el destino"></label>
            <label>Ticket<input id="reassignTicket" type="text" placeholder="Opcional"></label>
            <label>Estatus<select id="reassignStatus"><option value="">Conservar estatus actual</option></select></label>
            <label class="full">Observación<textarea id="reassignObs" placeholder="Motivo de la reasignación (opcional)"></textarea></label>
          </div>
        </div>
        <div class="modal-actions"><button class="btn" id="reassignCancel">Cancelar</button><button class="btn primary" id="reassignSave">Guardar reasignación</button></div>
      </div>`;
      document.body.appendChild(wrap);
      document.getElementById('reassignClose').onclick=closeReassign;
      document.getElementById('reassignCancel').onclick=closeReassign;
      document.getElementById('reassignSave').onclick=saveReassign;
      wrap.addEventListener('click',e=>{if(e.target===wrap)closeReassign()});
    }
  }

  async function buildSnapshot(type,reason){
    const [rep,h,user]=await Promise.all([
      sb.from('adq_reports').select('*').eq('report_id',REPORT_ID).maybeSingle(),
      sb.from('adq_audit_events').select('*').eq('report_id',REPORT_ID).order('created_at',{ascending:true}),
      sb.auth.getUser()
    ]);
    if(rep.error) throw rep.error;
    if(h.error) throw h.error;
    if(user.error||!user.data.user) throw new Error('Sesión no válida para respaldo.');
    const snapshot={
      kind:'PrimeMX_Adquisicion_Central_Backup',
      version:2,
      createdAt:new Date().toISOString(),
      backupType:type,
      reason:reason||'',
      report:rep.data||null,
      rows:rows,
      history:h.data||[]
    };
    const ins=await sb.from('adq_backups').insert({
      report_id:REPORT_ID,
      backup_type:type,
      reason:reason||null,
      row_count:rows.length,
      event_count:(h.data||[]).length,
      snapshot,
      created_by:user.data.user.id
    }).select('id,created_at').single();
    if(ins.error) throw ins.error;
    return {snapshot,record:ins.data};
  }

  function downloadSnapshot(snapshot){
    const blob=new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download=`PrimeMX_Adquisicion_Central_${nowStamp()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  async function manualBackup(){
    const btn=document.getElementById('manualBackupBtn'),state=document.getElementById('backupState');
    try{
      btn.disabled=true; state.textContent='Respaldando…';
      const {snapshot}=await buildSnapshot('manual','Respaldo manual solicitado desde la aplicación');
      downloadSnapshot(snapshot);
      state.textContent=`Respaldo manual ✓ ${new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}`;
    }catch(e){
      state.textContent='Error de respaldo'; alert('No se pudo crear el respaldo: '+(e.message||e));
    }finally{btn.disabled=false}
  }

  async function autoBackup(reason){
    const state=document.getElementById('backupState');
    try{
      if(state) state.textContent='Auto respaldo…';
      await buildSnapshot('auto',reason);
      if(state) state.textContent=`Auto respaldo ✓ ${new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}`;
      return true;
    }catch(e){
      if(state) state.textContent='Auto respaldo falló';
      alert('El cambio fue detenido porque no se pudo crear el respaldo automático.\n\n'+(e.message||e));
      return false;
    }
  }

  function displayStatusName(k){
    if(k==='Asignado') return 'Asignado (derivado)';
    if(k==='Almacén') return 'Almacén (derivado)';
    return k;
  }

  renderStatus=function(){
    const map={};
    for(const r of rows){const k=norm(r.estatus)||'Sin estatus';map[k]=(map[k]||0)+1}
    const total=rows.length;
    $('#statusGrid').innerHTML=Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([k,n])=>{
      const derived=k==='Asignado'||k==='Almacén';
      return `<div class="status"><div class="n">${n}</div><div class="l">${esc(displayStatusName(k))}</div><small>${total?(n/total*100).toFixed(1):0}% del total</small>${derived?'<div class="derived-note">Derivado del archivo original porque Estatus venía vacío.</div>':''}</div>`;
    }).join('')||'<div class="empty">Sin datos</div>';
  };

  renderAssign=function(){
    const f=assignFiltered();
    $('#aCount').textContent=`${f.length} encontrados`;
    $('#selCount').textContent=`${selected.size} seleccionados`;
    $('#atbody').innerHTML=f.slice(0,600).map(r=>`<tr>
      <td><input type="checkbox" class="pick" data-id="${r.id}" ${selected.has(r.id)?'checked':''}></td>
      <td>${esc(r.etiqueta)}</td><td>${esc(r.equipo)}</td><td>${esc([r.marca,r.modelo].filter(Boolean).join(' '))}</td><td>${esc(r.serie)}</td>
      <td>${badgeStatus(r.estatus)}</td><td>${esc(r.pdv_asignado||'—')}</td>
      <td><div style="display:flex;gap:6px"><button class="btn small reassign" data-id="${r.id}">Reasignar</button><button class="btn small correct" data-id="${r.id}">Corregir</button></div></td>
    </tr>`).join('')||'<tr><td colspan="8" class="empty">Sin resultados</td></tr>';
    $$('.pick').forEach(x=>x.onchange=()=>{x.checked?selected.add(x.dataset.id):selected.delete(x.dataset.id);renderAssign()});
    $$('.correct').forEach(x=>x.onclick=()=>correctRow(x.dataset.id));
    $$('.reassign').forEach(x=>x.onclick=()=>openReassign(x.dataset.id));
  };

  async function openReassign(id){
    if(!canWrite()) return;
    ensureUi(); await loadPdvCatalog();
    const r=rows.find(x=>x.id===id); if(!r)return;
    activeReassignId=id;
    $('#reassignSub').textContent=`Etiqueta ${r.etiqueta} · ${r.equipo}`;
    $('#reassignCurrent').innerHTML=`<b>Ubicación actual:</b> ${esc(r.pdv_asignado||'Sin ubicación')} &nbsp; · &nbsp; <b>Estatus:</b> ${esc(r.estatus||'—')}`;
    $('#reassignPdv').value=''; $('#reassignTicket').value=''; $('#reassignObs').value='';
    const statuses=[...new Set(rows.map(x=>x.estatus).filter(Boolean))].sort();
    $('#reassignStatus').innerHTML='<option value="">Conservar estatus actual</option>'+statuses.map(x=>`<option value="${esc(x)}">${esc(displayStatusName(x))}</option>`).join('');
    $('#reassignModal').classList.remove('hidden');
    setTimeout(()=>$('#reassignPdv').focus(),50);
  }

  function closeReassign(){activeReassignId=null;document.getElementById('reassignModal')?.classList.add('hidden')}

  async function saveReassign(){
    const r=rows.find(x=>x.id===activeReassignId); if(!r)return;
    const dest=$('#reassignPdv').value.trim(),ticket=$('#reassignTicket').value.trim(),status=$('#reassignStatus').value,obs=$('#reassignObs').value.trim();
    if(!dest)return alert('Indica el nuevo PDV o ubicación.');
    if(dest===norm(r.pdv_asignado)&&!status&&!ticket&&!obs)return alert('No hay cambios por guardar.');
    if(!confirm(`Reasignar ${r.etiqueta}\n\n${r.pdv_asignado||'Sin ubicación'} → ${dest}?`))return;
    if(!await autoBackup(`Antes de reasignar ${r.etiqueta}: ${r.pdv_asignado||'Sin ubicación'} → ${dest}`))return;
    const user=(await sb.auth.getUser()).data.user;
    const patch={pdv_asignado:dest,asignado:'Sí',updated_by:user.id,updated_at:new Date().toISOString()};
    if(ticket)patch.ticket_mesa_ayuda=ticket;if(status)patch.estatus=status;
    if(obs)patch.observaciones=obs;
    const q=await sb.from('adq_equipment').update(patch).eq('id',r.id);
    if(q.error)return alert(q.error.message);
    await audit('Reasignar equipo',`${r.etiqueta}: ${r.pdv_asignado||'Sin ubicación'} → ${dest}${ticket?' · Ticket '+ticket:''}`,1);
    closeReassign(); await load();
  }

  correctRow=async function(id){
    if(!canWrite())return;const r=rows.find(x=>x.id===id);if(!r)return;
    const marca=prompt('Marca',r.marca||'');if(marca===null)return;
    const modelo=prompt('Modelo',r.modelo||'');if(modelo===null)return;
    const serie=prompt('Serie',r.serie||'');if(serie===null)return;
    if(marca.trim()===norm(r.marca)&&modelo.trim()===norm(r.modelo)&&serie.trim()===norm(r.serie))return;
    if(!await autoBackup(`Antes de corregir datos del equipo ${r.etiqueta}`))return;
    const user=(await sb.auth.getUser()).data.user;
    const u=await sb.from('adq_equipment').update({marca:marca.trim(),modelo:modelo.trim(),serie:serie.trim(),updated_by:user.id,updated_at:new Date().toISOString()}).eq('id',id);
    if(u.error)return alert(u.error.message);await audit('Corregir datos',`${r.etiqueta} → Marca/Modelo/Serie`,1);await load();
  };

  applyBulk=async function(){
    if(!canWrite()||selected.size===0)return alert('Selecciona al menos un equipo.');
    const pdv=$('#bPDV').value.trim(),estatus=$('#bEstatus').value.trim(),ticket=$('#bTicket').value.trim(),obs=$('#bObs').value.trim();
    if(!pdv&&!estatus&&!ticket&&!obs)return alert('Captura al menos un cambio.');
    if(!confirm(`Aplicar cambios a ${selected.size} equipo(s)?`))return;
    if(!await autoBackup(`Antes de aplicar cambios masivos a ${selected.size} equipo(s)`))return;
    const user=(await sb.auth.getUser()).data.user,patch={updated_by:user.id,updated_at:new Date().toISOString()};
    if(pdv){patch.pdv_asignado=pdv;patch.asignado='Sí'}if(estatus)patch.estatus=estatus;if(ticket)patch.ticket_mesa_ayuda=ticket;if(obs)patch.observaciones=obs;
    const u=await sb.from('adq_equipment').update(patch).in('id',[...selected]);if(u.error)return alert(u.error.message);
    await audit('Aplicar cambios',[pdv&&`PDV=${pdv}`,estatus&&`Estatus=${estatus}`,ticket&&`Ticket=${ticket}`,obs&&'Observaciones actualizadas'].filter(Boolean).join(', '),selected.size);
    selected.clear();$('#bPDV').value=$('#bEstatus').value=$('#bTicket').value=$('#bObs').value='';await load();
  };

  mergeStatus=async function(){
    if(!canWrite())return;const from=$('#mFrom').value.trim(),to=$('#mTo').value.trim();
    if(!from||!to||from===to)return alert('Indica dos valores distintos.');const n=rows.filter(r=>r.estatus===from).length;if(!n)return alert('No hay equipos con ese estatus.');
    if(!confirm(`Cambiar ${n} equipo(s) de “${from}” a “${to}”?`))return;
    if(!await autoBackup(`Antes de fusionar estatus “${from}” → “${to}”`))return;
    const user=(await sb.auth.getUser()).data.user;const u=await sb.from('adq_equipment').update({estatus:to,updated_by:user.id,updated_at:new Date().toISOString()}).eq('report_id',REPORT_ID).eq('estatus',from);
    if(u.error)return alert(u.error.message);await audit('Fusionar Estatus',`“${from}” → “${to}”`,n);await load();
  };

  const originalUploadXlsx=uploadXlsx;
  uploadXlsx=async function(file){
    if(rows.length&&!await autoBackup(`Antes de cargar archivo ${file?.name||'Excel'}`))return;
    return originalUploadXlsx(file);
  };

  const originalImportBackup=importBackup;
  importBackup=async function(file){
    if(rows.length&&!await autoBackup(`Antes de reimportar respaldo ${file?.name||''}`))return;
    return originalImportBackup(file);
  };

  const timer=setInterval(()=>{
    if(typeof profile!=='undefined'&&profile){
      clearInterval(timer);ensureUi();renderStatus();renderAssign();
    }
  },150);
})();
