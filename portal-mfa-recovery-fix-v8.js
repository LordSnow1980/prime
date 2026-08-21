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
