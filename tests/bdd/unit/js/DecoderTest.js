/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global DataView, define, Uint8Array */
define([
    "js/util",
    "tools/Factory/Assembler",
    "js/Decoder"
], function (
    util,
    AssemblerFactory,
    Decoder
) {
    "use strict";

    describe("Decoder", function () {
        var assembler,
            decoder;

        beforeEach(function () {
            assembler = new AssemblerFactory().create();

            decoder = new Decoder();
            decoder.init();
        });

        describe("decode()", function () {
            util.each([
                {
                    is32Bit: false,
                    assembly: "hlt",
                    expectedName: "HLT",
                    expectedOperands: []
                },
                {
                    is32Bit: false,
                    assembly: "nop",
                    expectedName: "NOP",
                    expectedOperands: []
                },
                // Tests addressing method "O"
                {
                    is32Bit: false,
                    assembly: "mov al, [2]",
                    expectedName: "MOV",
                    expectedOperands: [
                        {
                            baseRegister: "AL",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "DS"
                        },
                        {
                            displacement: 2,
                            displacementSize: 2,
                            scale: 1,
                            segmentRegister: "DS"
                        }
                    ]
                },
                {
                    is32Bit: false,
                    assembly: "add [bx+si], al",
                    expectedName: "ADD",
                    expectedOperands: [
                        {
                            baseRegister: "BX",
                            indexRegister: "SI",
                            scale: 1,
                            segmentRegister: "DS"
                        },
                        {
                            baseRegister: "AL",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "DS"
                        }
                    ]
                },
                {
                    is32Bit: false,
                    assembly: "xchg ebx, ecx",
                    expectedName: "XCHG",
                    expectedOperands: [
                        {
                            baseRegister: "ECX",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "DS"
                        },
                        {
                            baseRegister: "EBX",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "DS"
                        }
                    ]
                },
                // String copy without overriding source segment (DS as default)
                {
                    is32Bit: false,
                    assembly: "movsb",
                    expectedName: "MOVS",
                    expectedOperands: [
                        {
                            baseRegister: "SI",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "DS"
                        },
                        {
                            baseRegister: "DI",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "ES"
                        }
                    ]
                },
                // String copy including override of source segment to FS (DS as default)
                {
                    is32Bit: false,
                    assembly: "fs movsb",
                    expectedName: "MOVS",
                    expectedOperands: [
                        {
                            baseRegister: "SI",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "FS"
                        },
                        {
                            baseRegister: "DI",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "ES"
                        }
                    ]
                }
            ], function (scenario) {
                var is32Bit = scenario.is32Bit,
                    machineCodeBuffer;

                describe("the instruction returned when decoding the machine code for the instruction '" + scenario.assembly + "' in " + (is32Bit ? 32 : 16) + "-bit mode", function () {
                    var instruction;

                    beforeEach(function (done) {
                        assembler.assemble(scenario.assembly).done(function (buffer) {
                            var view = new DataView(new Uint8Array(buffer).buffer);
                            machineCodeBuffer = buffer;
                            instruction = decoder.decode(view, 0, is32Bit);
                            done();
                        }).fail(function (exception) {
                            done(exception);
                        });
                    });

                    it("should have the correct name", function () {
                        expect(instruction.name).to.equal(scenario.expectedName);
                    });

                    it("should have the correct length", function () {
                        expect(instruction.length).to.equal(machineCodeBuffer.byteLength);
                    });

                    if (scenario.expectedOperands.length === 0) {
                        it("should have no operands", function () {
                            expect(instruction.operand1).to.be.undefined;
                        });
                    } else {
                        util.each(scenario.expectedOperands, function (data, index) {
                            describe("for operand" + (index + 1), function () {
                                var operand;

                                beforeEach(function () {
                                    operand = instruction["operand" + (index + 1)];
                                });

                                it("should have " + data.scale + " as the scale", function () {
                                    expect(operand.scale).to.equal(data.scale);
                                });

                                if (data.indexRegister) {
                                    it("should have '" + data.indexRegister + "' as the index register", function () {
                                        expect(operand.reg2.name).to.equal(data.indexRegister);
                                    });
                                } else {
                                    it("should not have an index register", function () {
                                        expect(operand.reg2).to.be.null;
                                    });
                                }

                                if (data.baseRegister) {
                                    it("should have '" + data.baseRegister + "' as the base register", function () {
                                        expect(operand.reg.name).to.equal(data.baseRegister);
                                    });
                                } else {
                                    it("should not have a base register", function () {
                                        expect(operand.reg).to.be.null;
                                    });
                                }

                                if (data.displacement) {
                                    it("should have '" + data.displacement + "' as the displacement", function () {
                                        expect(operand.displacement).to.equal(data.displacement);
                                    });

                                    it("should have '" + data.displacementSize + "' as the displacement size", function () {
                                        expect(operand.displacementSize).to.equal(data.displacementSize);
                                    });
                                } else {
                                    it("should have a displacement of zero", function () {
                                        expect(operand.displacement).to.equal(0);
                                    });

                                    it("should have a displacement size of zero", function () {
                                        expect(operand.displacementSize).to.equal(0);
                                    });
                                }

                                it("should have '" + data.segmentRegister + "' as the segment register", function () {
                                    expect(operand.segreg.name).to.equal(data.segmentRegister);
                                });
                            });
                        });
                    }
                });
            });
        });
    });
});
