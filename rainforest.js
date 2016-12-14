'use strict';
require('array.prototype.find');

function rainforest(config) {

    if ( !(this instanceof rainforest) ){
        return new rainforest(config);
    }

    const redis = require('redis');

    let pub = redis.createClient({ host: '10.0.1.10' });

    var NodeCache = require( "node-cache" );

    var deviceCache = new NodeCache();
    var statusCache = new NodeCache();

    var request = require('request');
    var http = require('http');
    var keepAliveAgent = new http.Agent({ keepAlive: true });

    var mysql = require('./mysql');
    var db;

    deviceCache.on( "set", function( key, value ){
    });

    statusCache.on( "set", function( key, value ){
        pub.publish("sentinel.device.update",  JSON.stringify( { module: 'rainforest', id : key, value : value } ) );
    });

    function call(url, command, macId) {

        return new Promise( ( fulfill, failure ) => {

            var data = '<LocalCommand>\n<Name>' + command + '</Name>\n<MacId>0x' + macId + '</MacId>\n</LocalCommand>\n';

            var options = {
                url : url,
                timeout : 30000,
                body : data,
                contentType : 'application/x-www-form-urlencoded; charset=UTF-8',
                agent: keepAliveAgent
            };

            try {
                request.post(options, function (err, response, body) {
                    if (!err && body.indexOf("ERROR:") != 0 && response.statusCode == 200) {
                        var v = null;
                        try {
                            v = JSON.parse(body);
                        } catch (e) {
                        }
                        fulfill(v);

                    } else {
                        console.log("request failed => " + err);
                        failure(err);
                    }
                });
            }catch(e){
                console.log("request error => " + e);
                failure(e);
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

                    var data = [];

                    for (var key in values) {
                        data.push(values[key]);
                    }

                    fulfill(data);
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

    function updateStatus() {

        return new Promise( ( fulfill, reject ) => {

            let sample;

            call('http://' + config.address + '/cgi-bin/cgi_manager', 'get_usage_data', config.macId)

                .then((status) => {
                    if (status.demand_timestamp === undefined) {
                        return reject();
                    }
                    sample = status;
                    return db.insert('samples',
                    {
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
                .then( () => {
                    return db.query( `
                        select t1.date, 
                        ( max(t1.max_summation_delivered) - min(t1.min_summation_delivered) ) -
                        ( max(t1.max_summation_received) - min(t1.min_summation_received) ) as nem
                        from (
                            select 
                            from_unixtime(demand_timestamp, '%Y%m%d') as date,
                            from_unixtime(demand_timestamp, '%h') as hour, 
                            min(summation_delivered) as min_summation_delivered,
                            max(summation_delivered) as max_summation_delivered,
                            min(summation_received) as min_summation_received,
                            max(summation_received) as max_summation_received
                            from sentinel.samples
                            group by demand_timestamp
                            
                        ) t1 
                        group by t1.date
                        order by t1.date desc
                        limit 1
                    `)
                })
                .then( (rows,fields) => {
                    if ( rows.length > 0 )
                        sample['today_nem'] = '' + rows[0].nem;
                    statusCache.set(config.macId, sample);
                    fulfill(sample);
                })
                .catch((err) => {
                    console.log(err);
                    reject(err);
                });

        });
    }

    function loadSystem() {

        return new Promise( (fulfill, reject) => {

            console.log("Loading System");

            mysql.connect(config.db)
                .then((connection) => {
                    return connection.useDatabase('sentinel');
                })
                .then((schema) => {
                    db = schema;

                    return db.query('CREATE TABLE IF NOT EXISTS samples \
                                    ( \
                                        sample_ts                DATETIME PRIMARY KEY NOT NULL, \
                                        meter_status             TEXT, \
                                        demand                   FLOAT ,  \
                                        demand_units             TEXT, \
                                        demand_timestamp         INTEGER, \
                                        usage_timestamp          INTEGER, \
                                        summation_received       FLOAT, \
                                        summation_delivered      FLOAT, \
                                        summation_units          TEXT, \
                                        price                    FLOAT, \
                                        price_units              TEXT, \
                                        price_label              TEXT, \
                                        message_timestamp        INTEGER, \
                                        message_text             TEXT, \
                                        message_confirmed        TEXT, \
                                        message_confirm_required TEXT, \
                                        message_id               INTEGER, \
                                        message_queue            TEXT, \
                                        message_priority         TEXT, \
                                        message_read             TEXT \
                                    );');

                })
                .then(() => {
                    return call('http://' + config.address + '/cgi-bin/cgi_manager', 'get_network_info', config.macId)
                })
                .then((status) => {

                    var d = {};

                    d['name'] = config.name;
                    d['meterId'] = status.network_meter_mac_id.substring;
                    d['id'] = config.macId;
                    d['type'] = 'power.meter';
                    d['current'] = {};

                    deviceCache.set(d.id, d);

                    fulfill([d]);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    }

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
        });

}

module.exports = rainforest;

