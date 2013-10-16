/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global Buffer, console, __dirname, require */
(function () {
    "use strict";

    var childProcess = require("child_process"),
        express = require("express"),
        fs = require("fs"),
        http = require("http"),
        app = express(),
        bddPath = __dirname,
        modular = require("modular-amd"),
        rootPath = bddPath + "/../..",
        nodeModulesPath = rootPath + "/node_modules",
        port = 6700,
        server = http.createServer(app),
        tmp = require("tmp"),
        util = modular.util,
        vendorPath = rootPath + "/vendor";

    function mapPaths(map) {
        util.each(map, function (realPath, virtualPath) {
            if (/\/$/.test(realPath)) {
                app.use(virtualPath, express.static(realPath));
            } else if (typeof realPath === "string") {
                app.get(virtualPath, function (request, response) {
                    response.sendfile(realPath);
                });
            } else if (typeof realPath === "object") {
                app[realPath.method.toLowerCase()](virtualPath, function (request, response) {
                    realPath.handler(request, response);
                });
            } else {
                throw new Error("Value is not supported");
            }
        });
    }

    (function () {
        var define = modular.createDefiner();

        define("child_process", childProcess);
        define("fs", fs);
        define("tmp", tmp);
    }());

    server.listen(port);

    // Enable parsing POST variables
    app.use(express.bodyParser());

    mapPaths({
        "/acceptance": bddPath + "/acceptance/",
        "/assembler": {
            method: "POST",
            handler: function (request, response) {
                var require = modular.createRequirer();

                require({
                    baseUrl: __dirname,
                    paths: {
                        "js": "../../js"
                    }
                }, [
                    "tools/Assembler/NASM"
                ], function (
                    NASMAssembler
                ) {
                    var assembler = new NASMAssembler(),
                        assembly = request.body.assembly;

                    assembler.assemble(assembly).done(function (data) {
                        response.status(200);
                        response.end(new Buffer(data));
                    }).fail(function (error) {
                        response.status(500);
                        response.set("X-Assembly-Errors", error.toString());
                        response.end();
                    });
                });
            }
        },
        "/chai": nodeModulesPath + "/chai/",
        "/docs": rootPath + "/docs/",
        "/index.html": bddPath + "/index.html",
        "/integration": bddPath + "/integration/",
        "/js": rootPath + "/js/",
        "/languages": rootPath + "/languages/",
        "/main.js": bddPath + "/main.js",
        "/mocha": nodeModulesPath + "/mocha/",
        "/modular": nodeModulesPath + "/modular-amd/",
        "/runner.js": bddPath + "/runner.js",
        "/sinon": vendorPath + "/sinon/",
        "/sinon-chai": nodeModulesPath + "/sinon-chai/lib/",
        "/tools": bddPath + "/tools/",
        "/unit": bddPath + "/unit/"
    });

    app.get("/", function (request, response) {
        response.redirect("/index.html");
    });

    console.log("Started server, visit http://127.0.0.1:" + port + "/ to run the tests");
}());
