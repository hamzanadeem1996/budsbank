var pool = require('../config/db');
var async = require('async');
var jwt = require('jwt-simple');
var output;
var moment = require('moment');
var dispensary = require('../routes/dispansaries');


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
                         var SQL = `SELECT t.token as session_token, u.id, u.email, u.phone, u.email_verified_at, u.username, u.first_name, u.last_name, u.image, c.coins as coins_earned FROM users as u INNER JOIN user_token as t ON u.id = t.user_id INNER JOIN coins as c ON c.user_id = u.id WHERE u.id = ${lastInsertId}`;
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

exports.checkFollowedDispensaries = function (dispensaries, userID) {
  return new Promise((resolve, reject) => {
    async.eachOfSeries(dispensaries, function (data, index, callback) {
        SQL = `SELECT isFollowed FROM user_dispensaries WHERE (dispensary_id = ${data.id} AND user_id = ${userID})`;
        exports.executeQuery(SQL).then(responseForQuery => {
           if (!responseForQuery.isSuccess){
               reject(responseForQuery.message);
           } else{
                if (responseForQuery.data.length > 0){
                    if (responseForQuery.data[0].isFollowed === 'true' || responseForQuery.data[0].isFollowed === true){
                        dispensaries[index]["is_followed"] = true;
                    }else{
                        dispensaries[index]["is_followed"] = false;
                    }
                }else{
                    dispensaries[index]["is_followed"] = false;
                }
                dispensary.getDispensaryTimmings(data.id).then(responseForTime => {
                  if (!responseForTime.isSuccess){ console.log(responseForTime);
                    output = {status: 400, isSuccess: false, message: responseForTime.message};
                    resolve(output);
                  } { console.log(responseForTime.timming);
                    dispensaries[index]['open_close_time'] = responseForTime.timming;
                  }
                });
           }
            callback();
        });
    }, function (err) {
          if (err) return next(err);
          resolve(dispensaries);
      });
  });
};

exports.getQuizQuestions = function (quizID, userID) {
  return new Promise((resolve) => {
    SQL = `SELECT id, quiz_id, question FROM quiz_questions WHERE quiz_id = ${quizID} AND status = 1`;
    var Data = {};
    var randomQuestion = [];
    var questionsList = [];
    exports.executeQuery(SQL).then(responseForQuestions => {
        if (!responseForQuestions.isSuccess){
            output = {status: 400, isSuccess: false, message: responseForQuestions.message}
            resolve(output);
        }else{
            if (responseForQuestions.data.length > 0){
                while (randomQuestion.length !== 5){
                    var item = responseForQuestions.data[Math.floor(Math.random()*responseForQuestions.data.length)];
                    if (randomQuestion.indexOf(item) === -1){
                        randomQuestion.push(item);
                    }
                }
                exports.getRandomQuestion(randomQuestion, userID, quizID).then(responseForRandomQuestion => {
                     for(x in responseForRandomQuestion){
                         if (responseForRandomQuestion[x] !== " "){
                             questionsList.push(responseForRandomQuestion[x])
                         }
                     }
                    if (questionsList.length === 5){
                        Data = {
                            "questions" : responseForRandomQuestion
                        };
                        resolve(Data);
                    }else{
                        SQL = `SELECT q.id, q.question FROM quiz_questions AS q INNER JOIN question_seen_status
                         AS qs ON qs.question_id = q.id WHERE (qs.user_id = ${userID} AND qs.quiz_id = ${quizID}) ORDER BY qs.created ASC`;
                        exports.executeQuery(SQL).then(responseForLastSeen => {
                           if (!responseForLastSeen.isSuccess){
                               resolve(responseForLastSeen);
                           } else{
                               while(questionsList.length !== 5){
                                   var item = responseForLastSeen.data[Math.floor(Math.random()*responseForLastSeen.data.length)];
                                   if (questionsList.indexOf(item) === -1){
                                       questionsList.push(item);
                                       SQL = `UPDATE question_seen_status SET created = CURRENT_TIMESTAMP WHERE
                                       (user_id = ${userID} AND quiz_id = ${quizID} AND question_id = ${item.id})`;
                                       exports.executeQuery(SQL).then(responseForUpdate =>{
                                          if (!responseForUpdate.isSuccess){
                                              resolve(responseForUpdate.message);
                                          }
                                       });
                                   }
                               }
                               exports.getQuestionOptions(questionsList).then(responseFinal => {
                                   Data = {
                                       "questions" : responseFinal
                                   };
                                   resolve(Data);
                               });

                           }
                        });
                    }
                });
            }else{
                Data = {
                    "questions" : []
                };
                resolve(Data);
            }
        }
    })
  });
};

