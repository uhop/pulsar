define(["lang"], function(lang){

	function Color(/*Array|String|Object?*/ color){
		// summary:
		//	 	Takes a named string, hex string, array of rgb or rgba values,
		//	 	an object with r, g, b, and a properties, or another `dojo.Color` object
		//	 	and creates a new Color instance to work from.
		//
		// example:
		//		Work with a Color instance:
		//	 | var c = new dojo.Color();
		//	 | c.setColor([0,0,0]); // black
		//	 | var hex = c.toHex(); // #000000
		//
		// example:
		//		Work with a node's color:
		//	 | var color = dojo.style("someNode", "backgroundColor");
		//	 | var n = new dojo.Color(color);
		//	 | // adjust the color some
		//	 | n.r *= .5;
		//	 | console.log(n.toString()); // rgb(128, 255, 255);
		if(color){ this.setColor(color); }
	}

	//TODO: there's got to be a more space-efficient way to encode or discover these!! Use hex?
	Color.named = {
		black:       [0,0,0],
		silver:      [192,192,192],
		gray:        [128,128,128],
		white:       [255,255,255],
		maroon:		 [128,0,0],
		red:         [255,0,0],
		purple:		 [128,0,128],
		fuchsia:	 [255,0,255],
		green:	     [0,128,0],
		lime:	     [0,255,0],
		olive:		 [128,128,0],
		yellow:		 [255,255,0],
		navy:        [0,0,128],
		blue:        [0,0,255],
		teal:		 [0,128,128],
		aqua:		 [0,255,255],
		transparent: [255,255,255]
	};

	Color.prototype = {
		r: 255, g: 255, b: 255, a: 1,
		_set: function(r, g, b, a){
			this.r = r; this.g = g; this.b = b; this.a = a;
		},
		setColor: function(/*Array|String|Object*/ color){
			// summary:
			//		Takes a named string, hex string, array of rgb or rgba values,
			//		an object with r, g, b, and a properties, or another `dojo.Color` object
			//		and sets this color instance to that value.
			//
			// example:
			//	|	var c = new dojo.Color(); // no color
			//	|	c.setColor("#ededed"); // greyish
			if(lang.isString(color)){
				colorFromString(color, this);
			}else if(lang.isArray(color)){
				colorFromArray(color, this);
			}else{
				this._set(color.r, color.g, color.b, color.a);
				if(!(color instanceof Color)){ this.sanitize(); }
			}
			return this;	// dojo.Color
		},
		sanitize: function(){
			// summary:
			//		Ensures the object has correct attributes
			// description:
			//		the default implementation does nothing, include dojo.colors to
			//		augment it with real checks
			return this;	// dojo.Color
		},
		toRgb: function(){
			// summary:
			//		Returns 3 component array of rgb values
			// example:
			//	|	var c = new dojo.Color("#000000");
			//	| 	console.log(c.toRgb()); // [0,0,0]
			return [this.r, this.g, this.b];	// Array
		},
		toRgba: function(){
			// summary:
			//		Returns a 4 component array of rgba values from the color
			//		represented by this object.
			return [this.r, this.g, this.b, this.a];	// Array
		},
		toHex: function(){
			// summary:
			//		Returns a CSS color string in hexadecimal representation
			// example:
			//	| 	console.log(new dojo.Color([0,0,0]).toHex()); // #000000
			var arr = ["r", "g", "b"].map(function(x){
                    var s = this[x].toString(16);
                    return s.length < 2 ? "0" + s : s;
                }, this);
			return "#" + arr.join("");	// String
		},
		toCss: function(/*Boolean?*/ includeAlpha){
			// summary:
			//		Returns a css color string in rgb(a) representation
			// example:
			//	|	var c = new dojo.Color("#FFF").toCss();
			//	|	console.log(c); // rgb('255','255','255')
			var rgb = this.r + ", " + this.g + ", " + this.b;
			return (includeAlpha ? "rgba(" + rgb + ", " + this.a : "rgb(" + rgb) + ")";	// String
		},
		toString: function(){
			// summary:
			//		Returns a visual representation of the color
			return this.toCss(true); // String
		}
	};

	function blendColors(/*dojo.Color*/ start, /*dojo.Color*/ end, /*Number*/ weight, /*dojo.Color?*/ obj){
		// summary:
		//		Blend colors end and start with weight from 0 to 1, 0.5 being a 50/50 blend,
		//		can reuse a previously allocated dojo.Color object for the result
		var t = obj || new Color();
		["r", "g", "b", "a"].forEach(function(x){
			t[x] = start[x] + (end[x] - start[x]) * weight;
			if(x != "a"){ t[x] = Math.round(t[x]); }
		});
		return t.sanitize();	// dojo.Color
	}

	function colorFromRgb(/*String*/ color, /*dojo.Color?*/ obj){
		// summary:
		//		Returns a `dojo.Color` instance from a string of the form
		//		"rgb(...)" or "rgba(...)". Optionally accepts a `dojo.Color`
		//		object to update with the parsed value and return instead of
		//		creating a new object.
		// returns:
		//		A dojo.Color object. If obj is passed, it will be the return value.
		var m = color.toLowerCase().match(/^rgba?\(([\s\.,0-9]+)\)/);
		return m && colorFromArray(m[1].split(/\s*,\s*/), obj);	// dojo.Color
	}

	function colorFromHex(/*String*/ color, /*dojo.Color?*/ obj){
		// summary:
		//		Converts a hex string with a '#' prefix to a color object.
		//		Supports 12-bit #rgb shorthand. Optionally accepts a
		//		`dojo.Color` object to update with the parsed value.
		//
		// returns:
		//		A dojo.Color object. If obj is passed, it will be the return value.
		//
		// example:
		//	 | var thing = dojo.colorFromHex("#ededed"); // grey, longhand
		//
		// example:
		//	| var thing = dojo.colorFromHex("#000"); // black, shorthand
		var t = obj || new Color(), bits = (color.length == 4) ? 4 : 8, mask = (1 << bits) - 1;
		color = Number("0x" + color.substr(1));
		if(isNaN(color)){
			return null; // dojo.Color
		}
		["b", "g", "r"].forEach(function(x){
			var c = color & mask;
			color >>= bits;
			t[x] = bits == 4 ? 17 * c : c;
		});
		t.a = 1;
		return t;	// dojo.Color
	}

	function colorFromArray(/*Array*/ a, /*dojo.Color?*/ obj){
		// summary:
		//		Builds a `dojo.Color` from a 3 or 4 element array, mapping each
		//		element in sequence to the rgb(a) values of the color.
		// example:
		//		| var myColor = dojo.colorFromArray([237,237,237,0.5]); // grey, 50% alpha
		// returns:
		//		A dojo.Color object. If obj is passed, it will be the return value.
		var t = obj || new Color();
		t._set(Number(a[0]), Number(a[1]), Number(a[2]), Number(a[3]));
		if(isNaN(t.a)){ t.a = 1; }
		return t.sanitize();	// dojo.Color
	}

	function colorFromString(/*String*/ str, /*dojo.Color?*/ obj){
		// summary:
		//		Parses `str` for a color value. Accepts hex, rgb, and rgba
		//		style color values.
		// description:
		//		Acceptable input values for str may include arrays of any form
		//		accepted by dojo.colorFromArray, hex strings such as "#aaaaaa", or
		//		rgb or rgba strings such as "rgb(133, 200, 16)" or "rgba(10, 10,
		//		10, 50)"
		// returns:
		//		A dojo.Color object. If obj is passed, it will be the return value.
		var a = Color.named[str];
		return a && colorFromArray(a, obj) || colorFromRgb(str, obj) || colorFromHex(str, obj);
	}

    return {
        Color:           Color,
        blendColors:     blendColors,
        colorFromRgb:    colorFromRgb,
        colorFromHex:    colorFromHex,
        colorFromArray:  colorFromArray,
        colorFromString: colorFromString
    };
});
