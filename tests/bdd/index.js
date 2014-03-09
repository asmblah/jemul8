/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global __dirname, global, process, require */
(function () {
    "use strict";

    var modular = require("modular-amd"),
        optionsManager = require("node-getopt").create([
            ["g", "grep=<pattern>", "Optional filter grep to restrict tests to run"]
        ]),
        parsedOptions = optionsManager.parseSystem();

    // FIXME: Modular.js is reading the wrong value as "global" ("this" object is not global in Node.js)
    modular.util.global = global;

    modular.define("chai/chai", function () {
        return require("chai");
    });
    modular.define("child_process", function () {
        return require("child_process");
    });
    modular.define("fs", function () {
        return require("fs");
    });
    modular.define("Mocha", function () {
        return require("mocha");
    });
    modular.define("sinon/sinon", function () {
        return require("sinon");
    });
    modular.define("sinon-chai/sinon-chai", function () {
        return require("sinon-chai");
    });
    modular.define("tmp", function () {
        return require("tmp");
    });

    // FIXME!! (In Modular)
    modular.configure({
        paths: {
            "Modular": "/../../node_modules/modular-amd"
        }
    });

    modular.require({
        baseUrl: __dirname
    }, [
        "./runner"
    ], function (
        runner
    ) {
        runner({
            grep: parsedOptions.options.grep,
            reporter: "spec"
        }, function (result) {
            process.exit(result);
        });
    });
}());
