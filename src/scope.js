/* jshint globalstrict: true */

'use strict';

function Scope() {
  this.$$watchers = [];
  this.$$lastDirtyWatch = null;
  this.$$asyncQueue = [];
  this.$$phase = null;
  this.$$postDigestQueue = [];
  this.$$children = [];
  this.$$root = this;
}

function initWatchVal() {
}

Scope.prototype.$watch = function(watchFn, listenerFn, valueEq) {
  var self = this;
  var watcher = {
    watchFn: watchFn,
    listenerFn: listenerFn || function() {},
    valueEq: !!valueEq,
    last: initWatchVal
  };
  this.$$watchers.unshift(watcher);
  this.$$root.$$lastDirtyWatch = null;
  return function() {
    var index = self.$$watchers.indexOf(watcher);
    if(index >= 0) {
        self.$$watchers.splice(index, 1);
        self.$$root.$$lastDirtyWatch = null;
    }
  };
};

Scope.prototype.$digest = function() {
    // Time to live
    var ttl = 10;
    var dirty;
    this.$$root.$$lastDirtyWatch = null;
    this.$beginPhase('$digest');
    do {
        while(this.$$asyncQueue.length) {
            try {
                var asyncTask = this.$$asyncQueue.shift();
                asyncTask.scope.$eval(asyncTask.expression);
            } catch (e) {
                console.error(e);
            }
        }

        dirty = this.$$digestOnce();
        if((dirty || this.$$asyncQueue.length) && !(ttl--)) {
            this.$clearPhase();
            throw "10 (max) digest iterations reached";
        }
    } while(dirty || this.$$asyncQueue.length);
    this.$clearPhase();

    while(this.$$postDigestQueue.length) {
        try {
            this.$$postDigestQueue.shift()();
        } catch (e) {
            console.error(e);
        }
    }
};

Scope.prototype.$$digestOnce = function() {
    var dirty;
    var continueLoop = true;
    var self = this;
    this.$$everyScope(function(scope) {
        var newValue, oldValue;
        _.forEachRight(scope.$$watchers, function(watcher) {
            try {
                if(watcher) {
                    newValue = watcher.watchFn(scope);
                    oldValue = watcher.last;

                    if (!scope.$$areEqual(newValue, oldValue, watcher.valueEq)) {
                        self.$$root.$$lastDirtyWatch = watcher;
                        watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
                        watcher.listenerFn(newValue, 
                            (oldValue === initWatchVal ? newValue : oldValue),
                            scope);
                      dirty = true;
                    } else if(self.$$root.$$lastDirtyWatch === watcher) {
                        continueLoop = false;
                        return false;
                    }
                    
                }
            } catch (e) {
                console.error(e);
            }
        }); 
        return continueLoop;
    });
    return dirty;
};

Scope.prototype.$$everyScope = function(fn) {
    if(fn(this)) {
        return this.$$children.every(function(child) {
            return child.$$everyScope(fn);
        });
    } else {
        return false;
    }
};

Scope.prototype.$$areEqual = function(newValue, oldValue, valueEq) {
    if(valueEq) {
        return _.isEqual(newValue, oldValue);
    } else {
        return newValue === oldValue ||
        (typeof newValue === 'number' && typeof oldValue === 'number' && isNaN(newValue) && isNaN(oldValue));
    }
};

Scope.prototype.$eval = function(expr, locals) {
    return expr(this, locals);
};

Scope.prototype.$apply = function(expr) {
    try {
        this.$beginPhase('$apply');
        return this.$eval(expr);
    } finally {
        this.$clearPhase();
        this.$$root.$digest();
    }
};

Scope.prototype.$evalAsync = function(expr) {
    var self = this;
    if(!self.$$phase && !self.$$asyncQueue.length) {
        setTimeout(function(){
            if(self.$$asyncQueue.length) {
                self.$$root.$digest();
            }
        }, 0);
    }


    self.$$asyncQueue.push({ scope:self, expression: expr });
};

Scope.prototype.$beginPhase = function(phase) {
    if(this.$$phase) {
        throw this.$$phase + 'already in process';
    }
    this.$$phase = phase;
};

Scope.prototype.$clearPhase = function() {
    this.$$phase = null;
};

Scope.prototype.$$postDigest = function(fn) {
    this.$$postDigestQueue.push(fn);
};

Scope.prototype.$new = function(isolated) {
    var child;
    if(isolated) {
        child = new Scope();
        child.$$root = this.$$root;
    } else {
        var ChildScope = function(){};
        ChildScope.prototype = this;
        child = new ChildScope();
        
    }
    this.$$children.push(child);
    child.$$asyncQueue = this.$$asyncQueue;
    child.$$postDigestQueue = this.$$postDigestQueue;
    child.$$watchers = [];
    child.$$children = [];
    child.$parent = this;
    return child;
};

Scope.prototype.$destroy = function(){
  if(this === this.$$root) {
    return;
  }
  var siblings = this.$parent.$$children;
  var indexOfThis = siblings.indexOf(this);
  if(indexOfThis >= 0) {
    siblings.splice(indexOfThis, 1);
  }
};

Scope.prototype.$watchCollection = function(watchFn, listenerFn) {
    var self = this;
    var newValue;
    var oldValue;
    var oldLength;
    var changeCounter = 0;
    var key;


    var internalWatchFn = function(scope){
        var newLength, key;
        newValue = watchFn(scope);

        if(_.isObject(newValue)) {
            if(_.isArrayLike(newValue)) {
                if(!_.isArray(oldValue)) {
                    changeCounter++;
                    oldValue = [];
                }
                if(newValue.length !== oldValue.length) {
                    changeCounter++;
                    oldValue.length = newValue.length;
                }
                _.forEach(newValue, function(newItem, i) {
                    var bothNaN = _.isNaN(newItem) && _.isNaN(oldValue[i]);
                    if(!bothNaN && newItem !== oldValue[i]) {
                        changeCounter++;
                        oldValue[i] = newItem;
                    }
                });
            } else {
                if(!_.isObject(oldValue) || _.isArrayLike(oldValue)) {
                    changeCounter++;
                    oldValue = {};
                    oldLength = 0;
                }
                newLength = 0;
                _.forOwn(newValue, function(newVal, key) {
                    newLength++;
                    // if key exists on object
                    if(oldValue.hasOwnProperty(key)) {
                        //check to see if the propert has change
                        var bothNaN = _.isNaN(newVal) && _.isNaN(oldValue[key]);
                        if(!bothNaN && (oldValue[key] !== newVal)) {
                            changeCounter++;
                            oldValue[key] = newVal;
                        }
                    } else {
                    // else, add the property to the object
                        changeCounter++;
                        oldValue[key] = newVal;
                        oldLength++;
                    }
                });
                // check for properties removed from the  object
                if(oldLength > newLength) {
                    changeCounter++;
                    _.forOwn(oldValue, function(oldItem, key) {
                        if(!newValue.hasOwnProperty(key)) {
                            oldLength--;
                            delete oldValue[key];
                        }
                    });
                }
            }
        } else {
            if(!self.$$areEqual(newValue, oldValue, false)) {
                changeCounter++;
            }
            oldValue = newValue;
        }

        return changeCounter;

    };

    var internalListenerFn = function(){
        listenerFn(newValue, oldValue, self);
    };

    return this.$watch(internalWatchFn, internalListenerFn);

};