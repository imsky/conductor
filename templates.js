define(["text!templates/node.html", "text!templates/edit_entity.html", "text!templates/edit_condition.html", "text!templates/edit_trigger.html", "text!templates/keytable.html", "text!templates/edit_handler.html", "text!templates/logic.html"], 
function(node, editEntity, editCondition, editTrigger, keyTable, editHandler, logic){
return {
node: Hogan.compile(node),
edit_entity: Hogan.compile(editEntity),
edit_condition: Hogan.compile(editCondition),
edit_trigger: Hogan.compile(editTrigger),
edit_handler: Hogan.compile(editHandler),
keyTable: Hogan.compile(keyTable),
logic: Hogan.compile(logic)
}
})
