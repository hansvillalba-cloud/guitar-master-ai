# Validación técnica — Guitar Master AI V1.7

## Cambios revisados
- Audio-only: `startDuo` admite MP3/WAV sin partitura y usa la duración del archivo como reloj de la sesión.
- Carga de solo audio: `initDuoView` deja vacío el selector de partitura en vez de activar el ejercicio por defecto.
- MIDI: conserva el reloj basado en AudioContext y sintetiza las notas del archivo.
- Guitar Pro: intenta el motor SoundFont de alphaTab cuando `isReadyForPlayback` ya está activo; si no inicia, crea audio sintetizado de referencia con las notas extraídas.
- Tiempos Guitar Pro: prioriza `beat.timer` (milisegundos absolutos); cuando no existe, usa `masterBar.start + beat.playbackStart` y un mapa de tempo. La unidad de `playbackStart` es ticks MIDI relativos al compás y `timer` es absoluto en milisegundos, de acuerdo con la documentación oficial de alphaTab.
- La pausa reanuda audio y AudioContext con manejo de rechazos.
- El estado de sesión comunica claramente audio solo frente a sesión con partitura.
- Service worker actualizado a V1.7.

## Pruebas realizadas
- `node --check app.js`: correcto.
- Comprobación de IDs del HTML: no hay duplicados y todos los IDs solicitados por `app.js` existen.
- Pruebas unitarias del mapa de tempo y extracción de notas desde un modelo alphaTab simulado: tiempos absolutos, tempos de cambio, cuerda, traste y digitación.
- Prueba unitaria del flujo de inicio: MP3/WAV sin partitura, MIDI con sintetizador y Guitar Pro con fallback de sintetizador.
- ZIP verificado con `unzip -t`.

## Límites
- Estas pruebas no sustituyen una prueba acústica con tus archivos e instrumentos reales.
- El modo de fallback Guitar Pro sintetiza notas individuales, no el arreglo completo con batería, bajo, efectos y articulaciones.
- MP3/WAV no puede producir tablatura por sí solo.
- La alineación de una partitura con un audio externo requiere que ambos archivos correspondan y tengan el mismo punto de inicio.
- El reconocimiento de guitarra sigue siendo monofónico por entrada.
- Se evita una lectura asíncrona de IndexedDB inmediatamente antes del inicio de audio por clic; la biblioteca se precarga al entrar/cargar archivos y el botón queda deshabilitado mientras se prepara la partitura.
