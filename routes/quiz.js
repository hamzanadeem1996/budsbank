var Cryptr = require('cryptr');
cryptr = new Cryptr(process.env.PASS_SECRET);
var helperFile = require('../helpers/helperFunctions.js');
var auth = require('./auth');
var notification = require('./notifications');

exports.getQuizQuestion = function (req, res) {
  var userID = req.body.user_id || '';
  var dispensaryID = req.body.dispensary_id || '';

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
    SQL = `SELECT id FROM quiz WHERE dispensary_id = ${dispensaryID} AND status = 1 LIMIT 1`;
    helperFile.executeQuery(SQL).then(responseForQuiz => {
       if (!responseForQuiz.isSuccess){
           output = {status: 400, isSuccess: false, message: responseForQuiz.message};
           res.json(output);
       } else{
           if (responseForQuiz.data.length > 0){
               helperFile.getQuizQuestions(responseForQuiz.data[0].id, userID).then(response => {
                   res.json(response);
               })
           }else{
               output = {status: 400, isSuccess: false, message: "Invalid Dispensary ID"};
               res.json(output);
           }
       }
    });
};

exports.saveQuizResult = function (req, res) {
  var userID            = req.body.user_id          || '';
  var dispensaryID      = req.body.dispensary_id    || '';
  var status            = req.body.success          || '';
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
    if (!status){
        output = {status: 400, isSuccess: false, message: "Success status required"};
        res.json(output);
        return;
    }
    if (status === 'true' || status === 'false'){
        SQL = `SELECT * FROM users WHERE id = ${userID}`;
        helperFile.executeQuery(SQL).then(checkUser=>{
           if (!checkUser.isSuccess){
               output = {status: 400, isSuccess: false, message: checkUser.message};
               res.json(output);
           } else{
               if (checkUser.data.length > 0){
                   SQL = `SELECT * FROM dispensaries WHERE id = ${dispensaryID}`;
                   helperFile.executeQuery(SQL).then(checkDispensary=>{
                       if (!checkDispensary.isSuccess){
                           output = {status: 400, isSuccess: false, message: checkDispensary.message};
                           res.json(output);
                       }else{
                           if (checkDispensary.data.length > 0)
                           {
                               SQL = `SELECT * FROM quiz_results WHERE user_id = ${userID} AND dispensary_id = ${dispensaryID}`;
                               helperFile.executeQuery(SQL).then(responseForCheck => {
                                   if (!responseForCheck.isSuccess){
                                       output = {status: 400, isSuccess: false, message: responseForCheck.message};
                                       res.json(output);
                                   } else{
                                       if (responseForCheck.data.length > 0){
                                           SQL = `UPDATE quiz_results SET status = '${status}' WHERE user_id = ${userID} AND dispensary_id = ${dispensaryID}`;
                                           helperFile.executeQuery(SQL).then(responseForUpdate => {
                                               if (!responseForUpdate.isSuccess){
                                                   output = {status: 400, isSuccess: false, message: responseForUpdate.message};
                                                   res.json(output);
                                               }
                                           });
                                       }else{
                                           SQL = `INSERT INTO quiz_results SET status = '${status}', user_id = ${userID}, dispensary_id = ${dispensaryID}`;
                                           helperFile.executeQuery(SQL).then(responseForInsert => {
                                               if (!responseForInsert.isSuccess){
                                                   output = {status: 400, isSuccess: false, message: responseForInsert.message};
                                                   res.json(output);
                                               }
                                           });
                                       }
                                       if (status === 'true'){
                                           helperFile.addVoucher(userID, dispensaryID).then(responseForAddVoucher=>{
                                               if (!responseForAddVoucher.isSuccess){
                                                   output = {status: 400, isSuccess: false, message: responseForAddVoucher.message};
                                               }else{
                                                   SQL = `SELECT v.id as voucher_id, v.dispensary_id, v.expiry, d.name as dispensary_name, d.address as dispensary_address
                                                    FROM vouchers AS v INNER JOIN dispensaries AS d ON v.dispensary_id = d.id WHERE v.id = ${responseForAddVoucher.voucher.insertId}`;
                                                   helperFile.executeQuery(SQL).then(responseForGetVoucher => {
                                                       if (!responseForGetVoucher.isSuccess){
                                                           output = {status: 400, isSuccess: false, message: responseForGetVoucher.message};
                                                           res.json(output);
                                                       } else{
                                                           output = {status: 200, isSuccess: true, message: "Quiz Results saved successfully", voucher : responseForGetVoucher.data[0]};
                                                           res.json(output);
                                                       }
                                                   });
                                               }
                                           });
                                       }else{
                                           output = {status: 200, isSuccess: true, message: "Quiz Results saved successfully"};
                                           res.json(output);
                                       }
                                   }
                               });
                               helperFile.addUserDisabledDispensary(userID, dispensaryID).then(responseForAddUserDisabledDispensary =>{
                                   if (!responseForAddUserDisabledDispensary.isSuccess){
                                       output = {status: 400, isSuccess: false, message: responseForAddUserDisabledDispensary.message};
                                   }else{
                                       output = {status: 200, isSuccess: true, message: "Dispensary disabled successfully"};
                                   }
                               });

                               notification.addQuizNotification(userID, dispensaryID, status).then(responseForNotification => {
                                   if (!responseForNotification.isSuccess){
                                       output = {status: 400, isSuccess: false, message: responseForNotification.message};
                                   }else{
                                       output = {status: 200, isSuccess: true, message: "Notification added  successfully"};
                                   }
                               });
                           }else{
                               output = {status: 400, isSuccess: false, message: "Invalid Dispensary"};
                               res.json(output);
                           }
                       }
                   })
               }else{
                   output = {status: 400, isSuccess: false, message: "Invalid User"};
                   res.json(output);
               }
           }
        });
    }else{
        output = {status: 400, isSuccess: false, message: "Invalid success status"};
        res.json(output);
        return;
    }
};