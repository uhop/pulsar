(function(){
	// functional helpers
	
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
		return function(){
			return (Object.prototype.toString.call(fn) == "[object Function]" ? fn : obj[fn]).apply(obj, arguments);
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
		var div = document.createElement("div");
		return function(html, node){
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

	var getWeightedValue = function(sortedData, weight){
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

	var getStats = function(rawData, repetitions){
		var sortedData = rawData.slice(0).sort(function(a, b){ return a - b; }),
			result = {
				// the five-number summary
				minimum:        sortedData[0],
				maximum:        sortedData[sortedData.length - 1],
				median:         getWeightedValue(sortedData, 0.5),
				lowerQuartile:  getWeightedValue(sortedData, 0.25),
				upperQuartile:  getWeightedValue(sortedData, 0.75),
				// extended to the Bowley's seven-figure summary
				firstDecile:    getWeightedValue(sortedData, 0.1),
				lastDecile:     getWeightedValue(sortedData, 0.9)
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

	var DELAY = 20,     // pause in ms between tests
		LIMIT = 50,     // the lower limit of a test
		COUNT = 50;     // how many times to repeat the test

	// the basic unit to run a test with timing
	var runTest = function(f, n){
		var start = new Date();
		for(var i = 0; i < n; ++i){
			f();
		}
		var end = new Date();
		return end.getTime() - start.getTime();
	};

	// find the threshold number of tests just exceeding the limit
	var findThreshold = function(f, limit){
		// very simplistic search probing only powers of two
		var n = 1;
		while(runTest(f, n) + runTest(nothing, n) < limit) n <<= 1;
		return n;
	};

	var runUnitTest = function(a, f, n, k, m, next){
		a[k++] = runTest(f, n) - runTest(nothing, n);
		if(k < m){
			setTimeout(wrap(runUnitTest, a, f, n, k, m, next), DELAY);
		}else{
			next(a);
		}
	};

	var runTests = function(f, n, m, next){
		var a = new Array(m);
		runUnitTest(a, f, n, 0, m, next);
	};

	// run a group of tests, prepare statistics and show results

	var testGroups = [];

	var registerGroup = function(title, tests, bi, repetitions, node){
		var threshold = findThreshold(tests[bi].fun, LIMIT),
			x = {
				tests: tests,
				stats: [],
				process: function(a){
					// save stats, if any
					if(a){
						this.stats.push(getStats(a, threshold));
						//console.log("test #" + this.stats.length + " is completed: " + this.tests[this.stats.length - 1].name);
					}
					if(this.stats.length < this.tests.length){
						runTests(this.tests[this.stats.length].fun, threshold, repetitions, bind("process", this));
						return;
					}
					var diff = Math.max.apply(Math, map(this.stats, function(s){ return s.upperQuartile - s.lowerQuartile; })),
						prec = 1 - Math.floor(Math.log(diff) / Math.LN10), fastest = 0, stablest = 0;
					forEach(this.stats, function(s, i){
						if(i){
							if(s.median < this.stats[fastest].median){
								fastest = i;
							}
							if(s.upperQuartile - s.lowerQuartile < this.stats[i].upperQuartile - this.stats[i].lowerQuartile){
								stablest = i;
							}
						}
					}, this);
					// add the table
					var tab = ["<table class='stats'><thead><tr><th>Test</th>"];
					tab.push(map(this.tests, function(f, i){
						return "<th class='" + (i == fastest ? "fastest" : "") + " " + (i == stablest ? "stablest" : "") + "'>" + f.name + "</th>";
					}).join(""));
					tab.push("</tr></thead><tbody>");
					forEach(statNames, function(name){
						tab.push("<tr class='name " + name + "'><td>" + name + "</td>");
						forEach(this.stats, function(s, i){
							tab.push("<td class='" + (i == fastest ? "fastest" : "") + " " + (i == stablest ? "stablest" : "") + "'>" + s[name].toFixed(prec) + "</td>");
						}, this);
						tab.push("</tr>");
					}, this);
					tab.push("</tbody></table>");
					place(tab.join(""), node);
					// next
					run();
				}
			};
		testGroups.push(function(){
			//console.log("all tests will be repeated " + n + " times in " + repetitions + " series");
			place("<h1>" + title + "</h1>", node);
			x.process();
		});
	};
	
	function run(){
		if(testGroups.length){
			testGroups.shift()();
		}else{
			//console.log("Done!");
			alert("Done!");
		}
	}
})();
