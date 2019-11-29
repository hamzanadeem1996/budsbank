var fs = require('fs');
var pool = require('../config/db');
var async = require('async');
var CNST = require('../config/constant');
var jwt = require('jwt-simple');
var output;


exports.executeQuery = function executeQuery(Query) {
    return new Promise((resolve, reject) => {
        pool.getConnection(function (err, connection) {
            if (err) {
                resolve({ isSuccess: false, status: 400, message: err.message });
            }
            else {
                connection.query(Query, function (error, results) {
                    connection.release();
                    if (error) {
                        resolve({ isSuccess: false, status: 400, message: error.message });
                    }
                    else {
                        resolve({ data: results, status: 200, isSuccess: true });
                    }
                })
            }
        })
    })
};

exports.checkIfEmailInString = function checkIfEmailInString(string) {
    var re = /(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/;
    return re.test(string);
};

exports.checkValidPhone = function (phone) {
    return true;
};

exports.checkPhoneExists = function (phone) {
    return new Promise((resolve)=>{
        const SQL = `SELECT phone FROM users WHERE phone = ${phone}`;
        exports.executeQuery(SQL).then(response =>{
            if (!response.isSuccess){
                output = {status: 400, isSuccess: false, message: response.message };
            }else{
                var isPhoneExists = false;
                if (response.data.length > 0){
                    isPhoneExists = true;
                }
                output = { isPhoneExists: isPhoneExists, isSuccess: true };
                resolve(output);
            }
        });
    });
};

exports.checkUserNameExists = function(userName) {
    return new Promise((resolve)=>{
        const SQL = `SELECT username FROM users WHERE username = '${userName}'`;
        exports.executeQuery(SQL).then(response =>{
            console.log(response);
            if (!response.isSuccess){
                output = {status: 400, isSuccess: false, message: response.message };
            }else{
                var isUserNameExists = false;
                if (response.data.length > 0){
                    isUserNameExists = true;
                }
                output = { isUserNameExists: isUserNameExists, isSuccess: true };
                resolve(output);
            }
        });
    });
};

exports.checkEmailExists = function (email) {
  return new Promise((resolve) => {
    var SQL = `SELECT email FROM users WHERE email = '${email}'`;
    exports.executeQuery(SQL).then(response=>{
       if (!response.isSuccess){
           output = {status: 400, isSuccess: false, message: response.message };
       } else{
           var isEmailExists = false;
           if (response.data.length > 0){
               isEmailExists = true;
           }
           output = {isEmailExists: isEmailExists, isSuccess: true };
       }
       resolve(output);
    });
  });
};

exports.addUser = function (user) {
  return new Promise((resolve)=>{
    var SQL = `INSERT INTO users SET username = '${user.user_name}', email = '${user.email}', first_name = '${user.first_name}', last_name = '${user.last_name}', phone = '${user.phone}', password = '${user.password}'`;
    exports.executeQuery(SQL).then(response => {
       if (!response.isSuccess){
           output = {status: 400, isSuccess: false, message: response.message };
       }else{
           var lastInsertId = response.data.insertId;
           var token = jwt.encode({
               userId: lastInsertId
           }, process.env.TOKEN_SECRET);
           let addAuthTokenSql = `INSERT INTO user_token SET token = '${token}', user_id = ${lastInsertId}`;
           exports.executeQuery(addAuthTokenSql).then(responseForToken => {
              if (!responseForToken.isSuccess){
                  output = {status: 400, isSuccess: false, message: responseForToken.message };
              } else{
                  var SQL = `INSERT INTO coins SET user_id = ${lastInsertId}, coins = 0`;
                  exports.executeQuery(SQL).then(responseForCoins => {
                     if (!responseForCoins.isSuccess){
                         output = {status: 400, isSuccess: false, message: responseForCoins.message };
                     } else{
                         var SQL = `SELECT t.token as session_token, u.id, u.email, u.email_verified_at, u.username, u.first_name, u.last_name, u.image, c.coins as coins_earned FROM users as u INNER JOIN user_token as t ON u.id = t.user_id INNER JOIN coins as c ON c.user_id = u.id WHERE u.id = ${lastInsertId}`;
                         exports.executeQuery(SQL).then(responseForUserModel => {
                             if (!responseForUserModel.isSuccess){
                                 output = {status: 400, isSuccess: false, message: responseForUserModel.message };
                             }

                             output = {status: 200, isSuccess: true, message: "User Registered Successfully", user: responseForUserModel.data[0]  };
                             resolve(output);
                         });
                     }
                  });
              }
           });
       }
    });
  });
};

exports.validateHeader = function (req) {
  return new Promise((resolve)=>{
    var headerValue = Buffer.from(req.headers.authorization.split(" ")[1], 'base64').toString();
    if (headerValue === 'budsBank:budsBank007'){
        output = { status: 200, isSuccess: true, message: "Valid Request"};
    }else{
        output = { status: 401, isSuccess: false, message: "In-valid Request"};
    }
    resolve(output)
  });
};
