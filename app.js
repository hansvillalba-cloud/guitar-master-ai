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
  // Downsample by 2 and use normalized autocorrelation. The earlier version
  // selected the first falling sample as a period, which caused false notes
  // and made low guitar/bass frequencies disappear.
  const stride=2,count=Math.floor(buffer.length/stride),effectiveRate=sampleRate/stride;
  let mean=0,rms=0;for(let i=0;i<count;i++){const v=buffer[i*stride];mean+=v;rms+=v*v}mean/=count;rms=Math.sqrt(rms/count);
  if(rms<0.006)return null;
  const minLag=Math.max(2,Math.floor(effectiveRate/1200)),maxLag=Math.min(Math.floor(effectiveRate/35),count-2);
  const correlation=lag=>{
    let sum=0,powerA=0,powerB=0;
    for(let i=0;i<count-lag;i++){const a=buffer[i*stride]-mean,b=buffer[(i+lag)*stride]-mean;sum+=a*b;powerA+=a*a;powerB+=b*b}
    return powerA&&powerB?sum/Math.sqrt(powerA*powerB):0;
  };
  let beforePrevious=correlation(minLag),previous=correlation(minLag+1),valleyFound=false,bestLag=-1,best=0;
  for(let lag=minLag+2;lag<=maxLag;lag++){
    const current=correlation(lag);
    if(!valleyFound&&previous<beforePrevious&&previous<=current)valleyFound=true;
    if(valleyFound&&previous>beforePrevious&&previous>=current){bestLag=lag-1;best=previous;break}
    if(current>best){best=current;bestLag=lag}
    beforePrevious=previous;previous=current;
  }
  if(bestLag<0||best<0.18)return null;
  const y1=correlation(bestLag-1),y2=correlation(bestLag),y3=correlation(bestLag+1),denom=y1-2*y2+y3;
  const shift=denom?Math.max(-0.5,Math.min(0.5,0.5*(y1-y3)/denom)):0;
  const frequency=effectiveRate/(bestLag+shift);
  if(frequency<35||frequency>1400)return null;
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
  const buffer=new Float32Array(analyser.fftSize);let lastAnalysis=0;
  const tick=now=>{
    if(!analyser)return;
    if(now-lastAnalysis>=65){
      lastAnalysis=now;analyser.getFloatTimeDomainData(buffer);
      const result=detectPitch(buffer,audioCtx.sampleRate);
      if(result){lastDetected=result;updateTuner(result);updatePractice(result)}
    }
    raf=requestAnimationFrame(tick);
  };raf=requestAnimationFrame(tick);
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
    if(songPracticeMode){
      songPracticeIndex++;
      if(songPracticeIndex>=songPracticeNotes.length){songPracticeMode=false;songPracticeNotes=[];songPracticeIndex=0;setFeedback("¡Terminaste la canción!",true);}
      else setTimeout(()=>{if(songPracticeMode)setExercise()},220);
    }
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
  const accepted=["gp3","gp4","gp5","gpx","gp","mid","midi","mp3","wav"];let singleAudioId=null;
  for(const file of files){
    const ext=songExt(file.name),type=songType(ext);
    if(!accepted.includes(ext)){toast("Formato no compatible: "+file.name);continue}
    if(file.size>100*1024*1024){toast(file.name+" supera el límite de 100 MB.");continue}
    try{
      const record={id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),name:file.name,ext,type,size:file.size,addedAt:Date.now(),blob:file};
      if(type==="midi"){
        record.parsed=parseMidi(await file.arrayBuffer());
        if(!record.parsed.notes.length)throw new Error("No se encontraron notas MIDI.");
      }
      await songDbAction("readwrite",record);
      if(files.length===1&&type==="audio")singleAudioId=record.id;
      toast("Agregada: "+file.name);
    }catch(e){console.error(e);toast("No se pudo importar "+file.name+": "+(e.message||"archivo inválido"))}
  }
  await renderSongLibrary();
  if(singleAudioId)await openSong(singleAudioId);
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
function closeSongWorkspace(){
  stopMidiPlayback();stopAudioSong();
  if(alphaTabApi){try{alphaTabApi.destroy()}catch(e){}alphaTabApi=null}
  if(currentSongAudioUrl){URL.revokeObjectURL(currentSongAudioUrl);currentSongAudioUrl=null}
  $("songWorkspace").hidden=true;const audio=$("songAudio");audio.pause();audio.removeAttribute("src");audio.load();
}
async function openSong(id){
  try{
    const r=id.startsWith("builtin:")?BUILTIN_SONGS.find(x=>x.id===id):await songDbAction("readonly",{id});if(!r)throw new Error("No se encontró el archivo en la biblioteca local.");
    closeSongWorkspace();$("songWorkspace").hidden=false;$("songTitle").textContent=r.name;$("songMeta").textContent=r.id.startsWith("builtin:")?"Ejercicio original incluido en Guitar Master AI":""+r.ext.toUpperCase()+" · "+prettySize(r.size)+" · guardado en este dispositivo";
    $("audioSongPlayer").hidden=r.type!=="audio";$("midiSongPlayer").hidden=r.type!=="midi";$("gpSongPlayer").hidden=r.type!=="guitarpro";
    if(r.type==="audio"){
      if(!r.blob)throw new Error("El archivo de audio no está disponible en el almacenamiento local. Vuelve a importarlo.");
      currentSongAudioUrl=URL.createObjectURL(r.blob);const audio=$("songAudio");audio.src=currentSongAudioUrl;audio.load();setAudioSongStatus("Audio cargado. Pulsa Reproducir audio.");
    }else if(r.type==="midi"){
      songPracticeMode=false;songPracticeNotes=[];songPracticeIndex=0;currentMidiNotes=r.parsed.notes;renderMidiNotes(currentMidiNotes);
      $("midiSummary").textContent=`${r.parsed.notes.length} notas · ${r.parsed.tracks} pistas · ${r.parsed.tempo} BPM aprox. · Duración ${formatSongTime(r.parsed.durationMs)}. Reproducción sintetizada para escuchar las notas; posiciones sugeridas en afinación estándar.`;
      $("midiPlaybackStatus").textContent="MIDI listo. Pulsa Reproducir MIDI para escuchar la secuencia.";
    }else if(r.type==="guitarpro"){
      await loadGuitarPro(r,"gpScore","gpStatus","gpPlayBtn","gpPauseBtn","gpStopBtn");
    }
    $("songWorkspace").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(e){console.error(e);toast("No se pudo abrir la canción: "+(e.message||"error desconocido"));}
}
function formatSongTime(ms){const s=Math.floor(ms/1000);return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")}
function renderMidiNotes(notes){
  const root=$("midiNotes"),limit=notes.slice(0,1000);
  root.innerHTML=limit.map((n,i)=>`<div class="midi-note" data-midi-index="${i}"><strong>${escapeHtml(n.name)}</strong><span>${escapeHtml(n.position.string)} · Traste ${n.position.fret}</span><small>${n.position.finger} · ${formatSongTime(n.startMs)}</small></div>`).join("");
  if(notes.length>1000)root.insertAdjacentHTML("beforeend",`<p class="muted">Se muestran las primeras 1.000 de ${notes.length} notas.</p>`);
}
async function loadGuitarPro(record,targetId="gpScore",statusId="gpStatus",playId="gpPlayBtn",pauseId="gpPauseBtn",stopId="gpStopBtn"){
  const status=$(statusId),playBtn=$(playId),pauseBtn=$(pauseId),stopBtn=$(stopId),container=$(targetId);
  status.textContent="Cargando el motor Guitar Pro y el instrumento de audio…";playBtn.disabled=true;pauseBtn.disabled=true;stopBtn.disabled=true;container.innerHTML="";
  if(!window.alphaTab?.AlphaTabApi){status.textContent="No se pudo cargar alphaTab. Revisa tu conexión a internet y recarga la aplicación.";throw new Error("El lector Guitar Pro no está disponible; comprueba la conexión a internet.")}
  if(alphaTabApi){try{alphaTabApi.destroy()}catch(e){}alphaTabApi=null}
  const base="https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.9.0/dist/";
  const api=new window.alphaTab.AlphaTabApi(container,{
    core:{fontDirectory:base+"font/"},
    player:{enablePlayer:true,soundFont:base+"soundfont/sonivox.sf2"}
  });
  alphaTabApi=api;
  let settled=false,timeoutId;
  const ready=new Promise((resolve,reject)=>{
    timeoutId=setTimeout(()=>{if(!settled){settled=true;reject(new Error("El motor de audio tardó demasiado. Revisa tu conexión y vuelve a abrir el archivo."))}},45000);
    api.scoreLoaded.on(score=>{if(status)status.textContent=`Partitura cargada: ${score.title||record.name}. Preparando sonido…`;if($("songMeta")&&targetId==="gpScore")$("songMeta").textContent=`${score.title||record.name}${score.artist?" · "+score.artist:""} · ${score.tracks.length} pistas`;});
    api.playerReady.on(()=>{if(!settled){settled=true;clearTimeout(timeoutId);resolve(api)}status.textContent="Reproductor listo. Ya puedes iniciar la canción.";playBtn.disabled=false;pauseBtn.disabled=false;stopBtn.disabled=false;});
    api.error.on(e=>{console.error("alphaTab:",e);status.textContent="Error en el lector o motor de audio: "+(e.message||"error desconocido");if(!settled){settled=true;clearTimeout(timeoutId);reject(new Error(e.message||"Error al cargar la tablatura."))}});
  });
  const loaded=api.load(new Uint8Array(await record.blob.arrayBuffer()));
  if(loaded===false)throw new Error("alphaTab no pudo iniciar la lectura de este archivo.");
  await ready;
  playBtn.onclick=()=>{if(!api.isReadyForPlayback){status.textContent="El motor todavía no está listo.";return}const ok=api.play();if(targetId==="duoGpScore")duoGpActive=ok;status.textContent=ok?"Reproduciendo tablatura…":"No se pudo iniciar. Pulsa reproducir nuevamente."};
  pauseBtn.onclick=()=>{api.pause();if(targetId==="duoGpScore")duoGpActive=false;status.textContent="Reproducción pausada."};
  stopBtn.onclick=()=>{api.stop();if(targetId==="duoGpScore")duoGpActive=false;status.textContent="Reproducción detenida."};
  return api;
}
function setMidiPlaybackStatus(message){const el=$("midiPlaybackStatus");if(el)el.textContent=message}
function stopMidiPlayback(message="Reproducción detenida."){
  midiPlaybackTimers.forEach(clearTimeout);midiPlaybackTimers=[];midiPlaybackNodes.forEach(n=>{try{n.stop()}catch(e){}});midiPlaybackNodes=[];
  if(midiAudioContext){midiAudioContext.close().catch(()=>{});midiAudioContext=null}
  document.querySelectorAll(".midi-note.active").forEach(el=>el.classList.remove("active"));setMidiPlaybackStatus(message);
}
function schedulePluck(ctx,pitch,velocity,start,duration,container){
  const osc=ctx.createOscillator(),sub=ctx.createOscillator(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
  const freq=midiToFreq(pitch),level=Math.max(.018,Math.min(.13,(velocity||82)/127*.12));
  osc.type="sawtooth";osc.frequency.setValueAtTime(freq,start);sub.type="triangle";sub.frequency.setValueAtTime(freq*2.003,start);
  filter.type="lowpass";filter.frequency.setValueAtTime(Math.min(6500,Math.max(900,freq*7)),start);filter.Q.value=.7;
  gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(level,start+.008);gain.gain.exponentialRampToValueAtTime(level*.22,start+Math.min(.16,Math.max(.04,duration*.35)));gain.gain.exponentialRampToValueAtTime(.0001,start+Math.max(.06,duration));
  osc.connect(filter);sub.connect(filter);filter.connect(gain);gain.connect(ctx.destination);osc.start(start);sub.start(start);osc.stop(start+duration+.02);sub.stop(start+duration+.02);container.push(osc,sub);
}
async function playMidi(){
  stopMidiPlayback("Preparando reproducción MIDI…");if(!currentMidiNotes.length){setMidiPlaybackStatus("No hay notas MIDI para reproducir.");return}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC){setMidiPlaybackStatus("Este navegador no permite reproducción de audio Web.");return}
  try{
    const speed=Number($("midiSpeed").value)||1;midiAudioContext=new AC({latencyHint:"interactive"});await midiAudioContext.resume();
    const base=midiAudioContext.currentTime+.16;
    currentMidiNotes.forEach((n,i)=>{
      const start=base+n.startMs/1000/speed,duration=Math.min(4,Math.max(.07,n.durationMs/1000/speed));
      schedulePluck(midiAudioContext,n.pitch,n.velocity,start,duration,midiPlaybackNodes);
      const delay=Math.max(0,n.startMs/speed);midiPlaybackTimers.push(setTimeout(()=>{document.querySelectorAll(".midi-note.active").forEach(el=>el.classList.remove("active"));const card=document.querySelector(`[data-midi-index="${i}"]`);if(card){card.classList.add("active");if(i%8===0)card.scrollIntoView({block:"nearest",behavior:"smooth"})}},delay));
    });
    const total=Math.max(...currentMidiNotes.map(n=>n.startMs+n.durationMs))/speed+350;setMidiPlaybackStatus("Reproduciendo MIDI · sintetizador de referencia.");midiPlaybackTimers.push(setTimeout(()=>stopMidiPlayback("Reproducción finalizada."),total));
  }catch(e){console.error(e);stopMidiPlayback("No se pudo iniciar el audio MIDI: "+(e.message||"error"));toast("No se pudo iniciar la reproducción MIDI.")}
}

function setAudioSongStatus(message){const el=$("songAudioStatus");if(el)el.textContent=message}
async function playAudioSong(){
  const audio=$("songAudio");if(!audio.src){setAudioSongStatus("Primero abre un archivo MP3 o WAV de tu biblioteca.");return}
  try{await audio.play();setAudioSongStatus("Reproduciendo audio.")}
  catch(e){console.error(e);setAudioSongStatus("El navegador no pudo reproducir el archivo: "+(e.message||"formato no compatible"));toast("No se pudo reproducir el audio. Verifica que sea MP3 o WAV compatible.")}
}
function stopAudioSong(){const audio=$("songAudio");if(audio){audio.pause();try{audio.currentTime=0}catch(e){}}}
$("songAudioPlayBtn").addEventListener("click",playAudioSong);
$("songAudioPracticeBtn").addEventListener("click",()=>{songPracticeMode=false;songPracticeNotes=[];songPracticeIndex=0;setExercise();playAudioSong();showView("practice");setFeedback("Practica con la pista de acompañamiento. Usa auriculares para evitar que el audio vuelva al micrófono.",false)});
$("songAudioStopBtn").addEventListener("click",()=>{stopAudioSong();setAudioSongStatus("Audio detenido.")});
$("songAudio").addEventListener("loadedmetadata",()=>{const a=$("songAudio");setAudioSongStatus(`Audio preparado · ${formatSongTime(a.duration*1000)} · pulsa reproducir.`)});
$("songAudio").addEventListener("playing",()=>setAudioSongStatus("Reproduciendo audio."));
$("songAudio").addEventListener("pause",()=>{if($("songAudio").currentTime>0)setAudioSongStatus("Audio pausado.")});
$("songAudio").addEventListener("ended",()=>setAudioSongStatus("La canción terminó."));
$("songAudio").addEventListener("error",()=>{const code=$("songAudio").error?.code;const descriptions={1:"carga cancelada",2:"error de lectura",3:"formato o códec no compatible",4:"formato no compatible"};setAudioSongStatus("No se pudo decodificar el audio: "+(descriptions[code]||"archivo inválido"))});

// Modo Dúo local: dos entradas separadas o dos canales de una interfaz estéreo.
const duoPlayers=[null,null];let duoRecords=[];let duoSharedAudio=null;let duoSharedUrl=null;let duoMidiCtx=null,duoMidiTimers=[],duoMidiNodes=[],duoGpActive=false;
function duoInstrumentStrings(value){return value.includes("Bajo")?"E A D G":"E A D G B E"}
function updateDuoInstrumentLabels(){[1,2].forEach(n=>{const instrument=$("duoInstrument"+n).value;$("duoStageInstrument"+n).textContent=instrument;$("duoFret"+n).textContent=duoInstrumentStrings(instrument)})}
async function initDuoView(){
  updateDuoInstrumentLabels();const select=$("duoSong"),previous=select.value;
  try{duoRecords=await songDbAction("readonly")}catch(e){duoRecords=[]}
  const opts=[...BUILTIN_SONGS,...duoRecords].map(r=>`<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}${r.id.startsWith("builtin:")?" · ejercicio": " · "+r.ext.toUpperCase()}</option>`).join("");
  select.innerHTML='<option value="">Selecciona una canción de la biblioteca</option>'+opts;
  if(previous&&[...select.options].some(o=>o.value===previous))select.value=previous;
  await populateDuoInputs();
}
async function populateDuoInputs(){
  try{
    const devices=await navigator.mediaDevices.enumerateDevices(),inputs=devices.filter(d=>d.kind==="audioinput");
    [1,2].forEach(n=>{const el=$("duoInput"+n),old=el.value;el.innerHTML='<option value="">Entrada predeterminada</option>'+inputs.map((d,i)=>`<option value="${escapeHtml(d.deviceId)}">${escapeHtml(d.label||`Entrada de audio ${i+1}`)}</option>`).join("");if(old)el.value=old});
  }catch(e){console.warn("No se pudieron enumerar las entradas de audio",e)}
}
async function connectDuoPlayer(index){
  const n=index+1;if(duoPlayers[index]){toast(`El jugador ${n} ya está conectado.`);return}
  if(!navigator.mediaDevices?.getUserMedia){toast("Se necesita Chrome o Edge actualizado y HTTPS para capturar audio.");return}
  let media=null;
  try{
    const deviceId=$("duoInput"+n).value,other=duoPlayers[1-index];let channelIndex=Number($("duoChannel"+n).value||0);
    const sameDevice=!!other&&(other.deviceId||"")===(deviceId||"");
    if(sameDevice&&channelIndex===other.channelIndex){channelIndex=other.channelIndex===0?1:0;$("duoChannel"+n).value=String(channelIndex);toast(`Se asignó el canal ${channelIndex+1} al jugador ${n} para separar ambas señales.`)}
    if(other&&(other.deviceId||"")===(deviceId||"")&&other.channelIndex===channelIndex)throw new Error("Los dos jugadores no pueden usar el mismo canal de audio. Selecciona canales 1 y 2, o entradas distintas.");
    const audio={...(deviceId?{deviceId:{exact:deviceId}}:{}),channelCount:{ideal:2},echoCancellation:false,noiseSuppression:false,autoGainControl:false};
    media=await navigator.mediaDevices.getUserMedia({audio,video:false});
    const track=media.getAudioTracks()[0],settings=track?.getSettings?.()||{},channelCount=settings.channelCount||1,actualDeviceId=settings.deviceId||deviceId;
    if(other&&(other.actualDeviceId||other.deviceId||"")===(actualDeviceId||"")&&other.channelIndex===channelIndex){
      if(channelCount>1){channelIndex=other.channelIndex===0?1:0;$("duoChannel"+n).value=String(channelIndex);toast(`La entrada corresponde al mismo dispositivo: asigné automáticamente el canal ${channelIndex+1} al jugador ${n}.`)}
      else throw new Error("Los dos jugadores están usando el mismo dispositivo mono. Conecta una segunda entrada o usa una interfaz estéreo con canales separados.");
    }
    if(channelIndex>0&&channelCount<2)throw new Error("Esta entrada solo ofrece un canal mono. Para usar canal 2 necesitas una interfaz estéreo o una segunda entrada de audio independiente.");
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error("El navegador no dispone de AudioContext.");
    const ctx=new AC({latencyHint:"interactive"});await ctx.resume();const src=ctx.createMediaStreamSource(media),an=ctx.createAnalyser();an.fftSize=8192;an.smoothingTimeConstant=0;
    if(channelCount>1){const splitter=ctx.createChannelSplitter(channelCount);src.connect(splitter);splitter.connect(an,channelIndex);}
    else src.connect(an);
    const player={stream:media,ctx,src,an,raf:0,buffer:new Float32Array(an.fftSize),deviceId,actualDeviceId,channelIndex,channelCount,lastMidi:null,lastNoteAt:0,notes:0};duoPlayers[index]=player;
    let lastAnalysis=0;const tick=now=>{
      if(!duoPlayers[index])return;
      if(now-lastAnalysis>=65){lastAnalysis=now;an.getFloatTimeDomainData(player.buffer);const pitch=detectPitch(player.buffer,ctx.sampleRate);
        if(pitch){const cents=Math.abs(noteCents(pitch.frequency,pitch.midi));$("duoNote"+n).textContent=midiName(pitch.midi);$("duoPitch"+n).textContent=pitch.frequency.toFixed(1)+" Hz · "+(cents<=5?"Afinada":cents.toFixed(0)+" cents de desviación");if(pitch.midi!==player.lastMidi&&now-player.lastNoteAt>180){player.notes++;player.lastMidi=pitch.midi;player.lastNoteAt=now;$("duoAccuracy"+n).textContent=player.notes+" notas"}}
        else if(now-player.lastNoteAt>800){$("duoNote"+n).textContent="—"}}
      player.raf=requestAnimationFrame(tick);
    };player.raf=requestAnimationFrame(tick);
    $("duoConnect"+n).textContent=`Jugador ${n} conectado`;$("duoConnect"+n).disabled=true;$("duoStageStatus"+n).textContent=`Entrada activa · canal ${channelIndex+1}`;
    $("duoSessionStatus").textContent=duoPlayers.filter(Boolean).length+" de 2 jugadores conectados";
    await populateDuoInputs();toast(`Audio del jugador ${n} conectado. Canal ${channelIndex+1}.`);
  }catch(e){if(media)media.getTracks().forEach(t=>t.stop());console.error(e);toast(`Jugador ${n}: ${e.message||"No se pudo conectar el audio."}`)}
}
function stopDuoPlayer(index){
  const n=index+1,p=duoPlayers[index];if(!p)return;cancelAnimationFrame(p.raf);p.stream.getTracks().forEach(t=>t.stop());p.ctx.close().catch(()=>{});duoPlayers[index]=null;
  $("duoNote"+n).textContent="—";$("duoPitch"+n).textContent="Esperando conexión";$("duoAccuracy"+n).textContent="—";$("duoConnect"+n).disabled=false;$("duoConnect"+n).textContent=`Conectar jugador ${n}`;$("duoStageStatus"+n).textContent="Sin conexión";$("duoSessionStatus").textContent=duoPlayers.filter(Boolean).length+" de 2 jugadores conectados";
}
function stopDuoMidi(){duoMidiTimers.forEach(clearTimeout);duoMidiTimers=[];duoMidiNodes.forEach(n=>{try{n.stop()}catch(e){}});duoMidiNodes=[];if(duoMidiCtx){duoMidiCtx.close().catch(()=>{});duoMidiCtx=null}}
function stopDuo(){
  stopDuoPlayer(0);stopDuoPlayer(1);if(duoSharedAudio){duoSharedAudio.pause();duoSharedAudio.src="";duoSharedAudio=null}if(duoSharedUrl){URL.revokeObjectURL(duoSharedUrl);duoSharedUrl=null}
  stopDuoMidi();if(duoGpActive&&alphaTabApi){try{alphaTabApi.stop()}catch(e){}duoGpActive=false;}
  $("duoGpPlayer").hidden=true;$("duoSessionStatus").textContent="Sesión detenida";toast("Sesión de dúo detenida.");
}
async function startDuo(){
  if($("duoConnection").value==="remote"){toast("La conexión entre dos dispositivos necesita configurar un servidor de emparejamiento. No está habilitada todavía.");return}
  const id=$("duoSong").value;if(!id){toast("Selecciona una canción para los dos jugadores.");return}
  if(!duoPlayers[0]||!duoPlayers[1]){toast("Conecta el audio de los dos jugadores antes de iniciar la canción.");return}
  if(duoPlayers[0].stream===duoPlayers[1].stream||(duoPlayers[0].actualDeviceId||duoPlayers[0].deviceId||"")===(duoPlayers[1].actualDeviceId||duoPlayers[1].deviceId||"")&&duoPlayers[0].channelIndex===duoPlayers[1].channelIndex){toast("Las entradas de los jugadores no están separadas. Usa dos entradas o los canales 1 y 2 de una interfaz estéreo.");return}
  const song=id.startsWith("builtin:")?BUILTIN_SONGS.find(x=>x.id===id):duoRecords.find(x=>x.id===id);if(!song){toast("No se encontró la canción seleccionada. Vuelve a abrir el modo Dúo para actualizar la biblioteca.");return}
  try{
    $("duoStageSong").textContent=song.name;$("duoStageStatus1").textContent="Entrada activa";$("duoStageStatus2").textContent="Entrada activa";$("duoGpPlayer").hidden=true;
    if(duoSharedAudio){duoSharedAudio.pause();duoSharedAudio=null}if(duoSharedUrl){URL.revokeObjectURL(duoSharedUrl);duoSharedUrl=null}stopDuoMidi();
    if(song.type==="audio"){
      if(!song.blob)throw new Error("El archivo de audio no está guardado. Vuelve a importarlo.");
      duoSharedUrl=URL.createObjectURL(song.blob);duoSharedAudio=new Audio();duoSharedAudio.src=duoSharedUrl;duoSharedAudio.preload="auto";duoSharedAudio.onended=()=>{$("duoSessionStatus").textContent="Canción finalizada · entradas aún activas"};duoSharedAudio.onerror=()=>{$("duoSessionStatus").textContent="No se pudo decodificar el audio elegido"};await duoSharedAudio.play();
    }else if(song.type==="midi"&&song.parsed?.notes?.length){await playDuoMidi(song.parsed.notes)}
    else if(song.type==="guitarpro"){
      $("duoGpPlayer").hidden=false;const api=await loadGuitarPro(song,"duoGpScore","duoGpStatus","duoGpPlayBtn","duoGpPauseBtn","duoGpStopBtn");
      if(!api.isReadyForPlayback)throw new Error("La tablatura cargó, pero el motor de audio aún no está listo.");
      duoGpActive=false;$("duoGpStatus").textContent="Partitura lista. Pulsa «Reproducir partitura» para iniciar el sonido.";
      $("duoSessionStatus").textContent="Partitura lista · esperando que inicies la reproducción";toast("Partitura preparada. Pulsa Reproducir partitura en el panel Dúo.");return;
    }else throw new Error("Este formato todavía no se puede reproducir en modo Dúo.");
    $("duoSessionStatus").textContent="Sesión activa · misma canción para ambos";toast("¡Reproducción compartida iniciada!");
  }catch(e){console.error(e);$("duoSessionStatus").textContent="No se pudo iniciar la canción";toast("No arrancó la canción: "+(e.message||"error desconocido"))}
}
async function playDuoMidi(notes){
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error("El navegador no admite reproducción MIDI.");
  duoMidiCtx=new AC({latencyHint:"interactive"});const ctx=duoMidiCtx;await ctx.resume();const base=ctx.currentTime+.16;
  notes.forEach(n=>{const start=base+n.startMs/1000,duration=Math.min(4,Math.max(.07,n.durationMs/1000));schedulePluck(ctx,n.pitch,n.velocity,start,duration,duoMidiNodes)});
  const end=Math.max(...notes.map(n=>n.startMs+n.durationMs));duoMidiTimers.push(setTimeout(()=>{$("duoSessionStatus").textContent="MIDI finalizado · entradas aún activas";stopDuoMidi()},end+350));
}
$("duoConnect1").addEventListener("click",()=>connectDuoPlayer(0));$("duoConnect2").addEventListener("click",()=>connectDuoPlayer(1));$("duoStopBtn").addEventListener("click",stopDuo);$("duoStartBtn").addEventListener("click",startDuo);
[1,2].forEach(n=>$("duoInstrument"+n).addEventListener("change",updateDuoInstrumentLabels));
$("duoConnection").addEventListener("change",e=>{const remote=e.target.value==="remote";$("duoConnectionNote").textContent=remote?"La modalidad entre dos dispositivos todavía necesita un servidor de emparejamiento. Usa el modo local para esta versión.":"Conecta dos entradas de audio distintas, o selecciona una interfaz estéreo y asigna canal 1 al jugador 1 y canal 2 al jugador 2.";$("duoPlayerGrid").classList.toggle("remote-preview",remote)});

$("songFiles").addEventListener("change",e=>{if(e.target.files?.length)importSongFiles([...e.target.files]);e.target.value=""});
$("songLibrary").addEventListener("click",async e=>{const open=e.target.closest("[data-open-song]"),del=e.target.closest("[data-delete-song]");if(open)await openSong(open.dataset.openSong);if(del){if(confirm("¿Eliminar esta canción de tu biblioteca local?")){await songDbAction("readwrite",{id:del.dataset.deleteSong,delete:true});await renderSongLibrary();closeSongWorkspace();toast("Canción eliminada del dispositivo.")}}});
$("closeSongBtn").addEventListener("click",closeSongWorkspace);$("midiPlayBtn").addEventListener("click",playMidi);$("midiStopBtn").addEventListener("click",()=>stopMidiPlayback("Reproducción detenida."));
$("midiPracticeBtn").addEventListener("click",()=>{if(!currentMidiNotes.length)return;songPracticeMode=true;songPracticeNotes=currentMidiNotes;songPracticeIndex=0;setExercise();showView("practice");setFeedback("Toca la primera nota de la canción",false);toast("Modo práctica de canción activado. Conecta el audio para evaluar tus notas.")});
renderSongLibrary().catch(e=>{console.warn(e);$("songLibrary").innerHTML='<p class="empty-library">El navegador no permitió crear la biblioteca local. Usa una versión actualizada de Chrome o Edge.</p>'});

})();