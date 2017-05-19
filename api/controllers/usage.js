'use strict';

const moment = require('moment');

module.exports.getUsage = (req, res) => {

    let id = req.swagger.params.id.value;
    let range = req.swagger.params.range.value;
    let end = req.swagger.params.end.value;

    if ( end ){
        end = start.toUTCString().replace('GMT','');
        end = new Date( end );
    }

    if ( !end )
        end = new Date();

    getUsageBy[range]( id, end, res );

};

let getUsageBy = {};

getUsageBy['hour'] = (id, end, res) => {

    let ts1 = moment(end).format('YYYY-MM-DD');
    let ts2 = moment(end).add(1, 'd').format('YYYY-MM-DD');

    let q = `
    select
        from_unixtime(t2.demand_timestamp, "%H") as hour,
        (max(t2.summation_delivered) - min(t2.summation_delivered)) - (max(t2.summation_received) - min(t2.summation_received)) as kwh
    from (
        select * from sentinel.samples where mac_id = '${id}' and demand_timestamp >= UNIX_TIMESTAMP (DATE('${ts1}')) AND demand_timestamp < UNIX_TIMESTAMP (DATE('${ts2}') )
    ) t2
    group by hour`;

    global.rainforest.getData(q)
        .then( (data) => {
            let r = { start : ts1, end : ts2, samples : data };
            res.json( { data: r, result : 'ok'  } );
        })
        .catch( (err) => {
            res.status(500).json( { code: err.code || 0, message: err.message } );
        });
};

getUsageBy['day'] = (id, end, res) => {

    let ts1 = moment(end).subtract(1, 'd').format('YYYY-MM-DD');
    let ts2 = moment(end).format('YYYY-MM-DD');

    let q = `
    select
        from_unixtime(t2.demand_timestamp, "%Y-%m-%d") as date,
        (max(t2.summation_delivered) - min(t2.summation_delivered)) - (max(t2.summation_received) - min(t2.summation_received)) as kwh
    from (
        select * from sentinel.samples where mac_id = '${id}' and demand_timestamp > UNIX_TIMESTAMP (DATE('${ts2}')) AND demand_timestamp <= UNIX_TIMESTAMP (TIMESTAMP('${ts2} 23:59:59') )
    ) t2
    group by date`;

    global.rainforest.getData(q)
        .then( (data) => {
            let r = { start : ts1, end : ts2, samples : data };
            res.json( { data: r, result : 'ok'  } );
        })
        .catch( (err) => {
            res.status(500).json( { code: err.code || 0, message: err.message } );
        });
};

getUsageBy['week'] = (id, end, res) => {

    let ts1 = moment(end).subtract(7, 'd').format('YYYY-MM-DD');
    let ts2 = moment(end).format('YYYY-MM-DD');

    let q = `
    select
        from_unixtime(t2.demand_timestamp, "%Y-%m-%d") as date,
        (max(t2.summation_delivered) - min(t2.summation_delivered)) - (max(t2.summation_received) - min(t2.summation_received)) as kwh
    from (
        select * from sentinel.samples where mac_id = '${id}' and demand_timestamp > UNIX_TIMESTAMP (DATE('${ts1}')) AND demand_timestamp <= UNIX_TIMESTAMP (TIMESTAMP('${ts2} 23:59:59') )
    ) t2
    group by date`;

    global.rainforest.getData(q)
        .then( (data) => {
            let r = { start : ts1, end : ts2, samples : data };
            res.json( { data: r, result : 'ok'  } );
        })
        .catch( (err) => {
            res.status(500).json( { code: err.code || 0, message: err.message } );
        });
};

getUsageBy['month'] = (id, end, res) => {

    let ts1 = moment(end).subtract(30, 'd').format('YYYY-MM-DD');
    let ts2 = moment(end).format('YYYY-MM-DD');

    let q = `
    select
        from_unixtime(t2.demand_timestamp, "%Y-%m-%d") as date,
        (max(t2.summation_delivered) - min(t2.summation_delivered)) - (max(t2.summation_received) - min(t2.summation_received)) as kwh
    from (
        select * from sentinel.samples where mac_id = '${id}' and demand_timestamp > UNIX_TIMESTAMP (DATE('${ts1}')) AND demand_timestamp <= UNIX_TIMESTAMP (TIMESTAMP('${ts2} 23:59:59') )
    ) t2
    group by date`;

    global.rainforest.getData(q)
        .then( (data) => {
            let r = { start : ts1, end : ts2, samples : data };
            res.json( { data: r, result : 'ok'  } );
        })
        .catch( (err) => {
            res.status(500).json( { code: err.code || 0, message: err.message } );
        });
};

getUsageBy['year'] = (id, start, res) => {

    let ts1 = moment(end).subtract(365, 'd').format('YYYY-MM-DD');
    let ts2 = moment(end).format('YYYY-MM-DD');

    let q = `
    select
        from_unixtime(t2.demand_timestamp, "%Y-%m") as date,
        (max(t2.summation_delivered) - min(t2.summation_delivered)) - (max(t2.summation_received) - min(t2.summation_received)) as kwh
    from (
        select * from sentinel.samples where mac_id = '${id}' and demand_timestamp > UNIX_TIMESTAMP (DATE('${ts1}')) AND demand_timestamp <= UNIX_TIMESTAMP (TIMESTAMP('${ts2} 23:59:59') )
    ) t2
    group by date`;

    global.rainforest.getData(q)
        .then( (data) => {
            let r = { start : ts1, end : ts2, samples : data };
            res.json( { data: r, result : 'ok'  } );
        })
        .catch( (err) => {
            res.status(500).json( { code: err.code || 0, message: err.message } );
        });
};
