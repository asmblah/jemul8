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

;*********** multiply -1 and -1 result should be +1
;****** byte operation
MOV AL,-1              ;put -1 into al
MOV AH,-1              ;put -1 into ah
MUL AH                 ;ordinary mul - result of 0FE01h (65,025) in ax
MOV AL,-1              ;put -1 into al
MOV AH,-1              ;put -1 into ah
IMUL AH                ;signed mul - result of 1 in ax - correct
;****** word operation
MOV AX,-1              ;put -1 into ax
MOV BX,-1              ;put -1 into bx
MUL BX                 ;ordinary mul - result of FFFE:0001 in dx:ax
MOV AX,-1              ;put -1 into ax
MOV BX,-1              ;put -1 into bx
IMUL BX                ;signed mul - result of 0000:0001 dx:ax - correct
;****** dword operation
MOV EAX,-1             ;put -1 into eax
MOV EBX,-1             ;put -1 into ebx
MUL EBX                ;ordinary mul - result of FFFFFFFE:00000001 edx:eax
MOV EAX,-1             ;put -1 into eax
MOV EBX,-1             ;put -1 into ebx
IMUL EBX               ;signed mul - result of 00000000:00000001 in edx:eax - correct
;*********** multiply +1 and -1 result should be -1
;****** byte operation
MOV AL,1               ;put +1 into al
MOV AH,-1              ;put -1 into ah
MUL AH                 ;ordinary mul - result of 0FFh (255) in ax
MOV AL,1               ;put +1 into al
MOV AH,-1              ;put -1 into ah
IMUL AH                ;signed mul - result of 0FFFFh in ax - correct
;****** word operation
MOV AX,1               ;put 1 into ax
MOV BX,-1              ;put -1 into bx
MUL BX                 ;ordinary mul - result of 0000:FFFF in dx:ax
MOV AX,1               ;put 1 into ax
MOV BX,-1              ;put -1 into bx
IMUL BX                ;signed mul - result of FFFF:FFFF in dx:ax - correct
;****** dword operation
MOV EAX,1              ;put 1 into eax
MOV EBX,-1             ;put -1 into ebx
MUL EBX                ;ordinary mul - result of 00000000:FFFFFFFF in edx:eax
MOV EAX,1              ;put 1 into eax
MOV EBX,-1             ;put -1 into ebx
IMUL EBX               ;signed mul - result of FFFFFFFF:FFFFFFFF in edx:eax - correct
;****** specifying the destination register - 32 bit result
MOV EDX,-1             ;put -1 into edx
MOV EBX,-1             ;put -1 into ebx
IMUL EDX,EBX           ;edx*ebx result of 1 in edx
MOV EAX,-1             ;put -1 into eax
MOV EDX,-2             ;put -2 into ebx
IMUL EDX,EAX           ;edx*eax result of 2 in edx
;****** specifying the destination register and using immediate value - 2 operands
MOV ESI,-1             ;put -1 into esi
IMUL ESI,4             ;esi*4 result of -4 in esi
MOV EAX,-1             ;put -1 into eax
IMUL EAX,4             ;eax*4 result of -4 in eax
;****** specifying the destination register and using immediate value - 3 operands
MOV EBX,-1             ;put -1 into ebx
IMUL EDX,EBX,4         ;ebx*4 result of -4 in edx
MOV EAX,-1             ;put -1 into eax
IMUL EDX,EAX,5         ;eax*5 result of -5 in edx
;****** using same source and destination registers
MOV EDX,-2             ;put -2 into ebx
IMUL EDX,EDX           ;edx*edx result of 4 in edx
MOV EAX,-1             ;put -1 into eax
IMUL EAX,EAX,5         ;eax*5 result of -5 in eax
;****** showing smaller code for multipliers between -128 and +127
MOV EAX,1111h          ;4369 decimal
IMUL EAX,128           ;result is 88880h (559,232)
MOV EAX,1111h          ;4369 decimal
IMUL EAX,-129          ;result is 0FFF7666Fh (-563,601)
MOV EAX,1111h          ;4369 decimal
IMUL EAX,127           ;result is 8776Fh (554,863)
MOV EAX,1111h          ;4369 decimal
IMUL EAX,-128          ;result is 0FFF77780h (-559,232)

; ==== End of code ====

; Make the file 512 bytes long
TIMES 510-($-$$) DB 0 

; Add the boot signature
dw 0AA55h
