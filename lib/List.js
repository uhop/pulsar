define(function(){

    // Multi-linked list: the foundation of events, promises, and AOP.

    function List(){
        this.prev = this.next = this;
    }

    List.prototype = {
        add: function(name, func){
            var node = {next: this};
	        this.prev.next = node;
            node[name || ""] = func;
	        if(name){
		        var n = "n_" + name, p = "p_" + name;
				node[n] = this;
				var t = this[p] || this;
				t[n] = node;
		        node[p] = t;
		        this[p] = node;
	        }
            var self = this;
            return function(){ self.remove(node, name); };
        },

        iterateFrom: function(from, name, next, inst, args){
            this.iterating = true;
            try{
                while(from !== this){
                    from[name].apply(inst, args);
                    if(!from.hasOwnProperty(name)){
                        remove(from, name);
                    }
                    from = from[next];
                }
            }catch(e){
                if(!(e instanceof Error)){
                    e = Error(e);
                }
                e._from = from;
                throw e;
            }finally{
                this.iterating = false;
            }
        },

        /*
        The next methods are trivial and should be inlined.

        iterate: function(name, next, inst, args){
            return this.iterateFrom(this[next], name, next, inst, args);
        },

        isEmpty: function(){
            return this === this.next;
        },

        hasName: function(name){
            return this.hasOwnName("n_" + name);
            // or: return this["n_" + name];
        },
        */

        find: function(from, next, name){
            while(from !== this){
                if(from.hasOwnProperty(name)){
                    return from;
                }
                from = from[next];
            }
            return null;
        },

        remove: function(node, name){
            if(this.iterating){
                delete node[name];
            }else{
                remove(node, name);
            }
        }
    };

    function remove(node, name){
        node.prev.next = node.next;
        node.next.prev = node.prev;
	    if(name){
			var n = "n_" + name, p = "p_" + name;
			node[p][n] = node[n];
			node[n][p] = node[p];
		}
    }

    return List;
});
