define([], function () {
	var ops = {}

	/**
	 * Registers operator for use with condition evaluators
	 * 
	 * @param name The name of the op as it is used in condition functions
	 * @param displayname The name of the op as it is displayed in UI
	 * @param description Template for op question, with bracketed letters corresponding to argument order
	 * @param fn Boolean function for the op
	 */
	function opRegister(name, displayname, description, fn) {
		ops[name] = {
			name: name,
			displayname: displayname,
			description: description,
			fn: fn
		}
	}
	
	/**
	 * Applies an operator to supplied values and returns the result
	 * 
	 * @param op The name of the op
	 * @param vals Array of values
	 */
	function opApply(op, vals) {
		var retval = null;
		try {
			retval = ops[op].fn.apply(this, vals)
		} catch (e) {
			console.error(e, op, vals)
		}
		return retval;
	}

	opRegister("find", "Find", "Is {{{a}}} in {{{b}}} ?", function (a, b) {
		if(a === undefined || b === undefined)	return false;
		return b.hasOwnProperty(a)
	});

	opRegister("and", "And", "Are {{{a}}} and {{{b}}} true?", function (a, b) {
		if(a === undefined || b === undefined)	return false;
		return String(a) == "true" && String(b) == "true";
	})

	opRegister("eq", "Equals", "Are {{{a}}} and {{{b}}} equal?", function (a, b) {
		if(a === undefined || b === undefined)	return false;
		return a == b;
	})
	
	opRegister("neq", "Not equals", "Are {{{a}}} and {{{b}}} not equal?", function (a, b) {
		if(a === undefined || b === undefined)	return false;
		return a !== b;
	})

	opRegister("near", "Near", "Is {{{a}}} near {{{b}}}? ", function (a, b) {
		if(a === undefined || b === undefined)	return false;
		var apos = a.split(",")
		var bpos = b.split(",")
		var x = parseFloat(bpos[0]) - parseFloat(apos[0])
		var y = parseFloat(bpos[1]) - parseFloat(apos[1])
		var mag = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2))
		return mag <= 1.0;
	})

	return {
		apply: opApply,
		list: ops
	}
})
