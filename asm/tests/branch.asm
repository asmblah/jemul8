; branch.asm - A program to test the Intel 8086 CPU's
; various conditional branching operations. Designed to
; verify corrent functionality of my 8086 PC emulator, Fake86.

org 500h

%ifdef COMMENT
jmp 0x07C0:start
start:
cli
; update DS to be 7C0 instead of 0
push CS
pop DS
; update ES also
push CS
pop ES
%endif
; create stack
mov ax, 0x0000
mov ss, ax
mov sp, 0xFFFD

; ==== Start of code ====

mov si, banner
call printmsg

testjc:
mov si, strjc
call printmsg
call blankflags
call setcf
jc testjc2
call fail
jmp testjnc
testjc2:
call blankflags
mov bx, testjnc
push bx
jc fail
pop bx ;not used, just cleaning up the stack
call pass


testjnc:

finished:
ret

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

banner db '8086 CPU conditional branch test utility',13,10
       db 'Written on 3/4/2011 by Mike Chambers',13,10,13,10,0
strjc  db 'Testing JC/JB/JNAE (jump if CF=1)... ',0
strjnc db 'Testing JNC/JNB/JAE (jump if CF=0)... ',0
strjz  db 'Testing JZ/JE (jump if ZF=1)... ',0
strjnz db 'Testing JNZ/JNE (jump if ZF=0)... ',0
strjs  db 'Testing JS (jump if SF=1)... ',0
strjns db 'Testing JNS (jump if SF=0)... ',0
strjo  db 'Testing JO (jump if OF=1)... ',0
strjno db 'Testing JNO (jump if OF=0)... ',0
strjp  db 'Testing JP/JPE (jump if PF=1)... ',0
strjnp db 'Testing JNP/JPO (jump if PF=0)... ',0
strja  db 'Testing JA/JNBE (jump if CF=0 and ZF=0)... ',0
strjbe db 'Testing JBE/JNA (jump if CF=1 or ZF=1)... ',0
strjg  db 'Testing JG/JNLE (jump if SF=OF and ZF=0)... ',0
strjge db 'Testing JGE/JNL (jump if SF=OF)... ',0
strjl  db 'Testing JL/JNGE (jump if SF<>OF)... ',0
strjle db 'Testing JLE/JNG (jump if SF<>OF or ZF=1)... ',0

strgood db 'passed!',13,10,0
strfail db 'FAILED!',13,10,0

; ==== End of code ====

; Make the file 512 bytes long
;TIMES 510-($-$$) DB 0 

; Add the boot signature
;dw 0AA55h
