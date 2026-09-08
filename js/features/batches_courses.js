function renderBats(){
  const el=document.getElementById('page-batches');
  if(!batches.length){el.innerHTML=`<div style="text-align:center;padding:80px;color:#78716C"><div style="font-size:52px;margin-bottom:14px">Empty</div><p style="font-size:15px;margin-bottom:16px">No batches yet!</p><button class="btn btn-primary" onclick="openBatForm(null)">＋ Create New Batch</button></div>`;return;}
  el.innerHTML=`<div class="batch-grid">${batches.map(b=>makeBatCard(b)).join('')}</div>`;
}

function makeBatCard(b){
  const list=bStu(b);
  const pct=Math.min(100,Math.round(list.length/(b.maxStudents||1)*100));
  const full=list.length>=(b.maxStudents||999);
  const avs=list.slice(0,8).map((s,i)=>`<div class="av ${avcC(i)}" style="width:28px;height:28px;font-size:10px;border:2px solid #fff;margin-left:${i?'-8px':'0'}" title="${esc(s.name)}">${ini(s.name)}</div>`).join('');
  const more=list.length>8?`<div class="av" style="width:28px;height:28px;font-size:9px;background:#E7E2D9;color:#78716C;border:2px solid #fff;margin-left:-8px">+${list.length-8}</div>`:'';
  const teacher=b.teacher?getUsers().find(u=>u.username===b.teacher):null;
  return`<div class="batch-card">
    <div style="background:linear-gradient(135deg,${b.color} 0%,${b.color}cc 100%);padding:18px 20px 14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-size:17px;font-weight:800;color:#fff">${esc(b.name)}</div>
          <div style="font-size:12px;color:rgba(255,255,255,.75);margin-top:3px">Time: ${fmt12(b.startTime)} – ${fmt12(b.endTime)}</div>
        </div>
        <div style="display:flex;gap:5px">
          <button onclick="openBatForm('${b.id}')" style="background:rgba(255,255,255,.2);border:none;border-radius:6px;padding:5px 9px;color:#fff;cursor:pointer;font-size:12px">Edit</button>
          <button onclick="delBat('${b.id}')" style="background:rgba(255,255,255,.2);border:none;border-radius:6px;padding:5px 9px;color:#fff;cursor:pointer;font-size:12px">Del</button>
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
        ${(b.days||[]).map(d=>`<span style="background:rgba(255,255,255,.2);color:#fff;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:10px">${d}</span>`).join('')}
      </div>
    </div>
    <div style="padding:14px 20px 18px">
      <div class="flex-wrap-start" style="gap:12px;margin-bottom:10px">
        ${b.subject?`<div style="font-size:12px;color:#78716C">Subject: ${esc(b.subject)}</div>`:''}
        ${b.subjectFee?`<div style="font-size:12px;color:#E8622A;font-weight:700">Fee: ${fmt(b.subjectFee)}/mo</div>`:''}
        ${teacher?`<div style="font-size:12px;color:#2A9D8F">Tutor: ${esc(teacher.name||teacher.username)}</div>`:''}
        ${b.notes?`<div style="font-size:11px;color:#78716C;font-style:italic;width:100%">Note: ${esc(b.notes)}</div>`:''}
      </div>
      <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
          <span style="font-weight:600">${list.length} Students</span>
          <span style="color:${full?'#DC2626':'#78716C'}">${full?'Full':`${b.maxStudents-list.length} seats left`} / ${b.maxStudents}</span>
        </div>
        <div class="prog"><div class="prog-fill" style="background:${full?'#DC2626':b.color};width:${pct}%"></div></div>
      </div>
      <div style="display:flex;margin-bottom:12px">${avs}${more}</div>
      <div style="display:flex;gap:7px">
        <button class="btn btn-ghost btn-sm" style="flex:1;justify-content:center" onclick="openBatDetail('${b.id}')">Manage Students</button>
        ${!full?`<button class="btn btn-ink btn-sm" style="flex:1;justify-content:center" onclick="openAssign('${b.id}')">＋ Assign</button>`:''}
      </div>
    </div>
  </div>`;
}

