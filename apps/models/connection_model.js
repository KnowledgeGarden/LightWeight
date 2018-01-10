/* @author park */
var constants = require('../constants');
var Database = require('../drivers/file_database_driver');
var CommonModel;
var Connection,
    instance;

Connection = function() {
    var self = this;

    self.inject = function(commModel) {
        CommonModel = commModel;
        //console.log("ConnectionModel",this);        
    };

    function populateConnection(userId, connection, callback) {
        console.log("ConnectionModel.populateConnection",connection);
        if (connection.theSource && connection.theTarget) {
            return callback();
        } else {
            var nx = connection.sourceNode;
            var strut;
            CommonModel.fetchNode(userId, nx, function(err, kid) {
                console.log("ConnectionModel.populateConnection-1",err,kid);
                struct = {};
                struct.id = kid.id;
                struct.img = kid.imgsm;
                struct.creatorId = kid.creatorId;
                struct.type = kid.type;
                struct.statement = kid.statement;
                connection.theSource = struct;
                nx = connection.targetNode;
                CommonModel.fetchNode(userId, nx, function(err, kid2) {
                    console.log("ConnectionModel.populateConnection-1",err,kid2);
                    struct = {};
                    struct.id = kid2.id;
                    struct.img = kid2.imgsm;
                    struct.creatorId = kid2.creatorId;
                    struct.type = kid2.type;
                    struct.statement = kid2.statement;
                    connection.theTarget = struct;
                    return callback()
                });
            });
        }
    };

    self.fetchConnection = function(userId, id, callback) {
        console.log("ConnectionModel.fetchConnection",id);
        CommonModel.fetchNode(userId, id, function(err, data) {
            if (err) {
                return callback(err, null);
            }
            // There can be connections between public and private
            // Technically, should never see such a node
            if (!data) {
                return callback(constants.INSUFFICIENT_CREDENTIALS, null);
            }
            CommonModel.populateNode(userId, data, function(node) {
                console.log("ConnectionModel.fetchConnection++",err,node);
                populateConnection(userId, node, function() {
                    return callback(err, node);
                });
            });
        });
    };


    ///////////////////
    //{ source: '1514850286436',target: '1514849576267',select: 'ImpliesRelationType', 'isPrivate':false }
    // Each node in a relation gets its own relation link to a single relation node
    // We craft a relation node identity based on source, relationType, and target
    //  which makes it content-addressable.
    // That supports a policy: no duplicate relations allowed
    ///////////////////

    /**
     * Will return a "Duplicate" error message if the connection already exists
     * Relation node takes the privacy policy of its sourceNode
     * @param {*} creatorId
     * @param creatorHandle
     * @param {*} jsonBody 
     * @param {*} callback err
     */
    self.createConnection = function(creatorId, creatorHandle, jsonBody, callback) {
        console.log("ConnectionModel.createConnection",creatorId, jsonBody);

        var relnId = jsonBody.source+"."+jsonBody.selected+"."+jsonBody.target;
        CommonModel.fetchNode(creatorId, relnId, function(err, data) {
            //if (err) {
            //    callback(err)
            //}
            if (data) { //error -- already exists
                return callback(constants.DUPLICATE_ERROR);
            } else { // build the connection
                //fetch this connectionType's description
                Database.fetchConnectionResource(jsonBody.selected, function(err, resource) {
                    console.log("ConnectionModel.createConnection",jsonBody.selected, resource);
                    //fetch source
//TODO MUST USE CommonModel.fetchNode
                    var acls;
                    Database.fetchData(jsonBody.source, function(err, sourceNode) {
                        var isPrivS = sourceNode.isPrivate;
                        if (isPrivS) {
                            acls = sourceNode.acls;
                        }
                        //fetch target
                        Database.fetchData(jsonBody.target, function(err, targetNode) {
                            var isPrivT = targetNode.isPrivate;
                            var isPrivate = false;
                            if (isPrivS) {
                                isPrivate = true;
                            } else if (isPrivT) {
                                isPrivate = true;
                                acls = targetNode.acls;
                            }
                            
                            //craft a relation node
                            var label = jsonBody.selected;
                            var details = sourceNode.statement+" "+resource.asSource+targetNode.statement;
                            CommonModel.newNode(relnId, creatorId, handle, constants.RELATION_NODE_TYPE,
                                    label, details, isPrivate, function(json) {
                                json.sourceNode = sourceNode.id;
                                json.targetNode = targetNode.id;
                                if (isPrivate) {
                                    json.acls = acls;
                                }
                                
                                console.log("ConnectionModel.createConnection-2",json);
                                //wire the source node
                                var lx = CommonModel.getChildList(constants.RELATION_NODE_TYPE, sourceNode);
                                lx.push(relnId);
                                console.log("ConnectionModel.createConnection-3",lx);
                                CommonModel.setChildList(constants.RELATION_NODE_TYPE, lx, sourceNode);
                                //wire the target node;
                                lx = CommonModel.getChildList(constants.RELATION_NODE_TYPE, targetNode);
                                lx.push(relnId);
                                console.log("ConnectionModel.createConnection-4",lx);
                                CommonModel.setChildList(constants.RELATION_NODE_TYPE, lx, targetNode);
                                //save the nodes
                                Database.saveNodeData(relnId, json, function(err) {
                                    Database.saveData(sourceNode.id, sourceNode, function(err) {
                                        Database.saveData(targetNode.id, targetNode, function(err) {
                                            return callback(err);
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            }
        });
    };
};
if (!instance) {
    instance = new Connection();
}
module.exports = instance;