exports.getQuestionOptions = function (questions) {
    return new Promise((resolve) => {
       async.eachOfSeries(questions, function (data, index, callback) {
          SQL = `SELECT id, question_id, option_value,isAnswer FROM question_options WHERE question_id = ${data.id} AND status = 1`;
          exports.executeQuery(SQL).then(response => {
             if (!response.isSuccess){
                 output = {status: 400, isSuccess: false, message: response.message};
                 resolve(output);
             } else{
                 if (response.data.length > 0){
                     response.data.forEach(function (element) {
                        if (element.isAnswer === 'true'){
                            element.isAnswer = true;
                        } else{
                            element.isAnswer = false;
                        }
                        var temp = element.isAnswer;
                        delete element.isAnswer;
                        element.is_answer = temp;
                     });
                     questions[index]["options"] = response.data;
                 }else{
                     questions[index]["options"] = [];
                 }
             }
              callback();
          });
       }, function (err) {
           if (err) return next(err);
           resolve(questions);
       });
    });
};

exports.getRandomQuestion = function (questions, userID, quizID) {
  return new Promise((resolve) => {
      var randomQuestion = [];
      var questionList = [];
    async.eachOfSeries(questions, function (data, index, callback) {
       SQL = `SELECT * FROM question_seen_status WHERE (question_id = ${data.id} AND user_id = ${userID} AND quiz_id = ${quizID})`;
       exports.executeQuery(SQL).then(responseForSeenStatus => {
           if (!responseForSeenStatus.isSuccess){
               resolve(responseForSeenStatus.message);
           }else{
               if (responseForSeenStatus.data.length === 0){
                   SQL = `INSERT INTO question_seen_status SET question_id = ${data.id}, user_id = ${userID}, quiz_id = ${quizID}`;
                   exports.executeQuery(SQL).then(responseForInsertingSeen => {
                       if (!responseForInsertingSeen.isSuccess){
                           resolve(responseForInsertingSeen.message);
                       }else{
                           randomQuestion.push(responseForInsertingSeen.data);
                           SQL = `SELECT question_id FROM question_seen_status WHERE id = ${responseForInsertingSeen.data.insertId}`;
                           exports.executeQuery(SQL).then(responseGetQuestionID => {
                              if (!responseGetQuestionID.isSuccess){
                                  resolve(responseGetQuestionID.message);
                              } else{
                                  SQL = `SELECT id, quiz_id, question FROM quiz_questions WHERE id = ${responseGetQuestionID.data[0].question_id}`;
                                  exports.executeQuery(SQL).then(responseForQuestion => {
                                      if (!responseForQuestion.isSuccess){
                                          resolve(responseForQuestion.message);
                                      }else{
                                          questionList.push(responseForQuestion.data);
                                          questions[index] = responseForQuestion.data;
                                      }
                                  })
                              }
                           });
                       }
                   });
               }else{
                   // delete questions[index];
                   questions[index] = " ";
               }
           }
           callback();
       });
    }, function (err) {
        if (err) return next(err);
        resolve(questions);
    });
  });
};

exports.addVoucher = function (userID, dispensaryID) {
    return new Promise((resolve)=>{
      SQL = `INSERT INTO vouchers SET user_id = ${userID}, dispensary_id = ${dispensaryID}, expiry = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ${process.env.VOUCHER_EXPIRY} DAY)`;
      exports.executeQuery(SQL).then(response=>{
         if (!response.isSuccess){
             output = {status: 400, isSuccess: false, message: response.message};
             resolve(output);
         } else{
             SQL = `UPDATE coins SET coins = coins + ${process.env.COINS} WHERE user_id = ${userID}`;
             exports.executeQuery(SQL).then(updateCoins=>{
                if (!updateCoins.isSuccess){
                    output = {status: 400, isSuccess: false, message: updateCoins.message};
                    resolve(output);
                }
             });
             output = {status: 200, isSuccess: true, message: "Voucher added successfully", voucher: response.data};
             resolve(output);
         }
      });
    });
};

exports.getAvailableVouchers = function (userID) {
  return new Promise((resolve)=>{
      SQL = `SELECT v.id, v.expiry, d.name, d.address FROM vouchers as v INNER JOIN dispensaries AS d ON v.dispensary_id = d.id
      WHERE (v.user_id = ${userID} AND v.status = 'true' AND expiry > CURRENT_TIMESTAMP)`;
      exports.executeQuery(SQL).then(response=>{
            response.data.forEach(element => {
                element.expiry = new Date(element.expiry).toUTCString();
            });
         resolve(response.data);
      });
  });
};

