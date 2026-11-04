# Guitar Master AI V1.6 — Validación del paquete

## Base
Esta versión parte del archivo `GuitarMasterAI_V15.zip` que compartió el usuario. Se conservaron los módulos originales de práctica, biblioteca, importación, pista, afinador y modo Dúo; los cambios se aplicaron sobre esa base.

## Cambios incorporados
- Curso ampliado a **11 módulos y 33 lecciones**.
- En «Primeras melodías»: **La Cucaracha** y **Frère Jacques** (melodías tradicionales), además de una melodía arcade de 8 bits original. La pieza arcade no reproduce la melodía de Super Mario Bros.
- Módulo «Aprende los acordes esenciales» con formas mayores, menores, séptimas, suspendidas, power chord y cejillas; el diapasón permite elegir entre **27 formas/voicings**.
- Módulos de cejilla F/Bm, bends, slides, vibrato y solos extendidos.
- Biblioteca ampliada a **26 riffs y solos originales** que cubren hard rock melódico ochentero, glam metal, blues hard rock, heavy metal clásico, NWOBHM, balada hard rock y shred.
- Diapasón con modos de notas, acordes y escalas; incluye selección de tonalidad, explicación de notas, dedos sugeridos y previsualización sonora con Web Audio.
- Control de velocidad en 14 niveles desde 35 % hasta 200 %.
- Logo e icono PWA rediseñados en SVG.

## Pruebas realizadas
- `node --check app.js`: correcto.
- `node --check escuela.js`: correcto.
- Parser de tablaturas ejecutado contra las 33 lecciones y 26 ejercicios de rock: **0 fallos de análisis**, todos producen notas y tiempos numéricos válidos.
- Marcadores de técnica: prueba de bend, slide y vibrato genera notas objetivo y rótulos esperados.
- Selector del diapasón: 27 opciones HTML y 27 definiciones JavaScript coinciden; todas las formas tienen seis posiciones y dedos en rango.
- HTML: no se encontraron identificadores estáticos duplicados ni referencias locales ausentes.
- `assets/logo.svg` y `assets/icon.svg`: XML/SVG válidos.
- ZIP: prueba de integridad después de empaquetar.

## Límites que deben probarse en el equipo del usuario
- La captura de guitarra/micrófono, latencia y audio del navegador necesitan una prueba real en Chrome o Edge, con HTTPS o localhost; no se han validado con su guitarra física en esta sesión.
- El reconocimiento de notas continúa siendo principalmente monofónico. No se debe interpretar como reconocimiento polifónico completo de acordes.
- En la pista, bend y slide muestran el gesto y el tono objetivo; el detector comprueba la altura alcanzada, pero no puede observar físicamente la técnica de la mano. Vibrato se muestra como indicación y se evalúa alrededor de la nota base, no mide la calidad biomecánica del movimiento.
- Los ejercicios de estilo de las bandas citadas son originales y no incluyen sus éxitos, grabaciones ni tablaturas comerciales. Se pueden importar archivos propios cuando el usuario tenga derecho a utilizarlos.
- No se hizo una prueba completa de extremo a extremo en un navegador gráfico durante esta ejecución. Las validaciones descritas son de código, estructura y datos.
