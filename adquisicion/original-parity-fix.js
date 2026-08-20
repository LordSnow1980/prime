// Paridad funcional con la aplicación original de Adquisición 2026.
// Mantiene exactamente sus reglas para Estatus derivado y KPI Asignados.

equipmentFromLegacy = function(r){
  const er=norm(gf(r,'Equipo')).toLowerCase();
  const equipo=er.includes('laptop')
    ? 'Laptop'
    : (er.includes('pc')||er.includes('escritorio')||er.includes('cpu')
        ? 'CPU'
        : norm(gf(r,'Equipo'))||'Sin clasificar');

  const estatusLiteral=norm(gf(r,'Estatus','Status'));
  const estatusValido=estatusLiteral && estatusLiteral!=='0';
  const pdvAsignado=norm(gf(r,'PDV Asignado'));
  const almacenCampo=norm(gf(r,'Almacén','Almacen','Alamacen'));

  let estatus;
  if(estatusValido) estatus=estatusLiteral;
  else if(pdvAsignado) estatus='Asignado';
  else if(almacenCampo) estatus='Almacén';
  else estatus='Sin estatus capturado';

  const asignadoRaw=norm(gf(r,'Asignado')).toLowerCase();
  let asignado;
  if(asignadoRaw==='si'||asignadoRaw==='sí') asignado='Sí';
  else if(asignadoRaw==='no') asignado='No';
  else asignado='Sin dato';

  return {
    report_id:REPORT_ID,
    etiqueta:norm(gf(r,'Etiqueta')),
    equipo,
    marca:norm(gf(r,'Marca')),
    modelo:norm(gf(r,'Modelo')),
    serie:norm(gf(r,'Serie')),
    estatus,
    asignado,
    pdv_asignado:pdvAsignado,
    ticket_mesa_ayuda:norm(gf(r,'Ticket Mesa de ayuda')),
    observaciones:norm(gf(r,'Observaciones')),
    raw_row:r
  };
};

renderAll = function(){
  const total=rows.length;
  const cpu=rows.filter(r=>r.equipo==='CPU').length;
  const lap=rows.filter(r=>r.equipo==='Laptop').length;
  // Igual que la app original: solo la columna real Asignado = Sí.
  const assigned=rows.filter(r=>/^s[ií]$/i.test(norm(r.asignado))).length;

  $('#kTotal').textContent=total.toLocaleString('es-MX');
  $('#kCPU').textContent=cpu.toLocaleString('es-MX');
  $('#kLap').textContent=lap.toLocaleString('es-MX');
  $('#kAss').textContent=assigned.toLocaleString('es-MX');
  $('#navCount').textContent=total;
  renderStatus();
  populateFilters();
  renderTable();
  renderAssign();
  loadHistory();
};
