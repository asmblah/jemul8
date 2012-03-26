;*************************************************************************
[BITS 16]
ORG 0
jmp     START

OEM_ID                db "QUASI-OS"
BytesPerSector        dw 0x0200
SectorsPerCluster     db 0x01
ReservedSectors       dw 0x0001
TotalFATs             db 0x02
MaxRootEntries        dw 0x00E0
TotalSectorsSmall     dw 0x0B40
MediaDescriptor       db 0xF0
SectorsPerFAT         dw 0x0009
SectorsPerTrack       dw 0x0012
NumHeads              dw 0x0002
HiddenSectors         dd 0x00000000
TotalSectorsLarge     dd 0x00000000
DriveNumber           db 0x00
Flags                 db 0x00
Signature             db 0x29
VolumeID              dd 0xFFFFFFFF
VolumeLabel           db "QUASI  BOOT"
SystemID              db "FAT12   "

START:
; code located at 0000:7C00, adjust segment registers
     cli
     mov     ax, 0x07C0
     mov     ds, ax
     mov     es, ax
     mov     fs, ax
     mov     gs, ax
; create stack
     mov     ax, 0x0000
     mov     ss, ax
     mov     sp, 0xFFFF
     sti
; post message
     mov     si, msgLoading
     call    DisplayMessage
LOAD_ROOT:
; compute size of root directory and store in "cx"
     xor     cx, cx
     xor     dx, dx
     mov     ax, 0x0020                          ; 32 byte directory entry
     mul     WORD [MaxRootEntries]               ; total size of directory
     div     WORD [BytesPerSector]               ; sectors used by directory
     xchg    ax, cx
; compute location of root directory and store in "ax"
     mov     al, BYTE [TotalFATs]                ; number of FATs
     mul     WORD [SectorsPerFAT]                ; sectors used by FATs
     add     ax, WORD [ReservedSectors]          ; adjust for bootsector
     mov     WORD [datasector], ax               ; base of root directory
     add     WORD [datasector], cx
; read root directory into memory (7C00:0200)
     mov     bx, 0x0200                          ; copy root dir above bootcode
     call    ReadSectors
; browse root directory for binary image
     mov     cx, WORD [MaxRootEntries]           ; load loop counter
     mov     di, 0x0200                          ; locate first root entry
.LOOP:
     push    cx
     mov     cx, 0x000B                          ; eleven character name
     mov     si, ImageName                       ; image name to find
     push    di
rep  cmpsb                                       ; test for entry match
     pop     di
     je      LOAD_FAT
     pop     cx
     add     di, 0x0020                          ; queue next directory entry
     loop    .LOOP
     jmp     FAILURE
LOAD_FAT:
; save starting cluster of boot image
     mov     si, msgCRLF
     call    DisplayMessage
     mov     dx, WORD [di + 0x001A]
     mov     WORD [cluster], dx                  ; file's first cluster
; compute size of FAT and store in "cx"
     xor     ax, ax
     mov     al, BYTE [TotalFATs]                ; number of FATs
     mul     WORD [SectorsPerFAT]                ; sectors used by FATs
     mov     cx, ax
; compute location of FAT and store in "ax"
     mov     ax, WORD [ReservedSectors]          ; adjust for bootsector
; read FAT into memory (7C00:0200)
     mov     bx, 0x0200                          ; copy FAT above bootcode
     call    ReadSectors
; read image file into memory (0050:0000)
     mov     si, msgCRLF
     call    DisplayMessage
     mov     ax, 0x0050
     mov     es, ax                              ; destination for image
     mov     bx, 0x0000                          ; destination for image
     push    bx
LOAD_IMAGE:
     mov     ax, WORD [cluster]                  ; cluster to read
     pop     bx                                  ; buffer to read into
     call    ClusterLBA                          ; convert cluster to LBA
     xor     cx, cx
     mov     cl, BYTE [SectorsPerCluster]        ; sectors to read
     call    ReadSectors
     push    bx
; compute next cluster
     mov     ax, WORD [cluster]                  ; identify current cluster
     mov     cx, ax                              ; copy current cluster
     mov     dx, ax                              ; copy current cluster
     shr     dx, 0x0001                          ; divide by two
     add     cx, dx                              ; sum for (3/2)
     mov     bx, 0x0200                          ; location of FAT in memory
     add     bx, cx                              ; index into FAT
     mov     dx, WORD [bx]                       ; read two bytes from FAT
     test    ax, 0x0001
     jnz     .ODD_CLUSTER
