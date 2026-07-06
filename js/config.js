// ============================================================
// GAME QUIZ — Configuración
// 1) Crea un proyecto gratis en https://supabase.com
// 2) Corre el archivo supabase-setup.sql en el SQL Editor
// 3) Pega aquí tu URL y tu anon key (Settings → API)
// ============================================================
const SUPABASE_URL = "https://tfjjfhzejfonvqexnvym.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_AUlDI0HiCb8pFb6pLWA7Cw__T5QhScZ";

// Categorías disponibles (id = nombre del archivo en /data)
const CATEGORIES = [
  { id:"disney",     name:"Disney",             emoji:"🏰", group:"TV y Streaming" },
  { id:"pixar",      name:"Pixar",              emoji:"🤠", group:"TV y Streaming" },
  { id:"netflix",    name:"Netflix",            emoji:"📺", group:"TV y Streaming" },
  { id:"hbo",        name:"HBO",                emoji:"🐉", group:"TV y Streaming" },
  { id:"anime",      name:"Anime",              emoji:"🍥", group:"TV y Streaming" },
  { id:"cine",       name:"Cine",               emoji:"🎬", group:"TV y Streaming" },
  { id:"famosos",    name:"Famosos",            emoji:"⭐", group:"TV y Streaming" },
  { id:"geek",       name:"Cultura Geek",       emoji:"🦸", group:"TV y Streaming" },
  { id:"banderas",   name:"Banderas y Capitales",emoji:"🌍", group:"Cultura" },
  { id:"historia",   name:"Historia",           emoji:"🏛️", group:"Cultura" },
  { id:"pop",        name:"Cultura Pop",        emoji:"🎤", group:"Cultura" },
  { id:"trivia",     name:"Trivia General",     emoji:"🧠", group:"Cultura" },
  { id:"curiosos",   name:"Datos Curiosos",     emoji:"🤯", group:"Cultura" },
  { id:"tecnologia", name:"Tecnología",         emoji:"💻", group:"Cultura" },
  { id:"espacio",    name:"Espacio",            emoji:"🚀", group:"Cultura" },
  { id:"animales",   name:"Animales",           emoji:"🦁", group:"Cultura" },
  { id:"futbol",     name:"Fútbol",             emoji:"⚽", group:"Deportes" },
  { id:"deportes",   name:"Deportes",           emoji:"🏅", group:"Deportes" },
];

// Personajes (máx 15 jugadores, uno por personaje)
const AVATARS = ["🦊","🦜","🧸","🐨","🐿️","🦖","🤖","🦉","🐼","💂","🐦","🐱","🪆","🍦","🦒"];

// Stickers del chat
const STICKERS = ["😂","🤣","😎","🤯","😱","🥳","😭","🤔","👏","🔥","💪","🫶","🤡","👀","💀","🏆","❤️","🎉"];

// Palabras bloqueadas por el filtro del chat (se censuran con ***)
const BAD_WORDS = ["ctm","csm","weon","weón","hueon","hueón","aweonao","conchetumare",
"conchetumadre","maricon","maricón","puta","puto","mierda","culiao","culiado","chucha",
"pico","raja","perkin","perra","imbecil","imbécil","idiota","estupido","estúpido","pendejo",
"cabron","cabrón","verga","joder","coño","gilipollas","fuck","shit","bitch","asshole"];

// Playlist de música de fondo. Para agregar una canción nueva:
// 1) Sube el mp3 a la carpeta "music/" del repo
// 2) Agrega una línea aquí abajo con un id único, el nombre y el nombre del archivo
const MUSIC_TRACKS = [
  { id:"gentio", name:"¡Que se arme el gentío!", file:"music/que-se-arme-el-gentio.mp3", duration:174 },
  { id:"podio",  name:"El podio es mío",         file:"music/el-podio-es-mio.mp3",       duration:172 },
  { id:"verdad", name:"La hora de la verdad",    file:"music/la-hora-de-la-verdad.mp3",  duration:177 },
];

// Sonidos "botón ganador": cada vez que se muestra el marcador, aparecen 3 al azar
// y solo quien ganó la ronda (primero en responder bien) puede tocar uno.
// Para agregar un sonido nuevo:
// 1) Sube el mp3 a la carpeta "audio/ganador/" del repo
// 2) Agrega una línea aquí abajo con el nombre del archivo y la etiqueta a mostrar
const WINNER_SOUNDS = [
  { file:"audio/ganador/Fuera_depresio_n_GANADOR.mp3", label:"Fuera Depresión" },
  { file:"audio/ganador/Ahh_Ganador.mp3",              label:"Ahh" },
  { file:"audio/ganador/Perdedores_GANADOR.mp3",       label:"Perdedores" },
  { file:"audio/ganador/Yupi_GANADOR.mp3",             label:"Yupi" },
  { file:"audio/ganador/Nin_o_rata_GANADOR.mp3",       label:"Niño Rata" },
  { file:"audio/ganador/Asadito_GANADOR.mp3",          label:"Asadito" },
  { file:"audio/ganador/Gane_GANADOR.mp3",             label:"Gané" },
  { file:"audio/ganador/Jackson_Ganador.mp3",          label:"Jackson" },
  { file:"audio/ganador/Diarrea_extrema_GANADOR.mp3",  label:"Diarrea Extrema" },
  { file:"audio/ganador/Magea_GANADOR.mp3",            label:"Magea" },
  { file:"audio/ganador/Atento_Central_GANADOR.mp3",   label:"Atento Central" },
  { file:"audio/ganador/Risa_GANADOR.mp3",             label:"Risa" },
  { file:"audio/ganador/Uhh_GANADOR.mp3",              label:"Uhh" },
];

// Colores para los 3 botones ganadores (se eligen 3 al azar cada ronda)
const WINNER_COLORS = ["#E74C3C","#2ECC71","#3498DB","#9B59B6","#F1C40F","#1ABC9C","#E67E22","#EC407A","#5C6BC0"];

// Sonidos de acierto/error: al revelar la respuesta, se elige uno al azar
// de la lista correspondiente y suena en el celular de cada jugador según
// si ÉL acertó o falló (una vez por pregunta).
// Para agregar más: sube el mp3 a audio/correcto/ o audio/incorrecto/ y
// agrega el nombre de archivo aquí abajo.
const CORRECT_SOUNDS = [
  "audio/correcto/Correcto3.mp3","audio/correcto/Correcto4.mp3","audio/correcto/Correcto5.mp3",
  "audio/correcto/Correcto6.mp3","audio/correcto/Correcto7.mp3","audio/correcto/Correcto8.mp3",
  "audio/correcto/Correcto9.mp3","audio/correcto/Correcto10.mp3",
];
const INCORRECT_SOUNDS = [
  "audio/incorrecto/Incorrecto1.mp3","audio/incorrecto/Incorrecto2.mp3","audio/incorrecto/Incorrecto3.mp3",
  "audio/incorrecto/Incorrecto4.mp3","audio/incorrecto/Incorrecto5.mp3","audio/incorrecto/Incorrecto6.mp3",
  "audio/incorrecto/Incorrecto7.mp3","audio/incorrecto/Incorrecto8.mp3","audio/incorrecto/Incorrecto9.mp3",
  "audio/incorrecto/Incorrecto10.mp3",
];

const QUESTION_TIME = 40;      // segundos por pregunta
const REVEAL_TIME = 4;         // segundos mostrando la respuesta
const BOARD_TIME = 6;          // segundos mostrando el marcador
const MAX_PLAYERS = 15;
const TEST_ROOM = "ZZZX";      // sala secreta de prueba (modo solo)
