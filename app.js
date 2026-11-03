(() => {
"use strict";
const $ = id => document.getElementById(id);
const NOTES = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
const STRINGS = [
  {name:"E4",midi:64,label:"1ª · Mi agudo",short:"1ª CUERDA"},
  {name:"B3",midi:59,label:"2ª · Si",short:"2ª CUERDA"},
  {name:"G3",midi:55,label:"3ª · Sol",short:"3ª CUERDA"},
  {name:"D3",midi:50,label:"4ª · Re",short:"4ª CUERDA"},
  {name:"A2",midi:45,label:"5ª · La",short:"5ª CUERDA"},
  {name:"E2",midi:40,label:"6ª · Mi grave",short:"6ª CUERDA"}
];
const EXERCISE = [
  {midi:64,desc:"Mi agudo · cuerda al aire",string:"1ª · Mi agudo",fret:0,finger:0},
  {midi:65,desc:"Fa · primera posición",string:"1ª · Mi agudo",fret:1,finger:1},
  {midi:66,desc:"Fa sostenido · primera posición",string:"1ª · Mi agudo",fret:2,finger:2},
  {midi:67,desc:"Sol · primera posición",string:"1ª · Mi agudo",fret:3,finger:3},
  {midi:68,desc:"Sol sostenido · primera posición",string:"1ª · Mi agudo",fret:4,finger:4}
];
const FINGER_NAMES = ["Ninguno · cuerda al aire","1 · Índice","2 · Medio","3 · Anular","4 · Meñique"];
let audioCtx=null, analyser=null, stream=null, source=null, raf=0, selectedString=0;
let currentExercise=0, attempts=0, hits=0, streak=0, score=0, sessionStart=0, lastDetected=null, lastScoredAt=0, sequenceTimer=null;
let songPracticeMode=false, songPracticeNotes=[], songPracticeIndex=0;
let deferredInstall=null;
const storageKey="gmai_v1_stats";
let stats=JSON.parse(localStorage.getItem(storageKey)||'{"sessions":0,"minutes":0,"accuracy":0,"totalHits":0,"totalAttempts":0}');
function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600)}
function showView(name){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id==="view-"+name));window.scrollTo({top:0,behavior:"smooth"});if(name==="fretboard")renderFretboard();if(name==="lessons")renderLessons();if(name==="duo")initDuoView()}
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.go==="practice"){songPracticeMode=false;songPracticeNotes=[];songPracticeIndex=0;setExercise()}showView(b.dataset.go)}));
function midiName(midi){const n=((midi%12)+12)%12;return NOTES[n]+(Math.floor(midi/12)-1)}
function freqToMidi(freq){return Math.round(69+12*Math.log2(freq/440))}
function midiToFreq(midi){return 440*Math.pow(2,(midi-69)/12)}
function noteCents(freq,midi){return 1200*Math.log2(freq/midiToFreq(midi))}
function detectPitch(buffer,sampleRate){
  let rms=0;for(let i=0;i<buffer.length;i++)rms+=buffer[i]*buffer[i];rms=Math.sqrt(rms/buffer.length);
  if(rms<0.009)return null;
  // Autocorrelation: robust enough for a first monophonic tuner; not a polyphonic chord recognizer.
  const SIZE=buffer.length, minLag=Math.floor(sampleRate/1000), maxLag=Math.min(Math.floor(sampleRate/65),SIZE-2);
  let bestLag=-1,best=0,prev=1;
  for(let lag=minLag;lag<=maxLag;lag++){
    let corr=0;for(let i=0;i<SIZE-lag;i++)corr+=buffer[i]*buffer[i+lag];
    corr/=SIZE-lag;
    if(corr>best){best=corr;bestLag=lag;}
    if(lag>minLag && corr<prev && bestLag>0 && best>0.01)break;
    prev=corr;
  }
  if(bestLag<0 || best<0.01)return null;
  // Refine lag using neighbouring correlation values.
  const correlation = lag => {let c=0;for(let i=0;i<SIZE-lag;i++)c+=buffer[i]*buffer[i+lag];return c/(SIZE-lag)};
  const y1=correlation(bestLag-1),y2=correlation(bestLag),y3=correlation(bestLag+1);
  const denom=(y1-2*y2+y3), shift=denom?0.5*(y1-y3)/denom:0;
  const period=bestLag+shift, frequency=sampleRate/period;
  if(frequency<60||frequency>1200)return null;
  return {frequency,midi:freqToMidi(frequency),rms};
}
async function connectAudio(){
  if(!navigator.mediaDevices?.getUserMedia){toast("Este navegador no permite capturar audio. Usa Chrome o Edge actualizado mediante HTTPS.");return}
  try{
    const deviceId=$("inputSelect").value;
    stream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:deviceId?{exact:deviceId}:undefined,echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    audioCtx=new AudioContext({latencyHint:"interactive"});
    await audioCtx.resume();
    source=audioCtx.createMediaStreamSource(stream);
    analyser=audioCtx.createAnalyser();analyser.fftSize=8192;analyser.smoothingTimeConstant=0;
    source.connect(analyser);
    $("audioStatus").classList.add("connected");$("audioStatus").innerHTML="<i></i> Audio conectado";
    $("connectBtn").disabled=true;$("disconnectBtn").disabled=false;
    $("tunerInputLabel").textContent="Entrada activa";
    $("tunerHint").textContent="Audio conectado. Toca una cuerda individual, deja que suene y observa el indicador.";
    await populateInputs();startAudioLoop();toast("Guitarra conectada. ¡A tocar!");
  }catch(e){console.error(e);toast("No se pudo conectar el audio. Revisa permisos y dispositivo de entrada.")}
}
async function populateInputs(){
  try{
    const devices=await navigator.mediaDevices.enumerateDevices(),inputs=devices.filter(d=>d.kind==="audioinput"),select=$("inputSelect"),current=select.value;
    select.innerHTML="";
    inputs.forEach((d,i)=>{const o=document.createElement("option");o.value=d.deviceId;o.textContent=d.label||`Entrada de audio ${i+1}`;select.appendChild(o)});
    if(current)select.value=current;
  }catch(e){}
}
function disconnectAudio(){
  cancelAnimationFrame(raf);if(stream)stream.getTracks().forEach(t=>t.stop());if(audioCtx)audioCtx.close();
  stream=null;audioCtx=null;analyser=null;source=null;$("audioStatus").classList.remove("connected");$("audioStatus").innerHTML="<i></i> Audio desconectado";
  $("connectBtn").disabled=false;$("disconnectBtn").disabled=true;$("tunerInputLabel").textContent="Esperando audio…";toast("Audio desconectado.");
}
function startAudioLoop(){
  const buffer=new Float32Array(analyser.fftSize);
  const tick=()=>{
    if(!analyser)return;
    analyser.getFloatTimeDomainData(buffer);
    const result=detectPitch(buffer,audioCtx.sampleRate);
    if(result){lastDetected=result;updateTuner(result);updatePractice(result)}
    raf=requestAnimationFrame(tick);
  };tick();
}
function updateTuner(result){
  const midi=result.midi, name=midiName(midi),cents=noteCents(result.frequency,midi);
  $("tunerNote").textContent=name;$("tunerFreq").textContent=result.frequency.toFixed(1)+" Hz";
  $("tunerCents").textContent=(cents>0?"+":"")+cents.toFixed(0)+" cents · "+(Math.abs(cents)<=5?"Afinada":cents<0?"Demasiado grave":"Demasiado aguda");
  $("tunerNeedle").style.left=(50+Math.max(-48,Math.min(48,cents/50*48)))+"%";
  $("tunerNeedle").style.background=Math.abs(cents)<=5?"var(--green)":"white";
  const matching=STRINGS.findIndex(s=>s.midi===midi);
  if(matching>=0){$("tunerHint").textContent=`Detectando ${STRINGS[matching].label}. Ajusta hasta acercarte a 0 cents.`}
}
function setupStringButtons(){
  $("stringButtons").innerHTML=STRINGS.map((s,i)=>`<button class="string-btn ${i===selectedString?"active":""}" data-string="${i}">${s.name}</button>`).join("");
  $("stringButtons").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{selectedString=+b.dataset.string;setupStringButtons();$("tunerHint").textContent="Objetivo: "+STRINGS[selectedString].label+". Toca esa cuerda y afínala."}));
}
function currentPracticeTarget(){
  if(songPracticeMode&&songPracticeNotes.length){const n=songPracticeNotes[songPracticeIndex%songPracticeNotes.length],p=n.position;return {midi:n.pitch,desc:`Canción · nota ${songPracticeIndex+1} de ${songPracticeNotes.length}`,string:p.string,fret:p.fret,finger:p.fret===0?0:Math.min(4,((p.fret-1)%4)+1)}}
  return EXERCISE[currentExercise%EXERCISE.length];
}
function setExercise(){
  const ex=currentPracticeTarget();
  $("targetNote").textContent=midiName(ex.midi);
  $("targetDescription").textContent=ex.desc;
  $("targetString").textContent=ex.string;
  $("targetFret").textContent=ex.fret===0?"0 · Al aire":`${ex.fret} · Presiona aquí`;
  $("targetFinger").textContent=FINGER_NAMES[ex.finger]||ex.finger;
  $("practiceTag").textContent=songPracticeMode?"PRÁCTICA DE CANCIÓN":"EJERCICIO 01";
  $("practiceHeading").textContent=songPracticeMode?"Sigue las notas de tu canción":"Primeras notas · Cuerda 1";
}
function updatePractice(result){
  $("detectedNote").textContent=midiName(result.midi);
  const ex=currentPracticeTarget(),cents=Math.abs(noteCents(result.frequency,ex.midi));
  const now=performance.now();
  if(cents<=35 && now-lastScoredAt>650){
    lastScoredAt=now;attempts++;hits++;streak++;score+=100;setFeedback("¡Correcto!",true);updateScore();
  }else if(cents>35 && now-lastScoredAt>1300){
    // Count a mismatch only when a stable detected pitch is clearly different.
    lastScoredAt=now;attempts++;streak=0;setFeedback("Revisa la nota",false);updateScore();
  }
}
function setFeedback(text,ok){$("feedbackText").textContent=text;$("feedbackText").style.color=ok?"var(--green)":"var(--orange)"}
function updateScore(){$("sessionScore").textContent=score;$("hits").textContent=hits;$("attempts").textContent=attempts;$("streak").textContent=streak;$("liveAccuracy").textContent=attempts?Math.round(hits/attempts*100)+"%":"—"}
function nextExercise(){
  if(songPracticeMode){songPracticeIndex++;if(songPracticeIndex>=songPracticeNotes.length){songPracticeMode=false;songPracticeNotes=[];songPracticeIndex=0;toast("Terminaste la secuencia de la canción.")} }
  else currentExercise=(currentExercise+1)%EXERCISE.length;
  setExercise();setFeedback("Escucha la nota objetivo",false)
}
$("nextNoteBtn").addEventListener("click",nextExercise);
$("tempo").addEventListener("input",e=>$("tempoValue").textContent=e.target.value+" BPM");
$("startSequenceBtn").addEventListener("click",()=>{
  if(sequenceTimer){clearInterval(sequenceTimer);sequenceTimer=null;$("startSequenceBtn").textContent="▶ Secuencia guiada";return}
  const interval=60000/+ $("tempo").value;
  $("startSequenceBtn").textContent="Ⅱ Detener secuencia";nextExercise();
  sequenceTimer=setInterval(nextExercise,interval*2);
});
$("finishSessionBtn").addEventListener("click",()=>{
  if(attempts===0){toast("Realiza algunos intentos antes de guardar.");return}
  const mins=Math.max(1,Math.round((Date.now()-sessionStart)/60000));
  stats.sessions++;stats.minutes+=mins;stats.totalHits+=hits;stats.totalAttempts+=attempts;stats.accuracy=Math.round(stats.totalHits/stats.totalAttempts*100);
  localStorage.setItem(storageKey,JSON.stringify(stats));renderStats();attempts=0;hits=0;streak=0;score=0;sessionStart=Date.now();updateScore();toast("Sesión guardada en este dispositivo.");
});
function renderStats(){
  $("statSessions").textContent=stats.sessions;$("statMinutes").textContent=stats.minutes;$("statAccuracy").textContent=stats.totalAttempts?stats.accuracy+"%":"—";
  const p=Math.min(100,stats.sessions*10);$("progressBar").style.width=p+"%";$("progressText").textContent=stats.sessions?`${stats.sessions} sesiones completadas. Sigue practicando para avanzar.`:"Completa tu primera práctica para comenzar.";
}
function renderFretboard(){
  const root=40,frets=12,view=$("fretView").value;
  let html='<div class="fret-label">CUERDA</div>';for(let f=0;f<=frets;f++)html+=`<div class="fret-label">${f===0?"AL AIRE":f}</div>`;
  STRINGS.forEach((s,idx)=>{
    html+=`<div class="fret-label">${["e","B","G","D","A","E"][idx]}</div>`;
    for(let f=0;f<=frets;f++){const midi=s.midi+f,note=midiName(midi).replace(/[0-9]/g,""),label=view==="notes"?note:String((midi-root+120)%12);html+=`<div class="fret-cell"><button class="${midi%12===4?"root":""}" data-midi="${midi}" data-string="${idx}" data-fret="${f}" title="${note} · traste ${f}">${label}</button></div>`}
  });
  $("fretboard").innerHTML=html;
  $("fretboard").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{$("fretExplain").textContent=`${midiName(+b.dataset.midi)} · ${STRINGS[+b.dataset.string].label} · Traste ${b.dataset.fret}. Frecuencia aproximada: ${midiToFreq(+b.dataset.midi).toFixed(2)} Hz.`}));
}
$("fretView").addEventListener("change",renderFretboard);
const lessons=[
["Conoce tu guitarra","Identifica cuerpo, mástil, puente, clavijero, trastes y las seis cuerdas.","Conceptos básicos"],
["Afinación estándar","Aprende el orden Mi–La–Re–Sol–Si–Mi y utiliza el afinador.","Afinación"],
["Primeras notas","Ubica Mi, Fa y Sol en la primera cuerda y practica con el modo interactivo.","Notas"],
["Ritmo y pulsación","Sigue un pulso constante con metrónomo y practica negras y corcheas.","Ritmo"],
["Power chords","Construye acordes de quinta y aprende una base fundamental del rock.","Acordes"],
["Primer riff de rock","Combina notas y silencios en un ejercicio original de dificultad inicial.","Rock"]
];
function renderLessons(){
  $("lessonList").innerHTML=lessons.map((l,i)=>`<article class="lesson-card"><div class="lesson-number">${String(i+1).padStart(2,"0")}</div><div><h3>${l[0]}</h3><p>${l[1]}</p><span class="tag">${l[2]}</span><p style="margin-top:12px"><button data-lesson="${i}">ABRIR LECCIÓN →</button></p></div></article>`).join("");
  $("lessonList").querySelectorAll("[data-lesson]").forEach(b=>b.addEventListener("click",()=>{const i=+b.dataset.lesson;toast("Lección "+(i+1)+": "+lessons[i][0]+". Contenido guiado en ampliación.");if(i===1)showView("tuner");else if(i===2)showView("practice");else if(i===0||i===4)showView("fretboard")}));
}
$("connectBtn").addEventListener("click",connectAudio);$("disconnectBtn").addEventListener("click",disconnectAudio);
$("inputSelect").addEventListener("focus",populateInputs);
setupStringButtons();setExercise();renderStats();renderFretboard();renderLessons();sessionStart=Date.now();
if("serviceWorker" in navigator && location.protocol!=="file:"){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(console.warn))}
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;$("installBtn").hidden=false});
$("installBtn").addEventListener("click",async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$("installBtn").hidden=true});
navigator.mediaDevices?.addEventListener?.("devicechange",populateInputs);

