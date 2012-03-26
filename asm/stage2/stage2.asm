org 0

; Use Code segment as Data segment
push cs
pop ds

mov si, textLoad
call DisplayMessageZ

mov si, textNewline
call DisplayMessageZ

;mov si, textBanner
;call DisplayMessageZ

mov si, textNewline
call DisplayMessageZ
mov cx, dx

; List ASCII characters
xor cx, cx
call NEXT_CHAR

; Key test
jmp NEXT_KEY

; Finish by just hanging computer
HANG:
jmp HANG

; Message is at DS:SI, read up to NUL char
DisplayMessageZ:
     lodsb							; load next character
     or	al, al						; test for NUL character
     jz	.DONE
     mov ah, 0x0E					; BIOS teletype
     mov bh, 0x00					; display page 0
     mov bl, 0x07					; text attribute
     int 0x10						; invoke BIOS
     jmp DisplayMessageZ
.DONE:
     ret

; Message is at DS:SI, read CX chars
DisplayMessageX:
	lodsb							; load next character
	or al, al						; test for NUL character
	jz .DONE
	mov	ah, 0x0E					; BIOS teletype
	mov	bh, 0x00					; display page 0
	mov	bl, 0x07					; text attribute
	int	0x10						; invoke BIOS
	loop DisplayMessageX
.DONE:
	ret

; Display one char, in AL
DisplayChar:
	mov ah, 0x0E					; BIOS teletype
	mov bh, 0x00					; Display on page 0
	mov bl, 0x07					; Char attribute byte
	int 0x10
	ret

NEXT_KEY:
	; Wait for keystroke
	xor ax, ax
	int 0x16
	; Echo character from key pressed
	call DisplayChar
	; Get next keystroke
	jmp NEXT_KEY

NEXT_CHAR:
	cmp cl, 0x10	; See if we are at end of row yet
	jne PRINT_CHAR
	
	mov dx, cx		; Save CL & CH
	mov si, textNewline
	call DisplayMessageZ
	mov cx, dx
	xor cl, cl		; Restore CL & CH
	
	; End of a row ( CH indicates row )
	inc ch
	cmp ch, 0x10
	jne NEXT_CHAR
	ret	; Return from procedure after last row
	
PRINT_CHAR:
	mov al, ch
	mov dl, 0x10
	mul dl
	add al, cl
	
	; ============= Ensure character is not newline or ( destructive ) backspace =============
	cmp al, 0x0D
	jne NOT_CR
	mov al, 0x01
	NOT_CR:
	cmp al, 0x0A
	jne NOT_LF
	mov al, 0x01
	NOT_LF:
	cmp al, 0x08
	jne NOT_BS
	mov al, 0x01
	NOT_BS:
	; ============= /Ensure character is not newline or ( destructive ) backspace =============
	
	xor ah, ah
	call DisplayChar
	
	; Next column in current row
	inc cl
	
	jmp NEXT_CHAR

textLoad db "Boot stage 2 - Character echo test", 0x00
textBanner db "Type below to test the keyboard layout:", 0x00
textNewline db 0x0D, 0x0A, 0x00

TIMES 512-($-$$) DB 0



