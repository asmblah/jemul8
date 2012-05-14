;
; jemul8 - JavaScript x86 Emulator
; Copyright (c) 2012 http://ovms.co. All Rights Reserved.
; 
; MODULE: String test suite (boot sector)
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

;mov si, banner
;call printMsg

; ==== Start ====
mov di, banner
mov al, 'S'
mov cx, 2+27+2
cld
repne scasb
cmp cx, 2+27+2 -2-8
jne fail1
cmp di, banner +2+8
jne fail1
call pass
jmp end1
fail1:
call fail
end1:

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
banner db 13,10,'jemul8 String Test (Part 1)',13,10,0

passMsg db '.',0
failMsg db 'E',0

doneMsg db 13,10,'Done.',0

; ==== End of code ====

; Make the file 512 bytes long
TIMES 510-($-$$) DB 0 

; Add the boot signature
dw 0AA55h
