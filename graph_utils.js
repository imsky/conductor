define([], function () {

	/**
	 * Provides an array of priority nodes from a graph, using topological sorting
	 *
	 * @param graph
	 */
	function getPriorityNodes(graph) {
		//Set up dependencies
		var connections = {};
		var dependencies = {}
		for (var x in graph.nodes) {
			var obj = graph.nodes[x]

			if (obj.config.outputs && obj.config.outputs instanceof Array && obj.config.type != "trigger") {
				for (var i = 0; i < obj.config.outputs.length; i++) {
					var split = obj.config.outputs[i].split(/\:|\//g);
					var id = split[0];
					if (connections[obj.name] == null) {
						connections[obj.name] = [];
					}
					if (connections[obj.name].indexOf(id) == -1) {
						connections[obj.name].push(id)
					}
				}
			} else if (obj.config.outputs) {
				for (var output_key in obj.config.outputs) {
					var outputs = obj.config.outputs[output_key];
					for (var i = 0; i < outputs.length; i++) {
						if (outputs[i].indexOf("/") >= 0 || outputs[i].indexOf(":") == -1) break;
						var split = outputs[i].split(/\:|\//g);
						var id = split[0];
						if (connections[obj.name] == null) {
							connections[obj.name] = []
						}
						if (connections[obj.name].indexOf(id) == -1) {
							connections[obj.name].push(id)
						}
					}
				}
			}
		}
		for (var key in connections) {
			for (var out in connections[key]) {
				var name = connections[key][out]
				if (dependencies[name] == null) {
					dependencies[name] = []
				}
				dependencies[name].push(key)
			}
		}
		//Topological sort
		var ts = new Toposort();
		for (var i in graph.nodes) {
			var obj = graph.nodes[i];
			var x = obj.name;
			if (connections[x] != null && dependencies[x] != null) {
				ts.add(x, dependencies[x])
			}
		}
		try{
		var ret = ts.sort().reverse();
		}
		catch(e){
			console.error(e)
		}
		delete ts;
		return ret;
	}

	/**
	 * Prepares a graph for processing
	 *
	 * @param graph
	 */
	function exportGraph(graph) {
			var g = graph;
			g.values = {}
			g.nonpriority = [];
			g.triggered = {}
			g.priority = getPriorityNodes(graph);
			for (var node in g.nodes) {
				if (g.priority.indexOf(node) == -1) {
					g.nonpriority.push(node)
				}
			}
			return g;
		}

	return {
		"export": exportGraph
	}
})
