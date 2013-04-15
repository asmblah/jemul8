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

/*global require */
require({
    paths: {
        "root": "../..",
        "vendor": "../../vendor"
    }
}, [
    "require",
    "vendor/chai/chai",
    "vendor/sinon-chai/lib/sinon-chai"
], function (
    require,
    chai,
    sinonChai
) {
    "use strict";

    mocha.setup({
        "ui": "bdd",
        "reporter": mocha.reporters.HTML,
        "globals": ["_gaq", "jQuery*", "setTimeout", "setInterval", "clearTimeout", "clearInterval"]
    });

    chai.use(sinonChai);

    require({
        cache: false
    }, [
        "./acceptance/CommonJS/ExportsTest",
        "./acceptance/CommonJS/ModuleTest",
        "./acceptance/CommonJS/RequireTest",
        "./acceptance/BrowserTest",
        "./acceptance/DefineRequireTest",
        "./acceptance/SampleProgramTest",
        "./integration/NamedModuleTest",
        "./unit/ModularTest",
        "./unit/UtilTest"
    ], function () {
        mocha.run();
    });
});
