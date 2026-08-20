importBackup=async function(file){
  if(profile.role!=='ADMIN') throw new Error('La migración inicial solo puede ejecutarla ADMIN.');
  const txt=await file.text(), b=JSON.parse(txt);
  if(b.kind!=='PrimeMX_Adquisicion_Backup'||b.reportId!==REPORT_ID) throw new Error('El archivo no corresponde al respaldo de Adquisición 2026.');
  const legacyRows=b.report?.rows;
  if(!Array.isArray(legacyRows)||!legacyRows.length) throw new Error('El respaldo no contiene filas.');

  // La posición original de cada fila es la llave de migración.
  // No usamos Etiqueta como llave porque el archivo legado puede contener etiquetas repetidas.
  const parsed=legacyRows.map((r,i)=>({
    ...equipmentFromLegacy(r),
    legacy_row_index:i
  }));
  const meta=b.report?.meta||{};
  const entries=Array.isArray(b.audit?.entries)?b.audit.entries:[];
  $('#impInfo').textContent=`Validado: ${parsed.length} filas · ${entries.length} movimientos. Importando…`;
  $('#impBar').style.width='5%';
  const user=(await sb.auth.getUser()).data.user;

  let q=await sb.from('adq_reports').upsert({
    report_id:REPORT_ID,
    filename:meta.filename||'Respaldo legado',
    sheet_name:meta.sheetName||'BD Homologada',
    row_count:parsed.length,
    source_uploaded_by:meta.uploadedBy||null,
    source_uploaded_at:adqLegacyIso(meta.uploadedAt),
    imported_from_legacy:true,
    updated_by:user.id,
    updated_at:new Date().toISOString()
  },{onConflict:'report_id'});
  if(q.error) throw q.error;

  for(let i=0;i<parsed.length;i+=100){
    const chunk=parsed.slice(i,i+100).map(r=>({...r,updated_by:user.id}));
    q=await sb.from('adq_equipment').upsert(chunk,{onConflict:'report_id,legacy_row_index'});
    if(q.error) throw q.error;
    $('#impBar').style.width=(10+70*Math.min(1,(i+chunk.length)/parsed.length))+'%';
  }

  for(let i=0;i<entries.length;i+=100){
    const chunk=entries.slice(i,i+100).map((e,j)=>({
      report_id:REPORT_ID,
      action:norm(e.action)||'Movimiento legado',
      details:norm(e.details),
      affected_count:Number.isFinite(Number(e.count))?Number(e.count):null,
      source_user:norm(e.user),
      source_timestamp:adqLegacyIso(e.timestamp),
      legacy_index:i+j,
      legacy_payload:e
    }));
    q=await sb.from('adq_audit_events').upsert(chunk,{onConflict:'report_id,legacy_index'});
    if(q.error) throw q.error;
    $('#impBar').style.width=(80+15*Math.min(1,(i+chunk.length)/Math.max(1,entries.length)))+'%';
  }

  const existing=await sb.from('adq_audit_events').select('id',{count:'exact',head:true}).eq('report_id',REPORT_ID).eq('action','Migración central inicial');
  if(!existing.count) await audit('Migración central inicial',`Respaldo importado: ${parsed.length} filas · ${entries.length} movimientos`,parsed.length);

  const [checkRows,checkHist]=await Promise.all([
    sb.from('adq_equipment').select('id',{count:'exact',head:true}).eq('report_id',REPORT_ID),
    sb.from('adq_audit_events').select('id',{count:'exact',head:true}).eq('report_id',REPORT_ID).not('legacy_index','is',null)
  ]);
  if(checkRows.error||checkRows.count!==parsed.length) throw new Error(`Verificación de filas falló: se esperaban ${parsed.length} y hay ${checkRows.count??'?'}.`);
  if(checkHist.error||checkHist.count!==entries.length) throw new Error(`Verificación de historial falló: se esperaban ${entries.length} y hay ${checkHist.count??'?'}.`);

  $('#impBar').style.width='100%';
  $('#impInfo').textContent=`IMPORTACIÓN OK ✓ ${checkRows.count} filas y ${checkHist.count} movimientos preservados.`;
  setTimeout(load,900);
};