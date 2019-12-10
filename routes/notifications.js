var fcm = require('fcm-notification');
var fcmKey = require('./fcm-key');
var FCM = new fcm(fcmKey);
var helperFile = require('../helpers/helperFunctions');
var notificationCNST = require('../config/NotificationResponses');

exports.enableDisableNotification = function (req, res) {
  var userID = req.body.user_id || '';
  var dispensaryID = req.body.dispensary_id || '';
  var type = req.body.enable || '';

  if (!userID){
      output = {status: 400, isSuccess: false, message: "User ID required"};
      res.json(output);
      return;
  }
    if (!dispensaryID){
        output = {status: 400, isSuccess: false, message: "Dispensary ID required"};
        res.json(output);
        return;
    }
    if (!type){
        output = {status: 400, isSuccess: false, message: "Enable type required"};
        res.json(output);
        return;
    }

    helperFile.addNotificationSetting(userID, dispensaryID, type).then(response => {
       if (!response.isSuccess){
           output = {status: 400, isSuccess: false, message: response.message};
           res.json(output);
       } else{
           SQL = `SELECT d.id, d.name, s.enable FROM dispensaries as d INNER JOIN settings AS s ON s.dispensary_id = d.id WHERE s.user_id = ${userID}`;
           helperFile.executeQuery(SQL).then(responseForGet => {
              if (!responseForGet.isSuccess){
                  output = {status: 400, isSuccess: false, message: responseForGet.message};
                  res.json(output);
              } else{
                  responseForGet.data.forEach(function (element) {
                     if (element.enable === 'true'){
                         element.enable = true;
                     } else{
                         element.enable = false;
                     }
                  });
                  output = {status: 200, isSuccess: true, message: "Notification settings updated successfully", settings: responseForGet.data};
                  res.json(output);
              }
           });
       }
    });
};

exports.getAllSettings = function (req, res) {
  var userID = req.query.user_id || '';
  if (!userID){
      output = {status: 400, isSuccess: false, message: "User ID required"};
      res.json(output);
      return;
  }
  SQL = `SELECT * FROM users WHERE id = ${userID}`;
  helperFile.executeQuery(SQL).then(resposnseForUserCheck => {
     if (!resposnseForUserCheck.isSuccess){
         output = {status: 400, isSuccess: false, message: resposnseForUserCheck.message};
         res.json(output);
     } else{
         if (resposnseForUserCheck.data.length > 0){
             SQL = `SELECT d.id, d.name, s.enable FROM dispensaries as d INNER JOIN settings AS s ON s.dispensary_id = d.id WHERE s.user_id = ${userID}`;
             helperFile.executeQuery(SQL).then(response => {
                 if (!response.isSuccess){
                     output = {status: 400, isSuccess: false, message: response.message};
                     res.json(output);
                 } else{
                     response.data.forEach(function (element) {
                         if (element.enable === 'true'){
                             element.enable = true;
                         } else{
                             element.enable = false;
                         }
                     });
                     output = {status: 200, isSuccess: true, message: "Success", settings: response.data};
                     res.json(output);
                 }
             });
         }else{
             output = {status: 400, isSuccess: false, message: "Invalid User"};
             res.json(output);
         }
     }
  });
};

exports.addQuizNotification = function (userID, dispensaryID, type) {
  return new Promise((resolve)=>{
     SQL = `SELECT name FROM dispensaries WHERE id = ${dispensaryID}`;
     helperFile.executeQuery(SQL).then(responseForDispensaryName => {
        if (!responseForDispensaryName.isSuccess){
            output = {status: 400, isSuccess: false, message: responseForDispensaryName.message};
            resolve(output);
        } else{
            if (type === 'true'){
                notification = {
                    "title" : "Quiz Attempt",
                    "body" : notificationCNST.QUIZ_SUCCESS + responseForDispensaryName.data[0].name
                };

            }else{
                notification = {
                    "title" : "Quiz Attempt",
                    "body" : notificationCNST.QUIZ_FAIL + responseForDispensaryName.data[0].name
                };
            }
            SQL = `INSERT INTO notifications SET user_id = ${userID}, dispensary_id = ${dispensaryID}, title = '${notification.title}', notification = '${notification.body}'`;
            helperFile.executeQuery(SQL).then(response => {
                if (!response.isSuccess){
                    output = {status: 400, isSuccess: false, message: response.message};
                    resolve(output);
                }else{

                    output = {status: 200, isSuccess: true, message: "Notification saved successfully"};
                    resolve(output);
                }
            });
        }
     });
  });
};

