/*
 * Modular - JavaScript AMD Framework
 * Copyright 2013 Dan Phillimore (asmblah)
 * http://asmblah.github.com/modular/
 *
 * Implements the AMD specification - see https://github.com/amdjs/amdjs-api/wiki/AMD
 *
 * Released under the MIT license
 * https://github.com/asmblah/modular/raw/master/MIT-LICENSE.txt
 */

/*global define */
define([
    "vendor/chai/chai",
    "vendor/sinon/sinon",
    "root/modular"
], function (
    chai,
    sinon,
    modular
) {
    "use strict";

    var expect = chai.expect;

    describe("Modular", function () {
        var loader;

        beforeEach(function (done) {
            modular.require([
                "Modular"
            ], function (
                Modular
            ) {
                loader = new Modular();
                done();
            });
        });

        describe("transport/defineAnonymous", function () {
            it("should support a simple script-tag-based dynamic loader", function (done) {
                var lastDefine,
                    Magic = {};

                loader.configure({
                    "defineAnonymous": function (args) {
                        lastDefine = args;
                    },
                    "transport": function (callback, module) {
                        var script = { nodeName: "script" },
                            head = {
                                appendChild: function (node) {
                                    loader.define(Magic); // Simulate script execution after download
                                    setTimeout(function () {
                                        script.onload(); // Simulate script.onload() event firing some time later
                                    });
                                }
                            };

                        script.onload = function () {
                            callback(lastDefine);
                        };
                        script.type = "text/javascript";
                        script.src = module.getID().replace(/\.js/, "") + ".js";
                        head.appendChild(script);
                    }
                });

                loader.require([
                    "Magic"
                ], function (
                    ImportedMagic
                ) {
                    expect(ImportedMagic).to.equal(Magic);
                    done();
                });
            });

            it("should support dependencies being loaded asynchronously", function (done) {
                var lastDefine,
                    mystical = {};

                loader.configure({
                    "defineAnonymous": function (args) {
                        lastDefine = args;
                    },
                    "transport": function (callback) {
                        // Just do a simple test by breaking the call stack
                        setTimeout(function () {
                            callback(lastDefine);
                        });
                    }
                });

                loader.define(mystical);

                loader.require([
                    "mystical"
                ], function (
                    importedMystical
                ) {
                    expect(importedMystical).to.equal(mystical);
                    done();
                });
            });

            it("should support importing modules that don't call define(...)", function (done) {
                var lastDefine;

                loader.configure({
                    "defineAnonymous": function (args) {
                        lastDefine = args;
                    },
                    "transport": function (callback) {
                        callback(lastDefine);
                    }
                });

                loader.require([
                    "even/more/mystical"
                ], function (
                    importedMysticism
                ) {
                    expect(importedMysticism).to.equal(undefined);
                    done();
                });
            });

            it("should call factory for all modules dependent on a module whose dependencies load later", function () {
                var callback = sinon.spy(),
                    defineCallback = null,
                    lastDefine;

                loader.configure({
                    "defineAnonymous": function (args) {
                        lastDefine = args;
                    },
                    "transport": function (callback) {
                        defineCallback = callback;
                    }
                });

                loader.define("mopeds/leathers", ["slow/loader"], {});

                loader.require(["mopeds/leathers"], callback);
                loader.require(["mopeds/leathers"], callback);

                loader.define({});
                defineCallback(lastDefine);

                expect(callback).to.have.been.calledTwice;
            });

            it("should only call factory once when a module is requested by multiple other modules after being defined but before its dependencies have loaded", function () {
                var factory = sinon.spy(),
                    defineCallback = null,
                    lastDefine;

                loader.configure({
                    "defineAnonymous": function (args) {
                        lastDefine = args;
                    },
                    "transport": function (callback) {
                        defineCallback = callback;
                    }
                });

                loader.define("mods/rockers", ["slow/loading/module"], factory);

                loader.require(["mods/rockers"], function () {});
                loader.require(["mods/rockers"], function () {});

                loader.define({});
                defineCallback(lastDefine);

                expect(factory).to.have.been.calledOnce;
            });
        });

        describe("parseArgs()", function () {
            it("should use the object as factory if just passed an object", function () {
                var factory = { bass: "in your face" };

                expect(loader.parseArgs(factory).factory).to.equal(factory);
            });

            it("should use the array as factory if just passed an array", function () {
                var factory = ["some data", "that is definitely", /not a dependency list/];

                expect(loader.parseArgs(factory).factory).to.deep.equal(factory);
            });

            it("should use the string as id if just passed a string", function () {
                var id = "awesome!";

                expect(loader.parseArgs(id).id).to.equal(id);
            });

            it("should use the function as factory if just passed a function", function () {
                var factory = function () {};

                expect(loader.parseArgs(factory).factory).to.equal(factory);
            });

            it("should support [config={}], [factory=function]", function () {
                var config = { music: "ha" },
                    factory = function () {};

                expect(loader.parseArgs(config, factory).config).to.have.property("music");
                expect(loader.parseArgs(config, factory).factory).to.equal(factory);
            });

            it("should support [config={}], [factory={}]", function () {
                var config = { bars: "behind" },
                    factory = { "what am i not?": "a function" };

                expect(loader.parseArgs(config, factory).config).to.have.property("bars");
                expect(loader.parseArgs(config, factory).factory).to.equal(factory);
            });

            it("should support [id], [factory={}]", function () {
                var id = "identifier",
                    factory = { "what am i not?": "a function" };

                expect(loader.parseArgs(id, factory).id).to.equal(id);
                expect(loader.parseArgs(id, factory).factory).to.equal(factory);
            });
        });

        describe("resolveDependencyID()", function () {
            it("should resolve relative dependency IDs with parent term at start", function () {
                var dependencyID = "../out/there",
                    dependentID = "module/in/here",
                    expectedResultID = "module/out/there";

                expect(loader.resolveDependencyID(dependencyID, dependentID)).to.equal(expectedResultID);
            });

            it("should resolve relative dependency IDs with parent term in middle", function () {
                var dependencyID = "module/in/there/../here/somewhere",
                    dependentID = "",
                    expectedResultID = "module/in/here/somewhere";

                expect(loader.resolveDependencyID(dependencyID, dependentID)).to.equal(expectedResultID);
            });

            it("should leave parent terms in place if alongside dependent ID", function () {
                var dependencyID = "../../sibling-of-only",
                    dependentID = "only/two/deep",
                    expectedResultID = "sibling-of-only";

                expect(loader.resolveDependencyID(dependencyID, dependentID)).to.equal(expectedResultID);
            });

            it("should leave parent terms in place if outside dependent ID", function () {
                var dependencyID = "../../../parent-of-only",
                    dependentID = "only/two/deep",
                    expectedResultID = "../parent-of-only";

                expect(loader.resolveDependencyID(dependencyID, dependentID)).to.equal(expectedResultID);
            });

            it("should leave parent terms in place if above dependent ID", function () {
                var dependencyID = "../../../there",
                    dependentID = "in/here",
                    expectedResultID = "../../there";

                expect(loader.resolveDependencyID(dependencyID, dependentID)).to.equal(expectedResultID);
            });

            it("should resolve relative dependency IDs with same-directory term at start", function () {
                var dependencyID = "./there/somewhere",
                    dependentID = "module/in/here",
                    expectedResultID = "module/in/there/somewhere";

                expect(loader.resolveDependencyID(dependencyID, dependentID)).to.equal(expectedResultID);
            });

            it("should resolve relative dependency IDs with same-directory term in middle", function () {
                var dependencyID = "module/in/./here/somewhere",
                    dependentID = "",
                    expectedResultID = "module/in/here/somewhere";

                expect(loader.resolveDependencyID(dependencyID, dependentID)).to.equal(expectedResultID);
            });

            it("should resolve relative dependency IDs with multiple consecutive same-directory terms in middle", function () {
                var dependencyID = "module/in/././././here/somewhere",
                    dependentID = "",
                    expectedResultID = "module/in/here/somewhere";

                expect(loader.resolveDependencyID(dependencyID, dependentID)).to.equal(expectedResultID);
            });

            it("should resolve relative dependency IDs with same-directory '//' term in middle", function () {
                var dependencyID = "module/in//here/somewhere",
                    dependentID = "",
                    expectedResultID = "module/in/here/somewhere";

                expect(loader.resolveDependencyID(dependencyID, dependentID)).to.equal(expectedResultID);
            });

            it("should resolve relative dependency IDs with multiple consecutive same-directory '//' terms in middle", function () {
                var dependencyID = "module/in////here/somewhere",
                    dependentID = "",
                    expectedResultID = "module/in/here/somewhere";

                expect(loader.resolveDependencyID(dependencyID, dependentID)).to.equal(expectedResultID);
            });

            describe("ID mapping", function () {
                it("should support mapping of base term", function () {
                    var dependencyID = "world/at/large",
                        dependentID = "",
                        mappings = {
                            "world": "earth"
                        },
                        expectedResultID = "earth/at/large";

                    expect(loader.resolveDependencyID(dependencyID, dependentID, mappings)).to.equal(expectedResultID);
                });

                it("should support mapping of two terms", function () {
                    var dependencyID = "world/at/large",
                        dependentID = "",
                        mappings = {
                            "world/at": "earth/when"
                        },
                        expectedResultID = "earth/when/large";

                    expect(loader.resolveDependencyID(dependencyID, dependentID, mappings)).to.equal(expectedResultID);
                });

                it("should use most specific mapping available", function () {
                    var dependencyID = "world/at/large",
                        dependentID = "",
                        mappings = {
                            "world": "earth",
                            "world/at": "planet/when"
                        },
                        expectedResultID = "planet/when/large";

                    expect(loader.resolveDependencyID(dependencyID, dependentID, mappings)).to.equal(expectedResultID);
                });

                it("should use mapping even if it includes a trailing slash", function () {
                    var dependencyID = "world/at/large",
                        dependentID = "",
                        mappings = {
                            "world/": "earth"
                        },
                        expectedResultID = "earth/at/large";

                    expect(loader.resolveDependencyID(dependencyID, dependentID, mappings)).to.equal(expectedResultID);
                });

                it("should not use mapping after resolving relative to dependent ID", function () {
                    var dependencyID = "./module/here",
                        dependentID = "tasty/world",
                        mappings = {
                            "tasty": "not/here"
                        },
                        expectedResultID = "tasty/module/here";

                    expect(loader.resolveDependencyID(dependencyID, dependentID, mappings)).to.equal(expectedResultID);
                });
            });

            describe("ID exclusions", function () {
                it("should not exclude any IDs from processing by default", function () {
                    expect(loader.resolveDependencyID("./test")).to.equal("test");
                });

                it("should exclude a specified ID", function () {
                    expect(loader.resolveDependencyID("root/../../", null, null, /\.\.\/$/)).to.equal("root/../../");
                });
            });
        });
    });
});
