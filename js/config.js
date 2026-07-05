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

const QUESTION_TIME = 40;      // segundos por pregunta
const REVEAL_TIME = 4;         // segundos mostrando la respuesta
const BOARD_TIME = 6;          // segundos mostrando el marcador
const MAX_PLAYERS = 15;
const TEST_ROOM = "ZZZX";      // sala secreta de prueba (modo solo)
