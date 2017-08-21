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
    "js/Pin",
    "js/Promise",
    "js/Timer"
], function (
    plugins,
    require,
    util,
    EventEmitter,
    Exception,
    Pin,
    Promise,
    Timer
) {
    "use strict";

    var A20_DISABLED_MASK = 0xFFeFFFFF,
        A20_ENABLED_MASK = 0xFFFFFFFF,
        EQUIPMENT_CHANGE = "equipment change",
        RESET_TYPE_OPTION = "type",
        hasOwn = {}.hasOwnProperty;

    function System(clock, io, memory) {
        EventEmitter.call(this);

        this.a20Mask = A20_DISABLED_MASK;
        this.clock = clock;
        this.floppyDriveType = 0;

        // (H)old (R)e(Q)uest
        this.hrq = new Pin("HRQ");

        this.cpu = null;
        this.dma = null;
        this.inited = false;
        this.io = io;
        this.irqHandlers = {};
        this.memory = memory;
        this.numberOfSupportedFloppies = 0;
        this.pic = null;
        this.pluginsToLoad = [];
        this.running = false;
        this.timers = [];
    }

    util.inherit(System).from(EventEmitter);

    util.extend(System.prototype, {
        acknowledgeInterrupt: function () {
            return this.pic.acknowledgeInterrupt();
        },

        createTimer: function () {
            var system = this,
                timer = new Timer(system);

            system.timers.push(timer);

            return timer;
        },

        debug: function (message) {
            util.debug(message);
        },

        getA20Mask: function () {
            return this.a20Mask;
        },

        getClock: function () {
            return this.clock;
        },

        getCPURegisters: function () {
            return this.cpu.getRegisters();
        },

        getFloppyDriveType: function () {
            return this.floppyDriveType;
        },

        getMicrosecondsNow: function () {
            return this.clock.getMicrosecondsNow();
        },

        getNumberOfSupportedFloppies: function () {
            return this.numberOfSupportedFloppies;
        },

        getTicksNow: function () {
            return this.clock.getTicksNow();
        },

        handleAsynchronousEvents: function () {
            var system = this,
                ticksNow = system.getTicksNow();

            util.each(system.timers, function (timer) {
                timer.tick(ticksNow);
            });

            system.emit("async events");
        },

        init: function () {
            var system = this,
                promise = new Promise();

            function loadPlugins() {
                var loadsRemaining = 0,
                    promise = new Promise();

                function checkLoaded() {
                    if (loadsRemaining === 0) {
                        promise.resolve();
                    }
                }

                function loadPlugin(plugin) {
                    util.each(plugin.setupIODevices(), function (fn, ioDeviceIdentifier) {
                        var ioDevice = system.io.getRegisteredDevice(ioDeviceIdentifier),
                            result;

                        if (!ioDevice) {
                            throw new Exception("System.init() :: No I/O device registered with identifier '" + ioDeviceIdentifier + "'");
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
                }

                function markLoading() {
                    loadsRemaining++;
                }

                function markLoaded() {
                    loadsRemaining--;

                    checkLoaded();
                }

                util.each(system.pluginsToLoad, function (identifier) {
                    markLoading();

                    if (util.isString(identifier)) {
                        require(["./Plugin/" + plugins[identifier]], function (Plugin) {
                            var plugin = new Plugin();

                            loadPlugin(plugin);
                        });
                    } else {
                        loadPlugin(identifier);
                    }
                });

                checkLoaded();

                return promise;
            }

            system.cpu.on("interrupt", function (vector) {
                system.emit("interrupt", vector);
            });

            system.cpu.on("exception", function (vector) {
                system.emit("exception", vector);
            });

            system.cpu.on("halt", function (vector) {
                system.emit("halt", vector);
            });

            system.io.on("io read", function (port, length) {
                system.emit("io read", port, length);
            });

            system.io.on("io write", function (port, value, length) {
                system.emit("io write", port, value, length);
            });

            system.memory.init().done(function () {
                system.cpu.init().done(function () {
                    system.io.init().done(function () {
                        loadPlugins().done(function () {
                            system.reset({ "type": "hardware" });

                            system.inited = true;
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
            }).fail(function (exception) {
                promise.reject(exception);
            });

            return promise;
        },

        isA20Enabled: function () {
            return this.a20Mask === A20_ENABLED_MASK;
        },

        isHRQHigh: function () {
            return this.hrq.isHigh();
        },

        loadPlugin: function (identifier) {
            var system = this;

            if (util.isString(identifier)) {
                if (!hasOwn.call(plugins, identifier)) {
                    throw new Exception("Emulator.loadPlugin() :: Unrecognised standard plugin identifier '" + identifier + "'");
                }
            }

            system.pluginsToLoad.push(identifier);
        },

        loadROM: function (buffer, address, type) {
            var system = this;

            // Convert to legacy type
            type = {
                "cmos": 0
            }[type];

            system.legacyJemul8.machine.mem.loadROM(buffer, address, type);

            return system;
        },

        lowerHRQ: function () {
            this.hrq.lower();
        },

        lowerINTR: function () {
            this.cpu.lowerINTR();
        },

        lowerIRQ: function (irq) {
            var system = this;

            system.emit("irq low", irq);

            system.pic.lowerIRQ(irq);
        },

        observeEquipment: function (callback) {
            var system = this;

            system.on(EQUIPMENT_CHANGE, callback);
            callback.call(system);

            return system;
        },

        pause: function () {
            var system = this;

            system.running = false;
            system.cpu.halt();
            system.emit("pause");

            return system;
        },

        purgePage: function (page) {
            this.cpu.purgePage(page);
        },

        raiseHLDA: function () {
            this.dma.raiseHLDA();
        },

        raiseINTR: function () {
            this.cpu.raiseINTR();
        },

        raiseHRQ: function () {
            this.hrq.raise();
        },

        raiseIRQ: function (irq) {
            var system = this;

            system.emit("irq high", irq);

            system.pic.raiseIRQ(irq);
            system.cpu.serviceIRQs();
        },

        read: function (options) {
            /*global Uint8Array */
            var as,
                data,
                from,
                offset,
                port,
                size,
                system = this;

            options = options || {};

            if (!hasOwn.call(options, "from") && !hasOwn.call(options, "port")) {
                throw new Exception("System.read() :: Either 'from' or 'port' must be specified");
            }

            if (!hasOwn.call(options, "size")) {
                throw new Exception("System.read() :: 'size' not specified");
            }

            as = hasOwn.call(options, "as") ? options.as : "number";

            if (as && !/^(array|buffer|number|string)$/.test(as)) {
                throw new Exception("System.read() :: 'as' must be 'array', 'buffer', 'number' or 'string' if specified, '" + as + "' given");
            }

            size = options.size;

            // Reading from memory
            if (hasOwn.call(options, "from")) {
                from = options.from;

                if (as === "buffer") {
                    data = new Uint8Array(size);
                    system.memory.readPhysicalBlock(from, data, data.byteLength);
                } else if (as === "number") {
                    data = system.memory.readPhysical(from, size);
                } else if (as === "string") {
                    data = "";
                    for (offset = 0; offset < size; offset += 1) {
                        data += String.fromCharCode(system.memory.readPhysical(from + offset, 1));
                    }
                } else {
                    data = [];
                    for (offset = 0; offset < size; offset += 1) {
                        data[offset] = system.memory.readPhysical(from + offset, 1);
                    }
                }
            // Reading from I/O address space
            } else {
                port = options.port;
                size = options.size;

                data = system.io.read(port, size);
            }

            return data;
        },

        registerIRQ: function (irq, handler) {
            var irqHandlers = this.irqHandlers;

            if (irq < 0 || irq > 0xF) {
                throw new Exception("IO.registerIRQ() :: Invalid IRQ number " + irq + " - must be between 0-F inclusive");
            }

            if (irqHandlers[irq]) {
                throw new Exception("IO.registerIRQ() :: IRQ conflict for '" + handler + "' (already in use by '" + irqHandlers[irq] + "')");
            }

            irqHandlers[irq] = handler;
        },

        // Hardware reset
        reset: function (options) {
            var system = this;

            options = options || {};

            system.setEnableA20(false);

            // Always reset CPU
            system.cpu.reset();

            if (options[RESET_TYPE_OPTION] === "hardware") {
                system.io.reset();
            }
        },

        run: function () {
            var system = this;

            if (!system.inited) {
                throw new Exception("System.run() :: Not yet initialized");
            }

            system.running = true;

            return system.cpu.run();
        },

        setCPU: function (cpu) {
            this.cpu = cpu;
        },

        setDMA: function (dma) {
            this.dma = dma;
        },

        setEnableA20: function (enabled) {
            this.a20Mask = enabled ? A20_ENABLED_MASK : A20_DISABLED_MASK;
        },

        setFloppyDriveType: function (floppyDriveType) {
            var system = this;

            system.floppyDriveType = floppyDriveType;
            system.emit(EQUIPMENT_CHANGE);

            return system;
        },

        setNumberOfSupportedFloppies: function (numberOfSupportedFloppies) {
            var system = this;

            system.numberOfSupportedFloppies = numberOfSupportedFloppies;
            system.emit(EQUIPMENT_CHANGE);

            return system;
        },

        setPIC: function (pic) {
            this.pic = pic;
        },

        stop: function () {
            this.cpu.stop();
        },

        write: function (options) {
            /*jshint bitwise: false */
            var data,
                offset,
                port,
                size,
                system = this,
                to;

            options = options || {};

            if (!hasOwn.call(options, "data")) {
                throw new Exception("System.write() :: 'data' not specified");
            }

            if (!hasOwn.call(options, "to") && !hasOwn.call(options, "port")) {
                throw new Exception("System.write() :: Either 'to' or 'port' must be specified");
            }

            data = options.data;

            // Writing to memory
            if (hasOwn.call(options, "to")) {
                to = options.to;

                if (options.data.byteLength) {
                    system.memory.writePhysicalBlock(to, data);
                } else if (util.isArray(data)) {
                    size = data.length;
                    for (offset = 0; offset < size; offset += 1) {
                        system.memory.writePhysical(to + offset, data[offset], 1);
                    }
                } else if (util.isString(data)) {
                    size = data.length;
                    for (offset = 0; offset < size; offset += 1) {
                        system.memory.writePhysical(to + offset, data.charCodeAt(offset) & 0xff, 1);
                    }
                } else if (util.isNumber(data)) {
                    system.memory.writePhysical(to, data, options.size);
                }
            // Writing to I/O address space
            } else {
                port = options.port;
                size = options.length;

                system.io.write(port, data, size);
            }
        }
    });

    return System;
});
