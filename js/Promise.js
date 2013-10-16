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
    "js/util"
], function (
    util
) {
    "use strict";

    var PENDING = 0,
        REJECTED = 1,
        RESOLVED = 2;

    function Promise() {
        this.mode = PENDING;
        this.thens = [];
        this.value = null;
    }

    util.extend(Promise.prototype, {
        done: function (callback) {
            return this.then(callback);
        },

        fail: function (callback) {
            return this.then(null, callback);
        },

        reject: function (exception) {
            var promise = this;

            if (promise.mode === PENDING) {
                promise.mode = REJECTED;
                promise.value = exception;

                util.each(promise.thens, function (callbacks) {
                    if (callbacks.onReject) {
                        callbacks.onReject(exception);
                    }
                });
            }

            return promise;
        },

        resolve: function (result) {
            var promise = this;

            if (promise.mode === PENDING) {
                promise.mode = RESOLVED;
                promise.value = result;

                util.each(promise.thens, function (callbacks) {
                    if (callbacks.onResolve) {
                        callbacks.onResolve(result);
                    }
                });

            }

            return promise;
        },

        then: function (onResolve, onReject) {
            var promise = this;

            if (promise.mode === PENDING) {
                promise.thens.push({
                    onReject: onReject,
                    onResolve: onResolve
                });
            } else if (promise.mode === REJECTED) {
                if (onReject) {
                    onReject(promise.value);
                }
            } else if (promise.mode === RESOLVED) {
                if (onResolve) {
                    onResolve(promise.value);
                }
            }

            return promise;
        }
    });

    return Promise;
});
