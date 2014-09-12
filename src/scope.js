/* jshint globalstrict: true */

'use strict';

function Scope() {
  this.$$watchers = [];
  this.$$lastDirtyWatch = null;
}

function initWatchVal() {
}

Scope.prototype.$watch = function(watchFn, listenerFn) {
  var watcher = {
    watchFn: watchFn,
    listenerFn: listenerFn || function() {},
    last: initWatchVal
  };
  this.$$watchers.push(watcher);
  this.$$lastDirtyWatch = null;
};

Scope.prototype.$digest = function() {
    // Time to live
    var ttl = 10;
    var dirty;
    this.$$lastDirtyWatch = null;
    do {
        dirty = this.$$digestOnce();
        if(dirty && !(ttl--)) {
            throw "10 (max) digest iterations reached";
        }
    } while(dirty);
};

Scope.prototype.$$digestOnce = function() {
    var self = this;
    var newValue, oldValue, dirty;

    _.forEach(this.$$watchers, function(watcher) {
        newValue = watcher.watchFn(self);
        oldValue = watcher.last;
        if (newValue !== oldValue) {
            self.$$lastDirtyWatch = watcher;
            watcher.last = newValue;
            watcher.listenerFn(newValue, 
                (oldValue === initWatchVal ? newValue : oldValue),
                self);
          dirty = true;
        } else if(self.$$lastDirtyWatch === watcher) {
            return false;
        }
    }); 
    return dirty;
};