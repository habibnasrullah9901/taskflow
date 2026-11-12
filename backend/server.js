import 'dotenv/config';import express from 'express';import cors from 'cors';import bcrypt from 'bcryptjs';import jwt from 'jsonwebtoken';import multer from 'multer';
import helmet from 'helmet';import cookieParser from 'cookie-parser';import rateLimit from 'express-rate-limit';import path from 'path';import fs from 'fs';import crypto from 'crypto';
import {fileURLToPath} from 'url';import db from './db.js';
const __dir=path.dirname(fileURLToPath(import.meta.url)),UP=process.env.UPLOAD_DIR||path.join(__dir,'uploads'),app=express();fs.mkdirSync(UP,{recursive:true});
const q=async(s,p=[])=>(await db.query(s,p))[0];const one=async(s,p)=>(await q(s,p))[0];
const ah=f=>(a,b,c)=>f(a,b,c).catch(c);
const log=(u,a,d)=>q('INSERT INTO activity_logs(user_id,action,detail) VALUES(?,?,?)',[u,a,d]);
const notify=(uid,t,m)=>q('INSERT INTO notifications(user_id,title,message) VALUES(?,?,?)',[uid,t,m]);
const resolveCourse=async(u,name,classId)=>{ // cari/buat mata kuliah milik dosen dari input manual, lalu daftarkan mahasiswa
  name=(name||'').trim().slice(0,100);if(!name)return null;
  const c=await one('SELECT id FROM courses WHERE lecturer_id=? AND LOWER(name)=LOWER(?)',[u.lid,name]);
  const id=c?c.id:(await db.query('INSERT INTO courses(code,name,lecturer_id) VALUES(?,?,?)',['MK'+Date.now().toString(36).toUpperCase().slice(-8),name,u.lid]))[0].insertId;
  await q('INSERT IGNORE INTO course_enrollments(student_id,course_id) SELECT id,? FROM students'+(classId?' WHERE class_id=?':''),classId?[id,classId]:[id]);return id;};
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));

// Izinkan daftar origin yang diperbolehkan (lokal & Vercel)
const allowedOrigins = [
  'http://localhost:5173',
  'https://task-flo.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS'));
    }
  },
  credentials: true
}));

// CSRF check (di baris 15-16 yang lama)
app.use((req, res, next) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    const o = req.headers.origin;
    if (o && !allowedOrigins.includes(o)) {
      return res.status(403).json({ error: 'Origin tidak diizinkan' });
    }
  }
  next();
});
app.use('/api/auth/login',rateLimit({windowMs:15*60e3,max:20,message:{error:'Terlalu banyak percobaan, coba lagi nanti'}}));
app.use('/api',rateLimit({windowMs:60e3,max:300}));
// ---------- Auth ----------
const cookieOpt={httpOnly:true,sameSite:'strict',secure:process.env.COOKIE_SECURE==='true',maxAge:8*3600e3};
const auth=(...roles)=>ah(async(req,res,next)=>{
  try{var d=jwt.verify(req.cookies.token,process.env.JWT_SECRET)}catch{return res.status(401).json({error:'Silakan login'})}
  const u=await one('SELECT id,name,email,identity_number,role,is_active FROM users WHERE id=?',[d.id]);
  if(!u||!u.is_active)return res.status(401).json({error:'Akun tidak aktif'});
  if(roles.length&&!roles.includes(u.role))return res.status(403).json({error:'Tidak punya akses'});
  const s=await one('SELECT id,class_id FROM students WHERE user_id=?',[u.id]),l=await one('SELECT id FROM lecturers WHERE user_id=?',[u.id]);
  req.user={...u,sid:s?.id,cid:s?.class_id,lid:l?.id};next();});
app.post('/api/auth/login',ah(async(req,res)=>{
  const {login,password}=req.body;if(!login||!password)return res.status(400).json({error:'Isi semua kolom'});
  const u=await one('SELECT * FROM users WHERE email=? OR identity_number=?',[login,login]);
  if(!u||!bcrypt.compareSync(password,u.password_hash))return res.status(401).json({error:'Email/NIM/NIP atau password salah'});
  if(!u.is_active)return res.status(403).json({error:'Akun dinonaktifkan'});
  res.cookie('token',jwt.sign({id:u.id},process.env.JWT_SECRET,{expiresIn:'8h'}),cookieOpt);await log(u.id,'login','Login');
  res.json({id:u.id,name:u.name,role:u.role});}));
app.post('/api/auth/register',ah(async(req,res)=>{
  const {name,email,identity_number,password,role}=req.body;
  if(!name||!/^\S+@\S+\.\S+$/.test(email||'')||!identity_number||(password||'').length<6||!['mahasiswa','dosen'].includes(role))return res.status(400).json({error:'Data tidak valid (password min. 6 karakter)'});
  if(await one('SELECT id FROM users WHERE email=? OR identity_number=?',[email,identity_number]))return res.status(409).json({error:'Email/NIM/NIP sudah terdaftar'});
  const id=(await db.query('INSERT INTO users(name,email,identity_number,password_hash,role) VALUES(?,?,?,?,?)',[name,email,identity_number,bcrypt.hashSync(password,10),role]))[0].insertId;
  await q(role==='dosen'?'INSERT INTO lecturers(user_id) VALUES(?)':'INSERT INTO students(user_id) VALUES(?)',[id]);res.json({ok:true});}));
