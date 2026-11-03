# Validación técnica — Guitar Master AI V1.4

## Comprobaciones ejecutadas

- Sintaxis JavaScript (`node --check app.js`): correcta.
- Integridad estática del HTML: 109 identificadores, sin IDs duplicados y sin referencias estáticas `$("id")` faltantes.
- Prueba del detector monofónico con señales sintéticas: 41,2 Hz, 82,4 Hz, 110 Hz y 440 Hz recuperadas correctamente (aprox. ±0,1 Hz en esta prueba).
- Prueba del lector MIDI con un archivo de control: detectó una nota C4 con 250 ms de duración y calculó una posición de guitarra.
- Service worker: versión de caché incrementada a V1.4 y exclusión de recursos CDN externos verificada por inspección del código.

## Pruebas que aún deben realizarse en el dispositivo de destino

No se ha podido validar en esta ejecución el acceso real a micrófonos/interfaz USB ni la reproducción con los parlantes del computador. Debe probarse en la URL HTTPS de GitHub Pages con Chrome o Edge.

1. Importar un MP3/WAV, abrirlo y confirmar que el tiempo avanza al pulsar «Reproducir audio».
2. Abrir un MIDI y pulsar «Reproducir MIDI»; debe oírse una referencia sintetizada y resaltarse la nota activa.
3. Abrir un Guitar Pro con internet; esperar «Reproductor listo» antes de pulsar reproducir.
4. Probar dos entradas USB independientes, o una interfaz estéreo con canal 1 y canal 2 separados.
5. Probar el detector con una cuerda individual a volumen suficiente y con audífonos para evitar realimentación.

## Límites que permanecen

- MP3/WAV no se transcriben a tablatura ni se separa automáticamente la guitarra de una mezcla.
- El detector es monofónico; no verifica acordes completos ni la ejecución rítmica exacta.
- El multijugador entre dos dispositivos diferentes necesita un backend de salas/sincronización y no está habilitado todavía. La modalidad local sí tiene conexión de dos entradas/canales.
