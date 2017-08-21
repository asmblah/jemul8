/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright (c) jemul8.com (http://github.com/asmblah/jemul8)
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

    function CPUException(vector, code) {
        this.code = code;
        this.vector = vector;
    }

    return CPUException;
});
