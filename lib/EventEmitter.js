define(["./List"], function(List){

	// event emitter

	function EventEmitter(){
		this.list = new List();
	}

	EventEmitter.prototype = {
		/*
        The next methods are trivial and should be inlined.

        isEmpty: function(){
            return this === this.next;
        },
		*/

		add: function(callback){
			return {
				destroy: this.list.add("", callback)
			};
		},

		emit: function(args){
			var list = this.list, from = list.p_cb;
			while(true){
				try{
					if(from && from !== list){
						list.iterateFrom(from, "", "prev", this, args);
					}
					break;
				}catch(e){
					from = e._from.prev;
				}
			}
		}
	};

	return EventEmitter;
});
