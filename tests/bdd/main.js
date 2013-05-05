/**
 * jemul8 - JavaScript x86 Emulator v0.0.1
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global define */
define({
    cache: false,
    paths: {
        "bdd": ".",
        "js": "/../../js",
        "plugins": "/../../js/plugins",
        "vendor": "/../../vendor"
    }
}, [
    "vendor/chai/chai",
    "modular",
    "require",
    "vendor/sinon/sinon",
    "vendor/sinon-chai/lib/sinon-chai",
    "vendor/mocha/mocha",

    "js/jquery/jquery-1.7.1"
], function (
    chai,
    modular,
    require,
    sinon,
    sinonChai
) {
    "use strict";

    var global = modular.util.global,
        mocha = global.mocha;

    chai.use(sinonChai);

    mocha.setup({
        "ui": "bdd",
        "reporter": mocha.reporters.HTML,
        "globals": ["setTimeout", "setInterval", "clearTimeout", "clearInterval"]
    });

    global.expect = chai.expect;
    global.sinon = sinon;

    describe.setSlowTimeout = (function (BaseReporter) {
        return function (slowTimeout) {
            var oldSlow = BaseReporter.slow;

            BaseReporter.slow = slowTimeout;

            describe.restoreSlowTimeout = function () {
                BaseReporter.slow = oldSlow;
            };
        };
    }(mocha.reporters.Base));

    require([
        "bdd/acceptance/real-mode/NOP-Test",
        "bdd/acceptance/real-mode/ROMBIOS-POST-Test",
        "bdd/unit/js/core/classes/registerTest",
        "bdd/unit/js/plugins/std.keyboardTest",
        "bdd/unit/js/Jemul8Test",
        "bdd/unit/js/RegisterTest",
        "bdd/unit/js/utilTest"
    ], function () {
        mocha.run();
    });
});
