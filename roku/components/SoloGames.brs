' ======================================================================
' GAME QUIZ Roku — Juegos individuales en pantalla
' Cruci-Quiz: crucigrama con palabra clave vertical, jugable con el
' control del Roku (teclado en pantalla) o con el teléfono.
' ======================================================================

' ---- Datos de niveles (subconjunto; mismos que la web) ----
function cruciLevels() as object
    return [
        { tema: "Frutas 🍓", clave: "MELON", words: [
            { w: "MANZANA", p: "Roja o verde, la mordió Blancanieves" },
            { w: "FRESA",   p: "Roja con pepitas, también llamada frutilla" },
            { w: "CIRUELA", p: "Morada; seca es una pasa" },
            { w: "DURAZNO", p: "Naranja, aterciopelado y con carozo" },
            { w: "BANANA",  p: "Amarilla y alargada, favorita del mono" }
        ]},
        { tema: "Animales 🦁", clave: "TIGRE", words: [
            { w: "GATO",     p: "Ronronea y cae de pie" },
            { w: "DELFIN",   p: "Mamífero marino juguetón" },
            { w: "CANGURO",  p: "Salta y lleva a su cría en bolsa" },
            { w: "PERRO",    p: "El mejor amigo del humano" },
            { w: "ELEFANTE", p: "El más grande de tierra, con trompa" }
        ]},
        { tema: "Colores 🎨", clave: "VERDE", words: [
            { w: "VIOLETA", p: "Mezcla de azul y rojo" },
            { w: "CELESTE", p: "Azul clarito como el cielo" },
            { w: "MARRON",  p: "Color del chocolate" },
            { w: "DORADO",  p: "Color del oro" },
            { w: "BEIGE",   p: "Tono claro entre crema y café" }
        ]},
        { tema: "Países 🌍", clave: "CHILE", words: [
            { w: "CANADA",  p: "País de la hoja de arce" },
            { w: "CHINA",   p: "El más poblado de Asia" },
            { w: "ITALIA",  p: "País con forma de bota" },
            { w: "POLONIA", p: "Europeo, capital Varsovia" },
            { w: "GRECIA",  p: "Cuna de la democracia" }
        ]},
        { tema: "Espacio 🚀", clave: "LUNA", words: [
            { w: "PLUTON",   p: "Planeta enano y helado" },
            { w: "SATURNO",  p: "El planeta de los anillos" },
            { w: "ESTRELLA", p: "Punto brillante en la noche" },
            { w: "MARTE",    p: "El planeta rojo" }
        ]}
    ]
end function

' ---- Construir el layout (columna de cruce y offsets) ----
function cruciBuild(level as object) as object
    clave = level.clave
    rows = []
    for i = 0 to level.words.Count() - 1
        entry = level.words[i]
        word = UCase(entry.w)
        keyLetter = Mid(clave, (i mod Len(clave)) + 1, 1)
        cross = Instr(1, word, keyLetter) - 1
        if cross < 0 then cross = 0
        rows.Push({ word: word, clue: entry.p, cross: cross, filled: [] })
        for j = 0 to Len(word) - 1
            rows[i].filled.Push("")
        end for
    end for
    keyCol = 0
    for each r in rows
        if r.cross > keyCol then keyCol = r.cross
    end for
    width = 0
    for each r in rows
        r.offset = keyCol - r.cross
        w = r.offset + Len(r.word)
        if w > width then width = w
    end for
    return { rows: rows, keyCol: keyCol, width: width, clave: clave }
end function

sub startCruci()
    m.mode = "solo"
    m.soloKind = "cruci"
    m.cruciLevelIdx = 0
    m.cruciLayout = cruciBuild(cruciLevels()[0])
    m.cruciActiveRow = 0
    m.top.findNode("soloTitle").text = "🧩 Cruci-Quiz — " + cruciLevels()[0].tema
    setView("solo")
    drawCruci()
    drawCruciKeyboard()
    selectCruciRow(0)
end sub