function openBatDetail(bid){
  const b=batches.find(x=>x.id===bid);if(!b)return;
  const list=bStu(b);
  document.getElementById('batchdetail-title').textContent=b.name+' — Students';
  document.getElementById('batchdetail-body').innerHTML=`
    <div style="background:${b.color};border-radius:10px;padding:12px 16px;margin-bottom:18px;display:flex;gap:20px;flex-wrap:wrap">
      ${[['Time',fmt12(b.startTime)+'–'+fmt12(b.endTime)],['Days',(b.days||[]).join(', ')],['Subject',b.subject||'—'],['Capacity',list.length+'/'+b.maxStudents]].map(([l,v])=>`<div><div style="font-size:9px;color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:1px">${l}</div><div style="font-size:13px;font-weight:700;color:#fff">${v}</div></div>`).join('')}
    </div>
    ${!list.length?`<div style="text-align:center;padding:30px;color:#78716C"><div style="font-size:32px;margin-bottom:8px">Empty</div><p>No students in this batch yet.</p></div>`:`
    <div class="table-wrap"><table><thead><tr><th>#</th><th>Student</th><th>Class</th><th>Mobile</th><th>Fee Status</th><th>Remove</th></tr></thead>
    <tbody>${list.map((s,i)=>{
      const curM=MONTHS[new Date().getMonth()];
      const curY=new Date().getFullYear();
      const paidThisMonth=(s.history||[]).some(h=>h.month===curM&&(h.year||curY)===curY);
      const mFee=monthlyFee(s);
      return`<tr>
      <td style="font-size:11px;color:#78716C">${i+1}</td>
      <td><div style="display:flex;align-items:center;gap:7px"><div class="av ${avcC(i)}" style="width:26px;height:26px;font-size:10px">${ini(s.name)}</div><span style="font-weight:600;font-size:12.5px">${esc(s.name)}</span></div></td>
      <td>${esc(s.cls)}</td><td style="color:#78716C">${esc(s.mobile)}</td>
      <td>
        <span class="badge ${paidThisMonth?'badge-green':'badge-red'}">${paidThisMonth?curM+' Paid':curM+' Due'}</span>
        <div style="font-size:10px;color:#78716C;margin-top:2px">${fmt(mFee)}/mo</div>
      </td>
      <td><button class="btn btn-red btn-xs" onclick="removeStuBat('${esc(b.name)}','${s.id}')">Remove</button></td>
    </tr>`;}).join('')}</tbody></table></div>`}`;
  openModal('modal-batchdetail');
}

function removeStuBat(bname,sid){
  students=students.map(x=>x.id===sid?{...x,batch:''}:x);
  persist();toast('Student removed from batch');
  const b=batches.find(x=>x.name===bname);
  if(b){openBatDetail(b.id);}else{closeModal('modal-batchdetail');}
  renderBats();
}

function openAssign(bid){
  const b=batches.find(x=>x.id===bid);if(!b)return;
  document.getElementById('assign-title').textContent='Assign Students — '+b.name;
  renderAssignBody(bid,'');openModal('modal-assign');
}

function renderAssignBody(bid,q){
  const b=batches.find(x=>x.id===bid);if(!b)return;
  const unassigned=students.filter(s=>!s.inactive&&s.batch!==b.name&&(!q||s.name.toLowerCase().includes(q)));
  document.getElementById('assign-body').innerHTML=`
    <div style="background:#F7F5F0;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#78716C">Info: <b>${b.maxStudents-bStu(b).length}</b> seats available · <b>${bStu(b).length}</b> enrolled</div>
    <div class="search-box" style="margin-bottom:14px"><span style="color:#78716C">Search</span><input placeholder="Search students…" oninput="renderAssignBody('${bid}',this.value.toLowerCase())" style="width:100%"></div>
    ${!unassigned.length?`<div style="text-align:center;padding:30px;color:#78716C"><div style="font-size:28px;margin-bottom:8px">Done</div><p>All students are in this batch.</p></div>`:
    unassigned.map((s,i)=>`<div style="display:flex;align-items:center;gap:10px;background:#F7F5F0;border-radius:10px;padding:10px 14px;border:1.5px solid #E7E2D9;margin-bottom:8px">
      <div class="av ${avcC(i)}" style="width:32px;height:32px">${ini(s.name)}</div>
      <div style="flex:1"><div style="font-weight:600;font-size:13px">${esc(s.name)}</div><div style="font-size:11px;color:#78716C">Class ${esc(s.cls)}${s.batch?' · Currently: '+esc(s.batch):' · No batch'}</div></div>
      <button class="btn btn-ink btn-xs" onclick="assignStu('${bid}','${s.id}')">＋ Assign</button>
    </div>`).join('')}`;
}

