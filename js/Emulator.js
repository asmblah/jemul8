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
    "js/plugins",
    "require",
    "js/util",
    "js/EventEmitter",
    "js/Exception",
    "js/Promise"
], function (
    plugins,
    require,
    util,
    EventEmitter,
    Exception,
    Promise
) {
    "use strict";

    function Emulator(system) {
        EventEmitter.call(this);

        this.system = system;
    }

    util.inherit(Emulator).from(EventEmitter);

    util.extend(Emulator.prototype, {
        init: function () {
            var emulator = this,
                promise = new Promise();

            emulator.system.on("pause", function () {
                emulator.emit("pause");
            });

            emulator.system.init().done(function () {
                promise.resolve();
            }).fail(function (exception) {
                promise.reject(exception);
            });

            return promise;
        },

        loadPlugin: function (identifier) {
            this.system.loadPlugin(identifier);
        },

        pause: function () {
            var emulator = this;

            emulator.system.pause();

            return emulator;
        },

        reset: function (options) {
            this.system.reset(options);
        },

        run: function () {
            return this.system.run();
        },

        write: function (options) {
            this.system.write(options);
        }
    });

    return Emulator;
});
