// --- PRIME MX Portal SSO + MFA AAL2 + permiso exclusivo DASH_EQUIPOS ---
const DASH_PROJECT = 'ydeusddtqsstqehqhkgi';
const DASH_SB_URL = 'https://' + DASH_PROJECT + '.supabase.co';
const DASH_SB_KEY = 'sb_publishable_3g_w_Iw4bLHE76c073jlQw_YFXMlljK';
const DASH_AUTH_KEY = 'sb-' + DASH_PROJECT + '-auth-token';
const DASH_MODULE = 'DASH_EQUIPOS';
const dashSb = window.supabase.createClient(DASH_SB_URL, DASH_SB_KEY, {
  auth: { storageKey: DASH_AUTH_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
window.PRIME_DASH_SB = dashSb;
let dashUser = null;
let dashProfile = null;

function gateMessage(text, bad=false){
  const el = document.getElementById('portalGateMsg');
  if(!el) return;
  el.textContent = text;
  el.style.color = bad ? '#a12f3d' : '#5d6a65';
}

function showApp(){
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('siteContent').style.display = 'block';
}

function showEmptyState(title, body){
  document.getElementById('app').style.display = 'none';
  document.getElementById('empty').style.display = 'block';
  document.getElementById('emptyTitle').textContent = title;
  if(body) document.getElementById('emptyBody').innerHTML = body;
}

function formatMetaLine(meta){
  if(!meta) return '';
  const fecha = new Date(meta.uploadedAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  const who = meta.uploadedBy || 'usuario autorizado';
  return `Último reporte: "${meta.filename}" · ${Number(meta.rowCount||0).toLocaleString('es-MX')} registros · actualizado por ${who} el ${fecha}`;
}

function showReportMetaBar(meta){
  const bar = document.getElementById('reportMetaBar');
  if(!bar) return;
  if(!meta){ bar.style.display = 'none'; return; }
  bar.textContent = formatMetaLine(meta);
  bar.style.display = 'block';
}

async function loadReportFromBackend(){
  showEmptyState('Buscando el último reporte guardado...', '');
  try{
    const r = await dashSb.from('dash_equipos_reports')
      .select('filename,sheet_name,row_count,payload,updated_at')
      .eq('id','latest')
      .maybeSingle();
    if(r.error) throw r.error;
    if(!r.data){
      showEmptyState('Carga un reporte para empezar','Sube el Excel con la pestaña "Consolidado" o un CSV equivalente. El último reporte quedará guardado de forma central en PRIME MX.');
      return;
    }
    rawRows = Array.isArray(r.data.payload) ? r.data.payload : [];
    document.getElementById('empty').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('fileStatus').textContent = (r.data.filename || 'Reporte') + ' · ' + Number(r.data.row_count || rawRows.length).toLocaleString('es-MX') + ' registros';
    showReportMetaBar({
      filename: r.data.filename || 'Reporte',
      rowCount: Number(r.data.row_count || rawRows.length),
      uploadedBy: dashProfile?.nombre || dashProfile?.email || 'PRIME MX',
      uploadedAt: r.data.updated_at
    });
    render(rawRows);
  }catch(err){
    console.error('PRIME Dashboard load', err);
    showEmptyState('No se pudo cargar el reporte central','Puedes recargar la página. Si el problema continúa, vuelve al Portal PRIME MX.');
  }
}

async function saveReportToBackend(rows, filename, sheetName){
  if(!dashUser?.id){
    document.getElementById('fileStatus').textContent = filename + ' · ' + rows.length.toLocaleString('es-MX') + ' registros (sesión PRIME MX no disponible)';
    return;
  }
  try{
    const now = new Date().toISOString();
    const r = await dashSb.from('dash_equipos_reports').upsert({
      id: 'latest', filename, sheet_name: sheetName, row_count: rows.length,
      payload: rows, updated_by: dashUser.id, updated_at: now
    }, { onConflict: 'id' });
    if(r.error) throw r.error;
    document.getElementById('fileStatus').textContent = filename + ' · ' + rows.length.toLocaleString('es-MX') + ' registros · guardado en PRIME MX';
    showReportMetaBar({filename,rowCount:rows.length,uploadedBy:dashProfile?.nombre || dashProfile?.email || dashUser.email || 'PRIME MX',uploadedAt:now});
  }catch(err){
    console.error('PRIME Dashboard save', err);
    document.getElementById('fileStatus').textContent = filename + ' · ' + rows.length.toLocaleString('es-MX') + ' registros (no se pudo guardar en PRIME MX: ' + (err.message || err) + ')';
  }
}

async function initPortalDashboard(){
  try{
    gateMessage('Validando sesión PRIME MX…');
    const s = await dashSb.auth.getSession();
    if(!s.data?.session){ location.replace('../'); return; }
    const u = await dashSb.auth.getUser();
    if(u.error || !u.data?.user){ location.replace('../'); return; }
    dashUser = u.data.user;

    const aal = await dashSb.auth.mfa.getAuthenticatorAssuranceLevel();
    if(aal.error || aal.data?.currentLevel !== 'aal2'){ location.replace('../'); return; }

    gateMessage('Validando permiso exclusivo…');
    const mod = await dashSb.from('app_modules').select('code,nombre,activo').eq('code', DASH_MODULE).eq('activo', true).maybeSingle();
    if(mod.error) throw mod.error;
    if(!mod.data){
      gateMessage('Tu cuenta no tiene permiso para Dashboard Equipos.', true);
      setTimeout(() => location.replace('../'), 1400);
      return;
    }

    const p = await dashSb.from('profiles').select('nombre,email,role,activo').eq('user_id', dashUser.id).maybeSingle();
    if(p.error) throw p.error;
    if(!p.data?.activo){ gateMessage('Tu cuenta PRIME MX está inactiva.', true); return; }
    dashProfile = p.data;

    showApp();
    await loadReportFromBackend();
  }catch(err){
    console.error('PRIME Dashboard auth', err);
    gateMessage('No fue posible validar el acceso. Regresando al Portal…', true);
    setTimeout(() => location.replace('../'), 1600);
  }
}

window.addEventListener('load', initPortalDashboard);

document.getElementById('logoutBtn')?.addEventListener('click', async ()=>{
  await dashSb.auth.signOut({scope:'local'}).catch(()=>{});
  location.replace('../');
});
