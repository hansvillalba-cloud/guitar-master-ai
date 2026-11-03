# Guitar Master AI V1.5 · Rock Engine

Aplicación web progresiva (PWA) en español para Windows y Android. Preparada para GitHub Pages.

## Qué cambia en V1.5

La experiencia de práctica se reorganiza como un juego musical tipo *note highway*: las notas se desplazan hacia una línea de ejecución, por carriles de cuerda, con el traste y el dedo sugerido visibles. El reloj de canción mantiene sincronizadas las dos pistas.

- Modo Rock / dos jugadores en un mismo computador.
- Dos carriles independientes, azul para el jugador 1 y naranja para el jugador 2.
- Cada jugador selecciona instrumento (guitarra eléctrica, acústica, clásica o bajo), entrada de audio, canal y pista de la partitura.
- Pantalla adaptable: dos columnas en escritorio y paneles apilados en pantallas estrechas.
- Reproducción sintetizada de MIDI y reproducción de Guitar Pro mediante alphaTab.
- MP3/WAV opcional como acompañamiento sincronizado con la partitura MIDI/GP.
- Evaluación de notas individuales por coincidencia de tono y proximidad temporal a la línea de ejecución.
- Controles de iniciar, pausar, continuar y detener; velocidad de reproducción.

## Cómo jugar

1. Abre Modo Rock.
2. Selecciona una partitura MIDI o Guitar Pro. La aplicación incluye el ejercicio «Riff inicial en Mi» para probar el motor sin importar archivos.
3. Para usar una canción propia, importa primero un archivo MIDI o Guitar Pro desde la biblioteca.
4. Selecciona la pista que tocará cada jugador. Si el MIDI solo tiene una pista instrumental, ambos pueden seleccionar esa misma pista para practicarla o dividirse el trabajo con archivos que tengan pistas separadas.
5. Opcionalmente selecciona un MP3/WAV como acompañamiento. Debe corresponder a la partitura y comenzar en el mismo punto; la app no alinea automáticamente grabaciones.
6. Conecta cada guitarra a una entrada distinta. En una interfaz estéreo compartida, elige el canal 1 para un jugador y el canal 2 para el otro.
7. Pulsa «Iniciar canción». También se puede iniciar la vista previa sin micrófonos, pero no se contabilizarán ejecuciones.

## Importación de canciones

- **MIDI (`.mid`, `.midi`):** proporciona las notas, pistas y tiempos para dibujar la pista y generar una referencia de audio sintetizada.
- **Guitar Pro (`.gp3`, `.gp4`, `.gp5`, `.gpx`, `.gp`):** alphaTab lee la tablatura y aporta las notas, cuerdas, trastes y tiempos. Requiere conexión a internet para cargar alphaTab y su SoundFont desde CDN.
- **MP3/WAV:** solo sirve como audio de acompañamiento. Por sí solo no contiene una tablatura utilizable por el motor; debe asociarse con una partitura MIDI o Guitar Pro.

## Conexiones de audio y multijugador

- La modalidad local de dos jugadores requiere dos entradas físicas independientes o dos canales separados de una interfaz estéreo.
- No conectes dos jugadores al mismo micrófono mono. La aplicación valida dispositivo/canal e informa cuando no puede separar las señales.
- Dos micrófonos que capten la misma mezcla ambiental no permiten identificar qué persona tocó cada nota. Para mejores resultados usa entradas directas e independientes y audífonos.
- **Dos dispositivos diferentes todavía no pueden emparejarse.** La opción remota está deshabilitada porque requiere un servicio de emparejamiento y sincronización; GitHub Pages por sí solo aloja archivos estáticos.

## Límites actuales

- La detección de ejecución es monofónica: comprueba notas individuales, no acordes completos.
- No separa guitarra, bajo, voz y batería de una mezcla MP3/WAV.
- La digitación para notas MIDI se calcula como una posición sugerida; las tablaturas Guitar Pro pueden proporcionar digitación explícita.
- La puntuación evalúa tono y ventana temporal; todavía no mide técnicas avanzadas como bends, slides, vibrato, palm mute o duración exacta de cada nota.
- La sincronización de un MP3/WAV con la tablatura depende de que ambos archivos estén alineados desde el mismo inicio y de que el tempo corresponda.
- El rendimiento y la latencia dependen de la interfaz, controlador, navegador y computador. Deben calibrarse con el instrumento real.
- La biblioteca se guarda localmente en el navegador. No se sincroniza automáticamente entre dispositivos.

## Requisitos

- Chrome o Edge actualizado en Windows; Chrome actualizado en Android.
- HTTPS o `localhost` para acceder al micrófono/interfaz de audio. GitHub Pages utiliza HTTPS.
- Permisos de micrófono concedidos.
- Conexión a internet para el lector Guitar Pro (alphaTab y SoundFont).

## Publicar o actualizar en GitHub Pages

1. Descarga y extrae el ZIP de V1.5.
2. Sube el **contenido** de la carpeta a la raíz del repositorio, reemplazando los archivos anteriores: `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, `.nojekyll`, los archivos README/licencias y la carpeta `assets/`.
3. Confirma los cambios en la rama `main`.
4. En **Settings → Pages**, comprueba que la fuente sea `main` y la carpeta `/ (root)`.
5. Abre la dirección de GitHub Pages y fuerza una recarga con `Ctrl + F5`. Si estaba instalada como PWA, cierra la ventana instalada y vuelve a abrir el sitio para que se active el nuevo service worker.

## Verificación

La versión distribuida pasó `node --check`, comprobación de identificadores HTML duplicados y referencias estáticas a controles, prueba del parser MIDI y del cálculo de posición de notas, y prueba del ZIP. También se automatizó una comprobación en navegador con el ejercicio incorporado: se inició el reloj, se dibujaron los carriles de notas, avanzó la animación y los controles de pausa/continuación respondieron sin errores JavaScript. Esto verifica la vista previa y el motor visual; **no sustituye la prueba con guitarras e interfaces físicas**, que depende del equipo del usuario.

## Privacidad y licencias

Los archivos importados se procesan y almacenan en el navegador del usuario; no se envían automáticamente a un servidor de Guitar Master AI ni se suben a GitHub. No publiques canciones comerciales o tablaturas protegidas en un repositorio público si no tienes derechos para compartirlas. El lector Guitar Pro utiliza alphaTab bajo licencia MPL-2.0; consulta `THIRD_PARTY_NOTICES.md`.
