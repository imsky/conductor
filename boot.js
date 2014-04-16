require.config({
	urlArgs: "bust=" + Number(new Date)
});

//This file is used to cache-bust app.js
require(["app"], function(){
	console.log("Conductor loaded");
})
