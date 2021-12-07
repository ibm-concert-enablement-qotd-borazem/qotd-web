// this file is for actions/anomalies specific to this component

function action(details){

    if( typeof details.replicate != 'undefined' && details.replicate >= 0 ) {
        _replicate = details.replicate;
        return { "msg": "Updated rating call replication: "+_replicate};
    } else {
        return { "msg": "No change.  Replication: "+_replicate };
    }
}

exports.action = action;

var _replicate = 0;

function callReplicate(){
    return _replicate;
}

exports.callReplicate = callReplicate;

