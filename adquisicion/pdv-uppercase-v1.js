// PRIME MX · Adquisición · Homologación de PDV en MAYÚSCULAS v1
(function(){
'use strict';
const upperPdv=v=>String(v??'').trim().toLocaleUpperCase('es-MX');

// Toda nueva importación queda normalizada desde origen.
if(typeof equipmentFromLegacy==='function'){
  const baseEquipmentFromLegacy=equipmentFromLegacy;
  equipmentFromLegacy=function(r){
    const x=baseEquipmentFromLegacy(r);
    x.pdv_asignado=upperPdv(x.pdv_asignado);
    return x;
  };
}

function normalizePdvInput(){
  const el=document.querySelector('#bPDV');
  if(!el)return;
  const start=el.selectionStart,end=el.selectionEnd;
  const up=upperPdv(el.value);
  if(el.value!==up){
    el.value=up;
    try{el.setSelectionRange(start,end)}catch(_){ }
  }
}

function bindUppercase(){
  const el=document.querySelector('#bPDV');
  if(!el||el.dataset.uppercaseBound==='1')return;
  el.dataset.uppercaseBound='1';
  el.style.textTransform='uppercase';
  ['input','change','blur'].forEach(ev=>el.addEventListener(ev,normalizePdvInput));
  normalizePdvInput();
}

// Refuerzo visual para PDV en las dos tablas, aun si llega un dato legado.
function addUpperStyle(){
  if(document.querySelector('#pdv-uppercase-style'))return;
  const s=document.createElement('style');
  s.id='pdv-uppercase-style';
  s.textContent=`
    #tbody td:nth-child(7),#atbody td:nth-child(7){text-transform:uppercase}
    #bPDV{text-transform:uppercase}
  `;
  document.head.appendChild(s);
}

addUpperStyle();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindUppercase,{once:true});
else bindUppercase();

// La pantalla puede reconstruirse al cambiar de sección; vuelve a asegurar el binding.
const mo=new MutationObserver(bindUppercase);
mo.observe(document.documentElement,{childList:true,subtree:true});
})();
