# Guitar Master AI V1.7

## Novedades de V1.7 · práctica por secciones

- Cada canción abierta dispone de un panel **Práctica por secciones** para guardar Introducción, Estrofa 1, Coro, Estrofa 2, Puente, Solo, Final o partes con nombre personalizado.
- En MP3/WAV, reproduce la pista, usa «Marcar inicio actual» y «Marcar final actual», guarda el rango y practícalo una vez o en bucle. Se puede cambiar la velocidad entre 40 % y 200 %.
- En MIDI, los marcadores estándar de texto/marker se detectan al importar. Si el archivo no incluye marcadores, puedes definir rangos por tiempo; la sección se reproduce con el sintetizador integrado.
- En Guitar Pro, se detectan los marcadores de sección incluidos en la partitura. También puedes crear rangos manuales por número de compás. La repetición utiliza `playbackRange` e `isLooping` de alphaTab y permite ajustar `playbackSpeed`.
- Los marcadores personalizados quedan guardados en el almacenamiento local del navegador por canción. No se suben a GitHub ni se sincronizan automáticamente entre dispositivos.
- Un archivo MP3/WAV no contiene por sí mismo la división musical ni la tablatura; sus secciones se marcan manualmente o se usan junto con una partitura correspondiente.

## Novedades de V1.6 (ampliación educativa y de diapasón)

- **Curso ampliado a 11 módulos:** melodías tradicionales y originales, repertorio de acordes mayores/menores/séptimas, cejillas F y Bm, bends, slides, vibrato y solos extendidos.
- **Melodías para empezar:** La Cucaracha (tradicional, dominio público), Frère Jacques y una melodía arcade original de 8 bits. La melodía arcade no es una transcripción de Super Mario Bros.
- **Diapasón con propósito:** selector para estudiar notas, 27 formas de acordes y escalas pentatónicas, mayor y blues en distintas tonalidades. Los marcadores distinguen tónica, tonos del acorde/escala y dedos sugeridos.
- **Técnicas visibles en pista:** la tablatura compacta admite `~bend`, `~slide-7` y `~vibrato`; se muestra la indicación sobre la nota y se utiliza el objetivo de afinación correspondiente cuando aplica.
- **Más velocidad:** 35, 40, 50, 60, 70, 75, 80, 85, 90, 100, 110, 125, 150 y 200 %.
- **Biblioteca rock ampliada:** ejercicios originales de hard rock melódico ochentero, glam metal, blues hard rock, heavy metal clásico, NWOBHM, balada de estadio y solos/shred. Incluye referencias de escucha a las bandas indicadas por el usuario, sin copiar canciones o tablaturas protegidas.
- **Logo renovado** en SVG, para cabecera, portada e icono PWA.

## Novedades heredadas de V1.5 (archivo `escuela.js`)

- **Curso práctico:** 11 módulos y 33 lecciones (fundamentos, melodías, acordes, cejillas, técnicas expresivas y solos extendidos). Cada lección se practica en la pista y se completa con 70 % de precisión; el avance se guarda en el dispositivo.
- **Pista estilo Rocksmith:** diapasón en perspectiva con cuerdas de color, trastes numerados, cuerda, traste y dedo en cada nota, cuenta previa, metrónomo, guía sonora y velocidad del 35 al 200 %.
- **Biblioteca de rock:** 26 riffs y solos originales por estilo y nivel (blues rock, rock clásico, hard rock, punk, grunge, metal, balada, surf/rockabilly, sureño, indie). Para añadir más, agrega una línea a la lista `ROCK` de `escuela.js` con la tablatura compacta `cuerda.traste:pulsos` (cuerda 6 = grave, `+` acorde, `r` silencio).
- **Tus canciones:** en la pista, «Abrir Guitar Pro» convierte un `.gp3/.gp4/.gp5/.gpx/.gp` en notas que bajan por el diapasón.
- **Modo dos jugadores:** duelo en la misma canción con entrada propia por jugador (dos interfaces, o canal 1 y canal 2 de una estéreo), puntos, racha, precisión y ganador.
- Las lecciones, la pista y el duelo se verificaron con pruebas simuladas; la captura real del micrófono y la latencia deben probarse en tu dispositivo con HTTPS.

---


Aplicación web progresiva (PWA) en español para Windows y Android, preparada para publicarse en GitHub Pages.

## Correcciones principales de V1.4

