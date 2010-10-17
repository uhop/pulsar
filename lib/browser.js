define(function(){
    //TODO: do we need browser sniffing in the base?
    //TODO: remove old browser detection code.

/*=====
dojo.isFF = {
	//	example:
	//	|	if(dojo.isFF > 1){ ... }
};

dojo.isIE = {
	// example:
	//	|	if(dojo.isIE > 6){
	//	|		// we are IE7
	// 	|	}
};

dojo.isSafari = {
	//	example:
	//	|	if(dojo.isSafari){ ... }
	//	example:
	//		Detect iPhone:
	//	|	if(dojo.isSafari && navigator.userAgent.indexOf("iPhone") != -1){
	//	|		// we are iPhone. Note, iPod touch reports "iPod" above and fails this test.
	//	|	}
};

dojo = {
	//	isFF: Number | undefined
	//		Version as a Number if client is FireFox. undefined otherwise. Corresponds to
	//		major detected FireFox version (1.5, 2, 3, etc.)
	isFF: 2,
	//	isIE: Number | undefined
	//		Version as a Number if client is MSIE(PC). undefined otherwise. Corresponds to
	//		major detected IE version (6, 7, 8, etc.)
	isIE: 6,
	//	isKhtml: Number | undefined
	//		Version as a Number if client is a KHTML browser. undefined otherwise. Corresponds to major
	//		detected version.
	isKhtml: 0,
	//	isWebKit: Number | undefined
	//		Version as a Number if client is a WebKit-derived browser (Konqueror,
	//		Safari, Chrome, etc.). undefined otherwise.
	isWebKit: 0,
	//	isMozilla: Number | undefined
	//		Version as a Number if client is a Mozilla-based browser (Firefox,
	//		SeaMonkey). undefined otherwise. Corresponds to major detected version.
	isMozilla: 0,
	//	isOpera: Number | undefined
	//		Version as a Number if client is Opera. undefined otherwise. Corresponds to
	//		major detected version.
	isOpera: 0,
	//	isSafari: Number | undefined
	//		Version as a Number if client is Safari or iPhone. undefined otherwise.
	isSafari: 0,
	//	isChrome: Number | undefined
	//		Version as a Number if client is Chrome browser. undefined otherwise.
	isChrome: 0
	//	isMac: Boolean
	//		True if the client runs on Mac
}
=====*/

    // fill in the rendering support information in dojo.render.*
    var n = navigator, dua = n.userAgent, dav = n.appVersion, tv = parseFloat(dav), browser = {};

    if(dua.indexOf("Opera") >= 0){ browser.isOpera = tv; }
    if(dua.indexOf("AdobeAIR") >= 0){ browser.isAIR = 1; }
    browser.isKhtml = dav.indexOf("Konqueror") >= 0 ? tv : 0;
    browser.isWebKit = parseFloat(dua.split("WebKit/")[1]) || undefined;
    browser.isChrome = parseFloat(dua.split("Chrome/")[1]) || undefined;
    browser.isMac = dav.indexOf("Macintosh") >= 0;

    // safari detection derived from:
    //		http://developer.apple.com/internet/safari/faq.html#anchor2
    //		http://developer.apple.com/internet/safari/uamatrix.html
    var index = Math.max(dav.indexOf("WebKit"), dav.indexOf("Safari"), 0);
    if(index && !browser.isChrome){
        // try to grab the explicit Safari version first. If we don't get
        // one, look for less than 419.3 as the indication that we're on something
        // "Safari 2-ish".
        browser.isSafari = parseFloat(dav.split("Version/")[1]);
        if(!browser.isSafari || parseFloat(dav.substr(index + 7)) <= 419.3){
            browser.isSafari = 2;
        }
    }

    //>>excludeStart("webkitMobile", kwArgs.webkitMobile);
    if(dua.indexOf("Gecko") >= 0 && !browser.isKhtml && !browser.isWebKit){ browser.isMozilla = browser.isMoz = tv; }
    if(browser.isMoz){
        //We really need to get away from this. Consider a sane isGecko approach for the future.
        browser.isFF = parseFloat(dua.split("Firefox/")[1] || dua.split("Minefield/")[1]) || undefined;
    }
    if(document.all && !browser.isOpera){
        browser.isIE = parseFloat(dav.split("MSIE ")[1]) || undefined;
        //In cases where the page has an HTTP header or META tag with
        //X-UA-Compatible, then it is in emulation mode.
        //Make sure isIE reflects the desired version.
        //document.documentMode of 5 means quirks mode.
        //Only switch the value if documentMode's major version
        //is different from isIE's major version.
        var mode = document.documentMode;
        if(mode && mode != 5 && Math.floor(browser.isIE) != mode){
            browser.isIE = mode;
        }
    }

    browser.isQuirks = document.compatMode == "BackCompat";

    // TODO: is the HTML LANG attribute relevant?
    browser.locale = (browser.isIE ? n.userLanguage : n.language).toLowerCase();

    return browser;
});
