/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global define */
define([
    "module",
    "./tools"
], function (
    module,
    tools
) {
    "use strict";

    var callback = module.defer();

    tools.defineTest("PIT", callback, {
        beforeEach: function (emulator) {
            var irq0Calls = 0,
                registers = emulator.getCPURegisters();

            emulator.on("irq", function (irq) {
                if (irq === 0) {
                    irq0Calls++;
                }
            });

            return {
                helpers: {
                    // Ticks the PIT forward by the no. of microseconds in BX
                    0x01: function () {
                        var microseconds = registers.bx.get();

                        emulator.tick(microseconds);
                    },

                    // Returns the number of times IRQ0 has been called in AX
                    0x02: function () {

                    }
                }
            };
        }
    });
});
