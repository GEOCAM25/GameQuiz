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

const QUESTION_TIME = 40;      // segundos por pregunta
const REVEAL_TIME = 4;         // segundos mostrando la respuesta
const BOARD_TIME = 6;          // segundos mostrando el marcador
const MAX_PLAYERS = 15;
const TEST_ROOM = "ZZZX";      // sala secreta de prueba (modo solo)
