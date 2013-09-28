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

;mov si, divBanner
;call printMsg

;********************* IDIV demonstration
;*********** divide -21 by 5 result should be -4 remainder -1
;****** byte operation
MOV AX,-21             ;put -21 into AX for dividend
MOV BH,5               ;put 5 into BH for divisor
IDIV BH                ;divide AX by BH: AL=-4, AH=-1 - correct

cmp al, -4
jne fail1
cmp ah, -1
jne fail1
call pass
jmp end1
fail1:
call fail
end1:

;****** word operation
MOV DX,-1              ;sign extend -21 into higher order dividend
MOV AX,-21             ;put -21 into AX for lower order dividend
MOV BX,5               ;put 5 into BX for divisor
IDIV BX                ;divide DX:AX by BX: AX=-4, DX=-1 - correct

cmp ax, -4
jne fail2
cmp dx, -1
jne fail2
call pass
jmp end2
fail2:
call fail
end2:

;****** dword operation
MOV EDX,-1             ;sign extend -21 into higher order dividend
MOV EAX,-21            ;put -21 into EAX
MOV EBX,5              ;put 5 into EBX for divisor
IDIV EBX               ;divide EDX:EAX by EBX: EAX=-4, EDX=-1 - correct

cmp eax, -4
jne fail3
cmp edx, -1
jne fail3
call pass
jmp end3
fail3:
call fail
end3:

;*********** divide -21 by -5 result should be +4 remainder -1
;****** byte operation
MOV AX,-21             ;put -21 into AX for dividend
MOV BH,-5              ;put -5 into BH for divisor
IDIV BH                ;divide AX by BH: AL=4, AH=-1 - correct

cmp al, 4
jne fail4
cmp ah, -1
jne fail4
call pass
jmp end4
fail4:
call fail
end4:

;****** word operation
MOV DX,-1              ;sign extend -21 into higher order dividend
MOV AX,-21             ;put -21 into AX for lower order dividend
MOV BX,-5              ;put -5 into BX for divisor
IDIV BX                ;divide DX:AX by BX: AX=4, DX=-1 - correct

cmp ax, 4
jne fail5
cmp dx, -1
jne fail5
call pass
jmp end5
fail5:
call fail
end5:

;****** dword operation
MOV EDX,-1             ;sign extend -21 into higher order dividend
MOV EAX,-21            ;put -21 into EAX
MOV EBX,-5             ;put -5 into EBX for divisor
IDIV EBX               ;divide EDX:EAX by EBX: EAX=4, EDX=-1 - correct

cmp eax, 4
jne fail6
cmp edx, -1
jne fail6
call pass
jmp end6
fail6:
call fail
end6:

;*********** divide +21 by -5 result should be -4 remainder +1
;****** byte operation
MOV AX,21              ;put 21 into AX for dividend
MOV BH,-5              ;put -5 into BH for divisor
IDIV BH                ;divide AX by BH: AL=-4, AH=1 - correct

cmp al, -4
jne fail7
cmp ah, 1
jne fail7
call pass
jmp end7
fail7:
call fail
end7:

;****** word operation
MOV DX,0               ;sign extend 21 into higher order dividend
MOV AX,21              ;put 21 into AX for lower order dividend
MOV BX,-5              ;put -5 into BX for divisor
IDIV BX                ;divide DX:AX by BX: AX=-4, DX=1 - correct

cmp ax, -4
jne fail8
cmp dx, 1
jne fail8
call pass
jmp end8
fail8:
call fail
end8:

;****** dword operation
MOV EDX,0              ;sign extend 21 into higher order dividend
MOV EAX,21             ;put 21 into EAX
MOV EBX,-5             ;put -5 into EBX for divisor
IDIV EBX               ;divide EDX:EAX by EBX: EAX=-4, EDX=1 - correct

cmp eax, -4
jne fail9
cmp edx, 1
jne fail9
call pass
jmp end9
fail9:
call fail
end9:

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

divBanner db 13,10,'jemul8 DIV/IDIV Test (Part 1)',13,10,0

passMsg db '.',0
failMsg db 'E',0

doneMsg db 13,10,'Done.',0

; ==== End of code ====

; Make the file 512 bytes long
TIMES 510-($-$$) DB 0 

; Add the boot signature
dw 0AA55h
