// PRIME MX Portal · Auth + recuperación de contraseña v6.1
(function(){
  'use strict';
  const PROJECT='ydeusddtqsstqehqhkgi';
  const SUPABASE_URL='https://'+PROJECT+'.supabase.co';
  const SUPABASE_KEY='sb_publishable_3g_w_Iw4bLHE76c073jlQw_YFXMlljK';
  const AUTH_KEY='sb-'+PROJECT+'-auth-token';
  const ROUTES={BIOMETRICOS:'./biometricos/',HUB:'./hub/',ADQUISICION:'./adquisicion/',AUDITORIA_IT:'./auditoria/'};
  const INFO={BIOMETRICOS:{short:'BIO',title:'Biométricos y Pinpads',desc:'Inventario, asignaciones, entregas y comprobantes.',chips:['Inventario','Comprobantes'],ico:'◎'},HUB:{short:'HUB',title:'Recolección HUB',desc:'Recolección de equipos, evidencias privadas e historial.',chips:['Evidencias','Carta'],ico:'↥'},ADQUISICION:{short:'ADQ',title:'Adquisición',desc:'Control de activos, reasignaciones, respaldos y Excel.',chips:['Respaldo','Excel'],ico:'▦'},AUDITORIA_IT:{short:'AUD',title:'Auditoría IT',desc:'Auditorías, universo de PDV, hallazgos y evidencias.',chips:['Checklist','Región'],ico:'✓'},WHATSAPP_FALLAS:{short:'NOC',title:'Monitoreo WhatsApp / Fallas',desc:'Fallas, folios y operación por WhatsApp.',chips:['Fallas','Folios'],ico:'◔'}};
  const ORDER=['ADQUISICION','AUDITORIA_IT','BIOMETRICOS','HUB','WHATSAPP_FALLAS'];
  const AUTH_TIMEOUT=12000, QUERY_TIMEOUT=10000;
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const withTimeout=(promise,ms,label)=>Promise.race([promise,new Promise((_,rej)=>setTimeout(()=>rej(new Error(label)),ms))]);
  let recoveryMode=/([#?&])type=recovery(?:&|$)/i.test(location.hash+location.search);

  function setMsg(text,isError){const el=$('#msg');if(!el)return;el.textContent=text||'';el.className='msg'+(isError?' err':'');}
  function setRecoveryMsg(text,isError){const el=$('#recoveryMsg');if(!el)return;el.textContent=text||'';el.className='msg'+(isError?' err':'');}
  function setBusy(on){const b=$('#loginBtn');if(b)b.disabled=!!on;const f=$('#forgotBtn');if(f)f.disabled=!!on;}
  function showApp(){$('#gate')?.classList.add('hidden');$('#app')?.classList.remove('hidden');}
  function showLogin(){recoveryMode=false;$('#recoveryForm')?.classList.add('hidden');$('#loginForm')?.classList.remove('hidden');$('#gate')?.classList.remove('hidden');$('#app')?.classList.add('hidden');}

  function ensureRecoveryForm(){
    let form=$('#recoveryForm');
    if(form)return form;
    const login=$('#loginForm');
    if(!login)return null;
    form=document.createElement('form');
    form.id='recoveryForm';form.className='login hidden';
    form.innerHTML='<img class="logo" alt="PRIME MX" src="./assets/primemx-dark.svg"><div class="eyebrow">Recuperación segura</div><h1>Nueva contraseña</h1><p>Captura y confirma tu nueva contraseña para el Portal PRIME MX.</p><div class="field"><label>Nueva contraseña</label><input id="newPass" class="inp" type="password" minlength="8" autocomplete="new-password" required></div><div class="field"><label>Confirmar contraseña</label><input id="newPass2" class="inp" type="password" minlength="8" autocomplete="new-password" required></div><div class="actions"><button id="updatePassBtn" class="btn primary" type="submit">Guardar contraseña</button><button id="cancelRecovery" class="btn" type="button">Cancelar</button></div><div id="recoveryMsg" class="msg">Elige una contraseña nueva de al menos 8 caracteres.</div>';
    login.insertAdjacentElement('afterend',form);
    form.onsubmit=async e=>{e.preventDefault();await saveNewPassword();};
    form.querySelector('#cancelRecovery').onclick=async()=>{await client.auth.signOut({scope:'local'}).catch(()=>{});history.replaceState(null,'',location.pathname);showLogin();};
    return form;
  }

  function showRecovery(){recoveryMode=true;ensureRecoveryForm();$('#loginForm')?.classList.add('hidden');$('#recoveryForm')?.classList.remove('hidden');$('#gate')?.classList.remove('hidden');$('#app')?.classList.add('hidden');setRecoveryMsg('Elige una contraseña nueva de al menos 8 caracteres.');setTimeout(()=>$('#newPass')?.focus(),50);}

  if(!window.supabase?.createClient){setMsg('No se pudo cargar el motor de acceso. Recarga la página.',true);return;}
  const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{storageKey:AUTH_KEY,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  window.PRIME_PORTAL_SB=client;

  client.auth.onAuthStateChange((event,_session)=>{if(event==='PASSWORD_RECOVERY')showRecovery();});

  function renderPortal(mods){
    const list=ORDER.map(code=>mods.find(m=>m.code===code)).filter(Boolean).map(m=>{const d=INFO[m.code]||{short:m.code,title:m.nombre||m.code,desc:'Módulo PRIME MX',chips:[],ico:'•'};return {...d,code:m.code,route:ROUTES[m.code]||''};});
    const active=list.filter(x=>x.route),pending=list.filter(x=>!x.route);
    $('#mActive').textContent=active.length;$('#mPending').textContent=pending.length;
    $('#navActive').innerHTML=active.map(x=>'<a href="'+x.route+'"><span class="ico">'+esc(x.ico)+'</span><span>'+esc(x.title)+'</span><span class="tag">OK</span></a>').join('');
    $('#navPending').innerHTML=pending.length?pending.map(x=>'<div class="pending"><span class="ico">'+esc(x.ico)+'</span><span>'+esc(x.title)+'</span><span class="tag">…</span></div>').join(''):'<div class="pending"><span class="ico">•</span><span>Sin pendientes</span><span class="tag">0</span></div>';
    $('#modules').innerHTML=active.map(x=>'<article class="card"><div class="cardTop"><div class="modIcon">'+esc(x.short)+'</div><div class="state">Módulo activo</div></div><h4>'+esc(x.title)+'</h4><p>'+esc(x.desc)+'</p><div class="chips">'+(x.chips||[]).map(c=>'<span class="chip">'+esc(c)+'</span>').join('')+'</div><div class="foot"><span class="code">'+esc(x.code)+'</span><a class="open" href="'+x.route+'">Abrir módulo →</a></div></article>').join('');
    if(pending.length){$('#pendingWrap').classList.remove('hidden');$('#pendingCards').innerHTML=pending.map(x=>'<div class="pendingCard"><b>'+esc(x.title)+'</b><span>'+esc(x.desc)+'</span></div>').join('');}else $('#pendingWrap').classList.add('hidden');
  }

  async function enter(user){
    try{
      if(!user?.id)throw new Error('Sesión inválida.');
      setMsg('Validando perfil…');
      const p=await withTimeout(client.from('profiles').select('email,nombre,role,activo').eq('user_id',user.id).maybeSingle(),QUERY_TIMEOUT,'PROFILE_TIMEOUT');
      if(p.error)throw p.error;
      if(!p.data||!p.data.activo){await client.auth.signOut({scope:'local'}).catch(()=>{});throw new Error('Tu correo no está autorizado o está inactivo.');}
      setMsg('Cargando módulos…');
      const mods=await withTimeout(client.from('app_modules').select('code,nombre,activo').eq('activo',true).order('nombre'),QUERY_TIMEOUT,'MODULES_TIMEOUT');
      if(mods.error)throw mods.error;
      $('#userName').textContent=p.data.nombre||p.data.email||user.email||'';$('#userRole').textContent=p.data.role||'';
      renderPortal(mods.data||[]);showApp();setMsg('Acceso correcto.');return true;
    }catch(err){
      console.error('PRIME Portal enter',err);const m=String(err?.message||err||'No se pudo completar el acceso.');
      if(m.includes('PROFILE_TIMEOUT'))setMsg('La sesión inició, pero el perfil tardó demasiado.',true);else if(m.includes('MODULES_TIMEOUT'))setMsg('La sesión inició, pero los módulos tardaron demasiado.',true);else setMsg(m,true);return false;
    }finally{setBusy(false);}
  }

  async function login(email,password){
    setBusy(true);setMsg('Autenticando…');
    try{const r=await withTimeout(client.auth.signInWithPassword({email,password}),AUTH_TIMEOUT,'AUTH_TIMEOUT');if(r.error)throw r.error;if(!r.data?.user)throw new Error('No se recibió el usuario de la sesión.');await enter(r.data.user);}catch(err){console.error('PRIME Portal login',err);const m=String(err?.message||err||'');if(m.includes('Invalid login credentials'))setMsg('Correo o contraseña incorrectos.',true);else if(m.includes('AUTH_TIMEOUT'))setMsg('El servicio de acceso tardó demasiado. Recarga e intenta otra vez.',true);else setMsg(m||'No fue posible iniciar sesión.',true);setBusy(false);}
  }

  async function requestPasswordReset(){
    const email=($('#email')?.value||'').trim().toLowerCase();
    if(!email||!email.includes('@')){setMsg('Captura primero tu correo autorizado.',true);$('#email')?.focus();return;}
    setBusy(true);setMsg('Enviando instrucciones de recuperación…');
    try{
      const redirectTo=new URL('./',location.href).href.split('#')[0].split('?')[0];
      const r=await withTimeout(client.auth.resetPasswordForEmail(email,{redirectTo}),AUTH_TIMEOUT,'RESET_TIMEOUT');
      if(r.error)throw r.error;
      setMsg('Si el correo pertenece a una cuenta autorizada, recibirás instrucciones para cambiar tu contraseña.');
    }catch(err){console.error('PRIME Portal reset request',err);const m=String(err?.message||err||'');if(m.includes('RESET_TIMEOUT'))setMsg('El servicio de recuperación tardó demasiado. Intenta nuevamente.',true);else setMsg('No fue posible enviar la recuperación en este momento. Intenta nuevamente.',true);}finally{setBusy(false);}
  }

  async function saveNewPassword(){
    const p1=$('#newPass')?.value||'',p2=$('#newPass2')?.value||'';
    if(p1.length<8){setRecoveryMsg('La contraseña debe tener al menos 8 caracteres.',true);return;}
    if(p1!==p2){setRecoveryMsg('Las contraseñas no coinciden.',true);return;}
    const btn=$('#updatePassBtn');if(btn)btn.disabled=true;setRecoveryMsg('Actualizando contraseña…');
    try{
      const r=await withTimeout(client.auth.updateUser({password:p1}),AUTH_TIMEOUT,'UPDATE_PASSWORD_TIMEOUT');if(r.error)throw r.error;
      setRecoveryMsg('Contraseña actualizada correctamente.');
      await client.auth.signOut({scope:'local'}).catch(()=>{});history.replaceState(null,'',location.pathname);
      setTimeout(()=>{showLogin();setMsg('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');$('#email')?.focus();},700);
    }catch(err){console.error('PRIME Portal update password',err);const m=String(err?.message||err||'');if(m.includes('UPDATE_PASSWORD_TIMEOUT'))setRecoveryMsg('El cambio tardó demasiado. Intenta nuevamente.',true);else setRecoveryMsg(m||'No fue posible actualizar la contraseña.',true);}finally{if(btn)btn.disabled=false;}
  }

  function bind(){
    const form=$('#loginForm');if(form)form.onsubmit=async e=>{e.preventDefault();const email=($('#email')?.value||'').trim().toLowerCase(),password=$('#pass')?.value||'';if(!email||password.length<8){setMsg('Captura correo y contraseña válidos.',true);return;}await login(email,password);};
    const oldSignup=$('#signupBtn');
    if(oldSignup){
      oldSignup.id='forgotBtn';oldSignup.type='button';oldSignup.disabled=false;oldSignup.textContent='¿Olvidaste tu contraseña?';oldSignup.style.display='block';oldSignup.style.width='100%';oldSignup.style.marginTop='10px';oldSignup.style.border='0';oldSignup.style.background='transparent';oldSignup.style.color='#0e6b52';oldSignup.style.padding='7px 4px';oldSignup.style.fontSize='12px';oldSignup.onclick=requestPasswordReset;
      const actions=oldSignup.parentElement;if(actions){actions.removeChild(oldSignup);actions.insertAdjacentElement('afterend',oldSignup);}
    }
    ensureRecoveryForm();
    const msg=$('#msg');if(msg)msg.textContent='Acceso exclusivo para cuentas previamente autorizadas.';
    const logout=$('#logout');if(logout)logout.onclick=async()=>{try{await client.auth.signOut({scope:'local'});}catch(_e){localStorage.removeItem(AUTH_KEY);}location.href='./';};
  }

  async function boot(){
    bind();if(recoveryMode){showRecovery();return;}
    try{const r=await withTimeout(client.auth.getSession(),6000,'SESSION_TIMEOUT');if(recoveryMode)return;if(r.data?.session?.user)await enter(r.data.session.user);}catch(err){console.warn('PRIME Portal boot',err);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
