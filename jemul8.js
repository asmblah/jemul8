/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global define */
define({
    "paths": {
        "js": "./js",
        "vendor": "./vendor",

        // FIXME!! (In Modular)
        "Modular": require.config().paths.Modular
    }
}, [
    "js/Jemul8",
    "js/Factory/System"
], function (
    Jemul8,
    SystemFactory
) {
    "use strict";

    var systemFactory = new SystemFactory();

    return new Jemul8(systemFactory);
});