- Reproductor MP3/WAV con botones visibles de reproducir y detener, estados de carga/reproducción y mensajes de error del decodificador del navegador.
- Reproducción MIDI con inicio explícito, parada, resaltado de notas y una síntesis electrónica de referencia. No es una grabación real de guitarra.
- Lector Guitar Pro actualizado a alphaTab 1.9.0 mediante el bundle UMD oficial de CDN, con worker/worklet y directorio de fuentes asociados al script. Los botones de reproducción solo se habilitan cuando alphaTab confirma que el motor de audio está listo.
- El modo Dúo puede reproducir MIDI, MP3/WAV y Guitar Pro en una sesión local compartida.
- Dúo local admite dos entradas de audio distintas o dos canales independientes de una interfaz estéreo. Si ambos jugadores eligen el mismo dispositivo, la aplicación intenta separar canal 1 y canal 2; si el dispositivo solo ofrece mono, muestra un error explicativo.
- Frecuencia mínima de detección ampliada para incluir notas graves de bajo.
- La práctica desde MIDI avanza automáticamente a la siguiente nota al reconocer correctamente la nota objetivo.
- El service worker ya no intercepta recursos externos del CDN ni sustituye archivos JavaScript externos por `index.html` cuando falla una descarga.

## Funciones

- Interfaz neón azul y naranja.
- Afinador cromático monofónico.
- Modo práctica con indicación de nota, cuerda, traste y dedo sugerido.
- Diapasón interactivo y lecciones básicas.
- Biblioteca con ejercicios originales de rock, hard rock y metal.
- Importación local de Guitar Pro (`.gp3`, `.gp4`, `.gp5`, `.gpx`, `.gp`), MIDI (`.mid`, `.midi`), MP3 y WAV.
- Almacenamiento de archivos en IndexedDB en el dispositivo, no en GitHub.
- Modo Dúo local: pantalla adaptable y detección de tono por entrada/canal para cada músico.

## Límites importantes (leer antes de probar)

- **MP3/WAV:** se reproducen como pista de acompañamiento. La app no extrae automáticamente la guitarra ni transforma una mezcla comercial en tablatura. Pulsa «Abrir» en la biblioteca y después «Reproducir audio».
- **MIDI:** se interpretan sus eventos de nota y tempo, se sugieren posiciones de guitarra y se reproduce una referencia sintetizada. El timbre es electrónico y no equivale a un amplificador o una guitarra grabada.
- **Guitar Pro:** el lector utiliza alphaTab 1.9.0 desde jsDelivr y necesita conexión a internet para descargar el lector, sus recursos y el SoundFont. La partitura cargada y el reproductor listo son estados distintos; el botón se habilita cuando el motor de audio está preparado. alphaTab admite Guitar Pro 3–8. Documentación: https://docs.alphatab.net/ .
- **Modo Dúo local:** ambos jugadores deben tener señales separadas. Se puede usar una interfaz por jugador, o una interfaz estéreo con canal 1 para el jugador 1 y canal 2 para el jugador 2. Dos micrófonos que capten la misma mezcla no permiten evaluar a cada persona por separado. Se recomienda usar audífonos para evitar que el sonido de los parlantes entre por los micrófonos.
- **Modo Dúo remoto:** dos dispositivos diferentes todavía no pueden emparejarse. Esa función requiere un servicio en línea para crear salas y sincronizar los dispositivos; GitHub Pages por sí solo solo aloja los archivos estáticos. El selector remoto aparece deshabilitado para no ofrecer una función que todavía no existe.
- La detección de audio es principalmente monofónica. No reconoce acordes completos ni separa instrumentos dentro de una mezcla. En Dúo se muestra la nota detectada y un recuento, no una puntuación rítmica de interpretación validada.
- Los archivos se almacenan localmente en el navegador. No se sincronizan entre Windows y Android; borrar los datos del sitio puede borrar la biblioteca.
- Límite de importación: 100 MB por archivo, sujeto a la cuota de almacenamiento que permita el navegador.

## Requisitos

- Chrome o Edge actualizado en Windows; Chrome actualizado en Android.
- HTTPS o `localhost` para usar micrófono/interfaz de audio. GitHub Pages utiliza HTTPS.
- Permisos de micrófono habilitados.
- Conexión a internet para el lector y reproducción Guitar Pro.

## Probar localmente en Windows

1. Extrae el ZIP.
2. Abre PowerShell o Terminal dentro de la carpeta que contiene `index.html`.
3. Ejecuta `py -m http.server 8000` (o `python -m http.server 8000`).
4. Abre `http://localhost:8000` en Chrome o Edge.

## Publicar/actualizar GitHub Pages

