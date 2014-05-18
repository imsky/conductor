define(["templates", "graph", "ops"], function (templates, Graph, ops) {
	var network = null;
	var el = $("<div />")[0];
	var graphStack = [];
	var nodeCollection = null;
	var views = [];
	var activeNode = null;
	var activeEdge = null;
	var reload_fn = null;
	var reloadNetwork = false;
	
	var tour = new Shepherd.Tour({
		defaults: {
			classes: 'shepherd-theme-arrows',
			showCancelLink: true
		}});
		
		tour.addStep('nodes', {
			text: 'These are the nodes in network and handler graphs that make up the logic layer of the application',
			attachTo: '.nodes top',
			buttons: [{text: 'Next', action: tour.next}]
		})
		
		tour.addStep('nodesAdd', {
			text: 'You can add nodes with this button',
			attachTo: '.tour-add bottom',
			buttons: [{text: 'Next', action: tour.next}]
		})
		
		tour.addStep('preview', {
			text: 'You can switch between the editor and the live game using these buttons',
			attachTo: '.view-switch bottom',
			buttons: [{text: 'Next', action: tour.next}]
		})
		
		tour.addStep('navigation', {
			text: 'You can navigate between networks and handlers using this bar',
			attachTo: '.tour-nav bottom',
			buttons: [{text: 'Next', action: tour.next}]
		})
		
		tour.addStep('saveLoad', {
			text: 'You can save and load the entire network using these buttons',
			attachTo: '.network-io bottom',
			buttons: [{text: 'Next', action: tour.next}]
		})
		
		tour.addStep('editDelete', {
			text: 'You can edit nodes, as well as delete nodes and edges using these buttons',
			attachTo: '.tour-edit bottom',
			buttons: [{text: 'Next', action: tour.next}]
		})
		
		tour.addStep('edges', {
			text: 'You can connect nodes by dragging from an output port to an input port',
			attachTo: '.nodes top'
		})

	/**
	 * Sets the clicked edge as the active edge (to be deleted, for instance)
	 */
	window.editorCb = function (evt) {
		var parent = $(evt.target).attr("parent")
		var group = $(evt.target).attr("group")

		var node = nodeCollection.findWhere({
			name: parent
		})
		if (!node) {
			console.error("Couldn't find node: " + parent);
			return;
		}

		var nodeConnections = node.get("connections")
		if (nodeConnections[group] != null) {
			setActiveEdge(nodeConnections[group]);
		}
	}

	/**
	 * Highlights edge under mouse cursor
	 */
	window.hoverCb = function (evt) {
		var originalColor = "#D6DBE2";
		var hoverColor = "#FFFFFF";

		var parent = $(evt.target).attr("parent")
		var group = $(evt.target).attr("group")

		var node = nodeCollection.findWhere({
			name: parent
		})
		if (!node) {
			console.error("Couldn't find node: " + parent);
			return;
		}

		switch (evt.type) {
		case "mouseover":
			var nodeConnections = node.get("connections")

			if (nodeConnections[group] != null) {
				if (activeEdge == nodeConnections[group]) {
					return;
				}
				nodeConnections[group].lines.forEach(function (line) {
					line.style.stroke = hoverColor;
				})
			}
			break;
		case "mouseout":
			var nodeConnections = node.get("connections")

			if (nodeConnections[group] != null) {
				if (activeEdge == nodeConnections[group]) {
					return;
				}
				nodeConnections[group].lines.forEach(function (line) {
					line.style.stroke = originalColor;
				})
			}
			break;
		}
	}

	//Top bar pushes the content down about 70px
	var offset = {
		left: 0,
		top: 70
	}

	var Node = Backbone.Model.extend({
		name: "Unnamed node",
		type: "entity",
		update: function () {
			var attr = this.attributes;
			this.set({
				isEntity: attr.config.type == "entity",
				isCondition: attr.config.type == "condition",
				isTrigger: attr.config.type == "trigger",
				isHandler: attr.config.type == "handler",
				inputList: attr.config.inputs && attr.config.inputs,
				outputList: attr.config.outputs && attr.config.outputs.length == null && Object.keys(attr.config.outputs),
				actionList: attr.config.actions ? Object.keys(attr.config.actions) : null
			})
		},
		initialize: function () {
			this.update()
			this.on("change", this.update)
		}
	})

	function setActiveNode(node) {
		unsetActiveEdge();
		activeNode = node;
		if (activeNode != null) {
			var node = nodeCollection.findWhere({
				name: activeNode
			});
			node.set("isActive", true)
		}
		$(".graph-toolbar button.disabled").removeClass("disabled")
	}

	function unsetActiveNode() {
		if (activeNode != null) {
			var node = nodeCollection.findWhere({
				name: activeNode
			});
			if (node != null) {
				node.set("isActive", false)
			}
		}
		activeNode = null;
		$(".graph-toolbar button[data-function='edit'], .graph-toolbar button[data-function='delete']").addClass("disabled")
	}

	function deactivateEdge(edge) {
		edge.lines.forEach(function (line) {
			line.style.stroke = "#D6DBE2";
		})
	}

	function activateEdge(edge) {
		edge.lines.forEach(function (line) {
			line.style.stroke = "#FAE1C5";
		})
	}

	function unsetActiveEdge() {
		if (activeEdge != null) {
			deactivateEdge(activeEdge)
		}
		activeEdge = null;
		$(".graph-toolbar button[data-function='edit'], .graph-toolbar button[data-function='delete']").addClass("disabled")
	}

	function setActiveEdge(edge) {
		var prevEdge = activeEdge;
		unsetActiveEdge();
		unsetActiveNode();
		if (prevEdge != edge) {
			activeEdge = edge;
			activateEdge(activeEdge);
			$(".graph-toolbar button[data-function='delete'].disabled").removeClass("disabled")
		}
	}

	var connectionData = {
		x1: 0,
		x2: 0,
		y1: 0,
		y2: 0,
		moving: false,
		line: null
	}

	function createConnectionEl() {
		var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		$(el).append($(svg).attr("class", "newConnection unclickable"))
		$(svg).css({
			width: $(el).find(".connections").css("width"),
			height: $(el).find(".connections").css("height")
		})
		var line = getLine(connectionData.x1, connectionData.y1, connectionData.x1, connectionData.y1, "#FFDD00")
		$(svg).append(line)
		connectionData.line = line;
		connectionData.moving = true;
	}

	$(document).on("mousemove", function (e) {
		if (connectionData.moving) {
			connectionData.line.setAttribute("x2", e.clientX);
			connectionData.line.setAttribute("y2", e.clientY - offset.top + $(el).scrollTop());
		}
	})

	$(document).on("mouseup", function (e) {
		if (connectionData.moving) {
			$(el).find(".newConnection").remove()
			connectionData.moving = false;
			connectionData.line = null;
		}
	})

	function getCoords($el) {
		if ($el.hasClass("data-in")) {
			return [$el.offset().left, $el.offset().top + $el.height() / 2];
		} else {
			return [$el.offset().left + $el.outerWidth(), $el.offset().top + $el.height() / 2];
		}
	}

	/**
	 * Sets up correct new connection depending on source and destination types
	 */
	function processNewConnection() {
		var source = connectionData.source;
		var destination = connectionData.destination;
		connectionData.source = connectionData.destination = null;

		var sourceNode = source[0];
		var destNode = destination[0];

		var sourceSection = source[1];
		var destSection = destination[1];

		var sourceField = source[2];
		var destField = destination[2];

		var destinationSignature = destNode.get("name");
		if (destSection == "inputs") {
			destinationSignature += ":" + destField;
		} else if (destSection == "functions") {
			destinationSignature += "/" + destField;
		}

		//These source types have keys instead of flat arrays
		if (sourceSection == "outputs" || sourceSection == "actions") {
			if(sourceNode.attributes.config[sourceSection] == null){
				sourceNode.attributes.config[sourceSection] = {}
			}
			if(sourceNode.attributes.config[sourceSection][sourceField] == null){
				sourceNode.attributes.config[sourceSection][sourceField] = [];
			}
			sourceNode.attributes.config[sourceSection][sourceField].push(destinationSignature)
			sourceNode.attributes.config[sourceSection][sourceField] = _.uniq(sourceNode.attributes.config[sourceSection][sourceField])
		//These source types don't have explicit keys, only flat arrays
		} else if (sourceSection == "condition" || sourceSection == "trigger") {
			if(sourceNode.attributes.config.outputs == null){
				sourceNode.attributes.config.outputs = [];
			}
			sourceNode.attributes.config.outputs.push(destinationSignature)
			sourceNode.attributes.config.outputs = _.uniq(sourceNode.attributes.config.outputs)
		}

		safeReload();
	}

	var NodeView = Backbone.View.extend({
		initialize: function () {
			this.listenTo(this.model, "change", this.render)
		},
		events: {
			"click .title": "registerActive",
			"mousedown .data-out": "registerNewConnection",
			"mouseup .data-in": "completeNewConnection"
		},
		registerActive: function () {
			if (activeNode == this.model.get("name")) {
				unsetActiveNode();
			} else {
				unsetActiveNode();
				setActiveNode(this.model.get("name"))
			}
		},
		registerNewConnection: function (e) {
			if (!connectionData.moving) {
				var coords = getCoords($(e.target));
				connectionData.x1 = coords[0] - 10;
				connectionData.y1 = coords[1] - offset.top + $(el).scrollTop();
				var field = $(e.target).data("name")
				var section = _.without($(e.target).parents(".section").attr("class").split(" "), "section").join("")
				connectionData.source = [this.model, section, field]
				createConnectionEl();
			}
		},
		completeNewConnection: function (e) {
			if (connectionData.moving) {
				var field = $(e.target).data("name")
				var section = _.without($(e.target).parents(".section").attr("class").split(" "), "section").join("")
				connectionData.destination = [this.model, section, field]
				processNewConnection();
			}
		},
		render: function () {
			this.$el.html($(templates.node.render(this.model.attributes)).html())
			this.$el.attr({
				"data-name": this.model.get("name"),
				"class": "node" + (!!this.model.get("isActive") ? " active" : "")
			})
			this.delegateEvents()
			return this;
		}
	})

	var NodeCollection = Backbone.Collection.extend({
		model: Node
	})

	/**
	 * Returns the current context of the editor, whether it's a handler or the network
	 */
	function getContext() {
		return graphStack.length ? graphStack[0] : null;
	}
	
	function safeReload(){
		render();
	}

	function getLine(x, y, x2, y2, color) {
		var newLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
		newLine.setAttribute('x1', x);
		newLine.setAttribute('y1', y);
		newLine.setAttribute('x2', x2);
		newLine.setAttribute('y2', y2);
		if (color === undefined) {
			color = "#D6DBE2";
		}
		newLine.setAttribute('style', "stroke:" + color + ";stroke-width:4px");
		return newLine;
	}

	function render() {
		$(el).empty();
		$(el).append($("<div />").attr("class", "nodes"))
		var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		$(el).append($(svg).attr("class", "connections"))

		var AvoidRouter = new Avoid.Router();

		views = [];
		nodeCollection = new NodeCollection;
		var ctx = getContext();
		Object.keys(ctx.graph.nodes).forEach(function (nkey) {
			nodeCollection.add(ctx.graph.nodes[nkey])
		});
		nodeCollection.forEach(function (node, index) {
			views.push(new NodeView({
				model: node
			}))
		})

		var renderIndex = 0;
		var viewOffset = [30, 0];
		var maxHeight = 0;

		_.each(views, function (view) {
			view.model.set("view", view)
			$(el).find(".nodes").append(view.$el)

			//Tile 4 nodes per column
			if (renderIndex % 4 == 0 && renderIndex > 0) {
				viewOffset[0] += view.$el.outerWidth() + 50;
				viewOffset[1] = 0;
			}

			view.$el.css({
				left: viewOffset[0],
				top: viewOffset[1]
			})

			viewOffset[1] += view.$el.outerHeight() + 30;
			maxHeight = Math.max(maxHeight, viewOffset[1])

			renderIndex++;
		})

		$(el).find(".connections").css({
			width: 280 + viewOffset[0] + "px",
			height: maxHeight + "px"
		})

		//Set up outbound connections from each node
		nodeCollection.forEach(function (node) {
			var config = node.attributes.config;
			var connections = [];
			if (config.actions) {
				Object.keys(config.actions).forEach(function (key) {
					var origin = node.get("view").$el.find(".actions .item[data-name='" + key + "']");
					for (var i = 0; i < config.actions[key].length; i++) {
						var output = nodeCollection.findWhere({
							name: config.actions[key][i]
						});
						if (output && output.attributes.config.type == "handler") {
							var destination = output.get("view").$el.find(".item.data-in")
							connections.push({
								from: getCoords(origin),
								to: getCoords(destination),
								source: node.attributes.name,
								destination: output.attributes.name,
								type: "action",
								signature: config.actions[key][i],
								key: key
							})
						}
					}
				})
			}

			if (config.outputs && config.outputs.length != null) {
				var origin = node.get("view").$el.find(".item.data-out");
				for (var i = 0; i < config.outputs.length; i++) {
					var signature = config.outputs[i].split(/\:|\//g);
					var output = nodeCollection.findWhere({
						name: signature[0]
					});
					if (output) {
						var destination = null;
						if (output.attributes.config.type == "trigger" || output.attributes.config.type == "handler") {
							destination = output.get("view").$el.find(".item.data-in")
						} else {
							destination = output.get("view").$el.find(".item.data-in[data-name='" + signature[1] + "']")
						}
						connections.push({
							from: getCoords(origin),
							to: getCoords(destination),
							source: node.attributes.name,
							destination: output.attributes.name,
							type: "output",
							signature: config.outputs[i]
						})
					}
				}
			} else if (config.outputs && !(config.outputs instanceof Array)) {
				Object.keys(config.outputs).forEach(function (key) {
					var origin = node.get("view").$el.find(".outputs .item[data-name='" + key + "']");
					for (var i = 0; i < config.outputs[key].length; i++) {
						var signature = config.outputs[key][i].split(/\:|\//g);
						var output = nodeCollection.findWhere({
							name: signature[0]
						});
						if (output) {
							var destination = null;
							if (output.attributes.config.type == "trigger" || output.attributes.config.type == "handler") {
								destination = output.get("view").$el.find(".item.data-in")
							} else {
								destination = output.get("view").$el.find(".item.data-in[data-name='" + signature[1] + "']")
							}
							connections.push({
								from: getCoords(origin),
								to: getCoords(destination),
								source: node.attributes.name,
								destination: output.attributes.name,
								type: "output",
								signature: config.outputs[key][i],
								key: key
							})
						}
					}
				})
			}

			if (connections.length) {
				node.set("connections", {});
				for (var i = 0; i < connections.length; i++) {
					var connectionLines = [];

					//Using 3 segments for input, output, and middle
					var line = getLine(
						connections[i].from[0] + 10,
						connections[i].from[1] - offset.top,
						connections[i].to[0] - 10,
						connections[i].to[1] - offset.top);
					connectionLines.push(line)

					line = getLine(
						connections[i].from[0],
						connections[i].from[1] - offset.top,
						connections[i].from[0] + 10,
						connections[i].from[1] - offset.top);
					connectionLines.push(line)

					line = getLine(
						connections[i].to[0],
						connections[i].to[1] - offset.top,
						connections[i].to[0] - 10,
						connections[i].to[1] - offset.top);
					connectionLines.push(line)

					var connection = {
						from: connections[i].source,
						to: connections[i].destination,
						lines: connectionLines,
						index: i,
						type: connections[i].type,
						signature: connections[i].signature,
						key: connections[i].key
					}

					connectionLines.forEach(function (line) {
						$(line).attr("onclick", "window.editorCb(evt)")
						$(line).attr("onmouseover", "window.hoverCb(evt)")
						$(line).attr("onmouseout", "window.hoverCb(evt)")
						$(line).attr("parent", connection.from)
						$(line).attr("group", connection.index)
						$(el).find(".connections").append(line)
					})

					node.attributes.connections[connection.index] = connection;
				}
			}
		})
	}
	
	/**
	 * Writes a list of op question forms for use in logic functions
	 * 
	 * @param fn Logic function from a condition
	 */
	function convertLogicFnToQuestions(fn) {
			var values = [];
			var fieldObj = {
				a: "<input style='width:100px;display:inline-block'>"
			}
			fieldObj.b = fieldObj.a
			fieldObj.c = fieldObj.a
			fieldObj.d = fieldObj.a

			fn.forEach(function (step) {
				var qt = Hogan.compile(ops.list[step.op].description)
				var qel = $("<div>" + qt.render(fieldObj) + "</div>")

				step.args.forEach(function (arg, idx) {
					qel.find("input:eq(" + idx + ")").attr("value", arg)
				})

				values.push({
					question: qel.html() + "<span data-op='" + step.op + "'></span>"
				})
			})
			return values;
		}

		$(".modal-body").on("click", "#logicAdd", function (e) {
			var fieldObj = {
				a: "<input style='width:100px;display:inline-block'>"
			}
			fieldObj.b = fieldObj.a
			fieldObj.c = fieldObj.a
			fieldObj.d = fieldObj.a

			var op = $(this).prev("select").val()
			var qt = Hogan.compile(ops.list[op].description)

			$(this).parents(".modal").find(".logicTable tbody").append("<tr><td>" + qt.render(fieldObj) + "<span data-op='" + op + "'></span>" + "</td>" + '<td><a href="#" data-function="delete">Delete</a></td>' + "</tr>")
			e.preventDefault()
		})

		$(".modal-body").on("click", "a[data-function='delete']", function () {
			$(this).parents("tr").remove()
		})

	/**
	 * Delegates events to a toolbar element
	 * 
	 * @param $el Toolbar element
	 */
	function setupToolbar($el) {
		$el.find(".tour-button").on("click", function(){
			tour.start()
		})
		
		function updateNav() {
			$el.find("#network-nav").empty();
			for (var i = 0; i < graphStack.length; i++) {
				var isNetwork = graphStack[i].type == "network";
				if (i == 0) {
					$el.find("#network-nav").prepend("<li>" +
						(isNetwork ? "Network" : graphStack[i].name) + "</li>");
				} else {
					$el.find("#network-nav").prepend("<li><a href='#' data-level='" + i + "'>" +
						(isNetwork ? "Network" : graphStack[i].name) + "</a></li>");
				}
			}
			$("body").removeClass("ctx-network ctx-handler")
			if (getContext().type == "network") {
				$("body").addClass("ctx-network")
			} else if (getContext().type == "handler") {
				$("body").addClass("ctx-handler")
			}
		}
		
		if(network != null){
			updateNav();
		}

		$el.on("click", "#network-nav a", function (e) {
			if ($(this).data("level") > 0) {
				for (var i = 0; i < $(this).data("level"); i++) {
					graphStack.shift();
				}
			}

			if (graphStack.length == 1 && reloadNetwork) {
				reload_fn(network)
			}

			updateNav();
			unsetActiveNode();
			render();
			e.preventDefault()
		})

		$el.on("click", ".add-node a", function (e) {
			var ctx = getContext();
			var addParams = {
				isNetwork: ctx.type == "network",
				isHandler: ctx.type == "handler",
				type: $(this).data("item")
			}
			$("#addModal").modal()
			$("#addModal .modal-body").empty().html(templates["edit_" + addParams.type].render(addParams))
			if($(this).data("item")=="condition"){
				$("#addModal .modal-body").append(templates.logic.render({ops: Object.keys(ops.list)}))
			}
			$("#addModal .taggable").selectize({
				delimiter: ',',
				persist: false,
				create: function (text) {
					return {
						value: text,
						text: text
					}
				}
			});
			e.preventDefault();
		})

		$el.on("click", ".graph-toolbar button", function (e) {
			var ctx = getContext();
			var target = $(e.target).is("button") ? e.target : $(e.target).parents("button")[0];
			switch ($(target).data("function")) {
			case "delete":
				if (activeNode != null) {
					if (ctx.graph.nodes[activeNode] != null) {
						var node = ctx.graph.nodes[activeNode];
						delete ctx.graph.nodes[activeNode];
						//safreload
						
					} else {
						console.error("Can't find active node");
					}
				}
				if (activeEdge != null) {
					if (ctx.graph.nodes[activeEdge.from] != null) {
						var node = ctx.graph.nodes[activeEdge.from];
						switch (activeEdge.type) {
						case "action":
							var currentAction = node.config.actions[activeEdge.key];
							var newAction = _.without(currentAction, activeEdge.signature);
							node.config.actions[activeEdge.key] = newAction;
							break;
						case "output":
							if (activeEdge.key == null) {
								var currentOutput = node.config.outputs;
								var newOutput = _.without(currentOutput, activeEdge.signature);
								node.config.outputs = newOutput;
							} else {
								var currentOutput = node.config.outputs[activeEdge.key];
								var newOutput = _.without(currentOutput, activeEdge.signature);
								node.config.outputs[activeEdge.key] = newOutput;
							}
							break;
						}
						
					}
				}
				break;
			case "edit":
				if (activeNode != null) {
					if (ctx.graph.nodes[activeNode] != null) {
						var node = ctx.graph.nodes[activeNode];
						if (node.config.type == "handler") {
							graphStack.unshift({
								graph: node.config.graph,
								type: "handler",
								name: node.name
							})
						} else {
							var editParams = {
								isNetwork: ctx.type == "network",
								isHandler: ctx.type == "handler",
								node: node
							}

							if (node.config.actions != null) {
								editParams.actionKeys = Object.keys(node.config.actions).join(",")
							}
							switch (node.config.type) {
							case "entity":
								if (node.config.outputs != null) {
									editParams.outputKeys = Object.keys(node.config.outputs).join(",")
								}
								break;
							}

							$("#editModal").modal()
							$("#editModal .modal-body").empty().html(templates["edit_" + node.config.type].render(editParams))
							if (node.config.type == "condition") {
								var logicParams = {
									values: convertLogicFnToQuestions(node.config.fn),
									ops: Object.keys(ops.list)
								}
								$("#editModal .modal-body").append(templates.logic.render(logicParams))
							}
							$("#editModal .taggable").selectize({
								delimiter: ',',
								persist: false,
								create: function (text) {
									return {
										value: text,
										text: text
									}
								}
							});

						}
					}
				} else {
					console.error("Called edit on inactive node")
				}
				break;
			}

			updateNav();
			unsetActiveNode();
			render();

			e.preventDefault();
		})
	}

	function setupReload(cb) {
		reload_fn = cb;
	}

	function mergeKeys(object, property, arr) {
		if (arr.length) {
			if (arr.length == 1 && arr[0].trim() == "") {
				object[property] = {};
				return;
			}

			if (object[property] == null) {
				object[property] = {}
			}
			Object.keys(object[property]).forEach(function (existingKey) {
				if (arr.indexOf(existingKey) == -1) {
					delete object[property];
				}
			});

			arr.forEach(function (newKey) {
				if (object[property][newKey] == null) {
					object[property][newKey] = [];
				}
			})
		} else {
			object[property] = {}
		}
	}

	/**
	 * Returns an empty array if the given value is an empty string, returns value split by commas otherwise
	 * 
	 * @param val String
	 */
	function proofValue(val) {
		if (val.trim().length == 0) {
			return [];
		} else {
			return val.split(",")
		}
	}
	
	/**
	 * Changes node variables using a form, except for name
	 *
	 * @param node Node object
	 * @param form Form element
	 */
	function modifyNode(node, form){
		var ctx = getContext();
		switch (node.config.type) {
			case "entity":
				node.config.variables = proofValue(form.find("#nodeVariables").val());
				var editOutputs = proofValue(form.find("#nodeOutputs").val());
				mergeKeys(node.config, "outputs", editOutputs);
				if (ctx.type == "handler") {
					node.config.functions = proofValue(form.find("#nodeFunctions").val());
				}
				if (ctx.type == "network") {
					var editActions = proofValue(form.find("#nodeActions").val());
					mergeKeys(node.config, "actions", editActions);
				}
				break;
			case "trigger":
				node.config.inputs = proofValue(form.find("#nodeInputs").val());
				break;
			case "condition":
				node.config.inputs = proofValue(form.find("#nodeInputs").val());
				var logicFn = [];
				$(".logicTable tbody tr").each(function () {
					var args = $(this).find("input").map(function () {
						return $(this).val()
					}).toArray()

					logicFn.push({
						op: $(this).find("span[data-op]").data("op"),
						args: args
					})
				})
				node.config.fn = logicFn;
				break;
			}
	}
	
	$("#save_add").on("click", function () {
		var parent = $(this).parents(".modal");
		var form = parent.find("form");

		var ctx = getContext();
		var node = {config: {type: form.data("type")}};
		if (node != null) {
			modifyNode(node, form)
			var newName = form.find("#graphNodeName").val();
			if (ctx.graph.nodes[newName] == null) {
				ctx.graph.nodes[newName] = node;
				node.name = newName;
			} else {
				console.error("Couldn't add node due to a name conflict")
			}
		} else {
			console.error("Couldn't edit a non-existent node")
		}
		
		safeReload();
	})

	$("#save_edit").on("click", function () {
		var parent = $(this).parents(".modal");
		var form = parent.find("form");
		var targetNode = form.data("target");

		var ctx = getContext();
		var node = ctx.graph.nodes[targetNode];
		if (node != null) {
			modifyNode(node, form)
			var newName = form.find("#graphNodeName").val();
			if (newName != targetNode) {
				if (ctx.graph.nodes[newName] == null) {
					delete ctx.graph.nodes[node.name];
					ctx.graph.nodes[newName] = node;
					node.name = newName;
				} else {
					console.error("Couldn't rename node due to a name conflict")
				}
			}
		} else {
			console.error("Couldn't edit a non-existent node")
		}
		
		safeReload();
	})

	return {
		render: render,
		"import": function (Network) {
			network = new Graph;
			network.nodes = Network.nodes;
			graphStack = [];
			graphStack.push({
				graph: network,
				type: "network"
			})
			render();
		},
		element: el,
		setupToolbar: setupToolbar,
		setupReload: setupReload,
		reload: function(){
			reload_fn.call(this, network)
		}
	}
})
