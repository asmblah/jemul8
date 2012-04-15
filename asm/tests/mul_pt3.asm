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

;****** specifying the destination register - 32 bit result
MOV EDX,-1             ;put -1 into edx
MOV EBX,-1             ;put -1 into ebx
IMUL EDX,EBX           ;edx*ebx result of 1 in edx

cmp edx, 1
jne fail13
call pass
jmp end13
fail13:
call fail
end13:

MOV EAX,-1             ;put -1 into eax
MOV EDX,-2             ;put -2 into ebx
IMUL EDX,EAX           ;edx*eax result of 2 in edx

cmp edx, 2
jne fail14
call pass
jmp end14
fail14:
call fail
end14:

;****** specifying the destination register and using immediate value - 2 operands
MOV ESI,-1             ;put -1 into esi
IMUL ESI,4             ;esi*4 result of -4 in esi

cmp esi, -4
jne fail15
call pass
jmp end15
fail15:
call fail
end15:

MOV EAX,-1             ;put -1 into eax
IMUL EAX,4             ;eax*4 result of -4 in eax

cmp eax, -4
jne fail16
call pass
jmp end16
fail16:
call fail
end16:

;****** specifying the destination register and using immediate value - 3 operands
MOV EBX,-1             ;put -1 into ebx
IMUL EDX,EBX,4         ;ebx*4 result of -4 in edx

cmp edx, -4
jne fail17
call pass
jmp end17
fail17:
call fail
end17:

MOV EAX,-1             ;put -1 into eax
IMUL EDX,EAX,5         ;eax*5 result of -5 in edx

cmp edx, -5
jne fail18
call pass
jmp end18
fail18:
call fail
end18:

;****** using same source and destination registers
MOV EDX,-2             ;put -2 into ebx
IMUL EDX,EDX           ;edx*edx result of 4 in edx

cmp edx, 4
jne fail19
call pass
jmp end19
fail19:
call fail
end19:

MOV EAX,-1             ;put -1 into eax
IMUL EAX,EAX,5         ;eax*5 result of -5 in eax

cmp eax, -5
jne fail20
call pass
jmp end20
fail20:
call fail
end20:

;****** showing smaller code for multipliers between -128 and +127
MOV EAX,1111h          ;4369 decimal
IMUL EAX,128           ;result is 88880h (559,232)

cmp eax, 0x88880
jne fail21
call pass
jmp end21
fail21:
call fail
end21:

MOV EAX,1111h          ;4369 decimal
IMUL EAX,-129          ;result is 0FFF7666Fh (-563,601)

cmp eax, 0xFFF7666F
jne fail22
call pass
jmp end22
fail22:
call fail
end22:

MOV EAX,1111h          ;4369 decimal
IMUL EAX,127           ;result is 8776Fh (554,863)

cmp eax, 0x8776F
jne fail23
call pass
jmp end23
fail23:
call fail
end23:

MOV EAX,1111h          ;4369 decimal
IMUL EAX,-128          ;result is 0FFF77780h (-559,232)

cmp eax, 0xFFF77780
jne fail24
call pass
jmp end24
fail24:
call fail
end24:


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

mulBanner db 'jemul8 MUL/IMUL Test (Part 3)',13,10,0

passMsg db '.',0
failMsg db 'E',0

doneMsg db 13,10,'Done.',0

; ==== End of code ====

; Make the file 512 bytes long
TIMES 510-($-$$) DB 0 

; Add the boot signature
dw 0AA55h
