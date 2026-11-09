import {useState,useEffect,useCallback} from 'react';
import {BookOpen,ClipboardList,LayoutDashboard,Bell,Menu,Moon,Sun,LogOut,Search,GraduationCap,Users,Pencil,Download,Check,Trash2,Plus,Upload,Library,ListTodo} from 'lucide-react';
import {BarChart,Bar,XAxis,YAxis,Tooltip,Legend,ResponsiveContainer,LineChart,Line,CartesianGrid} from 'recharts';
import {api} from './api.js';
const fmt=d=>d?new Date(d.replace(' ','T')).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}):'-';
const Logo=()=><div className="flex items-center gap-2 font-bold text-lg"><span className="bg-sky-500 text-white p-1.5 rounded-lg"><GraduationCap size={20}/></span>TASKFLOW</div>;
const Badge=({s})=>{const c={'Belum Dikerjakan':'bg-slate-200 text-slate-700','Menunggu Penilaian':'bg-amber-100 text-amber-700','Sudah Dinilai':'bg-emerald-100 text-emerald-700','Perlu Revisi':'bg-orange-100 text-orange-700','Terlambat':'bg-red-100 text-red-700',Aktif:'bg-emerald-100 text-emerald-700',published:'bg-emerald-100 text-emerald-700',draft:'bg-slate-200 text-slate-700',hidden:'bg-purple-100 text-purple-700'}[s]||'bg-sky-100 text-sky-700';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c}`}>{s}</span>;};
const Empty=({t})=><p className="text-center text-sm text-slate-500 py-6">{t}</p>;

function Auth({onLogin}){
  const [mode,setMode]=useState(new URLSearchParams(location.search).get('reset')?'reset':'login');const [f,setF]=useState({role:'mahasiswa'});const [msg,setMsg]=useState({});const set=k=>e=>setF({...f,[k]:e.target.value});
  const submit=async e=>{e.preventDefault();setMsg({});
    try{
      if(mode==='login'){await api('/auth/login',{method:'POST',body:{login:f.login,password:f.password}});onLogin();}
      else if(mode==='register'){if(f.password!==f.password2)throw new Error('Konfirmasi password tidak cocok');await api('/auth/register',{method:'POST',body:f});setMode('login');setMsg({ok:'Registrasi berhasil, silakan login'});}
      else if(mode==='forgot'){const r=await api('/auth/forgot',{method:'POST',body:{email:f.email}});setMsg({ok:r.message});}
      else{await api('/auth/reset',{method:'POST',body:{token:new URLSearchParams(location.search).get('reset'),password:f.password}});history.replaceState({},'','/');setMode('login');setMsg({ok:'Password diubah, silakan login'});}
    }catch(x){setMsg({err:x.message});}};
  return <div className="min-h-screen grid place-items-center bg-gradient-to-br from-[#0f2a5c] to-sky-400 p-4">
    <form onSubmit={submit} className="card w-full max-w-md space-y-3 p-6"><Logo/><p className="text-sm text-slate-500">Sistem Informasi Pengumpulan Tugas dan Manajemen Materi Kuliah</p>
      <h2 className="font-semibold">{{login:'Masuk',register:'Daftar Akun',forgot:'Lupa Password',reset:'Reset Password'}[mode]}</h2>
      {msg.err&&<div className="bg-red-100 text-red-700 text-sm p-2 rounded">{msg.err}</div>}{msg.ok&&<div className="bg-emerald-100 text-emerald-700 text-sm p-2 rounded">{msg.ok}</div>}
      {mode==='register'&&<><input className="inp" placeholder="Nama lengkap" required onChange={set('name')}/><input className="inp" placeholder="NIM / NIP" required onChange={set('identity_number')}/>
        <select className="inp" onChange={set('role')}><option value="mahasiswa">Mahasiswa</option><option value="dosen">Dosen</option></select></>}
      {mode==='login'&&<input className="inp" placeholder="Email atau NIM/NIP" required onChange={set('login')}/>}
      {['register','forgot'].includes(mode)&&<input className="inp" type="email" placeholder="Email" required onChange={set('email')}/>}
      {mode!=='forgot'&&<input className="inp" type="password" placeholder="Password" required minLength={mode==='login'?1:6} onChange={set('password')}/>}
      {mode==='register'&&<input className="inp" type="password" placeholder="Ulangi password" required onChange={set('password2')}/>}
      <button className="btn w-full justify-center">Kirim</button>
      <div className="flex justify-between text-xs text-sky-600"><button type="button" onClick={()=>setMode(mode==='login'?'register':'login')}>{mode==='login'?'Daftar akun':'Kembali ke login'}</button>{mode==='login'&&<button type="button" onClick={()=>setMode('forgot')}>Lupa password?</button>}</div>
      {mode==='login'&&<p className="text-xs text-slate-400">Demo: admin@taskflow.id/admin123 · dosen@taskflow.id/dosen123 · mahasiswa@taskflow.id/mhs123</p>}
    </form></div>;}

function Dashboard({me}){
  const [d,setD]=useState(null);
  useEffect(()=>{
    api('/dashboard')
      .then(setD)
      .catch(()=>setD({stats:{},chart:[],upcoming:[],announcements:[]}));
  },[]);

  if(!d) return <Empty t="Memuat..."/>;

  // PENCEGAHAN ERROR (Safe Access Array)
  const chartData = Array.isArray(d?.chart) ? d.chart : [];
  const keys = chartData[0] ? Object.keys(chartData[0]).filter(k=>k!=='name') : [];
  const cols = ['#0f2a5c','#38bdf8','#94a3b8'];
  const statsObj = d?.stats || {};
  const upcomingArr = Array.isArray(d?.upcoming) ? d.upcoming : [];
  const annArr = Array.isArray(d?.announcements) ? d.announcements : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {Object.entries(statsObj).map(([k,v])=>(
          <div key={k} className="card">
            <p className="text-xs text-slate-500">{k}</p>
            <p className="text-2xl font-bold text-[#0f2a5c] dark:text-sky-300">{v}</p>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card h-72">
          <h3 className="font-semibold mb-2 text-sm">
            {me.role==='mahasiswa'?'Perkembangan Nilai':me.role==='dosen'?'Statistik Pengumpulan':'Aktivitas 7 Hari'}
          </h3>
          {chartData.length ? (
            <ResponsiveContainer>
              {me.role==='mahasiswa' ? (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3"/>
                  <XAxis dataKey="name" fontSize={11}/>
                  <YAxis domain={[0,100]}/>
                  <Tooltip/>
                  <Line dataKey="nilai" stroke="#0ea5e9" strokeWidth={2}/>
                </LineChart>
              ) : (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3"/>
                  <XAxis dataKey="name" fontSize={11}/>
                  <YAxis allowDecimals={false}/>
                  <Tooltip/>
                  <Legend/>
                  {keys.map((k,i)=><Bar key={k} dataKey={k} fill={cols[i]}/>)}
                </BarChart>
              )}
            </ResponsiveContainer>
          ) : <Empty t="Belum ada data"/>}
        </div>
        <div className="card">
          <h3 className="font-semibold mb-2 text-sm">
            {me.role==='mahasiswa'?'Deadline Terdekat':me.role==='dosen'?'Mahasiswa Belum Mengumpulkan':'Aktivitas Terbaru'}
          </h3>
          {upcomingArr.length ? upcomingArr.map((u,i)=>(
            <div key={i} className="flex justify-between text-sm border-b border-slate-100 dark:border-slate-700 py-1.5">
              <span>{u.title}{u.student && <span className="text-slate-500"> · {u.student}</span>}</span>
              <span className="text-xs text-slate-500">{fmt(u.deadline)}</span>
            </div>
          )) : <Empty t="Tidak ada data"/>}
        </div>
      </div>
      <div className="card">
        <h3 className="font-semibold mb-2 text-sm">Pengumuman</h3>
        {annArr.length ? annArr.map((a,i)=>(
          <div key={i} className="mb-2">
            <p className="font-medium text-sm">{a.title}</p>
            <p className="text-sm text-slate-500">{a.body}</p>
          </div>
        )) : <Empty t="Belum ada pengumuman"/>}
      </div>
    </div>
  );
}

function Materi({me}){
  const [rows,setRows]=useState([]),[courses,setCourses]=useState([]),[classes,setClasses]=useState([]),[s,setS]=useState(''),[fc,setFc]=useState(''),[show,setShow]=useState(false),[err,setErr]=useState(''),[prev,setPrev]=useState(null);
  const load=useCallback(()=>api('/materials').then(setRows),[]);useEffect(()=>{load();api('/courses').then(setCourses);if(me.role==='dosen')api('/classes').then(setClasses);},[load,me.role]);
  const add=async e=>{e.preventDefault();setErr('');try{await api('/materials',{method:'POST',form:new FormData(e.target)});setShow(false);load();}catch(x){setErr(x.message);}};
  const list=rows.filter(r=>r.title.toLowerCase().includes(s.toLowerCase())&&(!fc||String(r.course_id)===fc));
  const groups=list.reduce((g,r)=>((g[r.course]??=[]).push(r),g),{});
  return <div className="space-y-4"><div className="flex flex-wrap gap-2"><div className="relative flex-1 min-w-48"><Search size={14} className="absolute left-3 top-3 text-slate-400"/><input className="inp pl-8" placeholder="Cari judul materi..." onChange={e=>setS(e.target.value)}/></div>
    <select className="inp w-auto" onChange={e=>setFc(e.target.value)}><option value="">Semua mata kuliah</option>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
    {me.role==='dosen'&&<button className="btn" onClick={()=>setShow(!show)}><Plus size={14}/>Tambah Materi</button>}</div>
    {show&&<form onSubmit={add} className="card grid md:grid-cols-2 gap-2">{err&&<p className="text-red-600 text-sm md:col-span-2">{err}</p>}
      <><input name="course_name" list="mk" className="inp" placeholder="Mata kuliah (ketik manual)" required/><datalist id="mk">{courses.map(c=><option key={c.id} value={c.name}/>)}</datalist></>
      <select name="class_id" className="inp"><option value="">Semua kelas</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <input name="title" className="inp" placeholder="Judul materi" required/><input name="meeting_no" type="number" min="1" max="16" defaultValue="1" className="inp" placeholder="Pertemuan"/>
      <textarea name="description" className="inp md:col-span-2" placeholder="Deskripsi"/><input name="publish_date" type="date" className="inp"/>
      <select name="status" className="inp"><option value="draft">Draft</option><option value="published">Publikasikan</option><option value="hidden">Sembunyikan</option></select>
      <input name="video_url" className="inp" placeholder="Link video"/><input name="reference_url" className="inp" placeholder="Link referensi"/>
      <input name="file" type="file" className="inp md:col-span-2" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar,.jpg,.png,.mp4"/><button className="btn md:col-span-2 justify-center">Simpan Materi</button></form>}
    {prev&&<div className="card"><div className="flex justify-between mb-2"><b className="text-sm">{prev.title}</b><button className="btn2" onClick={()=>setPrev(null)}>Tutup</button></div><iframe title="preview" className="w-full h-[70vh] rounded" src={`/api/materials/${prev.id}/file?inline=1`}/></div>}
    {Object.keys(groups).length?Object.entries(groups).map(([c,items])=><div key={c}><h3 className="font-semibold mb-2">📁 {c}</h3><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{items.map(m=><div key={m.id} className="card space-y-1">
      <div className="flex justify-between"><span className="text-xs text-sky-600">Pertemuan {m.meeting_no}</span>{me.role!=='mahasiswa'&&<Badge s={m.status}/>}</div><b>{m.title}</b><p className="text-sm text-slate-500">{m.description}</p>
      <p className="text-xs text-slate-400">{m.lecturer} · {m.publish_date}{m.file_name&&` · ${m.file_name.split('.').pop().toUpperCase()}`}{me.role==='dosen'&&` · ${m.learned} mhs belajar`}</p>
      <div className="flex flex-wrap gap-1 pt-1">{m.att&&<a className="btn2" href={`/api/materials/${m.id}/file`}><Download size={12}/>Unduh</a>}{m.att&&/pdf/.test(m.mime||'')&&<button className="btn2" onClick={()=>setPrev(m)}>Preview</button>}
        {m.video_url&&<a className="btn2" target="_blank" rel="noreferrer" href={m.video_url}>Video</a>}{m.reference_url&&<a className="btn2" target="_blank" rel="noreferrer" href={m.reference_url}>Referensi</a>}
        {me.role==='mahasiswa'&&(m.done?<span className="text-xs text-emerald-600 flex items-center"><Check size={12}/>Sudah dipelajari</span>:<button className="btn2" onClick={()=>api(`/materials/${m.id}/progress`,{method:'POST'}).then(load)}>Tandai dipelajari</button>)}
        {me.role==='dosen'&&<><select className="btn2" value={m.status} onChange={e=>api(`/materials/${m.id}/status`,{method:'PUT',body:{status:e.target.value}}).then(load)}><option value="draft">Draft</option><option value="published">Publikasi</option><option value="hidden">Sembunyikan</option></select>
          <button className="btn2" onClick={()=>confirm('Hapus materi?')&&api('/materials/'+m.id,{method:'DELETE'}).then(load)}><Trash2 size={12}/></button></>}</div></div>)}</div></div>):<Empty t="Belum ada materi"/>}</div>;}

function Tugas({me}){
  const [rows,setRows]=useState([]),[courses,setCourses]=useState([]),[classes,setClasses]=useState([]),[s,setS]=useState(''),[sort,setSort]=useState('deadline'),[show,setShow]=useState(false),[err,setErr]=useState(''),[sel,setSel]=useState(null),[subs,setSubs]=useState([]),[file,setFile]=useState(null),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[ok,setOk]=useState('');
  const load=useCallback(()=>api('/assignments').then(setRows),[]);useEffect(()=>{load();api('/courses').then(setCourses);if(me.role==='dosen')api('/classes').then(setClasses);},[load,me.role]);
  const status=a=>a.sub_id?(a.is_late&&a.sub_status==='Menunggu Penilaian'?'Terlambat':a.sub_status):'Belum Dikerjakan';
  const add=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));f.allow_late=!!f.allow_late;f.allow_resubmit=!!f.allow_resubmit;setErr('');try{await api('/assignments',{method:'POST',body:f});setShow(false);load();}catch(x){setErr(x.message);}};
  const open=async a=>{setSel(a);setOk('');setFile(null);if(me.role==='dosen')setSubs(await api(`/assignments/${a.id}/submissions`));};
  const send=async()=>{if(!file)return setErr('Pilih file');if(!confirm('Kirim tugas sekarang?'))return;setBusy(true);setErr('');const fd=new FormData();fd.append('file',file);fd.append('note',note);
    try{const r=await api(`/assignments/${sel.id}/submit`,{method:'POST',form:fd});setOk('Berhasil! Nomor submission: '+r.submission_no);setFile(null);load();}catch(x){setErr(x.message);}setBusy(false);};
  const grade=async(sid,revise)=>{const score=prompt(revise?'Catatan revisi':'Nilai (0-100):');if(score===null)return;const fb=prompt('Komentar / feedback:')||'';
    try{await api(`/submissions/${sid}/grade`,{method:'PUT',body:{score:revise?0:score,feedback:revise?score:fb,revise}});setSubs(await api(`/assignments/${sel.id}/submissions`));}catch(x){alert(x.message);}};
  const list=rows.filter(a=>a.title.toLowerCase().includes(s.toLowerCase())).sort((a,b)=>sort==='title'?a.title.localeCompare(b.title):String(a[sort]).localeCompare(String(b[sort])));
  const cur=sel&&rows.find(r=>r.id===sel.id);
  return <div className="space-y-4"><div className="flex flex-wrap gap-2"><input className="inp flex-1 min-w-48" placeholder="Cari tugas..." onChange={e=>setS(e.target.value)}/>
    <select className="inp w-auto" onChange={e=>setSort(e.target.value)}><option value="deadline">Urut deadline</option><option value="title">Urut judul</option></select>
    {me.role==='dosen'&&<button className="btn" onClick={()=>setShow(!show)}><Plus size={14}/>Buat Tugas</button>}</div>
    {show&&<form onSubmit={add} className="card grid md:grid-cols-2 gap-2">{err&&<p className="text-red-600 text-sm md:col-span-2">{err}</p>}
      <><input name="course_name" list="mk" className="inp" placeholder="Mata kuliah (ketik manual)" required/><datalist id="mk">{courses.map(c=><option key={c.id} value={c.name}/>)}</datalist></>
      <select name="class_id" className="inp"><option value="">Semua kelas</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <input name="title" className="inp md:col-span-2" placeholder="Judul tugas" required/><textarea name="description" className="inp md:col-span-2" placeholder="Deskripsi"/>
      <label className="text-xs">Mulai<input name="start_date" type="datetime-local" className="inp"/></label><label className="text-xs">Deadline<input name="deadline" type="datetime-local" className="inp" required/></label>
      <input name="allowed_types" className="inp" defaultValue="pdf,doc,docx,zip" placeholder="Format (pisah koma)"/><input name="max_size_mb" type="number" className="inp" defaultValue="10" placeholder="Maks MB"/>
      <label className="text-sm"><input type="checkbox" name="allow_late"/> Izinkan terlambat</label><label className="text-sm"><input type="checkbox" name="allow_resubmit" defaultChecked/> Izinkan kumpul ulang</label>
      <button className="btn md:col-span-2 justify-center">Simpan Tugas</button></form>}
    <div className="grid lg:grid-cols-2 gap-4"><div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>Tugas</th><th>Deadline</th><th>{me.role==='mahasiswa'?'Status':'Kumpul'}</th></tr></thead><tbody>
      {list.map(a=><tr key={a.id} onClick={()=>open(a)} className="cursor-pointer hover:bg-sky-50 dark:hover:bg-slate-700 border-t border-slate-100 dark:border-slate-700"><td className="py-2"><b>{a.title}</b><br/><span className="text-xs text-slate-500">{a.course}</span></td><td className="text-xs">{fmt(a.deadline)}</td><td>{me.role==='mahasiswa'?<Badge s={status(a)}/>:a.jumlah}</td></tr>)}</tbody></table>{!list.length&&<Empty t="Belum ada tugas"/>}</div>
      <div className="card">{!cur?<Empty t="Pilih tugas untuk melihat detail"/>:<div className="space-y-2"><div className="flex justify-between"><h3 className="font-semibold">{cur.title}</h3>{me.role!=='mahasiswa'&&<button className="btn2" onClick={()=>confirm('Hapus tugas?')&&api('/assignments/'+cur.id,{method:'DELETE'}).then(()=>{setSel(null);load();})}><Trash2 size={12}/></button>}</div>
        <p className="text-sm">{cur.description}</p><p className="text-xs text-slate-500">{cur.course} · {cur.lecturer} · Diberikan {fmt(cur.start_date)} · Deadline {fmt(cur.deadline)}<br/>Format: {cur.allowed_types} · Maks {cur.max_size_mb} MB</p>
        {me.role==='mahasiswa'&&<>{cur.sub_id&&<div className="bg-sky-50 dark:bg-slate-700 rounded p-2 text-sm">Bukti: <b>{cur.submission_no}</b> · {fmt(cur.submitted_at)}<br/><a className="text-sky-600 underline" href={`/api/submissions/${cur.sub_id}/file`}>{cur.file_name}</a>{cur.score!=null&&<p>Nilai: <b>{cur.score}</b></p>}{cur.feedback&&<p>Feedback: {cur.feedback}</p>}</div>}
          {(!cur.sub_id||cur.allow_resubmit==1||cur.sub_status==='Perlu Revisi')&&<div className="space-y-2" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();setFile(e.dataTransfer.files[0]);}}>
            <label className="border-2 border-dashed rounded-lg p-4 grid place-items-center text-sm text-slate-500 cursor-pointer"><Upload size={18}/>{file?`${file.name} (${(file.size/1048576).toFixed(2)} MB)`:'Seret file ke sini atau klik'}<input type="file" hidden onChange={e=>setFile(e.target.files[0])}/></label>
            <textarea className="inp" placeholder="Catatan (opsional)" value={note} onChange={e=>setNote(e.target.value)}/>{err&&<p className="text-red-600 text-sm">{err}</p>}{ok&&<p className="text-emerald-600 text-sm">{ok}</p>}
            <button className="btn" disabled={busy} onClick={send}>{busy?'Mengunggah...':cur.sub_id?'Kumpulkan Ulang':'Kirim Tugas'}</button></div>}</>}
        {me.role==='dosen'&&<div className="space-y-1"><a className="btn2" href={`/api/assignments/${cur.id}/export.csv`}><Download size={12}/>Ekspor CSV</a>
          {subs.map(x=><div key={x.id} className="border-t border-slate-100 dark:border-slate-700 pt-1 text-sm flex flex-wrap justify-between gap-1"><span>{x.student} <span className="text-xs text-slate-500">{x.nim} · {fmt(x.submitted_at)}</span></span>
            <span className="flex gap-1 items-center"><Badge s={x.is_late&&x.status==='Menunggu Penilaian'?'Terlambat':x.status}/>{x.score!=null&&<b>{x.score}</b>}<a className="btn2" href={`/api/submissions/${x.id}/file`}><Download size={12}/></a><button className="btn2" onClick={()=>grade(x.id,false)}>Nilai</button><button className="btn2" onClick={()=>grade(x.id,true)}>Revisi</button></span></div>)}{!subs.length&&<Empty t="Belum ada pengumpulan"/>}</div>}</div>}</div></div></div>;}

function Mahasiswa(){
  const [rows,setRows]=useState([]),[q,setQ]=useState(''),[f,setF]=useState(null),[err,setErr]=useState('');
  const load=useCallback(()=>api('/students').then(setRows),[]);useEffect(()=>{load();},[load]);
  const set=k=>e=>setF({...f,[k]:e.target.type==='checkbox'?e.target.checked:e.target.value});
  const save=async e=>{e.preventDefault();setErr('');try{await api(f.id?'/students/'+f.id:'/students',{method:f.id?'PUT':'POST',body:f});setF(null);load();}catch(x){setErr(x.message);}};
  const edit=r=>{setErr('');setF({id:r.id,name:r.name,email:r.email,identity_number:r.identity_number,class_name:r.class_name||'',semester:r.semester,is_active:!!r.is_active,password:''});};
  const del=r=>confirm(`Hapus ${r.name}? Semua pengumpulan tugasnya ikut terhapus.`)&&api('/students/'+r.id,{method:'DELETE'}).then(load).catch(x=>alert(x.message));
  const list=rows.filter(r=>(r.name+r.email+r.identity_number).toLowerCase().includes(q.toLowerCase()));
  return <div className="space-y-4"><div className="flex gap-2"><input className="inp flex-1" placeholder="Cari nama / NIM / email..." onChange={e=>setQ(e.target.value)}/>
    <button className="btn" onClick={()=>{setErr('');setF({name:'',email:'',identity_number:'',password:'',class_name:'',semester:1,is_active:true});}}><Plus size={14}/>Tambah Mahasiswa</button></div>
    {f&&<form onSubmit={save} className="card grid md:grid-cols-2 gap-2"><h3 className="font-semibold md:col-span-2">{f.id?'Edit Mahasiswa':'Tambah Mahasiswa'}</h3>{err&&<p className="text-red-600 text-sm md:col-span-2">{err}</p>}
      <input className="inp" placeholder="Nama lengkap" required value={f.name} onChange={set('name')}/><input className="inp" placeholder="NIM" required value={f.identity_number} onChange={set('identity_number')}/>
      <input className="inp" type="email" placeholder="Email" required value={f.email} onChange={set('email')}/><input className="inp" type="password" placeholder={f.id?'Password baru (kosongkan jika tidak diubah)':'Password (min. 6)'} required={!f.id} value={f.password} onChange={set('password')}/>
      <input className="inp" placeholder="Kelas (ketik manual, mis. TI-3A)" value={f.class_name} onChange={set('class_name')}/><input className="inp" type="number" min="1" max="14" placeholder="Semester" value={f.semester} onChange={set('semester')}/>
      <label className="text-sm"><input type="checkbox" checked={f.is_active} onChange={set('is_active')}/> Akun aktif</label>
      <div className="flex gap-2 md:col-span-2"><button className="btn">{f.id?'Simpan Perubahan':'Simpan'}</button><button type="button" className="btn2" onClick={()=>setF(null)}>Batal</button></div></form>}
    <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>Nama</th><th>NIM</th><th>Email</th><th>Kelas</th><th>Smt</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
      {list.map(r=><tr key={r.id} className="border-t border-slate-100 dark:border-slate-700"><td className="py-2">{r.name}</td><td>{r.identity_number}</td><td>{r.email}</td><td>{r.class_name||'-'}</td><td>{r.semester}</td><td><span className={`px-2 py-0.5 rounded-full text-xs ${r.is_active?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>{r.is_active?'Aktif':'Nonaktif'}</span></td>
        <td className="flex gap-1 py-2"><button className="btn2" onClick={()=>edit(r)}><Pencil size={12}/>Edit</button><button className="btn2" onClick={()=>del(r)}><Trash2 size={12}/></button></td></tr>)}</tbody></table>{!list.length&&<Empty t="Belum ada data mahasiswa"/>}</div></div>;}

