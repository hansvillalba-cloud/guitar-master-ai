# Validación técnica — Guitar Master AI V1.5

## Pruebas realizadas

- `node --check app.js`: correcto.
- ZIP: `unzip -t`: correcto, sin errores de compresión.
- HTML: 128 identificadores revisados; no hay IDs duplicados.
- Referencias estáticas `$()` de `app.js`: todos los IDs referenciados están presentes en `index.html`.
- Parser MIDI y función de posición de cuerda/traste: prueba con eventos de ejemplo; correcto.
- Extracción de notas Guitar Pro: prueba con modelo alphaTab simulado; extrajo tiempos, tono, cuerda, traste y digitación de ejemplo.
- Prueba automatizada en navegador con el riff incorporado: el modo de juego inicia, el reloj avanza, el canvas dibuja los carriles, y pausa/continuación funcionan sin errores JavaScript en la prueba.

## Alcance que no se debe sobreinterpretar

- La prueba de navegador se realizó en vista previa con el ejercicio incorporado; no fue una prueba con guitarras físicas ni interfaces externas del usuario.
- La captura real de audio, los permisos de micrófono, la latencia y la separación de dos entradas deben verificarse con el equipo concreto del usuario.
- La evaluación actual es monofónica y basada en coincidencia de tono más ventana temporal. No valida acordes, bends, slides, vibrato, palm mute ni separación de instrumentos de una mezcla.
- MP3/WAV funciona como acompañamiento, no como fuente de notas/tabulatura. Se requiere una partitura MIDI o Guitar Pro correspondiente y alineada.
- El multijugador local está implementado para dos señales físicas separadas o dos canales de una interfaz compatible. El modo de dos dispositivos diferentes requiere un servidor de emparejamiento y no está habilitado en esta versión.
