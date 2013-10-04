;
; jemul8 - JavaScript x86 Emulator
; Copyright (c) 2013 http://jemul8.com. All Rights Reserved.
;
; MODULE: Tests for CPU stack handling - x86 POP instruction
;

%include '../../tools.inc'

; Jump over data
jmp main

; --- Data ---

; Test descriptions
test1 db "should increase SP by 2 when a 16-bit value is popped",0

; --- Tests ---

main:

; Ready to begin testing
cmp ax, 0
if e
    mov si, test1
    call print_description

    ; Save initial stack pointer
    mov bx, sp

    ; Pop an 8-bit value: it should be zero-extended to 16-bit
    pop ax

    ; Save stack pointer after pop
    mov cx, sp

    ; Add 2 to initial stack pointer, leaving expected CX in AX
    mov ax, bx
    add ax, 2

    ; Restore stack pointer
    mov sp, bx

    cmp cx, ax
    if e
        call pass
    else
        call fail
    endif
    jmp done
endif
call finished
jmp done
