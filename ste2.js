/*
 * Commands:
 * 		{bar}				- substitution.
 * 		{bar|foo}			- applying filter "foo" to "bar" before substituting.
 * 		{bar|foo:arg1:arg2}	- applying filter "foo" with two arguments.
 * 		{?bar}				- "if" block.
 * 		{*bar}				- "loop" block.
 * 		{-}					- "else" block.
 * 		{.}					- end of a block.
 */

(function(){
	var d = dojo, controls = {"?": "if", "*": "loop", "-": "else", ".": "end"};
	
	ste = window.ste || {};

	ste.compileTemplate = function(tmpl, pattern, filters){
		var tokens = [], previousOffset = 0, stack = [],
			token, parent, index, backIndex, object, expr, parts, i, l;
		d.replace(tmpl, function(match, key, offset, tmpl){
			var type = controls[key.charAt(0)] || "var";
			if(offset > previousOffset){
				tokens.push({
					type: "copy",
					text: tmpl.substring(previousOffset, offset)
				});
			}
			previousOffset = offset + match.length;
			token = {
				type: type,
				text: type == "var" ? key : key.substring(1)
			};
			index = tokens.length;
			tokens.push(token);
			switch(type){
				case "if":
				case "loop":
					stack.push(index);
					// intentional fall through
				case "var":
					compileValue(token);
					break;
				case "else":
					if(!stack.length){
						throw new Error('STE: "else" should be inside of "if" or "loop".');
					}
					token.parent = backIndex = stack.pop();
					parent = tokens[backIndex];
					parent.els = index;
					stack.push(index);
					break;
				case "end":
					if(!stack.length){
						throw new Error('STE: "end" should close "if" or "loop".');
					}
					backIndex = stack.pop();
					parent = tokens[backIndex];
					if(parent.type == "else"){
						token.parent = parent.parent;
						token.els = backIndex;
						tokens[token.parent].end = parent.end = index;
					}else{
						token.parent = backIndex;
						parent.end = index;
					}
					token.end = index;
					break;
			}
			return "";
		}, pattern);
		if(stack.length){
			throw new Error('STE: some "if" or "loop" blocks were not closed properly.');
		}
		if(tmpl.length > previousOffset){
			tokens.push({
				type: "copy",
				text: tmpl.substring(previousOffset)
			});
		}
		object = d.delegate(filters || ste.standardFilters);
		object.tokens  = tokens;
		object.pattern = pattern;
		object.exec    = execTemplate;
		return object;
	}
	
	function compileValue(token){
		var expr = token.text.split("|"), i, l;
		token.parts = expr[0].split(".");
		l = expr.length;
		if(l > 1){
			token.filters = new Array(l - 1);
			for(i = 1; i < l; ++i){
				token.filters[i - 1] = expr[i].split(":");
			}
		}
	}
	
	function execTemplate(dict){
		var result = [], stack = [], loopStack = [], token, value, len, top,
			resolve = resolveValue(this, dict, loopStack);
		for(var t = this.tokens, i = 0, l = t.length; i < l; ++i){
			token = t[i];
			switch(token.type){
				case "copy":
					result.push(token.text);
					break;
				case "var":
					result.push(resolve(token, true) + "");
					break;
				case "if":
					value = resolve(token);
					if(!value){
						if(!token.els){
							// no "else" => skip the whole block
							i = token.end;
							break;
						}
						// skip until the "else" block
						i = token.els;
					}
					// push marker
					stack.push({
						type: "if",
						value: value
					});
					break;
				case "loop":
					value = resolve(token);
					len = value && value.length || 0;
					if(!len){
						if(!token.els){
							// no "else" => skip the whole block
							i = token.end;
							continue;
						}
						// skip until the "else" block
						i = token.els;
					}
					// push marker
					top = {
						type:   "loop",
						array:  value,
						item:   value && value[0],
						index:  0,
						length: len
					};
					stack.push(top);
					loopStack.push(top);
					break;
				case "else":
				case "end":
					top = stack[stack.length - 1];
					if(top.type == "loop"){
						// if loop we have to update it
						++top.index;
						if(top.index < top.length){
							top.item = top.array[top.index];
							i = token.parent;
							break;
						}
						loopStack.pop();
					}
					stack.pop();
					i = token.end;
					break;
			}
		}
		return result.join("");	// String
	}
	
	var noop = ["def"];
	
	function resolveValue(engine, dict, loopStack){
		function resolve(token, useDefault){
			var parts = token.parts, filters = token.filters, top = parts[0],
				value = dict, i = 0, l = parts.length, base, old, filter;
			if(top.charAt(0) == "%"){
				value = loopStack[loopStack.length - 1 - (top == "%" ? 0 : parseInt(top.substr(1)))];
				i = 1;
			}
			// process values
			for(; i < l; ++i){
				if(value || (value !== undefined && value !== null)){
					value = value[parts[i]];
				}
			}
			// process filters
			old = engine._nodef;	// save old value (to be reenterable)
			if(filters){
				engine._nodef = false;	// set the initial value for a default processing 
				for(i = 0, l = filters.length; i < l; ++i){
					parts = filters[i];
					filter = parts[0];
					if(!engine[filter]){
						throw new Error('STE: unknown filter - ' + filter);
					}
					value = engine[filter](value, parts, resolve, loopStack, dict);
				}
			}
			// run the default filter, if available
			if(useDefault && !engine._nodef && engine.def){
				value = engine.def(value, noop, resolve, loopStack, dict);
			}
			engine._nodef = old;	// restore the old value of the flag
			return value;	// Object
		};
		return resolve;	// Function
	}
	
	function resolveOperand(op, resolve){
		var c = op.charAt(0), token;
		if("0" <= c && c <= "9" || c == "-" || c == "+"){
			return parseFloat(op);
		}
		if(c == "'" || c == '"'){
			return d.fromJson(op);
		}
		token = {text: op};
		compileValue(token);
		return resolve(token);	// Object
	}
	
	ste.standardFilters = {
		nodef: function(value){ this._nodef = true; return value; },

		// safe output, can be used as the default filter
		safeHtml: function(value){
			return (value + "").replace(/&(?!\w+([;\s]|$))/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
		},
		safeHtmlAttr: function(value){
			return (value + "").replace(/&(?!\w+([;\s]|$))/g, "&amp;").replace(/\"/g, "&quot;").replace(/\'/g, "&apos;");
		},
		safeUri: function(value){
			return encodeURI(value);
		},
		safeUriComponent: function(value){
			return encodeURIComponent(value);
		},
		safeEscape: function(value){
			return escape(value);
		},

		// value manipulations
		call: function(value, parts, resolve){
			return parts.length > 1 ? value[resolveOperand(parts[1], resolve)]() : value();
		},
		sub: function(value, parts){
			parts = parts[1].split(".");
			for(var i = 0, l = parts.length; i < l; ++i){
				if(value || (value !== undefined && value !== null)){
					value = value[parts[i]];
				}
			}
			return value;
		},
		str: function(value){
			return value + "";
		},
		void: function(){
			return "";
		},

		// loop functions
		first: function(value){
			return !value;
		},
		last: function(value, parts, resolve, loopStack){
			return value + 1 == loopStack[loopStack.length - 1].index;
		},
		even: function(value){
			return !(value % 2);
		},
		odd: function(value){
			return value % 2;
		},

		// logical functions
		/*
		is: function(value, parts, resolve){
			return parts.length > 1 && value === resolveOperand(parts[1], resolve);
		},
		eq: function(value, parts, resolve){
			return parts.length > 1 && value == resolveOperand(parts[1], resolve);
		},
		lt: function(value, parts, resolve){
			return parts.length > 1 && value < resolveOperand(parts[1], resolve);
		},
		le: function(value, parts, resolve){
			return parts.length > 1 && value <= resolveOperand(parts[1], resolve);
		},
		gt: function(value, parts, resolve){
			return parts.length > 1 && value > resolveOperand(parts[1], resolve);
		},
		ge: function(value, parts, resolve){
			return parts.length > 1 && value >= resolveOperand(parts[1], resolve);
		},
		*/
		not: function(value){
			return !value;
		}
	};
	
	
	var logicNames = ["eq", "lt", "le", "gt", "ge", "is" ],
		logicOps   = ["==", "<",  "<=", ">",  ">=", "==="],
		logicDict  = {},
		logicTmpl  = ste.compileTemplate("(function(value, parts, resolve){ return parts.length > 1 && value #{op} resolveOperand(parts[1], resolve); })", /#\{([^\}]+)\}/g);
	for(var i = 0, l = logicNames.length; i < l; ++i){
		logicDict.op = logicOps[i];
		ste.standardFilters[logicNames[i]] = eval(logicTmpl.exec(logicDict));
	}
	
	ste.runTemplate = function(tmpl, dict, pattern, filters){
		return ste.compileTemplate(tmpl, pattern, filters).exec(dict);	// String
	}
})();
