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
        driveType1 = environment.getOption("driveType"),
        driveType2 = environment.getOption("driveType2"),
        diskType1 = environment.getOption("diskType"),
        diskType2 = environment.getOption("diskType2"),
        emulator,
        floppyConfig,
        path1 = environment.getOption("flp"),
        path2 = environment.getOption("flp2");

    if (!driveType1) {
        throw new Error("Argument 'driveType' is missing");
    }

    if (!diskType1) {
        throw new Error("Argument 'diskType' is missing");
    }

    if (!path1) {
        throw new Error("Argument 'flp' is missing");
    }

    floppyConfig = [{
        "driveType": driveType1,
        "diskType": diskType1,
        "path": "../../boot/" + path1,
        "loaded": true
    }];

    if (path2) {
        floppyConfig.push({
            "driveType": driveType2,
            "diskType": diskType2,
            "path": "../../boot/" + path2,
            "loaded": true
        });
    }

    emulator = jemul8.createEmulator({
        "cmos": {
            "bios": "docs/bochs-20100605/bios/BIOS-bochs-legacy"
        },
        "vga": {
            "bios": "docs/bochs-20100605/bios/VGABIOS-lgpl-latest"
        },
        "floppy": floppyConfig,
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
