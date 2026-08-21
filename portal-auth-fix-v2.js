// PRIME MX Portal · Auth + recuperación + MFA TOTP obligatorio v7
(function(){
  'use strict';
  const PROJECT='ydeusddtqsstqehqhkgi';
  const SUPABASE_URL='https://'+PROJECT+'.supabase.co';
  const SUPABASE_KEY='sb_publishable_3g_w_Iw4bLHE76c073jlQw_YFXMlljK';
  const AUTH_KEY='sb-'+PROJECT+'-auth-token';
  const ROUTES={BIOMETRICOS:'./biometricos/',HUB:'./hub/',ADQUISICION:'./adquisicion/',AUDITORIA_IT:'./auditoria/'};
  const INFO={BIOMETRICOS:{short:'BIO',title:'Biométricos y Pinpads',desc:'Inventario, asignaciones, entregas y comprobantes.',chips:['Inventario','Comprobantes'],ico:'◎'},HUB:{short:'HUB',title:'Recolección HUB',desc:'Recolección de equipos, evidencias privadas e historial.',chips:['Evidencias','Carta'],ico:'↥'},ADQUISICION:{short:'ADQ',title:'Adquisición',desc:'Control de activos, reasignaciones, respaldos y Excel.',chips:['Respaldo','Excel'],ico:'▦'},AUDITORIA_IT:{short:'AUD',title:'Auditoría IT',desc:'Auditorías, universo de PDV, hallazgos y evidencias.',chips:['Checklist','Región'],ico:'✓'},WHATSAPP_FALLAS:{short:'NOC',title:'Monitoreo WhatsApp / Fallas',desc:'Fallas, folios y operación por WhatsApp.',chips:['Fallas','Folios'],ico:'◔'}};
  const ORDER=['ADQUISICION','AUDITORIA_IT','BIOMETRICOS','HUB','WHATSAPP_FALLAS'];
  const AUTH_TIMEOUT=12000,QUERY_TIMEOUT=10000;
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const withTimeout=(promise,ms,label)=>Promise.race([promise,new Promise((_,rej)=>setTimeout(()=>rej(new Error(label)),ms))]);
  let recoveryMode=/([#?&])type=recovery(?:&|$)/i.test(location.hash+location.search);
  let mfaState={user:null,factorId:null,challengeId:null,enrolling:false};

  function setMsg(text,bad=false){const el=$('#msg');if(!el)return;el.textContent=text||'';el.className='msg'+(bad?' err':'');}
  function setRecoveryMsg(text,bad=false){const el=$('#recoveryMsg');if(!el)return;el.textContent=text||'';el.className='msg'+(bad?' err':'');}
  function setMfaMsg(text,bad=false){const el=$('#mfaMsg');if(!el)return;el.textContent=text||'';el.className='msg'+(bad?' err':'');}
  function setBusy(on){const b=$('#loginBtn');if(b)b.disabled=!!on;const f=$('#forgotBtn');if(f)f.disabled=!!on;}
  function showApp(){$('#gate')?.classList.add('hidden');$('#app')?.classList.remove('hidden');}
  function hideAuthForms(){$('#loginForm')?.classList.add('hidden');$('#recoveryForm')?.classList.add('hidden');$('#mfaForm')?.classList.add('hidden');}
  function showLogin(){recoveryMode=false;hideAuthForms();$('#loginForm')?.classList.remove('hidden');$('#gate')?.classList.remove('hidden');$('#app')?.classList.add('hidden');}

  if(!window.supabase?.createClient){setMsg('No se pudo cargar el motor de acceso. Recarga la página.',true);return;}
  const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{storageKey:AUTH_KEY,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  window.PRIME_PORTAL_SB=client;

  function ensureRecoveryForm(){
    let form=$('#recoveryForm');if(form)return form;const login=$('#loginForm');if(!login)return null;
    form=document.createElement('form');form.id='recoveryForm';form.className='login hidden';
    form.innerHTML='<img class="logo" alt="PRIME MX" src="./assets/primemx-dark.svg"><div class="eyebrow">Recuperación segura</div><h1>Nueva contraseña</h1><p>Captura y confirma tu nueva contraseña.</p><div class="field"><label>Nueva contraseña</label><input id="newPass" class="inp" type="password" minlength="8" autocomplete="new-password" required></div><div class="field"><label>Confirmar contraseña</label><input id="newPass2" class="inp" type="password" minlength="8" autocomplete="new-password" required></div><div class="actions"><button id="updatePassBtn" class="btn primary" type="submit">Guardar contraseña</button><button id="cancelRecovery" class="btn" type="button">Cancelar</button></div><div id="recoveryMsg" class="msg">Elige una contraseña nueva de al menos 8 caracteres.</div>';
    login.insertAdjacentElement('afterend',form);form.onsubmit=async e=>{e.preventDefault();await saveNewPassword();};form.querySelector('#cancelRecovery').onclick=async()=>{await client.auth.signOut({scope:'local'}).catch(()=>{});history.replaceState(null,'',location.pathname);showLogin();};return form;
  }
  function showRecovery(){recoveryMode=true;ensureRecoveryForm();hideAuthForms();$('#recoveryForm')?.classList.remove('hidden');$('#gate')?.classList.remove('hidden');$('#app')?.classList.add('hidden');setTimeout(()=>$('#newPass')?.focus(),50);}

  function ensureMfaForm(){
    let form=$('#mfaForm');if(form)return form;const login=$('#loginForm');if(!login)return null;
    form=document.createElement('form');form.id='mfaForm';form.className='login hidden';login.insertAdjacentElement('afterend',form);
    form.onsubmit=async e=>{e.preventDefault();await verifyMfaCode();};return form;
  }
  function mfaShell(title,subtitle,body){
    const form=ensureMfaForm();form.innerHTML='<img class="logo" alt="PRIME MX" src="./assets/primemx-dark.svg"><div class="eyebrow">Doble factor · MFA</div><h1>'+esc(title)+'</h1><p>'+esc(subtitle)+'</p>'+body+'<div id="mfaMsg" class="msg">La sesión solo se abrirá después de validar el segundo factor.</div>';
    hideAuthForms();form.classList.remove('hidden');$('#gate')?.classList.remove('hidden');$('#app')?.classList.add('hidden');
  }
  async function signOutFromMfa(){await client.auth.signOut({scope:'local'}).catch(()=>{});mfaState={user:null,factorId:null,challengeId:null,enrolling:false};showLogin();setMsg('Sesión cerrada.');}

  async function startMfaEnrollment(user){
    try{
      setMsg('Preparando doble factor…');
      const factors=await withTimeout(client.auth.mfa.listFactors(),AUTH_TIMEOUT,'MFA_FACTORS_TIMEOUT');if(factors.error)throw factors.error;
      for(const f of (factors.data?.totp||[]).filter(x=>x.status!=='verified')){await client.auth.mfa.unenroll({factorId:f.id}).catch(()=>{});}
      const en=await withTimeout(client.auth.mfa.enroll({factorType:'totp',friendlyName:'PRIME MX'}),AUTH_TIMEOUT,'MFA_ENROLL_TIMEOUT');if(en.error)throw en.error;
      const ch=await withTimeout(client.auth.mfa.challenge({factorId:en.data.id}),AUTH_TIMEOUT,'MFA_CHALLENGE_TIMEOUT');if(ch.error)throw ch.error;
      mfaState={user,factorId:en.data.id,challengeId:ch.data.id,enrolling:true};
      const qr=en.data?.totp?.qr_code||'',secret=en.data?.totp?.secret||'';
      mfaShell('Activa tu doble factor','Escanea el QR con Microsoft Authenticator, Google Authenticator, Authy o 1Password.',
        '<div style="text-align:center;margin:14px 0">'+(qr?'<img alt="QR MFA" src="'+esc(qr)+'" style="width:210px;max-width:100%;border:1px solid #dce4df;border-radius:12px;padding:8px;background:#fff">':'')+'</div><div class="field"><label>Clave manual (respaldo)</label><input class="inp" value="'+esc(secret)+'" readonly onclick="this.select()"></div><div class="field"><label>Código de 6 dígitos *</label><input id="mfaCode" class="inp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" required></div><div class="actions"><button id="mfaVerifyBtn" class="btn primary" type="submit">Activar y entrar</button><button id="mfaCancelBtn" class="btn" type="button">Salir</button></div>');
      $('#mfaCancelBtn').onclick=signOutFromMfa;setTimeout(()=>$('#mfaCode')?.focus(),50);
    }catch(err){console.error('PRIME MFA enroll',err);setMsg('No fue posible preparar MFA: '+(err?.message||err),true);await client.auth.signOut({scope:'local'}).catch(()=>{});showLogin();}
  }

  async function startMfaChallenge(user,factor){
    try{
      const ch=await withTimeout(client.auth.mfa.challenge({factorId:factor.id}),AUTH_TIMEOUT,'MFA_CHALLENGE_TIMEOUT');if(ch.error)throw ch.error;
      mfaState={user,factorId:factor.id,challengeId:ch.data.id,enrolling:false};
      mfaShell('Verificación en dos pasos','Abre tu aplicación autenticadora e introduce el código actual.',
        '<div class="field"><label>Código de 6 dígitos *</label><input id="mfaCode" class="inp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" required></div><div class="actions"><button id="mfaVerifyBtn" class="btn primary" type="submit">Verificar y entrar</button><button id="mfaCancelBtn" class="btn" type="button">Salir</button></div>');
      $('#mfaCancelBtn').onclick=signOutFromMfa;setTimeout(()=>$('#mfaCode')?.focus(),50);
    }catch(err){console.error('PRIME MFA challenge',err);setMsg('No fue posible iniciar el segundo factor.',true);await client.auth.signOut({scope:'local'}).catch(()=>{});showLogin();}
  }

  async function verifyMfaCode(){
    const code=($('#mfaCode')?.value||'').replace(/\D/g,'');if(code.length!==6){setMfaMsg('Captura el código de 6 dígitos.',true);return;}
    const btn=$('#mfaVerifyBtn');if(btn)btn.disabled=true;setMfaMsg('Verificando…');
    try{
      const v=await withTimeout(client.auth.mfa.verify({factorId:mfaState.factorId,challengeId:mfaState.challengeId,code}),AUTH_TIMEOUT,'MFA_VERIFY_TIMEOUT');if(v.error)throw v.error;
      await client.auth.refreshSession().catch(()=>{});
      const aal=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(aal.error||aal.data?.currentLevel!=='aal2')throw new Error('No se obtuvo una sesión MFA válida.');
      setMfaMsg('Segundo factor validado.');await enter(mfaState.user);
    }catch(err){console.error('PRIME MFA verify',err);setMfaMsg('Código incorrecto o vencido. Intenta con el código actual.',true);if(btn)btn.disabled=false;}
  }

  async function requireMfa(user){
    if(!user?.id)throw new Error('Sesión inválida.');
    const aal=await withTimeout(client.auth.mfa.getAuthenticatorAssuranceLevel(),AUTH_TIMEOUT,'MFA_AAL_TIMEOUT');if(aal.error)throw aal.error;
    if(aal.data?.currentLevel==='aal2')return enter(user);
    const lf=await withTimeout(client.auth.mfa.listFactors(),AUTH_TIMEOUT,'MFA_FACTORS_TIMEOUT');if(lf.error)throw lf.error;
    const verified=(lf.data?.totp||[]).filter(x=>x.status==='verified');
    if(verified.length)return startMfaChallenge(user,verified[0]);
    return startMfaEnrollment(user);
  }

  function renderPortal(mods){
    const list=ORDER.map(code=>mods.find(m=>m.code===code)).filter(Boolean).map(m=>{const d=INFO[m.code]||{short:m.code,title:m.nombre||m.code,desc:'Módulo PRIME MX',chips:[],ico:'•'};return {...d,code:m.code,route:ROUTES[m.code]||''};});
    const active=list.filter(x=>x.route),pending=list.filter(x=>!x.route);$('#mActive').textContent=active.length;$('#mPending').textContent=pending.length;
    $('#navActive').innerHTML=active.map(x=>'<a href="'+x.route+'"><span class="ico">'+esc(x.ico)+'</span><span>'+esc(x.title)+'</span><span class="tag">OK</span></a>').join('');
    $('#navPending').innerHTML=pending.length?pending.map(x=>'<div class="pending"><span class="ico">'+esc(x.ico)+'</span><span>'+esc(x.title)+'</span><span class="tag">…</span></div>').join(''):'<div class="pending"><span class="ico">•</span><span>Sin pendientes</span><span class="tag">0</span></div>';
    $('#modules').innerHTML=active.map(x=>'<article class="card"><div class="cardTop"><div class="modIcon">'+esc(x.short)+'</div><div class="state">MFA · AAL2</div></div><h4>'+esc(x.title)+'</h4><p>'+esc(x.desc)+'</p><div class="chips">'+(x.chips||[]).map(c=>'<span class="chip">'+esc(c)+'</span>').join('')+'</div><div class="foot"><span class="code">'+esc(x.code)+'</span><a class="open" href="'+x.route+'">Abrir módulo →</a></div></article>').join('');
    if(pending.length){$('#pendingWrap').classList.remove('hidden');$('#pendingCards').innerHTML=pending.map(x=>'<div class="pendingCard"><b>'+esc(x.title)+'</b><span>'+esc(x.desc)+'</span></div>').join('');}else $('#pendingWrap').classList.add('hidden');
    const mv=document.querySelector('.metric:nth-child(3) .v'),ms=document.querySelector('.metric:nth-child(3) .s');if(mv)mv.textContent='MFA';if(ms)ms.textContent='Sesión AAL2 verificada';
  }

  async function enter(user){
    try{
      if(!user?.id)throw new Error('Sesión inválida.');setMfaMsg('Cargando perfil…');setMsg('Validando perfil…');
      const p=await withTimeout(client.from('profiles').select('email,nombre,role,activo').eq('user_id',user.id).maybeSingle(),QUERY_TIMEOUT,'PROFILE_TIMEOUT');if(p.error)throw p.error;
      if(!p.data||!p.data.activo){await client.auth.signOut({scope:'local'}).catch(()=>{});throw new Error('Tu correo no está autorizado o está inactivo.');}
      const mods=await withTimeout(client.from('app_modules').select('code,nombre,activo').eq('activo',true).order('nombre'),QUERY_TIMEOUT,'MODULES_TIMEOUT');if(mods.error)throw mods.error;
      $('#userName').textContent=p.data.nombre||p.data.email||user.email||'';$('#userRole').textContent=p.data.role||'';renderPortal(mods.data||[]);showApp();return true;
    }catch(err){console.error('PRIME Portal enter',err);const m=String(err?.message||err||'No se pudo completar el acceso.');setMfaMsg(m,true);setMsg(m,true);return false;}finally{setBusy(false);}
  }

  async function login(email,password){setBusy(true);setMsg('Autenticando…');try{const r=await withTimeout(client.auth.signInWithPassword({email,password}),AUTH_TIMEOUT,'AUTH_TIMEOUT');if(r.error)throw r.error;if(!r.data?.user)throw new Error('No se recibió el usuario de la sesión.');await requireMfa(r.data.user);}catch(err){console.error('PRIME Portal login',err);const m=String(err?.message||err||'');if(m.includes('Invalid login credentials'))setMsg('Correo o contraseña incorrectos.',true);else setMsg(m||'No fue posible iniciar sesión.',true);setBusy(false);}}

  async function requestPasswordReset(){const email=($('#email')?.value||'').trim().toLowerCase();if(!email||!email.includes('@')){setMsg('Captura primero tu correo autorizado.',true);return;}setBusy(true);setMsg('Enviando instrucciones…');try{const redirectTo=new URL('./',location.href).href.split('#')[0].split('?')[0];const r=await client.auth.resetPasswordForEmail(email,{redirectTo});if(r.error)throw r.error;setMsg('Si el correo pertenece a una cuenta autorizada, recibirás instrucciones para cambiar tu contraseña.');}catch(_e){setMsg('No fue posible enviar la recuperación en este momento.',true);}finally{setBusy(false);}}
  async function saveNewPassword(){const p1=$('#newPass')?.value||'',p2=$('#newPass2')?.value||'';if(p1.length<8)return setRecoveryMsg('La contraseña debe tener al menos 8 caracteres.',true);if(p1!==p2)return setRecoveryMsg('Las contraseñas no coinciden.',true);const btn=$('#updatePassBtn');if(btn)btn.disabled=true;try{const r=await client.auth.updateUser({password:p1});if(r.error)throw r.error;await client.auth.signOut({scope:'local'}).catch(()=>{});history.replaceState(null,'',location.pathname);setTimeout(()=>{showLogin();setMsg('Contraseña actualizada. Inicia sesión; después se solicitará MFA.');},500);}catch(err){setRecoveryMsg(err?.message||'No fue posible actualizar la contraseña.',true);}finally{if(btn)btn.disabled=false;}}

  function bind(){
    const form=$('#loginForm');if(form)form.onsubmit=async e=>{e.preventDefault();const email=($('#email')?.value||'').trim().toLowerCase(),password=$('#pass')?.value||'';if(!email||password.length<8)return setMsg('Captura correo y contraseña válidos.',true);await login(email,password);};
    const old=$('#signupBtn')||$('#forgotBtn');if(old){old.id='forgotBtn';old.type='button';old.textContent='¿Olvidaste tu contraseña?';old.onclick=requestPasswordReset;}
    ensureRecoveryForm();ensureMfaForm();
    const logout=$('#logout');if(logout)logout.onclick=async()=>{await client.auth.signOut({scope:'local'}).catch(()=>{});location.href='./';};
  }
  client.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY')showRecovery();});
  async function boot(){bind();if(recoveryMode){showRecovery();return;}try{const r=await client.auth.getSession();if(r.data?.session?.user)await requireMfa(r.data.session.user);}catch(err){console.warn('PRIME Portal boot',err);setMsg('No se pudo validar la sesión.',true);}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
