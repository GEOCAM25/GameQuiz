# Game Quiz · Party Studio 4.0

Juegos para hasta **30 participantes**, personajes 3D personalizables y 2.100 preguntas nuevas. Incluye Cruci Quiz Chile, minigolf, impostor, bingo y bachillerato. Los juegos originales siguen disponibles en **Explorar clásicos**.

## Empezar

1. Descomprime toda la carpeta.
2. Instala Node.js 22 o superior.
3. Abre `INICIAR-WINDOWS.bat` o `INICIAR-MAC.command`. También puedes ejecutar `npm start` desde esta carpeta.
4. Abre **http://localhost:3000** y deja el servidor encendido.

No requiere `npm install`. No abras `index.html` directamente: los módulos y bancos necesitan HTTP.

## Jugar desde varios teléfonos

En la misma Wi-Fi, cada persona abre la dirección de red que imprime el servidor, por ejemplo `http://192.168.1.20:3000`. `localhost` solo sirve en el equipo que ejecuta el servidor. Crea una sala, comparte el código de cinco caracteres y espera a que los invitados marquen **Estoy listo**. La capacidad se comprueba en el servidor, incluidos ingresos simultáneos.

Para jugar desde lugares distintos necesitas alojar este servidor Node en internet con HTTPS. Acepta `PORT`, escucha en `0.0.0.0` y utiliza SSE; el proxy debe permitir conexiones largas sin búfer. Esta entrega contiene el proyecto, **no una URL pública desplegada**. GitHub Pages permite los modos locales, pero no ejecuta las salas nuevas.

Las salas viven en la memoria de un solo proceso. Reiniciar el servidor borra las salas; no uses varias réplicas independientes. Recargar la misma pestaña recupera su sesión mientras la sala exista. El anfitrión se puede transferir y cambia si pierde su conexión. No se necesita crear cuentas.

## Colección

| Juego | Qué ofrece |
|---|---|
| Cruci Quiz Chile | 20 niveles, 127 pistas diferentes, palabras cruzadas y una palabra vertical. Progreso, pistas y niveles desbloqueados guardados en este navegador. |
| Bingo del club | Cartón privado de 15 números, 90 bolitas, marcas reversibles y premios verificados. |
| Bachillerato STOP | Seis categorías, revisión del grupo, cinco rondas iniciales y ampliaciones de tres. |
| Minigolf del club | Ocho circuitos con física de rebotes, dirección y potencia, hasta ocho golpes y 90 segundos por hoyo. |
| Impostor | Roles privados, pistas, votación y último intento; un teléfono compartido o un dispositivo por persona. |
| Color contrarreloj | Identifica el color de tinta sin dejarte distraer por la palabra. |
| Balanza mental | Completa igualdades y operaciones. |
| Súper Trivia | 14 bancos nuevos de 150 preguntas más las categorías originales. |
| Party Mix | Alterna seis retos de trivia, cálculo, memoria, palabras, lógica y reflejos. |
| Órbita numérica / Memoria 3D / Word Lab / Código lógico / Reflejo flash | Dificultad ajustable y explicaciones; práctica o sala. |
| Karaoke Studio | Cola compartida, escenario del anfitrión, YouTube, pistas locales con letras LRC y calentamiento. |

Cruci Quiz tiene arte e interfaz propios. Su avance es local: utiliza el mismo navegador y dirección; borrar datos del sitio elimina el guardado. No necesita una cuenta ni una sala. Tras cargar los recursos en localhost o HTTPS, los juegos individuales pueden funcionar sin conexión mediante el service worker.

## Impostor

En su tarjeta elige **Un teléfono para todos** o **Crear sala para el grupo**. Participan entre 3 y 30 personas. Se asigna un impostor con 3–8, dos con 9–16 y tres con 17–30.

- Teléfono compartido: escribe los nombres y pásalo en cada turno. La persona confirma que lo tiene, descubre su rol y lo oculta antes de pasarlo. Pistas y votos también se entregan por turno, sin límite automático para poder pasarlo con calma.
- Varios teléfonos: cada participante recibe únicamente su rol y, si es detective, la palabra. Hay 15 segundos para consultar el rol, 60 para pistas, 45 para votar y 20 para el último intento de los impostores descubiertos.
- 800 puntos por victoria del equipo y 200 adicionales para detectives que votaron a un impostor. Un empate en el corte de sospechosos favorece a los impostores.
- Si alguien abandona explícitamente una ronda en curso, se anula sin puntos nuevos. Con menos de tres participantes termina la partida. Una desconexión temporal permite reconectar.

## Bachillerato: reglas exactas

Categorías: **nombre o apellido, país o ciudad, fruta o verdura, color o cosa, animal o ave, marca o TV**.

La letra se sortea entre las permitidas. Marca en ajustes las letras que no quieres; debe quedar al menos una. Se evita repetir hasta agotar las disponibles. Empieza con **5 rondas** de **60 segundos**.

**No sé** conserva el texto, bloquea esa casilla y le da cero puntos; vuelve a tocar para responder. Se puede revertir también en revisión. **STOP** solo se habilita con las seis respuestas escritas, con la inicial correcta y sin «No sé». El primer STOP deja hasta **10 segundos**, sin superar el minuto original.

Después, todos ven las respuestas y pueden aceptar o rechazar las del resto, categoría por categoría. Nadie vota su propia respuesta. **Aceptar pendientes y terminar** acepta las respuestas aún no revisadas. El anfitrión calcula cuando el grupo termina; la revisión se cierra automáticamente tras 90 segundos. En el cierre automático, una respuesta sin votos negativos suficientes se conserva. Se rechaza cuando hay más negativos que positivos y al menos la mitad de los demás participantes votó en contra; un empate conserva la respuesta.

