# GAME QUIZ — Canal para Roku / TV

Canal nativo (BrightScript / SceneGraph) que muestra el juego en la TV. El
teléfono sigue siendo el control: la TV muestra la sala, el QR, las preguntas
y el marcador.

## Menú
Solo hay dos entradas y cada una abre todos sus juegos:

- **🎮 Multijugador** — Súper Trivia (trivia nativa en la TV), Karaoke,
  Incógnito, Dibuja y Adivina, ¿Quién será?
- **🎯 Un jugador** — Trivia-Quiz, Cruci-Quiz, Mini-juegos

## Se actualiza solo
El menú **no está fijo en el código**: se lee en vivo desde
`data/tv.json` de la app web (GitHub Pages). Para agregar/quitar juegos del
menú de la TV basta con editar ese archivo en la web — la TV lo toma la
próxima vez que se abre el canal, **sin reinstalar nada**.

Cada juego del menú tiene un `kind`:
- `trivia` → se juega en la TV (preguntas y marcador en pantalla).
- `cruci` / `minis` → juegos individuales nativos en la TV.
- `companion` → se juega en el teléfono; la TV muestra un **QR** que abre
  ese juego directo (usa el mismo enlace `?j=...` de la web). Así, cualquier
  juego nuevo del teléfono aparece en la TV como QR sin tocar el código Roku.

> Nota: Roku no puede ejecutar el JavaScript de la web, por eso los juegos
> que viven en el teléfono se muestran como QR (companion). La trivia, el
> crucigrama y los mini-juegos sí corren nativos en la TV.

## Instalar (sideload en modo desarrollador)
1. En el Roku: **Inicio ×3, Arriba ×2, Der, Izq, Der, Izq, Der** para abrir
   el *Developer Settings*; activa el modo desarrollador y anota la IP.
2. Empaqueta esta carpeta en un `.zip` (con `manifest` en la raíz del zip):
   `zip -r GameQuizRoku.zip manifest source components images`
3. Abre `http://IP-DE-TU-ROKU/` en el navegador y sube el `.zip`.

## Configuración
`source/config.brs` tiene la URL de Supabase y de la app web
(`https://geocam25.github.io/GameQuiz/`). El resto (menú, título, subtítulo)
se toma de `data/tv.json`.
