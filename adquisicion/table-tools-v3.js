// PRIME MX · Adquisición — filtros, orden y exportación Excel de la vista actual.
(function(){
  let reportSort={key:'etiqueta',dir:1};
  let assignSort={key:'etiqueta',dir:1};

  const val=(r,key)=>{
    switch(key){
      case 'marcaModelo': return `${norm(r.marca)} ${norm(r.modelo)}`.trim();
      case 'pdv': return norm(r.pdv_asignado);
      case 'ticket': return norm(r.ticket_mesa_ayuda);
      default:return norm(r[key]);
    }
  };
  const cmp=(a,b,key)=>{
    const av=val(a,key),bv=val(b,key);
    const an=Number(av),bn=Number(bv);
    if(av!==''&&bv!==''&&!Number.isNaN(an)&&!Number.isNaN(bn))return an-bn;
    return av.localeCompare(bv,'es',{numeric:true,sensitivity:'base'});
  };
  const sortRows=(arr,state)=>[...arr].sort((a,b)=>cmp(a,b,state.key)*state.dir);

  function fill(id,values,label){
    const el=document.getElementById(id); if(!el)return;
    const cur=el.value;
    const opts=[...new Set(values.map(norm).filter(x=>x&&x!=='0'))].sort((a,b)=>a.localeCompare(b,'es',{numeric:true,sensitivity:'base'}));
    el.innerHTML=`<option value="">${label}: todos</option>`+opts.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
    if(opts.includes(cur))el.value=cur;
  }

  function ensureReportFilters(){
    const bar=document.querySelector('#s-reporte .filters'); if(!bar)return;
    const search=document.getElementById('q');
    if(!document.getElementById('fAsignado')){
      const s=document.createElement('select');s.id='fAsignado';bar.insertBefore(s,search);
    }
    if(!document.getElementById('fPDV')){
      const s=document.createElement('select');s.id='fPDV';bar.insertBefore(s,search);
    }
    if(!document.getElementById('clearReportFilters')){
      const b=document.createElement('button');b.id='clearReportFilters';b.className='btn filter-clear';b.textContent='Limpiar';
      b.onclick=()=>{['fEquipo','fMarca','fEstatus','fAsignado','fPDV'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});if(search)search.value='';renderTable()};
      bar.appendChild(b);
    }
    const exp=document.getElementById('exportBtn');if(exp){exp.textContent='⇩ Exportar Excel';exp.classList.add('export-xlsx')}
  }

  function ensureAssignFilters(){
    const bar=document.querySelector('#s-asignar .filters'); if(!bar)return;
    const search=document.getElementById('aq');
    if(!document.getElementById('aEquipoFilter')){const s=document.createElement('select');s.id='aEquipoFilter';bar.insertBefore(s,bar.firstChild)}
    if(!document.getElementById('aMarcaFilter')){const s=document.createElement('select');s.id='aMarcaFilter';bar.insertBefore(s,search)}
    if(!document.getElementById('aPDVFilter')){const s=document.createElement('select');s.id='aPDVFilter';bar.insertBefore(s,search)}
    if(!document.getElementById('aExportBtn')){
      const b=document.createElement('button');b.id='aExportBtn';b.className='btn export-xlsx';b.textContent='⇩ Exportar Excel';b.onclick=exportAssignView;bar.appendChild(b);
    }
    if(!document.getElementById('clearAssignFilters')){
      const b=document.createElement('button');b.id='clearAssignFilters';b.className='btn filter-clear';b.textContent='Limpiar';
      b.onclick=()=>{['aEquipoFilter','aMarcaFilter','aEstatusFilter','aPDVFilter'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});if(search)search.value='';renderAssign()};bar.appendChild(b);
    }
  }

  function ensureSortHeaders(){
    const report=document.querySelectorAll('#s-reporte table thead th');
    const reportKeys=['etiqueta','equipo','marcaModelo','serie','estatus','asignado','pdv','ticket'];
    report.forEach((th,i)=>{if(!reportKeys[i])return;th.classList.add('sortable');th.dataset.sort=reportKeys[i];th.onclick=()=>{const k=th.dataset.sort;if(reportSort.key===k)reportSort.dir*=-1;else reportSort={key:k,dir:1};renderTable()}});
    const assign=document.querySelectorAll('#s-asignar table thead th');
    const assignKeys=[null,'etiqueta','equipo','marcaModelo','serie','estatus','pdv',null];
    assign.forEach((th,i)=>{if(!assignKeys[i])return;th.classList.add('sortable');th.dataset.sort=assignKeys[i];th.onclick=()=>{const k=th.dataset.sort;if(assignSort.key===k)assignSort.dir*=-1;else assignSort={key:k,dir:1};renderAssign()}});
  }

  function paintSort(scope,state){
    document.querySelectorAll(`${scope} th.sortable`).forEach(th=>{
      th.classList.toggle('sort-on',th.dataset.sort===state.key);
      const old=th.querySelector('.sortmark');if(old)old.remove();
      const m=document.createElement('span');m.className='sortmark';m.textContent=th.dataset.sort===state.key?(state.dir===1?'▲':'▼'):'↕';th.appendChild(m);
    });
  }

  populateFilters=function(){
    ensureReportFilters();ensureAssignFilters();
    fill('fEquipo',rows.map(r=>r.equipo),'Equipo');
    fill('fMarca',rows.map(r=>r.marca),'Marca');
    fill('fEstatus',rows.map(r=>r.estatus),'Estatus');
    fill('fAsignado',rows.map(r=>r.asignado),'Asignado');
    fill('fPDV',rows.map(r=>r.pdv_asignado),'PDV');
    fill('aEquipoFilter',rows.map(r=>r.equipo),'Equipo');
    fill('aMarcaFilter',rows.map(r=>r.marca),'Marca');
    fill('aEstatusFilter',rows.map(r=>r.estatus),'Estatus');
    fill('aPDVFilter',rows.map(r=>r.pdv_asignado),'PDV');
    ['fEquipo','fMarca','fEstatus','fAsignado','fPDV','aEquipoFilter','aMarcaFilter','aEstatusFilter','aPDVFilter'].forEach(id=>{const e=document.getElementById(id);if(e&&!e.dataset.bound){e.dataset.bound='1';e.addEventListener('change',()=>id.startsWith('a')?renderAssign():renderTable())}});
  };

  filtered=function(){
    const q=norm(document.getElementById('q')?.value).toLowerCase();
    const eq=document.getElementById('fEquipo')?.value||'',ma=document.getElementById('fMarca')?.value||'',es=document.getElementById('fEstatus')?.value||'',as=document.getElementById('fAsignado')?.value||'',pdv=document.getElementById('fPDV')?.value||'';
    const out=rows.filter(r=>(!eq||r.equipo===eq)&&(!ma||r.marca===ma)&&(!es||r.estatus===es)&&(!as||r.asignado===as)&&(!pdv||r.pdv_asignado===pdv)&&(!q||[r.etiqueta,r.equipo,r.marca,r.modelo,r.serie,r.estatus,r.asignado,r.pdv_asignado,r.ticket_mesa_ayuda].some(v=>norm(v).toLowerCase().includes(q))));
    return sortRows(out,reportSort);
  };

  assignFiltered=function(){
    const q=norm(document.getElementById('aq')?.value).toLowerCase();
    const eq=document.getElementById('aEquipoFilter')?.value||'',ma=document.getElementById('aMarcaFilter')?.value||'',es=document.getElementById('aEstatusFilter')?.value||'',pdv=document.getElementById('aPDVFilter')?.value||'';
    const out=rows.filter(r=>(!eq||r.equipo===eq)&&(!ma||r.marca===ma)&&(!es||r.estatus===es)&&(!pdv||r.pdv_asignado===pdv)&&(!q||[r.etiqueta,r.equipo,r.marca,r.modelo,r.serie,r.estatus,r.pdv_asignado].some(v=>norm(v).toLowerCase().includes(q))));
    return sortRows(out,assignSort);
  };

  const baseRenderTable=renderTable;
  renderTable=function(){baseRenderTable();ensureSortHeaders();paintSort('#s-reporte',reportSort)};
  const baseRenderAssign=renderAssign;
  renderAssign=function(){baseRenderAssign();ensureSortHeaders();paintSort('#s-asignar',assignSort)};

  function xlsxRows(list){return list.map(r=>({
    Etiqueta:r.etiqueta||'',Equipo:r.equipo||'',Marca:r.marca||'',Modelo:r.modelo||'',Serie:r.serie||'',Estatus:r.estatus||'',Asignado:r.asignado||'',PDV:r.pdv_asignado||'',Ticket:r.ticket_mesa_ayuda||'',Observaciones:r.observaciones||''
  }))}
  function downloadXlsx(list,name){
    if(!list.length)return alert('La lista actual está vacía.');
    const wb=XLSX.utils.book_new(),ws=XLSX.utils.json_to_sheet(xlsxRows(list));
    ws['!cols']=[{wch:12},{wch:14},{wch:14},{wch:28},{wch:20},{wch:20},{wch:12},{wch:34},{wch:18},{wch:45}];
    XLSX.utils.book_append_sheet(wb,ws,'Equipos');
    XLSX.writeFile(wb,`${name}_${new Date().toISOString().slice(0,10)}.xlsx`);
  }
  exportCsv=function(){downloadXlsx(filtered(),'PrimeMX_Adquisicion_Lista')};
  function exportAssignView(){downloadXlsx(assignFiltered(),'PrimeMX_Adquisicion_Asignacion')}

  const timer=setInterval(()=>{
    if(typeof profile!=='undefined'&&profile){clearInterval(timer);ensureReportFilters();ensureAssignFilters();ensureSortHeaders();populateFilters();renderTable();renderAssign();}
  },150);
})();
