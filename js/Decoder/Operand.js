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
    "js/core/util",
    "js/util"
], function (
    legacyUtil,
    util
) {
    "use strict";

    function Operand(
        insn,
        offset,
        addressSize,
        addressMask,
        size,
        mask,
        scale,
        reg,
        reg2,
        immed,
        immedSize,
        highImmed,
        highImmedSize,
        displacement,
        displacementSize,
        type,
        isPointer,
        isRelativeJump
    ) {
        this.insn = insn;
        this.offset = offset;
        this.addressSize = addressSize;
        this.addressMask = addressMask;
        this.size = size;
        this.mask = mask;
        this.scale = scale;
        this.reg = reg;
        this.reg2 = reg2;

        // Usually will be null, meaning use instruction's segreg,
        //  but some (eg. string) operations may need ES: for operand 2
        this.segreg = null;

        this.immed = immed;
        this.immedSize = immedSize;
        this.highImmed = highImmed;
        this.highImmedSize = highImmedSize;
        this.displacement = displacement;
        this.displacementSize = displacementSize;
        this.type = type;
        this.isPointer = isPointer;
        this.isRelativeJump = isRelativeJump;

        this.getPointerAddress = null;
        this.read = null;
        this.signExtend = null;
        this.write = null;
    }

    util.extend(Operand.prototype, {
        getSegReg: function () {
            var operand = this;

            return operand.segreg || operand.insn.segreg;
        },

        toASM: function () {
            var operand = this,
                asm = "";

            if (operand.immedSize) {
                if (asm) { asm += "+"; }
                asm += legacyUtil.sprintf(
                    "%0" + (operand.immedSize * 2) + "Xh",
                    operand.immed
                );
            }
            if (operand.reg) {
                if (asm) {
                    asm += "+";
                }
                asm += operand.reg.getName();
            }
            if (operand.reg2) {
                if (asm) {
                    asm += "+";
                }
                asm += operand.reg2.getName();
            }
            if (operand.displacementSize) {
                if (asm) {
                    asm += "+";
                }
                asm += legacyUtil.sprintf(
                    "%0" + (operand.displacementSize * 2) + "Xh",
                    operand.displacement
                );
            }

            // Surround with square brackets to indicate memory pointer
            if (operand.isPointer) {
                asm = legacyUtil.sprintf(
                    "%s:[%s]", operand.getSegReg().getName(), asm
                );
                // Indicate operand-size at the address
                asm = (operand.size === 1 ? "b," : operand.size === 2 ? "w," : "d,") + asm;
            }
            return asm;
        }
    });

    return Operand;
});
