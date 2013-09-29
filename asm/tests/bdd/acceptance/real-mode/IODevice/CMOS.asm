;
; jemul8 - JavaScript x86 Emulator
; Copyright (c) 2013 http://jemul8.com. All Rights Reserved.
;
; MODULE: Tests for CMOS I/O device
;

TEST_PORT equ 0x404

org 0x0100

cli

; Create stack
mov [axBackup], ax
mov ax, 0x0000
mov ss, ax
mov sp, 0xFFFD
mov ax, [axBackup]

; ======== Block macros ========
; From http://www.nasm.us/doc/nasmdoc4.html
%macro if 1
    %push if
    j%-1 %$ifnot
%endmacro
%macro else 0
    %ifctx if
        %repl else
        jmp %$ifend
        %$ifnot:
    %else
        %error "expected `if' before `else'"
    %endif
%endmacro
%macro endif 0
    %ifctx if
        %$ifnot:
        %pop
    %elifctx else
        %$ifend:
        %pop
    %else
        %error "expected `if' or `else' before `endif'"
    %endif
%endmacro
; ======== /Block macros ========

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

; Passed a test
pass:
mov ax, 0
ret

; Failed a test
fail:
mov ax, 1
ret

; Finished all tests
finished:
mov ax, 2
ret

; Done
done:
hlt
jmp done

get_length:
xor cx, cx
push si
.next_char
cmp byte [ds:si], 0
if ne
    inc si
    inc cx
    jmp .next_char
endif
pop si
ret

print_description:
call get_length
mov dx, TEST_PORT
repe outsb
ret

; Data
axBackup dw 0x0000

; Test descriptions
test1 db "should return 0xFF when reading index port 0x70",0
test2 db "should return 0x04 when reading minute register when minute is 4",0
