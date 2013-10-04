;
; jemul8 - JavaScript x86 Emulator
; Copyright (c) 2013 http://jemul8.com. All Rights Reserved.
;
; MODULE: Tests for PIT I/O device
;

%include '../tools.inc'

; Jump over data
jmp main

; --- Data ---

; Test descriptions
test1 db "should not have triggered IRQ0 after 10 milliseconds when the timer is disabled",0
test2 db "should have triggered IRQ0 once after 10 milliseconds when the timer is enabled with 10ms interval",0

; --- Tests ---

main:

; Ready to begin testing
cmp ax, 0
if e
    mov si, test1
    call print_description

    mov bx, 10000
    call tick_pit
    call get_irq0_calls
    cmp ax, 0
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

    ; Control Word first
    ; - Binary counting, Mode 3, Read or Load LSB first then MSB, Channel 0 (for IRQ 0)
    mov al, 110110b
    out 0x43, al

    ; Then configure counter
    ; - 100hz, or 10 milliseconds
    mov ax, 1193180 / 100
    out 0x40, al   ; LSB
    xchg ah, al
    out 0x40, al   ; MSB

    mov cx, 10000
    call tick_pit
    call get_irq0_calls
    cmp ax, 1
    if e
        call pass
    else
        call fail
    endif
    jmp done
endif
call finished
jmp done

; --- Functions ---

tick_pit:
mov bx, 1
mov dx, TEST_PORT
; Number of milliseconds to tick is specified in CX
mov ax, cx
out dx, ax
ret

get_irq0_calls:
mov bx, 2
mov dx, TEST_PORT
out dx, al
ret
