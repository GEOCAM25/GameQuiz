' ======================================================================
' GAME QUIZ Roku — Lógica de la escena principal
' Menú de dos niveles: (1) Multijugador / Un jugador, (2) lista de juegos.
' El menú se arma en vivo desde data/tv.json, así se actualiza solo.
' ======================================================================

sub init()
    m.bg = m.top.findNode("bg")
    m.views = {
        home:      m.top.findNode("homeView")
        menu:      m.top.findNode("menuView")
        companion: m.top.findNode("companionView")
        lobby:     m.top.findNode("lobbyView")
        question:  m.top.findNode("questionView")
        mini:      m.top.findNode("miniView")
        scores:    m.top.findNode("scoresView")
        solo:      m.top.findNode("soloView")
        pause:     m.top.findNode("pauseView")
    }
    m.net = m.top.findNode("net")
    m.net.observeField("done", "onNetDone")
    m.bankNet = m.top.findNode("bankNet")
    m.bankNet.observeField("done", "onBankDone")
    m.cfgNet = m.top.findNode("cfgNet")
    m.cfgNet.observeField("done", "onConfigDone")

    ' Estado
    m.mode = "home"          ' home | menu | companion | lobby | game | solo
    m.room = invalid
    m.roomId = ""
    m.code = ""
    m.lastStatus = ""
    m.lastQ = -1
    m.bank = invalid
    m.cfg = GQConfig()
    m.selCat = "disney"

    ' Menú: empezamos con el respaldo y luego lo refrescamos desde la web
    m.data = GQFallbackData()
    m.modeItems = [m.top.findNode("modeMulti"), m.top.findNode("modeSolo")]
    m.modeIndex = 0
    m.menuKey = "multi"
    m.menuIndex = 0
    m.menuGames = []
    m.menuItems = []

    applyData()
    highlightModes()
    setView("home")
    m.top.setFocus(true)

    ' Descargar el menú real (data/tv.json)
    m.cfgNet.control = "RUN"
end sub

' ----------------------------------------------------------------------
' Datos del menú (título/subtítulo/URL) descargados de la web
' ----------------------------------------------------------------------
sub onConfigDone()
    res = m.cfgNet.result
    if res <> invalid and res.ok and res.data <> invalid then
        m.data = res.data
        applyData()
        if m.mode = "menu" then openMenu(m.menuKey)
    end if
end sub

sub applyData()
    if m.data = invalid then return
    if m.data.subtitle <> invalid then m.top.findNode("homeSub").text = m.data.subtitle
    if m.data.webAppUrl <> invalid and m.data.webAppUrl <> "" then m.cfg.webAppUrl = m.data.webAppUrl
end sub

' ----------------------------------------------------------------------
' Mostrar una sola vista
' ----------------------------------------------------------------------
sub setView(name as string)
    for each k in m.views
        m.views[k].visible = (k = name)
    end for
end sub

sub highlightModes()
    for i = 0 to m.modeItems.Count() - 1
        if i = m.modeIndex then
            m.modeItems[i].setFields({ scale: [1.05, 1.05], opacity: 1.0 })
        else
            m.modeItems[i].setFields({ scale: [1.0, 1.0], opacity: 0.7 })
        end if
    end for
end sub

' ----------------------------------------------------------------------
' Control físico del Roku
' ----------------------------------------------------------------------
function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false

    if m.mode = "home" then
        if key = "down" then
            m.modeIndex = (m.modeIndex + 1) mod m.modeItems.Count()
            highlightModes() : return true
        else if key = "up" then
            m.modeIndex = (m.modeIndex - 1 + m.modeItems.Count()) mod m.modeItems.Count()
            highlightModes() : return true
        else if key = "OK" then
            if m.modeIndex = 0 then openMenu("multi") else openMenu("solo")
            return true
        end if

    else if m.mode = "menu" then
        if m.menuGames.Count() = 0 then
            if key = "back" then goHome()
            return true
        end if
        if key = "down" then
            m.menuIndex = (m.menuIndex + 1) mod m.menuGames.Count()
            highlightMenu() : return true
        else if key = "up" then
            m.menuIndex = (m.menuIndex - 1 + m.menuGames.Count()) mod m.menuGames.Count()
            highlightMenu() : return true
        else if key = "OK" then
            selectMenu() : return true
        else if key = "back" then
            goHome() : return true
        end if

    else if m.mode = "companion" then
        if key = "back" then
            m.mode = "menu" : setView("menu") : return true
        end if

    else if m.mode = "lobby" or m.mode = "game" then
        if key = "OK" then
            togglePause() : return true
        else if key = "back" then
            leaveToHome() : return true
        end if

    else if m.mode = "solo" then
        if key = "back" then
            leaveToHome() : return true
        else
            return soloKey(key)
        end if
    end if
    return false
