// Jalankan: cd backend && npm run seed
import 'dotenv/config';import bcrypt from 'bcryptjs';import db from '../backend/db.js';
const ins=async(sql,p)=>(await db.query(sql,p))[0].insertId;
const U=(n,e,id,pw,r)=>ins('INSERT INTO users(name,email,identity_number,password_hash,role) VALUES(?,?,?,?,?)',[n,e,id,bcrypt.hashSync(pw,10),r]);
const ay=await ins("INSERT INTO academic_years(name,is_active) VALUES('2026/2027',1)");
const sem=await ins("INSERT INTO semesters(academic_year_id,name,is_active) VALUES(?,'Ganjil',1)",[ay]);
const prodi=await ins("INSERT INTO study_programs(code,name) VALUES('TI','Teknik Informatika')");
const cls=await ins("INSERT INTO classes(name,study_program_id,semester_id) VALUES('TI-3A',?,?)",[prodi,sem]);
const adm=await U('Administrator','admin@taskflow.id','ADM001','admin123','admin');
const du=await U('Dr. Budi Santoso','dosen@taskflow.id','198001012005','dosen123','dosen');
const lid=await ins('INSERT INTO lecturers(user_id,study_program_id) VALUES(?,?)',[du,prodi]);
const su=await U('Siti Rahma','mahasiswa@taskflow.id','2401001','mhs123','mahasiswa');
const sid=await ins('INSERT INTO students(user_id,class_id,study_program_id,semester) VALUES(?,?,?,3)',[su,cls,prodi]);
for(const [c,n] of [['TI301','Basis Data'],['TI302','Pemrograman Web']]){
 const cid=await ins('INSERT INTO courses(code,name,study_program_id,semester_id,lecturer_id) VALUES(?,?,?,?,?)',[c,n,prodi,sem,lid]);
 await ins('INSERT INTO course_enrollments(student_id,course_id) VALUES(?,?)',[sid,cid]);
 await ins("INSERT INTO course_materials(course_id,lecturer_id,class_id,title,description,meeting_no,publish_date,status,video_url) VALUES(?,?,?,?,?,1,CURDATE(),'published','https://youtube.com')",[cid,lid,cls,'Pengantar '+n,'Materi pertemuan pertama '+n]);
 await ins("INSERT INTO assignments(course_id,class_id,lecturer_id,title,description,start_date,deadline) VALUES(?,?,?,?,?,NOW(),DATE_ADD(NOW(),INTERVAL 7 DAY))",[cid,cls,lid,'Tugas 1 '+n,'Kerjakan soal latihan dan kumpulkan dalam PDF.']);
}
await ins("INSERT INTO announcements(author_id,title,body) VALUES(?,?,?)",[adm,'Selamat datang di TASKFLOW','Perkuliahan semester ganjil dimulai.']);
console.log('Seed selesai.\nadmin@taskflow.id/admin123 | dosen@taskflow.id/dosen123 | mahasiswa@taskflow.id/mhs123');process.exit();
