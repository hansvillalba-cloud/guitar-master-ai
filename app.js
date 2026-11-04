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
const CHORD_SHAPES={
  C:{name:"Do mayor",root:0,tones:[0,4,7],intervals:["R","3","5"],shape:[0,1,0,2,3,null],fingers:[0,1,0,2,3,null],hint:"C: 5ª cuerda traste 3 (Do), 4ª traste 2 (Mi), 3ª al aire (Sol), 2ª traste 1 (Do), 1ª al aire (Mi). Evita tocar la 6ª cuerda."},
  A:{name:"La mayor",root:9,tones:[9,1,4],intervals:["R","3","5"],shape:[0,2,2,2,0,null],fingers:[0,3,2,1,0,null],hint:"A: coloca índice, medio y anular en los trastes 2 de las cuerdas 4, 3 y 2. Toca desde la 5ª cuerda."},
  G:{name:"Sol mayor",root:7,tones:[7,11,2],intervals:["R","3","5"],shape:[3,0,0,0,2,3],fingers:[4,0,0,0,1,3],hint:"G: usa el índice en 5ª cuerda traste 2, medio en 6ª traste 3 y anular o meñique en 1ª traste 3."},
  E:{name:"Mi mayor",root:4,tones:[4,8,11],intervals:["R","3","5"],shape:[0,0,1,2,2,0],fingers:[0,0,1,3,2,0],hint:"E: índice en 3ª cuerda traste 1; medio y anular en los trastes 2 de las cuerdas 5 y 4. Suenan las seis cuerdas."},
  D:{name:"Re mayor",root:2,tones:[2,6,9],intervals:["R","3","5"],shape:[2,3,2,0,null,null],fingers:[1,3,2,0,null,null],hint:"D: índice en 1ª cuerda traste 2, anular en 2ª traste 3 y medio en 3ª traste 2. Toca desde la 4ª cuerda."},
  Am:{name:"La menor",root:9,tones:[9,0,4],intervals:["R","b3","5"],shape:[0,1,2,2,0,null],fingers:[0,1,3,2,0,null],hint:"Am: es la forma de A mayor bajando un semitono la tercera. Toca desde la 5ª cuerda."},
  Em:{name:"Mi menor",root:4,tones:[4,7,11],intervals:["R","b3","5"],shape:[0,0,0,2,2,0],fingers:[0,0,0,2,3,0],hint:"Em: dos dedos en el traste 2 de las cuerdas 5 y 4. Las seis cuerdas pueden sonar."},
  Dm:{name:"Re menor",root:2,tones:[2,5,9],intervals:["R","b3","5"],shape:[1,3,2,0,null,null],fingers:[1,3,2,0,null,null],hint:"Dm: índice en 1ª traste 1, anular en 2ª traste 3 y medio en 3ª traste 2. Toca desde la 4ª cuerda."},
  F:{name:"Fa mayor con cejilla",root:5,tones:[5,9,0],intervals:["R","3","5"],shape:[1,1,2,3,3,1],fingers:[1,1,2,4,3,1],hint:"F: índice hace cejilla en el traste 1. Medio en 3ª traste 2; anular y meñique en 5ª y 4ª trastes 3."},
  Bm:{name:"Si menor con cejilla",root:11,tones:[11,2,6],intervals:["R","b3","5"],shape:[2,3,4,4,2,null],fingers:[1,2,4,3,1,null],hint:"Bm: cejilla con índice en el traste 2 desde la 5ª cuerda; anular y meñique completan los trastes 4."},
  A7:{name:"La séptima",root:9,tones:[9,1,4,7],intervals:["R","3","5","b7"],shape:[0,2,0,2,0,null],fingers:[0,2,0,3,0,null],hint:"A7: compara su sonido con A mayor. La séptima menor (Sol) le da tensión de dominante."},
  D7:{name:"Re séptima",root:2,tones:[2,6,9,0],intervals:["R","3","5","b7"],shape:[2,1,2,0,null,null],fingers:[3,1,2,0,null,null],hint:"D7: forma abierta muy útil en blues y rock clásico. Toca desde la 4ª cuerda."},
  E7:{name:"Mi séptima",root:4,tones:[4,8,11,2],intervals:["R","3","5","b7"],shape:[0,0,1,0,2,0],fingers:[0,0,1,0,2,0],hint:"E7: cambia E mayor levantando el dedo de la 4ª cuerda; suena la séptima menor Re."},
  G7:{name:"Sol séptima",root:7,tones:[7,11,2,5],intervals:["R","3","5","b7"],shape:[1,0,0,0,2,3],fingers:[1,0,0,0,2,3],hint:"G7: añade Fa (b7) en la primera cuerda, traste 1. Resuelve con facilidad hacia Do."},
  C7:{name:"Do séptima",root:0,tones:[0,4,7,10],intervals:["R","3","5","b7"],shape:[0,1,3,2,3,null],fingers:[0,1,4,2,3,null],hint:"C7: agrega Si bemol (b7) al acorde de Do. Es frecuente en blues y rock and roll."},
  Cmaj7:{name:"Do mayor séptima",root:0,tones:[0,4,7,11],intervals:["R","3","5","7"],shape:[0,0,0,2,3,null],fingers:[0,0,0,1,3,null],hint:"Cmaj7: forma abierta x32000. Tiene un color más suave y estable que C7."},
  Am7:{name:"La menor séptima",root:9,tones:[9,0,4,7],intervals:["R","b3","5","b7"],shape:[0,1,0,2,0,null],fingers:[0,1,0,2,0,null],hint:"Am7: forma abierta x02010. Muy común en progresiones de pop, blues y rock."},
  Em7:{name:"Mi menor séptima",root:4,tones:[4,7,11,2],intervals:["R","b3","5","b7"],shape:[0,0,0,0,2,0],fingers:[0,0,0,0,2,0],hint:"Em7: forma abierta 020000. Compara su color con Em."},
  Dm7:{name:"Re menor séptima",root:2,tones:[2,5,9,0],intervals:["R","b3","5","b7"],shape:[1,1,2,0,null,null],fingers:[1,1,2,0,null,null],hint:"Dm7: forma abierta xx0211. Mantén el índice plano sobre las dos primeras cuerdas."},
  Dsus2:{name:"Re suspendido 2",root:2,tones:[2,4,9],intervals:["R","2","5"],shape:[0,3,2,0,null,null],fingers:[0,3,2,0,null,null],hint:"Dsus2: forma xx0230. La segunda sustituye a la tercera y deja el acorde abierto."},
  Dsus4:{name:"Re suspendido 4",root:2,tones:[2,7,9],intervals:["R","4","5"],shape:[3,3,2,0,null,null],fingers:[3,4,2,0,null,null],hint:"Dsus4: forma xx0233. Resuelve fácilmente hacia D mayor."},
  Asus2:{name:"La suspendido 2",root:9,tones:[9,11,4],intervals:["R","2","5"],shape:[0,0,2,2,0,null],fingers:[0,0,2,3,0,null],hint:"Asus2: forma x02200. Suena abierta y funciona muy bien en rock acústico."},
  Esus4:{name:"Mi suspendido 4",root:4,tones:[4,9,11],intervals:["R","4","5"],shape:[0,0,2,2,2,0],fingers:[0,0,1,2,3,0],hint:"Esus4: forma 022200. Alterna con E mayor para escuchar la resolución."},
  FsharpMinor:{name:"Fa sostenido menor con cejilla",root:6,tones:[6,9,1],intervals:["R","b3","5"],shape:[2,2,2,4,4,2],fingers:[1,1,1,3,4,1],hint:"F#m: cejilla en el traste 2 y forma de Em desplazada. Usa solo la fuerza necesaria."},
  CsharpMinor:{name:"Do sostenido menor con cejilla",root:1,tones:[1,4,8],intervals:["R","b3","5"],shape:[4,5,6,6,4,null],fingers:[1,2,4,3,1,null],hint:"C#m: forma móvil de Am en el traste 4, con cejilla desde la quinta cuerda."},
  Gm:{name:"Sol menor con cejilla",root:7,tones:[7,10,2],intervals:["R","b3","5"],shape:[3,3,3,5,5,3],fingers:[1,1,1,3,4,1],hint:"Gm: forma móvil de Em en el traste 3, con cejilla completa."},
  E5:{name:"Mi quinta (power chord)",root:4,tones:[4,11],intervals:["R","5"],shape:[null,null,null,null,2,0],fingers:[null,null,null,null,1,0],hint:"E5: quinta sin tercera. Es la forma base de muchos riffs de hard rock y metal; no define mayor o menor."}
};
const SCALE_INTERVALS={minorPent:[0,3,5,7,10],majorPent:[0,2,4,7,9],major:[0,2,4,5,7,9,11],blues:[0,3,5,6,7,10]};
const CHROMA_NAMES=["Do","Do♯","Re","Re♯","Mi","Fa","Fa♯","Sol","Sol♯","La","La♯","Si"];
function playFretTone(midi,delay=0,duration=.42){
  try{
    audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
    audioCtx.resume();const t=audioCtx.currentTime+delay,o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.type="triangle";o.frequency.setValueAtTime(midiToFreq(midi),t);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.16,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(g).connect(audioCtx.destination);o.start(t);o.stop(t+duration+.02);
  }catch(err){console.warn("No se pudo reproducir la nota del diapasón",err);$("fretAudioStatus").textContent="El navegador no permitió reproducir audio.";}
}
function playFretSelection(){
  const mode=$("fretMode").value;let pitches=[];
  if(mode==="chords"){
    const ch=CHORD_SHAPES[$("fretChord").value]||CHORD_SHAPES.C;
    pitches=ch.shape.map((f,i)=>f===null?null:STRINGS[i].midi+f).filter(Number.isFinite).reverse();
    pitches.forEach((m,i)=>playFretTone(m,i*.075,.55));
    $("fretAudioStatus").textContent="Escuchando el arpegio de "+ch.name+".";
  }else if(mode==="scales"){
    const r=+$ ("fretRoot").value,steps=SCALE_INTERVALS[$("fretScale").value]||SCALE_INTERVALS.minorPent;
    pitches=steps.map(n=>48+((r+n)%12));
    pitches.forEach((m,i)=>playFretTone(m,i*.16,.28));
    $("fretAudioStatus").textContent="Escuchando la escala ascendente.";
  }else{
    $("fretAudioStatus").textContent="Selecciona una nota del mástil para escucharla.";
  }
}
function renderFretboard(){
  const root=40,frets=12,view=$("fretView").value,mode=$("fretMode").value;
  const chord=CHORD_SHAPES[$("fretChord").value]||CHORD_SHAPES.C;
  const scaleKey=$("fretScale").value,scaleRoot=+$ ("fretRoot").value,scaleNotes=SCALE_INTERVALS[scaleKey]||SCALE_INTERVALS.minorPent;
  $("fretChordWrap").hidden=mode!=="chords";$("fretScaleWrap").hidden=mode!=="scales";$("fretRootWrap").hidden=mode!=="scales";
  $("fretLegend").innerHTML=mode==="chords"?'<span><i class="legend-root"></i> Tónica (R)</span><span><i class="legend-tone"></i> Tercera / quinta / séptima</span><span><i class="legend-finger">1</i> Dedo en la forma</span>':mode==="scales"?'<span><i class="legend-root"></i> Tónica</span><span><i class="legend-tone"></i> Nota de la escala</span>':'<span><i class="legend-root"></i> Mi</span><span>Selecciona una nota para consultar su posición y escucharla.</span>';
  let html='<div class="fret-label">CUERDA</div>';for(let f=0;f<=frets;f++)html+=`<div class="fret-label">${f===0?"AL AIRE":f}</div>`;
  STRINGS.forEach((str,idx)=>{
    html+=`<div class="fret-label">${["e","B","G","D","A","E"][idx]}</div>`;
    for(let f=0;f<=frets;f++){
      const midi=str.midi+f,pc=midi%12,note=midiName(midi).replace(/[0-9]/g,""),shapeFret=mode==="chords"?chord.shape[idx]:null;
      const isChordTone=mode==="chords"&&chord.tones.includes(pc),isScaleTone=mode==="scales"&&scaleNotes.some(v=>(v+scaleRoot)%12===pc);
      const isRoot=mode==="chords"?pc===chord.root:(mode==="scales"?pc===scaleRoot:pc===4);
      const inShape=mode==="chords"&&shapeFret!==null&&shapeFret!==undefined&&shapeFret===f;
      const finger=inShape?chord.fingers[idx]:null;
      let label=view==="numbers"?String(mode==="chords"?chord.tones.indexOf(pc)>=0?chord.intervals[chord.tones.indexOf(pc)]:"·":mode==="scales"?scaleNotes.indexOf((pc-scaleRoot+12)%12)+1||"·":(midi-root+120)%12):note;
      let cls="";if(isRoot)cls+=" root";else if(isChordTone||isScaleTone)cls+=" tone";if(inShape)cls+=" shape";
      const text=inShape&&finger>0?String(finger):label;
      html+=`<div class="fret-cell"><button class="${cls.trim()}" data-midi="${midi}" data-string="${idx}" data-fret="${f}" title="${note} · cuerda ${6-idx} · traste ${f}${finger>0?" · dedo "+finger:""}">${text}</button></div>`;
    }
  });
  $("fretboard").innerHTML=html;
  if(mode==="chords")$("fretExplain").innerHTML=`<strong>${chord.name} (${ $("fretChord").value })</strong><br>${chord.hint}<br><span class="muted">Notas del acorde: ${chord.tones.map(v=>CHROMA_NAMES[v]).join(" · ")}. En los puntos de la forma, el número indica el dedo recomendado (1 índice, 2 medio, 3 anular, 4 meñique; 0 cuerda al aire).</span>`;
  else if(mode==="scales")$("fretExplain").innerHTML=`<strong>${$("fretScale").selectedOptions[0].text} de ${CHROMA_NAMES[scaleRoot]}</strong><br>Notas: ${scaleNotes.map(v=>CHROMA_NAMES[(v+scaleRoot)%12]).join(" · ")}. La tónica aparece en naranja y las demás notas de la escala en azul.`;
  else $("fretExplain").textContent="Vista de notas: recorre el mástil de la cuerda 6 (Mi grave) a la 1 (Mi agudo). Pulsa cualquier punto para conocer nombre, cuerda, traste y frecuencia.";
  $("fretboard").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
    const midi=+b.dataset.midi,idx=+b.dataset.string,fret=+b.dataset.fret;
    const pc=midi%12,role=mode==="chords"?chord.intervals[chord.tones.indexOf(pc)]||"nota externa":mode==="scales"?(scaleNotes.includes((pc-scaleRoot+12)%12)?"nota de la escala":"fuera de escala"):"nota natural";
    $("fretExplain").innerHTML=`<strong>${midiName(midi)} · ${STRINGS[idx].label} · traste ${fret}</strong><br>Frecuencia aproximada: ${midiToFreq(midi).toFixed(2)} Hz · ${role}.`;
    playFretTone(midi);$("fretAudioStatus").textContent="Reproduciendo "+midiName(midi)+".";
  }));
}
["fretView","fretMode","fretChord","fretScale","fretRoot"].forEach(id=>$(id).addEventListener("change",renderFretboard));
$("fretPlayBtn").addEventListener("click",playFretSelection);
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
let currentSongId=null,currentSongType=null,activeAudioSectionHandler=null,activeAudioEndedHandler=null,midiPlaybackMeta=null,midiSectionLoopTimer=null;
const SECTION_STORAGE_KEY="gmai_song_sections_v1";
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
  const all=[],tempos=[{tick:0,us:500000}],markers=[];
  for(let track=0;track<trackCount&&pos<v.byteLength;track++){
    if(readStr(4)!=="MTrk")throw new Error("Pista MIDI dañada.");const len=readU32(),end=pos+len;let tick=0,running=0;const active=new Map();
    while(pos<end){tick+=readVar();let status=v.getUint8(pos++);if(status<0x80){pos--;status=running}else running=status;
      if(status===0xff){const type=v.getUint8(pos++),n=readVar();
        if(type===0x51&&n===3){const us=(v.getUint8(pos)<<16)|(v.getUint8(pos+1)<<8)|v.getUint8(pos+2);tempos.push({tick,us})}
        else if(type===0x06||type===0x01){const bytes=new Uint8Array(buffer,pos,n);let text="";try{text=new TextDecoder().decode(bytes).replace(/[\x00-\x1f]+/g," ").trim()}catch(e){text=String.fromCharCode(...bytes).trim()}if(text)markers.push({tick,text})}
        pos+=n;continue}
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
  const durationMs=notes.length?Math.max(...notes.map(n=>n.startMs+n.durationMs)):0;
  const markerList=markers.sort((a,b)=>a.tick-b.tick).map(m=>({...m,startMs:tickMs(m.tick)}));
  return {format,tracks:trackCount,division,tempo,notes,durationMs,markers:markerList};
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
  if(alphaTabApi){try{alphaTabApi.playbackRange=null;alphaTabApi.isLooping=false;alphaTabApi.destroy()}catch(e){}alphaTabApi=null}
  if(currentSongAudioUrl){URL.revokeObjectURL(currentSongAudioUrl);currentSongAudioUrl=null}
  currentSongId=null;currentSongType=null;
  $("songWorkspace").hidden=true;$("songSectionPanel").hidden=true;const audio=$("songAudio");audio.pause();audio.removeAttribute("src");audio.load();
}
async function openSong(id){
  try{
    const r=id.startsWith("builtin:")?BUILTIN_SONGS.find(x=>x.id===id):await songDbAction("readonly",{id});if(!r)throw new Error("No se encontró el archivo en la biblioteca local.");
    closeSongWorkspace();currentSongId=r.id;currentSongType=r.type;$("songWorkspace").hidden=false;$("songTitle").textContent=r.name;$("songMeta").textContent=r.id.startsWith("builtin:")?"Ejercicio original incluido en Guitar Master AI":""+r.ext.toUpperCase()+" · "+prettySize(r.size)+" · guardado en este dispositivo";
    $("audioSongPlayer").hidden=r.type!=="audio";$("midiSongPlayer").hidden=r.type!=="midi";$("gpSongPlayer").hidden=r.type!=="guitarpro";$("songSectionPanel").hidden=false;
    if(r.type==="audio"){
      if(!r.blob)throw new Error("El archivo de audio no está disponible en el almacenamiento local. Vuelve a importarlo.");
      currentSongAudioUrl=URL.createObjectURL(r.blob);const audio=$("songAudio");audio.src=currentSongAudioUrl;audio.load();setAudioSongStatus("Audio cargado. Pulsa Reproducir audio o marca los límites de una sección.");
      initializeSectionEditor(r);
    }else if(r.type==="midi"){
      songPracticeMode=false;songPracticeNotes=[];songPracticeIndex=0;currentMidiNotes=r.parsed.notes;renderMidiNotes(currentMidiNotes);
      $("midiSummary").textContent=`${r.parsed.notes.length} notas · ${r.parsed.tracks} pistas · ${r.parsed.tempo} BPM aprox. · Duración ${formatSongTime(r.parsed.durationMs)}. Reproducción sintetizada para escuchar las notas; posiciones sugeridas en afinación estándar.`;
      $("midiPlaybackStatus").textContent="MIDI listo. Pulsa Reproducir MIDI para escuchar la secuencia.";
      initializeSectionEditor(r,buildMidiMarkerSections(r.parsed));
    }else if(r.type==="guitarpro"){
      await loadGuitarPro(r,"gpScore","gpStatus","gpPlayBtn","gpPauseBtn","gpStopBtn");
      initializeSectionEditor(r,buildGpMarkerSections());
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
  playBtn.onclick=()=>{if(!api.isReadyForPlayback){status.textContent="El motor todavía no está listo.";return}api.playbackRange=null;api.isLooping=false;api.playbackSpeed=1;const ok=api.play();if(targetId==="duoGpScore")duoGpActive=ok;status.textContent=ok?"Reproduciendo tablatura completa…":"No se pudo iniciar. Pulsa reproducir nuevamente."};
  if(targetId==="gpScore"&&api.playerFinished?.on){api.playerFinished.on(()=>{if($("sectionStatus")&&currentSongType==="guitarpro"&&api.playbackRange&&!api.isLooping)$("sectionStatus").textContent="La sección terminó. Puedes volver a practicarla o elegir otra parte."})}
  pauseBtn.onclick=()=>{api.pause();if(targetId==="duoGpScore")duoGpActive=false;status.textContent="Reproducción pausada."};
  stopBtn.onclick=()=>{api.stop();if(targetId==="duoGpScore")duoGpActive=false;status.textContent="Reproducción detenida."};
  return api;
}
function setMidiPlaybackStatus(message){const el=$("midiPlaybackStatus");if(el)el.textContent=message}
function stopMidiPlayback(message="Reproducción detenida."){
  midiPlaybackTimers.forEach(clearTimeout);midiPlaybackTimers=[];if(midiSectionLoopTimer){clearTimeout(midiSectionLoopTimer);midiSectionLoopTimer=null}
  midiPlaybackNodes.forEach(n=>{try{n.stop()}catch(e){}});midiPlaybackNodes=[];midiPlaybackMeta=null;
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
    const base=midiAudioContext.currentTime+.16;midiPlaybackMeta={startMs:0,speed,realStart:performance.now()+160,endMs:Math.max(...currentMidiNotes.map(n=>n.startMs+n.durationMs))};
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
  if(activeAudioSectionHandler){audio.removeEventListener("timeupdate",activeAudioSectionHandler);activeAudioSectionHandler=null}if(activeAudioEndedHandler){audio.removeEventListener("ended",activeAudioEndedHandler);activeAudioEndedHandler=null}audio.playbackRate=1;
  try{await audio.play();setAudioSongStatus("Reproduciendo audio completa.")}
  catch(e){console.error(e);setAudioSongStatus("El navegador no pudo reproducir el archivo: "+(e.message||"formato no compatible"));toast("No se pudo reproducir el audio. Verifica que sea MP3 o WAV compatible.")}
}
function stopAudioSong(){const audio=$("songAudio");if(audio){if(activeAudioSectionHandler){audio.removeEventListener("timeupdate",activeAudioSectionHandler);activeAudioSectionHandler=null}if(activeAudioEndedHandler){audio.removeEventListener("ended",activeAudioEndedHandler);activeAudioEndedHandler=null}audio.pause();audio.playbackRate=1;try{audio.currentTime=0}catch(e){}}}
$("songAudioPlayBtn").addEventListener("click",playAudioSong);
$("songAudioPracticeBtn").addEventListener("click",()=>{songPracticeMode=false;songPracticeNotes=[];songPracticeIndex=0;setExercise();playAudioSong();showView("practice");setFeedback("Practica con la pista de acompañamiento. Usa auriculares para evitar que el audio vuelva al micrófono.",false)});
$("songAudioStopBtn").addEventListener("click",()=>{stopAudioSong();setAudioSongStatus("Audio detenido.")});
$("songAudio").addEventListener("loadedmetadata",()=>{const a=$("songAudio");setAudioSongStatus(`Audio preparado · ${formatSongTime(a.duration*1000)} · pulsa reproducir.`)});
$("songAudio").addEventListener("playing",()=>setAudioSongStatus("Reproduciendo audio."));
$("songAudio").addEventListener("pause",()=>{if($("songAudio").currentTime>0)setAudioSongStatus("Audio pausado.")});
$("songAudio").addEventListener("ended",()=>setAudioSongStatus("La canción terminó."));
$("songAudio").addEventListener("error",()=>{const code=$("songAudio").error?.code;const descriptions={1:"carga cancelada",2:"error de lectura",3:"formato o códec no compatible",4:"formato no compatible"};setAudioSongStatus("No se pudo decodificar el audio: "+(descriptions[code]||"archivo inválido"))});

// Práctica por secciones: rangos de tiempo para audio/MIDI y compases para Guitar Pro.
function readSectionStore(){try{return JSON.parse(localStorage.getItem(SECTION_STORAGE_KEY)||"{}")}catch(e){return {}}}
function writeSectionStore(data){try{localStorage.setItem(SECTION_STORAGE_KEY,JSON.stringify(data))}catch(e){console.warn("No se pudieron guardar los marcadores de sección",e);$("sectionStatus").textContent="El navegador no permitió guardar los marcadores. Puedes seguir practicando mientras esta pestaña esté abierta."}}
function savedSectionsForSong(){const all=readSectionStore();return currentSongId?(all[currentSongId]||[]):[]}
function storeSectionsForSong(list){if(!currentSongId)return;const all=readSectionStore();all[currentSongId]=list;writeSectionStore(all)}
function formatSectionSeconds(value){const total=Math.max(0,Math.floor(Number(value)||0));return Math.floor(total/60)+":"+String(total%60).padStart(2,"0")}
function gpMasterBars(){return alphaTabApi?.score?.masterBars?Array.from(alphaTabApi.score.masterBars):[]}
function gpMasterBarStart(index){const bars=gpMasterBars(),bar=bars[index];if(!bar)return null;try{return alphaTabApi.tickCache?.getMasterBarStart?.(bar)??bar.start??null}catch(e){return bar.start??null}}
function buildMidiMarkerSections(parsed){
  const markers=parsed?.markers||[];if(!markers.length)return [];
  return markers.map((m,i)=>({id:"midi-marker-"+i,name:m.text||("Sección "+(i+1)),unit:"seconds",start:Math.max(0,m.startMs/1000),end:Math.max(0,(markers[i+1]?.startMs??parsed.durationMs)/1000)})).filter(x=>x.end>x.start);
}
function buildGpMarkerSections(){
  const bars=gpMasterBars();if(!bars.length||!alphaTabApi)return [];
  const markers=[];bars.forEach((bar,index)=>{const section=bar.section;if(section){const text=String(section.text||section.marker||"").trim();if(text)markers.push({index,name:text})}});
  if(!markers.length)return [];
  return markers.map((m,i)=>({id:"gp-marker-"+i,name:m.name,unit:"bars",start:m.index+1,end:(markers[i+1]?.index??bars.length)-0})).filter(x=>x.end>=x.start);
}
function initializeSectionEditor(record,autoSections=[]){
  const panel=$("songSectionPanel");if(!panel)return;panel.hidden=false;
  const isGp=record.type==="guitarpro",unit=isGp?"bars":"seconds";
  $("sectionStartLabel").textContent=isGp?"Compás inicial":"Inicio (segundos)";
  $("sectionEndLabel").textContent=isGp?"Compás final":"Final (segundos)";
  $("sectionMarkStart").textContent=isGp?"⌖ Marcar compás actual como inicio":"⌖ Marcar inicio actual";
  $("sectionMarkEnd").textContent=isGp?"⌖ Marcar compás actual como final":"⌖ Marcar final actual";
  $("sectionStart").step=isGp?"1":"0.1";$("sectionEnd").step=isGp?"1":"0.1";
  $("sectionStart").min=isGp?"1":"0";$("sectionEnd").min=isGp?"1":"0.1";
  $("sectionStart").value=isGp?"1":"0";
  const barCount=isGp?gpMasterBars().length:0;
  let duration=record.type==="midi"?(record.parsed?.durationMs||0)/1000:record.type==="audio"&&Number.isFinite($("songAudio").duration)?$("songAudio").duration:30;
  $("sectionEnd").value=isGp?String(Math.max(1,barCount)):String(Math.max(0.1,Math.round(duration*10)/10));
  $("sectionPreset").value="Introducción";$("sectionCustomWrap").hidden=true;$("sectionCustomName").value="";$("sectionRepeat").checked=true;$("sectionSpeed").value="1";
  const stored=savedSectionsForSong();
  let sections=stored.length?stored:autoSections;
  if(!stored.length&&autoSections.length){storeSectionsForSong(autoSections);}
  renderSavedSections(sections);
  if(isGp){$("sectionPracticeHelp").textContent=barCount?`Este archivo tiene ${barCount} compases. Puedes repetir una parte por número de compás o usar los marcadores guardados en Guitar Pro.`:"No se detectaron compases en la tablatura. Comprueba que el archivo Guitar Pro esté cargado."}
  else if(record.type==="midi"){$("sectionPracticeHelp").textContent=record.parsed?.markers?.length?"Se detectaron marcadores dentro del MIDI. También puedes crear tus propios rangos de tiempo.":"Marca el inicio y el final mientras escuchas, o escribe los tiempos en segundos. Las partes quedarán guardadas para esta canción."}
  else $("sectionPracticeHelp").textContent="Reproduce la pista, marca el inicio y el final de cada parte y guárdalos. Luego podrás repetir la introducción, estrofas, coro, puente, solo o final.";
  $("sectionStatus").textContent=sections.length?`Se cargaron ${sections.length} secciones guardadas para esta canción.`:"No hay partes definidas todavía. Elige una sección y marca sus límites.";
}
function renderSavedSections(list=savedSectionsForSong()){
  const root=$("savedSections");if(!root)return;
  $("sectionCount").textContent=list.length+ (list.length===1?" sección":" secciones");
  if(!list.length){root.innerHTML='<p class="empty-library">Todavía no has marcado partes de esta canción.</p>';return}
  root.innerHTML=list.map(section=>{
    const range=section.unit==="bars"?`Compases ${section.start}–${section.end}`:`${formatSectionSeconds(section.start)}–${formatSectionSeconds(section.end)}`;
    return `<article class="saved-section"><div><strong>${escapeHtml(section.name)}</strong><small>${range}</small></div><div class="saved-section-actions"><button data-section-play="${escapeHtml(section.id)}">▶ Practicar</button><button class="section-delete" data-section-delete="${escapeHtml(section.id)}" aria-label="Eliminar ${escapeHtml(section.name)}">×</button></div></article>`
  }).join("");
}
function currentSectionPosition(){
  if(currentSongType==="audio"){const audio=$("songAudio");return Number.isFinite(audio.currentTime)?audio.currentTime:0}
  if(currentSongType==="midi"&&midiPlaybackMeta){const elapsed=Math.max(0,performance.now()-midiPlaybackMeta.realStart);return Math.min(midiPlaybackMeta.endMs,midiPlaybackMeta.startMs+elapsed*midiPlaybackMeta.speed)/1000}
  if(currentSongType==="guitarpro"&&alphaTabApi){const tick=Number(alphaTabApi.tickPosition)||0,bars=gpMasterBars();let index=0;for(let i=0;i<bars.length;i++){const start=gpMasterBarStart(i);if(start!==null&&start<=tick)index=i+1;else if(start!==null&&start>tick)break}return Math.max(1,index)}
  return 0;
}
function markSectionBoundary(which){
  const value=currentSectionPosition();const input=$(which==="start"?"sectionStart":"sectionEnd");
  input.value=currentSongType==="guitarpro"?String(Math.max(1,Math.round(value))):String(Math.round(value*10)/10);
  if(which==="start"&&Number($("sectionEnd").value)<=Number(input.value))$("sectionEnd").value=String(Number(input.value)+(currentSongType==="guitarpro"?1:10));
  if(which==="end"&&Number($("sectionStart").value)>=Number(input.value))$("sectionStart").value=String(Math.max(currentSongType==="guitarpro"?1:0,Number(input.value)-(currentSongType==="guitarpro"?1:10)));
  $("sectionStatus").textContent=(which==="start"?"Inicio":"Final")+" marcado en "+(currentSongType==="guitarpro"?"compás ":" ")+input.value+(currentSongType==="guitarpro"?"":" s.");
}
function saveCurrentSection(){
  const unit=currentSongType==="guitarpro"?"bars":"seconds",start=Number($("sectionStart").value),end=Number($("sectionEnd").value);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start){toast("El final debe ser mayor que el inicio de la sección.");return}
  if(unit==="bars"&&(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end>gpMasterBars().length)){toast("Selecciona un rango de compases válido para esta tablatura.");return}
  if(unit==="seconds"){
    const limit=currentSongType==="audio"?(Number.isFinite($("songAudio").duration)?$("songAudio").duration:Infinity):currentMidiNotes.length?Math.max(...currentMidiNotes.map(n=>n.startMs+n.durationMs))/1000:Infinity;
    if(start<0||end>limit+0.3){toast("El rango supera la duración de esta canción.");return}
  }
  const preset=$("sectionPreset").value,name=preset==="custom"?$("sectionCustomName").value.trim():preset;
  if(!name){toast("Escribe un nombre para la sección.");return}
  const section={id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),name,unit,start,end};
  const list=savedSectionsForSong();list.push(section);storeSectionsForSong(list);renderSavedSections(list);$("sectionStatus").textContent=`Se guardó «${name}». Puedes practicarla ahora y activar o desactivar el bucle.`;toast("Sección guardada en esta canción.");
}
function getGpSectionRange(startBar,endBar){
  const bars=gpMasterBars();if(!bars.length||startBar<1||endBar<startBar||endBar>bars.length)throw new Error("El rango de compases no es válido.");
  const startTick=gpMasterBarStart(startBar-1),endTick=endBar<bars.length?gpMasterBarStart(endBar):Number(alphaTabApi.endTick);
  if(startTick===null||endTick===null||endTick<=startTick)throw new Error("No se pudo calcular el rango de reproducción de Guitar Pro.");
  return {startTick,endTick};
}
function playAudioSection(section,speed,loop){
  const audio=$("songAudio");if(!audio.src||!Number.isFinite(audio.duration)){throw new Error("La pista de audio todavía no está lista.")}
  const start=section.start,end=section.end;if(start<0||end>audio.duration+0.2||end<=start)throw new Error("Los tiempos de esta sección quedan fuera de la duración del audio.");
  if(activeAudioSectionHandler){audio.removeEventListener("timeupdate",activeAudioSectionHandler);activeAudioSectionHandler=null}if(activeAudioEndedHandler){audio.removeEventListener("ended",activeAudioEndedHandler);activeAudioEndedHandler=null}
  audio.pause();audio.currentTime=start;audio.playbackRate=speed;
  let wrapping=false,finished=false;
  const finish=()=>{if(finished)return;finished=true;if(activeAudioSectionHandler){audio.removeEventListener("timeupdate",activeAudioSectionHandler);activeAudioSectionHandler=null}if(activeAudioEndedHandler){audio.removeEventListener("ended",activeAudioEndedHandler);activeAudioEndedHandler=null}audio.playbackRate=1;$("sectionStatus").textContent=`Terminó «${section.name}». Puedes volver a practicarla.`};
  const rewind=()=>{if(wrapping)return;wrapping=true;audio.currentTime=start;wrapping=false;if(audio.paused)audio.play().catch(e=>console.warn("No se pudo reanudar el bucle de audio",e))};
  activeAudioSectionHandler=()=>{if(wrapping||audio.currentTime<end-0.04)return;if(loop)rewind();else{audio.pause();finish()}};
  activeAudioEndedHandler=()=>{if(loop&&end>=audio.duration-0.25)rewind();else finish()};
  audio.addEventListener("timeupdate",activeAudioSectionHandler);audio.addEventListener("ended",activeAudioEndedHandler);
  audio.play().then(()=>{$("sectionStatus").textContent=`Practicando «${section.name}» · ${Math.round(speed*100)}%${loop?" · bucle activado":" · una reproducción"}.`}).catch(e=>{$("sectionStatus").textContent="No se pudo reproducir el fragmento: "+e.message});
}
async function playMidiSection(section,speed,loop){
  const startMs=section.start*1000,endMs=section.end*1000;
  if(endMs<=startMs)throw new Error("El final debe ser mayor que el inicio.");
  const selected=currentMidiNotes.filter(n=>n.startMs>=startMs&&n.startMs<endMs);
  if(!selected.length)throw new Error("No hay notas MIDI dentro de ese rango de tiempo. Ajusta los límites.");
  stopMidiPlayback("Preparando sección MIDI…");const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error("El navegador no permite reproducir MIDI.");
  midiAudioContext=new AC({latencyHint:"interactive"});await midiAudioContext.resume();
  const playPass=()=>{
    midiPlaybackTimers.forEach(clearTimeout);midiPlaybackTimers=[];midiPlaybackNodes=[];
    const base=midiAudioContext.currentTime+.12;midiPlaybackMeta={startMs,speed,realStart:performance.now()+120,endMs};
    selected.forEach(n=>{const offset=(n.startMs-startMs)/1000/speed,duration=Math.min(n.durationMs/1000/speed,Math.max(.07,(endMs-n.startMs)/1000/speed));schedulePluck(midiAudioContext,n.pitch,n.velocity,base+offset,duration,midiPlaybackNodes)});
    const passMs=(endMs-startMs)/speed;
    midiSectionLoopTimer=setTimeout(()=>{if(loop&&midiAudioContext){playPass()}else{stopMidiPlayback("Sección MIDI finalizada.");$("sectionStatus").textContent=`Terminó «${section.name}». Puedes volver a practicarla o elegir otra parte.`}},passMs+180);
  };
  playPass();setMidiPlaybackStatus(`Practicando sección · ${Math.round(speed*100)}%${loop?" · bucle activado":""}.`);$("sectionStatus").textContent=`Practicando «${section.name}» · ${Math.round(speed*100)}%${loop?" · bucle activado":" · una reproducción"}.`;
}
function playGpSection(section,speed,loop){
  if(!alphaTabApi?.isReadyForPlayback)throw new Error("El reproductor Guitar Pro todavía no está listo.");
  const range=getGpSectionRange(section.start,section.end);alphaTabApi.playbackRange=range;alphaTabApi.isLooping=!!loop;alphaTabApi.playbackSpeed=speed;alphaTabApi.tickPosition=range.startTick;
  if(!alphaTabApi.play())throw new Error("No se pudo iniciar la sección en Guitar Pro.");
  $("gpStatus").textContent=`Practicando «${section.name}» · compases ${section.start}–${section.end} · ${Math.round(speed*100)}%${loop?" · bucle":""}.`;
  $("sectionStatus").textContent=`Practicando «${section.name}» · compases ${section.start}–${section.end} · ${Math.round(speed*100)}%${loop?" · bucle activado":" · una reproducción"}.`;
}
async function practiceSavedSection(id){
  const section=savedSectionsForSong().find(x=>x.id===id);if(!section)return;
  const speed=Number($("sectionSpeed").value)||1,loop=$("sectionRepeat").checked;
  try{
    if(section.unit==="bars")playGpSection(section,speed,loop);
    else if(currentSongType==="audio")playAudioSection(section,speed,loop);
    else if(currentSongType==="midi")await playMidiSection(section,speed,loop);
    $("sectionStart").value=section.start;$("sectionEnd").value=section.end;$("sectionPreset").value=["Introducción","Estrofa 1","Coro","Estrofa 2","Puente","Solo","Final"].includes(section.name)?section.name:"custom";$("sectionCustomWrap").hidden=$("sectionPreset").value!=="custom";$("sectionCustomName").value=$("sectionPreset").value==="custom"?section.name:"";
  }catch(e){console.error(e);$("sectionStatus").textContent=e.message||"No se pudo iniciar esta sección.";toast(e.message||"No se pudo iniciar la sección.")}
}
$("sectionPreset").addEventListener("change",()=>{$("sectionCustomWrap").hidden=$("sectionPreset").value!=="custom"});
$("sectionMarkStart").addEventListener("click",()=>markSectionBoundary("start"));
$("sectionMarkEnd").addEventListener("click",()=>markSectionBoundary("end"));
$("sectionSaveBtn").addEventListener("click",saveCurrentSection);
$("savedSections").addEventListener("click",async e=>{
  const play=e.target.closest("[data-section-play]"),del=e.target.closest("[data-section-delete]");
  if(play)await practiceSavedSection(play.dataset.sectionPlay);
  if(del){const list=savedSectionsForSong().filter(x=>x.id!==del.dataset.sectionDelete);storeSectionsForSong(list);renderSavedSections(list);$("sectionStatus").textContent="Se eliminó el marcador de sección."}
});
$("sectionSpeed").addEventListener("change",()=>{if(currentSongType==="guitarpro"&&alphaTabApi)alphaTabApi.playbackSpeed=Number($("sectionSpeed").value)||1;if(currentSongType==="audio")$("songAudio").playbackRate=Number($("sectionSpeed").value)||1});
$("sectionMarkStart").title="Marca dónde comienza esta parte mientras se reproduce la canción.";
$("sectionMarkEnd").title="Marca dónde termina esta parte mientras se reproduce la canción.";
$("songAudio").addEventListener("loadedmetadata",()=>{if(currentSongType==="audio"&&savedSectionsForSong().length===0&&Number($("sectionEnd").value)<=30)$("sectionEnd").value=String(Math.round($("songAudio").duration*10)/10)});

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