end function

sub goHome()
    m.mode = "home"
    setView("home")
    highlightModes()
end sub

sub leaveToHome()
    m.mode = "home"
    m.room = invalid
    m.lastStatus = ""
    if m.pollTimer <> invalid then m.pollTimer.control = "stop"
    setView("home")
    highlightModes()
end sub

' ======================================================================
' MENÚ de juegos (nivel 2)
' ======================================================================
sub openMenu(key as string)
    m.mode = "menu"
    m.menuKey = key
    m.menuGames = m.data.menus[key]
    if m.menuGames = invalid then m.menuGames = []
    m.menuIndex = 0
    title = "🎮  Multijugador"
    if key = "solo" then title = "🎯  Un jugador"
    m.top.findNode("menuTitle").text = title
    buildMenu()
    setView("menu")
end sub

sub buildMenu()
    wrap = m.top.findNode("menuList")
    wrap.removeChildrenIndex(wrap.getChildCount(), 0)
    m.menuItems = []
    for gi = 0 to m.menuGames.Count() - 1
        g = m.menuGames[gi]
        item = CreateObject("roSGNode", "Group")
        item.translation = [0, gi * 142]

        rect = CreateObject("roSGNode", "Rectangle")
        rect.width = 600 : rect.height = 120
        col = "0x5B6BFFFF"
        if g.color <> invalid then col = g.color
        rect.color = col
        item.appendChild(rect)

        em = CreateObject("roSGNode", "Label")
        em.text = g.emoji
        em.translation = [30, 26]
        fe = CreateObject("roSGNode", "Font") : fe.uri = "font:BoldSystemFontFile" : fe.size = 62
        em.font = fe
        item.appendChild(em)

        tt = CreateObject("roSGNode", "Label")
        tt.text = g.title
        tt.translation = [140, 22]
        tt.color = "0xFFFFFFFF"
        ft = CreateObject("roSGNode", "Font") : ft.uri = "font:BoldSystemFontFile" : ft.size = 46
        tt.font = ft
        item.appendChild(tt)

        sb = CreateObject("roSGNode", "Label")
        sb.text = kindSub(g.kind)
        sb.translation = [142, 80]
        sb.color = "0xFFFFFFCC"
        fs = CreateObject("roSGNode", "Font") : fs.uri = "font:SystemFontFile" : fs.size = 26
        sb.font = fs
        item.appendChild(sb)

        wrap.appendChild(item)
        m.menuItems.Push(item)
    end for
    highlightMenu()
end sub



function kindSub(kind as dynamic) as string
    if kind = "trivia" then return "Trivia en la TV · controlas con el teléfono"
    if kind = "cruci" then return "Crucigrama en la TV"
    if kind = "minis" then return "Mini-juegos en la TV"
    return "Se juega en el teléfono"
end function

sub highlightMenu()
    for i = 0 to m.menuItems.Count() - 1
        if i = m.menuIndex then
            m.menuItems[i].setFields({ scale: [1.04, 1.04], opacity: 1.0 })
        else
            m.menuItems[i].setFields({ scale: [1.0, 1.0], opacity: 0.65 })
        end if
    end for
end sub

sub selectMenu()
    if m.menuGames.Count() = 0 then return
    g = m.menuGames[m.menuIndex]
    kind = g.kind
    if kind = "trivia" then
        m.selCat = "disney"
        if g.cat <> invalid and g.cat <> "" then m.selCat = g.cat
        createTvRoom()
    else if kind = "cruci" then
        startCruci()
    else if kind = "minis" then
        startSoloMinis()
    else
        showCompanion(g)
    end if
