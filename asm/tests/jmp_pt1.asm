;
; jemul8 - JavaScript x86 Emulator
; Copyright (c) 2012 http://ovms.co. All Rights Reserved.
; 
; MODULE: Jump test suite (boot sector)
;

org 0

jmp 0x07C0:start
start:
cli
; Update DS & ES to be 7C0 instead of 0
push CS
pop DS
push CS
pop ES

; Create stack
mov ax, 0x0000
mov ss, ax
mov sp, 0xFFFD

mov si, banner
call printMsg

; ==== Start ====
jmp TYPESOF_JMPSCALLS

TESTCALL:
XOR EAX,EAX
RET
;
TESTJMP:
XOR EAX,EAX
JMP L10
TESTJMP1:
XOR EAX,EAX
JMP L11
TESTJMP2:
XOR EAX,EAX
OR EDX,EDX
JZ L12
JMP L13
;
TYPESOF_JMPSCALLS:
JMP TESTJMP             ;jump to symbol direct
L10:
MOV EAX, TESTJMP1
JMP EAX                 ;jump to symbol direct via register
L11:
MOV EAX, TESTJMP2
MOV [KEEP],EAX
XOR EDX,EDX
JMP [KEEP]              ;jump to symbol indirect
L12:
MOV EAX, KEEP
INC EDX
JMP [EAX]               ;jump to symbol indirect via register
L13:
CALL TESTCALL           ;call to symbol direct
MOV EAX, TESTCALL
CALL EAX                ;call to symbol direct via register
MOV EAX, TESTCALL
MOV [KEEP],EAX
CALL [KEEP]             ;call to symbol indirect
MOV EAX, KEEP
CALL [EAX]              ;call to symbol indirect via register
;RET

; All stop when done
mov si, doneMsg
call printMsg
finished:
hlt
jmp finished;

printMsg:
mov ah, 0Eh
cld
lodsb
cmp al, 0
jz done
int 10h
jmp printMsg
done:
ret

pass:
mov si, passMsg
call printMsg
ret

fail:
mov si, failMsg
call printMsg
ret

KEEP dd 0
banner db 13,10,'jemul8 JMP Test (Part 1)',13,10,0

passMsg db '.',0
failMsg db 'E',0

doneMsg db 13,10,'Done.',0

; ==== End of code ====

; Make the file 512 bytes long
TIMES 510-($-$$) DB 0 

; Add the boot signature
dw 0AA55h
