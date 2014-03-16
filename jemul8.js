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
        "vendor": "./vendor"
    }
}, [
    "js/Jemul8",
    "js/MemoryAllocator",
    "js/Factory/System"
], function (
    Jemul8,
    MemoryAllocator,
    SystemFactory
) {
    "use strict";

    var memoryAllocator = new MemoryAllocator(),
        systemFactory = new SystemFactory(memoryAllocator);

    return new Jemul8(systemFactory);
});
