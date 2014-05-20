define(["graph_utils", "graph", "handler", "bindmap", "condition"], function (graph_utils, Graph, Handler, bindMap, conditionEvaluator) {
	var Counter = (function () {
		var index = 0;
		return function () {
			return index++;
		}
	})()

	var localGraph = null;
	var functionStack = [];
	var triggerStack = [];
	var handlerMap = {};
	var cache = {
		handlers: null,
		conditions: null,
		entities: null
	}

	function loadEntityValues(graphObject) {
		if (bindMap.bindings[graphObject.name] != null && graphObject.config.variables) {
			for (var i = 0; i < graphObject.config.variables.length; i++) {
				var variable = graphObject.config.variables[i];
				var valueKey = graphObject.name + "$" + variable;
				var cacheValueKey = graphObject.name + "~$" + variable;
				localGraph.values[cacheValueKey] = localGraph.values[valueKey];
				localGraph.values[valueKey] = bindMap.bindings[graphObject.name][variable];
			}
		}
	}

	/**
	 * Clears the trigger and function stacks
	 */
	function clearStacks() {
		while (triggerStack.length) {
			triggerStack.pop();
		}
		while (functionStack.length) {
			functionStack.pop();
		}
	}

	/**
	 * Iterates through the trigger stack and adds the triggered handler stack to the global stack
	 */
	function processStacks() {
		var stack = []
		for (var i = 0; i < triggerStack.length; i++) {
			var source = triggerStack[i][0];
			var dest = triggerStack[i][1];
			console.info(source.name + " triggered " + dest)
			if (handlerMap[dest]) {
				stack.push([dest, handlerMap[dest].evaluate()])
			} else {
				console.error("Couldn't find handler: " + dest + ", triggered by " + source.name)
			}
		}
		return stack;
	}

	/**
	 * Publishes to a condition's outputs
	 * If the destination output is a trigger, a call is added to the trigger stack
	 *
	 * @param graphObject Condition node
	 */
	function publishCondition(graphObject) {
		var value = localGraph.values[graphObject.name + "#value"];
		for (var i = 0; i < graphObject.config.outputs.length; i++) {
			var signature = graphObject.config.outputs[i];
			if (!!~signature.indexOf(":")) {
				var parts = signature.split(":");

				if (parts.length < 2) {
					console.error("Incorrect signature for condition output");
					continue;
				}
			} else if (signature.indexOf("/") == -1) {
				if (value == "true") {
					triggerStack.push([graphObject, signature]);
				}
			}
		}
	}

	/**
	 * Publishes to an entity's outputs
	 *
	 * @param graphObject Entity node
	 */
	function publishEntity(graphObject) {
		Object.keys(graphObject.config.outputs).forEach(function (outputVar) {
			var value = localGraph.values[graphObject.name + outputVar];
			if (typeof value !== "string") {
				value = JSON.stringify(value);
			}

			Object.keys(graphObject.config.outputs[outputVar]).forEach(function (destination) {
				var signature = graphObject.config.outputs[outputVar][destination];
				if (!!~signature.indexOf(":")) {
					var parts = signature.split(":");

					if (parts.length < 2) {
						console.error("Incorrect signature for entity output");
						return;
					}
					localGraph.values[parts[0] + "$" + parts[1]] = value;
				}
			})
		})
	}

	var publish = {
		//This is kept as a no-op since handlers publish on aggregate, not continuously
		handler: function () {},
		condition: publishCondition,
		entity: publishEntity
	}

	/**
	 * Publish a node's outputs using the type-appropriate function
	 *
	 * @param graphObject Node
	 */
	function processNodeOutputs(graphObject) {
		if (graphObject.config.outputs == null) return;
		if (publish[graphObject.config.type] != null) {
			publish[graphObject.config.type].call(this, graphObject);
		} else {
			console.error("Unsupported node type: " + graphObject.config.type);
		}
	}
	/**
	 * Evaluates an array of nodes, and computes condition values
	 *
	 * @param nodeArray Node array
	 */
	function evaluateNodes(nodeArray) {
		for (var i = 0; i < nodeArray.length; i++) {
			var graphObject = localGraph.nodes[nodeArray[i]];
			if (graphObject.config.fn != null) {
				localGraph.values[graphObject.name + "#value"] =
					String(conditionEvaluator(graphObject.config.fn, graphObject.name, localGraph.values))
			}
			processNodeOutputs(graphObject);
		}
	}

	/**
	 * Evaluates entities and conditions, loading values from the bindmap, injecting them into all handlers, and triggering handlers from actions
	 */
	function evaluate() {
		clearStacks();
		var entities = cache.entities;
		var conditions = cache.conditions;

		//Load values for entities' explicitly-defined variables
		for (var i = 0; i < entities.length; i++) {
			loadEntityValues(localGraph.nodes[entities[i]])
		}

		//Inject all explicitly-defined variables into each handler
		for (var i in handlerMap) {
			handlerMap[i].inject(localGraph.values)
		}

		//Trigger handlers from actions
		for (var i = 0; i < bindMap.actions.length; i++) {
			var action = bindMap.actions[i];
			if (localGraph.nodes[action[0]] != null) {
				if (localGraph.nodes[action[0]].config.actions != null) {
					var actionHandlers = localGraph.nodes[action[0]].config.actions[action[1]];
					for (var j = 0; j < actionHandlers.length; j++) {
						triggerStack.push([localGraph.nodes[action[0]], actionHandlers[j]]);
					}
				}
			} else {
				console.error("Non-existent action source: " + action[0]);
				continue;
			}
		}

		bindMap.clearActions();

		evaluateNodes(entities);
		evaluateNodes(conditions);
		return processStacks();
	}

	/**
	 * Ensures handlers have access to the entities they request, and that they're instantiated properly
	 */
	function validateHandlers() {
		var networkEntities = cache.entities;
		for (var i = 0; i < cache.handlers.length; i++) {
			var handler = localGraph.nodes[cache.handlers[i]].config.graph;
			if (handler instanceof Graph == false) {
				var handlerGraph = new Graph;
				handlerGraph.nodes = handler.nodes;
				handler = handlerGraph;
			}
			var entities = handler.findByField("type", "entity");
			for (var j = 0; j < entities.length; j++) {
				if (networkEntities.indexOf(entities[j]) == -1) {
					console.error("Entity requested by handler not provided by network: " + entities[j]);
				}
			}

			var localHandler = new Handler;
			localHandler.import(handler)
			handlerMap[cache.handlers[i]] = localHandler;
		}
	}

	function getEntities() {
		return localGraph.findByField("type", "entity");
	}

	function getHandlers() {
		return localGraph.findByField("type", "handler");
	}

	function getConditions() {
		return localGraph.findByField("type", "condition");
	}

	/**
	 * Imports a JSON or Graph object as a network, and binds all entities through the bind map to nodes
	 */
	function openExternal(object) {
		localGraph = new Graph;
		localGraph.nodes = object.nodes;
		localGraph.values = {}
		handlerMap = {};
		clearStacks();
		cache.handlers = getHandlers();
		cache.entities = getEntities();
		cache.conditions = getConditions();
		validateHandlers();

		var entities = localGraph.findByField("type", "entity")
		entities.forEach(function (entity) {
			if (bindMap.nodes[entity]) {
				bindMap.bind(entity, entity);
			}
		})
	}
	return {
		"import": openExternal,
		"evaluate": evaluate,
		"getEntities": getEntities
	}
})
