'use strict';

const moment = require('moment');

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

    let ts = moment(start).format('YYYY-MM-DD');

    let q = `select t1.hour, 
                ( max(t1.max_summation_delivered) - min(t1.min_summation_delivered) ) -
                ( max(t1.max_summation_received) - min(t1.min_summation_received) ) as nem
                from (
                    select 
                    from_unixtime(t2.demand_timestamp, '%H') as hour,
                    min(t2.summation_delivered) as min_summation_delivered,
                    max(t2.summation_delivered) as max_summation_delivered,
                    min(t2.summation_received) as min_summation_received,
                    max(t2.summation_received) as max_summation_received
                    from (
                        select * from sentinel.samples where mac_id = '${id}' and demand_timestamp >= UNIX_TIMESTAMP (DATE('${ts}'))
                    ) t2
                    group by hour
                ) t1 
                group by t1.hour
                order by t1.hour asc`;

    global.rainforest.getData(q)
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