end sub

' ----------------------------------------------------------------------
' Compañero: se juega en el teléfono → QR directo al juego
' ----------------------------------------------------------------------
sub showCompanion(g as object)
    m.mode = "companion"
    m.top.findNode("compTitle").text = g.emoji + "  " + g.title
    url = m.cfg.webAppUrl
    if Right(url, 1) <> "/" then url = url + "/"
    if g.j <> invalid and g.j <> "" then url = url + "?j=" + g.j
    encoded = urlEncode(url)
    m.top.findNode("compQR").uri = "https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=10&data=" + encoded
    setView("companion")
end sub

' ======================================================================
' MODO PANTALLA (Súper Trivia) — crear sala + sondeo
' ======================================================================
sub createTvRoom()
    m.code = genNumericCode()
    settings = {
        count: 10, mode: "admin", filter: "on", cat: m.selCat,
        qids: [], scoreMode: "reset", qtime: 40, tv: true
    }
    m.net.params = { code: m.code, settings: settings }
    m.net.op = "createRoom"
    m.net.control = "RUN"
end sub

sub startPolling()
    if m.pollTimer = invalid then
        m.pollTimer = CreateObject("roSGNode", "Timer")
        m.pollTimer.repeat = true
        m.pollTimer.duration = 2
        m.pollTimer.observeField("fire", "pollRoom")
        m.top.appendChild(m.pollTimer)
    end if
    m.pollTimer.control = "start"
end sub

sub pollRoom()
    if m.roomId = "" then return
    m.net.params = { id: m.roomId }
    m.net.op = "getRoom"
    m.net.control = "RUN"
end sub

' ----------------------------------------------------------------------
' Respuesta de la tarea de red
' ----------------------------------------------------------------------
sub onNetDone()
    res = m.net.result
    if res = invalid then return

    if res.op = "createRoom" then
        if res.ok and res.room <> invalid then
            m.room = res.room
            m.roomId = Str(res.room.id).Trim()
            m.mode = "lobby"
            m.lastStatus = "lobby"
            showLobby()
            renderQR()
            startPolling()
            requestPlayers()
        else
            showError("No se pudo crear la sala")
        end if

    else if res.op = "getRoom" then
        if res.ok and res.room <> invalid then
            m.room = res.room
            handlePhoneRemote()
            onRoomState()
        end if

    else if res.op = "getPlayers" then
        if res.ok then
            m.players = res.players
            renderPlayers()
        end if

    else if res.op = "updateRoom" then
        ' nada especial
    end if
end sub

sub requestPlayers()
    m.net.params = { roomId: m.roomId }
    m.net.op = "getPlayers"
    m.net.control = "RUN"
end sub

' ----------------------------------------------------------------------
' Reacción a los cambios de estado de la sala
' ----------------------------------------------------------------------
sub onRoomState()
    settings = m.room.settings
    paused = false
    if settings <> invalid and settings.paused <> invalid then paused = settings.paused
    m.views.pause.visible = paused
    if paused then return

    st = m.room.status
    if st <> m.lastStatus or (st = "question" and m.room.current_q <> m.lastQ) then
        if st = "lobby" then
            m.mode = "lobby" : setView("lobby") : requestPlayers()
        else if st = "countdown" then
            m.mode = "game" : setView("question") : showCountdownText()
        else if st = "question" then
            m.mode = "game" : loadBankThenQuestion()
        else if st = "reveal" then
            m.mode = "game" : showReveal()
        else if st = "board" then
            m.mode = "game" : setView("scores") : requestPlayers()
        else if st = "mini" then
            m.mode = "game" : setView("mini")
        else if st = "podium" then
            m.mode = "game" : setView("scores") : requestPlayers()
        end if
        m.lastStatus = st
        m.lastQ = m.room.current_q
    end if
end sub

sub showCountdownText()
    m.top.findNode("qText").text = "¡Prepárate!"
    m.top.findNode("qIdx").text = ""
    m.top.findNode("qEmoji").text = "🎬"
    hideAnswers()
end sub

sub hideAnswers()
    for i = 0 to 3
        m.top.findNode("ans" + Str(i).Trim() + "t").text = ""
    end for
end sub

