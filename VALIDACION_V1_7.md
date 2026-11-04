# Guitar Master AI V1.7 — validación de práctica por secciones

## Cambios incorporados

- Panel «Práctica por secciones» dentro del reproductor de cada canción.
- Secciones sugeridas: Introducción, Estrofa 1, Coro, Estrofa 2, Puente, Solo y Final; también admite un nombre personalizado.
- Marcado de inicio y final desde la posición actual del reproductor, además de edición manual de límites.
- Reproducción de una sola pasada o en bucle.
- Velocidad seleccionable entre 40 % y 200 %.
- Guardado local de secciones por canción mediante `localStorage`.
- MP3/WAV: bucle y recorte por segundos sobre la pista de audio.
- MIDI: detecta eventos meta de marcador/texto si el archivo los contiene; permite crear secciones manuales en segundos y sintetiza solo las notas del rango elegido.
- Guitar Pro: detecta marcadores de sección de alphaTab; permite definir rangos por compases y utiliza `playbackRange`, `isLooping` y `playbackSpeed` del reproductor.
- Actualización de caché del service worker a `guitar-master-ai-v1-7`.

## Pruebas ejecutadas

- `node --check app.js`: correcto.
- `node --check escuela.js`: correcto.
- HTML: 139 identificadores comprobados; no hay IDs duplicados.
- Referencias de DOM de `app.js`: todas las referencias literales `$()` tienen un elemento correspondiente.
- MIDI de prueba sintético: se importaron 2 notas y los marcadores `Intro` y `Coro`; ambos se convirtieron en rangos de tiempo correctos.
- Guitar Pro con modelo de compases simulado: dos marcadores (`Intro` y `Solo`) se convirtieron en rangos correctos; el rango manual de compases 2–4 se convirtió a ticks 480–1920.
- ZIP: se comprueba después de su creación con `unzip -t`.

## Límites y prueba pendiente

- Los límites de una canción MP3/WAV se marcan manualmente. El sistema no adivina automáticamente dónde empieza el coro, puente o solo a partir de una mezcla de audio.
- Los marcadores MIDI se detectan solo si el archivo contiene eventos meta de texto/marker. Si no los contiene, los límites se introducen manualmente.
- Los marcadores Guitar Pro se detectan si están guardados en el archivo. Si no existen, el usuario puede seleccionar compases inicial y final.
- La prueba con archivos reales en Chrome/Edge y con interfaz de audio física debe hacerse en el equipo del usuario. Las pruebas ejecutadas aquí cubren sintaxis, estructura y conversión de rangos, no la calidad acústica ni latencia de su equipo.

## Referencias técnicas de alphaTab

- `playbackRange`: https://docs.alphatab.net/docs/reference/api/playbackrange
- Loop de secciones: https://next.alphatab.net/docs/features/play-sync/looping-a-section
- Posición y búsqueda por ticks/tiempo: https://www.alphatab.net/docs/features/play-sync/seeking-by-tick-and-time
- Marcadores de sección: https://www.alphatab.net/docs/reference/types/model/section/
