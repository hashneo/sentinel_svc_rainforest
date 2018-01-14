'use strict';

const parser = require('xml2json');

module.exports.postData = (req, res) => {

    try {
        //let data = req.swagger.params.data.value;
        let json = JSON.parse(parser.toJson(req.rawBody));

        res.status(200).end();
    }
    catch(err){
        console.error(err);
        res.status(500).end();
    }
};
