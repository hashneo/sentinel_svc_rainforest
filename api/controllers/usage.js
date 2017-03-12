'use strict';

module.exports.getUsage = (req, res) => {

    let id = req.swagger.params.id.value;
    let range = req.swagger.params.range.value;
    let start = req.swagger.params.start.value;

    if ( start ){
        start = start.toUTCString().replace('GMT','');
        start = new Date( start );
    }

    if ( !start )
        start = new Date();

    getUsageBy[range]( id, start, res );

};

let getUsageBy = {};

getUsageBy['hour'] = (id, start, res) => {

    global.rainforest.getDevices()
        .then( (devices) => {
            res.json( { data: devices, result : 'ok'  } );
        })
        .catch( (err) => {
            res.status(500).json( { code: err.code || 0, message: err.message } );
        });
};

getUsageBy['day'] = (id, start, res) => {

};

getUsageBy['week'] = (id, start, res) => {

};

getUsageBy['month'] = (id, start, res) => {

};

getUsageBy['year'] = (id, start, res) => {

};
