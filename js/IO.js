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
    "js/util",
    "js/EventEmitter",
    "js/Exception",
    "js/Promise"
], function (
    util,
    EventEmitter,
    Exception,
    Promise
) {
    "use strict";

    function IO() {
        EventEmitter.call(this);

        this.devices = [];
        this.nullDevice = {
            ioRead: function (port, length) {
                //util.problem("Read from unregistered port 0x" + port.toString(16).toUpperCase() + " (length " + length + ")");

                // Return max value
                if (length === 1) {
                    return 0xFF;
                }

                if (length === 2) {
                    return 0xFFFF;
                }

                return 0xFFFFFFFF;
            },

            ioWrite: function (port, value, length) {
                // Do nothing

                //util.problem("Write to unregistered port 0x" + port.toString(16).toUpperCase() + ": " + util.hexify(value) + " (length " + length + ")");
            }
        };
        this.ports = [];

        (function (io) {
            util.from(0).to(0xFFFF, function (port) {
                io.ports[port] = {
                    allowedIOLengths: {1: true, 2: true},
                    description: "<unassigned>",
                    device: io.nullDevice
                };
            });
        }(this));
    }

    util.inherit(IO).from(EventEmitter);

    util.extend(IO.prototype, {
        getRegisteredDevice: function (identifier) {
            var device = null;

            util.each(this.devices, function (registeredDevice) {
                if (registeredDevice.getIdentifier() === identifier) {
                    device = registeredDevice;
                    return false;
                }
            });

            return device;
        },

        init: function () {
            var index = 0,
                io = this,
                promise = new Promise();

            (function next() {
                if (index >= io.devices.length) {
                    promise.resolve();
                } else {
                    io.devices[index].init().done(function () {
                        index++;
                        next();
                    }).fail(function (exception) {
                        promise.reject(exception);
                    });
                }
            }());

            return promise;
        },

        read: function (port, length) {
            var io = this,
                portOptions = io.ports[port];

            if (portOptions.allowedIOLengths[length]) {
                io.emit("io read", port, length);

                return portOptions.device.ioRead(port, length);
            } else {
                throw new Exception("IO.read() :: Read from port #" + util.hexify(port) + " with length " + length + " ignored");
            }
        },

        register: function (device) {
            var io = this,
                ports = io.ports;

            io.devices.push(device);

            util.each(device.getIOPorts(), function (portOptions, port) {
                var description = portOptions.description;

                if (ports[port].device !== io.nullDevice) {
                    throw new Exception("IO.register() :: IO port conflict for #" + util.hexify(port) + " '" + description + "' (already in use by '" + ports[port].description + "')");
                }

                ports[port] = {
                    allowedIOLengths: portOptions.allowedIOLengths,
                    description: description,
                    device: device
                };
            });
        },

        reset: function () {
            util.each(this.devices, function (device) {
                device.reset();
            });
        },

        write: function (port, value, length) {
            var io = this,
                portOptions = io.ports[port];

            if (portOptions.allowedIOLengths[length]) {
                io.emit("io write", port, value, length);

                return portOptions.device.ioWrite(port, value, length);
            }
        }
    });

    return IO;
});
