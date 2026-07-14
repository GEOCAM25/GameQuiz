' ======================================================================
' GAME QUIZ Roku — Punto de entrada
' Crea la escena principal y arranca el canal.
' ======================================================================
sub Main(args as dynamic)
    screen = CreateObject("roSGScreen")
    m.port = CreateObject("roMessagePort")
    screen.setMessagePort(m.port)

    scene = screen.CreateScene("MainScene")
    screen.show()

    ' Si el canal se abrió con parámetros (deep link), se los pasamos a la escena
    if args <> invalid and args.contentId <> invalid then
        scene.launchArgs = args
    end if

    while true
        msg = wait(0, m.port)
        msgType = type(msg)
        if msgType = "roSGScreenEvent" then
            if msg.isScreenClosed() then return
        end if
    end while
end sub
