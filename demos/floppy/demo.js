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
        driveType = environment.getOption("driveType"),
        diskType = environment.getOption("diskType"),
        emulator,
        path = environment.getOption("flp");

    if (!driveType) {
        throw new Error("Argument 'driveType' is missing");
    }

    if (!diskType) {
        throw new Error("Argument 'diskType' is missing");
    }

    if (!path) {
        throw new Error("Argument 'flp' is missing");
    }

    emulator = jemul8.createEmulator({
        "cmos": {
            "bios": "docs/bochs-20100605/bios/BIOS-bochs-legacy"
        },
        "vga": {
            "bios": "docs/bochs-20100605/bios/VGABIOS-lgpl-latest"
        },
        "floppy": [{
            "driveType": driveType,
            "diskType": diskType,
            "path": "../../boot/" + path,
            "loaded": true
        }],
        "ne2k": {
            "ioAddress": 0x300,
            "irq": 3
        }
    });

    emulator.loadPlugin("canvas.vga.renderer");
    emulator.loadPlugin("keyboard.input");
    emulator.loadPlugin("network.loopback");

    emulator.init().done(function () {
        emulator.run();
    });
});
