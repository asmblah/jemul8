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

    var global = util.global;

    return {
        getOption: function (name) {
            var result = null;

            util.each(global.location.search.replace(/^\?/, "").split("&"), function (nameValuePair) {
                var parts = nameValuePair.split("=");

                if (decodeURIComponent(parts[0]) === name) {
                    result = decodeURIComponent(parts[1]);
                }
            });

            return result;
        }
    };
});
