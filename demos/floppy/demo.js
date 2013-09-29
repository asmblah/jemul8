/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

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
                "bios": "../../docs/bochs-20100605/bios/BIOS-bochs-legacy"
            },
            "vga": {
                "bios": "../../docs/bochs-20100605/bios/VGABIOS-lgpl-latest"
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
