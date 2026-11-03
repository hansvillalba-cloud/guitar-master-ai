# Validación técnica — Guitar Master AI V1.6

## Cambios revisados
- Importación visible dentro de `view-duo` (Modo Rock), mediante `rockSongFiles`.
- Extensiones admitidas: GP3/GP4/GP5/GPX/GP, MIDI, MP3 y WAV.
- El manejador invoca `importSongFiles(..., {openSingleAudio:false})`, vuelve a leer los archivos importados de IndexedDB y actualiza automáticamente `duoSong` y `gameBacking`.
- Se elimina el comportamiento de abrir la pantalla de biblioteca cuando el usuario importa un MP3/WAV desde Modo Rock.
- El estado en pantalla informa si se cargó una partitura, solo audio o ambos.
- Caché PWA incrementada a `guitar-master-ai-v1-6`.

## Pruebas
- `node --check app.js`: correcto.
- IDs HTML duplicados: ninguno (130 identificadores únicos).
- Controles obligatorios `rockSongFiles`, `rockUploadStatus`, `duoSong`, `gameBacking` y `duoStartBtn`: presentes.
- Manejador directo de importación, preferencia de selección y flujo de retorno de archivos importados: presentes.
- ZIP: verificado después de crear.

## Límites conocidos
- El audio MP3/WAV aporta acompañamiento; no genera por sí solo notas, tablatura ni digitación. Se requiere MIDI o Guitar Pro para la pista visual.
- La sincronización de audio y partitura requiere que ambos archivos tengan el mismo punto de inicio y estén alineados.
- No se ha validado el resultado con los instrumentos físicos del usuario.
