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
    "../tools"
], function (
    cpuTools
) {
    "use strict";

    return {
        defineTest: function (name, callback, options) {
            cpuTools.defineTest(name + " instruction", "Instruction/" + name, callback, options);
        }
    };
});
