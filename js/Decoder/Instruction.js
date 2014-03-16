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
    "js/util"
], function (
    util
) {
    "use strict";

    function Instruction(addressSizeAttr, operandSizeAttr, repeat, segreg) {
        this.addressSizeAttr = addressSizeAttr;
        this.execute = null;
        this.length = 0;
        this.modRM = null;
        this.opcodeData = null;
        this.operandSizeAttr = operandSizeAttr;
        this.operand1 = null;
        this.operand2 = null;
        this.operand3 = null;
        this.repeat = repeat;
        this.segreg = segreg;
    }

    util.extend(Instruction.prototype, {
        getName: function () {
            return this.opcodeData.name;
        },

        // Generate x86 Assembly
        toASM: function () {
            var instruction = this,
                asm = (instruction.repeat ? instruction.repeat + " " : "") + instruction.opcodeData.name;

            if (instruction.operand1) {
                asm += " " + instruction.operand1.toASM();
            }
            if (instruction.operand2) {
                asm += ", " + instruction.operand2.toASM();
            }
            if (instruction.operand3) {
                asm += ", " + instruction.operand3.toASM();
            }

            return asm;
        }
    });

    return Instruction;
});
