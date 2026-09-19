export const AVATARS = ['🦊','🐼','🐯','🐸','🐨','🦁','🐙','🦉','🦄','🤖','🐰','🐧','🐢','🦋','🐬','🦖','🐝','🐺','🐱','🐻','🚀','🌵','🍄','👾'];
export const MODES = [
 {id:'cruci',name:'Cruci Quiz Chile',icon:'letters',tag:'20 NIVELES · TU PROGRESO',color:'blue',desc:'Pistas de acá, palabras cruzadas y una clave por descubrir.',skill:'Vocabulario y cultura',minutes:'A tu ritmo',glyph:'▦'},
 {id:'bingo',name:'Bingo del club',icon:'grid',tag:'CARTONES DE 90 NÚMEROS',color:'yellow',desc:'Marca las bolitas, completa una línea y canta bingo.',skill:'Atención y números',minutes:'10–20 min',glyph:'90'},
 {id:'bachillerato',name:'Bachillerato STOP',icon:'letters',tag:'5 RONDAS + REVANCHA',color:'peach',desc:'Una letra, seis categorías y un minuto. ¡Que no te ganen el STOP!',skill:'Vocabulario y rapidez',minutes:'10–15 min',glyph:'STOP'},
 {id:'golf',name:'Mini Golf Club',icon:'orbit',tag:'NUEVO · 8 CIRCUITOS',color:'mint',desc:'Apunta, elige la potencia y encuentra tu mejor recorrido.',skill:'Ángulos y precisión',minutes:'8–15 min',glyph:'⚑'},
 {id:'impostor',name:'Impostor: entre pistas',icon:'users',tag:'3–30 PERSONAS',color:'purple',desc:'Una palabra secreta. Varias sospechas. ¿Quién está improvisando?',skill:'Deducción y expresión',minutes:'10–20 min',glyph:'◉'},
 {id:'stroop',name:'Tinta traicionera',icon:'sparkles',tag:'NUEVO',color:'pink',desc:'Lee el color, resiste la palabra. Parece fácil hasta que empieza.',skill:'Atención selectiva',minutes:'3–5 min',glyph:'Aa'},
 {id:'balance',name:'Balanza mental',icon:'puzzle',tag:'NUEVO',color:'blue',desc:'Encuentra la operación que equilibra el número objetivo.',skill:'Cálculo y equivalencias',minutes:'3–5 min',glyph:'⚖'},
  {id:'party',name:'Party Mix',icon:'sparkles',tag:'EL FAVORITO DEL GRUPO',color:'mint',desc:'Un poco de todo. Una partida que nunca se queda quieta.',skill:'6 retos combinados',minutes:'5–8 min',glyph:'✦'},
  {id:'trivia',name:'Súper Trivia',icon:'brain',tag:'CURIOSIDAD SIN LÍMITES',color:'purple',desc:'Descubre, responde y aprende algo nuevo en cada ronda.',skill:'Conocimientos',minutes:'4–6 min',glyph:'?'},
  {id:'numbers',name:'Órbita numérica',icon:'orbit',tag:'NUEVO',color:'blue',desc:'Atrapa la respuesta correcta antes de que se escape.',skill:'Cálculo mental',minutes:'3–5 min',glyph:'×'},
  {id:'memory',name:'Memoria 3D',icon:'layers',tag:'NUEVO',color:'peach',desc:'Mira las fichas. Guarda el orden. Confía en tu memoria.',skill:'Memoria visual',minutes:'3–5 min',glyph:'▧'},
  {id:'words',name:'Word Lab',icon:'letters',tag:'APRENDE INGLÉS',color:'yellow',desc:'Construye frases en inglés, una palabra a la vez.',skill:'Inglés · A1–A2',minutes:'4–6 min',glyph:'Aa'},
  {id:'sequence',name:'Código lógico',icon:'puzzle',tag:'NUEVO',color:'pink',desc:'Detecta el patrón y encuentra la pieza que falta.',skill:'Razonamiento',minutes:'3–5 min',glyph:'⌘'},
  {id:'reaction',name:'Reflejo flash',icon:'zap',tag:'CONCENTRACIÓN TOTAL',color:'lime',desc:'Espera la señal. El secreto está en no adelantarse.',skill:'Atención e inhibición',minutes:'2–4 min',glyph:'ϟ'},
  {id:'karaoke',name:'Karaoke Studio',icon:'mic',tag:'EL ESCENARIO ES TUYO',color:'purple',desc:'Tu canción, tu turno y todo el grupo acompañándote.',skill:'Expresión y ritmo',minutes:'Sin prisa',glyph:'♫'}
];
export const CATEGORIES = [
  ["chile", "Chile de norte a sur · 150"],["onepiece", "One Piece · 150"],["rapidos", "Rápido y Furioso · 150"],["simpsons", "Los Simpsons · 150"],["harrypotter", "Harry Potter · 150"],["gastronomia", "Gastronomía · 150"],["letras", "Completa la letra y la canción · 150"],["stranger", "Stranger Things · temporadas 1–4 · 150"],["cuerpo", "Cuerpo humano · 150"],["tronos", "Juego de Tronos / Casa del Dragón · 150"],["memes", "Memes de internet y Chile · 150"],["comerciales", "Comerciales y marcas en Chile · 150"],["telenovelas", "Telenovelas en Chile · 150"],["prehistoria", "Dinosaurios y prehistoria · 150"],
  ['learn','Para aprender'],['english','English time'],['trivia','Trivia general'],['animales','Animales'],['espacio','Espacio'],['histchile','Chile'],['disney','Disney'],['cine','Cine'],['deportes','Deportes'],['tecnologia','Tecnología'],['banderas','Banderas y capitales'],['pixar','Pixar'],['anime','Anime'],['futbol','Fútbol'],['historia','Historia'],['geek','Cultura geek'],['curiosos','Datos curiosos'],['pop','Cultura pop'],['marvel','Marvel'],['dc','DC'],['dragonball','Dragon Ball'],['starwars','Star Wars'],['lotr','El señor de los anillos'],['batman','Batman'],['spiderman','Spider-Man'],['shrek','Shrek'],['netflix','Netflix'],['hbo','HBO'],['famosos','Famosos'],['greys','Anatomía de Grey'],['terror','Terror'],['farandula','Farándula']
];
export const LEARN = [
  ['¿Cuántos lados tiene un hexágono?',['5','6','7','8'],1,'Hexa- significa seis. Un hexágono es un polígono de seis lados.','📐'],
  ['¿Qué fracción equivale a un medio?',['2/4','1/4','3/4','2/3'],0,'Si divides cada mitad en dos, obtienes dos cuartos: 1/2 = 2/4.','◐'],
  ['¿Qué necesita una planta para hacer fotosíntesis?',['Solo tierra','Luz, agua y dióxido de carbono','Solo oxígeno','Sal y arena'],1,'La planta usa la energía de la luz para transformar agua y dióxido de carbono en alimento.','🌱'],
  ['¿Qué instrumento mide la temperatura?',['Regla','Balanza','Termómetro','Brújula'],2,'El termómetro mide temperatura; la balanza mide masa y la brújula indica dirección.','🌡️'],
  ['¿Qué planeta está más cerca del Sol?',['Venus','Marte','Tierra','Mercurio'],3,'El orden comienza con Mercurio, Venus, Tierra y Marte.','🪐'],
  ['¿Qué palabra es un verbo?',['Montaña','Correr','Azul','Mesa'],1,'Los verbos expresan acciones, estados o procesos. Correr expresa una acción.','🏃'],
  ['¿Cuántos minutos hay en una hora y media?',['60','75','90','120'],2,'Una hora son 60 minutos y media hora son 30: 60 + 30 = 90.','⏱️'],
  ['¿Qué figura tiene todos sus puntos a la misma distancia del centro?',['Circunferencia','Triángulo','Rectángulo','Trapecio'],0,'Una circunferencia es una línea curva cerrada cuyos puntos están a igual distancia del centro.','⭕'],
  ['¿Qué número es par?',['13','27','35','48'],3,'Un número es par si es divisible por 2. Los pares terminan en 0, 2, 4, 6 u 8.','🔢'],
  ['Si reciclas papel, ¿qué recurso ayudas a ahorrar?',['Árboles','Petróleo únicamente','Metales','Vidrio'],0,'Reciclar papel reduce la necesidad de producir pulpa nueva a partir de madera.','♻️'],
  ['¿Qué sentido utilizas principalmente para reconocer una melodía?',['Tacto','Oído','Gusto','Olfato'],1,'El oído nos permite percibir sonidos y distinguir su altura, duración e intensidad.','🎵'],
  ['¿Qué sucede al enfriar agua líquida hasta que se congela?',['Se vuelve gas','Se vuelve sólida','Desaparece','Se transforma en sal'],1,'Al congelarse, el agua cambia de estado líquido a sólido. Sigue siendo agua.','🧊'],
  ['¿Qué unidad usarías para medir el largo de una sala?',['Litros','Gramos','Metros','Grados'],2,'Los metros miden longitud. Los litros miden volumen y los gramos, masa.','📏'],
  ['¿Qué valor tiene el 5 en el número 352?',['5 unidades','5 decenas','5 centenas','5 miles'],1,'De derecha a izquierda: unidades, decenas y centenas. El 5 representa 50.','🔢'],
  ['¿Cuánto es un cuarto de 20?',['4','5','10','15'],1,'Calcular un cuarto es dividir por cuatro: 20 ÷ 4 = 5.','🍕'],
  ['¿Qué animal es un mamífero?',['Tiburón','Pulpo','Delfín','Sardina'],2,'Los delfines respiran aire y las madres alimentan a sus crías con leche.','🐬'],
  ['¿Qué palabra tiene significado opuesto a «rápido»?',['Veloz','Lento','Ligero','Ágil'],1,'Lento y rápido son antónimos: expresan significados opuestos.','🐢'],
  ['Si miras al norte, ¿qué punto cardinal queda a tu derecha?',['Sur','Oeste','Este','Noroeste'],2,'En una rosa de los vientos, el este queda a la derecha del norte.','🧭'],
  ['¿Qué fracción representa tres de cuatro partes iguales?',['1/3','4/3','3/4','1/4'],2,'El denominador indica las cuatro partes totales y el numerador las tres elegidas.','🧩'],
  ['¿Cuál de estos materiales suele ser atraído por un imán?',['Madera','Hierro','Papel','Vidrio'],1,'El hierro es un material ferromagnético: puede ser atraído por un imán.','🧲']
].map(([q,o,c,explanation,e])=>({q,o,c,explanation,e}));
export const ENGLISH = [
 ['Choose the correct sentence.',['She have a dog.','She has a dog.','She haves a dog.','She having a dog.'],1,'Con he, she e it usamos has. Con I, you, we y they usamos have.'],
 ['The opposite of big is…',['small','long','happy','fast'],0,'Big significa grande; small significa pequeño.'],
 ['Yesterday, I ___ to the park.',['go','goes','went','going'],2,'Yesterday indica pasado. El pasado irregular de go es went.'],
 ['An elephant is ___ than a mouse.',['small','bigger','biggest','big'],1,'Para comparar dos elementos usamos el comparativo: big → bigger.'],
 ['There ___ three apples on the table.',['is','am','are','be'],2,'There are se usa con plurales; there is se usa con singulares.'],
 ['Where do you buy bread?',['At the bakery.','At the library.','At the hospital.','At the cinema.'],0,'Bakery significa panadería. Library significa biblioteca.'],
 ['How much is it? asks about…',['the time','a price','a name','a place'],1,'How much is it? significa ¿Cuánto cuesta?'],
 ['A bird can usually…',['fly','read','write','drive'],0,'Fly significa volar. Usamos can para expresar habilidades.'],
 ['Choose the correct past form: play →',['plaied','playd','played','playing'],2,'Los verbos regulares como play añaden -ed en pasado: played.'],
 ['The cat is under the table. Where is it?',['Sobre la mesa','Entre dos mesas','Debajo de la mesa','Al lado de la mesa'],2,'Under significa debajo de. On significa sobre y next to significa al lado de.'],
 ['Choose the correct question.',['You like apples?','Do you like apples?','Does you like apples?','Are you like apples?'],1,'En presente simple, usamos Do + you + verbo para formar esta pregunta.'],
 ['Which word is an animal?',['purple','tiger','kitchen','Tuesday'],1,'Tiger significa tigre; purple es un color, kitchen es cocina y Tuesday es martes.']
].map(([q,o,c,explanation])=>({q,o,c,explanation,e:'💬'}));
export const SENTENCES = [
 ['The cat is under the table','El gato está debajo de la mesa.','The cat + is + under the table. Under indica posición.'],
 ['I can ride a bike','Puedo andar en bicicleta.','Después de can, el verbo va en su forma base: can ride.'],
 ['She has a red backpack','Ella tiene una mochila roja.','Con she usamos has. En inglés, red va antes de backpack.'],
 ['We went to the park yesterday','Fuimos al parque ayer.','Went es el pasado de go. Yesterday sitúa la acción en el pasado.'],
 ['The elephant is bigger than the mouse','El elefante es más grande que el ratón.','Usa bigger + than para comparar tamaños.'],
 ['There are three books on the desk','Hay tres libros sobre el escritorio.','There are introduce varios objetos; on significa sobre.'],
 ['How much is the blue shirt','¿Cuánto cuesta la camisa azul?','How much is…? pregunta el precio de un objeto singular.'],
 ['My brother likes playing football','A mi hermano le gusta jugar fútbol.','Con my brother (he) añadimos -s: likes.'],
 ['They are listening to music','Ellos están escuchando música.','Presente continuo: are + verbo terminado en -ing.'],
 ['I would like an apple please','Me gustaría una manzana, por favor.','I would like… es una forma cortés de pedir algo.'],
 ['The library is next to the school','La biblioteca está al lado de la escuela.','Next to es una expresión de posición: al lado de.'],
 ['We played a game last night','Jugamos un juego anoche.','Played es pasado regular; last night significa anoche.']
];