' ----------------------------------------------------------------------
' Preguntas: cargar banco y mostrar
' ----------------------------------------------------------------------
sub loadBankThenQuestion()
    cat = m.room.settings.cat
    if m.bank <> invalid and m.bankCat = cat then
        showQuestion()
    else
        m.bankNet.cat = cat
        m.bankNet.control = "RUN"
    end if
end sub

sub onBankDone()
    res = m.bankNet.result
    if res <> invalid and res.ok then
        m.bank = res.bank
        m.bankCat = res.cat
        if m.mode = "game" then showQuestion()
    end if
end sub

sub showQuestion()
    if m.bank = invalid then return
    s = m.room.settings
    qid = s.qids[m.room.current_q]
    q = m.bank.questions[qid]
    if q = invalid then return
    setView("question")

    total = s.qids.Count()
    isFinal = (m.room.current_q >= total - 1)
    idxLabel = "Pregunta " + Str(m.room.current_q + 1).Trim() + " de " + Str(total).Trim()
    if isFinal then idxLabel = "PREGUNTA FINAL ×2"
    m.top.findNode("qIdx").text = idxLabel

    emoji = ""
    if q.e <> invalid then emoji = q.e
    m.top.findNode("qEmoji").text = emoji
    m.top.findNode("qText").text = q.q

    for i = 0 to 3
        t = ""
        if q.o <> invalid and q.o.Count() > i then t = q.o[i]
        m.top.findNode("ans" + Str(i).Trim() + "t").text = t
        resetAnswerColor(i)
    end for
    animateTimer(s.qtime)
end sub

sub resetAnswerColor(i as integer)
    colors = ["0xFF4A6EFF", "0x1E9BFFFF", "0xFFB821FF", "0x16B364FF"]
    m.top.findNode("ans" + Str(i).Trim()).color = colors[i]
    m.top.findNode("ans" + Str(i).Trim()).opacity = 1.0
end sub

sub showReveal()
    if m.bank = invalid then return
    s = m.room.settings
    q = m.bank.questions[s.qids[m.room.current_q]]
    if q = invalid then return
    setView("question")
    for i = 0 to 3
        node = m.top.findNode("ans" + Str(i).Trim())
        if i = q.c then
            node.color = "0xFFD25EFF"
            node.opacity = 1.0
        else
            node.opacity = 0.35
        end if
    end for
end sub

sub animateTimer(secs as dynamic)
    if secs = invalid then secs = 40
    m.qSecs = secs
    m.qStart = getNowMs()
    if m.timerTick = invalid then
        m.timerTick = CreateObject("roSGNode", "Timer")
        m.timerTick.repeat = true
        m.timerTick.duration = 0.2
        m.timerTick.observeField("fire", "tickTimer")
        m.top.appendChild(m.timerTick)
    end if
    m.timerTick.control = "start"
end sub

sub tickTimer()
    if m.qSecs = invalid then return
    elapsed = (getNowMs() - m.qStart) / 1000.0
    left = m.qSecs - elapsed
    if left < 0 then left = 0
    frac = left / m.qSecs
    m.top.findNode("qTimerFill").width = 1600 * frac
    if left <= 0 then m.timerTick.control = "stop"
end sub

' ----------------------------------------------------------------------
' Jugadores en el lobby / marcador
' ----------------------------------------------------------------------
sub showLobby()
    setView("lobby")
    m.top.findNode("lobbyCode").text = m.code
end sub

sub renderPlayers()
    if m.players = invalid then return
    connected = []
    for each p in m.players
        isConn = true
        if p.connected <> invalid then isConn = p.connected
        if isConn then connected.Push(p)
    end for

    if m.room <> invalid and (m.room.status = "board" or m.room.status = "podium") then
        renderScoreboard(connected)
    else
        renderLobbyPlayers(connected)
    end if
end sub

sub renderLobbyPlayers(list as object)
    wrap = m.top.findNode("lobbyPlayers")
    wrap.removeChildrenIndex(wrap.getChildCount(), 0)
    for each p in list
        lbl = CreateObject("roSGNode", "Label")
        lbl.text = p.avatar + "  " + p.name
        lbl.color = "0xFFFFFFFF"
        fnt = CreateObject("roSGNode", "Font")
        fnt.uri = "font:BoldSystemFontFile" : fnt.size = 40
        lbl.font = fnt
        wrap.appendChild(lbl)
    end for
