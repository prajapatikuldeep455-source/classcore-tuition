let sfFilter='all',sfSearch='',sfCls='',sfBat='';
function renderStus(){
  try {
  const list=students.filter(s=>{
    if(sfFilter==='active'&&s.inactive)return false;
    if(sfFilter==='inactive'&&!s.inactive)return false;
    if(sfCls&&s.cls!==sfCls)return false;
    if(sfBat&&s.batch!==sfBat)return false;
    if(sfSearch&&!(s.name||'').toLowerCase().includes(sfSearch)&&!(s.mobile||'').includes(sfSearch))return false;
    return true;
  });
  document.getElementById('page-students').innerHTML=`
  <div class="flt">${[['all','All'],['active','Active'],['inactive','Inactive']].map(([f,l])=>`<button class="f-pill${sfFilter===f?' on':''}" onclick="sfFilter='${f}';renderStus()">${l}</button>`).join('')}</div>
  <div class="table-wrap">
    <div class="table-bar">
      <div class="search-box"><span>🔍</span><input value="${esc(sfSearch)}" placeholder="Search name, mobile…" oninput="sfSearch=this.value.toLowerCase();filterStus()"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <select onchange="sfCls=this.value;renderStus()" style="padding:7px 11px;font-size:12px;border-radius:7px;border:1.5px solid #E7E2D9;background:#F7F5F0">
          <option value="">All Classes</option>${getClasses().map(c=>`<option${sfCls===c?' selected':''}>${c}</option>`).join('')}
        </select>
        <select onchange="sfBat=this.value;renderStus()" style="padding:7px 11px;font-size:12px;border-radius:7px;border:1.5px solid #E7E2D9;background:#F7F5F0">
          <option value="">All Batches</option>${batches.map(b=>`<option${sfBat===b.name?' selected':''}>${esc(b.name)}</option>`).join('')}
        </select>
        <span id="stu-count" style="font-size:12px;color:#78716C;align-self:center">${list.length} students</span><button class="btn btn-ghost btn-sm" onclick="printStudentList()">🖨️ Print</button><button class="btn btn-teal btn-sm" onclick="saveStudentListPDF()">📄 PDF</button>
      </div>
    </div>
    ${!list.length?`<div style="text-align:center;padding:50px;color:#78716C"><div style="font-size:44px;margin-bottom:12px">🎓</div><p>No students. <button onclick="openStuForm(null)" style="color:#E8622A;background:none;border:none;cursor:pointer;font-weight:700">Add one →</button></p></div>`:`
    <table><thead><tr><th>#</th><th>Student</th><th>Roll</th><th>Class</th><th>Medium</th><th>School</th><th>Batch</th><th>Phone</th><th>Guardian</th><th>Fee</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody id="stu-tbody">${buildStuRows(list)}</tbody></table>`}
  </div>`;
  } catch(err) {
    console.error('renderStus error:', err);
    document.getElementById('page-students').innerHTML=`<div style="text-align:center;padding:40px;color:#DC2626">Error loading students. Please restart the app.<br><small>${err.message}</small></div>`;
  }
}

function buildStuRows(list){
  return list.map((s,i)=>{
    const idx=students.indexOf(s);
    const mFee=monthlyFee(s);
    const feeDisplay=s.feeType==='annual'
      ?`<div style="font-weight:700">${fmt(s.annualFees||s.finalFees||0)}<span style="font-size:10px;color:#78716C;font-weight:400">/yr</span></div><div style="font-size:10px;color:#78716C">${fmt(mFee)}/mo</div>`
      :`<div style="font-weight:700">${fmt(mFee)}<span style="font-size:10px;color:#78716C;font-weight:400">/mo</span></div>`;
    return`<tr>
      <td style="color:#78716C;font-size:11px">${i+1}</td>
      <td><div style="display:flex;align-items:center;gap:8px"><div class="av ${avcC(idx)}">${ini(s.name)}</div><div><div style="font-weight:600">${esc(s.name)}</div><div style="font-size:11px;color:#78716C">${esc(s.subject||'')}</div></div></div></td>
      <td style="color:#78716C">${esc(s.roll||'—')}</td><td>${esc(s.cls)}</td>
      <td><span class="badge badge-gray">${esc(s.medium||'—')}</span></td>
      <td style="color:#78716C">${esc(s.school||'—')}</td><td>${esc(s.batch||'—')}</td>
      <td style="color:#78716C">${esc(s.mobile||'—')}</td><td>${esc(s.parent||'—')}</td>
      <td>${feeDisplay}</td>
      <td><span class="badge ${s.inactive?'badge-red':'badge-green'}">${s.inactive?'Inactive':'Active'}</span></td>
      <td><div style="display:flex;gap:5px"><button class="btn btn-ghost btn-xs" onclick="openStuForm('${s.id}')">✏️ Edit</button><button class="btn btn-ink btn-xs" onclick="showIDCard('${s.id}')">🪪</button><button class="btn btn-red btn-xs" onclick="delStu('${s.id}')">🗑️</button></div></td>
    </tr>`;
  }).join('')||`<tr><td colspan="12" style="text-align:center;padding:30px;color:#78716C">No students found</td></tr>`;
}

// STUDENT FORM
// Fast filter - only rebuilds tbody, not the whole page
const filterStus=debounce(()=>{
  const tbody=document.getElementById('stu-tbody');
  if(!tbody){renderStus();return;}
  const list=students.filter(s=>{
    if(sfFilter==='active'&&s.inactive)return false;
    if(sfFilter==='inactive'&&!s.inactive)return false;
    if(sfCls&&s.cls!==sfCls)return false;
    if(sfBat&&s.batch!==sfBat)return false;
    if(sfSearch&&!(s.name||'').toLowerCase().includes(sfSearch)&&!(s.mobile||'').includes(sfSearch))return false;
    return true;
  });
  tbody.innerHTML=buildStuRows(list);
  const cnt=document.getElementById('stu-count');
  if(cnt)cnt.textContent=list.length+' students';
},150);

function openStuForm(id){
  if(id && !canDo('edit_students','You cannot edit students')) return;
  if(!id && !canDo('add_students','You cannot add students')) return;
  editStuId=id;
  const s=id?students.find(x=>x.id===id):null;
  const batOpts=batches.map(b=>`<option value="${esc(b.name)}"${s?.batch===b.name?' selected':''}>${esc(b.name)} (${fmt12(b.startTime)}–${fmt12(b.endTime)})</option>`).join('');
  document.getElementById('modal-stu-title').textContent=id?'Edit Student':'Add New Student';
  document.getElementById('modal-stu-body').innerHTML=`
  <div class="form-grid">
    <div class="fg full"><label>Full Name ★</label><input id="sf-name" value="${esc(s?.name||'')}" placeholder="e.g. Aryan Patel"></div>
    <div class="fg"><label>Class ★</label>
      <div style="display:flex;gap:6px">
        <select id="sf-cls" style="flex:1" onchange="onClsChange(this);prefillClsFee()">
          <option value="">— Select Class —</option>
          ${getClasses().map(c=>`<option${s?.cls===c?' selected':''}>${c}</option>`).join('')}
          ${s?.cls&&!getClasses().includes(s.cls)?`<option selected>${esc(s.cls)}</option>`:''}
          <option value="__other__">＋ Add Custom Class…</option>
        </select>
        <input id="sf-cls-custom" placeholder="e.g. B.Com" style="display:none;flex:1;background:#F7F5F0;border:1.5px solid var(--primary);border-radius:8px;padding:9px 12px;font-size:13px;outline:none" onblur="applyCustomClass(this.value)">
      </div>
    </div>
    <div class="fg"><label>Roll Number</label><input id="sf-roll" value="${esc(s?.roll||'')}" placeholder="Leave blank for auto"></div>
    <div class="fg"><label>Batch / Time</label><select id="sf-batch"><option value="">— No Batch —</option>${batOpts}</select></div>
    <div class="fg"><label>Mobile (10 digits)</label><input id="sf-mobile" value="${esc(s?.mobile||'')}" placeholder="9876543210" maxlength="10" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,10)"></div>
    <div class="fg"><label>Parent / Guardian</label><input id="sf-parent" value="${esc(s?.parent||'')}" placeholder="Father / Mother name"></div>
    <div class="fg"><label>Subject</label><input id="sf-subject" value="${esc(s?.subject||'')}" placeholder="e.g. Math, Science"></div>
    <div class="fg"><label>School Name</label><input id="sf-school" value="${esc(s?.school||'')}" placeholder="e.g. Delhi Public School"></div>
    <div class="fg"><label>Medium</label>
      <div style="display:flex;gap:6px">
        <select id="sf-medium" style="flex:1" onchange="onMediumChange(this)">
          <option value="">— Select —</option>
          <option value="English"${s?.medium==='English'?' selected':''}>English</option>
          <option value="Gujarati"${s?.medium==='Gujarati'?' selected':''}>Gujarati</option>
          <option value="Hindi"${s?.medium==='Hindi'?' selected':''}>Hindi</option>
          <option value="Punjabi"${s?.medium==='Punjabi'?' selected':''}>Punjabi</option>
          <option value="Marathi"${s?.medium==='Marathi'?' selected':''}>Marathi</option>
          <option value="Urdu"${s?.medium==='Urdu'?' selected':''}>Urdu</option>
          ${s?.medium&&!['English','Gujarati','Hindi','Punjabi','Marathi','Urdu'].includes(s.medium)?`<option value="${esc(s.medium)}" selected>${esc(s.medium)}</option>`:''}
          <option value="__other__">＋ Add Custom…</option>
        </select>
        <input id="sf-medium-custom" placeholder="Type medium" style="display:none;flex:1;background:#F7F5F0;border:1.5px solid var(--primary);border-radius:8px;padding:9px 12px;font-size:13px;outline:none">
      </div>
    </div>
    <div class="fg"><label>Admission Date</label><input id="sf-admdate" type="date" value="${s?.admDate||todayStr()}"></div>
    <div class="fg"><label>Fee Type</label><select id="sf-feetype" onchange="onFeeTypeChange()">
      <option value="monthly"${(!s?.feeType||s?.feeType==='monthly')?' selected':''}>Monthly</option>
      <option value="annual"${s?.feeType==='annual'?' selected':''}>Annual</option>
    </select></div>
    <div class="fg" id="sf-mwrap" style="${s?.feeType==='annual'?'display:none':''}">
      <label>Monthly Fees (₹)</label>
      <input id="sf-monthly" type="number" value="${s?.monthlyFees||''}" placeholder="e.g. 1500" oninput="updateFeePreview()">
      <div class="hint" id="sf-clshint"></div>
    </div>
    <div class="fg" id="sf-awrap" style="${s?.feeType==='annual'?'':'display:none'}">
      <label>Annual Fees (₹)</label><input id="sf-annual" type="number" value="${s?.annualFees||''}" placeholder="e.g. 15000" oninput="updateFeePreview()">
    </div>
    <div class="fg"><label>Discount (₹)</label><input id="sf-discount" type="number" value="${s?.discount||0}" placeholder="0" oninput="updateFeePreview()"></div>
    <div class="full" id="sf-feepreview"></div>
    <div class="fg full"><label>Student Photo</label>
      <div style="display:flex;align-items:center;gap:14px">
        <div id="sf-photo-preview" style="width:72px;height:82px;border-radius:10px;border:2px solid var(--border);overflow:hidden;background:#F7F5F0;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${s?.photo?`<img src="${s.photo}" style="width:100%;height:100%;object-fit:cover">`:`<div style="font-size:26px;font-weight:800;color:#78716C">${s?ini(s.name):'📷'}</div>`}
        </div>
        <div>
          <input type="file" id="sf-photo-input" accept="image/*" style="display:none" onchange="previewStuPhoto(this)">
          <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('sf-photo-input').click()">📷 Upload Photo</button>
          ${s?.photo?`<button type="button" class="btn btn-ghost btn-sm" style="margin-left:6px;color:#DC2626" onclick="clearStuPhoto()">✕ Remove</button>`:''}
          <div class="hint" style="margin-top:5px">Shown on ID Card. Auto-compressed.</div>
        </div>
      </div>
      <input type="hidden" id="sf-photo-data" value="${s?.photo||''}">
    </div>
    <div class="fg full"><label>Enrolled Courses</label>
      <div style="display:flex;flex-wrap:wrap;gap:8px;padding:10px 12px;background:#F7F5F0;border:1.5px solid var(--border);border-radius:8px;min-height:44px">
        ${courses.length===0
          ?`<span style="font-size:12px;color:#78716C;align-self:center">No courses yet</span>`
          :courses.map(c=>{const enrolled=(s?.courseIds||[]).includes(c.id);return`<label style="display:flex;align-items:center;gap:6px;background:#fff;border:1.5px solid ${enrolled?'var(--primary)':'var(--border)'};border-radius:8px;padding:5px 10px;cursor:pointer;font-size:12px;font-weight:${enrolled?'700':'400'}">
            <input type="checkbox" data-cid="${esc(c.id)}" ${enrolled?'checked':''} style="accent-color:var(--primary);cursor:pointer"> ${esc(c.name)}${c.fee?` (${fmt(c.fee)})`:''}
          </label>`;}).join('')}
      </div>
      <div class="hint">Tick courses this student is enrolled in</div>
    </div>
    <div class="fg"><label>Address</label><input id="sf-addr" value="${esc(s?.addr||'')}" placeholder="Home address"></div>
    <div class="fg"><label>Email</label><input id="sf-email" type="email" value="${esc(s?.email||'')}" placeholder="Optional"></div>
    <div class="fg"><label>Status</label><select id="sf-status">
      <option value="active"${!s?.inactive?' selected':''}>Active</option>
      <option value="inactive"${s?.inactive?' selected':''}>Inactive</option>
    </select></div>
    <div class="fg"><label>Notes</label><input id="sf-notes" value="${esc(s?.notes||'')}" placeholder="Optional remarks"></div>
  </div>
  <div class="modal-foot">
    <button class="btn btn-ghost" onclick="closeFormModal('student')">Cancel</button>
    <button class="btn btn-primary" onclick="saveStu()">💾 ${id?'Update Student':'Save Student'}</button>
  </div>`;
  openModal('modal-student-form');
  prefillClsFee();updateFeePreview();
}

function onClsChange(sel){
  const custom=document.getElementById('sf-cls-custom');
  if(sel.value==='__other__'){
    custom.style.display='block';
    custom.focus();
    sel.value='';
  } else {
    if(custom) custom.style.display='none';
  }
}

function applyCustomClass(val){
  val=(val||'').trim();
  if(!val) return;
  addCustomClass(val);
  CLASSES=getClasses();
  const sel=document.getElementById('sf-cls');
  const custom=document.getElementById('sf-cls-custom');
  if(!sel) return;
  // Add to dropdown if not there
  const exists=[...sel.options].some(o=>o.value===val);
  if(!exists){
    const opt=document.createElement('option');
    opt.value=val; opt.text=val; opt.selected=true;
    sel.insertBefore(opt, sel.options[sel.options.length-1]);
  } else {
    sel.value=val;
  }
  if(custom) custom.style.display='none';
  prefillClsFee();
}

function getClsValue(){
  const sel=document.getElementById('sf-cls');
  const custom=document.getElementById('sf-cls-custom');
  if(custom&&custom.style.display!=='none'&&custom.value.trim()){
    return custom.value.trim();
  }
  return sel?.value||'';
}

function previewStuPhoto(input){
  const file=input.files[0];
  if(!file)return;
  if(file.size>5*1024*1024){toast('Photo too large. Max 5MB.','err');return;}
  const reader=new FileReader();
  reader.onload=e=>{
    // Compress image before storing — max 300x340px, 75% quality
    const img=new Image();
    img.onload=()=>{
      const canvas=document.createElement('canvas');
      const MAX=300;
      let w=img.width,h=img.height;
      if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}
      if(h>340){w=Math.round(w*340/h);h=340;}
      canvas.width=w;canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      const data=canvas.toDataURL('image/jpeg',0.75);
      document.getElementById('sf-photo-data').value=data;
      const prev=document.getElementById('sf-photo-preview');
      if(prev) prev.innerHTML=`<img src="${data}" style="width:100%;height:100%;object-fit:cover">`;
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}
function clearStuPhoto(){
  document.getElementById('sf-photo-data').value='';
  const prev=document.getElementById('sf-photo-preview');
  if(prev) prev.innerHTML=`<div style="font-size:28px;font-weight:800;color:#78716C">📷</div>`;
}

function onMediumChange(sel){
  const custom=document.getElementById('sf-medium-custom');
  if(sel.value==='__other__'){
    custom.style.display='block';
    custom.focus();
    sel.value='';
  } else {
    custom.style.display='none';
  }
}

function getMediumValue(){
  const sel=document.getElementById('sf-medium');
  const custom=document.getElementById('sf-medium-custom');
  if(custom&&custom.style.display!=='none'&&custom.value.trim()){
    return custom.value.trim();
  }
  return sel?.value||'';
}

function getSelectedCourseIds(){
  // Search in modal body (new system) OR old page (fallback)
  const checks=document.querySelectorAll('#modal-stu-body input[data-cid]:checked, #page-students-form input[data-cid]:checked');
  return [...checks].map(c=>c.getAttribute('data-cid'));
}

function onFeeTypeChange(){
  const ft=document.getElementById('sf-feetype')?.value||'';
  document.getElementById('sf-mwrap').style.display=ft==='monthly'?'flex':'none';
  document.getElementById('sf-awrap').style.display=ft==='annual'?'flex':'none';
  prefillClsFee();updateFeePreview();
}

function prefillClsFee(){
  const cls=getClsValue();
  const cf=classFees[cls];
  const hint=document.getElementById('sf-clshint');
  if(!hint)return;
  if(cf!=null){
    const ft=document.getElementById('sf-feetype')?.value;
    // Only prefill if adding new student AND field is empty
    if(ft==='monthly'&&!editStuId){
      const m=document.getElementById('sf-monthly');
      if(m&&!m.value)m.value=cf;
    }
    hint.textContent='Class default: ₹'+cf+'/month';
  }else hint.textContent=cls?'No class default set':'';
}

function updateFeePreview(){
  const ft=document.getElementById('sf-feetype')?.value||'monthly';
  const monthly=parseFloat(document.getElementById('sf-monthly')?.value||0);
  const annual=parseFloat(document.getElementById('sf-annual')?.value||0);
  const disc=parseFloat(document.getElementById('sf-discount')?.value||0);
  const total=ft==='monthly'?monthly*12:annual;
  const final=Math.max(0,total-disc);
  // Add enrolled course fees
  const selectedCids=getSelectedCourseIds();
  const courseFeeTotal=selectedCids.reduce((sum,cid)=>{
    const c=courses.find(x=>x.id===cid);
    return sum+(c&&c.fee?+c.fee:0);
  },0);
  const el=document.getElementById('sf-feepreview');if(!el)return;
  if(total>0||courseFeeTotal>0){
    const baseMonthly=ft==='monthly'?monthly:Math.round(final/12);
    const totalMonthly=baseMonthly+courseFeeTotal;
    el.innerHTML=`<div style="background:#F0FDF4;border:1.5px solid #BBF7D0;border-radius:10px;padding:12px 16px;font-size:13px">
      💡 <b>Base Fee:</b> ${fmt(final)}${ft==='monthly'?` (${fmt(monthly)}/mo × 12)`:''}
      ${disc>0?` — <b>Discount:</b> ${fmt(disc)}`:''}
      ${courseFeeTotal>0?`<br>📚 <b>Course Fees:</b> ${fmt(courseFeeTotal)}/mo (${selectedCids.length} course${selectedCids.length>1?'s':''})`:''}
      <br>💰 <b style="color:#16A34A">Total Monthly: ${fmt(totalMonthly)}/mo</b>
    </div>`;
  } else {
    el.innerHTML='';
  }
}

async function saveStu(){
  const btn=document.querySelector('#modal-stu-body .modal-foot .btn-primary');
  const name=(document.getElementById('sf-name')?.value||'').trim();
  if(!name){toast('Student name is required','err');return;}
  const cls=getClsValue();
  if(!cls){toast('Please select a class','err');return;}
  const mobile=(document.getElementById('sf-mobile')?.value||'').trim();
  if(mobile&&(mobile.length!==10||!/^\d{10}$/.test(mobile))){toast('Mobile must be exactly 10 digits','err');return;}

  // Show saving state
  if(btn){btn.textContent='⏳ Saving…';btn.disabled=true;}

  try{
    const ft=document.getElementById('sf-feetype')?.value||'monthly';
    const monthly=parseFloat(document.getElementById('sf-monthly')?.value||0);
    const annual=parseFloat(document.getElementById('sf-annual')?.value||0);
    const disc=parseFloat(document.getElementById('sf-discount')?.value||0);
    const totalFees=ft==='monthly'?monthly*12:annual;
    const finalFees=Math.max(0,totalFees-disc);
    const ex=editStuId?students.find(x=>x.id===editStuId):null;
    const obj={
      id:ex?.id||uid(),name,cls,mobile,
      roll:(document.getElementById('sf-roll')?.value||'').trim()||('S'+(students.length+1).toString().padStart(3,'0')),
      batch:document.getElementById('sf-batch')?.value||'',
      parent:document.getElementById('sf-parent')?.value||'',
      subject:document.getElementById('sf-subject')?.value||'',
      school:document.getElementById('sf-school')?.value||'',
      medium:getMediumValue(),
      admDate:document.getElementById('sf-admdate')?.value||'',
      feeType:ft,
      monthlyFees:ft==='monthly'?monthly:Math.round(finalFees/12),
      annualFees:ft==='annual'?annual:(monthly*12),
      totalFees,discount:disc,finalFees,
      paid:ex?.paid||0,history:ex?.history||[],
      addr:document.getElementById('sf-addr')?.value||'',
      email:document.getElementById('sf-email')?.value||'',
      inactive:document.getElementById('sf-status')?.value==='inactive',
      notes:document.getElementById('sf-notes')?.value||'',
      courseIds:getSelectedCourseIds(),
      photo:document.getElementById('sf-photo-data')?.value||ex?.photo||'',
      joinDate:ex?.joinDate||todayStr(),
    };
    // 1. Update in-memory data first
    if(ex){students=students.map(x=>x.id===ex.id?obj:x);}
    else{students.push(obj);}
    // Sync course enrollment
    const sid=obj.id;
    courses=courses.map(c=>{
      const studs=[...(c.students||[])];
      const inCourse=(obj.courseIds||[]).includes(c.id);
      const idx=studs.indexOf(sid);
      if(inCourse&&idx===-1)studs.push(sid);
      if(!inCourse&&idx!==-1)studs.splice(idx,1);
      return{...c,students:studs};
    });

    // 2. Close modal immediately
    closeFormModal('student');

    // 3. Navigate to Students page so user can see the new student
    //    (they may have opened the form from Dashboard or another page)
    gotoPage('students');

    // 4. Save to disk in background
    await persist();
    toast(ex?'✅ Student updated!':'✅ Student added: '+obj.name);
  }catch(err){
    console.error('saveStu error:',err);
    toast('Save failed: '+err.message,'err');
    if(btn){btn.textContent='💾 Save Student';btn.disabled=false;}
  }
}

function delStu(id){
  if(!canDo('delete_students','You do not have permission to delete students')) return;
  if(!confirm('Delete this student and their records?')) return;

  // Find the delete button that was clicked and animate it
  const row = document.querySelector(`tr`);
  const rows = document.querySelectorAll('#stu-tbody tr');
  let targetRow = null;
  rows.forEach(r => {
    if(r.querySelector(`[onclick*="delStu('${id}')"]`)) targetRow = r;
  });
  const delBtn = targetRow ? targetRow.querySelector('.btn-red') : null;

  // Step 1: Show inline deleting animation on the button
  if(delBtn){
    delBtn.className = 'btn btn-xs btn-deleting';
    delBtn.innerHTML = '<span class="spin-icon">🗑️</span> Deleting…';
    delBtn.disabled = true;
  }

  // Step 2: After animation, flash the row red and remove
  setTimeout(async()=>{
    if(targetRow){
      targetRow.className = 'row-just-deleted';
    }
    // Wait for the red flash animation to complete
    setTimeout(async()=>{
      students=students.filter(x=>x.id!==id);delete stuFeeOvr[id];
      await persist();
      renderStus();toast('Student deleted','err');
    }, 800);
  },1000);
}
