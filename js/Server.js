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
    "js/Networking/NATGateway",
    "js/Service"
], function (
    util,
    NATGateway,
    Service
) {
    "use strict";

    function Server() {

    }

    util.extend(Server.prototype, {
        createService: function (http, express, ws, port, basePath) {
            var natGateway = new NATGateway(),
                app = express(),
                server = http.createServer(app),
                webSocketServer = new ws.Server({
                    server: server
                });

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

            server.listen(port);

            // Enable parsing POST variables
            app.use(express.bodyParser());

            mapPaths({
                "/boot": basePath + "/boot/",
                "/docs/bochs-20100605/bios/BIOS-bochs-legacy": basePath + "/docs/bochs-20100605/bios/BIOS-bochs-legacy",
                "/docs/bochs-20100605/bios/VGABIOS-lgpl-latest": basePath + "/docs/bochs-20100605/bios/VGABIOS-lgpl-latest",
                "/index.html": basePath + "/index.html",
                "/jemul8.js": basePath + "/jemul8.js",
                "/demos": basePath + "/demos/",
                "/js": basePath + "/js/",
                "/modular": basePath + "/node_modules/modular-amd/"
            });

            // Ensure index.html is used as default
            app.get("/", function (request, response) {
                response.redirect("/index.html");
            });

            return new Service(webSocketServer, natGateway);
        }
    });

    return Server;
});
