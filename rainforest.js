require('array.prototype.find');

module.exports = function (config, onDevice, onStatus) {

	var request = require('request');
	//var config = require('./config.json');

    var xmlParse = require('xml2js').parseString;

	var NodeCache = require( "node-cache" );
	var deviceCache = new NodeCache();
	var statusCache = new NodeCache();

    var sqlite3 = require('sqlite3').verbose();
    var db = new sqlite3.Database('./db.sqlite3');

    var moment = require('moment');

    var http = require('http');
    var keepAliveAgent = new http.Agent({ keepAlive: true, maxSockets: 1 });

    //require('request').debug = true

    var forAllAsync = exports.forAllAsync || require('forallasync').forAllAsync,
        maxCallsAtOnce = 1;

	var merge = require('deepmerge');

	var that = this;

	deviceCache.on( "set", function( key, value ){
		if ( onDevice !== undefined )
			onDevice(value);
	});

	statusCache.on( "set", function( key, value ){
		if ( onStatus !== undefined )
			onStatus(key, value);
	});

	function processStates(states) {
		var data = {};

		return data;
	}

	function call(url, command, macId, success, error) {

		var data = "<LocalCommand>\n<Name>" + command + "</Name>\n<MacId>0x" + macId + "</MacId>\n</LocalCommand>\n";

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
                    success(v);

                } else {
					console.log("request failed => " + err);
                    if (error !== undefined)
                        error(err);
                }
            });
        }catch(e){
            console.log("request error => " + e);
            if (error !== undefined)
                error(e);
        }
	}

	this.device = new function () {
		this.get = new function () {
			this.status = function (params, success, error) {
				var output = {};
				output['Status'] = statusCache.get(params.id);
                success(output);
			};
            this.data = function (params, success, error) {
                var days = params.days || 1;
                var output = {};
                /*
                db.all ( 'select * from samples where sample_ts >= ? group by demand_timestamp', [moment().subtract(days,'days').toISOString()], function(err, rows) {
                    if ( err ){
                        return error(err);
                    }
                    output['History'] = rows;
                    success(output);
                });
                */
            };
		};
	};

	this.status = function (params, success, error) {
        call('http://' + config.address + '/cgi-bin/cgi_manager', 'get_usage_data', config.macId, function (status) {
            if ( status.demand_timestamp === undefined ){
                error();
                return;
            }
            //console.log( "rainforest last updated => " + status.demand_timestamp);
/*
            db.run('INSERT INTO samples ( \
                        sample_ts, \
                        meter_status, \
                        demand, \
                        demand_units, \
                        demand_timestamp, \
                        usage_timestamp, \
                        summation_received, \
                        summation_delivered, \
                        summation_units, \
                        price, \
                        price_units, \
                        price_label, \
                        message_timestamp, \
                        message_text, \
                        message_confirmed, \
                        message_confirm_required, \
                        message_id, \
                        message_queue, \
                        message_priority, \
                        message_read ) \
                        VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )',
                [
                    moment().toISOString(),
                    status.meter_status,
                    status.demand,
                    status.demand_units,
                    status.demand_timestamp,
                    status.usage_timestamp,
                    status.summation_received,
                    status.summation_delivered,
                    status.summation_units,
                    status.price,
                    status.price_units,
                    status.price_label,
                    status.message_timestamp,
                    status.message_text,
                    status.message_confirmed,
                    status.message_confirm_required,
                    status.message_id,
                    status.message_queue,
                    status.message_priority,
                    status.message_read
                ] );
*/
            statusCache.set( config.macId, status );
            success(status);
        }, function(e){
            if (error !== undefined)
                error(e);
        });
	};

	this.system = function (params, success, error) {

        var d = deviceCache.get(config.macId);

        if ( d != undefined ){
            success([d]);
            return;
        }

        console.log("Loading System");

        call('http://' + config.address + '/cgi-bin/cgi_manager', 'get_network_info', config.macId, function (status) {

            var d = {};

            d['name'] = config.name;
            d['meterId'] = status.network_meter_mac_id.substring;
            d['id'] = config.macId;
            d['type'] = 'power.meter';
            d['current'] = {};

            deviceCache.set(d.id, d);

            success([d]);

        }, function(e){
            if (error !== undefined)
                error(e)
        });
	};

	this.endPoints = {
		"system": this.system,
		"status": this.status,
		"device/:id/status": this.device.get.status,
        "device/:id/data": this.device.get.data,
	};

    function updateStatus() {
        that.status({},
        function (status) {
            setTimeout(updateStatus, 5000);
        },
        function(e){
            if  (e !== undefined ) {
                console.log("status returned error => " + e);
            }
            setTimeout(updateStatus, 5000);
        });
    }

    function loadSystem(){

        db.serialize(function() {
            db.run('CREATE TABLE IF NOT EXISTS samples \
            ( \
                sample_ts                DATE PRIMARY KEY NOT NULL, \
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
            ); \
            CREATE UNIQUE INDEX table_name_id_uindex ON data (ts); ');

        });

        //db.close();

        this.system( {},
        function(){
            setTimeout(updateStatus, 5000);
        },
        function(){
            console.log("Failed to load, retrying in 5 seconds");
            setTimeout(loadSystem, 5000)
        });
    }

    loadSystem();

	return this;
}

