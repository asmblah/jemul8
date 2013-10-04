;
; jemul8 - JavaScript x86 Emulator
; Copyright (c) 2013 http://jemul8.com. All Rights Reserved.
;
; MODULE: Tools for IODevice tests
;

TEST_PORT equ 0x404

org 0x0100

; Jump over data
jmp bootstrap

; --- Data ---

axBackup dw 0x0000

; --- Macros ---

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

; --- Functions ---

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
push bx
mov bx, 0
mov dx, TEST_PORT
repe outsb
pop bx
ret

; --- Bootstrap ---

bootstrap:

cli

; Create stack
mov [axBackup], ax
mov ax, 0x0000
mov ss, ax
mov sp, 0xFFFD
mov ax, [axBackup]
