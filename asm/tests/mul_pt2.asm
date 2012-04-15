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

;*********** multiply +1 and -1 result should be -1
;****** byte operation
;mov si, mulTestByte2
;call printMsg
MOV AL,1               ;put +1 into al
MOV AH,-1              ;put -1 into ah
MUL AH                 ;ordinary mul - result of 0FFh (255) in ax

cmp ax, 0xFF
jne fail7
call pass
jmp end7
fail7:
call fail
end7:

MOV AL,1               ;put +1 into al
MOV AH,-1              ;put -1 into ah
IMUL AH                ;signed mul - result of 0FFFFh in ax - correct

cmp ax, 0xFFFF
jne fail8
call pass
jmp end8
fail8:
call fail
end8:

;****** word operation
;mov si, mulTestWord2
;call printMsg
MOV AX,1               ;put 1 into ax
MOV BX,-1              ;put -1 into bx
MUL BX                 ;ordinary mul - result of 0000:FFFF in dx:ax

cmp dx, 0
jne fail9
cmp ax, 0xFFFF
jne fail9
call pass
jmp end9
fail9:
call fail
end9:

MOV AX,1               ;put 1 into ax
MOV BX,-1              ;put -1 into bx
IMUL BX                ;signed mul - result of FFFF:FFFF in dx:ax - correct

cmp dx, 0xFFFF
jne fail10
cmp ax, 0xFFFF
jne fail10
call pass
jmp end10
fail10:
call fail
end10:

;****** dword operation
;mov si, mulTestDword2
;call printMsg
MOV EAX,1              ;put 1 into eax
MOV EBX,-1             ;put -1 into ebx
MUL EBX                ;ordinary mul - result of 00000000:FFFFFFFF in edx:eax

cmp edx, 0
jne fail11
cmp eax, 0xFFFFFFFF
jne fail11
call pass
jmp end11
fail11:
call fail
end11:

MOV EAX,1              ;put 1 into eax
MOV EBX,-1             ;put -1 into ebx
IMUL EBX               ;signed mul - result of FFFFFFFF:FFFFFFFF in edx:eax - correct

cmp edx, 0xFFFFFFFF
jne fail12
cmp eax, 0xFFFFFFFF
jne fail12
call pass
jmp end12
fail12:
call fail
end12:

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

mulBanner db 'jemul8 MUL/IMUL Test (Part 2)',13,10,0

passMsg db '.',0
failMsg db 'E',0

doneMsg db 13,10,'Done.',0

; ==== End of code ====

; Make the file 512 bytes long
TIMES 510-($-$$) DB 0 

; Add the boot signature
dw 0AA55h