.EVEN_CLUSTER:
     and     dx, 0000111111111111b               ; take low twelve bits
    jmp     .DONE
.ODD_CLUSTER:
     shr     dx, 0x0004                          ; take high twelve bits
.DONE:
     mov     WORD [cluster], dx                  ; store new cluster
     cmp     dx, 0x0FF0                          ; test for end of file
     jb      LOAD_IMAGE
DONE:
     mov     si, msgCRLF
     call    DisplayMessage
     push    WORD 0x0050
     push    WORD 0x0000
     retf
FAILURE:
     mov     si, msgFailure
     call    DisplayMessage
     mov     ah, 0x00
     int     0x16                                ; await keypress
     int     0x19                                ; warm boot computer

;*************************************************************************
; PROCEDURE DisplayMessage
; display ASCIIZ string at "ds:si" via BIOS
;*************************************************************************
DisplayMessage:
     lodsb                                       ; load next character
     or      al, al                              ; test for NUL character
     jz      .DONE
     mov     ah, 0x0E                            ; BIOS teletype
     mov     bh, 0x00                            ; display page 0
     mov     bl, 0x07                            ; text attribute
     int     0x10                                ; invoke BIOS
     jmp     DisplayMessage
.DONE:
     ret

;*************************************************************************
; PROCEDURE ReadSectors
; reads "cx" sectors from disk starting at "ax" into memory location "es:bx"
;*************************************************************************
ReadSectors:
.MAIN
     mov     di, 0x0005                          ; five retries for error
.SECTORLOOP
     push    ax
     push    bx
     push    cx
     call    LBACHS
     mov     ah, 0x02                            ; BIOS read sector
     mov     al, 0x01                            ; read one sector
     mov     ch, BYTE [absoluteTrack]            ; track
     mov     cl, BYTE [absoluteSector]           ; sector
     mov     dh, BYTE [absoluteHead]             ; head
     mov     dl, BYTE [DriveNumber]              ; drive
     int     0x13                                ; invoke BIOS
     jnc     .SUCCESS                            ; test for read error
     xor     ax, ax                              ; BIOS reset disk
     int     0x13                                ; invoke BIOS
     dec     di                                  ; decrement error counter
     pop     cx
     pop     bx
     pop     ax
     jnz     .SECTORLOOP                         ; attempt to read again
     int     0x18
.SUCCESS
     mov     si, msgProgress
     call    DisplayMessage
     pop     cx
     pop     bx
     pop     ax
     add     bx, WORD [BytesPerSector]           ; queue next buffer
     inc     ax                                  ; queue next sector
     loop    .MAIN                               ; read next sector
     ret

;*************************************************************************
; PROCEDURE ClusterLBA
; convert FAT cluster into LBA addressing scheme
; LBA = (cluster - 2) * sectors per cluster
;*************************************************************************
ClusterLBA:
     sub     ax, 0x0002                          ; zero base cluster number
     xor     cx, cx
     mov     cl, BYTE [SectorsPerCluster]        ; convert byte to word
     mul     cx
     add     ax, WORD [datasector]               ; base data sector
     ret

;*************************************************************************
; PROCEDURE LBACHS
; convert LBA addressing scheme to CHS addressing scheme
; absolute sector = (logical sector / sectors per track) + 1
; absolute head   = (logical sector / sectors per track) MOD number of heads
; absolute track  = logical sector / (sectors per track * number of heads)
;*************************************************************************
LBACHS:
     xor     dx, dx                              ; prepare dx:ax for operation
     div     WORD [SectorsPerTrack]              ; calculate
     inc     dl                                  ; adjust for sector 0
     mov     BYTE [absoluteSector], dl
     xor     dx, dx                              ; prepare dx:ax for operation
     div     WORD [NumHeads]                     ; calculate
     mov     BYTE [absoluteHead], dl
     mov     BYTE [absoluteTrack], al
     ret

absoluteSector db 0x00
absoluteHead   db 0x00
absoluteTrack  db 0x00

datasector  dw 0x0000
cluster     dw 0x0000
ImageName   db "STAGE2  BIN"
msgLoading  db 0x0D, 0x0A, "Loading Boot Image ", 0x0D, 0x0A, 0x00
msgCRLF     db 0x0D, 0x0A, 0x00
msgProgress db ".", 0x00
msgFailure  db 0x0D, 0x0A, "ERROR : Press Any Key to Reboot", 0x00

     TIMES 510-($-$$) DB 0
     DW 0xAA55
;*************************************************************************