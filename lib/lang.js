define(function(){
    var opts = Object.prototype.toString;

    // Crockford (ish) functions

    function isString(/*anything*/ it){
        //	summary:
        //		Return true if it is a String
        return typeof it == "string" || it instanceof String || opts.call(it) == "[object String]"; // Boolean
    }

    function isArray(/*anything*/ it){
        //	summary:
        //		Return true if it is an Array.
        //		Does not work on Arrays created in other windows.
        //TODO: use Array.isArray() if available
        return opts.call(it) == "[object Array]"; // Boolean
    }

    function isFunction(/*anything*/ it){
        // summary:
        //		Return true if it is a Function
        return opts.call(it) === "[object Function]"; // Boolean
    }

    function isObject(/*anything*/ it){
        // summary:
        //		Returns true if it is a JavaScript object (or an Array, a Function
        //		or null)
        return it !== undefined && (it === null || typeof it == "object" || isArray(it) || isFunction(it)); // Boolean
    }

    //TODO: do we really need it?
    function isArrayLike(/*anything*/ it){
        //	summary:
        //		similar to dojo.isArray() but more permissive
        //	description:
        //		Doesn't strongly test for "arrayness".  Instead, settles for "isn't
        //		a string or number and has a length property". Arguments objects
        //		and DOM collections will return true when passed to
        //		dojo.isArrayLike(), but will return false when passed to
        //		dojo.isArray().
        //	returns:
        //		If it walks like a duck and quacks like a duck, return `true`
        return it && // Boolean
            // keep out built-in constructors (Number, String, ...) which have length
            // properties
            !isString(it) && !isFunction(it) &&
            !(it.tagName && it.tagName.toLowerCase() == 'form') &&
            (isArray(it) || isFinite(it.length));
    }

    //TODO: do we really need it?
    function isAlien(/*anything*/ it){
        // summary:
        //		Returns true if it is a built-in function or some other kind of
        //		oddball that *should* report as a function but doesn't
        return it && !isFunction(it) && /\{\s*\[native code\]\s*\}/.test(String(it)); // Boolean
    }

    // Object access

    function _getProp(/*Array*/parts, /*Boolean*/create, /*Object*/context){
        context = context || this;
        for(var i = 0, p; context && (p = parts[i]); ++i){
            context = (p in context ? context[p] : (create ? context[p] = {} : undefined));
        }
        return context; // mixed
    }

    function setObject(/*String*/name, /*Object*/value, /*Object?*/context){
        // summary:
        //		Set a property from a dot-separated string, such as "A.B.C"
        //	description:
        //		Useful for longer api chains where you have to test each object in
        //		the chain, or when you have an object reference in string format.
        //		Objects are created as needed along `path`. Returns the passed
        //		value if setting is successful or `undefined` if not.
        //	name:
        //		Path to a property, in the form "A.B.C".
        //	context:
        //		Optional. Object to use as root of path. Defaults to
        //		`dojo.global`.
        //	example:
        //		set the value of `foo.bar.baz`, regardless of whether
        //		intermediate objects already exist:
        //	|	dojo.setObject("foo.bar.baz", value);
        //	example:
        //		without `dojo.setObject`, we often see code like this:
        //	|	// ensure that intermediate objects are available
        //	|	if(!obj["parent"]){ obj.parent = {}; }
        //	|	if(!obj.parent["child"]){ obj.parent.child= {}; }
        //	|	// now we can safely set the property
        //	|	obj.parent.child.prop = "some value";
        //		wheras with `dojo.setObject`, we can shorten that to:
        //	|	dojo.setObject("parent.child.prop", "some value", obj);
        var parts = name.split("."), p = parts.pop(), obj = _getProp(parts, true, context);
        return obj && p ? (obj[p] = value) : undefined; // Object
    }

    function getObject(/*String*/name, /*Boolean?*/create, /*Object?*/context){
        // summary:
        //		Get a property from a dot-separated string, such as "A.B.C"
        //	description:
        //		Useful for longer api chains where you have to test each object in
        //		the chain, or when you have an object reference in string format.
        //	name:
        //		Path to an property, in the form "A.B.C".
        //	create:
        //		Optional. Defaults to `false`. If `true`, Objects will be
        //		created at any point along the 'path' that is undefined.
        //	context:
        //		Optional. Object to use as root of path. Defaults to
        //		'dojo.global'. Null may be passed.
        return _getProp(name.split("."), create, context); // Object
    }

    //TODO: do we really need this one-liner?
    function exists(/*String*/name, /*Object?*/obj){
        //	summary:
        //		determine if an object supports a given method
        //	description:
        //		useful for longer api chains where you have to test each object in
        //		the chain. Useful for object and method detection.
        //	name:
        //		Path to an object, in the form "A.B.C".
        //	obj:
        //		Object to use as root of path. Defaults to
        //		'dojo.global'. Null may be passed.
        //	example:
        //	|	// define an object
        //	|	var foo = {
        //	|		bar: { }
        //	|	};
        //	|
        //	|	// search the global scope
        //	|	dojo.exists("foo.bar"); // true
        //	|	dojo.exists("foo.bar.baz"); // false
        //	|
        //	|	// search from a particular scope
        //	|	dojo.exists("bar", foo); // true
        //	|	dojo.exists("bar.baz", foo); // false
        return getObject(name, false, obj) !== undefined; // Boolean
    }

    // object mixers

    var empty = {};

    function mixin(/*Object*/ target, /*Object*/ source){
        // summary:
        //		Adds all properties and methods of source to target. This addition
        //		is "prototype extension safe", so that instances of objects
        //		will not pass along prototype defaults.
        var name, s;
        for(name in source){
            // the "target" condition avoid copying properties in "source"
            // inherited from Object.prototype.  For example, if target has a custom
            // toString() method, don't overwrite it with the toString() method
            // that source inherited from Object.prototype
            s = source[name];
            if(!(name in target) || (target[name] !== s && (!(name in empty) || empty[name] !== s))){
                target[name] = s;
            }
        }
        return target; // Object
    }

    function mixins(/*Object*/obj, /*Object...*/props){
        // summary:
        //		Adds all properties and methods of props to obj and returns the
        //		(now modified) obj.
        //	description:
        //		`dojo.mixin` can mix multiple source objects into a
        //		destination object which is then returned. Unlike regular
        //		`for...in` iteration, `dojo.mixin` is also smart about avoiding
        //		extensions which other toolkits may unwisely add to the root
        //		object prototype
        //	obj:
        //		The object to mix properties into. Also the return value.
        //	props:
        //		One or more objects whose values are successively copied into
        //		obj. If more than one of these objects contain the same value,
        //		the one specified last in the function call will "win".
        //	example:
        //		make a shallow copy of an object
        //	|	var copy = dojo.mixin({}, source);
        //	example:
        //		many class constructors often take an object which specifies
        //		values to be configured on the object. In this case, it is
        //		often simplest to call `dojo.mixin` on the `this` object:
        //	|	dojo.declare("acme.Base", null, {
        //	|		constructor: function(properties){
        //	|			// property configuration:
        //	|			dojo.mixin(this, properties);
        //	|
        //	|			console.log(this.quip);
        //	|			//  ...
        //	|		},
        //	|		quip: "I wasn't born yesterday, you know - I've seen movies.",
        //	|		// ...
        //	|	});
        //	|
        //	|	// create an instance of the class and configure it
        //	|	var b = new acme.Base({quip: "That's what it does!" });
        //	example:
        //		copy in properties from multiple objects
        //	|	var flattened = dojo.mixin(
        //	|		{
        //	|			name: "Frylock",
        //	|			braces: true
        //	|		},
        //	|		{
        //	|			name: "Carl Brutanananadilewski"
        //	|		}
        //	|	);
        //	|
        //	|	// will print "Carl Brutanananadilewski"
        //	|	console.log(flattened.name);
        //	|	// will print "true"
        //	|	console.log(flattened.braces);
        if(!obj){ obj = {}; }
        for(var i = 1, l = arguments.length; i < l; ++i){
            mixin(obj, arguments[i]);
        }
        return obj; // Object
    }

    function clone(/*anything*/ o){
        // summary:
        //		Clones objects (including DOM nodes) and all children.
        //		Warning: do not clone cyclic structures.
        if(!o || typeof o != "object" || isFunction(o)){
            // null, undefined, any non-object, or function
            return o;	// anything
        }
        // we don't clone nodes
        //if(o.nodeType && "cloneNode" in o){
        //    // DOM Node
        //    return o.cloneNode(true); // Node
        //}
        if(o instanceof Date){
            // Date
            return new Date(o.getTime());	// Date
        }
        var r, i, l, s, name;
        if(isArray(o)){
            // array
            r = [];
            for(i = 0, l = o.length; i < l; ++i){
                if(i in o){
                    r.push(clone(o[i]));
                }
            }
// we don't clone functions for performance reasons
//		}else if(d.isFunction(o)){
//			// function
//			r = function(){ return o.apply(this, arguments); };
        }else{
            // generic objects
            r = o.constructor ? new o.constructor() : {};
        }
        for(name in o){
            // the "tobj" condition avoid copying properties in "source"
            // inherited from Object.prototype.  For example, if target has a custom
            // toString() method, don't overwrite it with the toString() method
            // that source inherited from Object.prototype
            s = o[name];
            if(!(name in r) || (r[name] !== s && (!(name in empty) || empty[name] !== s))){
                r[name] = clone(s);
            }
        }
        return r; // Object
    }

    function extend(/*Object*/ constructor, /*Object...*/ props){
        // summary:
        //		Adds all properties and methods of props to constructor's
        //		prototype, making them available to all instances created with
        //		constructor.
        var args = Array.prototype.slice.call(arguments, 0);
        args[0] = constructor.prototype;
        mixins.apply(this, args);
        return constructor; // Object
    }

    /*=====
    dojo.delegate = function(obj, props){
        //	summary:
        //		Returns a new object which "looks" to obj for properties which it
        //		does not have a value for. Optionally takes a bag of properties to
        //		seed the returned object with initially.
        //	description:
        //		This is a small implementaton of the Boodman/Crockford delegation
        //		pattern in JavaScript. An intermediate object constructor mediates
        //		the prototype chain for the returned object, using it to delegate
        //		down to obj for property lookup when object-local lookup fails.
        //		This can be thought of similarly to ES4's "wrap", save that it does
        //		not act on types but rather on pure objects.
        //	obj:
        //		The object to delegate to for properties not found directly on the
        //		return object or in props.
        //	props:
        //		an object containing properties to assign to the returned object
        //	returns:
        //		an Object of anonymous type
        //	example:
        //	|	var foo = { bar: "baz" };
        //	|	var thinger = dojo.delegate(foo, { thud: "xyzzy"});
        //	|	thinger.bar == "baz"; // delegated to foo
        //	|	foo.thud == undefined; // by definition
        //	|	thinger.thud == "xyzzy"; // mixed in from props
        //	|	foo.bar = "thonk";
        //	|	thinger.bar == "thonk"; // still delegated to foo's bar
    }
    =====*/

    var delegate = (function(){
        // boodman/crockford delegation w/ cornford optimization
        function TMP(){}
        return function delegate(obj, props){
            TMP.prototype = obj;
            var tmp = new TMP();
            TMP.prototype = null;
            if(props){
                mixin(tmp, props);
            }
            return tmp; // Object
        }
    })();

    // functional helpers

    function _hitchArgs(scope, method /*,...*/){
        var pre = Array.prototype.slice.call(arguments, 2),
            named = isString(method);
        return function(){
            // arrayify arguments
            var args = Array.prototype.slice.call(arguments, 0),
                context = scope || this,
                // locate our method
                f = named ? context[method] : method;
            // invoke with collected args
            return f && f.apply(context, pre.concat(args)); // mixed
        }; // Function
    }

    function hitch(/*Object*/scope, /*Function|String*/method /*,...*/){
        //	summary:
        //		Returns a function that will only ever execute in the a given scope.
        //		This allows for easy use of object member functions
        //		in callbacks and other places in which the "this" keyword may
        //		otherwise not reference the expected scope.
        //		Any number of default positional arguments may be passed as parameters
        //		beyond "method".
        //		Each of these values will be used to "placehold" (similar to curry)
        //		for the hitched function.
        //	scope:
        //		The scope to use when method executes. If method is a string,
        //		scope is also the object containing method.
        //	method:
        //		A function to be hitched to scope, or the name of the method in
        //		scope to be hitched.
        //	example:
        //	|	dojo.hitch(foo, "bar")();
        //		runs foo.bar() in the scope of foo
        //	example:
        //	|	dojo.hitch(foo, myFunction);
        //		returns a function that runs myFunction in the scope of foo
        //	example:
        //		Expansion on the default positional arguments passed along from
        //		hitch. Passed args are mixed first, additional args after.
        //	|	var foo = { bar: function(a, b, c){ console.log(a, b, c); } };
        //	|	var fn = dojo.hitch(foo, "bar", 1, 2);
        //	|	fn(3); // logs "1, 2, 3"
        //	example:
        //	|	var foo = { bar: 2 };
        //	|	dojo.hitch(foo, function(){ this.bar = 10; })();
        //		execute an anonymous function in scope of foo

        if(arguments.length > 2){
            return _hitchArgs.apply(this, arguments); // Function
        }
        if(!method){
            method = scope;
            scope = null;
        }
        if(isString(method)){
            scope = scope || this;
            if(!scope[method]){ throw(['dojo.hitch: scope["', method, '"] is null (scope="', scope, '")'].join('')); }
            return function(){ return scope[method].apply(scope, arguments); }; // Function
        }
        return !scope ? method : function(){ return method.apply(scope, arguments); }; // Function
    }

    function partial(/*Function|String*/method /*, ...*/){
        //	summary:
        //		similar to hitch() except that the scope object is left to be
        //		whatever the execution context eventually becomes.
        //	description:
        //		Calling dojo.partial is the functional equivalent of calling:
        //		|	dojo.hitch(null, funcName, ...);
        return hitch.apply(this, [null].concat(Array.prototype.slice.call(arguments, 0))); // Function
    }

    // string helpers

    /*=====
    dojo.trim = function(str){
        //	summary:
        //		Trims whitespace from both sides of the string
        //	str: String
        //		String to be trimmed
        //	returns: String
        //		Returns the trimmed string
        //	description:
        //		This version of trim() was selected for inclusion into the base due
        //		to its compact size and relatively good performance
        //		(see [Steven Levithan's blog](http://blog.stevenlevithan.com/archives/faster-trim-javascript)
        //		Uses String.prototype.trim instead, if available.
        //		The fastest but longest version of this function is located at
        //		dojo.string.trim()
        return "";	// String
    }
    =====*/

    var trim = String.prototype.trim ?
        function(str){ return str.trim(); } :
        function(str){ return str.replace(/^\s\s*/, '').replace(/\s\s*$/, ''); };

    /*=====
    dojo.replace = function(tmpl, map, pattern){
        //	summary:
        //		Performs parameterized substitutions on a string. Throws an
        //		exception if any parameter is unmatched.
        //	tmpl: String
        //		String to be used as a template.
        //	map: Object|Function
        //		If an object, it is used as a dictionary to look up substitutions.
        //		If a function, it is called for every substitution with following
        //		parameters: a whole match, a name, an offset, and the whole template
        //		string (see https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Global_Objects/String/replace
        //		for more details).
        //	pattern: RegEx?
        //		Optional regular expression objects that overrides the default pattern.
        //		Must be global and match one item. The default is: /\{([^\}]+)\}/g,
        //		which matches patterns like that: "{xxx}", where "xxx" is any sequence
        //		of characters, which doesn't include "}".
        //	returns: String
        //		Returns the substituted string.
        //	example:
        //	|	// uses a dictionary for substitutions:
        //	|	dojo.replace("Hello, {name.first} {name.last} AKA {nick}!",
        //	|	  {
        //	|	    nick: "Bob",
        //	|	    name: {
        //	|	      first:  "Robert",
        //	|	      middle: "X",
        //	|	      last:   "Cringely"
        //	|	    }
        //	|	  });
        //	|	// returns: Hello, Robert Cringely AKA Bob!
        //	example:
        //	|	// uses an array for substitutions:
        //	|	dojo.replace("Hello, {0} {2}!",
        //	|	  ["Robert", "X", "Cringely"]);
        //	|	// returns: Hello, Robert Cringely!
        //	example:
        //	|	// uses a function for substitutions:
        //	|	function sum(a){
        //	|	  var t = 0;
        //	|	  dojo.forEach(a, function(x){ t += x; });
        //	|	  return t;
        //	|	}
        //	|	dojo.replace(
        //	|	  "{count} payments averaging {avg} USD per payment.",
        //	|	  dojo.hitch(
        //	|	    { payments: [11, 16, 12] },
        //	|	    function(_, key){
        //	|	      switch(key){
        //	|	        case "count": return this.payments.length;
        //	|	        case "min":   return Math.min.apply(Math, this.payments);
        //	|	        case "max":   return Math.max.apply(Math, this.payments);
        //	|	        case "sum":   return sum(this.payments);
        //	|	        case "avg":   return sum(this.payments) / this.payments.length;
        //	|	      }
        //	|	    }
        //	|	  )
        //	|	);
        //	|	// prints: 3 payments averaging 13 USD per payment.
        //	example:
        //	|	// uses an alternative PHP-like pattern for substitutions:
        //	|	dojo.replace("Hello, ${0} ${2}!",
        //	|	  ["Robert", "X", "Cringely"], /\$\{([^\}]+)\}/g);
        //	|	// returns: Hello, Robert Cringely!
        return "";	// String
    }
    =====*/

    var _pattern = /\{([^\}]+)\}/g;
    function replace(tmpl, map, pattern){
        return tmpl.replace(pattern || _pattern, isFunction(map) ?
            map : function(_, k){ return getObject(k, false, map); });
    }

    return {
        // Crockford (ish) functions
        isString:    isString,
        isArray:     isArray,
        isFunction:  isFunction,
        isObject:    isObject,
        isArrayLike: isArrayLike,   //TODO: do we really need it?
        isAlien:     isAlien,       //TODO: do we really need it?
        // object access
        setObject:   setObject,
        getObject:   getObject,
        exists:      exists,        //TODO: do we really need it?
        // object mixers
        mixin:       mixin,
        mixins:      mixins,
        clone:       clone,
        extend:      extend,
        delegate:    delegate,
        // functional helpers
        hitch:       hitch,
        partial:     partial,
        // string helpers
        trim:        trim,
        replace:     replace
    };
});
