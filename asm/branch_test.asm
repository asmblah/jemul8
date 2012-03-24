; branch.asm - A program to test the Intel 8086 CPU's
; various conditional branching operations. Designed to
; verify corrent functionality of my 8086 PC emulator, Fake86.

org 500h

%ifdef COMMENT
jmp 0x07C0:start
start:
; update DS to be 7C0 instead of 0
push	 CS
pop DS
; update ES also
push	 CS
pop ES
%endif
; create stack
mov ax, 0x0000
mov ss, ax
mov sp, 0xFFFD


; ==== Start of code ====

cli
push cs
pop ds

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

%ifdef COMMENT
mov si, strjnc
call printmsg
call blankflags
jnc testjnc2
call fail
jmp testjz
testjnc2:
call blankflags
call setcf
mov bx, testjz
push bx
jnc fail
pop bx
call pass


testjz:
mov si, strjz
call printmsg
call blankflags
call setzf
jz testjz2
call fail
jmp testjnz
testjz2:
call blankflags
mov bx, testjnz
push bx
jz fail
pop bx
call pass


testjnz:
mov si, strjnz
call printmsg
call blankflags
jnz testjnz2
call fail
jmp testjs
testjnz2:
call blankflags
call setzf
mov bx, testjs
push bx
jnz fail
pop bx
call pass


testjs:
mov si, strjs
call printmsg
call blankflags
call setsf
js testjs2
call fail
jmp testjns
testjs2:
call blankflags
mov bx, testjns
push bx
js fail
pop bx
call pass


testjns:
mov si, strjns
call printmsg
call blankflags
jns testjns2
call fail
jmp testjo
testjns2:
call blankflags
call setsf
mov bx, testjo
push bx
jns fail
pop bx
call pass


testjo:
mov si, strjo
call printmsg
call blankflags
call setof
jo testjo2
call fail
jmp testjno
testjo2:
call blankflags
mov bx, testjno
push bx
jo fail
pop bx
call pass


testjno:
mov si, strjno
call printmsg
call blankflags
jno testjno2
call fail
jmp testjp
testjno2:
call blankflags
call setof
mov bx, testjp
push bx
jno fail
pop bx
call pass


testjp:
mov si, strjp
call printmsg
call blankflags
call setpf
jp testjp2
call fail
jmp testjnp
testjp2:
call blankflags
mov bx, testjnp
push bx
jp fail
pop bx
call pass


testjnp:
mov si, strjnp
call printmsg
call blankflags
jnp testjnp2
call fail
jmp testja
testjnp2:
call blankflags
call setpf
mov bx, testja
push bx
jnp fail
pop bx
call pass


testja:
mov si, strja
call printmsg
call blankflags ;case 1
ja testja2
call fail
jmp testjbe
testja2: ;case 2
call blankflags
call setcf
mov bx, testjbe
push bx
ja fail
pop bx
testja3:
call blankflags
call setzf
mov bx, testjbe
push bx
ja fail
pop bx
testja4:
call blankflags
call setcf
call setzf
mov bx, testjbe
push bx
ja fail
pop bx
call pass


testjbe:
mov si, strjbe
call printmsg
call blankflags ;case 1
call setcf
jbe testjbe2
call fail
jmp testjg
testjbe2:
call blankflags
call setzf
jbe testjbe3
call fail
jmp testjg
testjbe3:
call blankflags
call setcf
call setzf
jbe testjbe4
call fail
jmp testjg
testjbe4:
call blankflags
mov bx, testjg
push bx
jbe fail
pop bx
call pass


testjg:
mov si, strjg
call printmsg
call blankflags
jg testjg2
call fail
jmp testjge
testjg2:
call blankflags
call setzf
mov bx, testjge
push bx
jg fail
pop bx
testjg3:
call blankflags
call setsf
call setzf
mov bx, testjge
push bx
jg fail
pop bx
testjg4:
call blankflags
call setof
call setzf
mov bx, testjge
push bx
jg fail
pop bx
testjg5:
call blankflags
call setsf
call setof
call setzf
mov bx, testjge
push bx
jg fail
pop bx
testjg6:
call blankflags
call setsf
call setof
mov bx, testjge
push bx
jg pass
pop bx
call fail


testjge:
mov si, strjge
call printmsg
call blankflags
jge testjge2
call fail
jmp testjl
testjge2:
call blankflags
call setsf
mov bx, testjl
push bx
jge fail
pop bx
testjge3:
call blankflags
call setof
mov bx, testjl
push bx
jge fail
pop bx
call pass


testjl:
mov si, strjl
call printmsg
call blankflags
call setsf
jl testjl2
call fail
jmp testjle
testjl2:
call blankflags
call setof
jl testjl3
call fail
jmp testjle
testjl3:
call blankflags
call setsf
call setof
mov bx, testjle
push bx
jl fail
pop bx
testjl4:
call blankflags
mov bx, testjle
push bx
jl fail
pop bx
call pass


testjle:
mov si, strjle
call printmsg
call blankflags
call setzf
jle testjle2
call fail
jmp finished
testjle2:
call blankflags
call setsf
jle testjle3
call fail
jmp finished
testjle3:
call blankflags
call setof
jle testjle4
call fail
jmp finished
testjle4:
call blankflags
call setsf
call setzf
jle testjle5
call fail
jmp finished
testjle5:
call blankflags
call setof
call setzf
jle testjle6
call fail
jmp finished
testjle6:
call blankflags
call setsf
call setof
call setzf
jle testjle7
call fail
jmp finished
testjle7:
call blankflags
mov bx, finished
push bx
jle fail
call pass
%endif

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
