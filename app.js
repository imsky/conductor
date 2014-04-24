Messenger.options = {
	extraClasses: 'messenger-fixed messenger-on-bottom messenger-on-right',
	theme: 'flat'
}

window.console.error = (function () {
	var oldError = window.console.error;
	return function (exception) {
		Messenger().post({
			message: exception,
			type: 'error'
		})
		if (exception.stack != null) {
			oldError.call(console, exception.stack);
		} else {
			oldError.apply(console, arguments);
		}
	}
})()

require(["lib/OBJLoader"], function () {
	require(["editor", "bindmap", "network"], function (editor, bindMap, network) {
		var renderers = [];
		var networkLoaded = null;

		/**
		 * The main event loop
		 * The loaded network is evaluated, and its function stack is processed
		 * After processing is done, each renderer renders a new frame
		 */
		function appLoop() {
			if (stats == null) {
				console.error("Stats.js is not running");
			}
			stats.begin();
			if (networkLoaded != null) {
				var stack = network.evaluate();
				if (stack.length) {
					for (var i = 0; i < stack.length; i++) {
						if (!stack[i].length) continue;
						if (!stack[i][1].length) continue;
						for (var j = 0; j < stack[i][1].length; j++) {
							var call = stack[i][1][j];
							var source = call[0];
							var dest = call[1];
							var fn = call[2];
							var args = call[3];
							console.info(source.name + " called " + dest + "." + fn + " from " + stack[i][0]);
							bindMap.exec(dest, fn, args)
						}
					}
				}
			}

			if ($("body").hasClass("preview-mode")) {
				for (var i = 0; i < renderers.length; i++) {
					renderers[i].render();
				}
			}
			requestAnimationFrame(appLoop);
			stats.end();
		}

		function cloneJSON(json) {
			return JSON.parse(JSON.stringify(json))
		}

		/**
		 * (Re)loads a network into the engine network and editor
		 * The network can either be an instance of Graph or a valid JSON object
		 * 
		 * @param Network Network
		 */
		function loadNetwork(Network) {
			networkLoaded = Network;
			bindMap.clear();
			network.import(cloneJSON(networkLoaded));
			editor.import(networkLoaded)
		}

		$(function () {
			//Switch between Editor and Preview
			$(".view-switch button").on("click", function (e) {
				$(this).parents(".view-switch").find(".active").removeClass("active")
				switch ($(this).data("switch")) {
				case "editor":
					$("body").removeClass("preview-mode")
					break;
				case "preview":
				editor.reload();
					$("body").addClass("preview-mode")
					break;
				}
				$(this).addClass("active")
				e.preventDefault()
			})
			
			//Save button
			$(".network-io button").on("click", function(e){
				switch($(this).data("function")){
					case "save":
						$("#graph_json").val(JSON.stringify(cloneJSON(networkLoaded)))
					break;
				}
			})
			
			//Load button in Load dialog
			$("#load_graph").on("click", function(e){
				var Network = JSON.parse($("#extern_json").val());
				loadNetwork(Network);
			})

			$(editor.element).attr("id", "editor").appendTo("body")
			
			editor.setupToolbar($("#toolbar"))
			editor.setupReload(function (NewNetwork) {
				loadNetwork(NewNetwork)
			})

			for (var i = 0; i < renderers.length; i++) {
				renderers[i].setup()
				$(renderers[i].element).attr("id", "render_" + renderers[i].id).appendTo("body");
			}
			
			requestAnimationFrame(appLoop)
		})
	})
})