app.post('/api/auth/forgot',ah(async(req,res)=>{
  const u=await one('SELECT id FROM users WHERE email=?',[req.body.email]);
  if(u){const t=crypto.randomBytes(24).toString('hex');await q('UPDATE users SET reset_token=?,reset_expires=DATE_ADD(NOW(),INTERVAL 30 MINUTE) WHERE id=?',[t,u.id]);
    console.log('LINK RESET PASSWORD (demo, pengganti email): http://localhost:5173/?reset='+t);}
  res.json({ok:true,message:'Jika email terdaftar, tautan reset dikirim (lihat terminal backend pada mode demo).'});}));
app.post('/api/auth/reset',ah(async(req,res)=>{
  const {token,password}=req.body;if((password||'').length<6)return res.status(400).json({error:'Password min. 6 karakter'});
  const u=await one('SELECT id FROM users WHERE reset_token=? AND reset_expires>NOW()',[token||'x']);if(!u)return res.status(400).json({error:'Token tidak valid/kedaluwarsa'});
  await q('UPDATE users SET password_hash=?,reset_token=NULL WHERE id=?',[bcrypt.hashSync(password,10),u.id]);res.json({ok:true});}));
app.post('/api/auth/logout',(req,res)=>{res.clearCookie('token');res.json({ok:true});});
app.get('/api/auth/me',auth(),(req,res)=>res.json(req.user));
// ---------- Upload aman ----------
const ALLOWED=['pdf','doc','docx','ppt','pptx','xls','xlsx','zip','rar','jpg','jpeg','png','mp4'];
const MAGIC={pdf:'25504446',zip:'504b0304',docx:'504b0304',pptx:'504b0304',xlsx:'504b0304',doc:'d0cf11e0',ppt:'d0cf11e0',xls:'d0cf11e0',rar:'52617221',png:'89504e47',jpg:'ffd8ff',jpeg:'ffd8ff'};
const upload=multer({storage:multer.diskStorage({destination:UP,filename:(r,f,cb)=>cb(null,crypto.randomBytes(16).toString('hex')+path.extname(f.originalname).toLowerCase())}),
  limits:{fileSize:50*1024*1024},fileFilter:(r,f,cb)=>cb(ALLOWED.includes(path.extname(f.originalname).slice(1).toLowerCase())?null:new Error('Format file tidak didukung'),true)});
function validFile(f,types,maxMB){ // cek ekstensi, ukuran, dan isi file (magic bytes)
  const ext=path.extname(f.originalname).slice(1).toLowerCase();let err=null;
  if(types&&!types.split(',').includes(ext))err='Format harus: '+types;
  else if(maxMB&&f.size>maxMB*1048576)err='Ukuran maksimal '+maxMB+' MB';
  else if(MAGIC[ext]){const b=Buffer.alloc(4);const fd=fs.openSync(f.path,'r');fs.readSync(fd,b,0,4,0);fs.closeSync(fd);if(!b.toString('hex').startsWith(MAGIC[ext]))err='Isi file tidak sesuai ekstensi';}
  if(err)fs.unlink(f.path,()=>{});return err;}
