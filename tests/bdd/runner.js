/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global define, require */
define({
    paths: {
        "bdd": ".",
        "js": "/../../js",
        "languages": "/../../languages",
        "tools": "./tools",

        // FIXME!! (In Modular)
        "Modular": require.config().paths.Modular,

        "vendor": "/../../vendor"
    }
}, [
    "chai/chai",
    "modular",
    "module",
    "require",
    "sinon/sinon",
    "sinon-chai/sinon-chai",
    "Mocha",
    "Modular",

    // Load dependencies for util
    "js/Jemul8"
], function (
    chai,
    modular,
    module,
    require,
    sinon,
    sinonChai,
    Mocha,
    Modular
) {
    "use strict";

    var util = modular.util,
        global = util.global;

    chai.use(sinonChai);

    global.expect = chai.expect;
    global.sinon = sinon;

    return function (options, callback) {
        var mocha = new Mocha({
            "ui": "bdd",
            "reporter": options.reporter || "html",
            "globals": ["setTimeout", "setInterval", "clearTimeout", "clearInterval"]
        }),
            Reporter = mocha._reporter;

        if (options.grep) {
            mocha.grep(new RegExp(options.grep));
        }

        // Expose Mocha functions in the global scope
        mocha.suite.emit("pre-require", global, null, mocha);

        describe.setSlowTimeout = (function () {
            return function (slowTimeout) {
                var oldSlow = Reporter.slow;

                Reporter.slow = slowTimeout;

                describe.restoreSlowTimeout = function () {
                    Reporter.slow = oldSlow;
                };
            };
        }());

        describe.stubRequire = function (config, dependencies, factory) {
            var mockModular = new Modular(),
                define = mockModular.createDefiner();

            config = util.extend({}, module.config, config);

            util.each(config.map, function (moduleValue, moduleID) {
                define(moduleID, function () {
                    return moduleValue;
                });
            });

            mockModular.createRequirer()(config, dependencies, factory);
        };

        require([
            "bdd/acceptance/protected-mode/simpleTest",
            "bdd/acceptance/real-mode/CPU/Instruction/conditionalJump/withCmp/ja-Test",
            "bdd/acceptance/real-mode/CPU/Instruction/callf-Test",
            "bdd/acceptance/real-mode/CPU/Instruction/cmp-Test",
            "bdd/acceptance/real-mode/CPU/Instruction/imul-Test",
            "bdd/acceptance/real-mode/CPU/Instruction/jmpf-Test",
            "bdd/acceptance/real-mode/CPU/Instruction/jmps-Test",
            "bdd/acceptance/real-mode/CPU/Instruction/lea-Test",
            "bdd/acceptance/real-mode/CPU/Instruction/lmsw-Test",
            "bdd/acceptance/real-mode/CPU/Instruction/mov-Test",
            "bdd/acceptance/real-mode/CPU/Instruction/movs-Test",
            "bdd/acceptance/real-mode/CPU/Instruction/movzx-Test",
            "bdd/acceptance/real-mode/CPU/Instruction/out-Test",
            "bdd/acceptance/real-mode/CPU/Instruction/push-Test",
            "bdd/acceptance/real-mode/CPU/Instruction/pusha-Test",
            "bdd/acceptance/real-mode/CPU/Instruction/sidt-Test",
            "bdd/acceptance/real-mode/CPU/Instruction/smsw-Test",
            "bdd/acceptance/real-mode/CPU/Instruction/stos-Test",
            "bdd/acceptance/real-mode/CPU/Instruction/test-Test",
            "bdd/acceptance/real-mode/CPU/SIB-Test",
            "bdd/acceptance/real-mode/IODevice/CMOS-Test",
            "bdd/acceptance/real-mode/IODevice/PIT-Test",
            "bdd/acceptance/real-mode/IODevice/SystemControl-Test",
            "bdd/acceptance/real-mode/IODevice/VGA-Test",
            "bdd/acceptance/real-mode/NOP-Test",
            "bdd/acceptance/real-mode/ROMBIOS-POST-Test",
            "bdd/integration/CPU-with-Decoder-Test.js",
            "bdd/unit/js/core/classes/registerTest",
            "bdd/unit/js/IODevice/CMOSTest",
            "bdd/unit/js/plugins/std.keyboardTest",
            "bdd/unit/js/DecoderTest",
            "bdd/unit/js/EmulatorTest",
            "bdd/unit/js/Jemul8Test",
            "bdd/unit/js/RegisterTest",
            "bdd/unit/js/SystemTest",
            "bdd/unit/js/utilTest"
        ], function () {
            mocha.run(callback);
        });
    };
});
