export async function api(url,{method='GET',body,form}={}){
  const o={method,credentials:'include',headers:{}};
  if(form)o.body=form;else if(body){o.body=JSON.stringify(body);o.headers['Content-Type']='application/json';}
  const r=await fetch('/api'+url,o);const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||'Terjadi kesalahan');return d;}
