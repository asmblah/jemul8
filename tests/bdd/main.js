/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

// FIXME!! (In Modular)
require.config({
    paths: {
        "Modular": "/../../modular"
    }
});

/*global define */
define({
    cache: false
}, [
    "modular",
    "require",

    // Mocha has to be handled specially as it is not an AMD module
    "mocha/mocha"
], function (
    modular,
    require
) {
    "use strict";

    var global = modular.util.global,
        query = global.Mocha.utils.parseQuery(global.location.search || "");

    define("Mocha", function () {
        return global.Mocha;
    });

    require([
        "./runner"
    ], function (
        runner
    ) {
        runner({
            grep: query.grep,
            reporter: "html"
        });
    });
});
