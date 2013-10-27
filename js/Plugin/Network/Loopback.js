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
    "js/Networking/Packet/ARP",
    "js/Networking/Table/ARP",
    "js/Networking/Message/ICMP/EchoReply",
    "js/Networking/Message/ICMP/EchoRequest",
    "js/Networking/Frame/Ethernet",
    "js/Exception",
    "js/Networking/Segment/ICMP",
    "js/Networking/Address/IPv4",
    "js/Networking/Packet/IPv4",
    "js/Networking/Address/MAC"
], function (
    util,
    ARPPacket,
    ARPTable,
    EchoReplyICMPMessage,
    EchoRequestICMPMessage,
    EthernetFrame,
    Exception,
    ICMPSegment,
    IPv4Address,
    IPv4Packet,
    MACAddress
) {
    "use strict";

    function LoopbackNetworkPlugin() {
        this.arpTable = new ARPTable();
        this.ethernetDevice = null;

        // Gateway
        this.arpTable.add("00:AB:CD:EF:12:34", "192.168.2.1");
        // Guest
        this.arpTable.add("00:12:34:56:78:90", "192.168.2.2");
    }

    util.extend(LoopbackNetworkPlugin.prototype, {
        receiveFrame: function (ethernetFrame) {
            this.ethernetDevice.receiveFrame(ethernetFrame);
        },

        sendFrame: function (ethernetFrame) {
            var gatewayIP = IPv4Address.createFromDottedDecimal("192.168.2.1"),
                gatewayMAC = MACAddress.createFromHexString("00:AB:CD:EF:12:34"),
                message,
                packet,
                plugin = this,
                segment;

            // Frame needs to either be directed at us (the gateway) or be a broadcast
            if (ethernetFrame.getDestinationMAC().toHexString() !== gatewayMAC.toHexString() &&
                !ethernetFrame.getDestinationMAC().isBroadcast()
            ) {
                // Not for us to handle
                return;
            }

            packet = ethernetFrame.getPacket();

            if (packet) {
                if (packet instanceof ARPPacket) {
                    (function (requestARPPacket) {
                        var replyARPPacket = ARPPacket.createEthernetIPv4(),
                            replyEthernetFrame,
                            resolvedMAC,
                            senderIP = requestARPPacket.getSenderProtocolAddress(),
                            senderMAC = requestARPPacket.getSenderHardwareAddress(),
                            targetIP = requestARPPacket.getTargetProtocolAddress();

                        resolvedMAC = plugin.arpTable.getMACForIP(targetIP);
                        if (!resolvedMAC) {
                            // Nobody is using the IP address
                            return;
                        }

                        // Build the reply ARP packet from the machine being asked for
                        replyARPPacket.makeReply();
                        replyARPPacket.setSenderHardwareAddress(resolvedMAC);
                        replyARPPacket.setSenderProtocolAddress(targetIP);
                        replyARPPacket.setTargetHardwareAddress(senderMAC);
                        replyARPPacket.setTargetProtocolAddress(senderIP);

                        // Package up the packet in a frame so we can send it to the ethernet device
                        replyEthernetFrame = EthernetFrame.wrapPacket(replyARPPacket);
                        replyEthernetFrame.setSourceMAC(gatewayMAC);
                        replyEthernetFrame.setDestinationMAC(senderMAC);
                        replyEthernetFrame.updateChecksum();
                        plugin.receiveFrame(replyEthernetFrame);
                    }(packet));

                    return;
                }

                if (packet instanceof IPv4Packet) {
                    if (!packet.isValid()) {
                        // Drop the packet if it doesn't match its checksum
                        return;
                    }

                    segment = packet.getSegment();

                    if (segment) {
                        if (segment instanceof ICMPSegment) {
                            message = segment.getMessage();

                            if (message) {
                                if (message instanceof EchoRequestICMPMessage) {
                                    (function (echoRequestMessage) {
                                        var echoReplyICMPSegment,
                                            echoReplyMessage = EchoReplyICMPMessage.create(echoRequestMessage.getDataLength()),
                                            replyEthernetFrame,
                                            replyIPPacket;

                                        echoReplyMessage.setID(echoRequestMessage.getID());
                                        echoReplyMessage.setSequenceNumber(echoRequestMessage.getSequenceNumber());
                                        echoReplyMessage.setData(echoRequestMessage.getData());
                                        echoReplyMessage.updateChecksum();

                                        echoReplyICMPSegment = ICMPSegment.wrapMessage(echoReplyMessage);

                                        replyIPPacket = IPv4Packet.wrapSegment(echoReplyICMPSegment);
                                        replyIPPacket.setSourceIP(gatewayIP);
                                        replyIPPacket.setDestinationIP(packet.getSourceIP());
                                        replyIPPacket.setTTL(64);
                                        replyIPPacket.updateChecksum();

                                        // Package up the packet in a frame so we can send it to the ethernet device
                                        replyEthernetFrame = EthernetFrame.wrapPacket(replyIPPacket);
                                        replyEthernetFrame.setSourceMAC(gatewayMAC);
                                        replyEthernetFrame.setDestinationMAC(ethernetFrame.getSourceMAC());
                                        replyEthernetFrame.updateChecksum();
                                        plugin.receiveFrame(replyEthernetFrame);
                                    }(message));
                                }
                            }

                            util.debug("LoopbackNetworkPlugin.sendFrame() :: Dropped ICMP segment of unknown ICMPType " + util.hexify(segment.getType()));
                            return;
                        }
                    }

                    util.debug("LoopbackNetworkPlugin.sendFrame() :: Dropped IPv4 packet of unknown ProtocolNumber " + util.hexify(packet.getProtocol()));
                    return;
                }
            }

            util.debug("LoopbackNetworkPlugin.sendFrame() :: Dropped Ethernet frame of unknown EtherType " + util.hexify(ethernetFrame.getEtherType()));
        },

        setupIODevices: function () {
            var plugin = this;

            return {
                "NE2K": function (tools) {
                    plugin.ethernetDevice = tools.getEthernetDevice();

                    plugin.ethernetDevice.on("frame send", function (ethernetFrame) {
                        plugin.sendFrame(ethernetFrame);
                    });
                }
            };
        }
    });

    return LoopbackNetworkPlugin;
});
