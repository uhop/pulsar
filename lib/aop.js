define(["./List"], function(List){

    // AOP: before, around, after advices. The latter receives a thrown error too.

	var context, stack = [];

    function getDispatcher(){
	    return function dispatcher(){
		    var advices = dispatcher.advices, befores = advices.p_before, afters = advices.n_after,
				isAround, thrown, ret;

		    // update context
		    if(context){
				stack.push(context);
		    }
		    context = {
			    instance:   this,
			    dispatcher: dispatcher,
			    depth:      stack.length,
				around:     advices.p_around
		    };

		    try{
			    // run before advices
			    if(befores && befores !== advices){
			        advices.iterateFrom(befores, "before", "p_before", this, arguments);
			    }

			    // run around advices
			    isAround = true;
			    ret = (advices.p_around && advices.p_around !== advices ? proceed : dispatcher.target).apply(this, arguments);
		    }catch(e){
			    thrown = true;
			    ret = e;
			    // run relevant after advices with error result
			    if(!isAround){
				    afters = advices.find(e._from, "next", "after");
			    }
		    }

		    try{
				// run after advices
				if(afters && afters !== advices){
					advices.iterateFrom(afters, "after", "n_after", this, [ret]);
				}
		    }finally{
			    context = stack.length ? stack.pop() : null;
		    }
		    
		    if(thrown){
			    throw ret;
		    }
		    return ret;
	    }
    }

	function unadvise(obj, name, dispatcher, h, cleanup){
		var advices = dispatcher.advices;
		h();
		if(cleanup && advices === advices.next){
			// remove the dispatcher
			obj[name] = dispatcher.target;
		}
	}

	function advise(style, obj, name, advice){
		var dispatcher = obj[name], a = dispatcher.advices;
		if(!a){
			var t = obj[name] = getDispatcher();
			t.target = dispatcher.target || dispatcher;
			t.targetName = name;
			dispatcher = t;
			a = t.advices = new List();
		}
		var h = a.add(style, advice);
		return {
			destroy: function(cleanup){ unadvise(obj, name, dispatcher, h, cleanup); }
		};
	}

	function proceed(){
		var dispatcher = context.dispatcher, advices = dispatcher.advices,
			t = dispatcher.target, c = context.around;
		if(c !== advices){
			context.around = c.p_around;
			t = c.around;
		}
		return t.apply(this.arguments);
	}

	return {
		advise:  advise,
		proceed: proceed,
		getContext: function(){ return context; },
		getStack: function(){ return stack; }
	};
});
