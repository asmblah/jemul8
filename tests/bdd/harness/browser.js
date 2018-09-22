/**
 * Jemul8 - x86 emulator
 *
 * Copyright 2017 Dan Phillimore (asmblah).
 *
 * License - MIT
 */

require("mocha");
require("./common");

mocha.ui("bdd");
mocha.timeout(10000);

setTimeout(() => {
    mocha.run();
});
