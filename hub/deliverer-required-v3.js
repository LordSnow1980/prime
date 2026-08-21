// PRIME MX HUB · Nombre de quien entrega obligatorio v3
(function(){
  'use strict';
  const originalAuth=auth;
  auth=async function(){
    const ok=await originalAuth();
    if(ok) draft.deliverer='';
    return ok;
  };

  resetDraft=function(){
    draft={step:1,store:null,hub:null,equipment:[],deliverer:''};
    renderWizard();
  };

  renderConfirm=function(){
    $('#confirm').innerHTML=`<div class="summary"><div class="box"><b>Tienda</b><span>${esc(draft.store?.name)}</span></div><div class="box"><b>Clave PDV</b><span>${esc(draft.store?.key)}</span></div><div class="box"><b>HUB destino</b><span>${esc(draft.hub?.name)}</span></div><div class="box"><b>Responsable HUB</b><span>${esc(draft.hub?.owner||'—')}</span></div></div><div class="field"><label>Nombre de la persona que entrega el equipo *</label><input id="deliverer" class="inp" value="${esc(draft.deliverer||'')}" placeholder="Nombre completo de quien entrega" autocomplete="name" oninput="draft.deliverer=this.value" required><div style="font-size:11px;color:var(--muted);margin-top:6px">Este nombre quedará registrado en el folio y aparecerá en la carta de entrega.</div></div><div class="table-wrap"><table><thead><tr><th>#</th><th>Tipo</th><th>Serie</th><th>Condición</th><th>Foto</th></tr></thead><tbody>${draft.equipment.map((e,i)=>`<tr><td>${i+1}</td><td>${esc(e.type)}</td><td>${esc(e.serial)}</td><td>${esc(e.condition)}</td><td>${e.photo?'✓':'—'}</td></tr>`).join('')}</tbody></table></div>`;
    setTimeout(()=>$('#deliverer')?.focus(),40);
  };
})();