function assignStu(bid,sid){
  const b=batches.find(x=>x.id===bid);if(!b)return;
  students=students.map(x=>x.id===sid?{...x,batch:b.name}:x);
  persist();toast('Student assigned!');renderAssignBody(bid,'');renderBats();
}

// BATCH FORM
function openBatForm(id){
  editBatId=id;
  const b=id?batches.find(x=>x.id===id):null;
  const selColor=b?.color||BATCH_COLORS[batches.length%BATCH_COLORS.length];
  window._bc=selColor;
  const teachers=getUsers().filter(u=>u.role!=='admin');
  const teacherOpts=`<option value="">— No Teacher Assigned —</option>`+teachers.map(t=>`<option value="${esc(t.username)}"${b?.teacher===t.username?' selected':''}>${esc(t.name||t.username)} (${esc(t.role||'Employee')})</option>`).join('');
  document.getElementById('modal-bat-title').textContent=id?'Edit Batch':'Create New Batch';
  document.getElementById('modal-bat-body').innerHTML=`
  <div class="form-grid">
    <div class="fg full"><label>Batch Name ★</label><input id="bf-name" value="${esc(b?.name||'')}" placeholder="e.g. Morning Batch A" oninput="updBatPrev()"></div>
    <div class="fg"><label>Start Time ★</label><input id="bf-st" type="time" value="${b?.startTime||''}" oninput="updBatPrev()"></div>
    <div class="fg"><label>End Time ★</label><input id="bf-en" type="time" value="${b?.endTime||''}" oninput="updBatPrev()"></div>
    <div class="fg full"><label>Days of Week ★</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px" id="bf-days">
        ${DAYS.map(d=>{const on=(b?.days||[]).includes(d);return`<div class="day-btn${on?' on':''}" style="${on?'background:'+selColor+';color:#fff;border-color:'+selColor:''}" onclick="togDay(this,'${d}')">${d}</div>`;}).join('')}
      </div>
    </div>
    <div class="fg"><label>Subject</label><input id="bf-sub" value="${esc(b?.subject||'')}" placeholder="e.g. Mathematics" oninput="updBatPrev()"></div>
    <div class="fg"><label>Max Students</label><input id="bf-max" type="number" value="${b?.maxStudents||20}"></div>
    <div class="fg"><label>Assign Teacher</label><select id="bf-teacher">${teacherOpts}</select></div>
    <div class="fg"><label>Subject Fee (₹/month)</label><input id="bf-fee" type="number" value="${b?.subjectFee||''}" placeholder="e.g. 1500"></div>
    <div class="fg full"><label>Batch Notes</label><input id="bf-notes" value="${esc(b?.notes||'')}" placeholder="e.g. Focus on board exam preparation"></div>
    <div class="fg full"><label>Batch Color</label>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;align-items:center">
        ${BATCH_COLORS.map(c=>`<div onclick="setBatColor('${c}')" id="bfc${c.slice(1)}" style="width:32px;height:32px;border-radius:50%;background:${c};cursor:pointer;border:${selColor===c?'3px solid #18181B':'3px solid transparent'};transition:.15s"></div>`).join('')}
        <div style="display:flex;align-items:center;gap:6px"><span style="font-size:12px;color:#78716C">Custom:</span><input type="color" id="bf-cc" value="${selColor}" oninput="setBatColor(this.value)" style="width:32px;height:32px;border-radius:50%;border:none;cursor:pointer;padding:0"></div>
      </div>
    </div>
    <div class="full" id="bf-prev"></div>
  </div>
  <div class="modal-foot">
    <button class="btn btn-ghost" onclick="closeFormModal('batch')">Cancel</button>
    <button class="btn btn-primary" onclick="saveBat()">${id?'Update Batch':'Create Batch'}</button>
  </div>`;
  openModal('modal-batch-form');
  updBatPrev();
}

