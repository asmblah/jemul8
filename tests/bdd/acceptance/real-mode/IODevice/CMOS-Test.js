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

    tools.defineTest("CMOS", callback);
});
