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

mov si, mulBanner
call printMsg

;*********** multiply -1 and -1 result should be +1
;****** byte operation
;mov si, mulTestByte
;call printMsg
MOV AL,-1              ;put -1 into al
MOV AH,-1              ;put -1 into ah
MUL AH                 ;ordinary mul - result of 0FE01h (65,025) in ax

cmp ax, 0xFE01
jne fail1
call pass
jmp end1
fail1:
call fail
end1:

MOV AL,-1              ;put -1 into al
MOV AH,-1              ;put -1 into ah
IMUL AH                ;signed mul - result of 1 in ax - correct

cmp ax, 1
jne fail2
call pass
jmp end2
fail2:
call fail
end2:

;****** word operation
;mov si, mulTestWord
;call printMsg
MOV AX,-1              ;put -1 into ax
MOV BX,-1              ;put -1 into bx
MUL BX                 ;ordinary mul - result of FFFE:0001 in dx:ax

cmp dx, 0xFFFE
jne fail3
cmp ax, 1
jne fail3
call pass
jmp end3
fail3:
call fail
end3:

MOV AX,-1              ;put -1 into ax
MOV BX,-1              ;put -1 into bx
IMUL BX                ;signed mul - result of 0000:0001 dx:ax - correct

cmp dx, 0
jne fail4
cmp ax, 1
jne fail4
call pass
jmp end4
fail4:
call fail
end4:

;****** dword operation
;mov si, mulTestDword
;call printMsg
MOV EAX,-1             ;put -1 into eax
MOV EBX,-1             ;put -1 into ebx
MUL EBX                ;ordinary mul - result of FFFFFFFE:00000001 edx:eax

cmp edx, 0xFFFFFFFE
jne fail5
cmp eax, 1
jne fail5
call pass
jmp end5
fail5:
call fail
end5:

MOV EAX,-1             ;put -1 into eax
MOV EBX,-1             ;put -1 into ebx
IMUL EBX               ;signed mul - result of 00000000:00000001 in edx:eax - correct

cmp edx, 0
jne fail6
cmp eax, 1
jne fail6
call pass
jmp end6
fail6:
call fail
end6:

; All stop when done
mov si, doneMsg
call printMsg
finished:
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

mulBanner db 'jemul8 MUL/IMUL Test (Part 1)',13,10,0

passMsg db '.',0
failMsg db 'E',0

doneMsg db 13,10,'Done.',0

; ==== End of code ====

; Make the file 512 bytes long
TIMES 510-($-$$) DB 0 

; Add the boot signature
dw 0AA55h
