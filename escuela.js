(() => {
"use strict";
const $ = id => document.getElementById(id);
const ABIERTA = {1:64,2:59,3:55,4:50,5:45,6:40};            // cuerda 1 = la más aguda
const NOM = ["Do","Do#","Re","Re#","Mi","Fa","Fa#","Sol","Sol#","La","La#","Si"];
const nom = m => NOM[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
const CUERDA_NOM = {1:"Mi",2:"Si",3:"Sol",4:"Re",5:"La",6:"Mi"};
const RS = ["#e5483d","#f2c230","#3b8fe8","#f08a2e","#3fc46b","#b45be0"];
const DEDO = ["al aire","1 (índice)","2 (medio)","3 (anular)","4 (meñique)"];
const R = (t, n) => Array(n).fill(t).join(" ");
const ARANA = [6,5,4,3,2,1].map(s => [1,2,3,4].map(f => `${s}.${f}:.5`).join(" ")).join(" ");
const toast = m => { const e = $("toast"); if (!e) return; e.textContent = m; e.classList.add("show"); setTimeout(() => e.classList.remove("show"), 2800); };

/* ================= CONTENIDO =================
   Tablatura compacta: cuerda.traste:pulsos  (cuerda 6 = grave, 1 = aguda; "+" = acorde; r = silencio) */
const CURSO = [
 {n:"1 · Primeros pasos", d:"Postura, cuerdas al aire y trastes con un dedo por traste.", l:[
  {t:"Las seis cuerdas al aire", b:60, x:"De la más gruesa a la más fina: Mi, La, Re, Sol, Si, Mi. Toca con la púa y deja sonar cada cuerda completa. Espalda recta, muñeca izquierda relajada y el pulgar detrás del mástil.", tab:"6.0:1 5.0:1 4.0:1 3.0:1 2.0:1 1.0:1 1.0:1 2.0:1 3.0:1 4.0:1 5.0:1 6.0:1"},
  {t:"Un dedo por traste", b:60, x:"En la cuerda 1 usa un dedo por traste: índice en el 1, medio en el 2, anular en el 3, meñique en el 4. Presiona cerca del traste (no encima) con la yema del dedo.", tab:"1.0:1 1.1:1 1.2:1 1.3:1 1.4:1 1.3:1 1.2:1 1.1:1 1.0:2"},
  {t:"Ejercicio de araña 1-2-3-4", b:70, x:"El ejercicio clásico para coordinar ambas manos: los trastes 1-2-3-4 en cada cuerda, de la 6 a la 1. Mantén los dedos cerca del mástil y toca siempre alternando púa abajo-arriba.", tab:ARANA}]},
 {n:"2 · Ritmo y púa", d:"Pulso constante, alternar la púa y silencios.", l:[
  {t:"Negras y silencios", b:70, x:"El ritmo importa más que las notas. Cuenta 1-2-3-4 en voz alta; toca en los tiempos y deja que el silencio también dure su tiempo.", tab:R("6.0:1 r:1",6)},
  {t:"Corcheas con púa alternada", b:80, x:"Dos notas por pulso: abajo en el tiempo, arriba en el 'y'. La muñeca se mueve como un péndulo, sin parar, aunque no toques una cuerda.", tab:R("5.0:.5",16)},
  {t:"Palm mute en cuerda grave", b:90, x:"Apoya el canto de la mano derecha sobre las cuerdas junto al puente para apagar el sonido. Es la base del rock y el metal.", tab:R("6.0:.5",8)+" "+R("5.0:.5",8)}]},
 {n:"3 · Primeras melodías", d:"Melodías conocidas de dominio público y la pentatónica.", l:[
  {t:"Oda a la alegría", b:80, x:"Melodía de Beethoven (dominio público) en las cuerdas 1 y 2. Tócala despacio y suave: sirve para dominar cambios de cuerda.", tab:"1.0:1 1.0:1 1.1:1 1.3:1 1.3:1 1.1:1 1.0:1 2.3:1 2.1:1 2.1:1 2.3:1 1.0:1 1.0:1.5 2.3:.5 2.3:2"},
  {t:"Jingle Bells", b:100, x:"Otra melodía tradicional. Practica repetir la misma nota con púa alternada.", tab:"1.0:1 1.0:1 1.0:2 1.0:1 1.0:1 1.0:2 1.0:1 1.3:1 2.1:1.5 2.3:.5 1.0:4"},
  {t:"Pentatónica menor de Mi", b:80, x:"La escala base del rock y el blues: Mi, Sol, La, Si, Re. Sube y baja sin mirar el mástil cuando la tengas memorizada.", tab:"6.0:.5 6.3:.5 5.0:.5 5.2:.5 4.0:.5 4.2:.5 3.0:.5 3.2:.5 2.0:.5 2.3:.5 1.0:.5 1.3:.5 1.0:.5 2.3:.5 2.0:.5 3.2:.5 3.0:.5 4.2:.5 4.0:.5 5.2:.5 5.0:.5 6.3:.5 6.0:2"}]},
 {n:"4 · Power chords y acordes", d:"Los acordes del rock: quintas, blues de 12 compases y arpegios.", l:[
  {t:"Power chords en Mi, La y Re", b:80, x:"Un power chord usa dos cuerdas: la fundamental con el índice y la quinta dos trastes más adelante con el anular. Cambia de forma sin levantar la mano del mástil.", tab:"6.0+5.2:2 5.0+4.2:2 4.0+3.2:2 5.0+4.2:2"},
  {t:"Blues de 12 compases en La", b:90, x:"La estructura de miles de canciones: La (4 compases), Re (2), La (2), Mi, Re, La, Mi. Cuenta los compases mientras tocas.", tab:"5.0+4.2:4 5.0+4.2:4 5.0+4.2:4 5.0+4.2:4 4.0+3.2:4 4.0+3.2:4 5.0+4.2:4 5.0+4.2:4 6.0+5.2:4 4.0+3.2:4 5.0+4.2:4 6.0+5.2:4"},
  {t:"Arpegio en Mi menor", b:70, x:"Toca las cuerdas del acorde una por una, de abajo hacia arriba y de regreso. Deja que las notas suenen juntas.", tab:R("6.0:.5 5.2:.5 4.2:.5 3.0:.5 2.0:.5 1.0:.5 2.0:.5 3.0:.5",3)}]},
 {n:"5 · Riffs y técnica", d:"Riffs, boogie y la caja 1 de la pentatónica.", l:[
  {t:"Riff de blues rock", b:100, x:"Alterna la quinta con la sexta moviendo el meñique dos trastes: el sonido del boogie y del blues rock.", tab:R("5.0+4.2:.5 5.0+4.4:.5",4)+" "+R("4.0+3.2:.5 4.0+3.4:.5",2)+" "+R("5.0+4.2:.5 5.0+4.4:.5",2)},
  {t:"Caja 1 de La menor pentatónica", b:90, x:"La posición más usada en solos, en el traste 5. Memoriza el dibujo: dos notas por cuerda.", tab:"6.5:.5 6.8:.5 5.5:.5 5.7:.5 4.5:.5 4.7:.5 3.5:.5 3.7:.5 2.5:.5 2.8:.5 1.5:.5 1.8:.5 1.5:.5 2.8:.5 2.5:.5 3.7:.5 3.5:.5 4.7:.5 4.5:.5 5.7:.5 5.5:.5 6.8:.5 6.5:2"},
  {t:"Riff cromático", b:100, x:"Cuatro dedos, cuatro trastes seguidos: ideal para ganar independencia y fuerza.", tab:R("6.0:.5 6.1:.5 6.2:.5 6.3:.5 6.2:.5 6.1:.5",3)+" 6.0:2"}]},
 {n:"6 · Solos y velocidad", d:"Galope, frases de solo y velocidad progresiva.", l:[
  {t:"Galope de metal", b:110, x:"Dos semicorcheas y una corchea: el ritmo de caballo del heavy metal. Púa abajo-abajo-arriba.", tab:R("6.0:.25 6.0:.25 6.0:.5",8)+" "+R("6.3:.25 6.3:.25 6.3:.5",4)},
  {t:"Frase de solo en La menor", b:90, x:"Una frase original con la pentatónica: busca darle emoción con vibrato en la última nota larga.", tab:"2.5:.5 2.8:.5 1.5:1 1.8:.5 1.5:.5 2.8:1 2.5:2"},
  {t:"Pentatónica a toda velocidad", b:120, x:"La misma caja 1, pero a 120 BPM. Si fallas, baja la velocidad al 70% y sube de a poco.", tab:R("6.5:.25 6.8:.25 5.5:.25 5.7:.25 4.5:.25 4.7:.25 3.5:.25 3.7:.25",3)+" 6.5:2"}]},
 {n:"7 · Todas las melodías", d:"Melodías populares y ejercicios originales para leer notas en varias cuerdas.", l:[
  {t:"La Cucaracha · melodía tradicional", b:85, x:"Melodía tradicional de dominio público. Practícala en la primera cuerda, cuidando la precisión al cambiar entre trastes 3, 5, 7, 9 y 10.", tab:"1.10:1 1.10:1 1.10:1 1.3:1 1.7:1 1.10:1 1.3:1 1.7:1 1.5:1 1.5:1 1.5:1 1.9:1 1.0:1 1.5:1 1.9:1 1.0:2"},
  {t:"Melodía arcade 8-bit · original", b:105, x:"Ejercicio original con saltos y repetición, inspirado en la energía de los videojuegos clásicos. No es una transcripción de una canción comercial.", tab:"1.0:.5 1.0:.5 1.7:.5 1.0:.5 1.5:.5 1.0:.5 1.3:1 1.2:.5 1.0:.5 1.7:.5 1.0:.5 1.5:.5 1.9:1 1.7:.5 1.5:.5 1.3:1"},
  {t:"Frère Jacques · canon tradicional", b:90, x:"Canción tradicional de dominio público. Cuenta grupos de cuatro notas y procura que las notas largas no se corten.", tab:"1.0:1 1.2:1 1.4:1 1.0:1 1.0:1 1.2:1 1.4:1 1.0:1 1.4:1 1.5:1 1.7:2 1.4:1 1.5:1 1.7:2"}]},
 {n:"8 · Aprende los acordes esenciales", d:"Acordes mayores, menores y séptimas en posición abierta. Arpegia cada forma para escuchar sus notas.", l:[
  {t:"Acordes mayores: C · A · G · E · D", b:70, x:"Aprende las cinco formas abiertas esenciales. Practica cada acorde nota por nota, desde la cuerda grave correspondiente hacia la aguda. En el módulo Diapasón puedes ver la forma completa y los dedos sugeridos.", tab:"5.3:.5 4.2:.5 3.0:.5 2.1:.5 1.0:1 5.0:.5 4.2:.5 3.2:.5 2.2:.5 1.0:1 6.3:.5 5.2:.5 4.0:.5 3.0:.5 2.0:.5 1.3:1 6.0:.5 5.2:.5 4.2:.5 3.1:.5 2.0:.5 1.0:1 4.0:.5 3.2:.5 2.3:.5 1.2:1"},
  {t:"Acordes menores: Am · Em · Dm", b:70, x:"Escucha el carácter más oscuro de la tercera menor. Mantén los dedos curvados para no apagar las cuerdas vecinas.", tab:"5.0:.5 4.2:.5 3.2:.5 2.1:.5 1.0:1 6.0:.5 5.2:.5 4.2:.5 3.0:.5 2.0:.5 1.0:1 4.0:.5 3.2:.5 2.3:.5 1.1:1"},
  {t:"Acordes séptima: A7 · D7 · E7 · G7", b:75, x:"Los acordes de séptima dominante son fundamentales en blues, rock clásico y progresiones de tensión-resolución. Arpegia cada forma.", tab:"5.0:.5 4.2:.5 3.0:.5 2.2:.5 1.0:1 4.0:.5 3.2:.5 2.1:.5 1.2:1 6.0:.5 5.2:.5 4.0:.5 3.1:.5 2.0:.5 1.0:1 6.3:.5 5.2:.5 4.0:.5 3.0:.5 2.0:.5 1.1:1"}]},
 {n:"9 · Acordes con cejilla", d:"Construye fuerza y limpieza en cejillas móviles mayores y menores.", l:[
  {t:"Cejilla de Fa mayor (F)", b:55, x:"Barre el traste 1 con el índice, comprobando que las seis cuerdas suenen limpias. Practica como arpegio y después rasguea el acorde completo.", tab:"6.1:.5 5.3:.5 4.3:.5 3.2:.5 2.1:.5 1.1:1 1.1:.5 2.1:.5 3.2:.5 4.3:.5 5.3:.5 6.1:1"},
  {t:"Cejilla de Si menor (Bm)", b:55, x:"Coloca la cejilla en el traste 2 desde la quinta cuerda. Evita apretar con exceso: acerca el dedo al traste metálico.", tab:"5.2:.5 4.4:.5 3.4:.5 2.3:.5 1.2:1 1.2:.5 2.3:.5 3.4:.5 4.4:.5 5.2:1"},
  {t:"Cambios F · C · G · Am", b:60, x:"Cambia entre una forma con cejilla y tres formas abiertas. Usa cuatro pulsos por acorde y busca transiciones sin pausas.", tab:"6.1:.5 5.3:.5 4.3:.5 3.2:.5 2.1:.5 1.1:1 5.3:.5 4.2:.5 3.0:.5 2.1:.5 1.0:1 6.3:.5 5.2:.5 4.0:.5 3.0:.5 2.0:.5 1.3:1 5.0:.5 4.2:.5 3.2:.5 2.1:.5 1.0:1"}]},
 {n:"10 · Técnicas expresivas", d:"Bends, slides y vibrato: aprende a dar voz a cada nota.", l:[
  {t:"Bend de un tono", b:65, x:"Toca la cuerda 2 en el traste 8 y eleva la cuerda hasta alcanzar el tono del traste 10. La pista indica BEND +2 y evalúa la nota objetivo; practica despacio y sin forzar la mano.", tab:"2.8~bend:1 2.8~bend:1 2.8~bend:2 2.8~bend:1 2.10:2"},
  {t:"Slides ascendentes y descendentes", b:75, x:"Ataca la nota una sola vez y desliza el dedo manteniendo presión hasta el traste de llegada. Escucha que no haya un hueco entre ambas notas.", tab:"2.5~slide-7:1 2.7:1 1.5~slide-8:1 1.8:1 3.5~slide-7:1 3.7:1"},
  {t:"Vibrato controlado", b:65, x:"En una nota larga, mueve suavemente la cuerda con la muñeca para variar el tono. Mantén el pulso y evita que el vibrato se vuelva demasiado ancho.", tab:"1.7~vibrato:2 1.5~vibrato:2 2.8~vibrato:2 2.5~vibrato:2"}]},
 {n:"11 · Solos extendidos", d:"Frases largas originales: conecta pentatónica, bends, slides y vibrato.", l:[
  {t:"Solo de blues rock · 24 notas", b:75, x:"Frase original de dos compases que combina caja pentatónica, un slide y vibrato final. No aumentes velocidad hasta tocarla limpia tres veces.", tab:"2.5:.5 2.8:.5 1.5:1 1.8:.5 1.5:.5 2.8:1 2.5:.5 2.8:.5 1.5:.5 1.8:.5 1.5:1 2.8:.5 2.5:1 1.5:.5 1.8:.5 1.5~bend:1 1.5:.5 2.8:.5 2.5:.5 2.8:.5 1.5:.5 1.8~vibrato:2"},
  {t:"Solo melódico · 32 notas", b:80, x:"Desarrolla una idea, repítela y resuélvela. El ejercicio incluye saltos entre cuerdas, slides y notas sostenidas.", tab:"1.5:.5 1.7:.5 1.8:.5 1.7:.5 2.5:.5 2.8:.5 1.5:1 1.8:.5 1.10:.5 1.8:.5 1.7:.5 2.8:.5 2.5:1 3.5:.5 3.7:.5 2.5:.5 2.8:.5 1.5~slide-8:1 1.8:.5 1.10:.5 1.8:.5 2.8:.5 2.10:.5 1.10:1 1.8:.5 2.8:.5 2.10~bend:1 2.10:.5 1.10~vibrato:2"},
  {t:"Solo largo · resistencia y fraseo", b:85, x:"Practica esta frase extendida en bloques de cuatro notas. Trabaja la limpieza primero; sube el tempo en pasos pequeños y conserva el control del vibrato final.", tab:R("6.5:.25 6.8:.25 5.5:.25 5.7:.25 4.5:.25 4.7:.25 3.5:.25 3.7:.25",2)+" 2.5~slide-8:.5 2.8:.5 1.5:.5 1.8:.5 1.5:.5 2.8:.5 2.5:.5 2.8:.5 1.5:.5 1.8:.5 1.5:.5 2.8:.5 1.10~bend:1 1.8:.5 1.10:.5 1.8:.5 2.8:.5 2.5:.5 1.5~vibrato:2"}]}
];
const ROCK = [
 ["Shuffle de blues en La","Blues rock",1,90,R("5.0+4.2:.5 5.0+4.4:.5",4)+" "+R("4.0+3.2:.5 4.0+3.4:.5",2)+" "+R("5.0+4.2:.5 5.0+4.4:.5",2)+" 6.0+5.2:1 4.0+3.2:1 5.0+4.2:2"],
 ["Boogie en Mi","Rock clásico",1,110,R("6.0:.5 6.4:.5 5.2:.5 5.4:.5 5.2:.5 6.4:.5",4)],
 ["Rock and roll de los 50","Rock clásico",2,130,R("5.0+4.2:.5 5.0+4.4:.5",2)+" "+R("4.0+3.2:.5 4.0+3.4:.5",1)+" "+R("5.0+4.2:.5 5.0+4.4:.5",1)+" 6.0+5.2:1 4.0+3.2:1 5.0+4.2:2"],
 ["Power chords I–IV–V en Re","Hard rock",2,110,"4.0+3.2:1 4.0+3.2:.5 4.0+3.2:.5 5.0+4.2:1 5.0+4.2:1 6.0+5.2:1 6.0+5.2:.5 6.0+5.2:.5 5.0+4.2:2 4.0+3.2:2"],
 ["Riff pentatónico de hard rock","Hard rock",3,130,"5.0:.5 5.0:.5 4.2:.5 5.0:.5 4.0:.5 5.0:.5 4.2:.5 3.0:.5 5.0:.5 5.0:.5 4.2:.5 5.0:.5 4.0:.5 4.2:.5 3.0:.5 4.2:.5"],
 ["Riff cromático pesado","Hard rock",3,120,R("6.0:.5 6.1:.5 6.2:.5 6.1:.5",3)+" 6.0:1 6.3:1 6.0:1 5.2:1"],
 ["Punk a toda velocidad","Punk",1,160,R("6.0+5.2:.5",4)+" "+R("5.0+4.2:.5",4)+" "+R("6.0+5.2:.5",4)+" "+R("5.2+4.4:.5",4)],
 ["Punk de tres acordes","Punk",1,150,R("5.0+4.2:.5",4)+" "+R("4.0+3.2:.5",4)+" "+R("6.0+5.2:.5",4)+" "+R("5.0+4.2:.5",4)],
 ["Grunge lento en Mi","Grunge",2,80,"6.0+5.2:2 6.3+5.5:1 6.5+5.7:1 6.3+5.5:2 6.0+5.2:2 6.0+5.2:1 r:1 6.3+5.5:2 6.0+5.2:2"],
 ["Galope metal en Mi","Metal",2,140,R("6.0:.25 6.0:.25 6.0:.5",8)+" "+R("6.3:.25 6.3:.25 6.3:.5",4)+" "+R("6.5:.25 6.5:.25 6.5:.5",4)],
 ["Metal con power chords cromáticos","Metal",3,150,R("6.0+5.2:.25",4)+" 6.1+5.3:.5 6.2+5.4:.5 "+R("6.0+5.2:.25",4)+" 6.3+5.5:.5 6.2+5.4:.5 "+R("6.0+5.2:.25",4)+" 6.5+5.7:1 6.3+5.5:1"],
 ["Balada: arpegio Em–C–G–D","Balada rock",1,72,R("6.0:.5 5.2:.5 4.2:.5 3.0:.5 2.0:.5 1.0:.5",1)+" "+"5.3:.5 4.2:.5 3.0:.5 2.1:.5 1.0:.5 2.1:.5 "+"6.3:.5 4.0:.5 3.0:.5 2.0:.5 1.3:.5 2.0:.5 "+"4.0:.5 3.2:.5 2.3:.5 1.2:.5 2.3:.5 3.2:.5"],
 ["Surf con trémolo","Surf y rockabilly",3,150,R("2.0:.25",8)+" "+R("2.3:.25",8)+" "+R("1.0:.25",8)+" "+R("2.3:.25",8)],
 ["Rockabilly con bajo caminante","Surf y rockabilly",2,120,R("5.0:.5 5.4:.5 4.2:.5 4.4:.5 4.5:.5 4.4:.5 4.2:.5 5.4:.5",2)],
 ["Lick de rock sureño en Sol","Rock sureño",2,100,R("2.0:.5 2.3:.5 1.0:1 2.3:.5 2.0:.5 3.2:.5 3.0:1",2)],
 ["Indie con octavas","Indie y alternativo",2,110,R("6.0+4.2:.5",2)+" 6.3+4.5:.5 6.5+4.7:.5 "+R("6.0+4.2:.5",2)+" 6.3+4.5:.5 5.0+3.2:.5"],
 ["Himno de arena · power chords","Hard rock melódico 80s",1,105,R("6.0+5.2:1 6.0+5.2:.5 6.0+5.2:.5 5.0+4.2:1 5.0+4.2:1 4.0+3.2:1 4.0+3.2:.5 4.0+3.2:.5 5.0+4.2:2",2)],
 ["Armonía gemela · melodía de dos voces","Hard rock melódico 80s",2,115,"2.5:.5 2.7:.5 2.8:1 1.5:.5 1.7:.5 1.8:1 2.8:.5 2.10:.5 1.8:1 1.7:.5 1.5:.5 2.8:2"],
 ["Glam metal · riff de escenario","Glam metal",2,125,R("6.0+5.2:.5 6.0+5.2:.5 6.3+5.5:.5 6.5+5.7:.5",2)+" 5.3+4.5:1 5.5+4.7:1 6.0+5.2:2"],
 ["Hard rock bluesero · lick pentatónico","Blues hard rock",2,105,"4.5:.5 4.7:.5 3.5:1 2.5:.5 2.8:.5 1.5~bend:1 1.5:.5 2.8:.5 2.5:2"],
 ["Riff de metal clásico · palm mute","Heavy metal clásico",2,135,R("6.0:.25 6.0:.25 6.0:.5 6.0:.25 6.0:.25 6.3:.5",4)+" 5.2+4.4:1 6.0:1"],
 ["Galope NWOBHM · ejercicio original","Heavy metal clásico",3,155,R("6.0:.25 6.0:.25 6.0:.5",8)+" 6.3:.5 6.5:.5 6.3:.5 6.2:.5 6.0:2"],
 ["Arpegio de balada de estadio","Balada hard rock",1,78,R("6.0:.5 5.2:.5 4.2:.5 3.0:.5 2.0:.5 1.0:.5",2)+" 5.3:.5 4.2:.5 3.0:.5 2.1:.5 1.0:1"],
 ["Riff de boogie con doble nota","Blues hard rock",2,120,R("5.0+4.2:.5 5.0+4.4:.5 5.0+4.2:.5 5.0+4.4:.5",3)+" 6.0+5.2:1 5.0+4.2:1"],
 ["Shred pentatónico · secuencia larga","Solo y shred",3,135,R("6.5:.25 6.8:.25 5.5:.25 5.7:.25 4.5:.25 4.7:.25 3.5:.25 3.7:.25",2)+" 2.5:.25 2.8:.25 1.5:.25 1.8:.25 1.10:.25 1.8:.25 2.8:.25 2.5:.25 1.5~bend:.5 1.8:.25 1.10:.25 1.8:.25 2.8:.25 2.5:.25 1.5~vibrato:2"],
 ["Solo melódico de hard rock · largo","Solo y shred",2,95,"2.5:.5 2.8:.5 1.5:1 1.8:.5 1.5:.5 2.8:1 2.5:.5 2.8:.5 1.5:.5 1.8:.5 1.5:1 2.8:.5 2.5:1 1.5:.5 1.8:.5 1.5~bend:1 1.5:.5 2.8:.5 2.5:.5 2.8:.5 1.5:.5 1.8~vibrato:2"]
];

/* ================= PARSEO ================= */
const mk = (ini, dur, c, f, tech=null) => {
  const targetFret=tech?.type==="bend"?f+(tech.amount||2):tech?.type==="slide"?(tech.toFret||f+2):f;
  return {ini,dur:Math.max(dur,240),midi:ABIERTA[c]+targetFret,fret:f,traste:f,carril:c-1,cuerda:c,dedo:null,real:false,gid:ini,technique:tech?.type||"",techniqueLabel:tech?.label||""};
};
function cerrar(notas, total, nombre, carriles, tempos){
  notas.sort((a, b) => a.ini - b.ini);
  const num = t => typeof t === "number" && t > 0;
  notas.forEach((n, i) => {
    if (n.dedo !== null) return;
    if (n.traste === "x") { n.dedo = -1; return; }
    if (n.traste === 0) { n.dedo = 0; return; }
    let base = n.traste;
    for (let j = i; j >= 0 && n.ini - notas[j].ini <= 1920; j--) if (num(notas[j].traste) && notas[j].traste < base) base = notas[j].traste;
    for (let j = i + 1; j < notas.length && notas[j].ini - n.ini <= 1920; j++) if (num(notas[j].traste) && notas[j].traste < base) base = notas[j].traste;
    if (n.traste - base > 3) base = n.traste - 3;
    n.dedo = n.traste - base + 1;
  });
  const grupos = new Map(); notas.forEach(n => { if (!grupos.has(n.gid)) grupos.set(n.gid, []); grupos.get(n.gid).push(n); });
  const lineas = []; for (let t = 0; t < total; t += 3840) lineas.push(t);
  return {nombre, notas, grupos, lineas, total, carriles, tempos};
}
function parseTab(tab, bpm, nombre){
  const notas = []; let t = 0;
  for (const tok of tab.trim().split(/\s+/)){
    const [a, d] = tok.split(":"), dur = Math.round((+d || 1) * 960);
    if (a !== "r") for (const p of a.split("+")){
      const m=p.match(/^(\d+)\.(\d+)(?:~(bend|slide|vibrato)(?:-(\d+))?)?$/); if(!m) continue;
      const c=+m[1],f=+m[2],kind=m[3]||"",narg=m[4]?+m[4]:null;
      let tech=null;if(kind==="bend")tech={type:"bend",amount:narg||2,label:"BEND +"+(narg||2)};
      else if(kind==="slide")tech={type:"slide",toFret:narg||f+2,label:"SLIDE →"+(narg||f+2)};
      else if(kind==="vibrato")tech={type:"vibrato",label:"VIBRATO"};
      notas.push(mk(t,dur,c,f,tech));
    }
    t += dur;
  }
  return cerrar(notas, t, nombre, 6, [[0, bpm]]);
}
function desdeGP(bytes, nombre){
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes, new alphaTab.Settings());
  let idx = score.tracks.findIndex(t => t.playbackInfo && t.playbackInfo.program >= 24 && t.playbackInfo.program <= 31); if (idx < 0) idx = 0;
  const st = score.tracks[idx].staves[0], tun = st.tuning || (st.stringTuning && st.stringTuning.tunings) || [64,59,55,50,45,40], notas = [];
  for (const bar of st.bars) for (const beat of bar.voices[0].beats){
    if (beat.isRest) continue;
    for (const n of beat.notes){
      if (n.isTieDestination) continue;
      const c = tun.length - n.string + 1, dg = n.leftHandFinger;
      notas.push({ini:beat.absolutePlaybackStart, dur:Math.max(beat.playbackDuration, 240), midi:n.realValue, fret:n.fret, traste:n.isDead ? "x" : n.fret,
        carril:c - 1, cuerda:c, dedo:(dg >= 1 && dg <= 4) ? dg : null, real:dg >= 1 && dg <= 4, gid:beat.absolutePlaybackStart});
    }
  }
  const tempos = []; let tp = score.tempo, total = 0;
  for (const mb of score.masterBars){ if (mb.tempoAutomation) tp = mb.tempoAutomation.value; tempos.push([mb.start, tp]); total = mb.start + mb.calculateDuration(); }
  return cerrar(notas, total, (score.title || nombre) + " · " + score.tracks[idx].name, tun.length, tempos);
}
const tempoEn = (tempos, t) => { let v = tempos[0][1]; for (const [s, b] of tempos){ if (s <= t) v = b; else break; } return v; };
const primero = (notas, tk) => { let lo = 0, hi = notas.length; while (lo < hi){ const m = (lo + hi) >> 1; if (notas[m].ini < tk) lo = m + 1; else hi = m; } return lo; };

/* ================= PISTA EN PERSPECTIVA ================= */
const VEN = 7, ADE = 4800, K = 3.5, posF = f => 1 - Math.pow(2, -f / 12);
function rr(c, x, y, w, h, r){ if (c.roundRect){ c.roundRect(x, y, w, h, r); return; } c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
class Pista{
  constructor(cv){ this.cv = cv; this.c = cv.getContext("2d"); this.s = {notas:[], lineas:[], carriles:6, grupos:new Map()}; this.f0 = 0; this.ok = false; this.tg = 0; this.resize(); if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(cv); }
  set(s){ this.s = s; this.ok = false; }
  resize(){ const d = devicePixelRatio || 1, r = this.cv.getBoundingClientRect(); this.W = r.width; this.H = r.height; this.cv.width = r.width * d; this.cv.height = r.height * d; this.c.setTransform(d, 0, 0, d, 0, 0); }
  draw(tick, J){
    const c = this.c, W = this.W, H = this.H, {notas, lineas, carriles} = this.s; c.clearRect(0, 0, W, H);
    const nC = Math.max(carriles, 2), L = W * .05, Wd = W * .9, ny = H * .6, nh = H * .24, gap = nh / (nC - 1), yc = ny + nh / 2, yT = ny - gap * .6, yB = ny + nh + gap * .6, vx = W / 2, vy = H * .02;
    const Sc = t => 1 / (1 + K * t), P = (x, y, t) => { const s = Sc(t); return [vx + (x - vx) * s, vy + (y - vy) * s]; };
    let i = primero(notas, tick - 120), mn = 99, mx = 0;
    const o0 = notas[i], obj = o0 ? this.s.grupos.get(o0.gid) : [];
    for (; i < notas.length && notas[i].ini <= tick + 2880; i++){ const f = notas[i].fret; if (f > 0){ mn = Math.min(mn, f); mx = Math.max(mx, f); } }
    if (mx){ let tg = Math.max(0, mn - 2); if (mx - tg > VEN) tg = mx - VEN; this.tg = tg; }
    if (!this.ok){ this.f0 = this.tg; this.ok = true; } else this.f0 += (this.tg - this.f0) * .07;
    const f0 = this.f0, fa = posF(f0), fb = posF(f0 + VEN), wx = f => L + (posF(f) - fa) / (fb - fa) * Wd;
    const g = c.createLinearGradient(0, vy, 0, yB); g.addColorStop(0, "#0a121a"); g.addColorStop(1, "#13222f");
    c.fillStyle = g; c.beginPath(); let q = P(L, yc, 1); c.moveTo(L, yB); c.lineTo(L, yc); c.lineTo(q[0], q[1]); q = P(L + Wd, yc, 1); c.lineTo(q[0], q[1]); c.lineTo(L + Wd, yc); c.lineTo(L + Wd, yB); c.closePath(); c.fill();
    c.lineWidth = 1;
    for (let n = Math.floor(f0); n <= Math.ceil(f0 + VEN); n++){ const x = wx(n); if (x < L - 1 || x > L + Wd + 1) continue; const e = P(x, yc, 1); c.strokeStyle = "rgba(150,180,210,.22)"; c.beginPath(); c.moveTo(x, yc); c.lineTo(e[0], e[1]); c.stroke(); }
    for (const l of lineas){ const dt = l - tick; if (dt < 0 || dt > ADE) continue; const t = dt / ADE, a = P(L, yc, t), b = P(L + Wd, yc, t); c.strokeStyle = "rgba(210,225,240," + (.35 * (1 - t) + .06) + ")"; c.lineWidth = 2 * Sc(t); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    c.fillStyle = "#1c1510"; c.fillRect(L, yT, Wd, yB - yT);
    for (const n of [3,5,7,9,12,15,17,19,21,24]){ const x = (wx(n - 1) + wx(n)) / 2; if (x < L || x > L + Wd) continue; c.fillStyle = "rgba(255,255,255,.10)"; for (const yy of (n % 12 === 0 ? [yc - gap * 1.1, yc + gap * 1.1] : [yc])){ c.beginPath(); c.arc(x, yy, Math.max(3, gap * .22), 0, 6.3); c.fill(); } }
    for (let n = Math.floor(f0); n <= Math.ceil(f0 + VEN); n++){ const x = wx(n); if (x < L - 1 || x > L + Wd + 1) continue; c.strokeStyle = n === 0 ? "#d7dbe0" : "#8b929c"; c.lineWidth = n === 0 ? 5 : 2; c.beginPath(); c.moveTo(x, yT); c.lineTo(x, yB); c.stroke(); }
    for (let r = 0; r < nC; r++){ const y = ny + r * gap; c.strokeStyle = RS[r % RS.length]; c.lineWidth = Math.max(1.2, 3.2 - r * .45); c.beginPath(); c.moveTo(L, y); c.lineTo(L + Wd, y); c.stroke(); }
    c.textAlign = "center"; c.textBaseline = "middle";
    const res = new Set(obj.map(n => n.fret));
    for (let n = Math.floor(f0) + 1; n <= Math.ceil(f0 + VEN) + 1; n++){ const xc = (wx(n - 1) + wx(n)) / 2; if (xc < L || xc > L + Wd) continue; const on = res.has(n); c.font = (on ? "700 18px" : "500 14px") + " Segoe UI, system-ui, sans-serif"; c.fillStyle = on ? "#ff9638" : "#6f7c8c"; c.fillText(String(n), xc, yB + 16); }
    for (let k = primero(notas, tick + ADE + 1) - 1; k >= 0; k--){
      const n = notas[k]; if (n.ini < tick - 15360) break;
      const fin = n.ini + n.dur; if (fin < tick - 60) continue;
      const t0 = Math.max(0, (n.ini - tick) / ADE), t1 = Math.min(1, (fin - tick) / ADE), s0 = Sc(t0);
      const row = carriles - 1 - n.carril, y = ny + row * gap, col = RS[row % RS.length], abierta = n.fret === 0;
      let xc, sw; if (abierta){ xc = L + Wd / 2; sw = Wd; } else { const a = wx(n.fret - 1), b = wx(n.fret); xc = (a + b) / 2; sw = b - a; }
      if (xc < -60 || xc > W + 60) continue;
      const activa = n.ini <= tick + 30 && tick <= fin, hit = J && J.hit.has(n.gid), miss = J && J.miss.has(n.gid);
      c.globalAlpha = miss ? .3 : hit && n.ini <= tick ? .45 : 1;
      if (!abierta && t1 - t0 > .04){ const tw = Math.min(sw * .12, 6), p1 = P(xc - tw, y, t0), p2 = P(xc + tw, y, t0), p3 = P(xc + tw, y, t1), p4 = P(xc - tw, y, t1); c.fillStyle = col + "88"; c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.lineTo(p3[0], p3[1]); c.lineTo(p4[0], p4[1]); c.closePath(); c.fill(); }
      const w = (abierta ? Wd : Math.max(sw * .82, 22)) * s0, hh = Math.min(gap * .74, 28) * s0, pp = P(xc, y, t0);
      c.fillStyle = miss ? "#59616b" : col; c.beginPath(); rr(c, pp[0] - w / 2, pp[1] - hh / 2, w, hh, 4 * s0); c.fill();
      if (hit && n.ini <= tick + 400 || activa){ c.strokeStyle = hit ? "#3fe08f" : "#fff"; c.lineWidth = 3; c.stroke(); }
      c.font = "700 " + Math.max(9, Math.round(hh * .64)) + "px Segoe UI, system-ui, sans-serif"; c.fillStyle = "#0b1016"; c.fillText(String(n.traste), pp[0], pp[1] + 1);
      if(n.techniqueLabel && s0>.52){c.font="800 "+Math.max(8,Math.round(10*s0))+"px Segoe UI,system-ui,sans-serif";c.fillStyle="#ffffff";c.fillText(n.techniqueLabel,pp[0],pp[1]-hh*.9);}
      if (n.dedo >= 1 && s0 > .5){ const bx = pp[0] + (abierta ? 0 : w / 2) - 2, by = pp[1] - hh / 2 - 2; c.fillStyle = "#0b1016"; c.beginPath(); c.arc(bx, by, 8 * s0, 0, 6.3); c.fill(); c.fillStyle = "#fff"; c.font = "700 " + Math.round(11 * s0) + "px Segoe UI, system-ui, sans-serif"; c.fillText(String(n.dedo), bx, by + 1); }
      c.globalAlpha = 1;
    }
    return obj;
  }
}

/* ================= AUDIO: detección de tono (YIN) ================= */
function yin(b, sr){
  const W2 = b.length >> 1, tauMax = Math.min(W2 - 1, Math.floor(sr / 60)), tauMin = Math.floor(sr / 1400);
  let rms = 0; for (let i = 0; i < b.length; i++) rms += b[i] * b[i]; if (Math.sqrt(rms / b.length) < .012) return -1;
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++){ let s = 0; for (let i = 0; i < W2; i++){ const x = b[i] - b[i + tau]; s += x * x; } d[tau] = s; }
  let acc = 0; d[0] = 1; for (let tau = 1; tau <= tauMax; tau++){ acc += d[tau]; d[tau] = d[tau] * tau / (acc || 1); }
  let tau = tauMin; while (tau < tauMax){ if (d[tau] < .15){ while (tau + 1 < tauMax && d[tau + 1] < d[tau]) tau++; break; } tau++; }
  if (tau >= tauMax) return -1;
  const a = d[tau - 1], c = d[tau + 1], m = d[tau], den = a + c - 2 * m; return sr / (den ? tau + (a - c) / (2 * den) : tau);
}

/* ================= SESIÓN DE JUEGO ================= */
const CAN = [];                                   // todas las canciones disponibles
CURSO.forEach((m, mi) => m.l.forEach((l, li) => CAN.push({id:`c:${mi}.${li}`, grupo:"Curso · " + m.n, nombre:l.t, bpm:l.b, tab:l.tab})));
ROCK.forEach((r, i) => CAN.push({id:`r:${i}`, grupo:"Rock · " + r[1], nombre:r[0], bpm:r[3], tab:r[4]}));
const S = {todos:[], cancion:null, id:"", jug:[], corriendo:false, tick:0, ult:0, vel:1, ctx:null, gi:0, beat:0, modo:1, raf:0};
const prog = JSON.parse(localStorage.getItem("gm_curso") || "{}");
const guardarProg = () => localStorage.setItem("gm_curso", JSON.stringify(prog));

function cargar(id){
  const c = CAN.find(x => x.id === id); if (!c) return;
  S.id = id; S.cancion = parseTab(c.tab, c.bpm, c.nombre); reiniciar();
  if ($("pSong")) $("pSong").value = id;
}
function reiniciar(){
  S.corriendo = false; S.tick = -3840;
  S.jug.forEach(J => { J.hit = new Set(); J.miss = new Set(); J.pts = 0; J.racha = 0; J.ac = 0; J.fa = 0; J.pista.set(S.cancion); });
  $("pStart").textContent = "▶ Jugar"; $("pRes").textContent = "";
}
function pluck(m, ms){
  const c = S.ctx; if (!c) return; const o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
  o.type = "triangle"; o.frequency.value = 440 * Math.pow(2, (m - 69) / 12);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.22, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + Math.min(1.2, ms / 1000 + .2));
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + 1.3);
}
function click(fuerte){ const c = S.ctx; if (!c) return; const o = c.createOscillator(), g = c.createGain(), t = c.currentTime; o.frequency.value = fuerte ? 1500 : 1000; g.gain.setValueAtTime(.15, t); g.gain.exponentialRampToValueAtTime(.0001, t + .05); o.connect(g).connect(c.destination); o.start(t); o.stop(t + .06); }

function detectar(J, now){
  if (!J.an || now - J.t < 40) return; J.t = now; J.an.getFloatTimeDomainData(J.buf);
  const f = yin(J.buf, S.ctx.sampleRate);
  if (f > 0){ J.h.push(69 + 12 * Math.log2(f / 440)); if (J.h.length > 3) J.h.shift(); J.det = [...J.h].sort((a, b) => a - b)[J.h.length >> 1]; J.ult = now; }
  else { J.h.length = 0; if (now - J.ult > 160) J.det = null; }
}
function evaluar(J){
  if (!S.corriendo || !J.an) return;
  const nt = S.cancion.notas, tk = S.tick, gr = S.cancion.grupos;
  for (let i = primero(nt, tk - 1700); i < nt.length && nt[i].ini <= tk + 220; i++){
    const g = nt[i].gid; if (J.hit.has(g) || J.miss.has(g)) continue;
    const fin = nt[i].ini + Math.min(Math.max(nt[i].dur * .6, 360), 1500);
    if (tk >= nt[i].ini - 220 && tk <= fin && J.det !== null && gr.get(g).some(n => n.midi === Math.round(J.det))){ J.hit.add(g); J.pts += 100 + Math.min(J.racha, 10) * 10; J.racha++; J.ac++; }
    else if (tk > fin){ J.miss.add(g); J.racha = 0; J.fa++; }
  }
}
function hud(J, obj){
  const i = J.i, t = J.ac + J.fa;
  $("pd" + i).textContent = J.det !== null ? nom(Math.round(J.det)) : "—";
  $("po" + i).textContent = obj.length ? [...new Set(obj.map(n => nom(n.midi)))].join(" + ") : "—";
  $("pp" + i).textContent = J.pts; $("pr" + i).textContent = J.racha; $("pa" + i).textContent = t ? Math.round(J.ac / t * 100) + "%" : "—";
  $("pf" + i).textContent = obj.map(n => `Cuerda ${n.cuerda}${S.cancion.carriles === 6 ? " (" + CUERDA_NOM[n.cuerda] + ")" : ""} · Traste ${n.traste === 0 ? "0 (al aire)" : n.traste} · Dedo ${DEDO[n.dedo] || "silenciada"}`).join("   |   ");
}
function bucle(now){
  S.raf = requestAnimationFrame(bucle);
  const dt = Math.min(100, now - S.ult); S.ult = now;
  try{
    if (S.corriendo){
      S.tick += dt * tempoEn(S.cancion.tempos, S.tick) * 960 / 60000 * S.vel;
      const b = Math.floor(S.tick / 960); if (b !== S.beat){ S.beat = b; if ($("pMet").checked) click(((b % 4) + 4) % 4 === 0); }
      const nt = S.cancion.notas; while (S.gi < nt.length && nt[S.gi].ini <= S.tick){ if ($("pGuia").checked) pluck(nt[S.gi].midi, nt[S.gi].dur * 60000 / (960 * tempoEn(S.cancion.tempos, S.tick))); S.gi++; }
      if (S.tick > S.cancion.total + 480) terminar();
    }
    S.jug.forEach(J => { detectar(J, now); evaluar(J); hud(J, J.pista.draw(S.tick, J)); });
  } catch (e){ $("pRes").textContent = "Error: " + e.message; }
}
function terminar(){
  S.corriendo = false; $("pStart").textContent = "▶ Jugar otra vez";
  const r = S.jug.map(J => { const t = J.ac + J.fa; return {i:J.i, pts:J.pts, pre:t ? Math.round(J.ac / t * 100) : 0, mic:!!J.an}; });
  if (S.jug.length === 2){
    const [a, b] = r; $("pRes").textContent = !a.mic && !b.mic ? "Conecta los micrófonos para puntuar." : a.pts === b.pts ? `¡Empate! ${a.pts} puntos cada uno.` : `🏆 Gana el jugador ${a.pts > b.pts ? 1 : 2}: ${Math.max(a.pts, b.pts)} contra ${Math.min(a.pts, b.pts)} puntos (precisión ${a.pre}% y ${b.pre}%).`;
  } else if (!r[0].mic) $("pRes").textContent = "Terminó. Conecta tu micrófono para obtener puntos y precisión.";
  else {
    $("pRes").textContent = `Terminaste: ${r[0].pts} puntos · precisión ${r[0].pre}%.`;
    if (S.id.startsWith("c:") && r[0].pre >= 70){ const k = S.id.slice(2); if (!prog[k] || prog[k] < r[0].pre) prog[k] = r[0].pre; guardarProg(); pintarCurso(); toast("¡Lección completada!"); }
  }
}
async function jugar(){
  if (S.corriendo){ S.corriendo = false; $("pStart").textContent = "▶ Jugar"; return; }
  S.ctx = S.ctx || new (window.AudioContext || window.webkitAudioContext)(); await S.ctx.resume();
  reiniciar(); S.vel = +$("pVel").value; S.gi = 0; S.beat = -5; S.corriendo = true; $("pStart").textContent = "■ Detener";
}
async function listarDispositivos(){
  const d = (await navigator.mediaDevices.enumerateDevices()).filter(x => x.kind === "audioinput");
  [1, 2].forEach(i => { const s = $("pDev" + i), v = s.value; s.innerHTML = '<option value="">Predeterminado</option>' + d.map((x, k) => `<option value="${x.deviceId}">${x.label || "Entrada " + (k + 1)}</option>`).join(""); s.value = v; });
}
async function conectar(){
  try{
    S.ctx = S.ctx || new (window.AudioContext || window.webkitAudioContext)(); await S.ctx.resume();
    for (const J of S.jug){
      const dev = $("pDev" + J.i).value, ch = $("pCh" + J.i).value;
      if (J.st) J.st.getTracks().forEach(t => t.stop());
      J.st = await navigator.mediaDevices.getUserMedia({audio:{deviceId:dev ? {exact:dev} : undefined, echoCancellation:false, noiseSuppression:false, autoGainControl:false, channelCount:2}});
      const src = S.ctx.createMediaStreamSource(J.st), an = S.ctx.createAnalyser(); an.fftSize = 4096;
      if (ch === "0") src.connect(an); else { const sp = S.ctx.createChannelSplitter(2); src.connect(sp); sp.connect(an, +ch - 1); }
      J.an = an; J.buf = new Float32Array(4096);
    }
    await listarDispositivos(); toast("Micrófono conectado. Usa audífonos si activas la guía.");
  } catch (e){ toast("No se pudo abrir el micrófono (¿permiso o HTTPS?): " + e.message); }
}
function ponerModo(n){
  S.modo = n; S.jug = S.todos.slice(0, n);
  $("pj2").style.display = n === 2 ? "" : "none"; $("pModo").value = String(n);
  $("pPlayers").className = "pj-grid p" + n;
  S.todos.forEach(J => J.pista.resize()); if (S.cancion) reiniciar();
}

/* ================= INTERFAZ ================= */
function ver(nombre){
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + nombre));
  window.scrollTo({top:0, behavior:"smooth"});
  if (nombre === "pista") setTimeout(() => S.todos.forEach(J => J.pista.resize()), 30);
}
function pintarCurso(){
  const hechas = Object.keys(prog).length, total = CURSO.reduce((s, m) => s + m.l.length, 0);
  $("cursoProg").textContent = `${hechas} de ${total} lecciones completadas (precisión mínima 70%)`;
  $("cursoBarra").style.width = Math.round(hechas / total * 100) + "%";
  $("cursoLista").innerHTML = CURSO.map((m, mi) => `<details class="mod" ${mi === 0 ? "open" : ""}><summary><b>${m.n}</b><small>${m.d}</small></summary>` +
    m.l.map((l, li) => `<article class="lec"><div><h4>${prog[mi + "." + li] ? "✓ " : ""}${l.t}</h4><p>${l.x}</p><span class="tag">${l.b} BPM</span>${prog[mi + "." + li] ? `<span class="tag ok">Mejor: ${prog[mi + "." + li]}%</span>` : ""}</div><button class="btn btn-primary btn-small" data-play="c:${mi}.${li}">Practicar →</button></article>`).join("") + "</details>").join("");
}
function pintarRock(){
  const est = $("rockFiltro").value, nivel = +$("rockNivel").value;
  $("rockLista").innerHTML = ROCK.map((r, i) => ({r, i})).filter(x => (!est || x.r[1] === est) && (!nivel || x.r[2] === nivel)).map(({r, i}) =>
    `<article class="lec"><div><h4>${r[0]}</h4><span class="tag">${r[1]}</span><span class="tag">${"★".repeat(r[2])}${"☆".repeat(3 - r[2])}</span><span class="tag">${r[3]} BPM</span></div><div class="acc"><button class="btn btn-primary btn-small" data-play="r:${i}">Tocar</button><button class="btn btn-secondary btn-small" data-duo="r:${i}">Duelo 1 vs 1</button></div></article>`).join("");
}
function construirUI(){
  const jugador = i => `<div class="pj" id="pj${i}"><div class="pj-top"><b>${i === 1 ? "Jugador 1" : "Jugador 2"}</b><select id="pDev${i}"><option value="">Predeterminado</option></select><select id="pCh${i}"><option value="0">Mono / mezcla</option><option value="1">Canal 1 (izq.)</option><option value="2">Canal 2 (der.)</option></select></div>
    <canvas id="cv${i}"></canvas><div class="pj-hud"><div><small>Tocas</small><strong id="pd${i}">—</strong></div><div><small>Pide</small><strong id="po${i}">—</strong></div><div><small>Puntos</small><strong id="pp${i}">0</strong></div><div><small>Racha</small><strong id="pr${i}">0</strong></div><div><small>Precisión</small><strong id="pa${i}">—</strong></div></div><p class="pj-info" id="pf${i}"></p></div>`;
  const estilos = [...new Set(ROCK.map(r => r[1]))];
  const grupos = [...new Set(CAN.map(c => c.grupo))].map(g => `<optgroup label="${g}">${CAN.filter(c => c.grupo === g).map(c => `<option value="${c.id}">${c.nombre}</option>`).join("")}</optgroup>`).join("");
  $("view-lessons").insertAdjacentHTML("afterend", `
  <section id="view-escuela" class="view"><div class="page-heading"><div><p class="eyebrow">ESCUELA GUITAR MASTER</p><h1>Curso <span>práctico</span> de guitarra</h1><p class="lead">11 módulos: acordes abiertos y con cejilla, bends, slides, vibrato y solos largos. Cada lección se practica en la pista, con puntaje; con 70% de precisión se completa.</p></div><button class="btn btn-secondary" data-ir="home">← Inicio</button></div>
    <div class="progress-track"><span id="cursoBarra"></span></div><p class="muted" id="cursoProg"></p><div id="cursoLista"></div></section>
  <section id="view-rock" class="view"><div class="page-heading"><div><p class="eyebrow">BIBLIOTECA</p><h1>Rock <span>en la pista</span></h1><p class="lead">Riffs y solos originales por estilo, dificultad y velocidad. También puedes cargar tus tablaturas autorizadas de tus bandas favoritas.</p></div><button class="btn btn-secondary" data-ir="home">← Inicio</button></div>
    <div class="rock-reference"><b>Territorios de sonido</b><p>Hard rock melódico ochentero · glam metal · blues rock · rock de estadio · metal clásico · shred melódico. Como referencias de escucha: Def Leppard, Extreme, Guns N’ Roses, Aerosmith, Skid Row, Metallica, Queen, Led Zeppelin, Bon Jovi, Cinderella, Tesla, Poison y Whitesnake. Los ejercicios de esta biblioteca son composiciones originales, no copias de sus canciones.</p></div>
    <div class="inline-actions"><select id="rockFiltro"><option value="">Todos los estilos</option>${estilos.map(e => `<option>${e}</option>`).join("")}</select><select id="rockNivel"><option value="0">Todos los niveles</option><option value="1">Principiante</option><option value="2">Intermedio</option><option value="3">Avanzado</option></select></div><div id="rockLista"></div></section>
  <section id="view-pista" class="view"><div class="page-heading"><div><p class="eyebrow">PISTA ESTILO ROCKSMITH</p><h1>Toca <span>y puntúa</span></h1><p class="lead">Las notas bajan por el diapasón hasta su cuerda y traste. Hay una cuenta previa de 4 pulsos. Con dos jugadores, cada uno usa su propia entrada o canal.</p></div><button class="btn btn-secondary" data-ir="home">← Inicio</button></div>
    <div class="pj-bar"><select id="pSong">${grupos}</select><select id="pVel" aria-label="Velocidad de reproducción"><option value="0.35">35%</option><option value="0.4">40%</option><option value="0.5">50%</option><option value="0.6">60%</option><option value="0.7">70%</option><option value="0.75">75%</option><option value="0.8">80%</option><option value="0.85">85%</option><option value="0.9">90%</option><option value="1" selected>100%</option><option value="1.1">110%</option><option value="1.25">125%</option><option value="1.5">150%</option><option value="2">200%</option></select>
      <select id="pModo"><option value="1">1 jugador</option><option value="2">2 jugadores</option></select>
      <label><input type="checkbox" id="pGuia" checked> Guía sonora</label><label><input type="checkbox" id="pMet" checked> Metrónomo</label>
      <button class="btn btn-secondary btn-small" id="pConn">Conectar micrófonos</button><label class="btn btn-secondary btn-small" for="pGP">Abrir Guitar Pro</label><input type="file" id="pGP" accept=".gp,.gp3,.gp4,.gp5,.gpx" hidden>
      <button class="btn btn-primary" id="pStart">▶ Jugar</button></div>
    <p class="pj-res" id="pRes"></p><div class="pj-grid p1" id="pPlayers">${jugador(1)}${jugador(2)}</div>
    <p class="muted">Dos jugadores: usa dos interfaces, o una estéreo con canal 1 para uno y canal 2 para el otro. Con audífonos la guía no entra en el micrófono.</p></section>`);
  S.todos = [1, 2].map(i => ({i, pista:new Pista($("cv" + i)), hit:new Set(), miss:new Set(), pts:0, racha:0, ac:0, fa:0, det:null, h:[], t:0, ult:0, an:null}));
  S.jug = S.todos.slice(0, 1);
  document.body.addEventListener("click", e => {
    const b = e.target.closest("[data-play],[data-duo],[data-ir]"); if (!b) return;
    if (b.dataset.ir) return ver(b.dataset.ir);
    cargar(b.dataset.play || b.dataset.duo); ponerModo(b.dataset.duo ? 2 : 1); ver("pista");
  });
  $("pSong").onchange = e => cargar(e.target.value);
  $("pModo").onchange = e => ponerModo(+e.target.value);
  $("pVel").onchange = () => { S.vel = +$("pVel").value; };
  $("pConn").onclick = conectar; $("pStart").onclick = jugar; $("rockFiltro").onchange = pintarRock; $("rockNivel").onchange = pintarRock;
  $("pGP").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try{ S.cancion = desdeGP(new Uint8Array(await f.arrayBuffer()), f.name); S.id = "gp"; reiniciar(); $("pRes").textContent = "Cargado: " + S.cancion.nombre; }
    catch (err){ toast("No se pudo leer el archivo Guitar Pro: " + err.message); }
  };
  window.addEventListener("resize", () => S.todos.forEach(J => J.pista.resize()));
  const duelo = $("goDuelo"); if (duelo) duelo.onclick = () => { cargar(S.id || "r:3"); ponerModo(2); ver("pista"); };
  pintarCurso(); pintarRock(); cargar("c:0.0"); ponerModo(1);
  S.ult = performance.now(); S.raf = requestAnimationFrame(bucle);
}
construirUI();
})();
