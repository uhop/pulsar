define(["./EventEmitter"], function(EventEmitter){

	// topics pub/sub

	var topics = {};

	function subscribe(name, callback){
		var t = topics[name];
		if(!t){
			t = topics[name] = new EventEmitter();
		}
		var h = t.add(callback);
		return {
			destroy: function(cleanup){
				h.destroy();
				if(cleanup && t.list === t.list.next){
					delete topics[name];
				}
			}
		};
	}

	function publish(name, args){
		var t = topics[name];
		if(t){
			t.emit(args);
		}
	}

	return {
		subscribe: subscribe,
		publish:   publish
	};
});