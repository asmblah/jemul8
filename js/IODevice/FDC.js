/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*
 * FDC (Floppy Disk Controller) chip, based on an Intel 8272
 */

/*global define */
define([
    "js/core/util",
    "js/util",
    "js/IODevice",
    "js/core/classes/iodev/fdc",
    "js/Promise"
], function (
    legacyUtil,
    util,
    IODevice,
    LegacyFDC,
    Promise
) {
    "use strict";

    var DISK_TYPE_OPTION = "diskType",
        DRIVE_TYPE_OPTION = "driveType",
        PATH_OPTION = "path";

    function FDC(system, io, memory, options) {
        IODevice.call(this, "FDC", system, io, memory, options);

        this.dmaChannelDRQ = null;
        this.dmaTC = null;
        this.legacyDMARead = null;
        this.legacyDMAWrite = null;
        this.legacyReadHandler = null;
        this.legacyWriteHandler = null;

        this.legacyFDC = new LegacyFDC((function (fdc) {
            return {
                dma: {
                    getTC: function () {
                        return fdc.dmaTC.isHigh();
                    },
                    registerDMA8Channel: function (channelIndex, thisObj, read, write) {
                        fdc.legacyDMARead = read;
                        fdc.legacyDMAWrite = write;
                    },
                    setDRQ: function (channelIndex, value) {
                        if (value) {
                            fdc.dmaChannelDRQ.raise();
                        } else {
                            fdc.dmaChannelDRQ.lower();
                        }
                    }
                },
                emu: {
                    getSetting: function (name) {
                        var index,
                            option;

                        for (index = 0; index < 2; ++index) {
                            if (name === "floppy" + index + ".driveType") {
                                option = fdc.options[index];
                                return option ? option[DRIVE_TYPE_OPTION] : null;
                            }
                            if (name === "floppy" + index + ".diskType") {
                                option = fdc.options[index];
                                return option ? option[DISK_TYPE_OPTION] : null;
                            }
                            if (name === "floppy" + index + ".path") {
                                option = fdc.options[index];
                                return option ? option[PATH_OPTION] : null;
                            }
                            if (name === "floppy" + index + ".status") {
                                option = fdc.options[index];
                                return !!option;
                            }
                        }

                        throw new Error("Unknown");
                    }
                },
                io: {
                    registerIO_Read: function (device, addr, name, fn) {
                        fdc.legacyReadHandler = fn;
                    },
                    registerIO_Write: function (device, addr, name, fn) {
                        fdc.legacyWriteHandler = fn;
                    },
                    registerIRQ: function () {}
                },
                pic: {
                    lowerIRQ: function (irq) {
                        system.lowerIRQ(irq);
                    },
                    raiseIRQ: function (irq) {
                        system.raiseIRQ(irq);
                    }
                },
                registerTimer: function (fn, thisObj, intervalUsecs, isContinuous, isActive) {
                    /*global clearTimeout, setTimeout */
                    var timer;

                    function setupTimer() {
                        clearTimeout(timer);

                        if (isActive) {
                            (function create() {
                                timer = setTimeout(function () {
                                    var i;

                                    if (isContinuous) {
                                        for (i = 0; i < 1000; i++) {
                                            fn.call(thisObj, Date.now());
                                        }
                                        create();
                                    } else {
                                        fn.call(thisObj, Date.now());
                                    }
                                }, intervalUsecs / 1000);
                            }());
                        }
                    }

                    setupTimer();

                    return {
                        activate: function (newIntervalUsecs, newIsContinuous) {
                            isActive = true;
                            intervalUsecs = newIntervalUsecs;
                            isContinuous = newIsContinuous;

                            setupTimer();
                        },

                        deactivate: function () {
                            isActive = false;

                            setupTimer();
                        }
                    };
                }
            };
        }(this)), {
            setFloppyDriveType: function (cmosValue) {
                system.setFloppyDriveType(cmosValue);
            },
            setNumberOfSupportedFloppies: function (numberOfSupportedFloppies) {
                system.setNumberOfSupportedFloppies(numberOfSupportedFloppies);
            }
        });
    }

    util.inherit(FDC).from(IODevice);

    util.extend(FDC.prototype, {
        dmaRead: function (dataByte) {
            var fdc = this;

            fdc.legacyDMARead.call(fdc.legacyFDC, dataByte);
        },

        dmaWrite: function () {
            var fdc = this;

            return fdc.legacyDMAWrite.call(fdc.legacyFDC);
        },

        getDMAChannelIndex: function () {
            return 2;
        },

        init: function () {
            var fdc = this,
                promise = new Promise();

            fdc.legacyFDC.init(function () {
                promise.resolve();
            }, function () {
                promise.reject();
            });

            return promise;
        },

        ioRead: function (port, length) {
            var fdc = this;

            return fdc.legacyReadHandler(fdc.legacyFDC, port, length);
        },

        ioWrite: function (port, value, length) {
            var fdc = this;

            fdc.legacyWriteHandler(fdc.legacyFDC, port, value, length);
        },

        reset: function () {
            var fdc = this;

            fdc.legacyFDC.reset(legacyUtil.RESET_HARDWARE);

            return fdc;
        },

        setupDMA: function (dmaChannelDRQ, dmaTC) {
            this.dmaChannelDRQ = dmaChannelDRQ;
            this.dmaTC = dmaTC;
        }
    });

    return FDC;
});