function Dosen(){
  const [rows,setRows]=useState([]),[q,setQ]=useState(''),[f,setF]=useState(null),[err,setErr]=useState('');
  const load=useCallback(()=>api('/lecturers').then(setRows),[]);useEffect(()=>{load();},[load]);
  const set=k=>e=>setF({...f,[k]:e.target.type==='checkbox'?e.target.checked:e.target.value});
  const save=async e=>{e.preventDefault();setErr('');try{await api(f.id?'/lecturers/'+f.id:'/lecturers',{method:f.id?'PUT':'POST',body:f});setF(null);load();}catch(x){setErr(x.message);}};
  const edit=r=>{setErr('');setF({id:r.id,name:r.name,email:r.email,identity_number:r.identity_number,is_active:!!r.is_active,password:''});};
  const del=r=>confirm(`Hapus dosen ${r.name}?`)&&api('/lecturers/'+r.id,{method:'DELETE'}).then(load).catch(x=>alert(x.message));
  const list=rows.filter(r=>(r.name+r.email+r.identity_number).toLowerCase().includes(q.toLowerCase()));
  return <div className="space-y-4"><div className="flex gap-2"><input className="inp flex-1" placeholder="Cari nama / NIP / email..." onChange={e=>setQ(e.target.value)}/>
    <button className="btn" onClick={()=>{setErr('');setF({name:'',email:'',identity_number:'',password:'',is_active:true});}}><Plus size={14}/>Tambah Dosen</button></div>
    {f&&<form onSubmit={save} className="card grid md:grid-cols-2 gap-2"><h3 className="font-semibold md:col-span-2">{f.id?'Edit Dosen':'Tambah Dosen'}</h3>{err&&<p className="text-red-600 text-sm md:col-span-2">{err}</p>}
      <input className="inp" placeholder="Nama lengkap" required value={f.name} onChange={set('name')}/><input className="inp" placeholder="NIP" required value={f.identity_number} onChange={set('identity_number')}/>
      <input className="inp" type="email" placeholder="Email" required value={f.email} onChange={set('email')}/><input className="inp" type="password" placeholder={f.id?'Password baru (kosongkan jika tidak diubah)':'Password (min. 6)'} required={!f.id} value={f.password} onChange={set('password')}/>
      <label className="text-sm md:col-span-2"><input type="checkbox" checked={f.is_active} onChange={set('is_active')}/> Akun aktif</label>
      <div className="flex gap-2 md:col-span-2"><button className="btn">{f.id?'Simpan Perubahan':'Simpan'}</button><button type="button" className="btn2" onClick={()=>setF(null)}>Batal</button></div></form>}
    <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>Nama</th><th>NIP</th><th>Email</th><th>MK</th><th>Tugas</th><th>Materi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
      {list.map(r=><tr key={r.id} className="border-t border-slate-100 dark:border-slate-700"><td className="py-2">{r.name}</td><td>{r.identity_number}</td><td>{r.email}</td><td>{r.courses}</td><td>{r.assignments}</td><td>{r.materials}</td>
        <td><span className={`px-2 py-0.5 rounded-full text-xs ${r.is_active?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>{r.is_active?'Aktif':'Nonaktif'}</span></td>
        <td className="flex gap-1 py-2"><button className="btn2" onClick={()=>edit(r)}><Pencil size={12}/>Edit</button><button className="btn2" onClick={()=>del(r)}><Trash2 size={12}/></button></td></tr>)}</tbody></table>{!list.length&&<Empty t="Belum ada data dosen"/>}</div></div>;}

function MatkulSaya(){
  const [rows,setRows]=useState([]),[f,setF]=useState(null),[err,setErr]=useState('');
  const load=useCallback(()=>api('/me/courses').then(setRows),[]);useEffect(()=>{load();},[load]);const set=k=>e=>setF({...f,[k]:e.target.value});
  const save=async e=>{e.preventDefault();setErr('');try{await api(f.id?'/me/courses/'+f.id:'/me/courses',{method:f.id?'PUT':'POST',body:f});setF(null);load();}catch(x){setErr(x.message);}};
  const del=r=>confirm(`Hapus mata kuliah "${r.name}"? Tugas terkait tidak ikut terhapus.`)&&api('/me/courses/'+r.id,{method:'DELETE'}).then(load).catch(x=>alert(x.message));
  return <div className="space-y-4"><div className="flex justify-between items-center"><p className="text-sm text-slate-500">Mata kuliah pribadi untuk mengelompokkan catatan tugas Anda.</p><button className="btn" onClick={()=>{setErr('');setF({code:'',name:'',lecturer_name:''});}}><Plus size={14}/>Tambah</button></div>
    {f&&<form onSubmit={save} className="card grid md:grid-cols-3 gap-2"><h3 className="font-semibold md:col-span-3">{f.id?'Edit Mata Kuliah':'Tambah Mata Kuliah'}</h3>{err&&<p className="text-red-600 text-sm md:col-span-3">{err}</p>}
      <input className="inp" placeholder="Kode (opsional)" value={f.code||''} onChange={set('code')}/><input className="inp" placeholder="Nama mata kuliah" required value={f.name} onChange={set('name')}/><input className="inp" placeholder="Nama dosen (opsional)" value={f.lecturer_name||''} onChange={set('lecturer_name')}/>
      <div className="flex gap-2 md:col-span-3"><button className="btn">{f.id?'Simpan Perubahan':'Simpan'}</button><button type="button" className="btn2" onClick={()=>setF(null)}>Batal</button></div></form>}
    <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>Kode</th><th>Mata Kuliah</th><th>Dosen</th><th>Tugas</th><th>Aksi</th></tr></thead><tbody>
      {rows.map(r=><tr key={r.id} className="border-t border-slate-100 dark:border-slate-700"><td className="py-2">{r.code||'-'}</td><td>{r.name}</td><td>{r.lecturer_name||'-'}</td><td>{r.jumlah}</td>
        <td className="flex gap-1 py-2"><button className="btn2" onClick={()=>{setErr('');setF({...r});}}><Pencil size={12}/>Edit</button><button className="btn2" onClick={()=>del(r)}><Trash2 size={12}/></button></td></tr>)}</tbody></table>{!rows.length&&<Empty t="Belum ada mata kuliah. Klik Tambah."/>}</div></div>;}

function TugasSaya(){
  const [rows,setRows]=useState([]),[mk,setMk]=useState([]),[f,setF]=useState(null),[err,setErr]=useState(''),[flt,setFlt]=useState('');
  const load=useCallback(()=>{api('/me/tasks').then(setRows);api('/me/courses').then(setMk);},[]);useEffect(()=>{load();},[load]);const set=k=>e=>setF({...f,[k]:e.target.value});
  const body=r=>({title:r.title,description:r.description,deadline:r.deadline,status:r.status,personal_course_id:r.personal_course_id});
  const save=async e=>{e.preventDefault();setErr('');try{await api(f.id?'/me/tasks/'+f.id:'/me/tasks',{method:f.id?'PUT':'POST',body:body(f)});setF(null);load();}catch(x){setErr(x.message);}};
  const toggle=r=>api('/me/tasks/'+r.id,{method:'PUT',body:{...body(r),status:r.status==='Selesai'?'Belum':'Selesai'}}).then(load).catch(x=>alert(x.message));
  const del=r=>confirm(`Hapus tugas "${r.title}"?`)&&api('/me/tasks/'+r.id,{method:'DELETE'}).then(load).catch(x=>alert(x.message));
  const edit=r=>{setErr('');setF({...r,deadline:r.deadline?r.deadline.replace(' ','T').slice(0,16):'',personal_course_id:r.personal_course_id||''});};
  const list=rows.filter(r=>!flt||r.status===flt);
  return <div className="space-y-4"><div className="flex flex-wrap gap-2 justify-between"><select className="inp w-auto" onChange={e=>setFlt(e.target.value)}><option value="">Semua status</option><option>Belum</option><option>Selesai</option></select>
    <button className="btn" onClick={()=>{setErr('');setF({title:'',description:'',deadline:'',status:'Belum',personal_course_id:''});}}><Plus size={14}/>Tambah Tugas</button></div>
    {f&&<form onSubmit={save} className="card grid md:grid-cols-2 gap-2"><h3 className="font-semibold md:col-span-2">{f.id?'Edit Tugas':'Tambah Tugas'}</h3>{err&&<p className="text-red-600 text-sm md:col-span-2">{err}</p>}
      <input className="inp md:col-span-2" placeholder="Judul tugas" required value={f.title} onChange={set('title')}/><textarea className="inp md:col-span-2" placeholder="Deskripsi" value={f.description||''} onChange={set('description')}/>
      <select className="inp" value={f.personal_course_id||''} onChange={set('personal_course_id')}><option value="">Tanpa mata kuliah</option>{mk.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
      <input type="datetime-local" className="inp" value={f.deadline||''} onChange={set('deadline')}/><select className="inp" value={f.status} onChange={set('status')}><option>Belum</option><option>Selesai</option></select>
      <div className="flex gap-2"><button className="btn">{f.id?'Simpan Perubahan':'Simpan'}</button><button type="button" className="btn2" onClick={()=>setF(null)}>Batal</button></div></form>}
    <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>Tugas</th><th>Mata Kuliah</th><th>Deadline</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
      {list.map(r=>{const late=r.status==='Belum'&&r.deadline&&new Date(r.deadline.replace(' ','T'))<new Date();return <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700"><td className="py-2"><b className={r.status==='Selesai'?'line-through text-slate-400':''}>{r.title}</b><br/><span className="text-xs text-slate-500">{r.description}</span></td><td>{r.course||'-'}</td><td className="text-xs">{fmt(r.deadline)}</td>
        <td><Badge s={r.status==='Selesai'?'Sudah Dinilai':late?'Terlambat':'Belum Dikerjakan'}/> <span className="text-xs">{r.status}</span></td>
        <td className="flex gap-1 py-2"><button className="btn2" onClick={()=>toggle(r)}><Check size={12}/>{r.status==='Selesai'?'Batal':'Selesai'}</button><button className="btn2" onClick={()=>edit(r)}><Pencil size={12}/>Edit</button><button className="btn2" onClick={()=>del(r)}><Trash2 size={12}/></button></td></tr>;})}</tbody></table>{!list.length&&<Empty t="Belum ada tugas pribadi. Klik Tambah Tugas."/>}</div></div>;}

function Notif({reload}){
  const [rows,setRows]=useState([]);const load=()=>api('/notifications').then(setRows);useEffect(()=>{load();},[]);
  return <div className="card space-y-2"><button className="btn2" onClick={()=>api('/notifications/read',{method:'POST'}).then(()=>{load();reload();})}><Check size={12}/>Tandai semua dibaca</button>
    {rows.map(n=><div key={n.id} className={`p-2 rounded text-sm ${n.is_read?'':'bg-sky-50 dark:bg-slate-700'}`}><b>{n.title}</b> — {n.message}<span className="block text-xs text-slate-400">{fmt(n.created_at)}</span></div>)}{!rows.length&&<Empty t="Belum ada notifikasi"/>}</div>;}

function Profil({me}){
  const [f,setF]=useState({}),[m,setM]=useState('');
  return <div className="card max-w-md space-y-2"><p><b>{me.name}</b></p><p className="text-sm text-slate-500">{me.email} · {me.identity_number} · {me.role}</p><h3 className="font-semibold pt-2 text-sm">Ubah Password</h3>
    <input type="password" className="inp" placeholder="Password lama" onChange={e=>setF({...f,old_password:e.target.value})}/><input type="password" className="inp" placeholder="Password baru" onChange={e=>setF({...f,new_password:e.target.value})}/>
    <button className="btn" onClick={()=>api('/profile/password',{method:'PUT',body:f}).then(()=>setM('Password berhasil diubah')).catch(x=>setM(x.message))}>Simpan</button>{m&&<p className="text-sm">{m}</p>}</div>;}

export default function App(){
  const [me,setMe]=useState(null),[ready,setReady]=useState(false),[page,setPage]=useState('dashboard'),[open,setOpen]=useState(true),[dark,setDark]=useState(false),[unread,setUnread]=useState(0);
  const boot=useCallback(()=>api('/auth/me').then(setMe).catch(()=>setMe(null)).finally(()=>setReady(true)),[]);useEffect(()=>{boot();},[boot]);
  const count=useCallback(()=>api('/notifications').then(r=>setUnread(r.filter(n=>!n.is_read).length)).catch(()=>{}),[]);useEffect(()=>{if(me)count();},[me,page,count]);
  useEffect(()=>{document.documentElement.classList.toggle('dark',dark);},[dark]);
  if(!ready)return null;if(!me)return <Auth onLogin={boot}/>;
  const nav=[['dashboard','Dashboard',LayoutDashboard],['materi','Materi Kuliah',BookOpen],['tugas','Tugas',ClipboardList],['notif','Notifikasi',Bell],...(me.role==='mahasiswa'?[['matkulku','Mata Kuliah Saya',Library],['tugasku','Tugas Saya',ListTodo]]:[]),...(me.role==='admin'?[['mahasiswa','Data Mahasiswa',Users],['dosen','Data Dosen',GraduationCap]]:[])];
  const View={dashboard:Dashboard,materi:Materi,tugas:Tugas,notif:Notif,profil:Profil,mahasiswa:Mahasiswa,dosen:Dosen,matkulku:MatkulSaya,tugasku:TugasSaya}[page];
  return <div className="min-h-screen flex">
    <aside className={`${open?'w-56':'w-0 -ml-1'} fixed md:static z-20 h-screen overflow-hidden bg-[#0f2a5c] text-white transition-all duration-300 shrink-0`}><div className="p-4 w-56"><Logo/><nav className="mt-6 space-y-1">{nav.map(([k,l,I])=><button key={k} onClick={()=>setPage(k)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${page===k?'bg-sky-500':'hover:bg-white/10'}`}><I size={16}/>{l}</button>)}</nav></div></aside>
    <div className="flex-1 min-w-0"><header className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center gap-3">
      <button onClick={()=>setOpen(!open)}><Menu size={20}/></button><span className="font-semibold capitalize hidden sm:block">{page==='notif'?'Notifikasi':page}</span><div className="flex-1"/>
      <button onClick={()=>setDark(!dark)}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
      <button className="relative" onClick={()=>setPage('notif')}><Bell size={18}/>{unread>0&&<span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] rounded-full px-1.5">{unread}</span>}</button>
      <button className="text-sm text-left" onClick={()=>setPage('profil')}>{me.name}<span className="block text-[10px] text-slate-500 uppercase">{me.role}</span></button>
      <button title="Keluar" onClick={()=>api('/auth/logout',{method:'POST'}).then(()=>setMe(null))}><LogOut size={18}/></button></header>
      <main className="p-4"><View me={me} reload={count}/></main></div></div>;}
