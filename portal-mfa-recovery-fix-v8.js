// PRIME MX Portal · MFA recovery fix v8
(function(){
  'use strict';
  const client=window.PRIME_PORTAL_SB;
  if(!client?.auth?.mfa?.enroll)return;

  const originalEnroll=client.auth.mfa.enroll.bind(client.auth.mfa);
  let cleaning=false;

  client.auth.mfa.enroll=async function(args){
    if(args?.factorType==='totp'&&!cleaning){
      cleaning=true;
      try{
        const r=await client.rpc('cleanup_own_unverified_mfa');
        if(r.error) console.warn('PRIME MFA cleanup',r.error);
      }catch(e){
        console.warn('PRIME MFA cleanup',e);
      }finally{
        cleaning=false;
      }
    }
    return originalEnroll(args);
  };
})();

// PRIME MX · Puente de módulo restringido Dashboard Equipos
(function(){
  'use strict';
  const client=window.PRIME_PORTAL_SB;
  if(!client)return;
  const CODE='DASH_EQUIPOS';
  const ROUTE='./dash-equipos/';
  let running=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function inject(){
    const app=document.querySelector('#app');
    if(!app||app.classList.contains('hidden')||running)return;
    if(document.querySelector('[data-prime-module="'+CODE+'"]'))return;
    running=true;
    try{
      const r=await client.from('app_modules').select('code,nombre,activo').eq('code',CODE).eq('activo',true).maybeSingle();
      if(r.error||!r.data)return;

      const nav=document.querySelector('#navActive');
      if(nav){
        const a=document.createElement('a');
        a.href=ROUTE;
        a.dataset.primeModule=CODE;
        a.innerHTML='<span class="ico">▤</span><span>'+esc(r.data.nombre||'Dashboard Equipos')+'</span><span class="tag">OK</span>';
        nav.appendChild(a);
      }

      const modules=document.querySelector('#modules');
      if(modules){
        const card=document.createElement('article');
        card.className='card';
        card.dataset.primeModule=CODE;
        card.innerHTML='<div class="cardTop"><div class="modIcon">DASH</div><div class="state">MFA · AAL2</div></div><h4>'+esc(r.data.nombre||'Dashboard Equipos')+'</h4><p>Inventario nacional de equipos, filtros, exportación y avance de migración Windows 11.</p><div class="chips"><span class="chip">Inventario</span><span class="chip">Windows 11</span><span class="chip">Excel</span></div><div class="foot"><span class="code">DASH_EQUIPOS</span><a class="open" href="'+ROUTE+'">Abrir módulo →</a></div>';
        modules.appendChild(card);
      }

      const count=document.querySelectorAll('#modules .card').length;
      const metric=document.querySelector('#mActive');
      if(metric)metric.textContent=String(count);
    }catch(e){
      console.warn('PRIME Dashboard Equipos bridge',e);
    }finally{
      running=false;
    }
  }

  const observer=new MutationObserver(()=>inject());
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  document.addEventListener('DOMContentLoaded',inject);
  setTimeout(inject,500);
  setTimeout(inject,1500);
})();
