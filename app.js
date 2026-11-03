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

// ===================== ROCK ENGINE V1.5 · MODO DÚO =====================
const duoPlayers=[null,null];
let duoRecords=[], gameChart=null, gameGpApi=null, gameGpScore=null, gameGpTracks=[];
let gamePlayerNotes=[[],[]], gameClockMode="none", gameStarted=false, gamePaused=false;
let gameRAF=0, gameStartPerf=0, gamePauseAt=0, gameElapsedBeforePause=0, gameDuration=0, gameSpeed=1;
let gameAudio=null, gameAudioUrl=null, gameAudioCtx=null, gameAudioBase=0, gameAudioNodes=[];
let gameScore=[{hits:0,misses:0,points:0},{hits:0,misses:0,points:0}];
const GAME_LOOKAHEAD_MS=3600, GAME_HIT_WINDOW_MS=190;
function duoInstrumentStrings(value){return value.includes("Bajo")?"G D A E":"E A D G B E"}
function updateDuoInstrumentLabels(){[1,2].forEach(n=>{const instrument=$("duoInstrument"+n).value;$("duoStageInstrument"+n).textContent=instrument;});}
function setDuoStatus(message){const el=$("duoSessionStatus");if(el)el.textContent=message}
function fingerFromFret(fret){return fret<=0?0:((Math.max(1,fret)-1)%4)+1}
function fingerName(n){return ["Al aire","Índice","Medio","Anular","Meñique"][n]||"Sugerido"}
function playerTuning(instrument){return instrument.includes("Bajo")?[28,33,38,43]:[40,45,50,55,59,64]}
function positionForMidi(midi,instrument){
  const tuning=playerTuning(instrument),choices=[];
  tuning.forEach((open,i)=>{const fret=midi-open;if(fret>=0&&fret<=22)choices.push({stringNumber:i+1,fret,stringIndex:tuning.length-i})});
  choices.sort((a,b)=>a.fret-b.fret||b.stringNumber-a.stringNumber);
  const p=choices[0]||{stringNumber:0,fret:"—",stringIndex:0};
  return {...p,finger:typeof p.fret==="number"?fingerFromFret(p.fret):0};
}
function normalizeMidiNote(n,instrument){
  const position=positionForMidi(n.pitch,instrument);
  return {timeMs:Number(n.startMs)||0,durationMs:Number(n.durationMs)||150,pitch:n.pitch,name:n.name||midiName(n.pitch),stringNumber:position.stringNumber,fret:position.fret,finger:position.finger,hit:false,miss:false};
}
function midiTrackIndexes(song){const set=new Set((song.parsed?.notes||[]).map(n=>Number.isFinite(n.track)?n.track:0));return [...set].sort((a,b)=>a-b)}
function updateTrackPickers(items){
  [1,2].forEach(n=>{const select=$("duoTrack"+n),old=select.value;select.innerHTML=items.map((it,i)=>`<option value="${it.index}">${escapeHtml(it.name||("Pista "+(i+1)))}</option>`).join("")||'<option value="0">Sin pistas</option>';if([...select.options].some(o=>o.value===old))select.value=old;});
}
async function initDuoView(){
  updateDuoInstrumentLabels();
  try{duoRecords=await songDbAction("readonly")}catch(e){duoRecords=[];setDuoStatus("No se pudo abrir la biblioteca local: "+(e.message||e))}
  const charts=[...BUILTIN_SONGS,...duoRecords.filter(r=>r.type==="midi"||r.type==="guitarpro")];
  const select=$("duoSong"),previous=select.value;
  select.innerHTML='<option value="">Selecciona MIDI o Guitar Pro</option>'+charts.map(r=>`<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}${r.id.startsWith("builtin:")?" · ejercicio":" · "+r.ext.toUpperCase()}</option>`).join("");
  if(previous&&[...select.options].some(o=>o.value===previous))select.value=previous;else select.value=BUILTIN_SONGS[0].id;
  const backs=duoRecords.filter(r=>r.type==="audio"),back=$("gameBacking"),oldBack=back.value;
  back.innerHTML='<option value="">Usar audio sintetizado de la partitura</option>'+backs.map(r=>`<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)} · ${r.ext.toUpperCase()}</option>`).join("");
  if(oldBack&&[...back.options].some(o=>o.value===oldBack))back.value=oldBack;
  await populateDuoInputs();
  if(select.value)await prepareGameChart(select.value);
}
async function populateDuoInputs(){
  try{
    const devices=await navigator.mediaDevices.enumerateDevices(),inputs=devices.filter(d=>d.kind==="audioinput");
    [1,2].forEach(n=>{const el=$("duoInput"+n),old=el.value;el.innerHTML='<option value="">Entrada predeterminada</option>'+inputs.map((d,i)=>`<option value="${escapeHtml(d.deviceId)}">${escapeHtml(d.label||("Entrada de audio "+(i+1)))}</option>`).join("");if(old)el.value=old});
  }catch(e){console.warn("No se pudieron enumerar las entradas",e)}
}
function updateDuoConnectionStatus(index){
  const n=index+1,p=duoPlayers[index];
  $("duoConnect"+n).textContent=p?`Jugador ${n} conectado`:`Conectar jugador ${n}`;
  $("duoConnect"+n).disabled=!!p;
  $("duoDot"+n).classList.toggle("connected",!!p);
  $("duoStageStatus"+n).textContent=p?`Entrada validada · ${p.label} · canal ${p.channelIndex+1}`:"Sin entrada · vista previa disponible";
}
async function connectDuoPlayer(index){
  const n=index+1;if(duoPlayers[index])return;
  if(!navigator.mediaDevices?.getUserMedia){toast("El audio requiere Chrome/Edge y la página publicada mediante HTTPS.");return}
  let media=null,ctx=null;
  try{
    const selectedDevice=$("duoInput"+n).value,channelIndex=Number($("duoChannel"+n).value||0),other=duoPlayers[1-index];
    const constraints={...(selectedDevice?{deviceId:{exact:selectedDevice}}:{}),channelCount:{ideal:2},echoCancellation:false,noiseSuppression:false,autoGainControl:false};
    media=await navigator.mediaDevices.getUserMedia({audio:constraints,video:false});
    const track=media.getAudioTracks()[0],settings=track?.getSettings?.()||{},actualDeviceId=settings.deviceId||selectedDevice||"default",channelCount=settings.channelCount||1;
    if(channelIndex>0&&channelCount<2)throw new Error("La entrada seleccionada solo entrega un canal mono. Elige otra entrada o una interfaz estéreo.");
    if(other){
      const sameDevice=(other.actualDeviceId||other.deviceId||"default")===(actualDeviceId||"default");
      if(sameDevice&&other.channelIndex===channelIndex)throw new Error("Los dos jugadores están usando la misma entrada y canal. Usa otra entrada o asigna canal 1 a uno y canal 2 al otro.");
      if(sameDevice&&channelCount<2)throw new Error("El micrófono compartido es mono. No puede dividirse en dos guitarras independientes.");
    }
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error("Este navegador no ofrece AudioContext.");
    ctx=new AC({latencyHint:"interactive"});await ctx.resume();
    const source=ctx.createMediaStreamSource(media),analyser=ctx.createAnalyser();analyser.fftSize=8192;analyser.smoothingTimeConstant=0;
    if(channelCount>1){const splitter=ctx.createChannelSplitter(channelCount);source.connect(splitter);splitter.connect(analyser,channelIndex)}else source.connect(analyser);
    const player={stream:media,ctx,source,analyser,buffer:new Float32Array(analyser.fftSize),raf:0,deviceId:selectedDevice,actualDeviceId,channelIndex,channelCount,label:track.label||`Entrada ${n}`,lastMidi:null,lastSignalAt:0,notes:0};
    duoPlayers[index]=player;let lastAnalysis=0;
    const tick=now=>{
      if(duoPlayers[index]!==player)return;
      if(now-lastAnalysis>=55){lastAnalysis=now;analyser.getFloatTimeDomainData(player.buffer);const pitch=detectPitch(player.buffer,ctx.sampleRate);
        if(pitch){const attack=player.lastMidi!==pitch.midi||now-player.lastSignalAt>135;$("duoNote"+n).textContent=midiName(pitch.midi);$("duoPitch"+n).textContent=`${pitch.frequency.toFixed(1)} Hz · señal activa`;player.lastSignalAt=now;player.lastMidi=pitch.midi;if(attack&&gameStarted&&!gamePaused)registerGamePitch(index,pitch.midi,getGameTimeMs())}
        else if(now-player.lastSignalAt>120){player.lastMidi=null;$("duoNote"+n).textContent="—";$("duoPitch"+n).textContent="Esperando nota"}
      }
      player.raf=requestAnimationFrame(tick);
    };
    player.raf=requestAnimationFrame(tick);updateDuoConnectionStatus(index);await populateDuoInputs();
    setDuoStatus(`Jugador ${n} conectado. Entrada de audio concedida y canal ${channelIndex+1} asignado.`);
  }catch(e){if(media)media.getTracks().forEach(t=>t.stop());if(ctx)ctx.close().catch(()=>{});console.error(e);$("duoDot"+n).classList.add("error");toast(`Jugador ${n}: ${e.message||"no se pudo abrir la entrada"}`);setDuoStatus(`No se conectó el jugador ${n}: ${e.message||e}`)}
}
function stopDuoPlayer(index){
  const n=index+1,p=duoPlayers[index];if(!p)return;cancelAnimationFrame(p.raf);p.stream.getTracks().forEach(t=>t.stop());p.ctx.close().catch(()=>{});duoPlayers[index]=null;
  $("duoNote"+n).textContent="—";$("duoPitch"+n).textContent="Sin conectar";$("duoAccuracy"+n).textContent="—";updateDuoConnectionStatus(index);
}
function flattenAlphaTrack(track){
  const out=[];
  for(const staff of (track.staves||[]))for(const bar of (staff.bars||[]))for(const voice of (bar.voices||[]))for(const beat of (voice.beats||[])){
    const rawTime=beat.timer==null?NaN:Number(beat.timer);
    let timeMs=Number.isFinite(rawTime)?rawTime:NaN;
    if(!Number.isFinite(timeMs)){const tick=Number(beat.absolutePlaybackStart??beat.playbackStart??0);const tempo=Number(track.score?.tempo)||120;timeMs=tick*(60000/tempo/960)}
    const duration=Number(beat.playbackDuration||beat.displayDuration||240),durationMs=Math.max(70,duration*(500/960));
    for(const note of (beat.notes||[])){
      if(note.isPercussion||note.isPiano)continue;
      const pitch=Number(note.realValue??note.realValueWithoutBend);if(!Number.isFinite(pitch))continue;
      const stringNumber=Number(note.string)||0,fret=Number.isFinite(Number(note.fret))?Number(note.fret):"—";
      const rawFinger=Number(note.leftHandFinger),finger=({2:1,3:2,4:3,5:4})[rawFinger]||((typeof fret==="number")?fingerFromFret(fret):0);
      out.push({timeMs,durationMs,pitch:Math.round(pitch),name:midiName(Math.round(pitch)),stringNumber,fret,finger,hit:false,miss:false});
    }
  }
  return out.sort((a,b)=>a.timeMs-b.timeMs);
}
function setGameTracks(items){updateTrackPickers(items);}
async function loadGameGp(song){
  if(gameChart?.id===song.id&&gameGpScore)return;
  if(!window.alphaTab?.AlphaTabApi)throw new Error("No se pudo cargar el lector Guitar Pro. Revisa la conexión a internet y vuelve a intentar.");
  if(gameGpApi){try{gameGpApi.destroy()}catch(e){}gameGpApi=null}
  const root=$("duoGpPlayer");root.hidden=false;root.classList.add("game-gp-source");
  const base="https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.9.0/dist/";
  const api=new window.alphaTab.AlphaTabApi($("duoGpScore"),{core:{fontDirectory:base+"font/"},player:{enablePlayer:true,soundFont:base+"soundfont/sonivox.sf2"}});
  gameGpApi=api;let settled=false;
  const scorePromise=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{if(!settled){settled=true;reject(new Error("Guitar Pro tardó demasiado en analizarse. Comprueba la conexión."))}},40000);
    api.scoreLoaded.on(score=>{if(settled)return;settled=true;clearTimeout(timeout);resolve(score)});
    api.error.on(error=>{if(!settled){settled=true;clearTimeout(timeout);reject(new Error(error.message||"Error al analizar Guitar Pro"))}});
  });
  const ok=api.load(new Uint8Array(await song.blob.arrayBuffer()));if(ok===false)throw new Error("alphaTab no pudo iniciar la lectura del archivo.");
  gameGpScore=await scorePromise;gameGpTracks=(gameGpScore.tracks||[]).map((track,index)=>({index,name:track.name||`Pista ${index+1}`,notes:flattenAlphaTrack(track)}));
  setGameTracks(gameGpTracks.map(t=>({index:t.index,name:`${t.name} (${t.notes.length} notas)`})));
  if(!gameGpTracks.some(t=>t.notes.length))throw new Error("La tablatura se pudo abrir, pero no contiene notas de guitarra/bajo utilizables en sus pistas.");
  $("duoStageSong").textContent=gameGpScore.title||song.name;
}
async function getSongById(id){return id.startsWith("builtin:")?BUILTIN_SONGS.find(x=>x.id===id):await songDbAction("readonly",{id})}
async function prepareGameChart(id){
  if(!id){gameChart=null;gamePlayerNotes=[[],[]];setDuoStatus("Selecciona una partitura MIDI o Guitar Pro.");return}
  try{
    stopGame(true);const song=await getSongById(id);if(!song)throw new Error("No se encontró el archivo. Vuelve a abrir la biblioteca.");
    gameChart=song;gameGpScore=null;gameGpTracks=[];
    if(song.type!=="guitarpro"&&gameGpApi){try{gameGpApi.destroy()}catch(e){}gameGpApi=null}
    if(song.type==="midi"){
      const indexes=midiTrackIndexes(song);setGameTracks(indexes.map((index,i)=>({index,name:`Pista ${index+1} (${song.parsed.notes.filter(n=>(n.track??0)===index).length} notas)`})));
    }else if(song.type==="guitarpro")await loadGameGp(song);
    else throw new Error("Un MP3/WAV es audio de acompañamiento, no contiene tablatura. Selecciona también un MIDI o Guitar Pro.");
    refreshPlayerCharts();
    $("duoStageSong").textContent=song.name;$("gameStateTag").textContent="PARTITURA LISTA";setDuoStatus(`${song.name} preparada. Pulsa Iniciar canción para comenzar la pista sincronizada. Puedes probarla sin conectar micrófonos.`);
  }catch(e){console.error(e);gameChart=null;setDuoStatus("No se pudo preparar la partitura: "+(e.message||e));toast("No se pudo preparar: "+(e.message||e))}
}
function getSelectedTrackNotes(index){
  const instrument=$("duoInstrument"+(index+1)).value,trackIndex=Number($("duoTrack"+(index+1)).value||0);
  if(!gameChart)return [];
  if(gameChart.type==="midi")return (gameChart.parsed.notes||[]).filter(n=>(Number.isFinite(n.track)?n.track:0)===trackIndex).map(n=>normalizeMidiNote(n,instrument)).sort((a,b)=>a.timeMs-b.timeMs);
  if(gameChart.type==="guitarpro")return (gameGpTracks.find(t=>t.index===trackIndex)?.notes||[]).map(n=>({...n,hit:false,miss:false})).sort((a,b)=>a.timeMs-b.timeMs);
  return [];
}
function refreshPlayerCharts(){gamePlayerNotes=[getSelectedTrackNotes(0),getSelectedTrackNotes(1)];gameDuration=Math.max(0,...gamePlayerNotes.flat().map(n=>n.timeMs+n.durationMs));renderGameNow(0)}
function resetGameScores(){gameScore=[{hits:0,misses:0,points:0},{hits:0,misses:0,points:0}];[1,2].forEach(n=>{$("gameScore"+n).textContent="0";$("gameHitRate"+n).textContent="0 aciertos · 0 fallos";$("duoAccuracy"+n).textContent="—";$("gameResult"+n).textContent="Listo"});$("gameTeamScore").textContent="0"}
function currentSongRecord(id){return duoRecords.find(r=>r.id===id)}
async function startDuo(){
  if($("duoConnection").value==="remote"){toast("El modo entre dos dispositivos aún requiere un servidor de emparejamiento. Usa conexión local en esta versión.");return}
  if(!gameChart){await prepareGameChart($("duoSong").value);if(!gameChart)return}
  if(!gamePlayerNotes[0].length&&!gamePlayerNotes[1].length)refreshPlayerCharts();
  if(!gamePlayerNotes[0].length&&!gamePlayerNotes[1].length){toast("La pista seleccionada no contiene notas. Selecciona otra pista.");return}
  stopGame(false);gamePlayerNotes=[getSelectedTrackNotes(0),getSelectedTrackNotes(1)];gameDuration=Math.max(0,...gamePlayerNotes.flat().map(n=>n.timeMs+n.durationMs));
  if(!gamePlayerNotes[0].length&&!gamePlayerNotes[1].length)throw new Error("No hay notas en las pistas elegidas.");
  gameSpeed=Number($("gameSpeed").value)||1;resetGameScores();gameElapsedBeforePause=0;gameStarted=true;gamePaused=false;
  const backingId=$("gameBacking").value,backing=backingId?currentSongRecord(backingId):null;
  try{
    if(backing){if(!backing.blob)throw new Error("No se encontró el archivo de acompañamiento. Vuelve a importarlo.");await startBackingAudio(backing,gameSpeed);gameClockMode="audio";}
    else if(gameChart.type==="midi"){await startMidiGameSynth(gamePlayerNotes,gameSpeed);gameClockMode="midi";}
    else if(gameChart.type==="guitarpro"){
      if(!gameGpApi)await loadGameGp(gameChart);
      if(!gameGpApi.isReadyForPlayback)await waitForGpPlayerReady(gameGpApi);
      gameGpApi.playbackSpeed=gameSpeed;
      if(!gameGpApi.play())throw new Error("El motor Guitar Pro no pudo iniciar el audio. Verifica que el navegador haya permitido reproducir sonido.");
      gameClockMode="gp";
    }
    gameStartPerf=performance.now();gameStarted=true;gamePaused=false;
    $("duoStartBtn").disabled=true;$("gamePauseBtn").disabled=false;$("gamePauseBtn").textContent="Ⅱ Pausar";$("gameStateTag").textContent="REPRODUCIENDO";$("gameTempoLabel").textContent=Math.round(gameSpeed*100)+"%";
    [0,1].forEach(i=>{$("gameResult"+(i+1)).textContent=duoPlayers[i]?"Escuchando tu ejecución":"Vista previa · conecta audio para puntuar"});
    setDuoStatus(duoPlayers.every(Boolean)?"Partida iniciada. Se están evaluando ambas entradas por separado.":duoPlayers.some(Boolean)?"Partida iniciada. Un jugador conectado; el otro está en modo vista previa.":"Vista previa iniciada. La canción y las notas avanzan, pero conecta las entradas para evaluar lo que tocas.");
    gameRAF=requestAnimationFrame(gameFrame);
  }catch(e){stopGame(false);$("duoStartBtn").disabled=false;$("gamePauseBtn").disabled=true;console.error(e);setDuoStatus("No se pudo iniciar la reproducción: "+(e.message||e));toast("No arrancó la canción: "+(e.message||e))}
}
function waitForGpPlayerReady(api){return new Promise((resolve,reject)=>{if(api.isReadyForPlayback){resolve();return}let done=false;const timeout=setTimeout(()=>{if(!done){done=true;reject(new Error("El motor de sonido de Guitar Pro no terminó de cargar. Comprueba tu conexión e inténtalo otra vez."))}},35000);api.playerReady.on(()=>{if(!done){done=true;clearTimeout(timeout);resolve()}});api.error.on(e=>{if(!done){done=true;clearTimeout(timeout);reject(new Error(e.message||"Error en el motor de audio Guitar Pro"))}})})}
async function startBackingAudio(record,speed){
  if(gameAudio){gameAudio.pause();gameAudio=null}if(gameAudioUrl)URL.revokeObjectURL(gameAudioUrl);
  gameAudioUrl=URL.createObjectURL(record.blob);gameAudio=new Audio();gameAudio.src=gameAudioUrl;gameAudio.preload="auto";gameAudio.playbackRate=speed;
  await gameAudio.play();gameAudio.onended=()=>finishGame("La canción terminó.");
}
async function startMidiGameSynth(notesByPlayer,speed){
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error("Este navegador no admite reproducción de audio.");
  gameAudioCtx=new AC({latencyHint:"interactive"});await gameAudioCtx.resume();gameAudioBase=gameAudioCtx.currentTime+.18;
  const unique=new Map();notesByPlayer.forEach((list,index)=>{const track=Number($("duoTrack"+(index+1)).value||0);if(!unique.has(track))unique.set(track,list)});
  unique.forEach(list=>list.forEach(n=>{const start=gameAudioBase+n.timeMs/1000/speed,duration=Math.min(3,Math.max(.07,n.durationMs/1000/speed));schedulePluck(gameAudioCtx,n.pitch,92,start,duration,gameAudioNodes)}));
}
function getGameTimeMs(){
  if(!gameStarted)return 0;
  if(gameClockMode==="audio"&&gameAudio)return gameAudio.currentTime*1000;
  if(gameClockMode==="midi"&&gameAudioCtx)return Math.max(0,(gameAudioCtx.currentTime-gameAudioBase)*1000*gameSpeed);
  if(gameClockMode==="gp"&&gameGpApi)return Number(gameGpApi.timePosition)||0;
  return 0;
}
function registerGamePitch(index,pitch,nowMs){
  const notes=gamePlayerNotes[index];if(!notes?.length)return;
  let best=null,bestDelta=Infinity;
  for(const n of notes){if(n.hit||n.miss)continue;const delta=Math.abs(n.timeMs-nowMs);if(delta<bestDelta){bestDelta=delta;best=n}if(n.timeMs>nowMs+GAME_HIT_WINDOW_MS)break}
  if(!best||bestDelta>GAME_HIT_WINDOW_MS)return;
  if(best.pitch===pitch){best.hit=true;gameScore[index].hits++;gameScore[index].points+=100;updateGameScore(index);$("gameResult"+(index+1)).textContent="¡Correcto! +100";$("gameResult"+(index+1)).style.color="#42dda1";}
  else if(nowMs>=best.timeMs-GAME_HIT_WINDOW_MS){/* no penaliza otra nota mientras haya una nota objetivo en ventana */}
}
function updateGameScore(index){const n=index+1,s=gameScore[index],total=s.hits+s.misses,accuracy=total?Math.round(s.hits/total*100):0;$("gameScore"+n).textContent=s.points.toLocaleString("es-CO");$("gameHitRate"+n).textContent=`${s.hits} aciertos · ${s.misses} fallos`;$("duoAccuracy"+n).textContent=total?accuracy+"%":"—";$("gameTeamScore").textContent=(gameScore[0].points+gameScore[1].points).toLocaleString("es-CO")}
function markMisses(nowMs){[0,1].forEach(i=>{if(!duoPlayers[i])return;for(const n of gamePlayerNotes[i]){if(!n.hit&&!n.miss&&nowMs>n.timeMs+GAME_HIT_WINDOW_MS){n.miss=true;gameScore[i].misses++;$("gameResult"+(i+1)).textContent="Nota no acertada";$("gameResult"+(i+1)).style.color="#ff8b78";updateGameScore(i)}}})}
function getStringRow(note,instrument){const max=instrument.includes("Bajo")?4:6;const num=Number(note.stringNumber)||1;return Math.max(0,Math.min(max-1,max-num))}
function drawHighway(index,nowMs){
  const canvas=$("duoHighway"+(index+1));if(!canvas)return;const rect=canvas.getBoundingClientRect();if(rect.width<10)return;
  const dpr=Math.min(2,window.devicePixelRatio||1),w=Math.floor(rect.width*dpr),h=Math.floor(rect.height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
  const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);const W=rect.width,H=rect.height;
  const instrument=$("duoInstrument"+(index+1)).value,bass=instrument.includes("Bajo"),strings=bass?4:6,top=25,bottom=H-22,laneGap=(bottom-top)/(strings-1),hitX=Math.max(64,W*.22),pixelsPerSec=(W-hitX-30)/(GAME_LOOKAHEAD_MS/1000),notes=gamePlayerNotes[index]||[];
  ctx.clearRect(0,0,W,H);const grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,"#0a1a2b");grad.addColorStop(1,"#07101b");ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
  // runway perspective and beat grid
  ctx.fillStyle=index===0?"rgba(42,166,235,.08)":"rgba(255,145,65,.08)";ctx.beginPath();ctx.moveTo(hitX,top-14);ctx.lineTo(W,0);ctx.lineTo(W,H);ctx.lineTo(hitX,bottom+14);ctx.closePath();ctx.fill();
  for(let t=0;t<=GAME_LOOKAHEAD_MS;t+=500){const x=hitX+t/1000*pixelsPerSec;ctx.strokeStyle=t===0?"rgba(255,255,255,.12)":"rgba(180,205,230,.10)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,8);ctx.lineTo(x,H-8);ctx.stroke()}
  for(let s=0;s<strings;s++){const y=top+s*laneGap;ctx.strokeStyle=s===strings-1?"rgba(255,255,255,.55)":"rgba(160,190,215,.35)";ctx.lineWidth=s===strings-1?2:1;ctx.beginPath();ctx.moveTo(hitX,y);ctx.lineTo(W-8,y);ctx.stroke();ctx.fillStyle="rgba(210,225,240,.55)";ctx.font="9px system-ui";ctx.fillText(bass?["G","D","A","E"][s]:["e","B","G","D","A","E"][s],10,y+3)}
  ctx.fillStyle=index===0?"#4bc1ff":"#ff9a4b";ctx.fillRect(hitX-2,8,4,H-16);ctx.fillStyle="rgba(255,255,255,.8)";ctx.font="9px system-ui";ctx.fillText("TOCA",hitX-14,12);
  for(const note of notes){const delta=note.timeMs-nowMs;if(delta< -330||delta>GAME_LOOKAHEAD_MS)continue;const x=hitX+delta/1000*pixelsPerSec;const row=getStringRow(note,instrument),y=top+row*laneGap;const color=index===0?"#25aef7":"#ff963f";const width=Math.max(24,Math.min(42,30+Math.max(0,note.durationMs-100)*.04));
    ctx.globalAlpha=note.hit?.45:note.miss?.28:1;ctx.shadowColor=color;ctx.shadowBlur=note.hit?0:10;ctx.fillStyle=note.hit?"#36d69b":note.miss?"#7c8795":color;roundRect(ctx,x-width/2,y-12,width,24,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle="#07111b";ctx.font="bold 12px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(String(note.fret),x,y);
    if(note.finger){ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(x+width/2-1,y-10,6,0,Math.PI*2);ctx.fill();ctx.fillStyle="#07111b";ctx.font="bold 8px system-ui";ctx.fillText(String(note.finger),x+width/2-1,y-10)}ctx.globalAlpha=1;ctx.textAlign="left";ctx.textBaseline="alphabetic";
  }
}
function roundRect(ctx,x,y,w,h,r){if(ctx.roundRect){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}else{ctx.beginPath();ctx.rect(x,y,w,h)}}
function renderGameNow(nowMs){
  [0,1].forEach(i=>{const next=(gamePlayerNotes[i]||[]).find(n=>!n.hit&&!n.miss&&n.timeMs>=nowMs-100);if(next){$("gameTarget"+(i+1)).textContent=next.name;const inst=$("duoInstrument"+(i+1)).value,strings=inst.includes("Bajo")?["4ª · Mi","3ª · La","2ª · Re","1ª · Sol"]:["6ª · Mi","5ª · La","4ª · Re","3ª · Sol","2ª · Si","1ª · Mi agudo"];const stringLabel=next.stringNumber?strings[next.stringNumber-1]||(`Cuerda ${next.stringNumber}`):"Cuerda sugerida";$("gamePosition"+(i+1)).textContent=`${stringLabel} · Traste ${next.fret} · Dedo ${fingerName(next.finger)}`}else{$("gameTarget"+(i+1)).textContent="—";$("gamePosition"+(i+1)).textContent="Fin de pista"}drawHighway(i,nowMs)})
}
function gameFrame(){if(!gameStarted||gamePaused)return;const now=getGameTimeMs();markMisses(now);renderGameNow(now);$("gameClock").textContent=formatSongTime(now);const pct=gameDuration?Math.min(100,now/gameDuration*100):0;$("gameProgressBar").style.width=pct+"%";
  if(gameClockMode==="audio"&&gameAudio?.ended){finishGame("La canción terminó.");return}
  if(gameClockMode==="gp"&&gameGpApi&&now>=gameDuration&&gameDuration>0){finishGame("La partitura terminó.");return}
  if(gameClockMode==="midi"&&gameAudioCtx&&now>=gameDuration+500){finishGame("La canción terminó.");return}
  gameRAF=requestAnimationFrame(gameFrame)
}
function finishGame(message){if(!gameStarted)return;gameStarted=false;gamePaused=false;cancelAnimationFrame(gameRAF);if(gameClockMode==="gp"&&gameGpApi){try{gameGpApi.stop()}catch(e){}}if(gameClockMode==="audio"&&gameAudio)gameAudio.pause();if(gameClockMode==="midi"&&gameAudioCtx){gameAudioCtx.close().catch(()=>{});gameAudioCtx=null;gameAudioNodes=[];}$("duoStartBtn").disabled=false;$("gamePauseBtn").disabled=true;$("gameStateTag").textContent="CANCIÓN FINALIZADA";setDuoStatus(`${message} Jugador 1: ${gameScore[0].hits} aciertos de ${gameScore[0].hits+gameScore[0].misses}. Jugador 2: ${gameScore[1].hits} aciertos de ${gameScore[1].hits+gameScore[1].misses}.`)}
function pauseGame(){if(!gameStarted)return;if(!gamePaused){gamePaused=true;gamePauseAt=performance.now();if(gameClockMode==="audio")gameAudio?.pause();else if(gameClockMode==="gp")gameGpApi?.pause();else if(gameClockMode==="midi"&&gameAudioCtx)gameAudioCtx.suspend();$("gamePauseBtn").textContent="▶ Continuar";$("gameStateTag").textContent="PAUSADO";cancelAnimationFrame(gameRAF)}else{gamePaused=false;if(gameClockMode==="audio")gameAudio?.play();else if(gameClockMode==="gp")gameGpApi?.play();else if(gameClockMode==="midi"&&gameAudioCtx)gameAudioCtx.resume();$("gamePauseBtn").textContent="Ⅱ Pausar";$("gameStateTag").textContent="REPRODUCIENDO";gameRAF=requestAnimationFrame(gameFrame)}}
function stopGame(stopApi=true){cancelAnimationFrame(gameRAF);gameStarted=false;gamePaused=false;if(gameAudio){gameAudio.pause();gameAudio.currentTime=0;gameAudio=null}if(gameAudioUrl){URL.revokeObjectURL(gameAudioUrl);gameAudioUrl=null}gameAudioNodes.forEach(n=>{try{n.stop()}catch(e){}});gameAudioNodes=[];if(gameAudioCtx){gameAudioCtx.close().catch(()=>{});gameAudioCtx=null}if(stopApi&&gameGpApi){try{gameGpApi.stop()}catch(e){}}gameClockMode="none";$("duoStartBtn").disabled=false;$("gamePauseBtn").disabled=true;$("gamePauseBtn").textContent="Ⅱ Pausar";$("gameClock").textContent="00:00";$("gameProgressBar").style.width="0%";if($("gameStateTag"))$("gameStateTag").textContent=gameChart?"PARTITURA LISTA":"ESPERANDO CANCIÓN"}
function stopDuo(){stopGame();[0,1].forEach(stopDuoPlayer);setDuoStatus("Sesión detenida. Las entradas de audio se han desconectado.");toast("Sesión detenida.")}
function onGameChartChange(){prepareGameChart($("duoSong").value)}
$("duoConnect1").addEventListener("click",()=>connectDuoPlayer(0));$("duoConnect2").addEventListener("click",()=>connectDuoPlayer(1));
$("duoStartBtn").addEventListener("click",startDuo);$("gamePauseBtn").addEventListener("click",pauseGame);$("duoStopBtn").addEventListener("click",stopDuo);
$("duoSong").addEventListener("change",onGameChartChange);$("gameSpeed").addEventListener("change",()=>{$("gameTempoLabel").textContent=Math.round(Number($("gameSpeed").value)*100)+"%"});
[1,2].forEach(n=>{$("duoInstrument"+n).addEventListener("change",()=>{updateDuoInstrumentLabels();if(gameChart?.type==="midi")refreshPlayerCharts()});$("duoTrack"+n).addEventListener("change",refreshPlayerCharts)});
$("duoConnection").addEventListener("change",e=>{if(e.target.value==="remote"){$("duoConnectionNote").textContent="El modo remoto requiere un servidor de emparejamiento y sincronización. No está habilitado en GitHub Pages sin ese servicio."}else{$("duoConnectionNote").textContent="Para dos guitarras reales necesitas dos dispositivos de entrada independientes o una interfaz estéreo con canales separados. Un MP3 solo aporta el acompañamiento; para mostrar cuerda/traste se necesita una tablatura GP o MIDI."}});
if(navigator.mediaDevices?.addEventListener)navigator.mediaDevices.addEventListener("devicechange",populateDuoInputs);
window.addEventListener("resize",()=>{if(gameChart)renderGameNow(getGameTimeMs())});

$("songFiles").addEventListener("change",e=>{if(e.target.files?.length)importSongFiles([...e.target.files]);e.target.value=""});
$("songLibrary").addEventListener("click",async e=>{const open=e.target.closest("[data-open-song]"),del=e.target.closest("[data-delete-song]");if(open)await openSong(open.dataset.openSong);if(del){if(confirm("¿Eliminar esta canción de tu biblioteca local?")){await songDbAction("readwrite",{id:del.dataset.deleteSong,delete:true});await renderSongLibrary();closeSongWorkspace();toast("Canción eliminada del dispositivo.")}}});
$("closeSongBtn").addEventListener("click",closeSongWorkspace);$("midiPlayBtn").addEventListener("click",playMidi);$("midiStopBtn").addEventListener("click",()=>stopMidiPlayback("Reproducción detenida."));
$("midiPracticeBtn").addEventListener("click",()=>{if(!currentMidiNotes.length)return;songPracticeMode=true;songPracticeNotes=currentMidiNotes;songPracticeIndex=0;setExercise();showView("practice");setFeedback("Toca la primera nota de la canción",false);toast("Modo práctica de canción activado. Conecta el audio para evaluar tus notas.")});
renderSongLibrary().catch(e=>{console.warn(e);$("songLibrary").innerHTML='<p class="empty-library">El navegador no permitió crear la biblioteca local. Usa una versión actualizada de Chrome o Edge.</p>'});

})();