const send=(res,dir,stored,name,inline)=>{const p=path.join(UP,path.basename(stored));res.setHeader('Content-Disposition',`${inline?'inline':'attachment'}; filename="${encodeURIComponent(name)}"`);res.sendFile(p);};
// ---------- Dashboard ----------
app.get('/api/dashboard',auth(),ah(async(req,res)=>{
  const u=req.user;let stats={},chart=[],upcoming=[],ann=await q('SELECT title,body,created_at FROM announcements ORDER BY id DESC LIMIT 3');
  if(u.role==='mahasiswa'){
    const A="FROM assignments a JOIN course_enrollments e ON e.course_id=a.course_id AND e.student_id=? LEFT JOIN submissions s ON s.assignment_id=a.id AND s.student_id=e.student_id WHERE (a.class_id IS NULL OR a.class_id=?)";
    const P=[u.sid,u.cid];const c=await one(`SELECT COUNT(*) total,SUM(s.id IS NULL) belum,SUM(s.id IS NOT NULL) kumpul,SUM(s.status='Sudah Dinilai') nilai,SUM(s.is_late=1) terlambat ${A}`,P);
    const m=await one("SELECT COUNT(*) n FROM course_materials m JOIN course_enrollments e ON e.course_id=m.course_id AND e.student_id=? WHERE m.status='published' AND (m.class_id IS NULL OR m.class_id=?)",P);
    stats={'Total Tugas':c.total,'Belum Dikerjakan':c.belum||0,'Sudah Dikumpulkan':c.kumpul||0,'Sudah Dinilai':c.nilai||0,'Terlambat':c.terlambat||0,'Total Materi':m.n};
    chart=await q("SELECT a.title name,g.score nilai FROM grades g JOIN submissions s ON s.id=g.submission_id JOIN assignments a ON a.id=s.assignment_id WHERE s.student_id=? ORDER BY g.graded_at",[u.sid]);
    upcoming=await q(`SELECT a.id,a.title,a.deadline ${A} AND s.id IS NULL AND a.deadline>NOW() ORDER BY a.deadline LIMIT 5`,P);
  }else if(u.role==='dosen'){
    const c=await one("SELECT (SELECT COUNT(*) FROM courses WHERE lecturer_id=?) mk,(SELECT COUNT(DISTINCT e.student_id) FROM course_enrollments e JOIN courses c ON c.id=e.course_id WHERE c.lecturer_id=?) mhs,(SELECT COUNT(*) FROM assignments WHERE lecturer_id=?) tugas,(SELECT COUNT(*) FROM submissions s JOIN assignments a ON a.id=s.assignment_id WHERE a.lecturer_id=?) kumpul,(SELECT COUNT(*) FROM submissions s JOIN assignments a ON a.id=s.assignment_id WHERE a.lecturer_id=? AND s.status='Menunggu Penilaian') blm,(SELECT COUNT(*) FROM course_materials WHERE lecturer_id=?) materi",Array(6).fill(u.lid));
    stats={'Mata Kuliah':c.mk,'Mahasiswa':c.mhs,'Tugas Dibuat':c.tugas,'Pengumpulan':c.kumpul,'Belum Dinilai':c.blm,'Materi':c.materi};
    chart=await q("SELECT a.title name,COUNT(s.id) dikumpulkan,(SELECT COUNT(*) FROM course_enrollments e WHERE e.course_id=a.course_id)-COUNT(s.id) belum FROM assignments a LEFT JOIN submissions s ON s.assignment_id=a.id WHERE a.lecturer_id=? GROUP BY a.id ORDER BY a.id DESC LIMIT 8",[u.lid]);
    upcoming=await q("SELECT a.title,a.deadline,st.name student FROM assignments a JOIN course_enrollments e ON e.course_id=a.course_id JOIN students s ON s.id=e.student_id JOIN users st ON st.id=s.user_id LEFT JOIN submissions sb ON sb.assignment_id=a.id AND sb.student_id=s.id WHERE a.lecturer_id=? AND sb.id IS NULL ORDER BY a.deadline LIMIT 8",[u.lid]);
  }else{
    const c=await one("SELECT (SELECT COUNT(*) FROM users WHERE role='mahasiswa') mhs,(SELECT COUNT(*) FROM users WHERE role='dosen') dsn,(SELECT COUNT(*) FROM courses) mk,(SELECT COUNT(*) FROM assignments) tugas,(SELECT COUNT(*) FROM submissions) kumpul,(SELECT COUNT(*) FROM course_materials) materi");
    stats={'Mahasiswa':c.mhs,'Dosen':c.dsn,'Mata Kuliah':c.mk,'Tugas':c.tugas,'Pengumpulan':c.kumpul,'Materi':c.materi};
    chart=await q("SELECT DATE(created_at) name,COUNT(*) aktivitas FROM activity_logs GROUP BY DATE(created_at) ORDER BY 1 DESC LIMIT 7");
    upcoming=await q("SELECT l.action title,l.created_at deadline,u.name student FROM activity_logs l LEFT JOIN users u ON u.id=l.user_id ORDER BY l.id DESC LIMIT 8");
  }
  res.json({stats,chart,upcoming,announcements:ann});}));
// ---------- Mata kuliah ----------
app.get('/api/courses',auth(),ah(async(req,res)=>{const u=req.user;
  res.json(u.role==='dosen'?await q('SELECT * FROM courses WHERE lecturer_id=?',[u.lid]):u.role==='admin'?await q('SELECT * FROM courses'):await q('SELECT c.* FROM courses c JOIN course_enrollments e ON e.course_id=c.id WHERE e.student_id=?',[u.sid]));}));
app.get('/api/classes',auth('dosen','admin'),ah(async(req,res)=>res.json(await q('SELECT * FROM classes'))));
// ---------- Materi ----------
const MSEL="SELECT m.*,c.name course,c.code,u.name lecturer,a.file_name,a.mime,a.id att FROM course_materials m JOIN courses c ON c.id=m.course_id JOIN lecturers l ON l.id=m.lecturer_id JOIN users u ON u.id=l.user_id LEFT JOIN material_attachments a ON a.material_id=m.id";
app.get('/api/materials',auth(),ah(async(req,res)=>{const u=req.user;let rows;
  if(u.role==='mahasiswa')rows=await q(`${MSEL} JOIN course_enrollments e ON e.course_id=m.course_id AND e.student_id=? WHERE m.status='published' AND (m.class_id IS NULL OR m.class_id=?) ORDER BY c.name,m.meeting_no`,[u.sid,u.cid]);
  else if(u.role==='dosen')rows=await q(`${MSEL} WHERE m.lecturer_id=? ORDER BY c.name,m.meeting_no`,[u.lid]);else rows=await q(`${MSEL} ORDER BY c.name,m.meeting_no`);
  if(u.role==='mahasiswa'){const d=new Set((await q('SELECT material_id FROM material_progress WHERE student_id=?',[u.sid])).map(r=>r.material_id));rows.forEach(r=>r.done=d.has(r.id));}
  else for(const r of rows)r.learned=(await one('SELECT COUNT(*) n FROM material_progress WHERE material_id=?',[r.id])).n;
  res.json(rows);}));
app.post('/api/materials',auth('dosen'),upload.single('file'),ah(async(req,res)=>{
  const b=req.body;if(!b.title||!(b.course_name||'').trim()){if(req.file)fs.unlink(req.file.path,()=>{});return res.status(400).json({error:'Judul dan mata kuliah wajib diisi'});}
  b.course_id=await resolveCourse(req.user,b.course_name,b.class_id);
  if(req.file){const e=validFile(req.file,null,50);if(e)return res.status(400).json({error:e});}
  const id=(await db.query('INSERT INTO course_materials(course_id,lecturer_id,class_id,title,description,meeting_no,publish_date,video_url,reference_url,status) VALUES(?,?,?,?,?,?,?,?,?,?)',
    [b.course_id,req.user.lid,b.class_id||null,b.title,b.description||'',b.meeting_no||1,b.publish_date||new Date(),b.video_url||null,b.reference_url||null,['draft','published','hidden'].includes(b.status)?b.status:'draft']))[0].insertId;
  if(req.file)await q('INSERT INTO material_attachments(material_id,file_name,stored_name,mime,file_size) VALUES(?,?,?,?,?)',[id,req.file.originalname,req.file.filename,req.file.mimetype,req.file.size]);
  if(b.status==='published')for(const s of await q('SELECT s.user_id FROM students s JOIN course_enrollments e ON e.student_id=s.id WHERE e.course_id=?',[b.course_id]))await notify(s.user_id,'Materi baru',b.title);
  await log(req.user.id,'materi_tambah',b.title);res.json({id});}));
