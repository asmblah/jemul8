;
; jemul8 - JavaScript x86 Emulator
; Copyright (c) 2013 http://jemul8.com. All Rights Reserved.
;
; MODULE: Tests for CPU stack handling - x86 PUSH instruction
;

%include '../../tools.inc'

; Jump over data
jmp main

; --- Data ---

; Test descriptions
test1 db "should decrease SP by 2 when an 8-bit value is pushed",0
test2 db "should decrease SP by 2 when a 16-bit value is pushed",0

; --- Tests ---

main:

; Ready to begin testing
cmp ax, 0
if e
    mov si, test1
    call print_description

    ; Save initial stack pointer
    mov bx, sp

    ; Push an 8-bit value: it should be zero-extended to 16-bit
    push 0x12

    ; Save stack pointer after push
    mov cx, sp

    ; Subtract 2 from initial stack pointer, leaving expected CX in AX
    mov ax, bx
    sub ax, 2

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
cmp ax, 1
if e
    mov si, test2
    call print_description

    ; Save initial stack pointer
    mov bx, sp

    mov ax, 0x1234
    push ax

    ; Save stack pointer after push
    mov cx, sp

    ; Subtract 2 from initial stack pointer, leaving expected CX in AX
    mov ax, bx
    sub ax, 2

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
