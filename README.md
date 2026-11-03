# Guitar Master AI V1.7 · Inicio de reproducción corregido

## Qué se corrigió
- Modo Rock puede reproducir MP3/WAV aunque todavía no haya una partitura cargada (modo acompañamiento).
- Al cargar solo un MP3/WAV ya no se selecciona por error el ejercicio incorporado como si fuera la tablatura de esa canción.
- MIDI se reproduce con el sintetizador Web Audio y anima la pista de notas.
- Guitar Pro usa el reproductor SoundFont de alphaTab cuando está listo; si no está listo o no puede arrancar, usa un sintetizador de referencia de las notas extraídas para que la partida no se quede bloqueada.
- Se corrigió el cálculo de tiempos Guitar Pro: los tiempos relativos del beat se combinan con el inicio absoluto del compás; los cambios de tempo se tienen en cuenta en la conversión de ticks a milisegundos.
- El botón Iniciar muestra el motivo del error en el panel de estado y deja reintentar.
- La pausa/continuación gestiona los errores de reproducción.

## Cómo usar
1. Abre Modo Rock.
2. Pulsa Cargar canción / partitura.
3. Selecciona MIDI o Guitar Pro para la pista de notas. Puedes seleccionar también el MP3/WAV original para usarlo como audio principal.
4. Espera a que el estado indique que la canción está preparada.
5. Pulsa Iniciar canción. No es obligatorio conectar los micrófonos para escuchar la reproducción y ver las notas.
6. Conecta una entrada de audio por jugador solo cuando quieras que la aplicación evalúe lo que tocas.

## Importante
- MP3/WAV solo: reproduce el audio, pero no puede generar la partitura, las notas o la digitación.
- MIDI: reproduce notas mediante un sintetizador de referencia; no reproduce el arreglo de banda completo.
- Guitar Pro: reproduce su SoundFont cuando alphaTab está disponible; si no, se usa una referencia sintetizada de las notas de la pista. Esta alternativa no reproduce batería, efectos, articulaciones ni todos los instrumentos del archivo.
- Para tocar siguiendo la canción original, importa tanto la tablatura MIDI/Guitar Pro como el MP3/WAV correspondiente y verifica que estén alineados desde el mismo punto.
- Para la detección de guitarra se necesita HTTPS (GitHub Pages) y permiso de micrófono.
- Dos dispositivos remotos siguen necesitando un servidor de emparejamiento.

## Publicación en GitHub Pages
Reemplaza el contenido del repositorio con todos los archivos de este paquete, conservando `assets/` y `.nojekyll`. Haz commit en `main` y recarga GitHub Pages con Ctrl+F5. La caché cambia a `guitar-master-ai-v1-7`.
