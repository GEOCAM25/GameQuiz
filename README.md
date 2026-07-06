# 🎲 GAME QUIZ

Trivia multijugador en tiempo real, estilo Kahoot, para hasta **15 jugadores**. PWA lista para GitHub Pages y para empaquetar como APK.

## 🚀 Puesta en marcha (3 pasos)

### 1) Base de datos (Supabase — gratis)
1. Crea una cuenta y un proyecto nuevo en https://supabase.com
2. En el menú lateral entra a **SQL Editor** → New query
3. Copia y pega **todo** el contenido de `supabase-setup.sql` y presiona **Run**
4. Ve a **Settings → API** y copia dos cosas: **Project URL** y **anon public key**

### 2) Conectar el juego
Abre `js/config.js` y reemplaza:
```js
const SUPABASE_URL = "PEGA_AQUI_TU_URL";
const SUPABASE_ANON_KEY = "PEGA_AQUI_TU_ANON_KEY";
```

### 3) Publicar en GitHub Pages
1. Crea un repositorio en GitHub y sube **todos** estos archivos
2. Repo → **Settings → Pages**
3. En *Source* elige **Deploy from a branch** → rama `main` → carpeta `/root` → Save
4. En un par de minutos tu juego estará en `https://TU_USUARIO.github.io/NOMBRE_REPO/`

¡Listo! Comparte el link y el código de sala con tus amigos.

## 🧪 Probar sin configurar nada
Entra a la sala secreta **ZZZX** (modo solitario). Sirve para probar el juego solo, sin invitar a nadie. No necesita Supabase.

## 📱 Instalar como app (APK)
1. Publica primero en GitHub Pages (necesitas el link https)
2. Entra a https://www.pwabuilder.com y pega tu link
3. Descarga el paquete **Android** → genera el `.apk` / `.aab`
4. En iPhone: abre el link en Safari → Compartir → **Agregar a inicio**

## 🎮 Cómo se juega
- **Crear sala**: obtienes un código de 4 letras. Eres el anfitrión 👑
- **Entrar a sala**: escribe el código de 4 letras y elige tu personaje
- Mínimo **2 jugadores** para iniciar (máx 15)
- El anfitrión elige: cantidad de preguntas (10/20/30), quién elige categoría (solo él o votación 🗳️) y si el chat filtra groserías
- 40 segundos por pregunta, 4 alternativas estilo Kahoot
- **Puntos**: 1° en responder +60, 2° +50, 3° +42, 4° en adelante +35 (más la mitad de los segundos que sobraron). Responder mal también da +15 de participación, para que los puntajes no queden tan separados
- Podio final con 🥇🥈🥉 y fuegos artificiales

## ✨ Funciones incluidas
- Salas en tiempo real (Supabase Realtime)
- 18 categorías · **540 preguntas** listas (ampliables)
- Cuenta regresiva, timer con colores, revelación de respuesta y marcador entre rondas
- Chat con **stickers**, filtro de groserías y bloqueo de jugadores
- Reconexión: si te sales, puedes volver a entrar
- Aviso cuando alguien pierde internet o abandona
- Vibración y sonidos sintetizados (sin archivos pesados)
- Modo prueba ZZZX en solitario

## 📂 Estructura
```
game-quiz/
├── index.html
├── manifest.json
├── sw.js
├── supabase-setup.sql
├── css/style.css
├── js/config.js   ← tus llaves y ajustes van aquí
├── js/audio.js
├── js/app.js
├── data/*.json    ← una categoría por archivo (agrega más preguntas aquí)
└── icons/
```

## ➕ Cómo agregar más preguntas
Abre cualquier archivo en `data/`. Cada pregunta es:
```json
{"q":"Pregunta","o":["A","B","C","D"],"c":2,"e":"🎬"}
```
- `q` = texto · `o` = 4 opciones · `c` = índice de la correcta (0 a 3) · `e` = emoji que se muestra sin delatar la respuesta

Solo pega más objetos dentro de `"questions":[ ... ]`. No hay que tocar código.

## 🗺️ Próximos pasos (según tu plan)
- Salas creadas desde **Roku** con código de 5 letras (teléfono como mando)
- Minijuegos entre rondas de quiz
- Completar cada categoría hasta las cifras grandes (400–700 por categoría)
