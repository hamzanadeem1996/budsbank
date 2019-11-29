var mysql = require('mysql');
var pool = "";
const environment = process.env.NODE_ENV || 'prod';

if (environment === 'dev') {
    pool = mysql.createPool({
        connectionLimit: 100,
        host: '127.0.0.1',
        user: process.env.DB_USERNAME,
        password: '',
        database: process.env.DB_NAME,
        debug: false
    });
}
else {
    pool = mysql.createPool({
        connectionLimit: 100,
        host: '127.0.0.1',
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        debug: false
    });
}
module.exports = pool;

