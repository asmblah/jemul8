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
    "js/Networking/Message/ICMP/Echo"
], function (
    util,
    EchoICMPMessage
) {
    "use strict";

    var ECHO_REPLY_ICMP_TYPE = 0;

    function EchoReplyICMPMessage(buffer, offset, length) {
        EchoICMPMessage.call(this, buffer, offset, length);
    }

    util.inherit(EchoReplyICMPMessage).from(EchoICMPMessage);

    util.extend(EchoReplyICMPMessage, {
        ICMP_TYPE: ECHO_REPLY_ICMP_TYPE,

        create: function (dataLength) {
            var message = EchoICMPMessage.create(dataLength);

            // Set correct type for Echo Reply, leaving Code 0
            message.dataView.setUint8(0, ECHO_REPLY_ICMP_TYPE);

            return message;
        }
    });

    return EchoReplyICMPMessage;
});
