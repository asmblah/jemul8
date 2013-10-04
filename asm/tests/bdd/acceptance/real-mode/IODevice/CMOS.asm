;
; jemul8 - JavaScript x86 Emulator
; Copyright (c) 2013 http://jemul8.com. All Rights Reserved.
;
; MODULE: Tests for CMOS I/O device
;

%include '../tools.inc'

; Jump over data
jmp main

; --- Data ---

; Test descriptions
test1 db "should return 0xFF when reading index port 0x70",0
test2 db "should return 0x04 when reading minute register when minute is 4",0

; --- Tests ---

main:

; Ready to begin testing
cmp ax, 0
if e
    mov si, test1
    call print_description

    mov dx, 0x70
    in al, dx
    cmp al, 0xFF
    if e
        call pass
    else
        call fail
    endif
    jmp done
endif
cmp ax, 1
if e
    mov si, test2
    call print_description

    ; Select minute register with index port
    mov al, 2
    mov dx, 0x70
    out dx, al

    ; Write to data port, to write to minute register
    mov al, 4
    mov dx, 0x71
    out dx, al

    ; Select minute register with index port
    mov al, 2
    mov dx, 0x70
    out dx, al

    ; Read from data port
    mov dx, 0x71
    in al, dx
    cmp al, 4
    if e
        call pass
    else
        call fail
    endif
    jmp done
endif
call finished
jmp done
