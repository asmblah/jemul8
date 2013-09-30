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

    var hasOwn = {}.hasOwnProperty;

    function Emulator(system, io, memory, cpu) {
        EventEmitter.call(this);

        this.cpu = cpu;
        this.inited = false;
        this.io = io;
        this.memory = memory;
        this.pluginsToLoad = [];
        this.running = false;
        this.system = system;
    }

    util.inherit(Emulator).from(EventEmitter);

    util.extend(Emulator.prototype, {
        getCPURegisters: function () {
            return this.cpu.getRegisters();
        },

        init: function () {
            var emulator = this,
                promise = new Promise();

            function loadPlugins() {
                var loadsRemaining = 0,
                    promise = new Promise();

                function checkLoaded() {
                    if (loadsRemaining === 0) {
                        promise.resolve();
                    }
                }

                function markLoading() {
                    loadsRemaining++;
                }

                function markLoaded() {
                    loadsRemaining--;

                    checkLoaded();
                }

                util.each(emulator.pluginsToLoad, function (identifier) {
                    markLoading();

                    if (util.isString(identifier)) {
                        require(["./Plugin/" + plugins[identifier]], function (Plugin) {
                            var plugin = new Plugin();

                            util.each(plugin.setupIODevices(), function (fn, ioDeviceIdentifier) {
                                var ioDevice = emulator.io.getRegisteredDevice(ioDeviceIdentifier),
                                    result;

                                if (!ioDevice) {
                                    throw new Exception("Emulator.init() :: No I/O device registered with identifier '" + ioDeviceIdentifier + "'");
                                }

                                markLoading();

                                result = fn(ioDevice.getPluginData());

                                if (result instanceof Promise) {
                                    result.done(function () {
                                        markLoaded();
                                    }).fail(function (exception) {
                                        promise.reject(exception);
                                    });
                                } else {
                                    markLoaded();
                                }
                            });

                            markLoaded();
                        });
                    }
                });

                checkLoaded();

                return promise;
            }

            loadPlugins().done(function () {
                emulator.cpu.on("interrupt", function (vector) {
                    emulator.emit("interrupt", vector);
                });

                emulator.io.on("io read", function (port, length) {
                    emulator.emit("io read", port, length);
                });

                emulator.io.on("io write", function (port, value, length) {
                    emulator.emit("io write", port, value, length);
                });

                emulator.cpu.init().done(function () {
                    emulator.io.init().done(function () {
                        emulator.cpu.reset();
                        emulator.io.reset();

                        emulator.inited = true;
                        promise.resolve();
                    }).fail(function (exception) {
                        promise.reject(exception);
                    });
                }).fail(function (exception) {
                    promise.reject(exception);
                });
            }).fail(function (exception) {
                promise.reject(exception);
            });

            return promise;
        },

        loadPlugin: function (identifier) {
            if (util.isString(identifier)) {
                if (!hasOwn.call(plugins, identifier)) {
                    throw new Exception("Emulator.loadPlugin() :: Unrecognised standard plugin identifier '" + identifier + "'");
                }
            } else {
                throw new Exception("Emulator.init() :: Unsupported plugin");
            }

            this.pluginsToLoad.push(identifier);
        },

        pause: function () {
            var emulator = this;

            emulator.running = false;
            emulator.cpu.halt();
            emulator.emit("pause");

            return emulator;
        },

        reset: function (options) {
            this.system.reset(options);
        },

        run: function () {
            var emulator = this;

            if (!emulator.inited) {
                throw new Exception("Emulator.run() :: Not yet initialized");
            }

            emulator.running = true;

            return emulator.cpu.run();
        },

        tick: function (microseconds) {

        },

        write: function (options) {
            this.system.write(options);
        }
    });

    return Emulator;
});
