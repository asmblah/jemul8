/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global define, XMLHttpRequest */
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

    function ProxyAssembler() {
        this.xhr = new XMLHttpRequest();
    }

    util.extend(ProxyAssembler.prototype, {
        assemble: function (assembly) {
            var promise = new Promise(),
                xhr = this.xhr;

            xhr.open("POST", "/assembler?__r=" + Math.random(), true);
            xhr.responseType = "arraybuffer";
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        promise.resolve(xhr.response);
                    } else if (xhr.status === 500) {
                        promise.reject(new Exception(xhr.getResponseHeader("X-Assembly-Errors")));
                    } else {
                        promise.reject(new Exception("Could not call assembler"));
                    }
                }
            };
            xhr.send(JSON.stringify({
                assembly: assembly
            }));

            return promise;
        }
    });

    return ProxyAssembler;
});
