jemul8
======

An object-oriented JavaScript x86 Emulator

jemul8 takes an object-oriented approach to emulation. Primarily an educational tool, it aims to provide
a detailed description of the internal workings of an IBM-compatible PC.

It is built using the easy-to-use language JavaScript, so it may be picked up and tweaked by even
the amateur programmer.

It aims to reflect computer science concepts, such as Fetch-Decode-Execute, in a largely abstract context,
although the only instruction set currently supported is Intel's IA-32/x86 architecture.

Live demo
---------

[http://asmblah.github.com/jemul8](http://asmblah.github.com/jemul8)

A simple example of instantiating the emulator:
-----------------------------------------------

```javascript
var emu = new jemul8( {
    "floppy0.driveType":
        "FDD_350HD"
        //"FDD_525HD"
    , "floppy0.diskType":
        "FLOPPY_1_44"
        //"FLOPPY_160K"
    , "floppy0.path":
        "boot/mikeos/mikeos-4.3/disk_images/mikeos.flp"
    , "floppy0.status": true
} );

emu.init(function () {
    emu.run();
}, function () {
    // Load failed
});
```
