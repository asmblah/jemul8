/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global Buffer, define, require, Uint8Array */
define([
    "js/util",
    "js/Exception",
    "js/Promise"
], function (
    util,
    Exception,
    Promise
) {
    "use strict";

    function NASMAssembler() {
        this.childProcess = require("child_process");
        this.fs = require("fs");
        this.tmp = require("tmp");
    }

    util.extend(NASMAssembler.prototype, {
        assemble: function (assembly) {
            var assembler = this,
                childProcess = assembler.childProcess,
                fs = assembler.fs,
                promise = new Promise(),
                tmp = assembler.tmp;

            tmp.file(function (error, asmFile, asmFD) {
                if (error) {
                    throw new Exception("Could not create temporary file for assembly");
                }

                tmp.file(function (error, objectFile, objectFD) {
                    if (error) {
                        throw new Exception("Could not create temporary file for object file");
                    }

                    fs.write(asmFD, assembly, 0, "utf-8", function (error) {
                        var errorBuffer = new Buffer(1024 * 1024),
                            errorLength = 0,
                            nasm;

                        if (error) {
                            throw new Exception("Could not write ASM to temporary file");
                        }

                        nasm = childProcess.spawn("nasm", ["-f", "bin", "-o", objectFile, asmFile]);

                        nasm.stderr.on("data", function (data) {
                            data.copy(errorBuffer, errorLength);
                            errorLength += data.length;
                        });

                        nasm.on("close", function (code) {
                            fs.close(asmFD, function () {
                                fs.close(objectFD, function () {
                                    if (code === 0) {
                                        fs.readFile(objectFile, function (error, data) {
                                            fs.unlink(asmFile, function () {
                                                fs.unlink(objectFile, function () {
                                                    promise.resolve(new Uint8Array(data));
                                                });
                                            });
                                        });
                                    } else {
                                        promise.reject(
                                            new Exception(
                                                "Errors occurred during assembly: " +
                                                errorBuffer.slice(0, errorLength).toString()
                                            )
                                        );
                                    }
                                });
                            });
                        });
                    });
                });
            });

            return promise;
        }
    });

    return NASMAssembler;
});
