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
    "js/Promise"
], function (
    util,
    Promise
) {
    "use strict";

    var UNEXPECTED_BINARY_MESSAGE = 0;

    function Service(webSocketServer, natGateway) {
        this.natGateway = natGateway;
        this.webSocketServer = webSocketServer;
    }

    util.extend(Service.prototype, {
        init: function () {
            var promise = new Promise(),
                service = this,
                natGateway = service.natGateway;

            service.webSocketServer.on("connection", function (webSocket) {
                var expectingEthernetFrame = false;

                webSocket.on("message", function (data, flags) {
                    if (flags.binary) {
                        if (!expectingEthernetFrame) {
                            webSocket.send({
                                type: "error",
                                code: UNEXPECTED_BINARY_MESSAGE
                            });
                        } else {
                            expectingEthernetFrame = false;
                            natGateway.receiveFrame(data);
                        }
                    } else {
                        data = JSON.parse(data) || {};

                        if (data.sendingEthernetFrame) {
                            expectingEthernetFrame = true;
                        }
                    }
                });
            });

            promise.resolve();

            return promise;
        }
    });

    return Service;
});
