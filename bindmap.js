define([], function () {
	var bindMap = function () {
		this.nodes = {}
		this.bindings = {}
		this.actions = [];
		
		/**
		 * Clears bind map and objects
		 */
		this.clear = function(){
			this.nodes = {};
			this.bindings = {};
			this.clearActions();
		}
		
		/**
		 * Adds an object to be bound later
		 * 
		 * @param name Name for the object
		 * @param object Object
		 */
		this.add = function (name, object) {
			object.name = name;
			this.nodes[name] = object;
		}
		
		/**
		 * Binds a name to an added object
		 * 
		 * @param graphObject The binding key
		 * @param gameObject The added object name
		 */
		this.bind = function (graphObject, gameObject) {
			if(this.nodes[gameObject] == null){
				console.error("Unable to bind to non-existent node: "+gameObject);
			}
			this.bindings[graphObject] = this.nodes[gameObject];
		}
		
		/**
		 * Executes a function on a bound object through the bind map
		 * The function must exist on the object mapped through the bind map
		 * 
		 * @param graphObject The binding key
		 * @param fn The function to be called
		 * @param args Array of arguments
		 */
		this.exec = function (graphObject, fn, args) {
			if (this.bindings[graphObject][fn]) {
				this.bindings[graphObject][fn].apply(this.bindings[graphObject], args)
			}
			else{
				console.error("Unable to execute non-existent function "+fn+" on "+graphObject);
			}
		}
		
		/**
		 * Adds an action for an object to the action stack
		 * Object must exist in the bind map
		 *
		 * @param name The binding key
		 * @param action Action name
		 */
		this.addAction = function (name, action){
			if(this.bindings[name] == null){
				console.error("Unable to add action for "+name);
			}
			this.actions.push([name, action]);
		}
		
		/**
		 * Clears the action stack
		 */
		this.clearActions = function(){
			while(this.actions.length){
				this.actions.pop()
			}
		}
	}
	return new bindMap;
});