exports.sendNotification = function (token, notification) {
    var message = {
        notification:{
            title : notification.title,
            body : notification.body
        },
        token : token
    };

    FCM.send(message, function(err, response) {
        if(err){
            console.log('error found', err);
        }else {
            console.log('response here', response);
        }
    })
};

exports.getAllNotifications = function (req, res) {
    var userID = req.query.user_id || '';
    var limit = req.query.limit || process.env.LIMIT;
    var offset = req.query.offset || process.env.OFF_SET;
    if (!userID){
        output = {status: 400, isSuccess: false, message: "User ID required"};
        res.json(output);
        return;
    }
    SQL = `SELECT * FROM users WHERE id = ${userID}`;
    helperFile.executeQuery(SQL).then(resposnseForUserCheck => {
        if (!resposnseForUserCheck.isSuccess) {
            output = {status: 400, isSuccess: false, message: resposnseForUserCheck.message};
            res.json(output);
        } else {
            if (resposnseForUserCheck.data.length > 0) {
                delete resposnseForUserCheck.data;
                delete resposnseForUserCheck.status;
                delete  resposnseForUserCheck.isSuccess;

                exports.getNotificationContent(userID, 'true', limit, offset).then(responseForSeen => {
                    if (!responseForSeen.isSuccess){
                        output = {status: 400, isSuccess: false, message: responseForSeen.message};
                        res.json(output);
                    }else{
                        responseForSeen.notifications.forEach(function (element) {
                           var temp = element.seen;
                           delete element.seen;
                           if (temp === 'true'){
                               element.read = true;
                           }else{
                               element.read = false;
                           }
                        });
                        resposnseForUserCheck["seen_notifications"] = responseForSeen.notifications;

                        exports.getNotificationContent(userID, 'false', limit, offset).then(responseForUnSeen => {
                            if (!responseForUnSeen.isSuccess){
                                output = {status: 400, isSuccess: false, message: responseForUnSeen.message};
                                res.json(output);
                            }else{
                                resposnseForUserCheck["unseen_notifications"] = responseForUnSeen.notifications;
                                responseForUnSeen.notifications.forEach(function (element) {
                                    var temp = element.seen;
                                    delete element.seen;
                                    if (temp === 'true'){
                                        element.read = true;
                                    }else{
                                        element.read = false;
                                    }
                                });
                                output = {status: 200, isSuccess: true, message: "Success", notifications: resposnseForUserCheck};
                                res.json(output);
                            }
                        });
                    }
                });
            }else{
                output = {status: 400, isSuccess: false, message: "Invalid User"};
                res.json(output);
            }
        }
    });
};

exports.getNotificationContent = function (userID, type, limit, offset) {
  return new Promise((resolve)=>{
      SQL = `SELECT n.id, d.id AS dispensary_id ,d.name, d.image, n.title, n.notification, n.created, n.seen FROM notifications AS n INNER JOIN dispensaries as d
                ON n.dispensary_id = d.id WHERE n.user_id = ${userID} and seen = '${type}' LIMIT ${limit} OFFSET ${offset}`;
      helperFile.executeQuery(SQL).then(response => {
          if (!response.isSuccess){
              output = {status: 400, isSuccess: false, message: response.message};
              resolve(output);
          }else{
              output = {status: 200, isSuccess: true, message: "Success", notifications: response.data};
              resolve(output);
          }
      })
  });
};

exports.getReedNotifications = function (req, res) {
  var userID = req.query.user_id || '';
  var limit = req.query.limit || process.env.LIMIT;
  var offset = req.query.offset || process.env.OFF_SET;

  if (!userID){
      output = {status: 400, isSuccess: false, message: "User ID required"};
      res.json(output);
  }
  SQL = `SELECT * FROM users WHERE id = ${userID}`;
  helperFile.executeQuery(SQL).then(checkUser => {
     if (!checkUser.isSuccess){
         output = {status: 400, isSuccess: false, message: checkUser.message};
         res.json(output)
     } else{
         if (checkUser.data.length > 0){
             exports.getNotificationContent(userID, 'true', limit, offset).then(responseForSeen => {
                 if (!responseForSeen.isSuccess) {
                     output = {status: 400, isSuccess: false, message: responseForSeen.message};
                     res.json(output);
                 } else {
                     responseForSeen.notifications.forEach(function (element) {
                         var temp = element.seen;
                         delete element.seen;
                         if (temp === 'true') {
                             element.read = true;
                         } else {
                             element.read = false;
                         }
                     });
                     output = {status: 200, isSuccess: true, message: "Success", notifications: responseForSeen.notifications};
                     res.json(output)
                 }
             });
         }else{
             output = {status: 400, isSuccess: false, message: "Invalid User"};
             res.json(output)
         }
     }
  });
};

