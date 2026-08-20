// PRIME MX Portal · Auth robusta v3
(function(){
  'use strict';
  const AUTH_TIMEOUT=9000;
  const QUERY_TIMEOUT=9000;
  const delayReject=(ms,label)=>new Promise((_,rej)=>setTimeout(()=>rej(new Error(label||'TIMEOUT')),ms));
  const withTimeout=(promise,ms,label)=>Promise.race([promise,delayReject(ms,label)]);

  function setMsg(text,isError){const el=document.querySelector('#msg');if(!el)return;el.textContent=text||'';el.className='msg'+(isError?' err':'');}
  function setBusy(on){const b=document.querySelector('#loginBtn');if(b)b.disabled=!!on;const s=document.querySelector('#signupBtn');if(s)s.disabled=!!on;}
  function showApp(){document.querySelector('#gate')?.classList.add('hidden');document.querySelector('#app')?.classList.remove('hidden');}

  async function safeEnter(user){
    try{
      if(!user?.id)throw new Error('Sesión sin usuario.');
      setMsg('Validando perfil…');
      const p=await withTimeout(sb.from('profiles').select('email,nombre,role,activo').eq('user_id',user.id).maybeSingle(),QUERY_TIMEOUT,'PROFILE_TIMEOUT');
      if(p.error)throw p.error;
      if(!p.data||!p.data.activo){try{await sb.auth.signOut({scope:'local'});}catch(_e){}throw new Error('Tu correo no está autorizado o está inactivo.');}
      setMsg('Cargando módulos…');
      const mods=await withTimeout(sb.from('app_modules').select('code,nombre,activo').eq('activo',true).order('nombre'),QUERY_TIMEOUT,'MODULES_TIMEOUT');
      if(mods.error)throw mods.error;
      document.querySelector('#userName').textContent=p.data.nombre||p.data.email||user.email||'';
      document.querySelector('#userRole').textContent=p.data.role||'';
      if(typeof render!=='function')throw new Error('No se encontró el render del Portal.');
      render(mods.data||[]);
      setMsg('Acceso correcto.');
      showApp();
      return true;
    }catch(err){
      console.error('Portal enter error',err);
      const code=String(err?.message||err||'');
      if(code.includes('PROFILE_TIMEOUT'))setMsg('La sesión inició, pero tardó demasiado en cargar tu perfil.',true);
      else if(code.includes('MODULES_TIMEOUT'))setMsg('La sesión inició, pero tardó demasiado en cargar los módulos.',true);
      else setMsg(code||'No se pudo completar el acceso.',true);
      return false;
    }finally{setBusy(false);}
  }

  async function restPasswordLogin(email,password){
    const r=await withTimeout(fetch(SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})}),AUTH_TIMEOUT,'REST_AUTH_TIMEOUT');
    const body=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(body?.msg||body?.message||body?.error_description||'Correo o contraseña incorrectos.');
    if(!body?.access_token||!body?.refresh_token||!body?.user)throw new Error('Auth no devolvió una sesión válida.');
    localStorage.setItem(AUTH_KEY,JSON.stringify(body));
    return body;
  }

  async function login(email,password){
    setBusy(true);setMsg('Autenticando…');
    try{
      let result;
      try{result=await withTimeout(sb.auth.signInWithPassword({email,password}),AUTH_TIMEOUT,'AUTH_TIMEOUT');}
      catch(firstErr){
        if(String(firstErr?.message||firstErr).includes('AUTH_TIMEOUT')){setMsg('Restaurando sesión segura…');const fallback=await restPasswordLogin(email,password);return await safeEnter(fallback.user);}
        throw firstErr;
      }
      if(result?.error)throw result.error;
      if(!result?.data?.user)throw new Error('No se recibió el usuario de la sesión.');
      return await safeEnter(result.data.user);
    }catch(err){
      console.error('Portal login error',err);
      const msg=String(err?.message||err||'');
      if(msg.includes('Invalid login credentials'))setMsg('Correo o contraseña incorrectos.',true);
      else if(msg.includes('REST_AUTH_TIMEOUT'))setMsg('Auth no respondió a tiempo. Revisa conexión e intenta otra vez.',true);
      else setMsg(msg||'No fue posible iniciar sesión.',true);
      setBusy(false);return false;
    }
  }

  async function signup(email,password){
    setBusy(true);setMsg('Creando acceso…');
    try{
      const r=await withTimeout(sb.auth.signUp({email,password,options:{emailRedirectTo:location.href.split('#')[0]}}),AUTH_TIMEOUT,'SIGNUP_TIMEOUT');
      if(r.error)throw r.error;
      if(r.data?.session&&r.data?.user)return await safeEnter(r.data.user);
      setMsg('Cuenta creada. Revisa tu correo para confirmarla.');
    }catch(err){setMsg(String(err?.message||err||'No fue posible crear el acceso.'),true);}finally{setBusy(false);}
  }

  function bind(){
    const form=document.querySelector('#loginForm');
    if(form)form.onsubmit=async e=>{e.preventDefault();const email=(document.querySelector('#email')?.value||'').trim().toLowerCase();const password=document.querySelector('#pass')?.value||'';if(!email||password.length<8){setMsg('Captura correo y contraseña válidos.',true);return;}await login(email,password);};
    const signupBtn=document.querySelector('#signupBtn');
    if(signupBtn)signupBtn.onclick=async()=>{const email=(document.querySelector('#email')?.value||'').trim().toLowerCase();const password=document.querySelector('#pass')?.value||'';if(!email||password.length<8){setMsg('Captura correo y contraseña válidos.',true);return;}await signup(email,password);};
    const logout=document.querySelector('#logout');
    if(logout)logout.onclick=async()=>{try{await withTimeout(sb.auth.signOut({scope:'local'}),5000,'SIGNOUT_TIMEOUT');}catch(_e){localStorage.removeItem(AUTH_KEY);}location.href='./';};
  }

  async function boot(){
    bind();
    try{const r=await withTimeout(sb.auth.getSession(),5000,'SESSION_TIMEOUT');if(r?.data?.session?.user)await safeEnter(r.data.session.user);}catch(err){console.warn('Portal session boot',err);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
