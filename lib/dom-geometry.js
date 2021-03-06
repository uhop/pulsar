declare(["./dom", "./window", "./browser"], function(dom, win, browser){
    //TODO: we need to decide what functions to keep in 2.0
    //TODO: it should be a stand-alone module rather than a part of the base

    // Box functions will assume this model.
    // On IE/Opera, BORDER_BOX will be set if the primary document is in quirks mode.
    // Can be set to change behavior of box setters.

    // can be either:
    //	"border-box"
    //	"content-box" (default)
    var boxModel = "content-box";

    // We punt per-node box mode testing completely.
    // If anybody cares, we can provide an additional (optional) unit
    // that overrides existing code to include per-node box sensitivity.

    // Opera documentation claims that Opera 9 uses border-box in BackCompat mode.
    // but experiments (Opera 9.10.8679 on Windows Vista) indicate that it actually continues to use content-box.
    // IIRC, earlier versions of Opera did in fact use border-box.
    // Opera guys, this is really confusing. Opera being broken in quirks mode is not our fault.

    //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
    if(browser.isIE /*|| browser.isOpera*/){
        // client code may have to adjust if compatMode varies across iframes
        boxModel = document.compatMode == "BackCompat" ? "border-box" : "content-box";
    }
    //>>excludeEnd("webkitMobile");

    function getBoxModel(){ return boxModel; }
    function setBoxModel(bm){ boxModel = bm; }

    // =============================
    // Box Functions
    // =============================

    function _getPadExtents(/*DomNode*/n, /*Object*/computedStyle){
        // summary:
        // 		Returns object with special values specifically useful for node
        // 		fitting.
        // description:
        //		Returns an object with `w`, `h`, `l`, `t` properties:
        //	|		l/t = left/top padding (respectively)
        //	|		w = the total of the left and right padding
        //	|		h = the total of the top and bottom padding
        //		If 'node' has position, l/t forms the origin for child nodes.
        //		The w/h are used for calculating boxes.
        //		Normally application code will not need to invoke this
        //		directly, and will use the ...box... functions instead.
        var s = computedStyle || dom.getComputedStyle(n),
            px = dom.toPixel,
            l = px(n, s.paddingLeft),
            t = px(n, s.paddingTop);
        return {
            l: l,
            t: t,
            w: l + px(n, s.paddingRight),
            h: t + px(n, s.paddingBottom)
        };
    }

    function _getBorderExtents(/*DomNode*/n, /*Object*/computedStyle){
        // summary:
        //		returns an object with properties useful for noting the border
        //		dimensions.
        // description:
        // 		* l/t = the sum of left/top border (respectively)
        //		* w = the sum of the left and right border
        //		* h = the sum of the top and bottom border
        //
        //		The w/h are used for calculating boxes.
        //		Normally application code will not need to invoke this
        //		directly, and will use the ...box... functions instead.
        var ne = "none",
            px = dom.toPixel,
            s = computedStyle || dom.getComputedStyle(n),
            bl = (s.borderLeftStyle != ne ? px(n, s.borderLeftWidth) : 0),
            bt = (s.borderTopStyle != ne ? px(n, s.borderTopWidth) : 0);
        return {
            l: bl,
            t: bt,
            w: bl + (s.borderRightStyle != ne ? px(n, s.borderRightWidth) : 0),
            h: bt + (s.borderBottomStyle != ne ? px(n, s.borderBottomWidth) : 0)
        };
    }

    function _getPadBorderExtents(/*DomNode*/n, /*Object*/computedStyle){
        // summary:
        //		Returns object with properties useful for box fitting with
        //		regards to padding.
        // description:
        //		* l/t = the sum of left/top padding and left/top border (respectively)
        //		* w = the sum of the left and right padding and border
        //		* h = the sum of the top and bottom padding and border
        //
        //		The w/h are used for calculating boxes.
        //		Normally application code will not need to invoke this
        //		directly, and will use the ...box... functions instead.
        var s = computedStyle || dom.getComputedStyle(n),
            p = _getPadExtents(n, s),
            b = _getBorderExtents(n, s);
        return {
            l: p.l + b.l,
            t: p.t + b.t,
            w: p.w + b.w,
            h: p.h + b.h
        };
    }

    function _getMarginExtents(n, computedStyle){
        // summary:
        //		returns object with properties useful for box fitting with
        //		regards to box margins (i.e., the outer-box).
        //
        //		* l/t = marginLeft, marginTop, respectively
        //		* w = total width, margin inclusive
        //		* h = total height, margin inclusive
        //
        //		The w/h are used for calculating boxes.
        //		Normally application code will not need to invoke this
        //		directly, and will use the ...box... functions instead.
        var s = computedStyle || dom.getComputedStyle(n),
            px = dom.toPixel,
            l = px(n, s.marginLeft),
            t = px(n, s.marginTop),
            r = px(n, s.marginRight),
            b = px(n, s.marginBottom);
        if(browser.isWebKit && (s.position != "absolute")){
            // FIXME: Safari's version of the computed right margin
            // is the space between our right edge and the right edge
            // of our offsetParent.
            // What we are looking for is the actual margin value as
            // determined by CSS.
            // Hack solution is to assume left/right margins are the same.
            r = l;
        }
        return {l: l, t: t, w: l + r, h: t + b};
    }

    // Box getters work in any box context because offsetWidth/clientWidth
    // are invariant wrt box context
    //
    // They do *not* work for display: inline objects that have padding styles
    // because the user agent ignores padding (it's bogus styling in any case)
    //
    // Be careful with IMGs because they are inline or block depending on
    // browser and browser mode.

    // Although it would be easier to read, there are not separate versions of
    // _getMarginBox for each browser because:
    // 1. the branching is not expensive
    // 2. factoring the shared code wastes cycles (function call overhead)
    // 3. duplicating the shared code wastes bytes

    function _getMarginBox(/*DomNode*/node, /*Object*/computedStyle){
        // summary:
        //		returns an object that encodes the width, height, left and top
        //		positions of the node's margin box.
        var s = computedStyle || dom.getComputedStyle(node), me = _getMarginExtents(node, s),
            l = node.offsetLeft - me.l, t = node.offsetTop - me.t, p = node.parentNode;
        //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
        if(browser.isMoz){
            // Mozilla:
            // If offsetParent has a computed overflow != visible, the offsetLeft is decreased
            // by the parent's border.
            // We don't want to compute the parent's style, so instead we examine node's
            // computed left/top which is more stable.
            var sl = parseFloat(s.left), st = parseFloat(s.top);
            if(!isNaN(sl) && !isNaN(st)){
                l = sl, t = st;
            }else{
                // If child's computed left/top are not parseable as a number (e.g. "auto"), we
                // have no choice but to examine the parent's computed style.
                if(p && p.style){
                    var pcs = dom.getComputedStyle(p);
                    if(pcs.overflow != "visible"){
                        var be = _getBorderExtents(p, pcs);
                        l += be.l, t += be.t;
                    }
                }
            }
        }else if(browser.isOpera || (browser.isIE > 7 && !browser.isQuirks)){
            // On Opera and IE 8, offsetLeft/Top includes the parent's border
            if(p){
                be = _getBorderExtents(p);
                l -= be.l;
                t -= be.t;
            }
        }
        //>>excludeEnd("webkitMobile");
        return {
            l: l,
            t: t,
            w: node.offsetWidth + me.w,
            h: node.offsetHeight + me.h
        };
    }

    //TODO: unused function - remove?
    /*
    function _getMarginSize(node, computedStyle){
        // summary:
        //	returns an object that encodes the width and height of
        //	the node's margin box
        node = byId(node);
        var me = _getMarginExtents(node, computedStyle || dom.getComputedStyle(node)),
            size = node.getBoundingClientRect();
        return {
            w: (size.right - size.left) + me.w,
            h: (size.bottom - size.top) + me.h
        };
    }
    */

    function _getContentBox(node, computedStyle){
        // summary:
        //		Returns an object that encodes the width, height, left and top
        //		positions of the node's content box, irrespective of the
        //		current box model.

        // clientWidth/Height are important since the automatically account for scrollbars
        // fallback to offsetWidth/Height for special cases (see #3378)
        var s = computedStyle || dom.getComputedStyle(node),
            pe = _getPadExtents(node, s),
            be = _getBorderExtents(node, s),
            w = node.clientWidth, h;
        if(!w){
            w = node.offsetWidth, h = node.offsetHeight;
        }else{
            h = node.clientHeight, be.w = be.h = 0;
        }
        // On Opera, offsetLeft includes the parent's border
        //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
        if(browser.isOpera){ pe.l += be.l; pe.t += be.t; }
        //>>excludeEnd("webkitMobile");
        return {
            l: pe.l,
            t: pe.t,
            w: w - pe.w - be.w,
            h: h - pe.h - be.h
        };
    }

    //TODO: unused function - remove?
    /*
    function _getBorderBox(node, computedStyle){
        var s = computedStyle || dom.getComputedStyle(node),
            pe = _getPadExtents(node, s),
            cb = _getContentBox(node, s);
        return {
            l: cb.l - pe.l,
            t: cb.t - pe.t,
            w: cb.w + pe.w,
            h: cb.h + pe.h
        };
    }
    */

    // Box setters depend on box context because interpretation of width/height styles
    // vary wrt box context.
    //
    // The value of dojo.boxModel is used to determine box context.
    // dojo.boxModel can be set directly to change behavior.
    //
    // Beware of display: inline objects that have padding styles
    // because the user agent ignores padding (it's a bogus setup anyway)
    //
    // Be careful with IMGs because they are inline or block depending on
    // browser and browser mode.
    //
    // Elements other than DIV may have special quirks, like built-in
    // margins or padding, or values not detectable via computedStyle.
    // In particular, margins on TABLE do not seems to appear
    // at all in computedStyle on Mozilla.

    function _setBox(/*DomNode*/node, /*Number?*/l, /*Number?*/t, /*Number?*/w, /*Number?*/h, /*String?*/u){
        // summary:
        //		sets width/height/left/top in the current (native) box-model
        //		dimentions. Uses the unit passed in u.
        // node:
        //		DOM Node reference. Id string not supported for performance
        //		reasons.
        // l:
        //		left offset from parent.
        // t:
        //		top offset from parent.
        // w:
        //		width in current box model.
        // h:
        //		width in current box model.
        // u:
        //		unit measure to use for other measures. Defaults to "px".
        u = u || "px";
        var s = node.style;
        if(!isNaN(l)){ s.left = l + u; }
        if(!isNaN(t)){ s.top = t + u; }
        if(w >= 0){ s.width = w + u; }
        if(h >= 0){ s.height = h + u; }
    }

    function _isButtonTag(/*DomNode*/node){
        // summary:
        //		True if the node is BUTTON or INPUT.type="button".
        return node.tagName == "BUTTON"
            || node.tagName == "INPUT" && (node.getAttribute("type") || '').toUpperCase() == "BUTTON"; // boolean
    }

    function _usesBorderBox(/*DomNode*/node){
        // summary:
        //		True if the node uses border-box layout.

        // We could test the computed style of node to see if a particular box
        // has been specified, but there are details and we choose not to bother.

        // TABLE and BUTTON (and INPUT type=button) are always border-box by default.
        // If you have assigned a different box to either one via CSS then
        // box functions will break.

        var n = node.tagName;
        return boxModel == "border-box" || n == "TABLE" || _isButtonTag(node); // boolean
    }

    function _setContentSize(/*DomNode*/node, /*Number*/widthPx, /*Number*/heightPx, /*Object*/computedStyle){
        // summary:
        //		Sets the size of the node's contents, irrespective of margins,
        //		padding, or borders.
        if(_usesBorderBox(node)){
            var pb = _getPadBorderExtents(node, computedStyle);
            if(widthPx >= 0){ widthPx += pb.w; }
            if(heightPx >= 0){ heightPx += pb.h; }
        }
        _setBox(node, NaN, NaN, widthPx, heightPx);
    }

    function _setMarginBox(/*DomNode*/node, /*Number?*/leftPx, /*Number?*/topPx, /*Number?*/widthPx,
                            /*Number?*/heightPx, /*Object*/computedStyle){
        // summary:
        //		sets the size of the node's margin box and placement
        //		(left/top), irrespective of box model. Think of it as a
        //		passthrough to dojo._setBox that handles box-model vagaries for
        //		you.

        var s = computedStyle || dom.getComputedStyle(node),
        // Some elements have special padding, margin, and box-model settings.
        // To use box functions you may need to set padding, margin explicitly.
        // Controlling box-model is harder, in a pinch you might set dojo.boxModel.
            bb = _usesBorderBox(node),
            pb = bb ? _nilExtents : _getPadBorderExtents(node, s)
        ;
        if(browser.isWebKit){
            // on Safari (3.1.2), button nodes with no explicit size have a default margin
            // setting an explicit size eliminates the margin.
            // We have to swizzle the width to get correct margin reading.
            if(_isButtonTag(node)){
                var ns = node.style;
                if(widthPx >= 0 && !ns.width){ ns.width = "4px"; }
                if(heightPx >= 0 && !ns.height){ ns.height = "4px"; }
            }
        }
        var mb = _getMarginExtents(node, s);
        if(widthPx >= 0){ widthPx = Math.max(widthPx - pb.w - mb.w, 0); }
        if(heightPx >= 0){ heightPx = Math.max(heightPx - pb.h - mb.h, 0); }
        _setBox(node, leftPx, topPx, widthPx, heightPx);
    }

    var _nilExtents = { l:0, t:0, w:0, h:0 };

    // public API

    function marginBox(/*DomNode|String*/node, /*Object?*/box){
        // summary:
        //		Getter/setter for the margin-box of node.
        // description:
        //		Getter/setter for the margin-box of node.
        //		Returns an object in the expected format of box (regardless
        //		if box is passed). The object might look like:
        //			`{ l: 50, t: 200, w: 300: h: 150 }`
        //		for a node offset from its parent 50px to the left, 200px from
        //		the top with a margin width of 300px and a margin-height of
        //		150px.
        // node:
        //		id or reference to DOM Node to get/set box for
        // box:
        //		If passed, denotes that dojo.marginBox() should
        //		update/set the margin box for node. Box is an object in the
        //		above format. All properties are optional if passed.
        // example:
        //		Retrieve the marginbox of a passed node
        //	|	var box = dojo.marginBox("someNodeId");
        //	|	console.dir(box);
        //
        // example:
        //		Set a node's marginbox to the size of another node
        //	|	var box = dojo.marginBox("someNodeId");
        //	|	dojo.marginBox("someOtherNode", box);

        var n = dom.byId(node), s = dom.getComputedStyle(n);
        return !box ? _getMarginBox(n, s) : _setMarginBox(n, box.l, box.t, box.w, box.h, s); // Object
    }

    function contentBox(/*DomNode|String*/node, /*Object?*/box){
        // summary:
        //		Getter/setter for the content-box of node.
        // description:
        //		Returns an object in the expected format of box (regardless if box is passed).
        //		The object might look like:
        //			`{ l: 50, t: 200, w: 300: h: 150 }`
        //		for a node offset from its parent 50px to the left, 200px from
        //		the top with a content width of 300px and a content-height of
        //		150px. Note that the content box may have a much larger border
        //		or margin box, depending on the box model currently in use and
        //		CSS values set/inherited for node.
        //		While the getter will return top and left values, the
        //		setter only accepts setting the width and height.
        // node:
        //		id or reference to DOM Node to get/set box for
        // box:
        //		If passed, denotes that dojo.contentBox() should
        //		update/set the content box for node. Box is an object in the
        //		above format, but only w (width) and h (height) are supported.
        //		All properties are optional if passed.
        var n = dom.byId(node), s = dom.getComputedStyle(n);
        return !box ? _getContentBox(n, s) : _setContentSize(n, box.w, box.h, s); // Object
    }

    // =============================
    // Positioning
    // =============================

    //TODO: unused function - remove?
    /*
    function _sumAncestorProperties(node, prop){
        if(!(node = (node || 0).parentNode)){return 0}
        var val, retVal = 0, _b = win.body();
        while(node && node.style){
            if(dom.getComputedStyle(node).position == "fixed"){
                return 0;
            }
            val = node[prop];
            if(val){
                retVal += val - 0;
                // opera and khtml #body & #html has the same values, we only
                // need one value
                if(node == _b){ break; }
            }
            node = node.parentNode;
        }
        return retVal;	//	integer
    }
    */

    function _docScroll(){
        var n = win.global();
        return "pageXOffset" in n ? {x: n.pageXOffset, y: n.pageYOffset } :
            (n = browser.isQuirks? win.body() : win.doc().documentElement,
                {x: _fixIeBiDiScrollLeft(n.scrollLeft || 0), y: n.scrollTop || 0 });
    }

    function _isBodyLtr(){
        //TODO: we need to decide how where to keep _bodyLtr
        //return "_bodyLtr" in d ? d._bodyLtr :
        //        d._bodyLtr = (win.body().dir || win.doc().documentElement.dir || "ltr").toLowerCase() == "ltr"; // Boolean
        return (win.body().dir || win.doc().documentElement.dir || "ltr").toLowerCase() == "ltr"; // Boolean
    }

    //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
    function _getIeDocumentElementOffset(){
        // summary:
        //		returns the offset in x and y from the document body to the
        //		visual edge of the page
        // description:
        // The following values in IE contain an offset:
        //	|		event.clientX
        //	|		event.clientY
        //	|		node.getBoundingClientRect().left
        //	|		node.getBoundingClientRect().top
        //	 	But other position related values do not contain this offset,
        //	 	such as node.offsetLeft, node.offsetTop, node.style.left and
        //	 	node.style.top. The offset is always (2, 2) in LTR direction.
        //	 	When the body is in RTL direction, the offset counts the width
        //	 	of left scroll bar's width.  This function computes the actual
        //	 	offset.

        //NOTE: assumes we're being called in an IE browser

        var de = win.doc().documentElement; // only deal with HTML element here, position() handles body/quirks

        if(browser.isIE < 8){
            var r = de.getBoundingClientRect(), // works well for IE6+
                l = r.left, t = r.top;
            if(browser.isIE < 7){
                l += de.clientLeft;	// scrollbar size in strict/RTL, or,
                t += de.clientTop;	// HTML border size in strict
            }
            return {
                x: l < 0 ? 0 : l, // FRAME element border size can lead to inaccurate negative values
                y: t < 0 ? 0 : t
            };
        }else{
            return {
                x: 0,
                y: 0
            };
        }
    }
    //>>excludeEnd("webkitMobile");

    function _fixIeBiDiScrollLeft(/*Integer*/ scrollLeft){
        // In RTL direction, scrollLeft should be a negative value, but IE
        // returns a positive one. All codes using documentElement.scrollLeft
        // must call this function to fix this error, otherwise the position
        // will offset to right when there is a horizontal scrollbar.

        //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
        if(browser.isIE && !_isBodyLtr()){
            var de = browser.isQuirks ? win.body() : win.doc().documentElement;
            return (browser.isIE < 8 || browser.isQuirks) ? (scrollLeft + de.clientWidth - de.scrollWidth) : -scrollLeft; // Integer
        }
        //>>excludeEnd("webkitMobile");
        return scrollLeft; // Integer
    }

    // FIXME: need a setter for coords or a moveTo!!
    function position(/*DomNode*/node, /*Boolean?*/includeScroll){
        // summary:
        //		Gets the position and size of the passed element relative to
        //		the viewport (if includeScroll==false), or relative to the
        //		document root (if includeScroll==true).
        //
        // description:
        //		Returns an object of the form:
        //			{ x: 100, y: 300, w: 20, h: 15 }
        //		If includeScroll==true, the x and y values will include any
        //		document offsets that may affect the position relative to the
        //		viewport.
        //		Uses the border-box model (inclusive of border and padding but
        //		not margin).  Does not act as a setter.

        node = dom.byId(node);
        var	db = win.body(),
            dh = db.parentNode,
            ret = node.getBoundingClientRect();
        ret = {x: ret.left, y: ret.top, w: ret.right - ret.left, h: ret.bottom - ret.top};
        //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
        if(browser.isIE){
            // On IE there's a 2px offset that we need to adjust for, see _getIeDocumentElementOffset()
            var offset = _getIeDocumentElementOffset();

            // fixes the position in IE, quirks mode
            ret.x -= offset.x + (browser.isQuirks ? db.clientLeft + db.offsetLeft : 0);
            ret.y -= offset.y + (browser.isQuirks ? db.clientTop + db.offsetTop : 0);
        }else if(browser.isFF == 3){
            // In FF3 you have to subtract the document element margins.
            // Fixed in FF3.5 though.
            var cs = dom.getComputedStyle(dh), px = toPixel;
            ret.x -= px(dh, cs.marginLeft) + px(dh, cs.borderLeftWidth);
            ret.y -= px(dh, cs.marginTop) + px(dh, cs.borderTopWidth);
        }
        //>>excludeEnd("webkitMobile");
        // account for document scrolling
        // if offsetParent is used, ret value already includes scroll position
        // so we may have to actually remove that value if !includeScroll
        if(includeScroll){
            var scroll = _docScroll();
            ret.x += scroll.x;
            ret.y += scroll.y;
        }

        return ret; // Object
    }

    return {
        getBoxModel: getBoxModel,
        setBoxModel: setBoxModel,
        marginBox:   marginBox,
        contentBox:  contentBox,
        position:    position
    };
});