function togDay(el,d){
  el.classList.toggle('on');const on=el.classList.contains('on');
  el.style.background=on?(window._bc||'#E8622A'):'';el.style.color=on?'#fff':'';el.style.borderColor=on?(window._bc||'#E8622A'):'';
  updBatPrev();
}
function setBatColor(c){
  window._bc=c;
  document.querySelectorAll('[id^="bfc"]').forEach(el=>{el.style.border='3px solid '+(('#'+el.id.slice(3))===c?'#18181B':'transparent');});
  document.querySelectorAll('#bf-days .day-btn.on').forEach(el=>{el.style.background=c;el.style.borderColor=c;});
  const cc=document.getElementById('bf-cc');if(cc)cc.value=c;
  updBatPrev();
}
function updBatPrev(){
  const name=document.getElementById('bf-name')?.value||'';
  const st=document.getElementById('bf-st')?.value||'';
  const en=document.getElementById('bf-en')?.value||'';
  const sub=document.getElementById('bf-sub')?.value||'';
  const days=[...document.querySelectorAll('#bf-days .day-btn.on')].map(e=>e.textContent);
  const c=window._bc||'#E8622A';const el=document.getElementById('bf-prev');if(!el)return;
  el.innerHTML=name||st?`<div style="background:${c};border-radius:12px;padding:16px 20px"><div style="font-size:15px;font-weight:800;color:#fff">${esc(name)||'Preview'}</div><div style="font-size:12px;color:rgba(255,255,255,.8);margin-top:4px">${st&&en?fmt12(st)+' – '+fmt12(en):''}${sub?' · '+esc(sub):''}</div><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">${days.map(d=>`<span style="background:rgba(255,255,255,.2);color:#fff;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:10px">${d}</span>`).join('')}</div></div>`:'';
}
async function saveBat(){
  const btn=document.querySelector('#modal-bat-body .modal-foot .btn-primary');
  const name=(document.getElementById('bf-name')?.value||'').trim();
  if(!name){toast('Batch name required','err');return;}
  const st=document.getElementById('bf-st')?.value;
  if(!st){toast('Set start time','err');return;}
  const en=document.getElementById('bf-en')?.value;
  if(!en){toast('Set end time','err');return;}
  const days=[...document.querySelectorAll('#bf-days .day-btn.on')].map(e=>e.textContent);
  if(!days.length){toast('Select at least one day','err');return;}

  if(btn){btn.textContent='⏳ Saving…';btn.disabled=true;}
  try{
    const obj={
      id:editBatId||uid(),name,startTime:st,endTime:en,days,
      subject:document.getElementById('bf-sub')?.value||'',
      maxStudents:parseInt(document.getElementById('bf-max')?.value)||20,
      color:window._bc||'#E8622A',
      teacher:document.getElementById('bf-teacher')?.value||'',
      subjectFee:parseFloat(document.getElementById('bf-fee')?.value||0)||0,
      notes:document.getElementById('bf-notes')?.value||''
    };
    if(editBatId){batches=batches.map(x=>x.id===editBatId?obj:x);}
    else{batches.push(obj);}
    closeFormModal('batch');
    renderBats();
    await persist();
    toast(editBatId?'✅ Batch updated!':'✅ Batch created: '+obj.name);
  }catch(err){
    console.error('saveBat error:',err);
    toast('Save failed: '+err.message,'err');
    if(btn){btn.textContent='💾 Save';btn.disabled=false;}
  }
}
function delBat(id){
  if(!confirm('Delete this batch?')) return;
  showLoader('Deleting Batch…','Removing batch','\uD83D\uDDD1\uFE0F');
  setTimeout(async()=>{
    const b=batches.find(x=>x.id===id);
    if(b) students=students.map(x=>x.batch===b.name?{...x,batch:''}:x);
    batches=batches.filter(x=>x.id!==id);
    await persist();
    hideLoader();renderBats();toast('Deleted','err');
  },1000);
}


// ════════════════════════════════════════════════════════════════════════════