app.put('/api/materials/:id/status',auth('dosen'),ah(async(req,res)=>{
  if(!['draft','published','hidden'].includes(req.body.status))return res.status(400).json({error:'Status tidak valid'});
  await q('UPDATE course_materials SET status=? WHERE id=? AND lecturer_id=?',[req.body.status,req.params.id,req.user.lid]);res.json({ok:true});}));
app.delete('/api/materials/:id',auth('dosen','admin'),ah(async(req,res)=>{
  const m=await one('SELECT m.id,a.stored_name FROM course_materials m LEFT JOIN material_attachments a ON a.material_id=m.id WHERE m.id=?'+(req.user.role==='dosen'?' AND m.lecturer_id=?':''),[req.params.id,req.user.lid]);
  if(!m)return res.status(404).json({error:'Tidak ditemukan'});if(m.stored_name)fs.unlink(path.join(UP,m.stored_name),()=>{});
  await q('DELETE FROM course_materials WHERE id=?',[m.id]);res.json({ok:true});}));
app.post('/api/materials/:id/progress',auth('mahasiswa'),ah(async(req,res)=>{
  const m=await one("SELECT m.id,l.user_id lu,m.title FROM course_materials m JOIN lecturers l ON l.id=m.lecturer_id JOIN course_enrollments e ON e.course_id=m.course_id AND e.student_id=? WHERE m.id=? AND m.status='published'",[req.user.sid,req.params.id]);
  if(!m)return res.status(403).json({error:'Tidak punya akses'});
  await q('INSERT IGNORE INTO material_progress(material_id,student_id,completed_at) VALUES(?,?,NOW())',[m.id,req.user.sid]);
  await notify(m.lu,'Materi diselesaikan',req.user.name+' menyelesaikan '+m.title);res.json({ok:true});}));
app.get('/api/materials/:id/file',auth(),ah(async(req,res)=>{const u=req.user;
  const f=await one("SELECT a.*,m.lecturer_id,m.status,m.course_id,m.class_id FROM material_attachments a JOIN course_materials m ON m.id=a.material_id WHERE m.id=?",[req.params.id]);
  if(!f)return res.status(404).json({error:'File tidak ada'});
  const ok=u.role==='admin'||(u.role==='dosen'&&f.lecturer_id===u.lid)||(u.role==='mahasiswa'&&f.status==='published'&&(!f.class_id||f.class_id===u.cid)&&await one('SELECT id FROM course_enrollments WHERE student_id=? AND course_id=?',[u.sid,f.course_id]));
  if(!ok)return res.status(403).json({error:'Tidak punya akses'});send(res,UP,f.stored_name,f.file_name,req.query.inline==='1');}));
// ---------- Tugas ----------
app.get('/api/assignments',auth(),ah(async(req,res)=>{const u=req.user;
  const B="SELECT a.*,c.name course,uu.name lecturer";const J=" FROM assignments a JOIN courses c ON c.id=a.course_id JOIN lecturers l ON l.id=a.lecturer_id JOIN users uu ON uu.id=l.user_id";
  if(u.role==='mahasiswa')return res.json(await q(`${B},s.id sub_id,s.submission_no,s.status sub_status,s.is_late,s.submitted_at,s.file_name,s.note,g.score,g.feedback${J} JOIN course_enrollments e ON e.course_id=a.course_id AND e.student_id=? LEFT JOIN submissions s ON s.assignment_id=a.id AND s.student_id=e.student_id LEFT JOIN grades g ON g.submission_id=s.id WHERE (a.class_id IS NULL OR a.class_id=?) AND (a.start_date IS NULL OR a.start_date<=NOW()) ORDER BY a.deadline`,[u.sid,u.cid]));
  if(u.role==='dosen')return res.json(await q(`${B},(SELECT COUNT(*) FROM submissions WHERE assignment_id=a.id) jumlah${J} WHERE a.lecturer_id=? ORDER BY a.id DESC`,[u.lid]));
  res.json(await q(`${B},(SELECT COUNT(*) FROM submissions WHERE assignment_id=a.id) jumlah${J} ORDER BY a.id DESC`));}));