end sub

sub renderScoreboard(list as object)
    setView("scores")
    title = "Marcador"
    if m.room.status = "podium" then title = "🏆 Resultado final"
    m.top.findNode("scoresTitle").text = title
    wrap = m.top.findNode("scoresList")
    wrap.removeChildrenIndex(wrap.getChildCount(), 0)

    n = list.Count()
    if n > 8 then n = 8
    for i = 0 to n - 1
        p = list[i]
        row = CreateObject("roSGNode", "Group")
        rect = CreateObject("roSGNode", "Rectangle")
        rect.width = 1120 : rect.height = 70
        if i = 0 then rect.color = "0xFFD25E44" else rect.color = "0xFFFFFF14"
        row.appendChild(rect)

        medal = Str(i + 1).Trim() + "º"
        if i = 0 then medal = "🥇"
        if i = 1 then medal = "🥈"
        if i = 2 then medal = "🥉"

        lbl = CreateObject("roSGNode", "Label")
        lbl.text = medal + "  " + p.avatar + "  " + p.name
        lbl.translation = [30, 14]
        lbl.color = "0xFFFFFFFF"
        f1 = CreateObject("roSGNode", "Font") : f1.uri = "font:BoldSystemFontFile" : f1.size = 40
        lbl.font = f1
        row.appendChild(lbl)

        pts = CreateObject("roSGNode", "Label")
        sc = 0
        if p.score <> invalid then sc = p.score
        pts.text = Str(sc).Trim()
        pts.translation = [980, 14]
        pts.width = 120 : pts.horizAlign = "right"
        pts.color = "0xFFD25EFF"
        f2 = CreateObject("roSGNode", "Font") : f2.uri = "font:BoldSystemFontFile" : f2.size = 40
        pts.font = f2
        row.appendChild(pts)

        row.translation = [0, i * 88]
        wrap.appendChild(row)
    end for
end sub

' ----------------------------------------------------------------------
' QR del lobby: la TV ya tiene internet, usamos un servicio de imagen QR.
' ----------------------------------------------------------------------
sub renderQR()
    url = m.cfg.webAppUrl
    if Right(url, 1) <> "/" then url = url + "/"
    joinUrl = url + "?sala=" + m.code
    encoded = urlEncode(joinUrl)
    qrImg = "https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=8&data=" + encoded
    m.top.findNode("qrPoster").uri = qrImg
end sub

' ----------------------------------------------------------------------
' Pausa
' ----------------------------------------------------------------------
sub togglePause()
    if m.room = invalid then return
    settings = m.room.settings
    cur = false
    if settings.paused <> invalid then cur = settings.paused
    newSettings = settings
    newSettings.paused = (not cur)
    m.net.params = { id: m.roomId, patch: { settings: newSettings } }
    m.net.op = "updateRoom"
    m.net.control = "RUN"
end sub

' ----------------------------------------------------------------------
' Utilidades
' ----------------------------------------------------------------------
function genNumericCode() as string
    r = Rnd(9000) + 1000
    return Str(r).Trim()
end function

function getNowMs() as double
    dt = CreateObject("roDateTime")
    return dt.asSeconds() * 1000.0 + dt.getMilliseconds()
end function

function urlEncode(s as string) as string
    o = CreateObject("roUrlTransfer")
    return o.escape(s)
end function

' El teléfono (control remoto) escribe settings.tvCmd = { key, t }.
' El Roku lo lee, ejecuta la tecla y recuerda el último 't' para no repetir.
sub handlePhoneRemote()
    settings = m.room.settings
    if settings = invalid or settings.tvCmd = invalid then return
    cmd = settings.tvCmd
    if cmd.t = invalid then return
    if m.lastCmdT <> invalid and cmd.t = m.lastCmdT then return
    m.lastCmdT = cmd.t
    k = cmd.key
    if k = invalid then return
    onKeyEvent(k, true)
end sub

sub showError(msg as string)
    m.top.findNode("qText").text = msg
    setView("question")
end sub
