const ITEMS=[
{text:'Antivirus activo y actualizado',csv:'Antivirus',group:'Seguridad y cumplimiento'},
{text:'Agente KACE activo y comunicando',csv:'KACE',group:'Seguridad y cumplimiento'},
{text:'Cifrado de disco habilitado',csv:'Cifrado',group:'Seguridad y cumplimiento'},
{text:'Bloqueo automático de equipo',csv:'Bloqueo de equipo',group:'Seguridad y cumplimiento'},
{text:'Cuenta estándar y cuenta administrativa correctas',csv:'Cuentas locales',group:'Seguridad y cumplimiento'},
{text:'Remover cuentas de correo no autorizadas',csv:'Cuentas de correo',group:'Limpieza de cuentas y perfiles'},
{text:'Edge y Chrome sin perfiles personales',csv:'Perfiles navegador',group:'Limpieza de cuentas y perfiles'},
{text:'Office sin cuentas personales',csv:'Cuentas Office',group:'Limpieza de cuentas y perfiles'},
{text:'Zimbra configurado correctamente',csv:'Zimbra',group:'Limpieza de cuentas y perfiles'},
{text:'Tarea de control y limpieza de PDF activa',csv:'Tarea PDF',group:'Documentos y tareas'},
{text:'Sin archivos PDF sensibles fuera de ruta controlada',csv:'PDF sensibles',group:'Documentos y tareas'},
{text:'Sin archivos INE expuestos',csv:'Archivos INE',group:'Documentos y tareas'},
{text:'QUIC deshabilitado en navegadores',csv:'QUIC',group:'Documentos y tareas'},
{text:'OneDrive, Teams y programas obsoletos removidos',csv:'Software no autorizado',group:'Documentos y tareas'}];
const SCRIPTS=['PrimeMX_PII_Guard_v4.1.5_R4_KACE','Deshabilitar_Quic_Navegadores','KILLTEAMS','Bloqueo_cuentas_personales_office','Block_Ext_Edge_chrome_v2','Bloqueo_cuentas_personales_Teams','Rutina_temporales_historial_v2.2'];
const OWNERS=['Luis Alzaga Hernández','Ariadna Sánchez Ramírez','Daniel Aguilar Solis','Eder Ernesto Castillo Colin'];
const PROJECT='ydeusddtqsstqehqhkgi',SB_URL='https://'+PROJECT+'.supabase.co',SB_KEY='sb_publishable_3g_w_Iw4bLHE76c073jlQw_YFXMlljK',AUTH_KEY='sb-'+PROJECT+'-auth-token';
const sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{storageKey:AUTH_KEY,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let user=null,profile=null,role='CONSULTA',canWrite=false,stores=[],temps=[],audits=new Map(),currentKey='',saveTimer=null;
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function today(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),2200)}
function initials(n){return String(n||'IT').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()}
function normRegion(v){return String(v||'').replace(/\s+1$/,' I').replace(/\s+2$/,' II')}
function newMachine(id){return {id:id||crypto.randomUUID(),hostname:'',type:'Desktop',anydesk:'',states:{},notes:{},evidence:null}}
function defaultOwner(){const n=profile?.nombre||'';return OWNERS.includes(n)?n:'Luis Alzaga Hernández'}
function newAudit(p){return {id:crypto.randomUUID(),pdvId:p.pdvId||null,tempPdvId:p.tempPdvId||null,pdvName:p.name,pdvKey:p.key,region:p.region||'',owner:defaultOwner(),date:today(),expected:'',observation:'',scripts:{},machines:[newMachine()],status:'progress',progress:0,compliance:0,findingsOpen:0,findingsFixed:0,closedAt:null,createdAt:null,updatedAt:null,isNew:true}}
function auditMetrics(a){if(!a)return {progress:0,compliance:0,completeMachines:0,unanswered:0,fails:0,fixed:0,total:0};let total=a.machines.length*ITEMS.length,answered=0,ok=0,fail=0,fixed=0,na=0,completeMachines=0;a.machines.forEach(m=>{let done=0;ITEMS.forEach((_,i)=>{const s=m.states['i'+i];if(s){answered++;done++}if(s==='ok')ok++;else if(s==='fail')fail++;else if(s==='fixed')fixed++;else if(s==='na')na++});if(done===ITEMS.length)completeMachines++});const expected=parseInt(a.expected)||0,checklistPct=total?Math.round(answered/total*100):0,equipmentPct=expected?Math.min(100,Math.round(completeMachines/expected*100)):checklistPct,progress=Math.round((checklistPct+equipmentPct)/2),applicable=total-na,compliance=applicable?Math.round((ok+fixed)/applicable*100):0;return {progress,compliance,completeMachines,unanswered:total-answered,fails:fail,fixed,total}}