// ===================== BIBLIOTECA DE CANCIONES V1.2 =====================
const SONG_DB = "guitar-master-ai-library";
const SONG_STORE = "songs";
let songDbPromise = null, alphaTabApi = null, currentSongAudioUrl = null, midiAudioContext = null, midiPlaybackTimers = [], midiPlaybackNodes = [];
let currentMidiNotes = [];
const GUITAR_STRINGS_LOW=[{midi:40,name:"6ª · Mi grave"},{midi:45,name:"5ª · La"},{midi:50,name:"4ª · Re"},{midi:55,name:"3ª · Sol"},{midi:59,name:"2ª · Si"},{midi:64,name:"1ª · Mi agudo"}];
const BUILTIN_SONGS = [
  {id:"builtin:riff-mi",name:"Riff inicial en Mi",ext:"EJERCICIO",type:"midi",size:0,parsed:makeBuiltinMidi([40,40,43,45,47,45,43,40,40,43,45,43,40],260,180,100)},
  {id:"builtin:hard-rock",name:"Base Hard Rock en La",ext:"EJERCICIO",type:"midi",size:0,parsed:makeBuiltinMidi([45,45,52,55,57,55,52,45,45,52,55,57,59,57,55,52],220,150,112)},
  {id:"builtin:metal-gallop",name:"Metal galopante en Mi",ext:"EJERCICIO",type:"midi",size:0,parsed:makeBuiltinMidi([40,40,40,43,40,40,45,43,40,40,40,47,45,43,40,40],170,115,128)}
];
function makeBuiltinMidi(pitches,step,duration,tempo){return {format:1,tracks:1,division:480,tempo,notes:pitches.map((pitch,i)=>({pitch,name:midiName(pitch),tick:i*240,endTick:i*240+160,startMs:i*step,durationMs:duration,velocity:94,position:bestGuitarPosition(pitch)})),durationMs:pitches.length*step}}
function openSongDb(){
  if(songDbPromise)return songDbPromise;
  songDbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(SONG_DB,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(SONG_STORE))db.createObjectStore(SONG_STORE,{keyPath:"id"})};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });return songDbPromise;
}
async function songDbAction(mode,record){
  const db=await openSongDb();return new Promise((resolve,reject)=>{
    const tx=db.transaction(SONG_STORE,mode),store=tx.objectStore(SONG_STORE);let req;
    if(mode==="readonly"&&record?.id)req=store.get(record.id);
    else if(mode==="readonly")req=store.getAll();
    else if(record?.delete)req=store.delete(record.id);
    else req=store.put(record);
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
function songExt(name){return (name.split(".").pop()||"").toLowerCase()}
function songType(ext){if(["gp3","gp4","gp5","gpx","gp"].includes(ext))return "guitarpro";if(["mid","midi"].includes(ext))return "midi";if(["mp3","wav"].includes(ext))return "audio";return "unknown"}
function prettySize(bytes){if(bytes<1024*1024)return (bytes/1024).toFixed(0)+" KB";return (bytes/1024/1024).toFixed(1)+" MB"}
async function importSongFiles(files){
  const accepted=["gp3","gp4","gp5","gpx","gp","mid","midi","mp3","wav"];
  for(const file of files){
    const ext=songExt(file.name),type=songType(ext);
    if(!accepted.includes(ext)){toast("Formato no compatible: "+file.name);continue}
    if(file.size>40*1024*1024){toast(file.name+" supera el límite recomendado de 40 MB.");continue}
    try{
      const record={id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),name:file.name,ext,type,size:file.size,addedAt:Date.now(),blob:file};
      if(type==="midi"){
        record.parsed=parseMidi(await file.arrayBuffer());
        if(!record.parsed.notes.length)throw new Error("No se encontraron notas MIDI.");
      }
      await songDbAction("readwrite",record);
      toast("Agregada: "+file.name);
    }catch(e){console.error(e);toast("No se pudo importar "+file.name+": "+(e.message||"archivo inválido"))}
  }
  await renderSongLibrary();
}
function parseMidi(buffer){
  const v=new DataView(buffer);let pos=0;
  const readU32=()=>{const n=v.getUint32(pos);pos+=4;return n};
  const readU16=()=>{const n=v.getUint16(pos);pos+=2;return n};
  const readVar=()=>{let n=0,b;do{if(pos>=v.byteLength)throw new Error("MIDI incompleto");b=v.getUint8(pos++);n=(n<<7)|(b&127)}while(b&128);return n};
  const readStr=n=>{let out="";for(let i=0;i<n;i++)out+=String.fromCharCode(v.getUint8(pos++));return out};
  if(readStr(4)!=="MThd")throw new Error("El archivo no tiene una cabecera MIDI válida.");
  const headerLen=readU32();const format=readU16(),trackCount=readU16(),division=readU16();pos=8+headerLen;
  if(division&0x8000)throw new Error("MIDI con división SMPTE no compatible en esta versión.");
  const all=[],tempos=[{tick:0,us:500000}];
  for(let track=0;track<trackCount&&pos<v.byteLength;track++){
    if(readStr(4)!=="MTrk")throw new Error("Pista MIDI dañada.");const len=readU32(),end=pos+len;let tick=0,running=0;const active=new Map();
    while(pos<end){tick+=readVar();let status=v.getUint8(pos++);if(status<0x80){pos--;status=running}else running=status;
      if(status===0xff){const type=v.getUint8(pos++),n=readVar();if(type===0x51&&n===3){const us=(v.getUint8(pos)<<16)|(v.getUint8(pos+1)<<8)|v.getUint8(pos+2);tempos.push({tick,us})}pos+=n;continue}
      if(status===0xf0||status===0xf7){pos+=readVar();continue}
      const kind=status&0xf0,channel=status&0x0f,a=v.getUint8(pos++),needsTwo=![0xc0,0xd0].includes(kind),b=needsTwo?v.getUint8(pos++):0;
      if(kind===0x90&&b>0){if(channel===9)continue;const key=channel+":"+a;if(!active.has(key))active.set(key,[]);active.get(key).push({tick,pitch:a,velocity:b,channel,track})}
      else if(kind===0x80||(kind===0x90&&b===0)){const key=channel+":"+a,stack=active.get(key);if(stack?.length){const start=stack.shift();all.push({...start,endTick:Math.max(tick,start.tick+1)})}}
    }
    pos=end;
  }
  all.sort((a,b)=>a.tick-b.tick);tempos.sort((a,b)=>a.tick-b.tick);
  const tickMs=tick=>{let ms=0,lastTick=0,us=500000;for(const t of tempos){if(t.tick>tick)break;ms+=(t.tick-lastTick)*us/division/1000;lastTick=t.tick;us=t.us}return ms+(tick-lastTick)*us/division/1000};
  const notes=all.map(n=>{const position=bestGuitarPosition(n.pitch);return {...n,startMs:tickMs(n.tick),durationMs:Math.max(70,tickMs(n.endTick)-tickMs(n.tick)),name:midiName(n.pitch),position}}).sort((a,b)=>a.startMs-b.startMs);
  const tempo=tempos[0]?.us?Math.round(60000000/tempos[0].us):120;
  return {format,tracks:trackCount,division,tempo,notes,durationMs:notes.length?Math.max(...notes.map(n=>n.startMs+n.durationMs)):0};
}
function bestGuitarPosition(midi){
  const choices=[];GUITAR_STRINGS_LOW.forEach((s,index)=>{const fret=midi-s.midi;if(fret>=0&&fret<=22)choices.push({string:s.name,stringIndex:6-index,fret})});
  choices.sort((a,b)=>a.fret-b.fret||b.stringIndex-a.stringIndex);const p=choices[0];if(!p)return {string:"Fuera del rango",stringIndex:0,fret:"—",finger:"—"};
  const finger=p.fret===0?"Ninguno · al aire":(["","Índice","Medio","Anular","Meñique"][(p.fret-1)%4+1]+" (sugerido)");return {...p,finger};
}
async function renderSongLibrary(){
  const records=await songDbAction("readonly"),root=$("songLibrary");
  $("songCount").textContent=records.length+" ARCHIVOS";
  const personal=records.sort((a,b)=>b.addedAt-a.addedAt).map(r=>`<article class="song-item"><div class="song-file-icon">${r.type==="audio"?"♫":r.type==="midi"?"M":"GP"}</div><div><strong>${escapeHtml(r.name)}</strong><small>${r.ext.toUpperCase()} · ${prettySize(r.size)} · ${r.type==="audio"?"Pista de audio":r.type==="midi"?`${r.parsed.notes.length} notas MIDI`:"Tablatura Guitar Pro"}</small></div><div class="song-item-actions"><button data-open-song="${r.id}">Abrir</button><button class="delete-song" data-delete-song="${r.id}" title="Eliminar">Eliminar</button></div></article>`).join("");
  const builtins=BUILTIN_SONGS.map(r=>`<article class="song-item"><div class="song-file-icon">♫</div><div><strong>${escapeHtml(r.name)}</strong><small>EJERCICIO ORIGINAL · ${r.parsed.notes.length} notas · ${r.parsed.tempo} BPM · Incluido en la app</small></div><div class="song-item-actions"><button data-open-song="${r.id}">Practicar</button></div></article>`).join("");
  root.innerHTML=`<p class="eyebrow">MIS ARCHIVOS</p>${personal||'<p class="empty-library">Aún no has importado canciones propias.</p>'}<p class="eyebrow builtin-heading">BIBLIOTECA GUITAR MASTER · EJERCICIOS ORIGINALES</p>${builtins}`;
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function closeSongWorkspace(){stopMidiPlayback();if(alphaTabApi){try{alphaTabApi.destroy()}catch(e){}alphaTabApi=null}if(currentSongAudioUrl){URL.revokeObjectURL(currentSongAudioUrl);currentSongAudioUrl=null}$("songWorkspace").hidden=true;$("songAudio").pause();$("songAudio").removeAttribute("src")}
async function openSong(id){
  const r=id.startsWith("builtin:")?BUILTIN_SONGS.find(x=>x.id===id):await songDbAction("readonly",{id});if(!r)return;
  closeSongWorkspace();$("songWorkspace").hidden=false;$("songTitle").textContent=r.name;$("songMeta").textContent=r.id.startsWith("builtin:")?"Ejercicio original incluido en Guitar Master AI":""+r.ext.toUpperCase()+" · "+prettySize(r.size)+" · guardado en este dispositivo";
  $("audioSongPlayer").hidden=r.type!=="audio";$("midiSongPlayer").hidden=r.type!=="midi";$("gpSongPlayer").hidden=r.type!=="guitarpro";
  if(r.type==="audio"){
    currentSongAudioUrl=URL.createObjectURL(r.blob);const audio=$("songAudio");audio.src=currentSongAudioUrl;audio.load();
  }else if(r.type==="midi"){
    songPracticeMode=false;songPracticeNotes=[];songPracticeIndex=0;
    currentMidiNotes=r.parsed.notes;renderMidiNotes(currentMidiNotes);$("midiSummary").textContent=`${r.parsed.notes.length} notas · ${r.parsed.tracks} pistas · ${r.parsed.tempo} BPM aprox. · Duración ${formatSongTime(r.parsed.durationMs)}. Posiciones sugeridas para afinación estándar.`;
  }else if(r.type==="guitarpro"){
    await loadGuitarPro(r);
  }
  $("songWorkspace").scrollIntoView({behavior:"smooth",block:"start"});
}
function formatSongTime(ms){const s=Math.floor(ms/1000);return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")}
function renderMidiNotes(notes){
  const root=$("midiNotes"),limit=notes.slice(0,1000);
  root.innerHTML=limit.map((n,i)=>`<div class="midi-note" data-midi-index="${i}"><strong>${escapeHtml(n.name)}</strong><span>${escapeHtml(n.position.string)} · Traste ${n.position.fret}</span><small>${n.position.finger} · ${formatSongTime(n.startMs)}</small></div>`).join("");
  if(notes.length>1000)root.insertAdjacentHTML("beforeend",`<p class="muted">Se muestran las primeras 1.000 de ${notes.length} notas.</p>`);
}
async function loadGuitarPro(record){
  $("gpStatus").textContent="Cargando lector de tablaturas…";$("gpPlayBtn").disabled=true;$("gpStopBtn").disabled=true;$("gpScore").innerHTML="";
  try{
    const alphaTab=await import("https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.9.0/dist/alphaTab.min.mjs");
    const container=$("gpScore");
    alphaTabApi=new alphaTab.AlphaTabApi(container,{player:{enablePlayer:true,soundFont:"https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.9.0/dist/soundfont/sonivox.sf2",scrollElement:container}});
    alphaTabApi.scoreLoaded.on(score=>{$("songMeta").textContent=`${score.title||record.name}${score.artist?" · "+score.artist:""} · ${score.tracks.length} pistas`;$("gpStatus").textContent="Tablatura cargada. Elige reproducir para escucharla."});
    alphaTabApi.playerReady.on(()=>{$("gpPlayBtn").disabled=false;$("gpStopBtn").disabled=false;$("gpStatus").textContent="Reproductor listo"});
    alphaTabApi.error.on(e=>{$("gpStatus").textContent="No se pudo leer este archivo: "+(e.message||"formato no reconocido")});
    alphaTabApi.load(new Uint8Array(await record.blob.arrayBuffer()));
    $("gpPlayBtn").onclick=()=>alphaTabApi?.playPause();$("gpStopBtn").onclick=()=>alphaTabApi?.stop();
  }catch(e){console.error(e);$("gpStatus").textContent="No se pudo cargar el lector Guitar Pro. Verifica la conexión a internet y vuelve a abrir la canción.";toast("No se pudo abrir la tablatura Guitar Pro.")}
}
function stopMidiPlayback(){midiPlaybackTimers.forEach(clearTimeout);midiPlaybackTimers=[];midiPlaybackNodes.forEach(n=>{try{n.stop()}catch(e){}});midiPlaybackNodes=[];if(midiAudioContext){midiAudioContext.close().catch(()=>{});midiAudioContext=null}}
async function playMidi(){
  stopMidiPlayback();if(!currentMidiNotes.length)return;
  const speed=Number($("midiSpeed").value)||1;const AC=window.AudioContext||window.webkitAudioContext;midiAudioContext=new AC();await midiAudioContext.resume();const base=midiAudioContext.currentTime+0.12;
  currentMidiNotes.forEach((n,i)=>{
    const start=base+n.startMs/1000/speed,duration=Math.min(2.5,n.durationMs/1000/speed),osc=midiAudioContext.createOscillator(),gain=midiAudioContext.createGain();
    osc.type="triangle";osc.frequency.value=440*Math.pow(2,(n.pitch-69)/12);gain.gain.setValueAtTime(0.0001,start);gain.gain.exponentialRampToValueAtTime(Math.max(.025,n.velocity/127*.12),start+.015);gain.gain.setValueAtTime(Math.max(.025,n.velocity/127*.12),start+Math.max(.02,duration-.04));gain.gain.exponentialRampToValueAtTime(.0001,start+duration);osc.connect(gain);gain.connect(midiAudioContext.destination);osc.start(start);osc.stop(start+duration+.02);midiPlaybackNodes.push(osc);
    const delay=Math.max(0,(n.startMs/speed));midiPlaybackTimers.push(setTimeout(()=>{document.querySelectorAll(".midi-note.active").forEach(el=>el.classList.remove("active"));const card=document.querySelector(`[data-midi-index="${i}"]`);if(card){card.classList.add("active");card.scrollIntoView({block:"nearest",behavior:"smooth"})}},delay));
  });
  const total=Math.max(...currentMidiNotes.map(n=>n.startMs+n.durationMs))/speed+250;midiPlaybackTimers.push(setTimeout(stopMidiPlayback,total));
}

// Modo Dúo: dos capturas independientes en el mismo equipo.
const duoPlayers=[null,null];let duoRecords=[];let duoRefreshTimer=null;let duoSharedAudio=null;let duoSharedUrl=null;
function duoInstrumentStrings(value){return value.includes("Bajo")?"E A D G":"E A D G B E"}
function updateDuoInstrumentLabels(){[1,2].forEach(n=>{const instrument=$("duoInstrument"+n).value;$("duoStageInstrument"+n).textContent=instrument;$("duoFret"+n).textContent=duoInstrumentStrings(instrument)})}
async function initDuoView(){
  updateDuoInstrumentLabels();
  const select=$("duoSong");if(!select.dataset.loaded){
    try{duoRecords=await songDbAction("readonly")}catch(e){duoRecords=[]}
    const opts=[...BUILTIN_SONGS,...duoRecords].map(r=>`<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}${r.id.startsWith("builtin:")?" · ejercicio":""}</option>`).join("");
    select.insertAdjacentHTML("beforeend",opts);select.dataset.loaded="1";
  }
  await populateDuoInputs();
}
async function populateDuoInputs(){
  try{const devices=await navigator.mediaDevices.enumerateDevices(),inputs=devices.filter(d=>d.kind==="audioinput");
    [1,2].forEach(n=>{const el=$("duoInput"+n),old=el.value;el.innerHTML='<option value="">Micrófono predeterminado</option>'+inputs.map((d,i)=>`<option value="${escapeHtml(d.deviceId)}">${escapeHtml(d.label||`Entrada de audio ${i+1}`)}</option>`).join("");if(old)el.value=old});
  }catch(e){}
}
async function connectDuoPlayer(index){
  const n=index+1;if(duoPlayers[index]){toast(`El jugador ${n} ya está conectado.`);return}
  if(!navigator.mediaDevices?.getUserMedia){toast("Se necesita Chrome o Edge actualizado y HTTPS para capturar audio.");return}
  try{
    const deviceId=$("duoInput"+n).value;
    const constraints={audio:{...(deviceId?{deviceId:{exact:deviceId}}:{}),echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false};
    const media=await navigator.mediaDevices.getUserMedia(constraints),AC=window.AudioContext||window.webkitAudioContext,ctx=new AC({latencyHint:"interactive"});await ctx.resume();
    const src=ctx.createMediaStreamSource(media),an=ctx.createAnalyser();an.fftSize=8192;an.smoothingTimeConstant=0;src.connect(an);
    const player={stream:media,ctx,src,an,raf:0,buffer:new Float32Array(an.fftSize),samples:0,good:0};duoPlayers[index]=player;
    const tick=()=>{if(!duoPlayers[index])return;an.getFloatTimeDomainData(player.buffer);const pitch=detectPitch(player.buffer,ctx.sampleRate);
      if(pitch){const name=midiName(pitch.midi),cents=Math.abs(noteCents(pitch.frequency,pitch.midi));$("duoNote"+n).textContent=name;$("duoPitch"+n).textContent=pitch.frequency.toFixed(1)+" Hz · "+(cents<=5?"Afinada":cents.toFixed(0)+" cents de desviación");player.samples++;if(cents<=15)player.good++;$("duoAccuracy"+n).textContent=Math.round(player.good/player.samples*100)+"%"}
      player.raf=requestAnimationFrame(tick)};tick();
    $("duoConnect"+n).textContent=`Jugador ${n} conectado`;$("duoConnect"+n).disabled=true;$("duoStageStatus"+n).textContent="Entrada de audio activa";$("duoSessionStatus").textContent=duoPlayers.filter(Boolean).length+" de 2 jugadores conectados";await populateDuoInputs();toast(`Audio del jugador ${n} conectado.`);
  }catch(e){console.error(e);toast(`No se pudo conectar al jugador ${n}. Revisa permisos y entradas de audio.`)}
}
function stopDuoPlayer(index){const n=index+1,p=duoPlayers[index];if(!p)return;cancelAnimationFrame(p.raf);p.stream.getTracks().forEach(t=>t.stop());p.ctx.close().catch(()=>{});duoPlayers[index]=null;$("duoNote"+n).textContent="—";$("duoPitch"+n).textContent="Esperando conexión";$("duoAccuracy"+n).textContent="—";$("duoConnect"+n).disabled=false;$("duoConnect"+n).textContent=`Conectar jugador ${n}`;$("duoStageStatus"+n).textContent="Sin conexión";$("duoSessionStatus").textContent=duoPlayers.filter(Boolean).length+" de 2 jugadores conectados"}
function stopDuo(){stopDuoPlayer(0);stopDuoPlayer(1);if(duoSharedAudio){duoSharedAudio.pause();duoSharedAudio=null}if(duoSharedUrl){URL.revokeObjectURL(duoSharedUrl);duoSharedUrl=null}$("duoSessionStatus").textContent="Sesión detenida";toast("Sesión de dúo detenida.")}
async function startDuo(){
  if($("duoConnection").value==="remote"){toast("El modo entre dos dispositivos requiere habilitar un servidor de señalización para sincronizar audio y partida. La configuración está preparada, pero esta conexión aún no está activa.");return}
  const id=$("duoSong").value;if(!id){toast("Selecciona una canción para los dos jugadores.");return}
  if(!duoPlayers[0]||!duoPlayers[1]){toast("Conecta las dos entradas de audio antes de iniciar.");return}
  const song=id.startsWith("builtin:")?BUILTIN_SONGS.find(x=>x.id===id):await songDbAction("readonly",{id});if(!song){toast("No se encontró la canción seleccionada.");return}
  $("duoStageSong").textContent=song.name;$("duoStageStatus1").textContent="Tocando · entrada activa";$("duoStageStatus2").textContent="Tocando · entrada activa";
  if(song.type==="audio"&&song.blob){if(duoSharedUrl)URL.revokeObjectURL(duoSharedUrl);duoSharedUrl=URL.createObjectURL(song.blob);duoSharedAudio=new Audio(duoSharedUrl);duoSharedAudio.onended=()=>{$("duoSessionStatus").textContent="Canción finalizada · entradas aún activas"};try{await duoSharedAudio.play()}catch(e){toast("El navegador bloqueó la reproducción. Pulsa iniciar otra vez.");return}}
  else if(song.type==="midi"&&song.parsed?.notes?.length){playDuoMidi(song.parsed.notes)}
  else if(song.type==="guitarpro"){toast("La tablatura Guitar Pro está disponible en la biblioteca; la reproducción sincronizada dentro del modo Dúo se añadirá en la siguiente integración.")}
  $("duoSessionStatus").textContent="Sesión activa · misma canción para ambos";toast("¡Modo Dúo iniciado!");
}
let duoMidiCtx=null,duoMidiTimers=[];
async function playDuoMidi(notes){duoMidiTimers.forEach(clearTimeout);duoMidiTimers=[];if(duoMidiCtx)duoMidiCtx.close().catch(()=>{});const AC=window.AudioContext||window.webkitAudioContext;duoMidiCtx=new AC();const ctx=duoMidiCtx;await ctx.resume();const base=ctx.currentTime+.15;notes.forEach(n=>{const start=base+n.startMs/1000,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type="triangle";osc.frequency.value=midiToFreq(n.pitch);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.07,start+.02);gain.gain.setValueAtTime(.07,start+Math.max(.03,n.durationMs/1000-.04));gain.gain.exponentialRampToValueAtTime(.0001,start+n.durationMs/1000);osc.connect(gain);gain.connect(ctx.destination);osc.start(start);osc.stop(start+n.durationMs/1000+.03)});const end=Math.max(...notes.map(n=>n.startMs+n.durationMs));duoMidiTimers.push(setTimeout(()=>{$("duoSessionStatus").textContent="MIDI finalizado · entradas aún activas"},end+250))}
$("duoConnect1").addEventListener("click",()=>connectDuoPlayer(0));$("duoConnect2").addEventListener("click",()=>connectDuoPlayer(1));$("duoStopBtn").addEventListener("click",stopDuo);$("duoStartBtn").addEventListener("click",startDuo);
[1,2].forEach(n=>$("duoInstrument"+n).addEventListener("change",updateDuoInstrumentLabels));
$("duoConnection").addEventListener("change",e=>{const remote=e.target.value==="remote";$("duoConnectionNote").textContent=remote?"La modalidad remota necesita un servicio de señalización y sincronización entre dispositivos. Esta interfaz queda preparada; no se puede emparejar todavía desde GitHub Pages sin ese servicio.":"Conecta dos instrumentos mediante dos entradas de audio USB independientes. La disponibilidad depende de tu sistema y navegador.";$("duoPlayerGrid").classList.toggle("remote-preview",remote)});

$("songFiles").addEventListener("change",e=>{if(e.target.files?.length)importSongFiles([...e.target.files]);e.target.value=""});
$("songLibrary").addEventListener("click",async e=>{const open=e.target.closest("[data-open-song]"),del=e.target.closest("[data-delete-song]");if(open)await openSong(open.dataset.openSong);if(del){if(confirm("¿Eliminar esta canción de tu biblioteca local?")){await songDbAction("readwrite",{id:del.dataset.deleteSong,delete:true});await renderSongLibrary();closeSongWorkspace();toast("Canción eliminada del dispositivo.")}}});
$("closeSongBtn").addEventListener("click",closeSongWorkspace);$("midiPlayBtn").addEventListener("click",playMidi);$("midiStopBtn").addEventListener("click",stopMidiPlayback);
$("midiPracticeBtn").addEventListener("click",()=>{if(!currentMidiNotes.length)return;songPracticeMode=true;songPracticeNotes=currentMidiNotes;songPracticeIndex=0;setExercise();showView("practice");setFeedback("Toca la primera nota de la canción",false);toast("Modo práctica de canción activado. Conecta el audio para evaluar tus notas.")});
renderSongLibrary().catch(e=>{console.warn(e);$("songLibrary").innerHTML='<p class="empty-library">El navegador no permitió crear la biblioteca local. Usa una versión actualizada de Chrome o Edge.</p>'});

})();