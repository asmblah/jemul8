org 0

; Use Code segment as Data segment
push cs
pop ds

mov si, textError
call DisplayMessage

mov si, textNewline
call DisplayMessage

HANG:
jmp HANG

;*************************************************************************
; PROCEDURE DisplayMessage
; display ASCIIZ string at "ds:si" via BIOS
;*************************************************************************
DisplayMessage:
     lodsb                                       ; load next character
     or      al, al                              ; test for NUL character
     jz      .DONE
     mov     ah, 0x0E                            ; BIOS teletype
     mov     bh, 0x00                            ; display page 0
     mov     bl, 0x07                            ; text attribute
     int     0x10                                ; invoke BIOS
     jmp     DisplayMessage
.DONE:
     ret


textError db "Boot stage 2 - Hello!", 0x00
textNewline db 0x0D, 0x0A, 0x00

TIMES 512-($-$$) DB 0