exports.getDispensariesAgainstVouchers = function (vouchers) {
    return new Promise((resolve)=>{
       async.eachOfSeries(vouchers, function (data, index, callback) {
          SQL = `SELECT id, name, longitude, latitude, phone, address, opening_time, closing_time,
            created FROM dispensaries WHERE id = ${data.dispensary_id}`;
          exports.executeQuery(SQL).then(response=>{
             if (!response.isSuccess){
                 output = {status: 400, isSuccess: false, message: response.message};
                 resolve(output);
             } else{
                 vouchers[index] = response.data[0];
             }
              callback();
          });

       }, function (err) {
           if (err) return next(err);
           resolve(vouchers);
       });
    });
};

exports.addUserDisabledDispensary = function (userID, dispensaryID) {
  return new Promise((resolve)=>{
     SQL = `SELECT * FROM user_disabled_dispensaries WHERE user_id = ${userID} AND dispensary_id = ${dispensaryID}`;
     exports.executeQuery(SQL).then(responseForCheck => {
        if (!responseForCheck.isSuccess){
            resolve(responseForCheck.message);
        } else{
            if (responseForCheck.data.length > 0){
                SQL = `UPDATE user_disabled_dispensaries SET status = 'true', expiry = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ${process.env.DISPENSARY_DISABLE_TIME} DAY)`;
                exports.executeQuery(SQL).then(responseForUpdate => {
                   if (!responseForUpdate.isSuccess){
                       resolve(responseForUpdate.message);
                   }else{
                       resolve(responseForUpdate);
                   }
                });
            }else{
                SQL = `INSERT INTO user_disabled_dispensaries SET user_id = ${userID}, dispensary_id = ${dispensaryID}
                ,status = 'true', expiry = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ${process.env.DISPENSARY_DISABLE_TIME} DAY)`;
                exports.executeQuery(SQL).then(responseForUpdate => { console.log(responseForUpdate)
                    if (!responseForUpdate.isSuccess){
                        resolve(responseForUpdate.message);
                    }else{
                        resolve(responseForUpdate);
                    }
                });
            }
        }
     });
  });
};

exports.addThingsToVoucherResponse = function (vouchers, type) {
  return new Promise((resolve)=>{
     async.eachOfSeries(vouchers, function (data, index, callback) {
         if (type === 'available'){
             vouchers[index]["reward"] = parseInt(process.env.COINS);
             vouchers[index]["is_available"] = true;
             vouchers[index]["is_redeemed"] = false;
         }else{
             vouchers[index]["reward"] = parseInt(process.env.COINS);
             vouchers[index]["is_available"] = false;
             vouchers[index]["is_redeemed"] = true;
         }
         callback();
     }, function (err) {
         if (err) return next(err);
         resolve(vouchers);
     });
  });
};

exports.checkPhoneExistsUpdate = function (phone, userID) {
    return new Promise((resolve)=>{
        const SQL = `SELECT phone FROM users WHERE phone = '${phone}' AND id != ${userID}`;
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

exports.checkUserNameExistsUpdate = function(userName, userID) {
    return new Promise((resolve)=>{
        const SQL = `SELECT username FROM users WHERE username = '${userName}' AND id != ${userID}`;
        exports.executeQuery(SQL).then(response =>{
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

exports.addNotificationSetting = function (userID, dispensaryID, type) {
  return new Promise((resolve)=>{
     if (!userID){
         output = { status:400, isSuccess:false, message: "User ID required" };
         resolve(output);
     }
      if (!dispensaryID){
          output = { status:400, isSuccess:false, message: "Dispensary ID required" };
          resolve(output);
      }
      if (!type){
          output = { status:400, isSuccess:false, message: "Type required" };
          resolve(output);
      }
          SQL = `SELECT * FROM settings WHERE user_id = ${userID} AND dispensary_id = ${dispensaryID}`;
          exports.executeQuery(SQL).then(responseForCheck => {
              if (!responseForCheck.isSuccess){
                  output = { status:400, isSuccess:false, message: responseForCheck.message };
                  resolve(output);
              }else{
                  if (responseForCheck.data.length > 0){
                      SQL = `UPDATE settings SET enable = '${type}' WHERE user_id = ${userID} AND dispensary_id = ${dispensaryID}`;
                      exports.executeQuery(SQL).then(responseForUpdate => {
                          if (!responseForCheck.isSuccess){
                              output = { status:400, isSuccess:false, message: responseForUpdate.message };
                              resolve(output);
                          }else{
                              output = { status:200, isSuccess:true, message: "Success" };
                              resolve(output);
                          }
                      });
                  }else{
                      SQL = `INSERT INTO settings SET user_id = ${userID}, dispensary_id = ${dispensaryID}, enable = '${type}'`;
                      exports.executeQuery(SQL).then(responseForInsert => {
                          if (!responseForInsert.isSuccess){
                              output = { status:400, isSuccess:false, message: responseForInsert.message };
                              resolve(output);
                          }else{
                              output = { status:200, isSuccess:true, message: "Success" };
                              resolve(output);
                          }
                      });
                  }
              }
          })
  });
};
