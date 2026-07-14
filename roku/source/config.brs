' ======================================================================
' Configuración del canal (misma base de datos que la app web)
' ----------------------------------------------------------------------
' La URL de la app web y el MENÚ de juegos se leen en vivo desde
' data/tv.json (GQFallbackData es el respaldo si no hay internet).
' Así, cuando agregas un juego en data/tv.json, el canal lo muestra solo,
' sin necesidad de reinstalar nada en la TV.
' ======================================================================
function GQConfig() as object
    return {
        supabaseUrl: "https://tfjjfhzejfonvqexnvym.supabase.co"
        supabaseKey: "sb_publishable_AUlDI0HiCb8pFb6pLWA7Cw__T5QhScZ"
        ' URL real de la app web (GitHub Pages). El código se agrega como ?sala=XXXX
        webAppUrl: "https://geocam25.github.io/GameQuiz/"
    }
end function

' Menú de respaldo (mismo formato que data/tv.json) por si falla la descarga.
function GQFallbackData() as object
    return {
        title: "GAME QUIZ"
        subtitle: "Trivia y juegos en tu TV · el teléfono es el control"
        webAppUrl: "https://geocam25.github.io/GameQuiz/"
        menus: {
            multi: [
                { title: "Súper Trivia",     emoji: "🎲", color: "0xE8455EFF", kind: "trivia",    cat: "disney" }
                { title: "Karaoke",          emoji: "🎤", color: "0x17A99BFF", kind: "companion", j: "" }
                { title: "Incógnito",        emoji: "🕵️", color: "0x8C52FFFF", kind: "companion", j: "impostor" }
                { title: "Dibuja y Adivina", emoji: "🎨", color: "0x1E9BFFFF", kind: "companion", j: "draw" }
                { title: "¿Quién será?",     emoji: "🫵", color: "0xE83D86FF", kind: "companion", j: "mojate" }
            ]
            solo: [
                { title: "Trivia - Quiz",    emoji: "🧠", color: "0x1E9BFFFF", kind: "companion", j: "" }
                { title: "Cruci-Quiz",       emoji: "🧩", color: "0x8C52FFFF", kind: "cruci" }
                { title: "Mini-juegos",      emoji: "🎯", color: "0x16B364FF", kind: "minis" }
            ]
        }
    }
end function
