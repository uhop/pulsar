define([
    // platform-neutral modules
    "lang",
    // additional platform-neutral modules
    "color",
    // browser-specific modules
    "window", "dom", "dom-class"
], function(lang, color, window, dom, domClass){
    var dojo = {
        version: {
            major: 2, minor: 0, patch: 0, flag: "dev", revision: 0,
            toString: function(){
                return dojo.version.major + "." + dojo.version.minor + "." + dojo.version.patch +
                    dojo.version.flag + " (" + dojo.version.revision + ")";	// String
            }
        }
    };
    // mix all modules in one namespace and return
    return lang.mixins.apply(this, [dojo].concat(Array.prototype.slice.call(arguments, 0)));
});
