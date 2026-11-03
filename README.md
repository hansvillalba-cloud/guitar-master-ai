# Guitar Master AI V1.6 · Carga directa desde Modo Rock

V1.6 corrige la ausencia de importación visible dentro de Modo Rock. Ahora puedes seleccionar archivos desde la propia pantalla de juego; no necesitas ir primero a la biblioteca.

## Qué cambia en V1.6

- Botón **Cargar canción / partitura** dentro de Modo Rock.
- Permite seleccionar uno o varios archivos: Guitar Pro (`.gp3`, `.gp4`, `.gp5`, `.gpx`, `.gp`), MIDI (`.mid`, `.midi`), MP3 y WAV.
- Los archivos se guardan en la biblioteca local del navegador (IndexedDB), no se suben a GitHub ni a un servidor.
- Al terminar la importación, el MIDI/Guitar Pro más reciente de la selección queda elegido como partitura.
- El MP3/WAV más reciente queda elegido como acompañamiento.
- El reproductor de audio ya no cambia de pantalla cuando la importación se hace desde Modo Rock.
- Se conserva la biblioteca de canciones; la opción **Abrir biblioteca** permite administrarlas o eliminarlas.
- Se incrementó la versión de caché del service worker para que GitHub Pages descargue los archivos de V1.6.

## Cómo usar la carga desde Modo Rock

1. Abre **Modo Rock**.
2. Pulsa **Cargar canción / partitura**.
3. Selecciona un archivo MIDI o Guitar Pro para obtener las notas, tiempos, pistas y posiciones.
4. Opcionalmente, en el mismo diálogo selecciona también el MP3/WAV que corresponde a esa partitura. Usa Ctrl o Shift para seleccionar varios archivos.
5. Espera el mensaje de confirmación. La partitura y el acompañamiento aparecen seleccionados en sus respectivos campos.
6. Revisa las pistas de cada jugador, conecta las entradas de audio cuando vayas a evaluar interpretación y pulsa **Iniciar canción**.

## Qué aporta cada formato

- **MIDI:** proporciona notas y tiempos para el note highway; la posición de cuerda y traste se estima en afinación estándar.
- **Guitar Pro:** permite extraer notas, cuerdas, trastes y tiempos cuando el formato y la pista son compatibles. El lector y el SoundFont se cargan desde alphaTab CDN, por lo que se requiere internet.
- **MP3/WAV:** se reproduce como acompañamiento. No contiene datos de tablatura por sí mismo; para que aparezcan notas en el juego debe cargarse también su MIDI o Guitar Pro correspondiente.

## Publicar en GitHub Pages

1. Extrae el ZIP de V1.6.
2. Sube el contenido completo a la raíz de tu repositorio, reemplazando `index.html`, `app.js`, `styles.css`, `sw.js` y demás archivos. Conserva `assets/` y `.nojekyll`.
3. Haz commit en la rama `main`.
4. Espera a que GitHub Pages termine el despliegue.
5. Abre el sitio y recarga con `Ctrl + F5`. La caché nueva del service worker se llama `guitar-master-ai-v1-6`.

## Verificación realizada

- `node --check app.js` sin errores de sintaxis.
- Comprobación de IDs HTML: no hay IDs duplicados.
- Comprobación estática de los controles y manejadores de importación desde Modo Rock.
- Verificación de que el importador devuelve los identificadores creados y puede evitar la apertura del reproductor de biblioteca cuando se carga desde Modo Rock.
- El ZIP se crea desde la raíz del proyecto y se vuelve a abrir para verificar su contenido.

La prueba local de carga de archivos reales depende del navegador y de los archivos que selecciones. El MP3/WAV no se convierte automáticamente en tablatura.
