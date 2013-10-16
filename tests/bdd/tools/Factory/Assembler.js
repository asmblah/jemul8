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
    "js/util",
    "tools/Assembler/NASM",
    "tools/Assembler/Proxy"
], function (
    util,
    NASMAssembler,
    ProxyAssembler
) {
    "use strict";

    function AssemblerFactory() {

    }

    util.extend(AssemblerFactory.prototype, {
        create: function () {
            return util.global.XMLHttpRequest ? new ProxyAssembler() : new NASMAssembler();
        }
    });

    return AssemblerFactory;
});
