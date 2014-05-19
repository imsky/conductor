define(["graph_utils", "condition"], function (graph_utils, conditionEvaluator) {
	var Handler = function () {
		var Counter = (function () {
			var index = 0;
			return function () {
				return index++;
			}
		})()

		var localGraph = null;
		var functionStack = [];
		var triggerStack = [];

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
		 * Iterates through the trigger stack and processes the node outputs for triggered nodes
		 */
		function processStacks() {
			for (var i = 0; i < triggerStack.length; i++) {
				var source = triggerStack[i][0];
				var dest = triggerStack[i][1];
				console.info(source.name + " triggered " + dest)
				processNodeOutputs(eg.nodes[dest]);
			}
		}

		/**
		 * Publishes to a trigger's outputs
		 * If the destination output is a function (i.e. an entity), then the call is added to the function stack, along with all of the inputs of the trigger as arguments
		 *
		 * @param graphObject Trigger node
		 */
		function publishTrigger(graphObject) {
			var args = [];
			if (graphObject.config.inputs) {
				for (var i = 0; i < graphObject.config.inputs.length; i++) {
					args.push(localGraph.values[graphObject.name + "$" + graphObject.config.inputs[i]])
				}
			}

			for (var i = 0; i < graphObject.config.outputs.length; i++) {
				var signature = graphObject.config.outputs[i];
				var parts = signature.split("/");

				if (parts.length < 2) {
					console.error("Incorrect signature for trigger output");
					continue;
				}

				var destination = parts[0];
				var func = parts[1];
				for (var j = 0; j < triggerStack.length; j++) {
					if (graphObject.name == triggerStack[j][1]) {
						functionStack.push([graphObject, destination, func, args]);
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

		var publish = {
			trigger: publishTrigger,
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
				//Object values should be loaded
				if (graphObject.config.type == "condition" && graphObject.config.fn != null) {
					localGraph.values[graphObject.name + "#value"] =
						String(conditionEvaluator(graphObject.config.fn, graphObject.name, localGraph.values))
				}
				processNodeOutputs(graphObject);
			}
		}

		/**
		 * Evaluates priority and non-priority nodes, building up the function stack for export to network
		 */
		function evaluate() {
			clearStacks();
			evaluateNodes(localGraph.priority);
			evaluateNodes(localGraph.nonpriority);
			return functionStack;
		}
		return {
			/**
			 * Merges provided values with local value hash map, overwriting existing keys
			 *
			 * @param values Hash map
			 */
			"inject": function (values) {
				for (var prop in values) {
					localGraph.values[prop] = values[prop];
				}
			},
			"import": function (graph) {
				localGraph = graph_utils.export(graph)
			},
			"evaluate": evaluate
		}
	}
	return Handler;
})
