define(["ops"], function (ops) {
	
	/**
	 * Evaluates a logic function
	 * Logic function should be in the form:
	 * [{"op": "eq", "args": ["a", "a"]}]
	 * 
	 * @param fn Array of op/args pairs
	 * @param ref Name of the logic function node
	 * @param vars Hash map with logic function node variable values
	 */
	function evaluate(fn, ref, vars) {
		var retval = false;
		var rvarr = [];
		for (var j = 0; j < fn.length; j++) {
			var stepObj = fn[j];
			var argVals = []
			for (var k = 0; k < stepObj.args.length; k++) {
				if (stepObj.args[k].indexOf("$") != -1) {
					if (vars[ref + stepObj.args[k]] == null) {
						console.error("Variable not set: " + ref + stepObj.args[k]);
						continue;
					}
					argVals.push(vars[ref + stepObj.args[k]])
				} else {
					argVals.push(stepObj.args[k])
				}
			}
			var ret = null;

			ret = ops.apply(stepObj.op, argVals);

			if (ret != null) {
				retval = ret;
				rvarr.push(ret);
			}
		}
		for (var j = 0; j < rvarr.length; j++) {
			if (!rvarr[j]) {
				retval = false;
				break;
			} else {
				retval = true;
			}
		}
		return retval;
	}

	return evaluate;
})
