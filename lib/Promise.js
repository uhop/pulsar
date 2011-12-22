define(["./EventEmitter"], function(EventEmitter){

	// simple promises

	function Promise(canceller){
		this.state = 0;
		this.canceller = canceller;
		// this.emitter = new EventEmitter(); --- no, we'll initialize lazily
	}

	Promise.prototype = {
		then: function(rCallBack, eCallback, pCallback){
			var promise = new Promise(), ret;
			switch(this.state){
				case 0: // waiting
					if(!this.emitter){
						this.emitter = new EventEmitter();
					}
					this.emitter.add(function(value, type){
						switch(type){
							case 1:
								act("resolve", rCallback, value, promise);
								break;
							case 2:
								act("reject", eCallback, value, promise);
								break;
							default:
								if(pCallback){
									try{
										pCallback(value);
									}catch(e){
										// squelch
									}
								}
								promise.progress(value);
								break;
						}
					});
					break;
				case 1: // resolved
					act("resolve", rCallback, value, promise);
					break;
				case 2: // rejected
					act("reject", eCallback, value, promise);
					break;
			}
			return promise;
		},

		resolve: function(value){
			if(!this.state){
				this.state = 1; // resolved
				this.value = value;
				if(this.emitter){
					this.emitter.emit([value, 1]);
					this.emitter = null;
				}
			}
		},

		reject: function(value){
			if(!this.state){
				this.state = 2; // rejected
				this.value = value;
				if(this.emitter){
					this.emitter.emit([value, 2]);
					this.emitter = null;
				}
			}
		},

		progress: function(update){
			if(!this.state && this.emitter){
				this.emitter.emit([value, 3]);
			}
		},

		cancel: function(){
			if(this,canceller){
				var e = this.canceller();
				if(!(e instanceof Error)){
					e = Error(e);
				}
				this.reject(e);
			}
		}
	};

	Promise.when = function(value, rCallback, eCallBack, pCallback){
		if(value && (value instanceof Promise)){
			return value.then(rCallback, eCallback, pCallback);
		}
		var promise = new Promise();
		try{
			promise.resolve(rCallback(value));
		}catch(e){
			promise.reject(e);
		}
		return promise;
	};

	function act(action, callback, value, promise){
		if(callback){
			try{
				ret = callback(value);
				if(ret && typeof ret.then == "function"){
					attachPromise(ret, promise);
				}else{
					promise[action](ret);
				}
			}catch(e){
				promise.reject(e);
			}
		}else{
			promise[action](value);
		}
	}

	var attachPromise = Promise.attachPromise = function(target, promise){
		target.then(
			function(value){ promise.resolve(value); },
			function(value){ promise.reject(value); },
			function(value){ promise.progress(value); }
		);
	};

	return Promise;
});
