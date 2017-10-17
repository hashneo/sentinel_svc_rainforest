'use strict';
require('array.prototype.find');

function rainforest(config) {

    if ( !(this instanceof rainforest) ){
        return new rainforest(config);
    }

    const redis = require('redis');

    let pub = redis.createClient(
        {
            host: process.env.REDIS || global.config.redis || '127.0.0.1' ,
            socket_keepalive: true,
            retry_unfulfilled_commands: true
        }
    );

    pub.on('end', function(e){
        console.log('Redis hung up, committing suicide');
        process.exit(1);
    });

    const moment = require('moment');

    const NodeCache = require( "node-cache" );

    const request = require('request');
    let http = require('http');
    const mysql = require('./mysql');

    let deviceCache = new NodeCache();
    let statusCache = new NodeCache();

    let keepAliveAgent = new http.Agent({ keepAlive: true });

    let db;

    deviceCache.on( 'set', function( key, value ){
        let data = JSON.stringify( { module: 'rainforest', id : key, value : value });
        console.log( 'sentinel.device.insert => ' + data );
        pub.publish( 'sentinel.device.insert', data);
    });

    deviceCache.on( 'delete', function( key ){
        let data = JSON.stringify( { module: 'rainforest', id : key });
        console.log( 'sentinel.device.delete => ' + data );
        pub.publish( 'sentinel.device.delete', data);
    });

    statusCache.on( 'set', function( key, value ){
        let data = JSON.stringify( { module: 'rainforest', id : key, value : value });
        console.log( 'sentinel.device.update => ' + data );
        pub.publish( 'sentinel.device.update', data);
    });

    function call(url, command, macId) {

        return new Promise( ( fulfill, reject ) => {

            let data = '<LocalCommand>\n<Name>' + command + '</Name>\n<MacId>0x' + macId + '</MacId>\n</LocalCommand>\n';

            let options = {
                url : url,
                timeout : 30000,
                body : data,
                contentType : 'application/x-www-form-urlencoded; charset=UTF-8',
                agent: keepAliveAgent
            };

            try {
                request.post(options, function (err, response, body) {
                    if (!err && body.indexOf("ERROR:") != 0 && response.statusCode == 200) {
                        let v = null;
                        try {
                            v = JSON.parse(body);
                            fulfill(v);
                        } catch (e) {
                            reject(e);
                        }
                    } else {
                        console.error("request failed => " + err);
                        reject(err);
                    }
                });
            }catch(err){
                console.error("request error => " + err);
                reject(err);
            }
        } );
    }

    this.getDevices = () => {

        return new Promise( (fulfill, reject) => {
            deviceCache.keys( ( err, ids ) => {
                if (err)
                    return reject(err);

                deviceCache.mget( ids, (err,values) =>{
                    if (err)
                        return reject(err);

                    statusCache.mget( ids, (err, statuses) => {
                        if (err)
                            return reject(err);

                        let data = [];

                        for (let key in values) {
                            let v = values[key];

                            if ( statuses[key] ) {
                                v.current = statuses[key];
                                data.push(v);
                            }
                        }

                        fulfill(data);
                    });

                });
            });
        });
    };

    this.getDeviceStatus = (id) => {

        return new Promise( (fulfill, reject) => {
            try {
                statusCache.get(id, (err, value) => {
                    if (err)
                        return reject(err);

                    fulfill(value);
                }, true);
            }catch(err){
                reject(err);
            }
        });

    };

    this.getData = (q) => {
        return new Promise( (fulfill, reject) => {
            try {
                db.query(q)
                .then( (rows,fields) => {
                    fulfill(rows);
                })
                .catch((err) => {
                    console.error(err);
                    reject(err);
                });
            }catch(err){
                reject(err);
            }
        });
    };

    function updateStatus() {

        return new Promise( ( fulfill, reject ) => {

            let sample;

            let macId = config.macId;
            let address = config.address;

            deviceCache.get( macId, (err, device) => {

                if (err)
                    return reject(err);

                call('http://' + address + '/cgi-bin/cgi_manager', 'get_usage_data', macId)

                    .then((status) => {
                        if (status.demand_timestamp === undefined) {
                            return reject();
                        }
                        sample = status;
                        return db.insert('samples',
                            {
                                mac_id: macId,
                                sample_ts: new Date(),
                                meter_status: status.meter_status,
                                demand: status.demand,
                                demand_units: status.demand_units,
                                demand_timestamp: status.demand_timestamp,
                                usage_timestamp: status.usage_timestamp,
                                summation_received: status.summation_received,
                                summation_delivered: status.summation_delivered,
                                summation_units: status.summation_units,
                                price: status.price,
                                price_units: status.price_units,
                                price_label: status.price_label,
                                message_timestamp: status.message_timestamp,
                                message_text: status.message_text,
                                message_confirmed: status.message_confirmed,
                                message_confirm_required: status.message_confirm_required,
                                message_id: status.message_id,
                                message_queue: status.message_queue,
                                message_priority: status.message_priority,
                                message_read: status.message_read
                            });

                    })
                    .then(() => {

                        //let offset = moment().utcOffset( device.location.timezone.offset);
                        let ts = moment.utc().add(config.tz_offset,'s').format('YYYY-MM-DD');

                        let q = `select t1.date, 
                             ( max(t1.max_summation_delivered) - min(t1.min_summation_delivered) ) -
                             ( max(t1.max_summation_received) - min(t1.min_summation_received) ) as nem
                             from (
                                 select 
                                 from_unixtime(t2.demand_timestamp, "%Y-%m-%d") as date,
                                 min(t2.summation_delivered) as min_summation_delivered,
                                 max(t2.summation_delivered) as max_summation_delivered,
                                 min(t2.summation_received) as min_summation_received,
                                 max(t2.summation_received) as max_summation_received
                                 from (
                                     select * from sentinel.samples where mac_id = '${macId}' and demand_timestamp >= UNIX_TIMESTAMP (DATE('${ts}'))
                                 ) t2
                                 group by date
                             ) t1 
                             group by t1.date
                             order by t1.date desc
                            `;

                        return db.query(q);
                    })
                    .then((rows, fields) => {

                        let s = {grid: {}};

                        s['nem'] = 0;

                        if (rows.length > 0)
                            s['nem'] = '' + rows[0].nem;

                        s['demand'] = sample.demand;
                        s['grid']['in'] = sample.summation_delivered;
                        s['grid']['out'] = sample.summation_received;

                        statusCache.set(macId, s);

                        fulfill(sample);
                    })
                    .catch((err) => {
                        console.error(err);
                        reject(err);
                    });
            });
        });
    }

    function loadSystem() {

        return new Promise( (fulfill, reject) => {

            console.log("Loading System");

            var deviceStatus;

            mysql.connect(config.db)
                .then((connection) => {
                    return connection.useDatabase('sentinel');
                })
                .then((schema) => {
                    db = schema;

                    return db.query(`
                    CREATE TABLE IF NOT EXISTS samples
                    (
                        sample_ts                DATETIME PRIMARY KEY NOT NULL, 
                        meter_status             TEXT, 
                        demand                   FLOAT ,  
                        demand_units             TEXT, 
                        demand_timestamp         INTEGER, 
                        usage_timestamp          INTEGER, 
                        summation_received       FLOAT, 
                        summation_delivered      FLOAT, 
                        summation_units          TEXT, 
                        price                    FLOAT, 
                        price_units              TEXT, 
                        price_label              TEXT, 
                        message_timestamp        INTEGER, 
                        message_text             TEXT, 
                        message_confirmed        TEXT, 
                        message_confirm_required TEXT, 
                        message_id               INTEGER, 
                        message_queue            TEXT, 
                        message_priority         TEXT, 
                        message_read             TEXT, 
                        mac_id                   VARCHAR(60),
                        UNIQUE INDEX idx_demand_timestamp (demand_timestamp)
                    );
                    `);

                })
                .then(() => {
                    return call('http://' + config.address + '/cgi-bin/cgi_manager', 'get_network_info', config.macId)
                })
                .then((status) => {
                    deviceStatus = status;
                    return call('http://' + config.address + '/cgi-bin/cgi_manager', 'get_timezone', config.macId)
                })
                .then((status) => {

                    let d = {};

                    d['name'] = config.name;
                    d['meterId'] = deviceStatus.network_meter_mac_id.substring;
                    d['id'] = config.macId;
                    d['type'] = 'power.meter';
                    d['current'] = {};
                    d['location'] = {};
                    d['location']['timezone'] = {}
                    d['location']['timezone']['name'] = status.timezone_tzName;
                    d['location']['timezone']['offset'] = status.timezone_utcOffset;

                    config.tz_offset = parseInt(status.timezone_localTime) - parseInt(status.timezone_utcTime);

                    deviceCache.set(d.id, d);

                    fulfill([d]);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    }

    this.Reload = () => {
        return new Promise( (fulfill,reject) => {
            fulfill([]);
        });
    };

    loadSystem()

        .then( () => {

            function pollSystem() {

                updateStatus()
                    .then((status) => {
                    })
                    .catch((err) => {
                        console.log("status returned error => " + err);
                    });
            }

            setInterval(pollSystem, 5000);
        })
        .catch( (err) => {
            console.log( err );
            system.exit(1);
        });

}

module.exports = rainforest;