- Válida y única: **100 puntos**.
- Válida repetida entre dos o más: **50 puntos** para cada uno. Se normalizan mayúsculas, tildes y espacios; la ñ se conserva.
- Vacía, «No sé», inicial incorrecta o rechazada: **0 puntos**.
- Si hay al menos una casilla vacía o «No sé» en esa categoría: **+10 puntos una sola vez** a cada respuesta válida de los demás. Dos ausencias no dan +20. Una respuesta rechazada pero escrita no activa ese bono.

Ejemplo: cinco jugadores, dos sin respuesta y tres respuestas únicas válidas → **110, 110, 110, 0, 0** en esa categoría. Si dos de las válidas se repiten → **60, 60, 110, 0, 0**.

Se muestran los puntos de cada categoría, ronda y total. Después de cinco rondas, el anfitrión puede elegir **Jugar 3 rondas más** tantas veces como quieran; los puntos se mantienen. Salir termina la participación sin obligar a otra ampliación.

## Bingo

El anfitrión saca una bolita cada vez, con dos segundos mínimos entre sorteos. Todos ven los números sorteados; cada persona ve su propio cartón. Solo se pueden marcar números del cartón que ya hayan salido, y tocarlos otra vez los desmarca. La primera línea correcta da **300** puntos; el primer bingo correcto da **1.000** y termina la partida. El servidor comprueba ambas reclamaciones.

## Quiz y contenido

Cada uno de estos bancos trae **150 preguntas**, con cuatro opciones, solución y explicación:

Chile; One Piece; Rápido y Furioso; Los Simpsons; Harry Potter; gastronomía; Completa la letra y la canción; Stranger Things; cuerpo humano; Juego de Tronos / Casa del Dragón; memes de internet y Chile; comerciales chilenos; telenovelas; dinosaurios y prehistoria.

Son 2.100 preguntas distintas, organizadas en varias preguntas por personaje, lugar, obra o concepto. Los otros 2.749 registros de los bancos originales se mantienen. Hay ilustraciones ambientales originales en algunas preguntas de todas las categorías; representan el tema general, no la respuesta.

**Completa la letra y la canción** mezcla fragmentos breves o títulos incompletos, intérpretes y comprensión de canciones: no son 150 letras extensas ni incluye grabaciones comerciales. Predominan canciones en español. Comerciales mezcla campañas catalogadas y reconocimiento de marcas/productos. Telenovelas recoge producciones conocidas en Chile, no un ranking certificado de audiencia. Consulta `docs/CONTENIDO.md` para alcances y fuentes.

En trivia: **800** por acierto, hasta **150** por rapidez y hasta **150** por racha. El error da cero y reinicia la racha. El desglose aparece después de revelar la solución. El cliente no puede enviar una cifra de puntos para otorgársela.

## Personajes, sala, chat y sonido

40 personajes procedurales en 3D, ocho colores, seis vestuarios y accesorios. Una sala reserva un personaje diferente para cada participante; si el elegido está ocupado, asigna uno libre conservando ropa y color. Se puede bailar, saludar, saltar o girar en la sala de espera y cámara de puntos. Hay alternativa visual si WebGL no está disponible y un control de movimiento reducido.

El chat permanece disponible durante la partida, permite respuestas y reacciones, y el anfitrión puede eliminar mensajes o pausar el chat de un participante. En la sala, **Sticker** bajo otra persona abre el selector: solo emisor y destinatario reciben ese mensaje. Las respuestas a ese sticker siguen siendo privadas. Al empezar la partida se pliega el chat para dejar libres los controles.

**No hay música ambiental ni carpeta Music.** Solo efectos locales de botones, cuenta regresiva, aciertos, golpes y victoria. Cada dispositivo controla efectos y volumen; los stickers y mensajes no activan sonido remoto. Los efectos clásicos de ganador de `audio/` se conservan y se reproducen localmente. La reproducción de karaoke es una acción explícita, separada de estos efectos.

## Karaoke y clásicos

Karaoke permite una cola de hasta 50 solicitudes, tres pendientes por persona, reordenación y avance del anfitrión. El anfitrión reproduce el escenario; los invitados no reciben audio reproducido automáticamente. YouTube requiere internet y que el video permita inserción. También puedes abrir un archivo de audio propio con letra `.lrc`, ajustar el desfase, tamaño de texto y usar el micrófono como medidor. No evalúa profesionalmente la afinación; el micrófono requiere permiso y HTTPS o localhost.

`classic.html` conserva los juegos anteriores y su conexión Supabase. Para su capacidad de 30 aplica **supabase-capacity-30.sql** después del esquema original en tu base de datos. Esta migración no se ha ejecutado remotamente. Las salas de Party Studio usan el servidor Node y no requieren Supabase. Los nuevos personajes y modos corresponden a Party Studio.

## Desarrollo y verificación

Ejecuta `npm test`. Los bancos nuevos se regeneran con `python3 tools/build-banks.py` a partir de las especificaciones finales de `tools/banks/`. Las preguntas de Cruci Quiz están en `data/cruci-chile.json` y su repertorio de palabras en `tools/cruci-words.txt`.

Consulta `docs/VERIFICACION.md`: pruebas de motor/API, 30 clientes HTTP, banco de contenidos y navegación real en Chromium. No se ha realizado una prueba con 30 teléfonos físicos ni desplegado un servidor público. Los clásicos externos, dispositivos Roku y la reproducción real de YouTube/micrófono requieren comprobación en el entorno donde se use el juego.
