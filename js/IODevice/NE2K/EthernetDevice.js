/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*
 * Ethernet device for NE2K (NE2000) NIC
 */

/*global define */
define([
    "js/util",
    "js/Networking/Frame/Ethernet",
    "js/EventEmitter"
], function (
    util,
    EthernetFrame,
    EventEmitter
) {
    "use strict";

    function EthernetDevice(ne2k) {
        EventEmitter.call(this);

        this.ne2k = ne2k;
    }

    util.inherit(EthernetDevice).from(EventEmitter);

    util.extend(EthernetDevice.prototype, {
        receiveFrame: function (ethernetFrame) {
            var pointer = ethernetFrame.getPointer();

            this.ne2k.receiveFrame(pointer.buffer, pointer.offset, pointer.length);
        },

        sendFrame: function (sourceBuffer, offset, length) {
            // Ensure we copy the frame into a new buffer as the source could be modified at any time
            var buffer = sourceBuffer.slice(offset, offset + length),
                ethernetFrame = new EthernetFrame(buffer, 0, length);

            this.emit("frame send", ethernetFrame);
        }
    });

    return EthernetDevice;
});