exports.getUnReedNotifications = function (req, res) {
    var userID = req.query.user_id || '';
    var limit = req.query.limit || process.env.LIMIT;
    var offset = req.query.offset || process.env.OFF_SET;

    if (!userID){
        output = {status: 400, isSuccess: false, message: "User ID required"};
        res.json(output);
    }
    SQL = `SELECT * FROM users WHERE id = ${userID}`;
    helperFile.executeQuery(SQL).then(checkUser => {
        if (!checkUser.isSuccess){
            output = {status: 400, isSuccess: false, message: checkUser.message};
            res.json(output)
        } else{
            if (checkUser.data.length > 0){
                exports.getNotificationContent(userID, 'false', limit, offset).then(responseForSeen => {
                    if (!responseForSeen.isSuccess) {
                        output = {status: 400, isSuccess: false, message: responseForSeen.message};
                        res.json(output);
                    } else {
                        responseForSeen.notifications.forEach(function (element) {
                            var temp = element.seen;
                            delete element.seen;
                            if (temp === 'true') {
                                element.read = true;
                            } else {
                                element.read = false;
                            }
                        });
                        output = {status: 200, isSuccess: true, message: "Success", notifications: responseForSeen.notifications};
                        res.json(output)
                    }
                });
            }else{
                output = {status: 400, isSuccess: false, message: "Invalid User"};
                res.json(output)
            }
        }
    });
};

exports.markReadNotification = function (req, res) {
  var userID = req.body.user_id || '';
  var notificationID = req.body.notification_id || '';

  if (!userID){
      output = {status: 400, isSuccess: false, message: "User ID required"};
      res.json(output);
      return;
  }

    if (!notificationID){
        output = {status: 400, isSuccess: false, message: "Notification ID required"};
        res.json(output);
        return;
    }

    SQL = `SELECT * FROM users WHERE id = ${userID}`;
    helperFile.executeQuery(SQL).then(checkUser => {
       if (!checkUser.isSuccess){
           output = {status: 400, isSuccess: false, message: checkUser.message};
           res.json(output);
       } else{
           if (checkUser.data.length > 0){
               SQL = `SELECT * FROM notifications WHERE id = ${notificationID}`;
               helperFile.executeQuery(SQL).then(checkNotification => {
                  if (!checkNotification.isSuccess){
                      output = {status: 400, isSuccess: false, message: checkNotification.message};
                      res.json(output);
                  } else{
                      if (checkNotification.data.length > 0){
                          SQL = `UPDATE notifications SET seen = 'true' WHERE id = ${notificationID}`;
                          helperFile.executeQuery(SQL).then(updateNotification => {
                             if (!updateNotification.isSuccess){
                                 output = {status: 400, isSuccess: false, message: updateNotification.message};
                                 res.json(output);
                             } else{
                                 output = {status: 200, isSuccess: true, message: "Notification marked read successfully"};
                                 res.json(output);
                             }
                          });
                      }else{
                          output = {status: 400, isSuccess: false, message: "Invalid Notification"};
                          res.json(output);
                      }
                  }
               });
           }else{
               output = {status: 400, isSuccess: false, message: "Invalid User"};
               res.json(output);
           }
       }
    });
};

exports.addDataBase = function (req, res) {
    var options = ['Pink', 'Orange', 'Green', 'Black'];

    for (var i=14; i<51; i++){
        for (x in options){
            SQL = `INSERT INTO question_options SET question_id = ${i}, option_value = '${options[x]}'`;
            helperFile.executeQuery(SQL).then(response => {
                if (!response.isSuccess){
                    res.json(response.message)
                }
            });
        }
    }
    res.json("done");
}