app.post('/api/assignments',auth('dosen'),ah(async(req,res)=>{const b=req.body;
  if(!b.title||!b.deadline||!(b.course_name||'').trim())return res.status(400).json({error:'Judul, mata kuliah, dan deadline wajib'});
  b.course_id=await resolveCourse(req.user,b.course_name,b.class_id);
  const id=(await db.query('INSERT INTO assignments(course_id,class_id,lecturer_id,title,description,start_date,deadline,allowed_types,max_size_mb,allow_late,allow_resubmit) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    [b.course_id,b.class_id||null,req.user.lid,b.title,b.description||'',b.start_date||new Date(),b.deadline,b.allowed_types||'pdf,doc,docx,zip',b.max_size_mb||10,b.allow_late?1:0,b.allow_resubmit===false?0:1]))[0].insertId;
  for(const s of await q('SELECT s.user_id FROM students s JOIN course_enrollments e ON e.student_id=s.id WHERE e.course_id=?',[b.course_id]))await notify(s.user_id,'Tugas baru',b.title);
  await log(req.user.id,'tugas_buat',b.title);res.json({id});}));
app.delete('/api/assignments/:id',auth('dosen','admin'),ah(async(req,res)=>{
  await q('DELETE FROM assignments WHERE id=?'+(req.user.role==='dosen'?' AND lecturer_id=?':''),[req.params.id,req.user.lid]);res.json({ok:true});}));
app.post('/api/assignments/:id/submit',auth('mahasiswa'),upload.single('file'),ah(async(req,res)=>{
  const f=req.file,fail=(c,m)=>{if(f)fs.unlink(f.path,()=>{});return res.status(c).json({error:m});};
  const a=await one('SELECT a.*,l.user_id lu FROM assignments a JOIN lecturers l ON l.id=a.lecturer_id JOIN course_enrollments e ON e.course_id=a.course_id AND e.student_id=? WHERE a.id=? AND (a.class_id IS NULL OR a.class_id=?)',[req.user.sid,req.params.id,req.user.cid]);
  if(!a)return fail(403,'Tugas tidak ditemukan / bukan hak akses Anda');if(!f)return fail(400,'Pilih file terlebih dahulu');
  const late=new Date()>new Date(a.deadline.replace(' ','T'));if(late&&!a.allow_late)return fail(400,'Deadline sudah lewat');
  const err=validFile(f,a.allowed_types,a.max_size_mb);if(err)return res.status(400).json({error:err});
  const old=await one('SELECT * FROM submissions WHERE assignment_id=? AND student_id=?',[a.id,req.user.sid]);
  if(old){if(!a.allow_resubmit&&old.status!=='Perlu Revisi'){fs.unlink(f.path,()=>{});return res.status(400).json({error:'Pengumpulan ulang tidak diizinkan'});}
    await q('INSERT INTO submission_history(submission_id,file_name,stored_name,note,submitted_at) VALUES(?,?,?,?,?)',[old.id,old.file_name,old.stored_name,old.note,old.submitted_at]);
    await q("UPDATE submissions SET file_name=?,stored_name=?,file_size=?,note=?,status='Menunggu Penilaian',is_late=?,submitted_at=NOW() WHERE id=?",[f.originalname,f.filename,f.size,req.body.note||'',late?1:0,old.id]);
    await notify(a.lu,'Pengumpulan ulang',req.user.name+' mengumpulkan ulang '+a.title);return res.json({submission_no:old.submission_no});}
  const no='SUB-'+Date.now().toString(36).toUpperCase();
  await q('INSERT INTO submissions(submission_no,assignment_id,student_id,file_name,stored_name,file_size,note,is_late,submitted_at) VALUES(?,?,?,?,?,?,?,?,NOW())',[no,a.id,req.user.sid,f.originalname,f.filename,f.size,req.body.note||'',late?1:0]);
  await notify(a.lu,'Tugas dikumpulkan',req.user.name+' mengumpulkan '+a.title);await notify(req.user.id,'Tugas berhasil dikumpulkan',a.title+' ('+no+')');
  await log(req.user.id,'submit',a.title);res.json({submission_no:no});}));
app.get('/api/assignments/:id/submissions',auth('dosen','admin'),ah(async(req,res)=>{
  const a=await one('SELECT * FROM assignments WHERE id=?'+(req.user.role==='dosen'?' AND lecturer_id=?':''),[req.params.id,req.user.lid]);if(!a)return res.status(403).json({error:'Tidak punya akses'});
  res.json(await q('SELECT s.*,u.name student,st.user_id,u.identity_number nim,g.score,g.feedback FROM submissions s JOIN students st ON st.id=s.student_id JOIN users u ON u.id=st.user_id LEFT JOIN grades g ON g.submission_id=s.id WHERE s.assignment_id=? ORDER BY s.submitted_at',[a.id]));}));
app.get('/api/submissions/:id/history',auth(),ah(async(req,res)=>res.json(await q('SELECT h.file_name,h.note,h.submitted_at FROM submission_history h JOIN submissions s ON s.id=h.submission_id WHERE s.id=? AND (?=\'dosen\' OR s.student_id=?) ORDER BY h.id DESC',[req.params.id,req.user.role,req.user.sid||0]))));
app.get('/api/submissions/:id/file',auth(),ah(async(req,res)=>{const u=req.user;
  const s=await one('SELECT s.*,a.lecturer_id FROM submissions s JOIN assignments a ON a.id=s.assignment_id WHERE s.id=?',[req.params.id]);
  if(!s||!(u.role==='admin'||(u.role==='dosen'&&s.lecturer_id===u.lid)||(u.role==='mahasiswa'&&s.student_id===u.sid)))return res.status(403).json({error:'Tidak punya akses'});
  send(res,UP,s.stored_name,s.file_name);}));
app.put('/api/submissions/:id/grade',auth('dosen'),ah(async(req,res)=>{
  const {score,feedback,revise}=req.body;const s=await one('SELECT s.id,st.user_id,a.title FROM submissions s JOIN assignments a ON a.id=s.assignment_id JOIN students st ON st.id=s.student_id WHERE s.id=? AND a.lecturer_id=?',[req.params.id,req.user.lid]);
  if(!s)return res.status(403).json({error:'Tidak punya akses'});const n=Number(score);
  if(!revise&&(!Number.isInteger(n)||n<0||n>100))return res.status(400).json({error:'Nilai harus 0-100'});
  await q('INSERT INTO grades(submission_id,score,feedback,graded_by,graded_at) VALUES(?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE score=VALUES(score),feedback=VALUES(feedback),graded_by=VALUES(graded_by),graded_at=NOW()',[s.id,revise?null:n,feedback||'',req.user.lid]);
  await q('UPDATE submissions SET status=? WHERE id=?',[revise?'Perlu Revisi':'Sudah Dinilai',s.id]);
  await notify(s.user_id,revise?'Tugas perlu direvisi':'Tugas sudah dinilai',s.title);await log(req.user.id,'nilai',s.title);res.json({ok:true});}));
app.get('/api/assignments/:id/export.csv',auth('dosen','admin'),ah(async(req,res)=>{
  const a=await one('SELECT title FROM assignments WHERE id=?'+(req.user.role==='dosen'?' AND lecturer_id=?':''),[req.params.id,req.user.lid]);if(!a)return res.status(403).end();
  const r=await q('SELECT u.identity_number nim,u.name,s.submitted_at,s.is_late,s.status,g.score FROM submissions s JOIN students st ON st.id=s.student_id JOIN users u ON u.id=st.user_id LEFT JOIN grades g ON g.submission_id=s.id WHERE s.assignment_id=?',[req.params.id]);
  const esc=v=>`"${String(v??'').replace(/"/g,'""').replace(/^[=+\-@]/,"'$&")}"`;
  res.type('text/csv').attachment('rekap-nilai.csv').send('\ufeffNIM,Nama,Waktu Kumpul,Terlambat,Status,Nilai\n'+r.map(x=>[x.nim,x.name,x.submitted_at,x.is_late?'Ya':'Tidak',x.status,x.score].map(esc).join(',')).join('\n'));}));
// ---------- Data Mahasiswa (CRUD, khusus admin) ----------
const classByName=async n=>{n=(n||'').trim().slice(0,50);if(!n)return null;const c=await one('SELECT id FROM classes WHERE LOWER(name)=LOWER(?)',[n]);return c?c.id:(await db.query('INSERT INTO classes(name) VALUES(?)',[n]))[0].insertId;};
const enrollByClass=(sid,cid)=>q('INSERT IGNORE INTO course_enrollments(student_id,course_id) SELECT ?,course_id FROM (SELECT course_id FROM assignments WHERE class_id=? OR class_id IS NULL UNION SELECT course_id FROM course_materials WHERE class_id=? OR class_id IS NULL) t',[sid,cid,cid]);
const badStudent=(b,isNew)=>!(b.name||'').trim()?'Nama wajib diisi':!/^\S+@\S+\.\S+$/.test(b.email||'')?'Email tidak valid':!(b.identity_number||'').trim()?'NIM wajib diisi':(isNew||b.password)&&(b.password||'').length<6?'Password min. 6 karakter':null;
app.get('/api/students',auth('admin'),ah(async(req,res)=>res.json(await q('SELECT s.id,u.name,u.email,u.identity_number,u.is_active,s.semester,c.name class_name FROM students s JOIN users u ON u.id=s.user_id LEFT JOIN classes c ON c.id=s.class_id ORDER BY u.name'))));
app.post('/api/students',auth('admin'),ah(async(req,res)=>{const b=req.body,e=badStudent(b,true);if(e)return res.status(400).json({error:e});
  if(await one('SELECT id FROM users WHERE email=? OR identity_number=?',[b.email,b.identity_number]))return res.status(409).json({error:'Email/NIM sudah terdaftar'});
  const uid=(await db.query("INSERT INTO users(name,email,identity_number,password_hash,role,is_active) VALUES(?,?,?,?,'mahasiswa',?)",[b.name.trim(),b.email,b.identity_number.trim(),bcrypt.hashSync(b.password,10),b.is_active===false?0:1]))[0].insertId;
  const cid=await classByName(b.class_name);const sid=(await db.query('INSERT INTO students(user_id,class_id,semester) VALUES(?,?,?)',[uid,cid,b.semester||1]))[0].insertId;
  await enrollByClass(sid,cid);await log(req.user.id,'mahasiswa_tambah',b.name);res.json({id:sid});}));
app.put('/api/students/:id',auth('admin'),ah(async(req,res)=>{const b=req.body,e=badStudent(b,false);if(e)return res.status(400).json({error:e});
  const st=await one('SELECT id,user_id FROM students WHERE id=?',[req.params.id]);if(!st)return res.status(404).json({error:'Mahasiswa tidak ditemukan'});
  if(await one('SELECT id FROM users WHERE (email=? OR identity_number=?) AND id<>?',[b.email,b.identity_number,st.user_id]))return res.status(409).json({error:'Email/NIM sudah dipakai akun lain'});
  await q('UPDATE users SET name=?,email=?,identity_number=?,is_active=? WHERE id=?',[b.name.trim(),b.email,b.identity_number.trim(),b.is_active===false?0:1,st.user_id]);
  if(b.password)await q('UPDATE users SET password_hash=? WHERE id=?',[bcrypt.hashSync(b.password,10),st.user_id]);
  const cid=await classByName(b.class_name);await q('UPDATE students SET class_id=?,semester=? WHERE id=?',[cid,b.semester||1,st.id]);
  await enrollByClass(st.id,cid);await log(req.user.id,'mahasiswa_edit',b.name);res.json({ok:true});}));
app.delete('/api/students/:id',auth('admin'),ah(async(req,res)=>{
  const st=await one('SELECT s.id,s.user_id,u.name FROM students s JOIN users u ON u.id=s.user_id WHERE s.id=?',[req.params.id]);if(!st)return res.status(404).json({error:'Mahasiswa tidak ditemukan'});
  for(const f of await q('SELECT stored_name FROM submissions WHERE student_id=? UNION SELECT h.stored_name FROM submission_history h JOIN submissions s ON s.id=h.submission_id WHERE s.student_id=?',[st.id,st.id]))if(f.stored_name)fs.unlink(path.join(UP,f.stored_name),()=>{});
  await q('DELETE FROM users WHERE id=?',[st.user_id]);await log(req.user.id,'mahasiswa_hapus',st.name);res.json({ok:true});}));
// ---------- Data Dosen (CRUD, khusus admin) ----------
const badLecturer=(b,isNew)=>!(b.name||'').trim()?'Nama wajib diisi':!/^\S+@\S+\.\S+$/.test(b.email||'')?'Email tidak valid':!(b.identity_number||'').trim()?'NIP wajib diisi':(isNew||b.password)&&(b.password||'').length<6?'Password min. 6 karakter':null;
app.get('/api/lecturers',auth('admin'),ah(async(req,res)=>res.json(await q('SELECT l.id,u.name,u.email,u.identity_number,u.is_active,(SELECT COUNT(*) FROM courses WHERE lecturer_id=l.id) courses,(SELECT COUNT(*) FROM assignments WHERE lecturer_id=l.id) assignments,(SELECT COUNT(*) FROM course_materials WHERE lecturer_id=l.id) materials FROM lecturers l JOIN users u ON u.id=l.user_id ORDER BY u.name'))));
app.post('/api/lecturers',auth('admin'),ah(async(req,res)=>{const b=req.body,e=badLecturer(b,true);if(e)return res.status(400).json({error:e});
  if(await one('SELECT id FROM users WHERE email=? OR identity_number=?',[b.email,b.identity_number]))return res.status(409).json({error:'Email/NIP sudah terdaftar'});
  const uid=(await db.query("INSERT INTO users(name,email,identity_number,password_hash,role,is_active) VALUES(?,?,?,?,'dosen',?)",[b.name.trim(),b.email,b.identity_number.trim(),bcrypt.hashSync(b.password,10),b.is_active===false?0:1]))[0].insertId;
  const id=(await db.query('INSERT INTO lecturers(user_id) VALUES(?)',[uid]))[0].insertId;await log(req.user.id,'dosen_tambah',b.name);res.json({id});}));
app.put('/api/lecturers/:id',auth('admin'),ah(async(req,res)=>{const b=req.body,e=badLecturer(b,false);if(e)return res.status(400).json({error:e});
  const l=await one('SELECT id,user_id FROM lecturers WHERE id=?',[req.params.id]);if(!l)return res.status(404).json({error:'Dosen tidak ditemukan'});
  if(await one('SELECT id FROM users WHERE (email=? OR identity_number=?) AND id<>?',[b.email,b.identity_number,l.user_id]))return res.status(409).json({error:'Email/NIP sudah dipakai akun lain'});
  await q('UPDATE users SET name=?,email=?,identity_number=?,is_active=? WHERE id=?',[b.name.trim(),b.email,b.identity_number.trim(),b.is_active===false?0:1,l.user_id]);
  if(b.password)await q('UPDATE users SET password_hash=? WHERE id=?',[bcrypt.hashSync(b.password,10),l.user_id]);
  await log(req.user.id,'dosen_edit',b.name);res.json({ok:true});}));
app.delete('/api/lecturers/:id',auth('admin'),ah(async(req,res)=>{
  const l=await one('SELECT l.id,l.user_id,u.name,(SELECT COUNT(*) FROM courses WHERE lecturer_id=l.id)+(SELECT COUNT(*) FROM assignments WHERE lecturer_id=l.id)+(SELECT COUNT(*) FROM course_materials WHERE lecturer_id=l.id)+(SELECT COUNT(*) FROM grades WHERE graded_by=l.id) n FROM lecturers l JOIN users u ON u.id=l.user_id WHERE l.id=?',[req.params.id]);
  if(!l)return res.status(404).json({error:'Dosen tidak ditemukan'});
  if(l.n>0)return res.status(409).json({error:'Dosen ini masih memiliki mata kuliah/tugas/materi/nilai. Nonaktifkan akunnya saja agar data tetap aman.'});
  await q('DELETE FROM users WHERE id=?',[l.user_id]);await log(req.user.id,'dosen_hapus',l.name);res.json({ok:true});}));
// ---------- Mata kuliah & tugas pribadi mahasiswa (CRUD, hanya milik sendiri) ----------
const bad=(res,m)=>res.status(400).json({error:m});
const dt=v=>!v?null:(String(v).replace('T',' ').length===16?String(v).replace('T',' ')+':00':String(v).replace('T',' '));
app.get('/api/me/courses',auth('mahasiswa'),ah(async(req,res)=>res.json(await q('SELECT pc.*,(SELECT COUNT(*) FROM personal_tasks WHERE personal_course_id=pc.id) jumlah FROM personal_courses pc WHERE student_id=? ORDER BY name',[req.user.sid]))));
app.post('/api/me/courses',auth('mahasiswa'),ah(async(req,res)=>{const b=req.body;if(!(b.name||'').trim())return bad(res,'Nama mata kuliah wajib diisi');
  const id=(await db.query('INSERT INTO personal_courses(student_id,code,name,lecturer_name) VALUES(?,?,?,?)',[req.user.sid,(b.code||'').trim().slice(0,15),b.name.trim().slice(0,100),(b.lecturer_name||'').trim().slice(0,100)]))[0].insertId;
  await log(req.user.id,'matkul_pribadi_tambah',b.name);res.json({id});}));
app.put('/api/me/courses/:id',auth('mahasiswa'),ah(async(req,res)=>{const b=req.body;if(!(b.name||'').trim())return bad(res,'Nama mata kuliah wajib diisi');
  const r=await q('UPDATE personal_courses SET code=?,name=?,lecturer_name=? WHERE id=? AND student_id=?',[(b.code||'').trim().slice(0,15),b.name.trim().slice(0,100),(b.lecturer_name||'').trim().slice(0,100),req.params.id,req.user.sid]);
  if(!r.affectedRows&&!await one('SELECT id FROM personal_courses WHERE id=? AND student_id=?',[req.params.id,req.user.sid]))return res.status(404).json({error:'Data tidak ditemukan'});res.json({ok:true});}));
app.delete('/api/me/courses/:id',auth('mahasiswa'),ah(async(req,res)=>{const r=await q('DELETE FROM personal_courses WHERE id=? AND student_id=?',[req.params.id,req.user.sid]);
  if(!r.affectedRows)return res.status(404).json({error:'Data tidak ditemukan'});await log(req.user.id,'matkul_pribadi_hapus',req.params.id);res.json({ok:true});}));
const taskVals=async(req,b)=>{if(!(b.title||'').trim())return 'Judul tugas wajib diisi';if(b.status&&!['Belum','Selesai'].includes(b.status))return 'Status tidak valid';
  if(b.personal_course_id&&!await one('SELECT id FROM personal_courses WHERE id=? AND student_id=?',[b.personal_course_id,req.user.sid]))return 'Mata kuliah tidak valid';return null;};
app.get('/api/me/tasks',auth('mahasiswa'),ah(async(req,res)=>res.json(await q('SELECT t.*,pc.name course FROM personal_tasks t LEFT JOIN personal_courses pc ON pc.id=t.personal_course_id WHERE t.student_id=? ORDER BY t.status,t.deadline IS NULL,t.deadline',[req.user.sid]))));
app.post('/api/me/tasks',auth('mahasiswa'),ah(async(req,res)=>{const b=req.body,e=await taskVals(req,b);if(e)return bad(res,e);
  const id=(await db.query('INSERT INTO personal_tasks(student_id,personal_course_id,title,description,deadline,status) VALUES(?,?,?,?,?,?)',[req.user.sid,b.personal_course_id||null,b.title.trim().slice(0,150),b.description||'',dt(b.deadline),b.status||'Belum']))[0].insertId;
  await log(req.user.id,'tugas_pribadi_tambah',b.title);res.json({id});}));
app.put('/api/me/tasks/:id',auth('mahasiswa'),ah(async(req,res)=>{const b=req.body,e=await taskVals(req,b);if(e)return bad(res,e);
  if(!await one('SELECT id FROM personal_tasks WHERE id=? AND student_id=?',[req.params.id,req.user.sid]))return res.status(404).json({error:'Data tidak ditemukan'});
  await q('UPDATE personal_tasks SET personal_course_id=?,title=?,description=?,deadline=?,status=? WHERE id=? AND student_id=?',[b.personal_course_id||null,b.title.trim().slice(0,150),b.description||'',dt(b.deadline),b.status||'Belum',req.params.id,req.user.sid]);res.json({ok:true});}));
app.delete('/api/me/tasks/:id',auth('mahasiswa'),ah(async(req,res)=>{const r=await q('DELETE FROM personal_tasks WHERE id=? AND student_id=?',[req.params.id,req.user.sid]);
  if(!r.affectedRows)return res.status(404).json({error:'Data tidak ditemukan'});res.json({ok:true});}));
// ---------- Notifikasi & profil ----------
app.get('/api/notifications',auth(),ah(async(req,res)=>res.json(await q('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100',[req.user.id]))));
app.post('/api/notifications/read',auth(),ah(async(req,res)=>{await q('UPDATE notifications SET is_read=1 WHERE user_id=?',[req.user.id]);res.json({ok:true});}));
app.put('/api/profile/password',auth(),ah(async(req,res)=>{const {old_password,new_password}=req.body;
  const u=await one('SELECT password_hash FROM users WHERE id=?',[req.user.id]);if(!bcrypt.compareSync(old_password||'',u.password_hash))return res.status(400).json({error:'Password lama salah'});
  if((new_password||'').length<6)return res.status(400).json({error:'Password baru min. 6 karakter'});
  await q('UPDATE users SET password_hash=? WHERE id=?',[bcrypt.hashSync(new_password,10),req.user.id]);res.json({ok:true});}));
const DIST=path.join(__dir,'../frontend/dist'); // produksi: backend ikut menyajikan frontend
if(fs.existsSync(DIST)){app.use(express.static(DIST));app.get(/^\/(?!api).*/,(req,res)=>res.sendFile(path.join(DIST,'index.html')));}
app.use((e,req,res,next)=>{console.error(e);res.status(e.message?.includes('Format')?400:500).json({error:e.message?.includes('Format')||e.code==='LIMIT_FILE_SIZE'?e.message:'Terjadi kesalahan server'});});
app.listen(process.env.PORT||3001,()=>console.log('TASKFLOW API berjalan di port '+(process.env.PORT||3001)));
