define(["./lang", "./browser", "./async", "./io-query", "./dom", "./dom-form"], function(lang, browser, async, ioq, dom, domForm){
    //TODO: we should do something with the configuration
    var debugFlag = false;

    //TODO: remove all dependencies on DOM => forms should be sent using helper functions

    // need to block async callbacks from snatching this thread as the result
    // of an async callback might call another sync XHR, this hangs khtml forever
    // must checked by watchInFlight()

    var _blockAsync = false;

    var contentHandlers = {
        // summary:
        //		A map of availble XHR transport handle types. Name matches the
        //		`handleAs` attribute passed to XHR calls.
        //
        // description:
        //		A map of availble XHR transport handle types. Name matches the
        //		`handleAs` attribute passed to XHR calls. Each contentHandler is
        //		called, passing the xhr object for manipulation. The return value
        //		from the contentHandler will be passed to the `load` or `handle`
        //		functions defined in the original xhr call.
        //
        // example:
        //		Creating a custom content-handler:
        //	|	dojo.contentHandlers.makeCaps = function(xhr){
        //	|		return xhr.responseText.toUpperCase();
        //	|	}
        //	|	// and later:
        //	|	dojo.xhrGet({
        //	|		url:"foo.txt",
        //	|		handleAs:"makeCaps",
        //	|		load: function(data){ /* data is a toUpper version of foo.txt */ }
        //	|	});

        text: function(xhr){
            // summary: A contentHandler which simply returns the plaintext response data
            return xhr.responseText;
        },
        json: function(xhr){
            // summary: A contentHandler which returns a JavaScript object created from the response data
            return JSON.parse(xhr.responseText || null);
        },
        "json-comment-filtered": function(xhr){
            // summary: A contentHandler which expects comment-filtered JSON.
            // description:
            //		A contentHandler which expects comment-filtered JSON.
            //		the json-comment-filtered option was implemented to prevent
            //		"JavaScript Hijacking", but it is less secure than standard JSON. Use
            //		standard JSON instead. JSON prefixing can be used to subvert hijacking.
            //
            //		Will throw a notice suggesting to use application/json mimetype, as
            //		json-commenting can introduce security issues. To decrease the chances of hijacking,
            //		use the standard `json` contentHandler, and prefix your "JSON" with: {}&&
            //
            //		use djConfig.useCommentedJson = true to turn off the notice

            var value = xhr.responseText;
            var cStartIdx = value.indexOf("\/*");
            var cEndIdx = value.lastIndexOf("*\/");
            if(cStartIdx == -1 || cEndIdx == -1){
                throw new Error("JSON was not comment filtered");
            }
            return JSON.parse(value.substring(cStartIdx+2, cEndIdx));
        },
        javascript: function(xhr){
            // summary: A contentHandler which evaluates the response data, expecting it to be valid JavaScript

            // FIXME: try Moz and IE specific eval variants?
            return eval(xhr.responseText);
        },
        xml: function(xhr){
            // summary: A contentHandler returning an XML Document parsed from the response data
            var result = xhr.responseXML;
            //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
            if(browser.isIE && (!result || !result.documentElement)){
                //WARNING: this branch used by the xml handling in dojo.io.iframe,
                //so be sure to test dojo.io.iframe if making changes below.
                var ms = function(n){ return "MSXML" + n + ".DOMDocument"; },
                    dp = ["Microsoft.XMLDOM", ms(6), ms(4), ms(3), ms(2)];
                //TODO: dp is a constant, do we need to try the whole list on every XML?
                for(var i = 0, l = dp.length; i < l; ++i){
                    try{
                        var dom = new ActiveXObject(dp[i]);
                        dom.async = false;
                        dom.loadXML(xhr.responseText);
                        result = dom;
                    }catch(e){ continue; }
                    break;
                }
            }
            //>>excludeEnd("webkitMobile");
            return result; // DOMDocument
        },
        "json-comment-optional": function(xhr){
            // summary: A contentHandler which checks the presence of comment-filtered JSON and
            //		alternates between the `json` and `json-comment-filtered` contentHandlers.
            if(xhr.responseText && /^[^{\[]*\/\*/.test(xhr.responseText)){
                return contentHandlers["json-comment-filtered"](xhr);
            }else{
                return contentHandlers["json"](xhr);
            }
        }
    };

    /*=====
    dojo.__IoArgs = function(){
        //	url: String
        //		URL to server endpoint.
        //	content: Object?
        //		Contains properties with string values. These
        //		properties will be serialized as name1=value2 and
        //		passed in the request.
        //	timeout: Integer?
        //		Milliseconds to wait for the response. If this time
        //		passes, the then error callbacks are called.
        //	form: DOMNode?
        //		DOM node for a form. Used to extract the form values
        //		and send to the server.
        //	preventCache: Boolean?
        //		Default is false. If true, then a
        //		"dojo.preventCache" parameter is sent in the request
        //		with a value that changes with each request
        //		(timestamp). Useful only with GET-type requests.
        //	handleAs: String?
        //		Acceptable values depend on the type of IO
        //		transport (see specific IO calls for more information).
        // 	rawBody: String?
        // 		Sets the raw body for an HTTP request. If this is used, then the content
        // 		property is ignored. This is mostly useful for HTTP methods that have
        // 		a body to their requests, like PUT or POST. This property can be used instead
        // 		of postData and putData for dojo.rawXhrPost and dojo.rawXhrPut respectively.
        //	ioPublish: Boolean?
        //		Set this explicitly to false to prevent publishing of topics related to
        // 		IO operations. Otherwise, if djConfig.ioPublish is set to true, topics
        // 		will be published via dojo.publish for different phases of an IO operation.
        // 		See dojo.__IoPublish for a list of topics that are published.
        //	load: Function?
        //		This function will be
        //		called on a successful HTTP response code.
        //	error: Function?
        //		This function will
        //		be called when the request fails due to a network or server error, the url
        //		is invalid, etc. It will also be called if the load or handle callback throws an
        //		exception, unless djConfig.debugAtAllCosts is true.  This allows deployed applications
        //		to continue to run even when a logic error happens in the callback, while making
        //		it easier to troubleshoot while in debug mode.
        //	handle: Function?
        //		This function will
        //		be called at the end of every request, whether or not an error occurs.
        this.url = url;
        this.content = content;
        this.timeout = timeout;
        this.form = form;
        this.preventCache = preventCache;
        this.handleAs = handleAs;
        this.ioPublish = ioPublish;
        this.load = function(response, ioArgs){
            // ioArgs: dojo.__IoCallbackArgs
            //		Provides additional information about the request.
            // response: Object
            //		The response in the format as defined with handleAs.
        }
        this.error = function(response, ioArgs){
            // ioArgs: dojo.__IoCallbackArgs
            //		Provides additional information about the request.
            // response: Object
            //		The response in the format as defined with handleAs.
        }
        this.handle = function(loadOrError, response, ioArgs){
            // loadOrError: String
            //		Provides a string that tells you whether this function
            //		was called because of success (load) or failure (error).
            // response: Object
            //		The response in the format as defined with handleAs.
            // ioArgs: dojo.__IoCallbackArgs
            //		Provides additional information about the request.
        }
    }
    =====*/

    /*=====
    dojo.__IoCallbackArgs = function(args, xhr, url, query, handleAs, id, canDelete, json){
        //	args: Object
        //		the original object argument to the IO call.
        //	xhr: XMLHttpRequest
        //		For XMLHttpRequest calls only, the
        //		XMLHttpRequest object that was used for the
        //		request.
        //	url: String
        //		The final URL used for the call. Many times it
        //		will be different than the original args.url
        //		value.
        //	query: String
        //		For non-GET requests, the
        //		name1=value1&name2=value2 parameters sent up in
        //		the request.
        //	handleAs: String
        //		The final indicator on how the response will be
        //		handled.
        //	id: String
        //		For dojo.io.script calls only, the internal
        //		script ID used for the request.
        //	canDelete: Boolean
        //		For dojo.io.script calls only, indicates
        //		whether the script tag that represents the
        //		request can be deleted after callbacks have
        //		been called. Used internally to know when
        //		cleanup can happen on JSONP-type requests.
        //	json: Object
        //		For dojo.io.script calls only: holds the JSON
        //		response for JSONP-type requests. Used
        //		internally to hold on to the JSON responses.
        //		You should not need to access it directly --
        //		the same object should be passed to the success
        //		callbacks directly.
        this.args = args;
        this.xhr = xhr;
        this.url = url;
        this.query = query;
        this.handleAs = handleAs;
        this.id = id;
        this.canDelete = canDelete;
        this.json = json;
    }
    =====*/


    /*=====
    dojo.__IoPublish = function(){
        // 	summary:
        // 		This is a list of IO topics that can be published
        // 		if djConfig.ioPublish is set to true. IO topics can be
        // 		published for any Input/Output, network operation. So,
        // 		dojo.xhr, dojo.io.script and dojo.io.iframe can all
        // 		trigger these topics to be published.
        //	start: String
        //		"/dojo/io/start" is sent when there are no outstanding IO
        // 		requests, and a new IO request is started. No arguments
        // 		are passed with this topic.
        //	send: String
        //		"/dojo/io/send" is sent whenever a new IO request is started.
        // 		It passes the dojo.Deferred for the request with the topic.
        //	load: String
        //		"/dojo/io/load" is sent whenever an IO request has loaded
        // 		successfully. It passes the response and the dojo.Deferred
        // 		for the request with the topic.
        //	error: String
        //		"/dojo/io/error" is sent whenever an IO request has errored.
        // 		It passes the error and the dojo.Deferred
        // 		for the request with the topic.
        //	done: String
        //		"/dojo/io/done" is sent whenever an IO request has completed,
        // 		either by loading or by erroring. It passes the error and
        // 		the dojo.Deferred for the request with the topic.
        //	stop: String
        //		"/dojo/io/stop" is sent when all outstanding IO requests have
        // 		finished. No arguments are passed with this topic.
        this.start = "/dojo/io/start";
        this.send = "/dojo/io/send";
        this.load = "/dojo/io/load";
        this.error = "/dojo/io/error";
        this.done = "/dojo/io/done";
        this.stop = "/dojo/io/stop";
    }
    =====*/


    function _ioSetArgs(/*dojo.__IoArgs*/args,
            /*Function*/canceller,
            /*Function*/okHandler,
            /*Function*/errHandler){
        //	summary:
        //		sets up the Deferred and ioArgs property on the Deferred so it
        //		can be used in an io call.
        //	args:
        //		The args object passed into the public io call. Recognized properties on
        //		the args object are:
        //	canceller:
        //		The canceller function used for the Deferred object. The function
        //		will receive one argument, the Deferred object that is related to the
        //		canceller.
        //	okHandler:
        //		The first OK callback to be registered with Deferred. It has the opportunity
        //		to transform the OK response. It will receive one argument -- the Deferred
        //		object returned from this function.
        //	errHandler:
        //		The first error callback to be registered with Deferred. It has the opportunity
        //		to do cleanup on an error. It will receive two arguments: error (the
        //		Error object) and dfd, the Deferred object returned from this function.

        var ioArgs = {args: args, url: args.url};

        //Get values from form if requested.
        var formObject = null;
        if(args.form){
            var form = dom.byId(args.form);
            //IE requires going through getAttributeNode instead of just getAttribute in some form cases,
            //so use it for all.  See #2844
            var actnNode = form.getAttributeNode("action");
            ioArgs.url = ioArgs.url || (actnNode ? actnNode.value : null);
            formObject = domForm.formToObject(form);
        }

        // set up the query params
        var miArgs = [{}];

        if(formObject){
            // potentially over-ride url-provided params w/ form values
            miArgs.push(formObject);
        }
        if(args.content){
            // stuff in content over-rides what's set by form
            miArgs.push(args.content);
        }
        if(args.preventCache){
            miArgs.push({"dojo.preventCache": new Date().valueOf()});
        }
        ioArgs.query = ioq.objectToQuery(lang.mixins.apply(null, miArgs));

        // .. and the real work of getting the deferred in order, etc.
        ioArgs.handleAs = args.handleAs || "text";
        var d = new async.Deferred(canceller).addCallbacks(okHandler, function(error){
                return errHandler(error, d);
            });

        //Support specifying load, error and handle callback functions from the args.
        //For those callbacks, the "this" object will be the args object.
        //The callbacks will get the deferred result value as the
        //first argument and the ioArgs object as the second argument.
        var ld = args.load;
        if(ld && lang.isFunction(ld)){
            d.addCallback(function(value){
                return ld.call(args, value, ioArgs);
            });
        }
        var err = args.error;
        if(err && lang.isFunction(err)){
            d.addErrback(function(value){
                return err.call(args, value, ioArgs);
            });
        }
        var handle = args.handle;
        if(handle && lang.isFunction(handle)){
            d.addBoth(function(value){
                return handle.call(args, value, ioArgs);
            });
        }

        //TODO: deal with pubsub
        //Plug in topic publishing, if dojo.publish is loaded.
        /*
        if(cfg.ioPublish && _d.publish && ioArgs.args.ioPublish !== false){
            d.addCallbacks(
                function(res){
                    _d.publish("/dojo/io/load", [d, res]);
                    return res;
                },
                function(res){
                    _d.publish("/dojo/io/error", [d, res]);
                    return res;
                }
            ).addBoth(function(res){
                _d.publish("/dojo/io/done", [d, res]);
                return res;
            });
        }
        */

        d.ioArgs = ioArgs;

        // FIXME: need to wire up the xhr object's abort method to something
        // analagous in the Deferred
        return d;
    }

    function _deferredCancel(/*Deferred*/dfd){
        // summary: canceller function for dojo._ioSetArgs call.

        dfd.canceled = true;
        var xhr = dfd.ioArgs.xhr, _at = typeof xhr.abort;
        if(_at == "function" || _at == "object" || _at == "unknown"){
            xhr.abort();
        }
        var err = dfd.ioArgs.error;
        if(!err){
            err = new Error("xhr cancelled");
            err.dojoType="cancel";
        }
        return err;
    }
    function _deferredOk(/*Deferred*/dfd){
        // summary: okHandler function for dojo._ioSetArgs call.
        return contentHandlers[dfd.ioArgs.handleAs](dfd.ioArgs.xhr) || null;
    }
    function _deferError(/*Error*/error, /*Deferred*/dfd){
        // summary: errHandler function for dojo._ioSetArgs call.
        if(!dfd.ioArgs.args.failOk){
            console.error(error);
        }
        return error;
    }

    // avoid setting a timer per request. It degrades performance on IE
    // something fierece if we don't use unified loops.
    var _inFlightIntvl = null;
    var _inFlight = [];


    //Use a separate count for knowing if we are starting/stopping io calls.
    //Cannot use _inFlight.length since it can change at a different time than
    //when we want to do this kind of test. We only want to decrement the count
    //after a callback/errback has finished, since the callback/errback should be
    //considered as part of finishing a request.
    var _pubCount = 0;
    function _checkPubCount(dfd){
        if(_pubCount <= 0){
            _pubCount = 0;
            //TODO: deal with pubsub
            /*
            if(cfg.ioPublish && _d.publish && (!dfd || dfd && dfd.ioArgs.args.ioPublish !== false)){
                _d.publish("/dojo/io/stop");
            }
            */
        }
    }

    function _watchInFlight(){
        //summary:
        //		internal method that checks each inflight XMLHttpRequest to see
        //		if it has completed or if the timeout situation applies.

        var now = new Date().getTime();
        // make sure sync calls stay thread safe, if this callback is called
        // during a sync call and this results in another sync call before the
        // first sync call ends the browser hangs
        if(!_blockAsync){
            // we need manual loop because we often modify _inFlight (and therefore 'i') while iterating
            // note: the second clause is an assigment on purpose, lint may complain
            for(var i = 0, tif; i < _inFlight.length && (tif = _inFlight[i]); i++){
                var dfd = tif.dfd;
                var func = function(){
                    if(!dfd || dfd.canceled || !tif.validCheck(dfd)){
                        _inFlight.splice(i--, 1);
                        _pubCount -= 1;
                    }else if(tif.ioCheck(dfd)){
                        _inFlight.splice(i--, 1);
                        tif.resHandle(dfd);
                        _pubCount -= 1;
                    }else if(dfd.startTime){
                        //did we timeout?
                        if(dfd.startTime + (dfd.ioArgs.args.timeout || 0) < now){
                            _inFlight.splice(i--, 1);
                            var err = new Error("timeout exceeded");
                            err.dojoType = "timeout";
                            dfd.errback(err);
                            //Cancel the request so the io module can do appropriate cleanup.
                            dfd.cancel();
                            _pubCount -= 1;
                        }
                    }
                };
                if(debugFlag){
                    func.call(this);
                }else{
                    try{
                        func.call(this);
                    }catch(e){
                        dfd.errback(e);
                    }
                }
            }
        }

        _checkPubCount(dfd);

        if(!_inFlight.length){
            clearInterval(_inFlightIntvl);
            _inFlightIntvl = null;
            //return;
        }
    }

    function _ioCancelAll(){
        //summary: Cancels all pending IO requests, regardless of IO type
        //(xhr, script, iframe).
        try{
            for(var i = 0, l = _inFlight.length; i < l; ++i){
                try{
                    _inFlight[i].dfd.cancel();
                }catch(e){/*squelch*/}
            }
        }catch(e){/*squelch*/}
    }

    //Automatically call cancel all io calls on unload
    //in IE for trac issue #2357.
    //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
    if(browser.isIE){
        //TODO: deal with IE later
        //_d.addOnWindowUnload(_d._ioCancelAll);
    }
    //>>excludeEnd("webkitMobile");

    function _ioNotifyStart(/*Deferred*/dfd){
        // summary:
        // 		If dojo.publish is available, publish topics
        // 		about the start of a request queue and/or the
        // 		the beginning of request.
        // description:
        // 		Used by IO transports. An IO transport should
        // 		call this method before making the network connection.
        //TODO: deal with pubsub later
        /*
        if(cfg.ioPublish && _d.publish && dfd.ioArgs.args.ioPublish !== false){
            if(!_pubCount){
                _d.publish("/dojo/io/start");
            }
            _pubCount += 1;
            _d.publish("/dojo/io/send", [dfd]);
        }
        */
    }

    function _ioWatch(dfd, validCheck, ioCheck, resHandle){
        // summary:
        //		Watches the io request represented by dfd to see if it completes.
        // dfd: Deferred
        //		The Deferred object to watch.
        // validCheck: Function
        //		Function used to check if the IO request is still valid. Gets the dfd
        //		object as its only argument.
        // ioCheck: Function
        //		Function used to check if basic IO call worked. Gets the dfd
        //		object as its only argument.
        // resHandle: Function
        //		Function used to process response. Gets the dfd
        //		object as its only argument.
        var args = dfd.ioArgs.args;
        if(args.timeout){
            dfd.startTime = (new Date()).getTime();
        }

        _inFlight.push({dfd: dfd, validCheck: validCheck, ioCheck: ioCheck, resHandle: resHandle});
        if(!_inFlightIntvl){
            _inFlightIntvl = setInterval(_watchInFlight, 50);
        }
        // handle sync requests
        //A weakness: async calls in flight
        //could have their handlers called as part of the
        //_watchInFlight call, before the sync's callbacks
        // are called.
        if(args.sync){
            _watchInFlight();
        }
    }

    var _defaultContentType = "application/x-www-form-urlencoded";

    function _validCheck(/*Deferred*/dfd){
        return dfd.ioArgs.xhr.readyState; //boolean
    }
    function _ioCheck(/*Deferred*/dfd){
        return 4 == dfd.ioArgs.xhr.readyState; //boolean
    }
    function _isDocumentOk(http){
        var stat = http.status || 0;
        return (stat >= 200 && stat < 300) || 	// Boolean
            stat == 304 ||			// allow any 2XX response code
            stat == 1223 ||			// get it out of the cache
                            // Internet Explorer mangled the status code
            !stat; // OR we're Titanium/browser chrome/chrome extension requesting a local file
    }
    function _resHandle(/*Deferred*/dfd){
        var xhr = dfd.ioArgs.xhr;
        if(_isDocumentOk(xhr)){
            dfd.callback(dfd);
        }else{
            var err = new Error("Unable to load " + dfd.ioArgs.url + " status:" + xhr.status);
            err.status = xhr.status;
            err.responseText = xhr.responseText;
            dfd.errback(err);
        }
    }

    function _ioAddQueryToUrl(/*dojo.__IoCallbackArgs*/ioArgs){
        //summary: Adds query params discovered by the io deferred construction to the URL.
        //Only use this for operations which are fundamentally GET-type operations.
        if(ioArgs.query.length){
            ioArgs.url += (ioArgs.url.indexOf("?") == -1 ? "?" : "&") + ioArgs.query;
            ioArgs.query = null;
        }
    }

    /*=====
    dojo.declare("dojo.__XhrArgs", dojo.__IoArgs, {
        constructor: function(){
            //	summary:
            //		In addition to the properties listed for the dojo._IoArgs type,
            //		the following properties are allowed for dojo.xhr* methods.
            //	handleAs: String?
            //		Acceptable values are: text (default), json, json-comment-optional,
            //		json-comment-filtered, javascript, xml. See `dojo.contentHandlers`
            //	sync: Boolean?
            //		false is default. Indicates whether the request should
            //		be a synchronous (blocking) request.
            //	headers: Object?
            //		Additional HTTP headers to send in the request.
            //	failOk: Boolean?
            //		false is default. Indicates whether a request should be
            //		allowed to fail (and therefore no console error message in
            //		the event of a failure)
            this.handleAs = handleAs;
            this.sync = sync;
            this.headers = headers;
            this.failOk = failOk;
        }
    });
    =====*/

    var _XMLHTTP_PROGIDS = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'];

    function _xhrObj(){
        // summary:
        //		does the work of portably generating a new XMLHTTPRequest object.
        var http, last_e;
        //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
        if(!browser.isIE){
        //>>excludeEnd("webkitMobile");
            try{ http = new XMLHttpRequest(); }catch(e){}
        //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
        }
        if(!http){
            for(var i = 0, l = _XMLHTTP_PROGIDS.length; i < l; ++i){
                var progid = _XMLHTTP_PROGIDS[i];
                try{
                    http = new ActiveXObject(progid);
                }catch(e){
                    last_e = e;
                }
                if(http){
                    _XMLHTTP_PROGIDS = [progid];  // so faster next time
                    break;
                }
            }
        }
        //>>excludeEnd("webkitMobile");
        if(!http){
            throw new Error("XMLHTTP not available: "+last_e);
        }
        return http; // XMLHTTPRequest instance
    }

    function xhr(/*String*/ method, /*dojo.__XhrArgs*/ args, /*Boolean?*/ hasBody){
        //	summary:
        //		Sends an HTTP request with the given method.
        //	description:
        //		Sends an HTTP request with the given method.
        //		See also dojo.xhrGet(), xhrPost(), xhrPut() and dojo.xhrDelete() for shortcuts
        //		for those HTTP methods. There are also methods for "raw" PUT and POST methods
        //		via dojo.rawXhrPut() and dojo.rawXhrPost() respectively.
        //	method:
        //		HTTP method to be used, such as GET, POST, PUT, DELETE.  Should be uppercase.
        //	hasBody:
        //		If the request has an HTTP body, then pass true for hasBody.

        //Make the Deferred object for this xhr request.
        var dfd = _ioSetArgs(args, _deferredCancel, _deferredOk, _deferError);
        var ioArgs = dfd.ioArgs;

        //Pass the args to _xhrObj, to allow alternate XHR calls based specific calls, like
        //the one used for iframe proxies.
        var xhr = ioArgs.xhr = _xhrObj(ioArgs.args);
        //If XHR factory fails, cancel the deferred.
        if(!xhr){
            dfd.cancel();
            return dfd;
        }

        //Allow for specifying the HTTP body completely.
        if("postData" in args){
            ioArgs.query = args.postData;
        }else if("putData" in args){
            ioArgs.query = args.putData;
        }else if("rawBody" in args){
            ioArgs.query = args.rawBody;
        }else if((arguments.length > 2 && !hasBody) || "POST|PUT".indexOf(method.toUpperCase()) == -1){
            //Check for hasBody being passed. If no hasBody,
            //then only append query string if not a POST or PUT request.
            _ioAddQueryToUrl(ioArgs);
        }

        // IE 6 is a steaming pile. It won't let you call apply() on the native function (xhr.open).
        // workaround for IE6's apply() "issues"
        xhr.open(method, ioArgs.url, args.sync !== true, args.user || undefined, args.password || undefined);
        if(args.headers){
            for(var hdr in args.headers){
                if(hdr.toLowerCase() === "content-type" && !args.contentType){
                    args.contentType = args.headers[hdr];
                }else if(args.headers[hdr]){
                    //Only add header if it has a value. This allows for instnace, skipping
                    //insertion of X-Requested-With by specifying empty value.
                    xhr.setRequestHeader(hdr, args.headers[hdr]);
                }
            }
        }
        // FIXME: is this appropriate for all content types?
        xhr.setRequestHeader("Content-Type", args.contentType || _defaultContentType);
        if(!args.headers || !("X-Requested-With" in args.headers)){
            xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        }
        // FIXME: set other headers here!
        _ioNotifyStart(dfd);
        if(debugFlag){
            xhr.send(ioArgs.query);
        }else{
            try{
                xhr.send(ioArgs.query);
            }catch(e){
                ioArgs.error = e;
                dfd.cancel();
            }
        }
        _ioWatch(dfd, _validCheck, _ioCheck, _resHandle);
        xhr = null;
        return dfd; // dojo.Deferred
    }

    function xhrGet(/*dojo.__XhrArgs*/ args){
        //	summary:
        //		Sends an HTTP GET request to the server.
        return xhr("GET", args); // dojo.Deferred
    }

    function xhrPost(/*dojo.__XhrArgs*/ args){
        //	summary:
        //		Sends an HTTP POST request to the server. In addtion to the properties
        //		listed for the dojo.__XhrArgs type, the following property is allowed:
        //	postData:
        //		String. Send raw data in the body of the POST request.
        return xhr("POST", args, true); // dojo.Deferred
    }

    function xhrPut(/*dojo.__XhrArgs*/ args){
        //	summary:
        //		Sends an HTTP PUT request to the server. In addtion to the properties
        //		listed for the dojo.__XhrArgs type, the following property is allowed:
        //	putData:
        //		String. Send raw data in the body of the PUT request.
        return xhr("PUT", args, true); // dojo.Deferred
    }

    function xhrDelete(/*dojo.__XhrArgs*/ args){
        //	summary:
        //		Sends an HTTP DELETE request to the server.
        return xhr("DELETE", args); //dojo.Deferred
    }

    return {
        contentHandlers: contentHandlers,
        xhr:       xhr,
        xhrGet:    xhrGet,
        xhrPost:   xhrPost,
        xhrPut:    xhrPut,
        xhrDelete: xhrDelete
    };
});
