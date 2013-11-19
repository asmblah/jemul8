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
    "tools/TestSystem"
], function (
    util,
    TestSystem
) {
    "use strict";

    describe("CMOS I/O device", function () {
        var system,
            testSystem;

        util.each([
            {
                // 1KB of total memory
                memoryKB: 1,
                // 0KB of extended memory, because conventional memory is first 1MB
                expectedExtendedMemoryKBBelow64MB: 0
            },
            {
                // 16MB of total memory
                memoryKB: 16 * 1024,
                // 0KB of extended memory, because conventional memory is first 1MB
                expectedExtendedMemoryKBBelow64MB: 15 * 1024
            }
        ], function (scenario) {
            describe("when there is " + scenario.memoryKB + "KB of extended memory (above 1MB)", function () {
                beforeEach(function (done) {
                    testSystem = new TestSystem({
                        memory: {
                            kilobytes: scenario.memoryKB
                        }
                    });
                    system = testSystem.getSystem();

                    testSystem.init().done(function () {
                        done();
                    });
                });

                afterEach(function () {
                    system.pause();
                    system = null;
                    testSystem = null;
                });

                it("should return 0xFF when reading index port 0x70", function (done) {
                    var assembly = util.heredoc(function (/*<<<EOS
mov dx, 0x70
in al, dx
hlt
EOS
*/) {});

                    testSystem.execute(assembly).done(function () {
                        expect(system.getCPURegisters().al.get()).to.equal(0xFF);
                        done();
                    }).fail(function (exception) {
                        done(exception);
                    });
                });

                it("should report 640K of base memory", function (done) {
                    var assembly = util.heredoc(function (/*<<<EOS
;; Write to index port
mov dx, 0x70
mov al, 0x15
out dx, al

;; Read CMOS register 0x15 to get low byte
mov dx, 0x71
in al, dx
;; Place low byte in BL
mov bl, al

;; Write to index port
mov dx, 0x70
mov al, 0x16
out dx, al

;; Read CMOS register 0x16 to get high byte
mov dx, 0x71
in al, dx
;; Place high byte in BH
mov bh, al

hlt
EOS
*/) {});

                    testSystem.execute(assembly).done(function () {
                        expect(system.getCPURegisters().bx.get()).to.equal(640);
                        done();
                    }).fail(function (exception) {
                        done(exception);
                    });
                });

                util.each([
                    {
                        low: 0x17,
                        high: 0x18
                    },
                    {
                        low: 0x30,
                        high: 0x31
                    }
                ], function (registers) {
                    it("should report " + scenario.expectedExtendedMemoryKBBelow64MB + "KB of extended memory below 64MB in registers " + util.hexify(registers.low) + "," + util.hexify(registers.high), function (done) {
                        var assembly = util.heredoc(function (/*<<<EOS
;; Write to index port
mov dx, 0x70
mov al, ${low}
out dx, al

;; Read CMOS register <low> to get low byte
mov dx, 0x71
in al, dx
;; Place low byte in BL
mov bl, al

;; Write to index port
mov dx, 0x70
mov al, ${high}
out dx, al

;; Read CMOS register <high> to get high byte
mov dx, 0x71
in al, dx
;; Place high byte in BH
mov bh, al

hlt
EOS
*/) {}, {low: registers.low, high: registers.high});

                        testSystem.execute(assembly).done(function () {
                            expect(system.getCPURegisters().bx.get()).to.equal(scenario.expectedExtendedMemoryKBBelow64MB);
                            done();
                        }).fail(function (exception) {
                            done(exception);
                        });
                    });
                });
            });
        });
    });
});
