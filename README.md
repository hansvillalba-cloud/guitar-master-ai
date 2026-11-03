# Guitar Master AI V1.3

Aplicación web progresiva (PWA) para aprender guitarra en Windows y Android, publicable en GitHub Pages.

## Funciones
- Interfaz en español con diseño neón azul y naranja.
- Captura de audio por micrófono o interfaz USB compatible con el navegador.
- Afinador cromático monofónico.
- Modo práctica con detección de nota, puntuación y guía de cuerda/traste/dedo.
- Diapasón interactivo de seis cuerdas y doce trastes.
- Lecciones iniciales.
- **Biblioteca Guitar Master:** tres ejercicios originales incluidos para practicar riffs de rock, hard rock y metal.
- **Práctica con MIDI:** envía las notas importadas al modo práctica para que la app indique la siguiente nota, cuerda, traste y dedo sugerido mientras escucha la guitarra.
- **Biblioteca personal local:** importa archivos desde el dispositivo, abre y elimina canciones, sin subirlas a un servidor.
- **Guitar Pro:** lector de `.gp3`, `.gp4`, `.gp5`, `.gpx` y `.gp` mediante alphaTab. Muestra la partitura/tablatura y permite reproducirla con el sintetizador.
- **MIDI:** importa `.mid` y `.midi`, interpreta las notas, su duración y tiempo; propone cuerda, traste y dedo orientativo. Incluye reproducción de referencia sintetizada.
- **Audio:** importa `.mp3` y `.wav` como pista de acompañamiento con reproductor del navegador.
- Biblioteca personal persistida en IndexedDB en el dispositivo.
- Estadísticas locales y service worker para caché de la aplicación.
- Instalable como PWA desde navegadores compatibles.

## Importación y límites
- Tamaño recomendado máximo por archivo: 40 MB.
- Guitar Pro usa alphaTab 1.9.0 desde jsDelivr. La primera lectura de tablaturas y la descarga del SoundFont requieren conexión a internet. La biblioteca de ejercicios, la importación MIDI y la reproducción de MP3/WAV no dependen de ese lector externo.
- alphaTab admite Guitar Pro 3 a 8, incluidos GPX, GP3, GP4 y GP5. Los archivos GPX/GP antiguos pueden variar según versión o contenido; si un archivo está dañado o usa una función no compatible, se mostrará un error.
- El importador MIDI lee eventos de nota y tempo. La posición de guitarra se calcula como sugerencia para afinación estándar; no equivale a una digitación profesional verificada y no conserva necesariamente la digitación de un archivo original.
- La reproducción MIDI de esta versión es una referencia electrónica sencilla, no un sonido realista de amplificador o guitarra.
- MP3/WAV se reproducen como acompañamiento. No se transcriben automáticamente a tablatura: separar y reconocer la guitarra dentro de una mezcla completa requiere un motor de análisis de audio más avanzado.
- Los archivos se guardan en IndexedDB del navegador/dispositivo. No se sincronizan entre Windows y Android y no se publican en GitHub. Borrar datos del sitio o del navegador puede borrar esta biblioteca; conserva copias de tus archivos originales.
- El modo de escucha actual reconoce principalmente notas individuales, no acordes polifónicos completos.

## Requisitos
- Chrome o Edge actualizado en Windows; Chrome en Android.
- HTTPS o localhost para usar el micrófono. GitHub Pages sirve HTTPS.
- Conexión a internet para cargar el lector Guitar Pro y su SoundFont.

## Ejecutar localmente en Windows
1. Extrae el ZIP.
2. Abre una terminal dentro de la carpeta del proyecto.
3. Ejecuta `py -m http.server 8000` (o `python -m http.server 8000`).
4. Abre `http://localhost:8000` en Chrome o Edge.

## Publicar en GitHub Pages
1. Crea un repositorio, por ejemplo `guitar-master-ai`.
2. Descomprime el ZIP y sube **todo el contenido** a la raíz del repositorio: `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, `.nojekyll` y `assets/`.
3. En **Settings → Pages**, elige **Deploy from a branch**, rama `main` y carpeta `/ (root)`.
4. Guarda y abre la URL HTTPS que GitHub Pages publique.
5. En Windows y Android, abre la misma URL. En Android puedes usar **Añadir a pantalla de inicio**.

## Componentes de terceros

El lector Guitar Pro usa alphaTab 1.9.0 bajo licencia MPL-2.0. Consulta `THIRD_PARTY_NOTICES.md` para los avisos y enlaces del proyecto.

## Privacidad y almacenamiento
Las canciones importadas se procesan localmente y se guardan en IndexedDB. No se envían a GitHub ni a un servidor de Guitar Master AI. No subas a un repositorio público canciones comerciales, tablaturas protegidas u obras sobre las que no tengas derechos.

## Próximas mejoras recomendadas
1. Sincronizar el cursor de la tablatura con la detección de la guitarra en tiempo real.
2. Editor de digitación y selección de pistas/instrumentos.
3. Reconocimiento polifónico y extracción de guitarra desde MP3/WAV.
4. Calibración de latencia y modo de práctica con secciones en bucle.
5. Sincronización opcional en la nube y empaquetado nativo para Windows/Android.


## Modo Dúo (V1.3)

- Dos jugadores en una misma canción, con pantalla adaptable (dos columnas en escritorio y jugadores apilados en móvil).
- Cada jugador puede elegir guitarra eléctrica, acústica, clásica o bajo eléctrico.
- En un mismo computador, cada jugador puede seleccionar una entrada de audio distinta; el navegador debe permitir dos capturas simultáneas y el sistema debe exponer ambas entradas.
- La detección de tono y la métrica de afinación se muestran de forma independiente para cada entrada. La métrica indica afinación de la nota detectada, no validación de la parte musical exacta.
- Las pistas MP3/WAV seleccionadas se reproducen como acompañamiento compartido y las canciones MIDI se reproducen con un sintetizador sencillo. La reproducción sincronizada de partituras Guitar Pro dentro del modo Dúo está pendiente.
- El selector «Dos dispositivos» es una interfaz preparada, pero la conexión remota real requiere un servicio de señalización/sincronización (por ejemplo, backend WebSocket/WebRTC); GitHub Pages por sí solo no lo proporciona. No está habilitada todavía.

Para probar el modo Dúo, publica la carpeta completa en GitHub Pages (HTTPS), abre «Modo dos jugadores», selecciona una canción, asigna entradas distintas a cada jugador y conecta ambos.
