function bench(delay, limit){
	// delay - pause between tests in ms
	// limit - the lower limit of a test in ms
	
	
	// functional helpers

	var nothing = new Function();
	
	function wrap(fn /*...*/){
		var args = Array.prototype.slice.call(arguments, 1);
		return function(){
			return fn.apply(this, args);
		};
	}
	
	function curry(fn /*...*/){
		var args = Array.prototype.slice.call(arguments, 1);
		return function(){
			return fn.apply(this, args.concat(Array.prototype.slice.call(arguments)));
		};
	}

	function bind(fn, obj){
		if(Object.prototype.toString.call(fn) == "[object Function]"){
			return function(){
				return fn.apply(obj, arguments);
			};
		}
		return function(){
			return obj[fn].apply(obj, arguments);
		}
	}

	// array helpers
	
	var forEach = Array.prototype.forEach ?
		function(array, fn, obj){
			if(arguments.length < 3){
				array.forEach(fn);
			}else{
				array.forEach(fn, obj);
			}
		}
		:
		function(array, fn, obj){
			var l = array.length, i = 0;
			if(arguments.length < 3){
				for(; i < l; ++i){
					fn(array[i], i, array);
				}
			}else{
				for(; i < l; ++i){
					fn.call(obj, array[i], i, array);
				}
			}
		};
	
	var map = Array.prototype.map ?
		function(array, fn, obj){
			return arguments.length < 3 ? array.map(fn) : array.map(fn, obj);
		}
		:
		function(array, fn, obj){
			var l = array.length, r = new Array(l), i = 0;
			if(arguments.length < 3){
				for(; i < l; ++i){
					r[i] = fn(array[i], i, array);
				}
			}else{
				for(; i < l; ++i){
					r[i] = fn.call(obj, array[i], i, array);
				}
			}
			return r;
		};

	// DOM helpers
	
	var place = function(){
		var div = null;
		return function(html, node){
			if(!div){
				div = document.createElement("div");
			}
			div.innerHTML = html;
			node.appendChild(div.firstChild);
		};
	}();
	
	// statistics

	var statNames = ["minimum", "firstDecile", "lowerQuartile", "median", "upperQuartile", "lastDecile", "maximum", "average"];

	var statAbbr = {
		minimum:        "min",
		maximum:        "max",
		median:         "med",
		lowerQuartile:  "25%",
		upperQuartile:  "75%",
		firstDecile:    "10%",
		lastDecile:     "90%",
		average:        "avg"
	};

	function getPercentile(sortedData, value){
		var lowerIndex = 0, upperIndex = sortedData.length - 1;
		while(lowerIndex < upperIndex){
			var middleIndex = Math.floor((lowerIndex + upperIndex) / 2);
			if(sortedData[middleIndex] < value){
				lowerIndex = middleIndex + 1;
			}else{
				upperIndex = middleIndex;
			}
		}
		return lowerIndex < sortedData.length && value < sortedData[lowerIndex] ?
			lowerIndex : (lowerIndex + 1);
	};

	function getWeightedValue(sortedData, weight){
		var pos = weight * (sortedData.length - 1),
			upperIndex = Math.ceil(pos),
			lowerIndex = upperIndex - 1;
		if(lowerIndex <= 0){
			// return first element
			return sortedData[0];
		}
		if(upperIndex >= sortedData.length){
			// return last element
			return sortedData[sortedData.length - 1];
		}
		// linear approximation
		return sortedData[lowerIndex] * (upperIndex - pos) + sortedData[upperIndex] * (pos - lowerIndex);
	};

	function getStats(rawData, repetitions){
		var sortedData = rawData.slice(0).sort(function(a, b){ return a - b; }),
			result = {
				rawData:       rawData,
				repetitions:   repetitions,
				sortedData:    sortedData,
				// the five-number summary
				minimum:       sortedData[0],
				maximum:       sortedData[sortedData.length - 1],
				median:        getWeightedValue(sortedData, 0.5),
				lowerQuartile: getWeightedValue(sortedData, 0.25),
				upperQuartile: getWeightedValue(sortedData, 0.75),
				// extended to the Bowley's seven-figure summary
				firstDecile:   getWeightedValue(sortedData, 0.1),
				lastDecile:    getWeightedValue(sortedData, 0.9)
			};
		// add the average
		for(var i = 0, sum = 0; i < sortedData.length; sum += sortedData[i++]);
		result.average = sum / sortedData.length;
		// normalize results
		forEach(statNames, function(name){
			if(result.hasOwnProperty(name) && typeof result[name] == "number"){
				result[name] /= repetitions;
			}
		});
		return result;
	};
	
	// test harness

	// the basic unit to run a test with timing
	function runTest(f, n){
		var start = new Date();
		for(var i = 0; i < n; ++i){
			f();
		}
		var end = new Date();
		return end.getTime() - start.getTime();
	};

	// find the threshold number of tests just exceeding the limit
	function findThreshold(f, limit){
		// very simplistic search probing only powers of two
		var n = 1;
		while(runTest(f, n) + runTest(nothing, n) < limit) n <<= 1;
		return n;
	};

	function runUnitTest(a, f, n, k, m, next){
		a[k++] = runTest(f, n) - runTest(nothing, n);
		if(k < m){
			setTimeout(wrap(runUnitTest, a, f, n, k, m, next), delay);
		}else{
			next(a);
		}
	};

	function runUnits(test, n, m, next){
		var a = new Array(m);
		runUnitTest(a, test, n, 0, m, next);
	};

	// run a group of tests, prepare statistics and show results

	function clear(){
		this.unitGroups = [];
		this.unitDict   = {};
		this.statDict   = {};
		this.groupIndex = -1;
	}
	
	function register(groupName, units){
		if(arguments.length < 2){
			units = groupName;
			groupName = "";
		}
		groupName = groupName || "Default group";
		if(Object.prototype.toString.call(units) != "[object Array]"){
			units = [units];
		}
		if(this.unitDict.hasOwnProperty(groupName)){
			this.unitDict[groupName] = this.unitDict[groupName].concat(units);
		}else{
			this.unitGroups.push(groupName);
			this.unitDict[groupName] = units.slice(0);
		}
	};
		
	function runGroup(groupName, repetitions, node){
		var units = this.unitDict[groupName], stats = [];
		
		// find a threshold
		var threshold = Infinity;
		forEach(units, function(unit){
			threshold = Math.min(threshold, findThreshold(unit.test, limit));
		});
		
		function process(rawData){
			if(rawData){
				var unit = units[stats.length];
				// run teardown, if available
				if(unit.teardown){
					unit.teardown();
				}
				// save our data
				var data = getStats(rawData, threshold);
				this.onUnitEnd(groupName, unit, data);
				stats.push(data);
			}
			if(stats.length < units.length){
				var unit = units[stats.length];
				this.onUnitStart(groupName, unit);
				// run setup, if available
				if(unit.setup){
					unit.setup();
				}
				// run the test
				runUnits(unit.test, threshold, repetitions, bind(process, this));
				return;
			}
			// save results
			this.statDict[groupName] = stats;
			this.onGroupEnd(groupName, units, stats);
			// prepare to show results
			var diff = Math.max.apply(Math, map(stats, function(s){ return s.upperQuartile - s.lowerQuartile; })),
				prec = 1 - Math.floor(Math.log(diff) / Math.LN10), fastest = 0, stablest = 0;
			forEach(this.stats, function(s, i){
				if(i){
					if(s.median < stats[fastest].median){
						fastest = i;
					}
					if(s.upperQuartile - s.lowerQuartile < stats[i].upperQuartile - stats[i].lowerQuartile){
						stablest = i;
					}
				}
			}, this);
			// show the results
			var tab = ["<table class='stats'><thead><tr><th>Test</th>"];
			tab.push(map(units, function(unit, i){
				return "<th class='" + (i == fastest ? "fastest" : "") + " " + (i == stablest ? "stablest" : "") + "'>" + unit.name + "</th>";
			}).join(""));
			tab.push("</tr></thead><tbody>");
			forEach(statNames, function(name){
				tab.push("<tr class='name " + name + "'><td>" + name + "</td>");
				forEach(stats, function(s, i){
					tab.push("<td class='" + (i == fastest ? "fastest" : "") + " " + (i == stablest ? "stablest" : "") + "'>" + s[name].toFixed(prec) + "</td>");
				});
				tab.push("</tr>");
			});
			tab.push("</tbody></table>");
			place(tab.join(""), node);
			// next group
			run(repetitions, node);
		}
		
		// start the group
		place("<h1>" + groupName + "</h1>", node);
		this.onGroupStart(groupName, units);
		process.call(this);
	};

	function run(repetitions, node){
		if(groupIndex < 0){
			groupIndex = -1;
		}
		++groupIndex;
		if(unitGroups.length <= groupIndex){
			groupIndex = -1;
			alert("Done!");
		}else{
			runGroup(unitGroups[groupIndex], repetitions, node);
		}
	}
	
	return {
		// data
		unitGroups: [],
		unitDict:   {},
		statDict:   {},
		groupIndex: -1,
		// methods
		clear:      clear,
		register:   register,
		run:        run,
		// events
		onGroupStart: nothing,
		onGroupEnd:   nothing,
		onUnitStart:  nothing,
		onUnitEnd:    nothing
	};
}
