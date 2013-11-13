/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global ArrayBuffer, DataView, define */
define([
    "js/util"
], function (
    util
) {
    "use strict";

    function MemoryAllocator() {

    }

    util.extend(MemoryAllocator.prototype, {
        allocateBytes: function (sizeBytes) {
            return new DataView(new ArrayBuffer(sizeBytes));
        }
    });

    return MemoryAllocator;
});