sub drawCruci()
    board = m.top.findNode("cruciBoard")
    board.removeChildrenIndex(board.getChildCount(), 0)
    lay = m.cruciLayout
    cell = 70
    gap = 6
    for ri = 0 to lay.rows.Count() - 1
        r = lay.rows[ri]
        for c = 0 to Len(r.word) - 1
            col = r.offset + c
            g = CreateObject("roSGNode", "Group")
            rect = CreateObject("roSGNode", "Rectangle")
            rect.width = cell : rect.height = cell
            isKey = (col = lay.keyCol)
            solved = (joinArr(r.filled) = r.word)
            if solved then
                rect.color = "0x16B364FF"
            else if isKey then
                rect.color = "0xFFD25EFF"
            else
                rect.color = "0xFFFFFFEE"
            end if
            g.appendChild(rect)
            ch = r.filled[c]
            if ch <> "" then
                lbl = CreateObject("roSGNode", "Label")
                lbl.text = ch
                lbl.translation = [22, 12]
                lbl.color = "0x241A33FF"
                f = CreateObject("roSGNode", "Font") : f.uri = "font:BoldSystemFontFile" : f.size = 44
                lbl.font = f
                g.appendChild(lbl)
            end if
            g.translation = [col * (cell + gap), ri * (cell + gap)]
            ' resaltar fila activa
            if ri = m.cruciActiveRow and not solved then
                border = CreateObject("roSGNode", "Rectangle")
                border.width = cell : border.height = 4 : border.color = "0xFFD25EFF"
                border.translation = [0, cell - 4]
                g.appendChild(border)
            end if
            board.appendChild(g)
        end for
    end for
end sub

sub drawCruciKeyboard()
    kb = m.top.findNode("cruciKeyboard")
    kb.removeChildrenIndex(kb.getChildCount(), 0)
    rowsK = ["QWERTYUIOP", "ASDFGHJKLÑ", "ZXCVBNM"]
    m.kbButtons = []
    cell = 84
    gap = 8
    y = 0
    for ri = 0 to rowsK.Count() - 1
        line = rowsK[ri]
        xoff = ri * 42
        for c = 0 to Len(line) - 1
            letter = Mid(line, c + 1, 1)
            g = CreateObject("roSGNode", "Group")
            rect = CreateObject("roSGNode", "Rectangle")
            rect.width = cell : rect.height = cell : rect.color = "0xFFFFFFDD"
            g.appendChild(rect)
            lbl = CreateObject("roSGNode", "Label")
            lbl.text = letter : lbl.translation = [26, 20] : lbl.color = "0x241A33FF"
            f = CreateObject("roSGNode", "Font") : f.uri = "font:BoldSystemFontFile" : f.size = 40
            lbl.font = f
            g.appendChild(lbl)
            g.translation = [xoff + c * (cell + gap), y]
            kb.appendChild(g)
            m.kbButtons.Push({ node: g, rect: rect, letter: letter })
        end for
        y = y + cell + gap
    end for
    m.kbIndex = 0
    highlightKb()
end sub

sub highlightKb()
    for i = 0 to m.kbButtons.Count() - 1
        b = m.kbButtons[i]
        if i = m.kbIndex then
            b.rect.color = "0xFFD25EFF"
        else
            b.rect.color = "0xFFFFFFDD"
        end if
    end for
end sub

sub selectCruciRow(ri as integer)
    m.cruciActiveRow = ri
    r = m.cruciLayout.rows[ri]
    m.top.findNode("cruciClue").text = Str(ri + 1).Trim() + ".  " + r.clue + "  (" + Str(Len(r.word)).Trim() + " letras)"
    drawCruci()
end sub

' ---- Teclado navegable con el control físico ----
function soloKey(key as string) as boolean
    if m.soloKind = "reaccion" then
        if key = "OK" then
            if m.reacDoneWaiting = true then
                m.reacDoneWaiting = false
                startSoloMinis()
            else
                reacTap()
            end if
            return true
        end if
        return false
    end if
    if m.soloKind <> "cruci" then return false
    if key = "right" then
        m.kbIndex = (m.kbIndex + 1) mod m.kbButtons.Count() : highlightKb() : return true
    else if key = "left" then
        m.kbIndex = (m.kbIndex - 1 + m.kbButtons.Count()) mod m.kbButtons.Count() : highlightKb() : return true
    else if key = "down" then
        m.kbIndex = (m.kbIndex + 10)
        if m.kbIndex >= m.kbButtons.Count() then m.kbIndex = m.kbButtons.Count() - 1
        highlightKb() : return true
    else if key = "up" then
        m.kbIndex = m.kbIndex - 10
        if m.kbIndex < 0 then m.kbIndex = 0
        highlightKb() : return true
    else if key = "OK" then
        typeCruciLetter(m.kbButtons[m.kbIndex].letter) : return true
    else if key = "rewind" then
        cruciBackspace() : return true
    end if
    return false
end function

sub typeCruciLetter(letter as string)
    r = m.cruciLayout.rows[m.cruciActiveRow]
    if joinArr(r.filled) = r.word then return
    idx = nextEmpty(r)
    if idx < 0 then return
    r.filled[idx] = letter
    if nextEmpty(r) < 0 then checkCruciWord(r)
    drawCruci()
end sub

sub cruciBackspace()
    r = m.cruciLayout.rows[m.cruciActiveRow]
    if joinArr(r.filled) = r.word then return
    for i = r.filled.Count() - 1 to 0 step -1
        if r.filled[i] <> "" then
            r.filled[i] = "" : exit for
        end if
    end for
    drawCruci()
