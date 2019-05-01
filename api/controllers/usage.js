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

getUsageBy['now'] = (id, start, res) => {

    let ts1 = moment(start).format('YYYY-MM-DD');
    let ts2 = moment(start).add(1, 'd').format('YYYY-MM-DD');

    let q = `
    select
        from_unixtime(t2.demand_timestamp, "%H") as hour,
        (max(t2.summation_delivered) - min(t2.summation_delivered)) - (max(t2.summation_received) - min(t2.summation_received)) as kwh
    from (
        select * from sentinel.samples where summation_received > 0 and mac_id = '${id}' and demand_timestamp >= UNIX_TIMESTAMP (DATE('${ts1}')) AND demand_timestamp < UNIX_TIMESTAMP (DATE('${ts2}') )
    ) t2
    group by hour`;

    global.module.getData(q)
        .then( (data) => {
            res.json( { data: data, result : 'ok'  } );
        })
        .catch( (err) => {
            res.status(500).json( { code: err.code || 0, message: err.message } );
        });
};

getUsageBy['day'] = (id, start, res) => {

    let ts1 = moment(start).format('YYYY-MM-DD');
    let ts2 = moment(start).add(1, 'd').format('YYYY-MM-DD');

    let q = `
    select
        from_unixtime(t2.demand_timestamp, "%H") as hour,
        (max(t2.summation_delivered) - min(t2.summation_delivered)) - (max(t2.summation_received) - min(t2.summation_received)) as kwh
    from (
        select * from sentinel.samples where summation_received > 0 and mac_id = '${id}' and demand_timestamp >= UNIX_TIMESTAMP (DATE('${ts1}')) AND demand_timestamp < UNIX_TIMESTAMP (DATE('${ts2}') )
    ) t2
    group by hour`;

    global.module.getData(q)
        .then( (data) => {
            res.json( { data: data, result : 'ok'  } );
        })
        .catch( (err) => {
            res.status(500).json( { code: err.code || 0, message: err.message } );
        });
};

getUsageBy['week'] = (id, start, res) => {

    let ts1 = moment(start).format('YYYY-MM-DD');
    let ts2 = moment(start).add(1, 'w').format('YYYY-MM-DD');

    let q = `
    select
        from_unixtime(t2.demand_timestamp, "%Y-%m-%d") as date,
        (max(t2.summation_delivered) - min(t2.summation_delivered)) - (max(t2.summation_received) - min(t2.summation_received)) as kwh
    from (
        select * from sentinel.samples where summation_received > 0 and mac_id = '${id}' and demand_timestamp > UNIX_TIMESTAMP (DATE('${ts1}')) AND demand_timestamp <= UNIX_TIMESTAMP (TIMESTAMP('${ts2} 23:59:59') )
    ) t2
    group by date`;

    global.module.getData(q)
        .then( (data) => {
            res.json( { data: data, result : 'ok'  } );
        })
        .catch( (err) => {
            res.status(500).json( { code: err.code || 0, message: err.message } );
        });
};

getUsageBy['month'] = (id, start, res) => {

    let ts1 = moment(start).format('YYYY-MM-DD');
    let ts2 = moment(start).add(1, 'M').format('YYYY-MM-DD');

    let q = `
    select
        from_unixtime(t2.demand_timestamp, "%Y-%m-%d") as date,
        (max(t2.summation_delivered) - min(t2.summation_delivered)) - (max(t2.summation_received) - min(t2.summation_received)) as kwh
    from (
        select * from sentinel.samples where summation_received > 0 and mac_id = '${id}' and demand_timestamp > UNIX_TIMESTAMP (DATE('${ts1}')) AND demand_timestamp <= UNIX_TIMESTAMP (TIMESTAMP('${ts2} 23:59:59') )
    ) t2
    group by date`;

    global.module.getData(q)
        .then( (data) => {
            res.json( { data: data, result : 'ok'  } );
        })
        .catch( (err) => {
            res.status(500).json( { code: err.code || 0, message: err.message } );
        });
};

getUsageBy['year'] = (id, start, res) => {

    let ts1 = moment(start).format('YYYY-MM-DD');
    let ts2 = moment(start).subtract(1, 'y').format('YYYY-MM-DD');

    let q = `
    select
        from_unixtime(t2.demand_timestamp, "%Y-%m") as date,
        (max(t2.summation_delivered) - min(t2.summation_delivered)) - (max(t2.summation_received) - min(t2.summation_received)) as kwh
    from (
        select * from sentinel.samples where summation_received > 0 and mac_id = '${id}' and demand_timestamp > UNIX_TIMESTAMP (DATE('${ts1}')) AND demand_timestamp <= UNIX_TIMESTAMP (TIMESTAMP('${ts2} 23:59:59') )
    ) t2
    group by date`;

    global.module.getData(q)
        .then( (data) => {
            res.json( { data: data, result : 'ok'  } );
        })
        .catch( (err) => {
            res.status(500).json( { code: err.code || 0, message: err.message } );
        });
};
