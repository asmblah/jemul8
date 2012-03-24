;
; jemul8 - JavaScript x86 Emulator
; Copyright (c) 2012 http://ovms.co. All Rights Reserved.
; 
; MODULE: Flags test suite (boot sector)
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

; Intro banner
mov si, banner
call printmsg

; Test Carry Flag (CF)
testcf:
mov si, str_testcf
call printmsg
call setcf
jc passcf
call fail
jmp testpf
passcf:
call pass

; Test Parity Flag (PF)
testpf:
mov si, str_testpf
call printmsg
call setpf
jp passpf
call fail
jmp testaf
passpf:
call pass

; Test Auxiliary Flag (AF)
testaf:
; ???

; Test Zero Flag (ZF)
testzf:
mov si, str_testzf
call printmsg
call setzf
jz passzf
call fail
jmp testsf
passzf:
call pass

; Test Sign Flag (SF)
testsf:
mov si, str_testsf
call printmsg
call setsf
js passsf
call fail
jmp testof
passsf:
call pass

; Test Overflow Flag (OF)
testof:
mov si, str_testof
call printmsg
call setof
jo passof
call fail
jmp end_of_tests
passof:
call pass

end_of_tests:
; ===========

finished:
mov si, strdone
call printmsg
hang:
jmp hang

pass:
mov si, strgood
call printmsg
ret

fail:
mov si, strfail
call printmsg
ret

blankflags:
xor ax, ax
push ax
popf
ret

setcf:
stc
ret

setof:
pushf
pop ax
or ah, 00001000b
push ax
popf
ret

setsf:
pushf
pop ax
or al, 10000000b
push ax
popf
ret

setzf:
pushf
pop ax
or al, 01000000b
push ax
popf
ret

setpf:
pushf
pop ax
or al, 00000100b
push ax
popf
ret

printmsg:
mov ah, 0Eh
cld
lodsb
cmp al, 0
jz done
int 10h
jmp printmsg
done:
ret

banner db 'jemul8 flags test',13,10,13,10,0
str_testcf  db 'CF: ',0
str_testpf  db 'PF: ',0
str_testaf  db 'AF: ',0
str_testzf  db 'ZF: ',0
str_testsf  db 'SF: ',0
str_testof  db 'OF: ',0

;strjc  db 'Testing JC/JB/JNAE (jump if CF=1)... ',0
;strjnc db 'Testing JNC/JNB/JAE (jump if CF=0)... ',0
;strjz  db 'Testing JZ/JE (jump if ZF=1)... ',0
;strjnz db 'Testing JNZ/JNE (jump if ZF=0)... ',0
;strjs  db 'Testing JS (jump if SF=1)... ',0
;strjns db 'Testing JNS (jump if SF=0)... ',0
;strjo  db 'Testing JO (jump if OF=1)... ',0
;strjno db 'Testing JNO (jump if OF=0)... ',0
;strjp  db 'Testing JP/JPE (jump if PF=1)... ',0
;strjnp db 'Testing JNP/JPO (jump if PF=0)... ',0
;strja  db 'Testing JA/JNBE (jump if CF=0 and ZF=0)... ',0
;strjbe db 'Testing JBE/JNA (jump if CF=1 or ZF=1)... ',0
;strjg  db 'Testing JG/JNLE (jump if SF=OF and ZF=0)... ',0
;strjge db 'Testing JGE/JNL (jump if SF=OF)... ',0
;strjl  db 'Testing JL/JNGE (jump if SF<>OF)... ',0
;strjle db 'Testing JLE/JNG (jump if SF<>OF or ZF=1)... ',0
strdone db 'Done.',0

strgood db 'passed!',13,10,0
strfail db 'FAILED!',13,10,0
