/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global define, Uint8Array */
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
                    is32BitCodeSegment: false,
                    assembly: "hlt",
                    expectedName: "HLT",
                    expectedOperands: []
                },
                {
                    is32BitCodeSegment: false,
                    assembly: "nop",
                    expectedName: "NOP",
                    expectedOperands: []
                },
                // Tests that 16-bit register is used
                {
                    is32BitCodeSegment: false,
                    assembly: "mov ax, 1",
                    expectedName: "MOV",
                    expectedOperands: [
                        {
                            baseRegister: "AX",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "DS"
                        },
                        {
                            immediate: 1,
                            immediateSize: 2,
                            scale: 1,
                            segmentRegister: "DS"
                        }
                    ]
                },
                // Tests that operand-size prefix is respected
                {
                    is32BitCodeSegment: false,
                    is32BitOperandSize: true, // Via prefix
                    assembly: "mov eax, 1",
                    expectedName: "MOV",
                    expectedOperands: [
                        {
                            baseRegister: "EAX",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "DS"
                        },
                        {
                            immediate: 1,
                            immediateSize: 4,
                            scale: 1,
                            segmentRegister: "DS"
                        }
                    ]
                },
                // Tests addressing method "A"
                {
                    is32BitCodeSegment: false,
                    is32BitOperandSize: false,
                    assembly: "call 0x3456:0xABCD",
                    expectedName: "CALLF",
                    expectedOperands: [
                        {
                            immediate: 0x3456ABCD,
                            immediateSize: 4,
                            scale: 1,
                            segmentRegister: "DS"
                        }
                    ]
                },
                {
                    is32BitCodeSegment: false,
                    is32BitOperandSize: true,
                    assembly: "call 0x3456:dword 0x4321ABCD",
                    expectedName: "CALLF",
                    expectedOperands: [
                        {
                            immediate: 0x4321ABCD,
                            immediateSize: 4,
                            highImmediate: 0x3456,
                            highImmediateSize: 2,
                            scale: 1,
                            segmentRegister: "DS"
                        }
                    ]
                },
                // Tests addressing method "C"
                {
                    is32BitCodeSegment: false,
                    //is32BitOperandSize: true,
                    assembly: "mov ecx, cr0",
                    expectedName: "MOV",
                    expectedOperands: [
                        {
                            baseRegister: "ECX",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "DS"
                        },
                        {
                            baseRegister: "CR0",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "DS"
                        }
                    ]
                },
                // Tests addressing method "D"
                {
                    is32BitCodeSegment: false,
                    is32BitOperandSize: false,
                    assembly: "mov ebx, dr4",
                    expectedName: "MOV",
                    expectedOperands: [
                        {
                            baseRegister: "EBX",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "DS"
                        },
                        {
                            baseRegister: "DR4",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "DS"
                        }
                    ]
                },
                // Tests addressing method "I"
                {
                    is32BitCodeSegment: false,
                    assembly: "imul ax, byte -1",
                    expectedName: "IMUL",
                    // NB: NASM assembles to the 3-operand form despite using the 2-operand form above
                    expectedOperands: [
                        {
                            baseRegister: "AX",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "DS"
                        },
                        {
                            baseRegister: "AX",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "DS"
                        },
                        {
                            immediate: -1,
                            immediateSize: 2,
                            scale: 1,
                            segmentRegister: "DS"
                        }
                    ]
                },
                {
                    is32BitCodeSegment: false,
                    // Similar to IMUL test above, but this time checking with an immediate in operand1
                    assembly: "out 4, al",
                    expectedName: "OUT",
                    expectedOperands: [
                        {
                            immediate: 4,
                            immediateSize: 1,
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
                // Tests addressing method "O"
                {
                    is32BitCodeSegment: false,
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
                            isPointer: true,
                            scale: 1,
                            segmentRegister: "DS"
                        }
                    ]
                },
                {
                    is32BitCodeSegment: false,
                    assembly: "add [bx+si], al",
                    expectedName: "ADD",
                    expectedOperands: [
                        {
                            baseRegister: "BX",
                            indexRegister: "SI",
                            isPointer: true,
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
                    is32BitCodeSegment: false,
                    // Check support for negative displacements
                    assembly: "mov [bp-1], al",
                    expectedName: "MOV",
                    expectedOperands: [
                        {
                            baseRegister: "BP",
                            indexRegister: null,
                            displacement: -1,
                            displacementSize: 2,
                            isPointer: true,
                            scale: 1,
                            // BP register use implies SS
                            segmentRegister: "SS"
                        },
                        {
                            baseRegister: "AL",
                            indexRegister: null,
                            scale: 1,
                            // BP register use implies SS
                            segmentRegister: "SS"
                        }
                    ]
                },
                {
                    is32BitCodeSegment: false,
                    is32BitOperandSize: false,
                    assembly: "arpl bx, cx",
                    expectedName: "ARPL",
                    expectedOperands: [
                        {
                            baseRegister: "BX",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "DS"
                        },
                        {
                            baseRegister: "CX",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "DS"
                        }
                    ]
                },
                {
                    is32BitCodeSegment: false,
                    is32BitOperandSize: true,
                    // TODO: Find out why these operands are decoded in the opposite order
                    //       (even though it does not matter, it seems like a bug)
                    assembly: "xchg ecx, ebx",
                    expectedName: "XCHG",
                    expectedOperands: [
                        {
                            baseRegister: "EBX",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "DS"
                        },
                        {
                            baseRegister: "ECX",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "DS"
                        }
                    ]
                },
                // Tests addressing method "S"
                {
                    is32BitCodeSegment: false,
                    is32BitOperandSize: false,
                    assembly: "mov dx, es",
                    expectedName: "MOV",
                    expectedOperands: [
                        {
                            baseRegister: "DX",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "DS"
                        },
                        {
                            baseRegister: "ES",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "DS"
                        }
                    ]
                },
                // Segment override when using BP register (so implied SS, but then overridden)
                {
                    is32BitCodeSegment: false,
                    is32BitOperandSize: false,
                    assembly: "mov [es:bp], byte 2",
                    expectedName: "MOV",
                    expectedOperands: [
                        {
                            baseRegister: "BP",
                            indexRegister: null,
                            displacement: 0,
                            displacementSize: 2,
                            isPointer: true,
                            scale: 1,
                            segmentRegister: "ES"
                        },
                        {
                            immediate: 2,
                            immediateSize: 1,
                            scale: 1,
                            segmentRegister: "ES"
                        }
                    ]
                },
                // Negative displacement
                {
                    is32BitCodeSegment: false,
                    is32BitOperandSize: false,
                    assembly: "mov [bp-6], byte 3",
                    expectedName: "MOV",
                    expectedOperands: [
                        {
                            baseRegister: "BP",
                            indexRegister: null,
                            displacement: -6,
                            displacementSize: 2,
                            isPointer: true,
                            scale: 1,
                            segmentRegister: "SS"
                        },
                        {
                            immediate: 3,
                            immediateSize: 1,
                            scale: 1,
                            segmentRegister: "SS"
                        }
                    ]
                },
                {
                    is32BitCodeSegment: false,
                    is32BitOperandSize: false,
                    is32BitAddressSize: true,
                    // Force use of this form of "mov [esp+2], dword 0xe3dbffff"
                    // 0x67 is address-size override
                    assembly: "db 0x67, 0xc7, 0x44, 0x24, 0x02, 0xff, 0xff",
                    expectedName: "MOV",
                    expectedOperands: [
                        {
                            baseRegister: "ESP",
                            indexRegister: null,
                            displacement: 2,
                            displacementSize: 4,
                            isPointer: true,
                            scale: 1,
                            segmentRegister: "SS"
                        },
                        {
                            immediate: 0xffff,
                            immediateSize: 2,
                            scale: 1,
                            segmentRegister: "SS"
                        }
                    ]
                },
                {
                    is32BitCodeSegment: true,
                    is32BitOperandSize: true,
                    is32BitAddressSize: true,
                    // Force use of this form of "mov [esp+2], word 0xffff"
                    // 0x67 is address-size override
                    assembly: "db 0xc7, 0x44, 0x24, 0x02, 0xff, 0xff, 0xdb, 0xe3",
                    expectedName: "MOV",
                    expectedOperands: [
                        {
                            baseRegister: "ESP",
                            indexRegister: null,
                            displacement: 2,
                            displacementSize: 4,
                            isPointer: true,
                            scale: 1,
                            segmentRegister: "SS"
                        },
                        {
                            immediate: 0xe3dbffff,
                            immediateSize: 4,
                            scale: 1,
                            segmentRegister: "SS"
                        }
                    ]
                },
                // Opcode extension group 1 (Immediate)
                {
                    is32BitCodeSegment: false,
                    assembly: "mov byte [bx], 5",
                    expectedName: "MOV",
                    expectedOperands: [
                        {
                            baseRegister: "BX",
                            indexRegister: null,
                            isPointer: true,
                            scale: 1,
                            segmentRegister: "DS"
                        },
                        {
                            immediate: 5,
                            immediateSize: 1,
                            scale: 1,
                            segmentRegister: "DS"
                        }
                    ]
                },
                {
                    is32BitCodeSegment: false,
                    assembly: "lgdt [0x1234]",
                    expectedName: "LGDT",
                    expectedOperands: [
                        {
                            displacement: 0x1234,
                            displacementSize: 2,
                            isPointer: true,
                            scale: 1,
                            segmentRegister: "DS"
                        }
                    ]
                },
                // String copy without overriding source segment (DS as default)
                {
                    is32BitCodeSegment: false,
                    assembly: "movsb",
                    expectedName: "MOVS",
                    expectedOperands: [
                        {
                            baseRegister: "SI",
                            indexRegister: null,
                            isPointer: true,
                            scale: 1,
                            segmentRegister: "DS"
                        },
                        {
                            baseRegister: "DI",
                            indexRegister: null,
                            isPointer: true,
                            scale: 1,
                            segmentRegister: "ES"
                        }
                    ]
                },
                // String copy including override of source segment to FS (DS as default)
                {
                    is32BitCodeSegment: false,
                    assembly: "fs movsb",
                    expectedName: "MOVS",
                    expectedOperands: [
                        {
                            baseRegister: "SI",
                            indexRegister: null,
                            isPointer: true,
                            scale: 1,
                            segmentRegister: "FS"
                        },
                        {
                            baseRegister: "DI",
                            indexRegister: null,
                            isPointer: true,
                            scale: 1,
                            segmentRegister: "ES"
                        }
                    ]
                },
                // Word-size string scan without overriding source segment (DS as default)
                {
                    is32BitCodeSegment: false,
                    assembly: "scasw",
                    expectedName: "SCAS",
                    expectedOperands: [
                        {
                            baseRegister: "AX",
                            indexRegister: null,
                            scale: 1,
                            segmentRegister: "DS"
                        },
                        {
                            baseRegister: "DI",
                            indexRegister: null,
                            isPointer: true,
                            scale: 1,
                            segmentRegister: "ES"
                        }
                    ]
                }
            ], function (scenario) {
                var is32BitCodeSegment = scenario.is32BitCodeSegment,
                    machineCodeBuffer;

                describe("the instruction returned when decoding the machine code for the instruction '" + scenario.assembly + "' in " + (is32BitCodeSegment ? 32 : 16) + "-bit mode", function () {
                    var instruction;

                    beforeEach(function (done) {
                        var preamble = "[BITS " + (scenario.is32BitCodeSegment ? 32 : 16) + "]\n";

                        assembler.assemble(preamble + scenario.assembly).done(function (buffer) {
                            var view = new Uint8Array(buffer);
                            machineCodeBuffer = buffer;
                            instruction = decoder.decode(view, 0, is32BitCodeSegment);
                            done();
                        }).fail(function (exception) {
                            done(exception);
                        });
                    });

                    it("should have the correct name", function () {
                        expect(instruction.opcodeData.name).to.equal(scenario.expectedName);
                    });

                    it("should have the correct length", function () {
                        expect(instruction.length).to.equal(machineCodeBuffer.byteLength);
                    });

                    if (scenario.is32BitAddressSize) {
                        it("should have a 32-bit address size", function () {
                            expect(instruction.addressSizeAttr).to.be.true;
                        });
                    } else {
                        it("should have a 16-bit address size", function () {
                            expect(instruction.addressSizeAttr).to.be.false;
                        });
                    }

                    if (scenario.is32BitOperandSize) {
                        it("should have a 32-bit operand size", function () {
                            expect(instruction.operandSizeAttr).to.be.true;
                        });
                    } else {
                        it("should have a 16-bit operand size", function () {
                            expect(instruction.operandSizeAttr).to.be.false;
                        });
                    }

                    if (scenario.expectedOperands.length === 0) {
                        it("should have no operands", function () {
                            expect(instruction.operand1).to.equal(null);
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

                                if (data.hasOwnProperty("displacement")) {
                                    it("should have '" + data.displacement + "' as the displacement", function () {
                                        /*jshint bitwise: false */
                                        expect(operand.displacement).to.equal(data.displacement & util.generateMask(data.displacementSize));
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

                                if (data.hasOwnProperty("immediate")) {
                                    it("should have '" + data.immediate + "' as the immediate", function () {
                                        /*jshint bitwise: false */
                                        expect(operand.immed).to.equal(data.immediate & util.generateMask(data.immediateSize));
                                    });

                                    it("should have '" + data.immediateSize + "' as the immediate size", function () {
                                        expect(operand.immedSize).to.equal(data.immediateSize);
                                    });
                                } else {
                                    it("should have an immediate of zero", function () {
                                        expect(operand.immed).to.equal(0);
                                    });

                                    it("should have an immediate size of zero", function () {
                                        expect(operand.immedSize).to.equal(0);
                                    });
                                }

                                if (data.hasOwnProperty("highImmediate")) {
                                    it("should have '" + data.highImmediate + "' as the high immediate", function () {
                                        /*jshint bitwise: false */
                                        expect(operand.highImmed).to.equal(data.highImmediate & util.generateMask(data.highImmediateSize));
                                    });

                                    it("should have '" + data.highImmediateSize + "' as the high immediate size", function () {
                                        expect(operand.highImmedSize).to.equal(data.highImmediateSize);
                                    });
                                } else {
                                    it("should have a high immediate of zero", function () {
                                        expect(operand.highImmed).to.equal(0);
                                    });

                                    it("should have a high immediate size of zero", function () {
                                        expect(operand.highImmedSize).to.equal(0);
                                    });
                                }

                                if (data.isPointer) {
                                    it("should be a memory pointer", function () {
                                        expect(operand.isPointer).to.be.true;
                                    });
                                } else {
                                    it("should not be a memory pointer", function () {
                                        expect(operand.isPointer).to.be.false;
                                    });
                                }

                                it("should have '" + data.segmentRegister + "' as the segment register", function () {
                                    expect(operand.getSegReg().name).to.equal(data.segmentRegister);
                                });
                            });
                        });
                    }
                });
            });
        });
    });
});
