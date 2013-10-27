/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global DataView, define */
define([
    "js/util",
    "js/Networking/Message/ICMP/EchoReply",
    "js/Networking/Message/ICMP/EchoRequest"
], function (
    util,
    EchoReplyICMPMessage,
    EchoRequestICMPMessage
) {
    "use strict";

    var ICMP_PROTOCOL_NUMBER = 1;

    function ICMPSegment(buffer, offset, length) {
        this.buffer = buffer;
        this.dataView = new DataView(buffer, offset, length);
        this.length = length;
        this.offset = offset;
    }

    util.extend(ICMPSegment, {
        PROTOCOL_NUMBER: ICMP_PROTOCOL_NUMBER,

        // Wraps an ICMP message in an ICMP segment, eg. an Echo Request or Echo Reply
        wrapMessage: function (message) {
            var segment,
                pointer = message.getPointer();

            segment = new ICMPSegment(pointer.buffer, pointer.offset, pointer.length);

            return segment;
        }
    });

    util.extend(ICMPSegment.prototype, {
        getMessage: function () {
            var segment = this,
                type = segment.getType();

            switch (type) {
            case EchoReplyICMPMessage.ICMP_TYPE:
                return new EchoReplyICMPMessage(segment.buffer, segment.offset, segment.length);
            case EchoRequestICMPMessage.ICMP_TYPE:
                return new EchoRequestICMPMessage(segment.buffer, segment.offset, segment.length);
            default:
                return null;
            }
        },
        getPointer: function () {
            var segment = this;

            return {
                buffer: segment.buffer,
                length: segment.length,
                offset: segment.offset
            };
        },
        getProtocol: function () {
            return ICMP_PROTOCOL_NUMBER;
        },
        getType: function () {
            return this.dataView.getUint8(0);
        }
    });

    return ICMPSegment;
});
