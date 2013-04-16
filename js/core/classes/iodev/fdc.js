/*
 *  jemul8 - JavaScript x86 Emulator
 *  Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *
 * MODULE: 82077A/82078 FDC (Floppy Disk Controller) class support
 *
 * ====
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*jslint bitwise: true, plusplus: true */
/*global define, require */

define([
    "../../util",
    "../iodev",
    "../iodev/floppy_disk",
    "../memory/buffer",
    "../pc"
], function (
    util,
    IODevice,
    FloppyDisk,
    Buffer,
    PC
) {
    "use strict";

    // TODO: Should be a config setting
    var enableDebug = false;

    var debug = enableDebug ? function (msg) {
        util.debug(msg);
    } : function () {};

    /* ====== Private ====== */

    /* ==== Const ==== */
    // From Bochs' /gui/siminterface.h
    var FDD_NONE         = 0 // Floppy not present
        , FDD_525DD      = 1 // 360K  5.25"
        , FDD_525HD      = 2 // 1.2M  5.25"
        , FDD_350DD      = 3 // 720K  3.5"
        , FDD_350HD      = 4 // 1.44M 3.5"
        , FDD_350ED      = 5 // 2.88M 3.5"

        , FLOPPY_NONE    = 10 // Media not present
        , FLOPPY_1_2     = 11 // 1.2M  5.25"
        , FLOPPY_1_44    = 12 // 1.44M 3.5"
        , FLOPPY_2_88    = 13 // 2.88M 3.5"
        , FLOPPY_720K    = 14 // 720K  3.5"
        , FLOPPY_360K    = 15 // 360K  5.25"
        , FLOPPY_160K    = 16 // 160K  5.25"
        , FLOPPY_180K    = 17 // 180K  5.25"
        , FLOPPY_320K    = 18 // 320K  5.25"
        , FLOPPY_LAST    = 18 // Last legal value of floppy type

        , FLOPPY_AUTO    = 19 // Autodetect image size
        , FLOPPY_UNKNOWN = 20 // Image size doesn't match one of the types above

    // For main status register
        , FD_MS_MRQ       = 0x80
        , FD_MS_DIO       = 0x40
        , FD_MS_NDMA      = 0x20
        , FD_MS_BUSY      = 0x10
        , FD_MS_ACTD      = 0x08
        , FD_MS_ACTC      = 0x04
        , FD_MS_ACTB      = 0x02
        , FD_MS_ACTA      = 0x01

        , FROM_FLOPPY     = 10
        , TO_FLOPPY       = 11

        , FLOPPY_DMA_CHAN = 2

        , FDRIVE_NONE     = 0x00
        , FDRIVE_525DD    = 0x01
        , FDRIVE_525HD    = 0x02
        , FDRIVE_350DD    = 0x04
        , FDRIVE_350HD    = 0x08
        , FDRIVE_350ED    = 0x10;
    /* ==== /Const ==== */

    // Lookups
    var floppy_type = [
        new FloppyType(FLOPPY_160K, 40, 1, 8, 320, 0x03)
        , new FloppyType(FLOPPY_180K, 40, 1, 9, 360, 0x03)
        , new FloppyType(FLOPPY_320K, 40, 2, 8, 640, 0x03)
        , new FloppyType(FLOPPY_360K, 40, 2, 9, 720, 0x03)
        , new FloppyType(FLOPPY_720K, 80, 2, 9, 1440, 0x1f)
        , new FloppyType(FLOPPY_1_2,  80, 2, 15, 2400, 0x02)
        , new FloppyType(FLOPPY_1_44, 80, 2, 18, 2880, 0x18)
        , new FloppyType(FLOPPY_2_88, 80, 2, 36, 5760, 0x10)
    ], drate_in_k = [
        500, 300, 250, 1000
    ];

    // Constructor / pre-init
    function FDC(machine) {
        util.assert(this && (this instanceof FDC), "FDC ctor ::"
            + " error - constructor not called properly");

        var idx;

        /** 82077A/82078 Floppy Disk Controller **/

        util.info("FDC (Intel 82077A/82078) PreInit");

        this.machine = machine;

        this.state = {
            data_rate: 0x00

            // [Bochs] largest command size ???
            , command: Buffer.createByteBuffer(10)
            , command_index: 0x00
            , command_size: 0x00
            , command_complete: false
            , pending_command: 0x00

            , multi_track: false
            , pending_irq: false
            , reset_sensei: 0x00
            , format_count: 0x00
            , format_fillbyte: 0x00

            , result: Buffer.createByteBuffer(10)
            , result_index: 0x00
            , result_size: 0x00

            , DOR: 0x00 // Digital Output Register
            , TDR: 0x00 // Tape Drive Register

            // Really only using 2 drives
            //  out of the 4 the real controller supports
            , cylinder: Buffer.createByteBuffer(4)
            , head: Buffer.createByteBuffer(4)
            , sector: Buffer.createByteBuffer(4)
            , eot: Buffer.createByteBuffer(4)

            , TC: false // Terminal Count status from DMA controller

            /*
             * Main Status Register
             * ====================
             * b7: MRQ: main request:
             *     1 = Data register ready
             *     0 = Data register not ready
             * b6: DIO: data input/output:
             *     1 = controller->CPU (ready for data read)
             *     0 = CPU->controller (ready for data write)
             * b5: NDMA: non-DMA mode:
             *     1 = controller not in DMA modes
             *     0 = controller in DMA mode
             * b4: BUSY: instruction(device busy)
             *     1 = active
             *     0 = not active
             * b3-0: ACTD, ACTC, ACTB, ACTA:
             *       drive D,C,B,A in positioning mode 1=active 0=not active
             */
            , main_status_reg: 0x00

            , status_reg0: 0x00
            , status_reg1: 0x00
            , status_reg2: 0x00
            , status_reg3: 0x00

            // Drive field allows up to 4 drives,
            //  even though probably only 2 will ever be used.
            , media: [ null, null, null, null ]
            , num_supported_floppies: 0
            // 2 extra for good measure
            , floppy_buffer: Buffer.createByteBuffer(512 + 2)
            , floppy_buffer_index: 0
            , floppy_timer_index: null
            , media_present: [ false, false, false, false ]
            , device_type: Buffer.createByteBuffer(4)

            // Digital Input Register:
            //  b7: 0=diskette is present and has not been changed
            //      1=diskette missing or changed
            , DIR: Buffer.createByteBuffer(4)
            , lock: false      // FDC lock status
            , SRT: 0x00       // Step Rate Time
            , HUT: 0x00       // Head Unload Time
            , HLT: 0x00       // Head Load Time
            , config: 0x00    // Configure byte #1
            , pretrk: 0x00    // Precompensation track
            , perp_mode: 0x00 // Perpendicular mode

            , statusbar_id: [ 0, 0 ] // IDs of the status LEDs
        };
    }
    // Methods based on Bochs /iodev/floppy.h & floppy.cc
    util.inherit(FDC, IODevice, "FDC"); // Inheritance
    util.extend(FDC, {
        FDD_NONE:         FDD_NONE
        , FDD_525DD:      FDD_525DD
        , FDD_525HD:      FDD_525HD
        , FDD_350DD:      FDD_350DD
        , FDD_350HD:      FDD_350HD
        , FDD_350ED:      FDD_350ED

        , FLOPPY_NONE:    FLOPPY_NONE
        , FLOPPY_1_2:     FLOPPY_1_2
        , FLOPPY_1_44:    FLOPPY_1_44
        , FLOPPY_2_88:    FLOPPY_2_88
        , FLOPPY_720K:    FLOPPY_720K
        , FLOPPY_360K:    FLOPPY_360K
        , FLOPPY_160K:    FLOPPY_160K
        , FLOPPY_180K:    FLOPPY_180K
        , FLOPPY_320K:    FLOPPY_320K
        , FLOPPY_LAST:    FLOPPY_LAST

        , FLOPPY_AUTO:    FLOPPY_AUTO
        , FLOPPY_UNKNOWN: FLOPPY_UNKNOWN

        , fromConstant: function (name) {
            if (name in this) {
                return this[ name ];
            }
            return null;
        }
    });
    FDC.prototype.init = function (done, fail) {
        var device = this;
        var machine = this.machine;
        var emu = machine.emu;
        var state = this.state;
        var idx;
        var addr;
        var devtype;
        var cmosValue;
        var media = state.media;
        var disk;

        function setupFloppy(idx, devtype, type, status, path, done, fail) {
            cmosValue |= (devtype << 4);
            if (devtype !== FDD_NONE) {
                state.device_type[ idx ] = 1 << (devtype - 1);
                state.num_supported_floppies++;
                state.statusbar_id[ idx ] = 0; //bx_gui.register_statusitem(" A: ");
            } else {
                state.statusbar_id[ idx ] = -1;
            }

            if (type !== FLOPPY_NONE && status) {
                this.evaluate_media(
                    state.device_type[ idx ]
                    , type
                    , path
                    , media[ idx ]
                    , function () {
                        state.media_present[ idx ] = true;
                        disk = media[ idx ];
                        util.info(util.sprintf("FDC.init > setupFloppy() ::"
                            + " fd0: '%s' ro=%d, h=%d, t=%d, spt=%d"
                            , path, disk.write_protected
                            , disk.heads, disk.tracks, disk.sectors_per_track
                        ));
                        done();
                    }, function () {
                        // TODO: Set status config option to false
                        fail();
                    }
                );
            } else {
                fail();
            }
        }
        // Floppies (A & B) setup
        function setupFloppies() {
            var loaded = 0;
            var len = 2;

            util.each([ 0, 1 ], function (idx, num) {
                var name = "floppy" + num;

                setupFloppy.call(
                    device
                    , num
                    , FDC.fromConstant(emu.getSetting(name + ".driveType"))
                    , FDC.fromConstant(emu.getSetting(name + ".diskType"))
                    , emu.getSetting(name + ".status")
                    , emu.getSetting(name + ".path")
                    , function () {
                        util.debug("Floppy loaded ok");

                        if (++loaded === len) {
                            done();
                        }
                    }, function () {
                        util.debug("Floppy not loaded");

                        if (++loaded === len) {
                            done();
                        }
                    }
                );
            });
        }

        machine.dma.registerDMA8Channel(2, this, this.dma_read, this.dma_write
            , "FDC (Floppy Disk Controller)");

        // Make a note that IRQ #6 is used by the Floppy drive
        this.registerIRQ(6, "Floppy Disk Controller");

        // I/O port addresses used
        // 0x0000 ... 0x000F
        for (addr = 0x03F2 ; addr <= 0x03F7 ; ++addr) {
            this.registerIO_Read(addr, "Floppy Disk Controller"
                , readHandler, 1);
            this.registerIO_Write(addr, "Floppy Disk Controller"
                , writeHandler, 1);
        }

        // Start out with: no drive0, no drive1
        cmosValue = 0x00;

        state.num_supported_floppies = 0;

        for (idx = 0 ; idx < 4 ; ++idx) {
            media[ idx ] = new FloppyDisk(
                FLOPPY_NONE, 0, 0, 0, 0, -1, 0, FDRIVE_NONE
            );
        }

        setupFloppies();

        // CMOS Floppy Type and Equipment Byte register
        machine.cmos.setReg(0x10, cmosValue);
        if (state.num_supported_floppies > 0) {
            machine.cmos.setReg(0x14
                , (machine.cmos.getReg(0x14) & 0x3e)
                | ((state.num_supported_floppies - 1) << 6) | 1
            );
        } else {
            machine.cmos.setReg(0x14, (machine.cmos.getReg(0x14) & 0x3e));
        }

        if (state.floppy_timer_index === null) {
            state.floppy_timer_index = machine.registerTimer(
                this.timer_handler, this, 250, false, false, "FDC");
        }
        // [Bochs] Phase out s.non_dma in favor of using FD_MS_NDMA, more like hardware
        state.main_status_reg &= ~FD_MS_NDMA; // Enable DMA from start
        // These registers are not cleared by reset
        state.SRT = 0x00;
        state.HUT = 0x00;
        state.HLT = 0x00;

        // TEMP - Taken from Bochs' /iodev/harddrv.cc
        // System boot sequence A:, C:
        //  (will only have effect if ElTorito boot disabled)
        machine.cmos.setReg(0x2d, machine.cmos.getReg(0x2d) | 0x20);

        var drive1 = 1, drive2 = 2, drive3 = 3, floppySignatureCheck = false;
        machine.cmos.setReg(0x3D, drive1 | (drive2 << 4));
        machine.cmos.setReg(0x38, (!floppySignatureCheck) | (drive3 << 4));
    };
    // Based on [bx_floppy_c::reset]
    FDC.prototype.reset = function (type) {
        var i, machine = this.machine
            , state = this.state;

        state.pending_irq = false;
        state.reset_sensei = 0x00; /* no reset result present */

        state.main_status_reg = 0;
        state.status_reg0 = 0;
        state.status_reg1 = 0;
        state.status_reg2 = 0;
        state.status_reg3 = 0;

        // Software reset (via DOR port 0x3f2 bit 2) does not change DOR
        if (type === util.RESET_HARDWARE) {
            state.DOR = 0x0c;
            // motor off, drive 3..0
            // DMA/INT enabled
            // normal operation
            // drive select 0

            // DIR and CCR affected only by hard reset
            for (i = 0 ; i < 4 ; i++) {
                state.DIR[ i ] |= 0x80; // disk changed
            }
            state.data_rate = 2; /* 250 Kbps */
            state.lock = false;
        } else {
            util.info("FDC (Floppy Disk Controller) reset in software");
        }
        if (state.lock == false) {
            state.config = 0;
            state.pretrk = 0;
        }
        state.perp_mode = 0;

        for (i = 0 ; i < 4 ; i++) {
            state.cylinder[ i ] = 0;
            state.head[ i ] = 0;
            state.sector[ i ] = 0;
            state.eot[ i ] = 0;
        }

        machine.pic.lowerIRQ(6);
        if (!(state.main_status_reg & FD_MS_NDMA)) {
            machine.dma.setDRQ(FLOPPY_DMA_CHAN, 0);
        }
        this.enter_idle_phase();
    };
    FDC.prototype.registerState = function () {
        // ?
    };
    FDC.prototype.afterRestoreState = function () {
        // ?
    };

    // FDC chip's I/O read operations' handler routine
    function readHandler(device, addr, io_len) {
        var state = device.state // "device" will be Floppy
            , result8 // 8-bit result
            , drive;
        //debugger;
        //debug("Floppy readHandler() :: Read addr = " + util.format("hex", addr));

        /** NB: This is an 82077A/82078 Floppy Disk Controller (FDC) **/

        switch (addr) {
        case 0x3F2: // diskette controller digital output register
            result8 = state.DOR;
            break;

        case 0x3F4: /* diskette controller main status register */
            result8 = state.main_status_reg;
            break;

        case 0x3F5: /* diskette controller data */
            if ( (state.main_status_reg & FD_MS_NDMA)
                && ((state.pending_command & 0x4f) == 0x46)
            ) {
                result8 = device.dma_write(result8);
                device.lower_interrupt();
                // don't enter idle phase until we've given CPU last data byte
                if (state.TC) { device.enter_idle_phase(); }
            } else if (state.result_size == 0) {
                util.problem(("port 0x3f5: no results to read"));
                state.main_status_reg &= FD_MS_NDMA;
                result8 = state.result[ 0 ];
            } else {
                result8 = state.result[ state.result_index++ ];
                state.main_status_reg &= 0xF0;
                device.lower_interrupt();
                if (state.result_index >= state.result_size) {
                    device.enter_idle_phase();
                }
            }
            break;

        case 0x3F3: // Tape Drive Register
            drive = state.DOR & 0x03;
            if (state.media_present[ drive ]) {
                switch (state.media[ drive ].type) {
                case FLOPPY_160K:
                case FLOPPY_180K:
                case FLOPPY_320K:
                case FLOPPY_360K:
                case FLOPPY_1_2:
                    result8 = 0x00;
                    break;
                case FLOPPY_720K:
                    result8 = 0xc0;
                    break;
                case FLOPPY_1_44:
                    result8 = 0x80;
                    break;
                case FLOPPY_2_88:
                    result8 = 0x40;
                    break;
                default: // FLOPPY_NONE
                    result8 = 0x20;
                }
            } else {
                result8 = 0x20;
            }
            break;

        case 0x3F6: // Reserved for future floppy controllers
            // This address shared with the hard drive controller
            //result8 = DEV_hd_read_handler(bx_devices.pluginHardDrive, address, io_len);
            util.warning("FDC :: TODO - DEV_hd_read_handler");
            break;

        case 0x3F7: // diskette controller digital input register
            // This address shared with the hard drive controller:
            //   Bit  7   : floppy
            //   Bits 6..0: hard drive
            util.warning("FDC :: TODO - DEV_hd_read_handler");
            result8 = 0; //DEV_hd_read_handler(bx_devices.pluginHardDrive, address, io_len);
            result8 &= 0x7f;
            // add in diskette change line if motor is on
            drive = state.DOR & 0x03;
            if (state.DOR & (1 << (drive + 4))) {
                result8 |= (state.DIR[ drive ] & 0x80);
            }
            break;

        default:
            util.problem(util.sprintf(
                "FDC (Floppy) readHandler() :: Unsupported read, address=0x%04X!"
                , addr
            ));
            return 0;
        }
        //debug(util.sprintf(
        //    "FDC (Floppy) readHandler() :: During command 0x%02x,"
        //    + " port 0x%04x returns 0x%02x"
        //    , state.pending_command, addr
        //));
        return result8;
    }
    // FDC chip's I/O write operations' handler routine
    function writeHandler(device, addr, val, io_len) {
        var state = device.state // "device" will be Floppy
            , dma_and_interrupt_enable
            , normal_operation, prev_normal_operation
            , drive_select
            , motor_on_drive0, motor_on_drive1;

        debug(util.sprintf(
            "Floppy writeHandler() :: Write to address: 0x%04X = 0x%02X"
            , addr, val
        ));

        /** NB: This is an 82077A/82078 Floppy Disk Controller (FDC) **/

        switch (addr) {
        case 0x3F2: /* diskette controller digital output register */
            motor_on_drive0 = val & 0x10;
            motor_on_drive1 = val & 0x20;
            /* set status bar conditions for Floppy 0 and Floppy 1 */
            if (state.statusbar_id[ 0 ] >= 0) {
                if (motor_on_drive0 != (state.DOR & 0x10)) {
                    //bx_gui.statusbar_setitem(state.statusbar_id[0], motor_on_drive0);
                }
            }
            if (state.statusbar_id[ 1 ] >= 0) {
                if (motor_on_drive1 != (state.DOR & 0x20)) {
                    //bx_gui.statusbar_setitem(state.statusbar_id[1], motor_on_drive1);
                }
            }
            dma_and_interrupt_enable = val & 0x08;
            if (!dma_and_interrupt_enable) {
                debug(("DMA and interrupt capabilities disabled"));
            }
            normal_operation = val & 0x04;
            drive_select = val & 0x03;

            prev_normal_operation = state.DOR & 0x04;
            state.DOR = val;

            if (prev_normal_operation == 0 && normal_operation) {
                // transition from RESET to NORMAL
                //debugger;
                state.floppy_timer_index.activate(250, false);
            } else if (prev_normal_operation && normal_operation == 0) {
                // transition from NORMAL to RESET
                state.main_status_reg &= FD_MS_NDMA;
                state.pending_command = 0xfe; // RESET pending
            }
            debug(("io_write: digital output register"));
            debug(util.sprintf("  motor on, drive1 = %d", motor_on_drive1 > 0));
            debug(util.sprintf("  motor on, drive0 = %d", motor_on_drive0 > 0));
            debug(util.sprintf("  dma_and_interrupt_enable=%02x",
                dma_and_interrupt_enable));
            debug(util.sprintf("  normal_operation=%02x",
                normal_operation));
            debug(util.sprintf("  drive_select=%02x",
                drive_select));
            if (state.device_type[ drive_select ] == FDRIVE_NONE) {
                debug(("WARNING: non existing drive selected"));
            }
            break;

        case 0x3f4: /* diskette controller data rate select register */
            state.data_rate = val & 0x03;
            if (val & 0x80) {
                state.main_status_reg &= FD_MS_NDMA;
                state.pending_command = 0xfe; // RESET pending
                debugger;
                state.floppy_timer_index.activate(250, false);
            }
            if ((val & 0x7c) > 0) {
                util.problem(("write to data rate select register: unsupported bits set"));
            }
            break;

        case 0x3F5: /* diskette controller data */
            //debugger;

            debug(util.sprintf(
                "command = 0x%02x"
                , val
            ));
            if ( (state.main_status_reg & FD_MS_NDMA)
                && ((state.pending_command & 0x4f) == 0x45)
            ) {
                val = device.dma_read(val);
                device.lower_interrupt();
                break;
            } else if (state.command_complete) {
                if (state.pending_command != 0) {
                    util.panic(util.sprintf(
                        "write 0x03f5: receiving new command 0x%02x, old one (0x%02x) pending"
                        , val, state.pending_command
                    ));
                }
                state.command[ 0 ] = val;
                state.command_complete = false;
                state.command_index = 1;
                /* read/write command in progress */
                state.main_status_reg &= ~FD_MS_DIO; // leave drive status untouched
                state.main_status_reg |= FD_MS_MRQ | FD_MS_BUSY;
                switch (val) {
                case 0x03: /* specify */
                    state.command_size = 3;
                    break;
                case 0x04: // get status
                    state.command_size = 2;
                    break;
                case 0x07: /* recalibrate */
                    state.command_size = 2;
                    break;
                case 0x08: /* sense interrupt status */
                    state.command_size = 1;
                    break;
                case 0x0f: /* seek */
                    state.command_size = 3;
                    break;
                case 0x4a: /* read ID */
                    state.command_size = 2;
                    break;
                case 0x4d: /* format track */
                    state.command_size = 6;
                    break;
                case 0x45:
                case 0xc5: /* write normal data */
                    state.command_size = 9;
                    break;
                case 0x46:
                case 0x66:
                case 0xc6:
                case 0xe6: /* read normal data */
                    state.command_size = 9;
                    break;

                case 0x0e: // dump registers (Enhanced drives)
                case 0x10: // Version command, enhanced controller returns 0x90
                case 0x14: // Unlock command (Enhanced)
                case 0x94: // Lock command (Enhanced)
                    state.command_size = 0;
                    state.pending_command = val;
                    device.enter_result_phase();
                    break;
                case 0x12: // Perpendicular mode (Enhanced)
                    state.command_size = 2;
                    break;
                case 0x13: // Configure command (Enhanced)
                    state.command_size = 4;
                    break;

                case 0x18: // National Semiconductor version command; return 80h
                    // These commands are not implemented on the standard
                    // controller and return an error.  They are available on
                    // the enhanced controller.
                    debug(("io_write: 0x3f5: unsupported floppy command 0x%02x",
                        val));
                    state.command_size = 0;   // make sure we don't try to process this command
                    state.status_reg0 = 0x80; // status: invalid command
                    device.enter_result_phase();
                    break;

                default:
                    util.problem(("io_write: 0x3f5: invalid floppy command 0x%02x"
                        , val));
                    state.command_size = 0;   // make sure we don't try to process this command
                    state.status_reg0 = 0x80; // status: invalid command
                    device.enter_result_phase();
                }
            } else {
                //if (state.command[ 0 ] === 0xE6 && state.command_index === 4) {
                //    debugger;
                //}

                state.command[ state.command_index++ ] = val;
            }
            if (state.command_index == state.command_size) {
                /* read/write command not in progress any more */
                device.floppy_command();
                state.command_complete = true;
            }
            debug(("io_write: diskette controller data"));
            return;

        case 0x3F6: /* diskette controller (reserved) */
            debug("FDC (Floppy) writeHandler() ::"
                + " Reserved register 0x3f6 unsupported");
            // this address shared with the hard drive controller
            //DEV_hd_write_handler(bx_devices.pluginHardDrive, address, val, io_len);
            util.warning("FDC :: TODO - DEV_hd_write_handler");
            break;

        case 0x3F7: /* diskette controller configuration control register */
            if ((value & 0x03) != state.data_rate) {
                util.info(("io_write: config control register: 0x%02x", value));
            }
            state.data_rate = value & 0x03;
            switch (state.data_rate) {
            case 0: debug(("  500 Kbps")); break;
            case 1: debug(("  300 Kbps")); break;
            case 2: debug(("  250 Kbps")); break;
            case 3: debug(("  1 Mbps")); break;
            }
            break;

        default:
            util.problem(util.sprintf(
                "FDC (Floppy) writeHandler() :: Unsupported write, address=0x%04X!"
                , addr
            ));
        }
    }

    /* void */FDC.prototype.floppy_command = function () {
        var machine = this.machine, state = this.state
            , i
            , motor_on
            , head, drive, cylinder, sector, eot
            , sector_size, data_length
            , logical_sector, sector_time, step_delay;

        // Print command
        /*char buf[9+(9*5)+1], *p = buf;
        p += sprintf(p, "COMMAND: ");
        for (i=0; i<state.command_size; i++) {
        p += sprintf(p, "[%02x] ", (unsigned) state.command[i]);
        }
        BX_DEBUG(("%s", buf));*/

        // Print command (max. 9 bytes)

        var str = "";
        for (i = 0 ; i < state.command_size ; ++i) {
            str += util.sprintf("[%02x] ", state.command[ i ]);
        }
        debug("COMMAND: " + str);

        state.pending_command = state.command[ 0 ];
        switch (state.pending_command) {
        case 0x03: // specify
            // execution: specified parameters are loaded
            // result: no result bytes, no interrupt
            state.SRT = state.command[ 1 ] >> 4;
            state.HUT = state.command[ 1 ] & 0x0f;
            state.HLT = state.command[ 2 ] >> 1;
            state.main_status_reg |= (state.command[ 2 ] & 0x01) ? FD_MS_NDMA : 0;
            if (state.main_status_reg & FD_MS_NDMA) {
                util.problem(("non-DMA mode not fully implemented yet"));
            }
            this.enter_idle_phase();
            return;

        case 0x04: // get status
            drive = (state.command[ 1 ] & 0x03);
            state.head[ drive ] = (state.command[ 1 ] >> 2) & 0x01;
            state.status_reg3 = 0x28 | (state.head[ drive ] << 2)
                | drive | (state.media[ drive ].write_protected ? 0x40 : 0x00);
            if ( (state.device_type[ drive ] != FDRIVE_NONE)
                && (state.cylinder[ drive ] == 0) ) {
                state.status_reg3 |= 0x10;
            }
            this.enter_result_phase();
            return;

        case 0x07: // recalibrate
            drive = (state.command[ 1 ] & 0x03);
            state.DOR &= 0xfc;
            state.DOR |= drive;
            debug(util.sprintf(
                "floppy_command(): recalibrate drive %u"
                , drive
            ));
            step_delay = this.calculate_step_delay(drive, 0);
            //debugger;
            state.floppy_timer_index.activate(step_delay, false);
            /* command head to track 0
            * controller set to non-busy
            * error condition noted in Status reg 0's equipment check bit
            * seek end bit set to 1 in Status reg 0 regardless of outcome
            * The last two are taken care of in timer().
            */
            state.cylinder[ drive ] = 0;
            state.main_status_reg &= FD_MS_NDMA;
            state.main_status_reg |= (1 << drive);
            return;

        case 0x08: /* sense interrupt status */
            /* execution:
            *   get status
            * result:
            *   no interupt
            *   byte0 = status reg0
            *   byte1 = current cylinder number (0 to 79)
            */
            if (state.reset_sensei > 0) {
                drive = 4 - state.reset_sensei;
                state.status_reg0 &= 0xf8;
                state.status_reg0 |= (state.head[ drive ] << 2) | drive;
                state.reset_sensei--;
            } else if (!state.pending_irq) {
                state.status_reg0 = 0x80;
            }
            debug(("sense interrupt status"));
            this.enter_result_phase();
            return;

        case 0x0f: /* seek */
            /* command:
            *   byte0 = 0F
            *   byte1 = drive & head select
            *   byte2 = cylinder number
            * execution:
            *   postion head over specified cylinder
            * result:
            *   no result bytes, issues an interrupt
            */
            drive = state.command[ 1 ] & 0x03;
            state.DOR &= 0xfc;
            state.DOR |= drive;

            state.head[ drive ] = (state.command[ 1 ] >> 2) & 0x01;
            step_delay = this.calculate_step_delay(drive, state.command[ 2 ]);
            //debugger;
            state.floppy_timer_index.activate(step_delay, false);
            /* ??? should also check cylinder validity */
            state.cylinder[ drive ] = state.command[ 2 ];
            /* data reg not ready, drive not busy */
            state.main_status_reg &= FD_MS_NDMA;
            state.main_status_reg |= (1 << drive);
            return;

        case 0x13: // Configure
            debug(util.sprintf(
                "configure (eis     = 0x%02x)"
                , state.command[ 2 ] & 0x40
            ));
            debug(util.sprintf(
                "configure (efifo   = 0x%02x)"
                , state.command[ 2 ] & 0x20
            ));
            debug(util.sprintf(
                "configure (no poll = 0x%02x)"
                , state.command[ 2 ] & 0x10
            ));
            debug(util.sprintf(
                "configure (fifothr = 0x%02x)"
                , state.command[ 2 ] & 0x0f
            ));
            debug(util.sprintf(
                "configure (pretrk  = 0x%02x)"
                , state.command[ 3 ]
            ));
            state.config = state.command[ 2 ];
            state.pretrk = state.command[ 3 ];
            this.enter_idle_phase();
            return;

        case 0x4a: // read ID
            drive = state.command[ 1 ] & 0x03;
            state.head[ drive ] = (state.command[ 1 ] >> 2) & 0x01;
            state.DOR &= 0xfc;
            state.DOR |= drive;

            motor_on = (state.DOR >> (drive + 4)) & 0x01;
            if (motor_on == 0) {
                util.problem(("floppy_command(): read ID: motor not on"));
                state.main_status_reg &= FD_MS_NDMA;
                state.main_status_reg |= FD_MS_BUSY;
                return; // Hang controller
            }
            if (state.device_type[ drive ] == FDRIVE_NONE) {
                util.problem(util.sprintf(
                    "floppy_command(): read ID: bad drive #%d"
                    , drive
                ));
                state.main_status_reg &= FD_MS_NDMA;
                state.main_status_reg |= FD_MS_BUSY;
                return; // Hang controller
            }
            if (state.media_present[ drive ] == 0) {
                util.info(("attempt to read sector ID with media not present"));
                state.main_status_reg &= FD_MS_NDMA;
                state.main_status_reg |= FD_MS_BUSY;
                return; // Hang controller
            }
            state.status_reg0 = (state.head[ drive ] << 2) | drive;
            // time to read one sector at 300 rpm
            sector_time = 200000 / state.media[ drive ].sectors_per_track;
            //debugger;
            state.floppy_timer_index.activate(sector_time, false);
            /* data reg not ready, controller busy */
            state.main_status_reg &= FD_MS_NDMA;
            state.main_status_reg |= FD_MS_BUSY;
            return;

        case 0x4d: // format track
            drive = state.command[ 1 ] & 0x03;
            state.DOR &= 0xfc;
            state.DOR |= drive;

            motor_on = (state.DOR >> (drive + 4)) & 0x01;
            if (motor_on == 0) {
                util.panic(("floppy_command(): format track: motor not on"));
            }
            state.head[ drive ] = (state.command[ 1 ] >> 2) & 0x01;
            sector_size = state.command[ 2 ];
            state.format_count = state.command[ 3 ];
            state.format_fillbyte = state.command[ 5 ];
            if (state.device_type[drive] == FDRIVE_NONE) {
                util.panic(util.sprintf(
                    "floppy_command(): format track: bad drive #%d"
                    , drive
                ));
            }

            if (sector_size != 0x02) { // 512 bytes
                util.panic(util.sprintf(
                    "format track: sector size %d not supported"
                    , 128 << sector_size
                ));
            }
            if (state.format_count != state.media[ drive ].sectors_per_track) {
                util.panic(util.sprintf(
                    "format track: %d sectors/track requested (%d expected)"
                    , state.format_count, state.media[drive].sectors_per_track
                ));
            }
            if (state.media_present[ drive ] == 0) {
                util.info(("attempt to format track with media not present"));
                return; // Hang controller
            }
            if (state.media[ drive ].write_protected) {
                // media write-protected, return error
                util.info(("attempt to format track with media write-protected"));
                state.status_reg0 = 0x40 | (state.head[ drive ] << 2) | drive; // abnormal termination
                state.status_reg1 = 0x27; // 0010 0111
                state.status_reg2 = 0x31; // 0011 0001
                this.enter_result_phase();
                return;
            }

            /* 4 header bytes per sector are required */
            state.format_count <<= 2;

            if (state.main_status_reg & FD_MS_NDMA) {
                debug(("non-DMA floppy format unimplemented"));
            } else {
                machine.dma.setDRQ(FLOPPY_DMA_CHAN, 1);
            }
            /* data reg not ready, controller busy */
            state.main_status_reg &= FD_MS_NDMA;
            state.main_status_reg |= FD_MS_BUSY;
            debug(("format track"));
            return;

        case 0x46: // read normal data, MT=0, SK=0
        case 0x66: // read normal data, MT=0, SK=1
        case 0xc6: // read normal data, MT=1, SK=0
        case 0xe6: // read normal data, MT=1, SK=1
        case 0x45: // write normal data, MT=0
        case 0xc5: // write normal data, MT=1
            state.multi_track = !!(state.command[ 0 ] >> 7);
            if ((state.DOR & 0x08) == 0) {
                util.panic(("read/write command with DMA and int disabled"));
            }
            drive = state.command[ 1 ] & 0x03;
            state.DOR &= 0xfc;
            state.DOR |= drive;

            motor_on = (state.DOR >> (drive + 4)) & 0x01;
            if (motor_on == 0) {
                util.panic(("floppy_command(): read/write: motor not on"));
            }
            head = state.command[ 3 ] & 0x01;
            cylinder = state.command[ 2 ]; /* 0..79 depending */
            sector = state.command[ 4 ];   /* 1..36 depending */
            eot = state.command[ 6 ];      /* 1..36 depending */
            sector_size = state.command[ 5 ];
            data_length = state.command[ 8 ];
            debug(("read/write normal data"));
            debug(("BEFORE"));
            debug(util.sprintf("  drive    = %u", drive));
            debug(util.sprintf("  head     = %u", head));
            debug(util.sprintf("  cylinder = %u", cylinder));
            debug(util.sprintf("  sector   = %u", sector));
            debug(util.sprintf("  eot      = %u", eot));

            if (state.device_type[drive] == FDRIVE_NONE) {
                debug(util.sprintf(
                    "floppy_command(): read/write: bad drive #%d"
                    , drive
                ));
            }

            // check that head number in command[1] bit two matches the head
            // reported in the head number field.  Real floppy drives are
            // picky about this, as reported in SF bug #439945, (Floppy drive
            // read input error checking).
            if (head != ((state.command[1]>>2)&1)) {
                util.problem(("head number in command[1] doesn't match head field"));
                state.status_reg0 = 0x40 | (state.head[ drive ] << 2) | drive; // abnormal termination
                state.status_reg1 = 0x04; // 0000 0100
                state.status_reg2 = 0x00; // 0000 0000
                this.enter_result_phase();
                return;
            }

            if (state.media_present[ drive ] == 0) {
                util.info(util.sprintf(
                    "attempt to read/write sector %u with media not present"
                    , sector
                ));
                return; // Hang controller
            }

            if (sector_size != 0x02) { // 512 bytes
                util.panic(util.sprintf(
                    "read/write command: sector size %d not supported"
                    , 128 << sector_size
                ));
            }

            if (cylinder >= state.media[ drive ].tracks) {
                debugger;
                util.panic(util.sprintf(
                    "io: norm r/w parms out of range: sec#%02xh cyl#%02xh eot#%02xh head#%02xh"
                    , sector, cylinder, eot, head
                ));
                return;
            }

            if (sector > state.media[ drive ].sectors_per_track) {
                //debugger;
                util.info(util.sprintf(
                    "attempt to read/write sector %u past last sector %u"
                    , sector, state.media[drive].sectors_per_track
                ));
                state.cylinder[ drive ] = cylinder;
                state.head[ drive ]     = head;
                state.sector[ drive ]   = sector;

                state.status_reg0 = 0x40 | (state.head[ drive ] << 2) | drive;
                state.status_reg1 = 0x04;
                state.status_reg2 = 0x00;
                this.enter_result_phase();
                return;
            }

            if (cylinder != state.cylinder[ drive ]) {
                debug(("io: cylinder request != current cylinder"));
                this.reset_changeline();
            }

            logical_sector = (
                cylinder * state.media[drive].heads
                    * state.media[drive].sectors_per_track
                ) + (head * state.media[drive].sectors_per_track)
                + (sector - 1);

            if (logical_sector >= state.media[ drive ].sectors) {
                util.panic(("io: logical sector out of bounds"));
            }
            // This hack makes older versions of the Bochs BIOS work
            if (eot == 0) {
                eot = state.media[ drive ].sectors_per_track;
            }
            state.cylinder[ drive ] = cylinder;
            state.head[ drive ]     = head;
            state.sector[ drive ]   = sector;
            state.eot[ drive ]      = eot;

            if ((state.command[ 0 ] & 0x4f) == 0x46) { // read
                this.floppy_xfer(
                    drive
                    , logical_sector * 512
                    , state.floppy_buffer
                    , 512
                    , FROM_FLOPPY
                );
                /* controller busy; if DMA mode, data reg not ready */
                state.main_status_reg &= FD_MS_NDMA;
                state.main_status_reg |= FD_MS_BUSY;
                if (state.main_status_reg & FD_MS_NDMA) {
                    state.main_status_reg |= (FD_MS_MRQ | FD_MS_DIO);
                }
                // time to read one sector at 300 rpm
                sector_time = 200000 / state.media[ drive ].sectors_per_track;
                //debugger;
                state.floppy_timer_index.activate(sector_time, false);
            } else if ((state.command[ 0 ] & 0x7f) == 0x45) { // write
                /* controller busy; if DMA mode, data reg not ready */
                state.main_status_reg &= FD_MS_NDMA;
                state.main_status_reg |= FD_MS_BUSY;
                if (state.main_status_reg & FD_MS_NDMA) {
                    state.main_status_reg |= FD_MS_MRQ;
                } else {
                    machine.dma.setDRQ(FLOPPY_DMA_CHAN, 1);
                }
            } else {
                util.panic(("floppy_command(): unknown read/write command"));
                return;
            }
            break;

        case 0x12: // Perpendicular mode
            state.perp_mode = state.command[ 1 ];
            util.info(util.sprintf(
                "perpendicular mode: config=0x%02x"
                , state.perp_mode
            ));
            this.enter_idle_phase();
            break;

        default: // invalid or unsupported command; these are captured in write() above
            util.panic(util.sprintf(
                "You should never get here! cmd = 0x%02x"
                , state.command[ 0 ]
            ));
        }
    };

    // Based on [bx_floppy_ctrl_c::floppy_xfer]
    /* void */FDC.prototype.floppy_xfer = function (
        drive
        , offset
        , buffer
        , bytes
        , direction
    ) {
        var machine = this.machine, state = this.state
            , ret = 0;

        if (state.device_type[ drive ] == FDRIVE_NONE) {
            util.panic(util.sprintf("floppy_xfer: bad drive #%d", drive));
        }

        debug(util.sprintf(
            "floppy_xfer: drive=%u, offset=%u, bytes=%u, direction=%s floppy"
            , drive
            , offset
            , bytes
            , (direction == FROM_FLOPPY) ? "from" : "to"
        ));

        if (direction == FROM_FLOPPY) {//debugger;
            //ret = ::read(state.media[drive].fd, (bx_ptr_t) buffer, bytes);
            ret = Buffer.copy(
                state.media[ drive ].data
                , offset
                , buffer
                , 0
                , bytes
            );

            if (ret < bytes) {
                /* ??? */
                if (ret > 0) {
                    util.info(util.sprintf(
                        "partial read() on floppy image returns %u/%u"
                        , ret, bytes
                    ));
                    // Zero rest of bytes from end of write to "bytes"
                    Buffer.zeroBuffer(buffer, ret, bytes - ret);
                } else {
                    util.info(("read() on floppy image returns 0"));
                    // Zero buffer up to "bytes"
                    Buffer.zeroBuffer(buffer, 0, bytes);
                }
            }
        // TO_FLOPPY
        } else {
            util.assert(!state.media[ drive ].write_protected);

            //ret = ::write(state.media[drive].fd, (bx_ptr_t) buffer, bytes);
            ret = Buffer.copy(
                buffer
                , 0
                , state.media[ drive ].data
                , offset
                , bytes
            );

            if (ret < bytes) {
                util.panic(("could not perform write() on floppy image file"));
            }
        }
    };

    // Based on [bx_floppy_ctrl_c::timer_handler]
    /* void */FDC.prototype.timer_handler = function (ticksNow) {
        // TODO: Merge this with .timer() ?
        this.timer();
    };

    // Based on [bx_floppy_ctrl_c::timer]
    /* void */FDC.prototype.timer = function () {
        var machine = this.machine, state = this.state
            , drive, motor_on;
        //debugger;
        drive = state.DOR & 0x03;
        switch (state.pending_command) {
        case 0x07: // recal
            state.status_reg0 = 0x20 | drive;
            motor_on = ((state.DOR >> (drive + 4)) & 0x01);
            if ((state.device_type[ drive ] == FDRIVE_NONE) || (motor_on == 0)) {
                state.status_reg0 |= 0x50;
            }
            this.enter_idle_phase();
            this.raise_interrupt();
            break;

        case 0x0f: // seek
            state.status_reg0 = 0x20 | (state.head[ drive ] << 2) | drive;
            this.enter_idle_phase();
            this.raise_interrupt();
            break;

        case 0x4a: /* read ID */
            this.enter_result_phase();
            break;

        case 0x45: /* write normal data */
        case 0xc5:
            if (state.TC) { // Terminal Count line, done
                state.status_reg0 = (state.head[ drive ] << 2) | drive;
                state.status_reg1 = 0;
                state.status_reg2 = 0;

                debug(("<<WRITE DONE>>"));
                debug(("AFTER"));
                debug(util.sprintf("  drive    = %u", drive));
                debug(util.sprintf("  head     = %u", state.head[ drive ]));
                debug(util.sprintf("  cylinder = %u", state.cylinder[ drive ]));
                debug(util.sprintf("  sector   = %u", state.sector[ drive ]));

                this.enter_result_phase();
            } else {
                // transfer next sector
                if (!(state.main_status_reg & FD_MS_NDMA)) {
                    machine.dma.setDRQ(FLOPPY_DMA_CHAN, 1);
                }
            }
            break;

        case 0x46: /* read normal data */
        case 0x66:
        case 0xc6:
        case 0xe6:
            //debugger;
            // transfer next sector
            if (state.main_status_reg & FD_MS_NDMA) {
                state.main_status_reg &= ~FD_MS_BUSY;  // clear busy bit
                state.main_status_reg |= FD_MS_MRQ | FD_MS_DIO;  // data byte waiting
            } else {
                machine.dma.setDRQ(FLOPPY_DMA_CHAN, 1);
            }
            break;

        case 0x4d: /* format track */
            if ((state.format_count == 0) || state.TC) {
                state.format_count = 0;
                state.status_reg0 = (state.head[ drive ] << 2) | drive;
                this.enter_result_phase();
            } else {
                // transfer next sector
                if (!(state.main_status_reg & FD_MS_NDMA)) {
                    machine.dma.setDRQ(FLOPPY_DMA_CHAN, 1);
                }
            }
            break;

        case 0xfe: // (contrived) RESET
            this.reset(PC.RESET_SOFTWARE);
            state.pending_command = 0;
            state.status_reg0 = 0xc0;
            this.raise_interrupt();
            state.reset_sensei = 4;
            break;

        case 0x00: // nothing pending?
            break;

        default:
            util.panic(util.sprintf(
                "floppy:timer(): unknown case %02x"
                , state.pending_command
            ));
        }
    };

    // Based on [bx_floppy_ctrl_c::dma_write]
    /* void */FDC.prototype.dma_write = function () {
        var machine = this.machine, state = this.state
            , drive = state.DOR & 0x03, result8;

        // A DMA write is from I/O to Memory
        // We need to return the next data byte from the floppy buffer
        // to be transfered via the DMA to memory. (read block from floppy)

        result8 = state.floppy_buffer[ state.floppy_buffer_index++ ];

        state.TC = this.get_tc();
        if ((state.floppy_buffer_index >= 512) || (state.TC)) {

            if (state.floppy_buffer_index >= 512) {
                this.increment_sector(); // increment to next sector before retrieving next one
                state.floppy_buffer_index = 0;
            }
            if (state.TC) { // Terminal Count line, done
                state.status_reg0 = (state.head[ drive ] << 2) | drive;
                state.status_reg1 = 0;
                state.status_reg2 = 0;

                debug(("<<READ DONE>>"));
                debug(("AFTER"));
                debug(util.sprintf("  drive    = %u", drive));
                debug(util.sprintf("  head     = %u", state.head[ drive ]));
                debug(util.sprintf("  cylinder = %u", state.cylinder[ drive ]));
                debug(util.sprintf("  sector   = %u", state.sector[ drive ]));

                if (!(state.main_status_reg & FD_MS_NDMA)) {
                    machine.dma.setDRQ(FLOPPY_DMA_CHAN, 0);
                }
                this.enter_result_phase();
            } else { // more data to transfer
                var logical_sector, sector_time;

                // remember that not all floppies have two sides, multiply by s.head[drive]
                logical_sector = (
                    state.cylinder[ drive ] * state.media[ drive ].heads
                        * state.media[ drive ].sectors_per_track
                    ) + (state.head[ drive ] * state.media[ drive ].sectors_per_track)
                    + (state.sector[ drive ] - 1);

                this.floppy_xfer(
                    drive
                    , logical_sector * 512
                    , state.floppy_buffer
                    , 512
                    , FROM_FLOPPY
                );
                if (!(state.main_status_reg & FD_MS_NDMA)) {
                    machine.dma.setDRQ(FLOPPY_DMA_CHAN, 0);
                }
                // time to read one sector at 300 rpm
                sector_time = 200000 / state.media[ drive ].sectors_per_track;
                //debugger;
                state.floppy_timer_index.activate(sector_time, false);
            }
        }
        return result8;
    };

    // Based on [bx_floppy_ctrl_c::dma_read]
    /* void */FDC.prototype.dma_read = function (data_byte) {
        var machine = this.machine, state = this.state
            , i, drive, logical_sector, sector_time;

        // A DMA read is from Memory to I/O
        // We need to write the data_byte which was already transferred from memory
        // via DMA to I/O (write block to floppy)

        drive = state.DOR & 0x03;
        if (state.pending_command == 0x4d) { // format track in progress
            state.format_count--;
            switch (3 - (state.format_count & 0x03)) {
            case 0:
                state.cylinder[ drive ] = data_byte;
                break;
            case 1:
                if (data_byte != state.head[ drive ]) {
                    util.problem(("head number does not match head field"));
                }
                break;
            case 2:
                state.sector[ drive ] = data_byte;
                break;
            case 3:
                if (data_byte != 2) {
                    util.problem(util.sprintf(
                        "dma_read: sector size %d not supported"
                        , 128 << (data_byte)
                    ));
                }
                debug(util.sprintf(
                    "formatting cylinder %u head %u sector %u"
                    , state.cylinder[ drive ]
                    , state.head[ drive ]
                    , state.sector[ drive ]
                ));
                for (i = 0 ; i < 512 ; i++) {
                    state.floppy_buffer[ i ] = state.format_fillbyte;
                }
                logical_sector = (
                    state.cylinder[ drive ] * state.media[ drive ].heads
                        * state.media[ drive ].sectors_per_track
                    ) + (state.head[ drive ] * state.media[ drive ].sectors_per_track)
                    + (state.sector[ drive ] - 1);
                this.floppy_xfer(
                    drive
                    , logical_sector * 512
                    , state.floppy_buffer
                    , 512
                    , TO_FLOPPY
                );
                if (!(state.main_status_reg & FD_MS_NDMA)) {
                    machine.dma.setDRQ(FLOPPY_DMA_CHAN, 0);
                }
                // time to write one sector at 300 rpm
                sector_time = 200000 / state.media[ drive ].sectors_per_track;
                //debugger;
                state.floppy_timer_index.activate(sector_time, false);
                break;
            }
        } else { // write normal data
            state.floppy_buffer[ state.floppy_buffer_index++ ] = data_byte;

            state.TC = this.get_tc();
            if ((state.floppy_buffer_index >= 512) || (state.TC)) {
                logical_sector = (
                    state.cylinder[ drive ] * state.media[ drive ].heads
                        * state.media[ drive ].sectors_per_track
                    ) + (state.head[ drive ] * state.media[ drive ].sectors_per_track)
                    + (state.sector[ drive ] - 1);
                if (state.media[drive].write_protected) {
                    // write protected error
                    util.info(util.sprintf(
                        "tried to write disk %u, which is write-protected"
                        , drive
                    ));
                    // ST0: IC1,0=01  (abnormal termination: started execution but failed)
                    state.status_reg0 = 0x40 | (state.head[ drive ] << 2) | drive;
                    // ST1: DataError=1, NDAT=1, NotWritable=1, NID=1
                    state.status_reg1 = 0x27; // 0010 0111
                    // ST2: CRCE=1, SERR=1, BCYL=1, NDAM=1.
                    state.status_reg2 = 0x31; // 0011 0001
                    this.enter_result_phase();
                    return;
                }
                this.floppy_xfer(
                    drive
                    , logical_sector * 512
                    , state.floppy_buffer
                    , 512
                    , TO_FLOPPY
                );
                this.increment_sector(); // increment to next sector after writing current one
                state.floppy_buffer_index = 0;
                if (!(state.main_status_reg & FD_MS_NDMA)) {
                    machine.dma.setDRQ(FLOPPY_DMA_CHAN, 0);
                }
                // time to write one sector at 300 rpm
                sector_time = 200000 / state.media[ drive ].sectors_per_track;
                //debugger;
                state.floppy_timer_index.activate(sector_time, false);
                // the following is a kludge; i (jc) don't know how to work with the timer
                if ((state.main_status_reg & FD_MS_NDMA) && state.TC) {
                    this.enter_result_phase();
                }
            }
        }
    };

    // Based on [bx_floppy_ctrl_c::raise_interrupt]
    /* void */FDC.prototype.raise_interrupt = function () {
        var machine = this.machine, state = this.state;

        machine.pic.raiseIRQ(6);
        state.pending_irq = true;
        state.reset_sensei = 0;
    };

    // Based on [bx_floppy_ctrl_c::lower_interrupt]
    /* void */FDC.prototype.lower_interrupt = function () {
        var machine = this.machine, state = this.state;

        if (state.pending_irq) {
            machine.pic.lowerIRQ(6);
            state.pending_irq = false;
        }
    };

    // Based on [bx_floppy_ctrl_c::increment_sector]
    /* void */FDC.prototype.increment_sector = function () {
        var state = this.state
            , drive = state.DOR & 0x03;

        // values after completion of data xfer
        // ??? calculation depends on base_count being multiple of 512
        state.sector[ drive ]++;
        if ( (state.sector[ drive ] > state.eot[ drive ])
            || (state.sector[ drive ] > state.media[ drive ].sectors_per_track)
        ) {
            state.sector[ drive ] = 1;
            if (state.multi_track) {
                state.head[ drive ] ++;
                if (state.head[ drive ] > 1) {
                    state.head[ drive ] = 0;
                    state.cylinder[ drive ] ++;
                    this.reset_changeline();
                }
            } else {
                state.cylinder[ drive ]++;
                this.reset_changeline();
            }
            if (state.cylinder[ drive ] >= state.media[ drive ].tracks) {
                // Set to 1 past last possible cylinder value.
                // I notice if I set it to tracks-1, prama linux won't boot.
                state.cylinder[ drive ] = state.media[ drive ].tracks;
                util.info(("increment_sector: clamping cylinder to max"));
            }
        }
    };

    // Based on [bx_floppy_ctrl_c::set_media_status]
    /* unsigned */FDC.prototype.set_media_status = function (drive, status) {
        var state = this.state
            , emu = this.machine.emu
            , path, type, disk;

        if (drive == 0) {
            //type = SIM.get_param_enum(BXPN_FLOPPYA_TYPE).get();
            type = emu.getSetting("floppy0.diskType");
        } else {
            //type = SIM.get_param_enum(BXPN_FLOPPYB_TYPE).get();
            type = emu.getSetting("floppy1.diskType");
        }

        // if setting to the current value, nothing to do
        if ( (status == state.media_present[ drive ])
            && ((status == 0) || (type == state.media[ drive ].type))
        ) {
            return status;
        }

        if (status == 0) {
            // eject floppy
            state.media[ drive ].eject();
            state.media_present[ drive ] = false;
            if (drive == 0) {
                //SIM.get_param_bool(BXPN_FLOPPYA_STATUS).set(0);
                emu.setSetting("floppy0.status", false);
            } else {
                //SIM.get_param_bool(BXPN_FLOPPYB_STATUS).set(0);
                emu.setSetting("floppy1.status", false);
            }
            state.DIR[ drive ] |= 0x80; // disk changed line
            return 0;
        } else {
            // insert floppy
            if (drive == 0) {
                path = emu.getSetting("floppy0.path");
            } else {
                path = emu.getSetting("floppy1.path");
            }
            if (path === null || path === "none") {
                return 0;
            }
            if ( this.evaluate_media(
                state.device_type[ drive ]
                , type
                , path
                , state.media[ drive ])
            ) {
                state.media_present[ drive ] = true;

                disk = state.media[ drive ];
                util.info(util.sprintf("FDC.init > setupFloppy() ::"
                    + " fd%d: '%s' ro=%d, h=%d, t=%d, spt=%d"
                    , drive, path, disk.heads, disk.tracks, disk.sectors_per_track
                ));
                emu.setSetting("floppy" + drive + ".status", true);

                return 1;
            } else {
                state.media_present[ drive ] = false;

                emu.setSetting("floppy" + drive + ".status", false);
                emu.setSetting("floppy" + drive + ".diskType", FLOPPY_NONE);

                return 0;
            }
        }
    };

    // Based on [bx_floppy_ctrl_c::get_media_status]
    /* unsigned */FDC.prototype.get_media_status = function (drive) {
        return state.media_present[ drive ];
    };

    // Based on [bx_floppy_ctrl_c::evaluate_media]
    /* bool */FDC.prototype.evaluate_media = function (
        devtype
        , type
        , path
        , media
        , done
        , fail
    ) {
        var i, ret, type_idx = -1, sizeBytes;

        // Check media type
        if (type == FLOPPY_NONE) {
            fail();
            return;
        }

        for (i = 0; i < 8; i++) {
            if (type == floppy_type[ i ].id) { type_idx = i; }
        }
        if (type_idx == -1) {
            util.problem(util.sprintf(
                "evaluate_media: unknown media type %d"
                , type
            ));
            fail();
            return;
        }
        if ((floppy_type[ type_idx ].drive_mask & devtype) == 0) {
            util.problem(util.sprintf(
                "evaluate_media: media type %d not valid for this floppy drive"
                , type
            ));
            fail();
            return;
        }

        media.write_protected = false;

        media.loadFile(
            path
            , function () {
                sizeBytes = media.getDataSize();

                switch (type) {
                // use CMOS reserved types
                case FLOPPY_160K: // 160K 5.25"
                case FLOPPY_180K: // 180K 5.25"
                case FLOPPY_320K: // 320K 5.25"
                // standard floppy types
                case FLOPPY_360K: // 360K 5.25"
                case FLOPPY_720K: // 720K 3.5"
                case FLOPPY_1_2: // 1.2M 5.25"
                case FLOPPY_2_88: // 2.88M 3.5"
                    media.type              = type;
                    media.tracks            = floppy_type[ type_idx ].trk;
                    media.heads             = floppy_type[ type_idx ].hd;
                    media.sectors_per_track = floppy_type[ type_idx ].spt;
                    media.sectors           = floppy_type[ type_idx ].sectors;
                    if (sizeBytes > (media.sectors * 512)) {
                        util.problem(util.sprintf(
                            "evaluate_media: size of file '%s' (%lu) too large for selected type",
                            path, sizeBytes
                        ));
                        fail();
                        return;
                    }
                    break;
                default: // 1.44M 3.5"
                    media.type                  = type;
                    if (sizeBytes <= 1474560) {
                        media.tracks            = floppy_type[ type_idx ].trk;
                        media.heads             = floppy_type[ type_idx ].hd;
                        media.sectors_per_track = floppy_type[ type_idx ].spt;
                    } else if (sizeBytes == 1720320) {
                        media.sectors_per_track = 21;
                        media.tracks            = 80;
                        media.heads             = 2;
                    } else if (sizeBytes == 1763328) {
                        media.sectors_per_track = 21;
                        media.tracks            = 82;
                        media.heads             = 2;
                    } else if (sizeBytes == 1884160) {
                        media.sectors_per_track = 23;
                        media.tracks            = 80;
                        media.heads             = 2;
                    } else {
                        util.problem(util.sprintf(
                            "evaluate_media: file '%s' of unknown size %lu",
                            path, sizeBytes
                        ));
                        fail();
                        return;
                    }
                    media.sectors = media.heads * media.tracks * media.sectors_per_track;
                }

                if (media.sectors > 0) {
                    done();
                } else {
                    fail();
                }
            }, function () {
                util.info(util.sprintf(
                    "Could not open '%s' for read/write"
                    , path
                ));
                media.type = type;
                fail();
            }
        );
    };

    // Based on [bx_floppy_ctrl_c::enter_result_phase]
    /*void */FDC.prototype.enter_result_phase = function () {
        var state = this.state
            , drive = state.DOR & 0x03, i;

        /* these are always the same */
        state.result_index = 0;
        // not necessary to clear any status bits, we're about to set them all
        state.main_status_reg |= FD_MS_MRQ | FD_MS_DIO | FD_MS_BUSY;

        /* invalid command */
        if ((state.status_reg0 & 0xc0) == 0x80) {
            state.result_size = 1;
            state.result[ 0 ] = state.status_reg0;
            return;
        }

        switch (state.pending_command) {
        case 0x04: // get status
            state.result_size = 1;
            state.result[ 0 ] = state.status_reg3;
            break;
        case 0x08: // sense interrupt
            state.result_size = 2;
            state.result[ 0 ] = state.status_reg0;
            state.result[ 1 ] = state.cylinder[ drive ];
            break;
        case 0x0e: // dump registers
            state.result_size = 10;
            for (i = 0 ; i < 4 ; i++) {
                state.result[ i ] = state.cylinder[ i ];
            }
            state.result[ 4 ] = (state.SRT << 4) | state.HUT;
            state.result[ 5 ] = (state.HLT << 1) | ((state.main_status_reg & FD_MS_NDMA) ? 1 : 0);
            state.result[ 6 ] = state.eot[ drive ];
            state.result[ 7 ] = (state.lock << 7) | (state.perp_mode & 0x7f);
            state.result[ 8 ] = state.config;
            state.result[ 9 ] = state.pretrk;
            break;
        case 0x10: // version
            state.result_size = 1;
            state.result[ 0 ] = 0x90;
            break;
        case 0x14: // unlock
        case 0x94: // lock
            state.lock = !!(state.pending_command >> 7);
            state.result_size = 1;
            state.result[ 0 ] = (state.lock << 4);
            break;
        case 0x4a: // read ID
        case 0x4d: // format track
        case 0x46: // read normal data
        case 0x66:
        case 0xc6:
        case 0xe6:
        case 0x45: // write normal data
        case 0xc5:
            state.result_size = 7;
            state.result[ 0 ] = state.status_reg0;
            state.result[ 1 ] = state.status_reg1;
            state.result[ 2 ] = state.status_reg2;
            state.result[ 3 ] = state.cylinder[ drive ];
            state.result[ 4 ] = state.head[ drive ];
            state.result[ 5 ] = state.sector[ drive ];
            state.result[ 6 ] = 2; /* sector size code */
            this.raise_interrupt();
            break;
        }

        // Print command result (max. 10 bytes)

        var str = "";
        for (i = 0 ; i < state.result_size ; ++i) {
            str += util.sprintf("[%02x] ", state.result[ i ]);
        }
        debug("RESULT: " + str);
    };

    // Based on [bx_floppy_ctrl_c::enter_idle_phase]
    /*void */FDC.prototype.enter_idle_phase = function () {
        var state = this.state;

        state.main_status_reg &= (FD_MS_NDMA | 0x0f);  // leave drive status untouched
        state.main_status_reg |= FD_MS_MRQ; // data register ready

        state.command_complete = true; /* waiting for new command */
        state.command_index = 0;
        state.command_size = 0;
        state.pending_command = 0;

        state.floppy_buffer_index = 0;
    };

    // Based on [bx_floppy_ctrl_c::calculate_step_delay]
    /* Bit32u */FDC.prototype.calculate_step_delay
    = function (drive, new_cylinder) {
        var state = this.state
            , steps = 0x00
            , one_step_delay = 0x00000000;

        if (new_cylinder == state.cylinder[ drive ]) {
            steps = 1;
        } else {
            steps = Math.abs(new_cylinder - state.cylinder[ drive ]);
            this.reset_changeline();
        }
        one_step_delay = ((state.SRT ^ 0x0f) + 1) * 500000 / drate_in_k[ state.data_rate ];
        one_step_delay = (one_step_delay >>> 0); // Force to 32-bit int
        return (steps * one_step_delay);
    };

    // Based on [bx_floppy_ctrl_c::reset_changeline]
    /* void */FDC.prototype.reset_changeline = function () {
        var machine = this.machine, state = this.state
            , drive = state.DOR & 0x03;
        if (state.media_present[ drive ]) {
            state.DIR[ drive ] &= ~0x80;
        }
    };

    // Based on [bx_floppy_ctrl_c::get_tc]
    /* bool */FDC.prototype.get_tc = function () {
        var machine = this.machine, state = this.state
            , drive = 0x00
            , terminal_count = false;
        if (state.main_status_reg & FD_MS_NDMA) {
            drive = state.DOR & 0x03;
            /*
             * [Bochs]
             * figure out if we've sent all the data, in non-DMA mode...
             * the drive stays on the same cylinder for a read or write, so that's
             * not going to be an issue. EOT stands for the last sector to be I/Od.
             * it does all the head 0 sectors first, then the second if any.
             * now, regarding reaching the end of the sector:
             *  == 512 would make it more precise, allowing one to spot bugs...
             *  >= 512 makes it more robust, but allows for sloppy code...
             *  pick your poison?
             * note: byte and head are 0-based; eot, sector, and heads are 1-based.
             */
            terminal_count = ((state.floppy_buffer_index == 512) &&
                (state.sector[ drive ] == state.eot[ drive ]) &&
                (state.head[ drive ] == (state.media[ drive ].heads - 1)));
        } else {
            terminal_count = machine.dma.getTC();
        }
        return terminal_count;
    };

    function FloppyType(id, tracks, heads, sectorsPerTrack, sectors, mask) {
        this.id = id;
        this.trk = tracks;
        this.hd = heads;
        this.spt = sectorsPerTrack;
        this.sectors = sectors;
        this.drive_mask = mask;
    }
    /* ====== /Private ====== */

    // Exports
    return FDC;
});
