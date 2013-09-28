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

    function Exception(message) {
        this.message = message;
    }

    util.inherit(Exception).from(Error);

    util.extend(Exception.prototype, {
        type: "Exception"
    });

    return Exception;
});