1. Extrae el ZIP.
2. Sube el **contenido** de la carpeta a la raíz del repositorio: `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, `.nojekyll`, `README.md`, `THIRD_PARTY_NOTICES.md` y `assets/`.
3. Acepta el reemplazo de los archivos anteriores y haz commit en la rama `main`.
4. En **Settings → Pages**, comprueba que la publicación use `main` y `/ (root)`.
5. Abre la URL de GitHub Pages y fuerza una recarga completa (`Ctrl + F5`). Si la app estaba instalada como PWA y sigue mostrando la versión anterior, cierra las pestañas de la app, vuelve a abrir la URL y espera a que el service worker nuevo tome el control.

## Prueba funcional después de publicar

1. **MP3/WAV:** importa un archivo pequeño que sepas que funciona, pulsa «Abrir» en la fila de biblioteca y luego «Reproducir audio». Confirma que el tiempo del reproductor avanza. Si no, revisa el mensaje de error que aparece debajo de los controles.
2. **MIDI:** importa un `.mid`, pulsa «Abrir» y «Reproducir MIDI». Debes oír la secuencia sintetizada y ver las notas resaltadas.
3. **Guitar Pro:** abre un `.gp5` conocido. Espera el estado «Reproductor listo» y después pulsa «Reproducir tablatura». Este paso requiere internet.
4. **Dúo:** entra en Modo dos jugadores, selecciona una canción, conecta primero el jugador 1 y luego el 2. Usa dos entradas físicas distintas o el canal 1 y canal 2 de una interfaz estéreo. Comprueba que cada panel muestre notas al tocar cada instrumento por separado y pulsa «Iniciar sesión compartida».
5. Prueba en Chrome de escritorio y vuelve a probar el modo adaptable en Android.

## Privacidad y licencias

Los archivos de audio y tablatura se procesan y almacenan en el navegador del usuario. No se suben automáticamente a GitHub ni a un servidor Guitar Master AI. No publiques canciones comerciales o tablaturas protegidas en un repositorio público si no tienes derechos para compartirlas. El lector Guitar Pro usa alphaTab bajo licencia MPL-2.0; consulta `THIRD_PARTY_NOTICES.md`.


## Diapasón interactivo V1.6
El selector “Acordes y posiciones” muestra formas abiertas, séptimas y cejillas, con dedos sugeridos y notas destacadas. “Escalas” permite elegir tonalidad y patrón. Puedes pulsar una nota para escucharla o usar “Escuchar selección” para oír el arpegio del acorde o la escala.
En el módulo Diapasón, elige “Notas por el mástil”, “Acordes y posiciones” o “Escalas”. En acordes, el selector muestra 27 formas y variantes abiertas, séptimas, suspendidas, power chords y cejillas; los números sobre los puntos indican dedos sugeridos. En escalas, selecciona tonalidad y tipo. Pulsa una posición para ver nota, cuerda, traste y frecuencia.

## Técnicas y tablatura compacta
En los ejercicios internos, `cuerda.traste~bend:pulsos` indica bend de un tono por defecto; `~bend-1` indica un semitono; `~slide-7` indica slide hasta el traste 7; `~vibrato` marca vibrato. En todos los casos el traste dibujado es el de ataque; la nota evaluable para bend/slide es el tono de llegada. La detección de audio sigue siendo monofónica; las técnicas son guía visual y entrenamiento de objetivo, no medición física del gesto.

## Copyright y biblioteca de estilos
La Cucaracha y Frère Jacques se usan como melodías tradicionales de dominio público. La melodía arcade es original. Los ejercicios de estilos de bandas son riffs originales que enseñan recursos generales del género; no contienen grabaciones, tablaturas ni transcripciones de éxitos comerciales. El usuario puede importar Guitar Pro/MIDI de los que tenga derecho de uso.


## Cómo practicar una canción por partes (V1.7)

1. Abre **Biblioteca de canciones** y selecciona una pista MP3/WAV, MIDI o Guitar Pro.
2. Desplázate hasta **Práctica por secciones**.
3. Elige Introducción, Estrofa, Coro, Puente, Solo, Final o Personalizada.
4. Para MP3/WAV, reproduce la canción y pulsa «Marcar inicio actual» al comenzar la parte y «Marcar final actual» al terminarla. En MIDI puedes hacer lo mismo mientras se reproduce; también puedes escribir los tiempos directamente.
5. En Guitar Pro, indica los compases inicial y final. Si el archivo contiene marcadores de sección, estos aparecen automáticamente.
6. Pulsa «Guardar sección». Luego usa «Practicar» en la parte guardada. «Repetir en bucle» activa la repetición; desmárcalo para reproducir una sola vez.
7. Ajusta la velocidad antes de pulsar «Practicar». Las secciones se guardan localmente por canción.

**Límites:** la reproducción por secciones de Guitar Pro depende de que alphaTab y su motor estén listos y de tener conexión para cargar sus recursos. En MP3/WAV, los límites son manuales: la aplicación no analiza la mezcla para adivinar dónde comienza el coro o el solo. En MIDI, la detección automática depende de que el archivo tenga eventos de texto/marker.
