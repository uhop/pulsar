declare(["./lang", "./window", "./browser"], function(lang, win, browser){
    function byId(id, doc){
        // inline'd type check.
        // be sure to return null per documentation, to match IE branch.
        return ((typeof id == "string") ? (doc || win.doc()).getElementById(id) : id) || null; // DomNode
    }

    function destroy(/*String|DomNode*/node){
        // summary:
        //		Removes a node from its parent, clobbering it and all of its
        //		children.
        //
        // description:
        //		Removes a node from its parent, clobbering it and all of its
        //		children. Function only works with DomNodes, and returns nothing.
        //
        // node:
        //		A String ID or DomNode reference of the element to be destroyed
        //
        // example:
        //		Destroy a node byId:
        //	|	dojo.destroy("someId");
        //
        // example:
        //		Destroy all nodes in a list by reference:
        //	|	dojo.query(".someNode").forEach(dojo.destroy);

        node = byId(node);
        try{
            var doc = node.ownerDocument;
            // cannot use _destroyContainer.ownerDocument since this can throw an exception on IE
            if(!_destroyContainer || _destroyDoc != doc){
                _destroyContainer = doc.createElement("div");
                _destroyDoc = doc;
            }
            _destroyContainer.appendChild(node.parentNode ? node.parentNode.removeChild(node) : node);
            // NOTE: see http://trac.dojotoolkit.org/ticket/2931. This may be a bug and not a feature
            _destroyContainer.innerHTML = "";
        }catch(e){
            /* squelch */
        }
    }

    function isDescendant(/*DomNode|String*/node, /*DomNode|String*/ancestor){
        // summary:
        //		Returns true if node is a descendant of ancestor
        // node: string id or node reference to test
        // ancestor: string id or node reference of potential parent to test against
        //
        // example:
        //		Test is node id="bar" is a descendant of node id="foo"
        //	|	if(dojo.isDescendant("bar", "foo")){ ... }
        try{
            node = byId(node);
            ancestor = byId(ancestor);
            while(node){
                if(node == ancestor){
                    return true; // Boolean
                }
                node = node.parentNode;
            }
        }catch(e){ /* squelch, return false */ }
        return false; // Boolean
    }

    //TODO: do we need this function in the base? looks like it is browser-dependent
    function setSelectable(/*DomNode|String*/node, /*Boolean*/selectable){
        // summary:
        //		Enable or disable selection on a node
        // node:
        //		id or reference to node
        // selectable:
        //		state to put the node in. false indicates unselectable, true
        //		allows selection.
        // example:
        //		Make the node id="bar" unselectable
        //	|	dojo.setSelectable("bar");
        // example:
        //		Make the node id="bar" selectable
        //	|	dojo.setSelectable("bar", true);
        node = byId(node);
        //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
        if(browser.isMozilla){
            node.style.MozUserSelect = selectable ? "" : "none";
        }else if(browser.isKhtml || browser.isWebKit){
        //>>excludeEnd("webkitMobile");
            node.style.KhtmlUserSelect = selectable ? "auto" : "none";
        //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
        }else if(browser.isIE){
            var v = (node.unselectable = selectable ? "" : "on");
            //TODO: eliminate dojo.query()
            //d.query("*", node).forEach("item.unselectable = '"+v+"'");
        }
        //>>excludeEnd("webkitMobile");
        //TODO: else?  Opera?
    }

    function _insertBefore(/*DomNode*/node, /*DomNode*/ref){
        var parent = ref.parentNode;
        if(parent){
            parent.insertBefore(node, ref);
        }
    }

    function _insertAfter(/*DomNode*/node, /*DomNode*/ref){
        // summary:
        //		Try to insert node after ref
        var parent = ref.parentNode;
        if(parent){
            if(parent.lastChild == ref){
                parent.appendChild(node);
            }else{
                parent.insertBefore(node, ref.nextSibling);
            }
        }
    }

    function place(node, refNode, position){
        // summary:
        //		Attempt to insert node into the DOM, choosing from various positioning options.
        //		Returns the first argument resolved to a DOM node.
        //
        // node: String|DomNode
        //		id or node reference, or HTML fragment starting with "<" to place relative to refNode
        //
        // refNode: String|DomNode
        //		id or node reference to use as basis for placement
        //
        // position: String|Number?
        //		string noting the position of node relative to refNode or a
        //		number indicating the location in the childNodes collection of refNode.
        //		Accepted string values are:
        //	|	* before
        //	|	* after
        //	|	* replace
        //	|	* only
        //	|	* first
        //	|	* last
        //		"first" and "last" indicate positions as children of refNode, "replace" replaces refNode,
        //		"only" replaces all children.  position defaults to "last" if not specified
        //
        // returns: DomNode
        //		Returned values is the first argument resolved to a DOM node.
        //
        //		.place() is also a method of `dojo.NodeList`, allowing `dojo.query` node lookups.
        //
        // example:
        //		Place a node by string id as the last child of another node by string id:
        //	|	dojo.place("someNode", "anotherNode");
        //
        // example:
        //		Place a node by string id before another node by string id
        //	|	dojo.place("someNode", "anotherNode", "before");
        //
        // example:
        //		Create a Node, and place it in the body element (last child):
        //	|	dojo.place("<div></div>", dojo.body());
        //
        // example:
        //		Put a new LI as the first child of a list by id:
        //	|	dojo.place("<li></li>", "someUl", "first");

        refNode = byId(refNode);
        if(typeof node == "string"){ // inline'd type check
            node = node.charAt(0) == "<" ? toDom(node, refNode.ownerDocument) : byId(node);
        }
        if(typeof position == "number"){ // inline'd type check
            var cn = refNode.childNodes;
            if(!cn.length || cn.length <= position){
                refNode.appendChild(node);
            }else{
                _insertBefore(node, cn[position < 0 ? 0 : position]);
            }
        }else{
            switch(position){
                case "before":
                    _insertBefore(node, refNode);
                    break;
                case "after":
                    _insertAfter(node, refNode);
                    break;
                case "replace":
                    refNode.parentNode.replaceChild(node, refNode);
                    break;
                case "only":
                    empty(refNode);
                    refNode.appendChild(node);
                    break;
                case "first":
                    if(refNode.firstChild){
                        _insertBefore(node, refNode.firstChild);
                        break;
                    }
                    // else fallthrough...
                default: // aka: last
                    refNode.appendChild(node);
            }
        }
        return node; // DomNode
    }

    // =============================
    // Style Functions
    // =============================

    // getComputedStyle drives most of the style code.
    // Wherever possible, reuse the returned object.
    //
    // API functions below that need to access computed styles accept an
    // optional computedStyle parameter.
    // If this parameter is omitted, the functions will call getComputedStyle themselves.
    // This way, calling code can access computedStyle once, and then pass the reference to
    // multiple API functions.

/*=====
	dojo.getComputedStyle = function(node){
		// summary:
		//		Returns a "computed style" object.
		//
		// description:
		//		Gets a "computed style" object which can be used to gather
		//		information about the current state of the rendered node.
		//
		//		Note that this may behave differently on different browsers.
		//		Values may have different formats and value encodings across
		//		browsers.
		//
		//		Note also that this method is expensive.  Wherever possible,
		//		reuse the returned object.
		//
		//		Use the dojo.style() method for more consistent (pixelized)
		//		return values.
		//
		// node: DOMNode
		//		A reference to a DOM node. Does NOT support taking an
		//		ID string for speed reasons.
		// example:
		//	|	dojo.getComputedStyle(dojo.byId('foo')).borderWidth;
		//
		// example:
		//	Reusing the returned object, avoiding multiple lookups:
		//	|	var cs = dojo.getComputedStyle(dojo.byId("someNode"));
		//	|	var w = cs.width, h = cs.height;
		return; // CSS2Properties
	}
=====*/

    // Although we normally eschew argument validation at this
    // level, here we test argument 'node' for (duck)type,
    // by testing nodeType, ecause 'document' is the 'parentNode' of 'body'
    // it is frequently sent to this function even
    // though it is not Element.
    var getComputedStyle;
    //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
    if(browser.isWebKit){
    //>>excludeEnd("webkitMobile");
        getComputedStyle = function(/*DomNode*/node){
            var s;
            if(node.nodeType == 1){
                var dv = node.ownerDocument.defaultView;
                s = dv.getComputedStyle(node, null);
                if(!s && node.style){
                    node.style.display = "";
                    s = dv.getComputedStyle(node, null);
                }
            }
            return s || {};
        };
    //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
    }else if(browser.isIE){
        getComputedStyle = function(node){
            // IE (as of 7) doesn't expose Element like sane browsers
            return node.nodeType == 1 /* ELEMENT_NODE*/ ? node.currentStyle : {};
        };
    }else{
        getComputedStyle = function(node){
            return node.nodeType == 1 ?
                node.ownerDocument.defaultView.getComputedStyle(node, null) : {};
        };
    }
    //>>excludeEnd("webkitMobile");

    var toPixel;
    //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
    if(!browser.isIE){
    //>>excludeEnd("webkitMobile");
        toPixel = function(element, value){
            // style values can be floats, client code may want
            // to round for integer pixels.
            return parseFloat(value) || 0;
        };
    //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
    }else{
        toPixel = function(element, avalue){
            if(!avalue){ return 0; }
            // on IE7, medium is usually 4 pixels
            if(avalue == "medium"){ return 4; }
            // style values can be floats, client code may
            // want to round this value for integer pixels.
            if(avalue.slice && avalue.slice(-2) == 'px'){ return parseFloat(avalue); }
            with(element){
                var sLeft = style.left;
                var rsLeft = runtimeStyle.left;
                runtimeStyle.left = currentStyle.left;
                try{
                    // 'avalue' may be incompatible with style.left, which can cause IE to throw
                    // this has been observed for border widths using "thin", "medium", "thick" constants
                    // those particular constants could be trapped by a lookup
                    // but perhaps there are more
                    style.left = avalue;
                    avalue = style.pixelLeft;
                }catch(e){
                    avalue = 0;
                }
                style.left = sLeft;
                runtimeStyle.left = rsLeft;
            }
            return avalue;
        }
    }
    //>>excludeEnd("webkitMobile");

    // FIXME: there opacity quirks on FF that we haven't ported over. Hrm.
    /*=====
    dojo._getOpacity = function(node){
            // summary:
            //		Returns the current opacity of the passed node as a
            //		floating-point value between 0 and 1.
            // node: DomNode
            //		a reference to a DOM node. Does NOT support taking an
            //		ID string for speed reasons.
            // returns: Number between 0 and 1
            return; // Number
    }
    =====*/

    //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
    var astr = "DXImageTransform.Microsoft.Alpha";
    var af = function(n, f){
        try{
            return n.filters.item(astr);
        }catch(e){
            return f ? {} : null;
        }
    };

    //>>excludeEnd("webkitMobile");
    var _getOpacity =
    //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
        browser.isIE ? function(node){
            try{
                return af(node).Opacity / 100; // Number
            }catch(e){
                return 1; // Number
            }
        } :
    //>>excludeEnd("webkitMobile");
        function(node){
            return getComputedStyle(node).opacity;
        };

    /*=====
    dojo._setOpacity = function(node, opacity){
            // summary:
            //		set the opacity of the passed node portably. Returns the
            //		new opacity of the node.
            // node: DOMNode
            //		a reference to a DOM node. Does NOT support taking an
            //		ID string for performance reasons.
            // opacity: Number
            //		A Number between 0 and 1. 0 specifies transparent.
            // returns: Number between 0 and 1
            return; // Number
    }
    =====*/

    var _setOpacity =
        //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
        browser.isIE ? function(/*DomNode*/node, /*Number*/opacity){
            var ov = opacity * 100, opaque = opacity == 1;
            node.style.zoom = opaque ? "" : 1;

            if(!af(node)){
                if(opaque){
                    return opacity;
                }
                node.style.filter += " progid:" + astr + "(Opacity=" + ov + ")";
            }else{
                af(node, 1).Opacity = ov;
            }

            // on IE7 Alpha(Filter opacity=100) makes text look fuzzy so disable it altogether (bug #2661),
            //but still update the opacity value so we can get a correct reading if it is read later.
            af(node, 1).Enabled = !opaque;

            if(node.tagName.toLowerCase() == "tr"){
                for(var td = node.firstChild; td; td = td.nextSibling){
                    if(td.tagName.toLowerCase() == "td"){
                        _setOpacity(td, opacity);
                    }
                }
            }
            return opacity;
        } :
        //>>excludeEnd("webkitMobile");
        function(node, opacity){
            return node.style.opacity = opacity;
        };

    var _pixelNamesCache = {
        left: true, top: true
    };
    var _pixelRegExp = /margin|padding|width|height|max|min|offset/; // |border
    function _toStyleValue(node, type, value){
        //TODO: should we really be doing string case conversion here? Should we cache it? Need to profile!
        type = type.toLowerCase();
        //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
        if(browser.isIE){
            if(value == "auto"){
                if(type == "height"){ return node.offsetHeight; }
                if(type == "width"){ return node.offsetWidth; }
            }
            if(type == "fontweight"){
                switch(value){
                    case 700: return "bold";
                    case 400:
                    default: return "normal";
                }
            }
        }
        //>>excludeEnd("webkitMobile");
        if(!(type in _pixelNamesCache)){
            _pixelNamesCache[type] = _pixelRegExp.test(type);
        }
        return _pixelNamesCache[type] ? toPixel(node, value) : value;
    }

    var _floatStyle = browser.isIE ? "styleFloat" : "cssFloat",
        _floatAliases = { "cssFloat": _floatStyle, "styleFloat": _floatStyle, "float": _floatStyle };

    // public API

    function style(/*DomNode|String*/ node, /*String?|Object?*/ style, /*String?*/ value){
        // summary:
        //		Accesses styles on a node. If 2 arguments are
        //		passed, acts as a getter. If 3 arguments are passed, acts
        //		as a setter.
        // description:
        //		Getting the style value uses the computed style for the node, so the value
        //		will be a calculated value, not just the immediate node.style value.
        //		Also when getting values, use specific style names,
        //		like "borderBottomWidth" instead of "border" since compound values like
        //		"border" are not necessarily reflected as expected.
        //		If you want to get node dimensions, use `dojo.marginBox()`,
        //		`dojo.contentBox()` or `dojo.position()`.
        // node:
        //		id or reference to node to get/set style for
        // style:
        //		the style property to set in DOM-accessor format
        //		("borderWidth", not "border-width") or an object with key/value
        //		pairs suitable for setting each property.
        // value:
        //		If passed, sets value on the node for style, handling
        //		cross-browser concerns.  When setting a pixel value,
        //		be sure to include "px" in the value. For instance, top: "200px".
        //		Otherwise, in some cases, some browsers will not apply the style.
        // example:
        //		Passing only an ID or node returns the computed style object of
        //		the node:
        //	|	dojo.style("thinger");
        // example:
        //		Passing a node and a style property returns the current
        //		normalized, computed value for that property:
        //	|	dojo.style("thinger", "opacity"); // 1 by default
        //
        // example:
        //		Passing a node, a style property, and a value changes the
        //		current display of the node and returns the new computed value
        //	|	dojo.style("thinger", "opacity", 0.5); // == 0.5
        //
        // example:
        //		Passing a node, an object-style style property sets each of the values in turn and returns the computed
        //      style object of the node:
        //	|	dojo.style("thinger", {
        //	|		"opacity": 0.5,
        //	|		"border": "3px solid black",
        //	|		"height": "300px"
        //	|	});
        //
        //  example:
        //		When the CSS style property is hyphenated, the JavaScript property is camelCased.
        //		font-size becomes fontSize, and so on.
        //	|	dojo.style("thinger",{
        //	|		fontSize:"14pt",
        //	|		letterSpacing:"1.2em"
        //	|	});
        //
        // example:
        //		dojo.NodeList implements .style() using the same syntax, omitting the "node" parameter, calling
        //		dojo.style() on every element of the list. See: `dojo.query()` and `dojo.NodeList()`
        //	|	dojo.query(".someClassName").style("visibility","hidden");
        //	|	// or
        //	|	dojo.query("#baz > div").style({
        //	|		opacity:0.75,
        //	|		fontSize:"13pt"
        //	|	});

        var n = byId(node), l = arguments.length, op = (style == "opacity");
        style = _floatAliases[style] || style;
        if(l == 3){
            return op ? _setOpacity(n, value) : n.style[style] = value; // Number
        }
        if(l == 2 && op){
            return _getOpacity(n);
        }
        var s = getComputedStyle(n);
        if(l == 2 && typeof style != "string"){ // inline'd type check
            for(var x in style){
                style(node, x, style[x]);
            }
            return s;
        }
        return (l == 1) ? s : _toStyleValue(n, style, s[style] || n.style[style]); // CSS2Properties|String|Number
    }

    // =============================
    // Element attribute Functions
    // =============================

    //TODO: redo all attribute-related functions as property-related functions

    // dojo.attr() should conform to http://www.w3.org/TR/DOM-Level-2-Core/

    var _propNames = {
            // properties renamed to avoid clashes with reserved words
            "class": "className",
            "for": "htmlFor",
            // properties written as camelCase
            tabindex: "tabIndex",
            readonly: "readOnly",
            colspan: "colSpan",
            frameborder: "frameBorder",
            rowspan: "rowSpan",
            valuetype: "valueType"
        },
        _attrNames = {
            // original attribute names
            classname: "class",
            htmlfor: "for",
            // for IE
            tabindex: "tabIndex",
            readonly: "readOnly"
        },
        _forcePropNames = {
            innerHTML:	1,
            className:	1,
            htmlFor:	browser.isIE,
            value:		1
        };

    function _fixAttrName(/*String*/ name){
        return _attrNames[name.toLowerCase()] || name;
    }

    function _hasAttr(node, name){
        var attr = node.getAttributeNode && node.getAttributeNode(name);
        return attr && attr.specified; // Boolean
    }

    // There is a difference in the presence of certain properties and their default values
    // between browsers. For example, on IE "disabled" is present on all elements,
    // but it is value is "false"; "tabIndex" of <div> returns 0 by default on IE, yet other browsers
    // can return -1.

    function hasAttr(/*DomNode|String*/node, /*String*/name){
        // summary:
        //		Returns true if the requested attribute is specified on the
        //		given element, and false otherwise.
        //	node:
        //		id or reference to the element to check
        //	name:
        //		the name of the attribute
        //	returns:
        //		true if the requested attribute is specified on the
        //		given element, and false otherwise
        var lc = name.toLowerCase();
        return _forcePropNames[_propNames[lc] || name] || _hasAttr(byId(node), _attrNames[lc] || name);	// Boolean
    }

    var _evtHdlrMap = {}, _ctr = 0,
        _attrId = "dojo_attrid", //TODO: this value used to be derived from scope name
        // the next dictionary lists elements with read-only innerHTML on IE
        _roInnerHtml = {col: 1, colgroup: 1,
            // frameset: 1, head: 1, html: 1, style: 1,
            table: 1, tbody: 1, tfoot: 1, thead: 1, tr: 1, title: 1};

    function attr(/*DomNode|String*/node, /*String|Object*/name, /*String?*/value){
        // summary:
        //		Gets or sets an attribute on an HTML element.
        // description:
        //		Handles normalized getting and setting of attributes on DOM
        //		Nodes. If 2 arguments are passed, and a the second argumnt is a
        //		string, acts as a getter.
        //
        //		If a third argument is passed, or if the second argument is a
        //		map of attributes, acts as a setter.
        //
        //		When passing functions as values, note that they will not be
        //		directly assigned to slots on the node, but rather the default
        //		behavior will be removed and the new behavior will be added
        //		using `dojo.connect()`, meaning that event handler properties
        //		will be normalized and that some caveats with regards to
        //		non-standard behaviors for onsubmit apply. Namely that you
        //		should cancel form submission using `dojo.stopEvent()` on the
        //		passed event object instead of returning a boolean value from
        //		the handler itself.
        // node:
        //		id or reference to the element to get or set the attribute on
        // name:
        //		the name of the attribute to get or set.
        // value:
        //		The value to set for the attribute
        // returns:
        //		when used as a getter, the value of the requested attribute
        //		or null if that attribute does not have a specified or
        //		default value;
        //
        //		when used as a setter, the DOM node
        //
        // example:
        //	|	// get the current value of the "foo" attribute on a node
        //	|	dojo.attr(dojo.byId("nodeId"), "foo");
        //	|	// or we can just pass the id:
        //	|	dojo.attr("nodeId", "foo");
        //
        // example:
        //	|	// use attr() to set the tab index
        //	|	dojo.attr("nodeId", "tabIndex", 3);
        //	|
        //
        // example:
        //	Set multiple values at once, including event handlers:
        //	|	dojo.attr("formId", {
        //	|		"foo": "bar",
        //	|		"tabIndex": -1,
        //	|		"method": "POST",
        //	|		"onsubmit": function(e){
        //	|			// stop submitting the form. Note that the IE behavior
        //	|			// of returning true or false will have no effect here
        //	|			// since our handler is connect()ed to the built-in
        //	|			// onsubmit behavior and so we need to use
        //	|			// dojo.stopEvent() to ensure that the submission
        //	|			// doesn't proceed.
        //	|			dojo.stopEvent(e);
        //	|
        //	|			// submit the form with Ajax
        //	|			dojo.xhrPost({ form: "formId" });
        //	|		}
        //	|	});
        //
        // example:
        //	Style is s special case: Only set with an object hash of styles
        //	|	dojo.attr("someNode",{
        //	|		id:"bar",
        //	|		style:{
        //	|			width:"200px", height:"100px", color:"#000"
        //	|		}
        //	|	});
        //
        // example:
        //	Again, only set style as an object hash of styles:
        //	|	var obj = { color:"#fff", backgroundColor:"#000" };
        //	|	dojo.attr("someNode", "style", obj);
        //	|
        //	|	// though shorter to use `dojo.style()` in this case:
        //	|	dojo.style("someNode", obj);

        node = byId(node);
        var l = arguments.length, prop;
        if(l == 2 && typeof name != "string"){ // inline'd type check
            // the object form of setter: the 2nd argument is a dictionary
            for(var x in name){
                attr(node, x, name[x]);
            }
            return node; // DomNode
        }
        var lc = name.toLowerCase(),
            propName = _propNames[lc] || name,
            forceProp = _forcePropNames[propName],
            attrName = _attrNames[lc] || name;
        if(l == 3){
            // setter
            do{
                if(propName == "style" && typeof value != "string"){ // inline'd type check
                    // special case: setting a style
                    style(node, value);
                    break;
                }
                if(propName == "innerHTML"){
                    // special case: assigning HTML
                    //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
                    if(browser.isIE && node.tagName.toLowerCase() in _roInnerHtml){
                        empty(node);
                        node.appendChild(toDom(value, node.ownerDocument));
                    }else{
                    //>>excludeEnd("webkitMobile");
                        node[propName] = value;
                    //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
                    }
                    //>>excludeEnd("webkitMobile");
                    break;
                }
                if(lang.isFunction(value)){
                    // special case: assigning an event handler
                    // clobber if we can
                    var attrId = attr(node, _attrId);
                    if(!attrId){
                        attrId = _ctr++;
                        attr(node, _attrId, attrId);
                    }
                    if(!_evtHdlrMap[attrId]){
                        _evtHdlrMap[attrId] = {};
                    }
                    var h = _evtHdlrMap[attrId][propName];
                    if(h){
                        //TODO: add back when events are implemented
                        //d.disconnect(h);
                    }else{
                        try{
                            delete node[propName];
                        }catch(e){}
                    }
                    // ensure that event objects are normalized, etc.
                    //TODO: add back when events are implemented
                    //_evtHdlrMap[attrId][propName] = d.connect(node, propName, value);
                    break;
                }
                if(forceProp || typeof value == "boolean"){
                    // special case: forcing assignment to the property
                    // special case: setting boolean to a property instead of attribute
                    node[propName] = value;
                    break;
                }
                // node's attribute
                node.setAttribute(attrName, value);
            }while(false);
            return node; // DomNode
        }
        // getter
        // should we access this attribute via a property or
        // via getAttribute()?
        value = node[propName];
        if(forceProp && typeof value != "undefined"){
            // node's property
            return value;	// Anything
        }
        if(propName != "href" && (typeof value == "boolean" || lang.isFunction(value))){
            // node's property
            return value;	// Anything
        }
        // node's attribute
        // we need _hasAttr() here to guard against IE returning a default value
        return _hasAttr(node, attrName) ? node.getAttribute(attrName) : null; // Anything
    }

    function removeAttr(/*DomNode|String*/ node, /*String*/ name){
        // summary:
        //		Removes an attribute from an HTML element.
        // node:
        //		id or reference to the element to remove the attribute from
        // name:
        //		the name of the attribute to remove
        byId(node).removeAttribute(_fixAttrName(name));
    }

    function getNodeProp(/*DomNode|String*/ node, /*String*/ name){
        // summary:
        //		Returns an effective value of a property or an attribute.
        //	node:
        //		id or reference to the element to remove the attribute from
        //	name:
        //		the name of the attribute
        node = byId(node);
        var lc = name.toLowerCase(), propName = _propNames[lc] || name;
        if((propName in node) && propName != "href"){
            // node's property
            return node[propName];	// Anything
        }
        // node's attribute
        var attrName = _attrNames[lc] || name;
        return _hasAttr(node, attrName) ? node.getAttribute(attrName) : null; // Anything
    }

    function create(tag, attrs, refNode, pos){
        // summary:
        //		Create an element, allowing for optional attribute decoration
        //		and placement.
        //
        // description:
        //		A DOM Element creation function. A shorthand method for creating a node or
        //		a fragment, and allowing for a convenient optional attribute setting step,
        //		as well as an optional DOM placement reference.
        //|
        //		Attributes are set by passing the optional object through `dojo.attr`.
        //		See `dojo.attr` for noted caveats and nuances, and API if applicable.
        //|
        //		Placement is done via `dojo.place`, assuming the new node to be the action
        //		node, passing along the optional reference node and position.
        //
        // tag: String|DomNode
        //		A string of the element to create (eg: "div", "a", "p", "li", "script", "br"),
        //		or an existing DOM node to process.
        //
        // attrs: Object
        //		An object-hash of attributes to set on the newly created node.
        //		Can be null, if you don't want to set any attributes/styles.
        //		See: `dojo.attr` for a description of available attributes.
        //
        // refNode: String?|DomNode?
        //		Optional reference node. Used by `dojo.place` to place the newly created
        //		node somewhere in the dom relative to refNode. Can be a DomNode reference
        //		or String ID of a node.
        //
        // pos: String?
        //		Optional positional reference. Defaults to "last" by way of `dojo.place`,
        //		though can be set to "first","after","before","last", "replace" or "only"
        //		to further control the placement of the new node relative to the refNode.
        //		'refNode' is required if a 'pos' is specified.
        //
        // returns: DomNode
        //
        // example:
        //		Create a DIV:
        //	|	var n = dojo.create("div");
        //
        // example:
        //		Create a DIV with content:
        //	|	var n = dojo.create("div", { innerHTML:"<p>hi</p>" });
        //
        // example:
        //		Place a new DIV in the BODY, with no attributes set
        //	|	var n = dojo.create("div", null, dojo.body());
        //
        // example:
        //		Create an UL, and populate it with LI's. Place the list as the first-child of a
        //		node with id="someId":
        //	|	var ul = dojo.create("ul", null, "someId", "first");
        //	|	var items = ["one", "two", "three", "four"];
        //	|	dojo.forEach(items, function(data){
        //	|		dojo.create("li", { innerHTML: data }, ul);
        //	|	});
        //
        // example:
        //		Create an anchor, with an href. Place in BODY:
        //	|	dojo.create("a", { href:"foo.html", title:"Goto FOO!" }, dojo.body());
        //
        // example:
        //		Create a `dojo.NodeList()` from a new element (for syntatic sugar):
        //	|	dojo.query(dojo.create('div'))
        //	|		.addClass("newDiv")
        //	|		.onclick(function(e){ console.log('clicked', e.target) })
        //	|		.place("#someNode"); // redundant, but cleaner.

        var doc = win.doc();
        if(refNode){
            refNode = byId(refNode);
            doc = refNode.ownerDocument;
        }
        if(typeof tag == "string"){ // inline'd type check
            tag = doc.createElement(tag);
        }
        if(attrs){ attr(tag, attrs); }
        if(refNode){ place(tag, refNode, pos); }
        return tag; // DomNode
    }

    /*=====
    dojo.empty = function(node){
            // summary:
            //		safely removes all children of the node.
            //		node: DOMNode|String
            //		a reference to a DOM node or an id.
            //		example:
            //		Destroy node's children byId:
            //	|	dojo.empty("someId");
            //
            // example:
            //		Destroy all nodes' children in a list by reference:
            //	|	dojo.query(".someNode").forEach(dojo.empty);
    }
    =====*/

    var empty =
        //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
        browser.isIE ? function(node){
            node = byId(node);
            for(var c; c = node.lastChild;){ // intentional assignment
                destroy(c);
            }
        } :
        //>>excludeEnd("webkitMobile");
        function(node){
            byId(node).innerHTML = "";
        };

    /*=====
    dojo._toDom = function(frag, doc){
            // summary:
            //		instantiates an HTML fragment returning the corresponding DOM.
            // frag: String
            //		the HTML fragment
            // doc: DocumentNode?
            //		optional document to use when creating DOM nodes, defaults to
            //		dojo.doc if not specified.
            // returns: DocumentFragment
            //
            // example:
            //		Create a table row:
            //	|	var tr = dojo._toDom("<tr><td>First!</td></tr>");
    }
    =====*/

    // support stuff for dojo._toDom
    var tagWrap = {
            option: ["select"],
            tbody: ["table"],
            thead: ["table"],
            tfoot: ["table"],
            tr: ["table", "tbody"],
            td: ["table", "tbody", "tr"],
            th: ["table", "thead", "tr"],
            legend: ["fieldset"],
            caption: ["table"],
            colgroup: ["table"],
            col: ["table", "colgroup"],
            li: ["ul"]
        },
        reTag = /<\s*([\w\:]+)/,
        masterNode = {}, masterNum = 0,
        masterName = "__" + "dojo_ToDomId"; // TODO: used to be derived from scope name

    // generate start/end tag strings to use
    // for the injection for each special tag wrap case.
    for(var param in tagWrap){
        var tw = tagWrap[param];
        tw.pre = param == "option" ? '<select multiple="multiple">' : "<" + tw.join("><") + ">";
        tw.post = "</" + tw.reverse().join("></") + ">";
        // the last line is destructive: it reverses the array,
        // but we don't care at this point
    }

    function toDom(frag, doc){
        // summary:
        // 		converts HTML string into DOM nodes.

        doc = doc || win.doc();
        var masterId = doc[masterName];
        if(!masterId){
            doc[masterName] = masterId = ++masterNum + "";
            masterNode[masterId] = doc.createElement("div");
        }

        // make sure the frag is a string.
        frag += "";

        // find the starting tag, and get node wrapper
        var match = frag.match(reTag),
            tag = match ? match[1].toLowerCase() : "",
            master = masterNode[masterId],
            wrap, i, fc, df;
        if(match && tagWrap[tag]){
            wrap = tagWrap[tag];
            master.innerHTML = wrap.pre + frag + wrap.post;
            for(i = wrap.length; i; --i){
                master = master.firstChild;
            }
        }else{
            master.innerHTML = frag;
        }

        // one node shortcut => return the node itself
        if(master.childNodes.length == 1){
            return master.removeChild(master.firstChild); // DOMNode
        }

        // return multiple nodes as a document fragment
        df = doc.createDocumentFragment();
        while(fc = master.firstChild){ // intentional assignment
            df.appendChild(fc);
        }
        return df; // DOMNode
    }

    //TODO: split getters and setters? Examples: attr - getAttr/setAttr, style - getStyle/setStyle, and so on.

    return {
        // core functions
        byId:          byId,
        isDescendant:  isDescendant,
        setSelectable: setSelectable,   //TODO: do we even need that in the base?
        // properties, attributes and styles
        getNodeProp: getNodeProp,
        attr:        attr,
        hasAttr:     hasAttr,
        removeAttr:  removeAttr,
        style:       style,
        getComputedStyle: getComputedStyle,
        toPixel:     toPixel,
        // construction functions
        toDom:  toDom,
        place:  place,
        create: create,
        // cleanup functions
        destroy: destroy,
        empty:   empty
    };
});
