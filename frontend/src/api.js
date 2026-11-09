// Ganti URL di bawah ini dengan URL backend publik Anda (misalnya di Vercel atau Render)
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://taskflow-backend.vercel.app'; 

export async function api(url,{method='GET',body,form}={}){
  const o={method,credentials:'include',headers:{}};
  if(form)o.body=form;
  else if(body){
    o.body=JSON.stringify(body);
    o.headers['Content-Type']='application/json';
  }
  
  // PERBAIKAN: Gunakan URL backend publik, bukan lagi '/api' relatif
  const r=await fetch(BASE_URL + '/api' + url,o);
  const d=await r.json().catch(()=>({}));
  
  if(!r.ok)throw new Error(d.error||'Terjadi kesalahan');
  return d;
}