end sub

function nextEmpty(r as object) as integer
    for i = 0 to r.filled.Count() - 1
        if r.filled[i] = "" then return i
    end for
    return -1
end function

sub checkCruciWord(r as object)
    if joinArr(r.filled) = r.word then
        ' ¿nivel completo?
        allDone = true
        for each row in m.cruciLayout.rows
            if joinArr(row.filled) <> row.word then allDone = false
        end for
        if allDone then
            cruciLevelComplete()
        else
            selectCruciRow(firstUnsolvedRow())
        end if
    else
        ' limpiar lo no-correcto para reintentar
        for i = 0 to r.filled.Count() - 1
            if r.filled[i] <> Mid(r.word, i + 1, 1) then r.filled[i] = ""
        end for
        drawCruci()
    end if
end sub

function firstUnsolvedRow() as integer
    for i = 0 to m.cruciLayout.rows.Count() - 1
        if joinArr(m.cruciLayout.rows[i].filled) <> m.cruciLayout.rows[i].word then return i
    end for
    return 0
end function

sub cruciLevelComplete()
    m.top.findNode("cruciClue").text = "🎉 ¡Nivel completado! Palabra clave: " + m.cruciLayout.clave
    ' avanzar al siguiente nivel tras un momento
    levels = cruciLevels()
    m.cruciLevelIdx = m.cruciLevelIdx + 1
    if m.cruciLevelIdx >= levels.Count() then
        m.top.findNode("cruciClue").text = "🏆 ¡Terminaste todos los niveles disponibles!"
        return
    end if
    t = CreateObject("roSGNode", "Timer")
    t.duration = 2.5 : t.repeat = false
    t.observeField("fire", "advanceCruci")
    m.top.appendChild(t)
    t.control = "start"
end sub

sub advanceCruci()
    levels = cruciLevels()
    m.cruciLayout = cruciBuild(levels[m.cruciLevelIdx])
    m.cruciActiveRow = 0
    m.top.findNode("soloTitle").text = "🧩 Cruci-Quiz — " + levels[m.cruciLevelIdx].tema
    drawCruci()
    selectCruciRow(0)
end sub

function joinArr(a as object) as string
    s = ""
    for each x in a
        s = s + x
    end for
    return s
end function

' ---- Mini-juego individual simple (reacción) en pantalla ----
sub startSoloMinis()
    m.mode = "solo"
    m.soloKind = "reaccion"
    m.top.findNode("soloTitle").text = "⚡ Reacción — presiona OK cuando se ponga verde"
    setView("solo")
    board = m.top.findNode("cruciBoard")
    board.removeChildrenIndex(board.getChildCount(), 0)
    m.top.findNode("cruciKeyboard").removeChildrenIndex(m.top.findNode("cruciKeyboard").getChildCount(), 0)
    m.reacPad = CreateObject("roSGNode", "Rectangle")
    m.reacPad.width = 1400 : m.reacPad.height = 500 : m.reacPad.color = "0xC21F45FF"
    m.reacPad.translation = [100, 100]
    board.appendChild(m.reacPad)
    m.reacLabel = CreateObject("roSGNode", "Label")
    m.reacLabel.text = "Espera..." : m.reacLabel.translation = [700, 320] : m.reacLabel.color = "0xFFFFFFFF"
    f = CreateObject("roSGNode", "Font") : f.uri = "font:BoldSystemFontFile" : f.size = 60
    m.reacLabel.font = f
    board.appendChild(m.reacLabel)
    m.reacReady = false
    delay = (Rnd(30) + 15) / 10.0
    t = CreateObject("roSGNode", "Timer")
    t.duration = delay : t.repeat = false
    t.observeField("fire", "reacGo")
    m.top.appendChild(t)
    t.control = "start"
    m.top.findNode("cruciClue").text = ""
    m.top.findNode("soloHint").text = "Presiona OK al ponerse verde · ← salir"
end sub

sub reacGo()
    m.reacReady = true
    m.reacPad.color = "0x16B364FF"
    m.reacLabel.text = "¡AHORA!"
    m.reacT0 = getNowMs()
end sub

sub reacTap()
    if not m.reacReady then
        m.reacLabel.text = "¡Muy pronto! 😅"
        m.reacPad.color = "0x8C52FFFF"
        return
    end if
    ms = Int(getNowMs() - m.reacT0)
    m.reacPad.color = "0x1E9BFFFF"
    m.reacLabel.text = Str(ms).Trim() + " ms"
    m.top.findNode("cruciClue").text = "Presiona OK para jugar de nuevo"
    m.reacReady = false
    m.reacDoneWaiting = true
end sub
