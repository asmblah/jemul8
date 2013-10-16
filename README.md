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

[http://jemul8.com](http://jemul8.com)

Run the tests
-------------

Node that you will need `nasm` available in your PATH for the tests to execute.

- Under Node.js

    From the project root, simply run `npm test`.

- In the browser

    From the project root, run `npm run-script webtest` and visit the URL provided in the output.

A simple example of instantiating the emulator (AMD)
----------------------------------------------------

```javascript
/*global define */
define({
    cache: false
}, [
    "../../jemul8"
], function (
    jemul8
) {
    "use strict";

    var environment = jemul8.getEnvironment(),
        emulator = jemul8.createEmulator({
            "cmos": {
                "bios": "docs/bochs-20100605/bios/BIOS-bochs-legacy"
            },
            "vga": {
                "bios": "docs/bochs-20100605/bios/VGABIOS-lgpl-latest"
            },
            "floppy": [{
                "driveType": "FDD_350HD",
                "diskType": "FLOPPY_1_44",
                "path": "../../boot/" + environment.getOption("flp"),
                "loaded": true
            }]
        });

    emulator.loadPlugin("canvas.vga.renderer");
    emulator.loadPlugin("keyboard.input");

    emulator.init().done(function () {
        emulator.run();
    });
});
```
