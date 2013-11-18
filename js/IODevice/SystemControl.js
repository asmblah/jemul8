/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*
 * System Control
 */

/*global define */
define([
    "js/util",
    "js/Exception",
    "js/IODevice",
    "js/Promise"
], function (
    util,
    Exception,
    IODevice,
    Promise
) {
    "use strict";

    function SystemControl(system, io, memory, options) {
        IODevice.call(this, "System Control", system, io, memory, options);
    }

    util.inherit(SystemControl).from(IODevice);

    util.extend(SystemControl.prototype, {
        getIOPorts: function () {
            return {
                0x92: { description: "System Control", allowedIOLengths: {1: true, 2: true} }
            };
        },

        init: function () {
            return new Promise().resolve();
        },

        ioRead: function (port) {
            /*jshint bitwise: false */
            var systemControl = this;

            if (port !== 0x92) {
                throw new Exception("SystemControl.ioRead() :: Unsupported I/O port: " + util.hexify(port));
            }

            return systemControl.system.isA20Enabled() << 1;
        },

        ioWrite: function (port, value) {
            /*jshint bitwise: false */
            var systemControl = this;

            if (port !== 0x92) {
                throw new Exception("SystemControl.ioWrite() :: Unsupported I/O port: " + util.hexify(port));
            }

            systemControl.system.setEnableA20((value >> 1) & 1);
        },

        reset: function () {
            return this;
        }
    });

    return SystemControl;
});
