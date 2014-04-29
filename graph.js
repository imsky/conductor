define([], function () {
	var Graph = function () {
		this.nodes = {};
		this.add = function (name, config) {
			var obj = {
				name: name,
				config: config
			}
			this.nodes[name] = obj;
		}
		this.findByField = function(field, value){
			var ret = [];
			for(var n in this.nodes){
				if(this.nodes[n].config[field] != null){
					if(this.nodes[n].config[field] == value){
						ret.push(n)
					}
				}
			}
			return ret;
		}
	}
	return Graph;
})
