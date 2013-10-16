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
    "js/browser",
    "module",
    "js/util",
    "js/Emulator"
], function (
    browser,
    module,
    util,
    Emulator
) {
    "use strict";

    var callback = module.defer();

    function Jemul8(systemFactory) {
        this.systemFactory = systemFactory;
    }

    util.extend(Jemul8.prototype, {
        createEmulator: function (options) {
            var system = this.systemFactory.create(options);

            return new Emulator(system);
        },

        getEnvironment: function () {
            return browser;
        }
    });

    // Breaks the circular dependency between js/Jemul8.js<->js/util.js
    util.init(function () {
        callback(Jemul8);
    });
});
