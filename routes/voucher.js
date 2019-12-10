var helperFile = require('../helpers/helperFunctions.js');
var auth = require('./auth');

exports.getAvailableVouchersList = function (req, res) {
  var userID = req.query.user_id || '';
    var limit = req.query.limit || process.env.LIMIT;
    var offset = req.query.offset || process.env.OFF_SET;
  if (!userID){
      output = {status: 400, isSuccess: false, message: "User ID required"};
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
             exports.getVoucherContent(userID, 'available', limit, offset).then(response => {
                 res.json(response);
             });
         }else{
             output = {status: 400, isSuccess: false, message: "Invalid User"};
             res.json(output);
         }
     }
  });
};

exports.getRedeemedVouchersList = function (req, res) {
    var userID = req.query.user_id || '';
    var limit = req.query.limit || process.env.LIMIT;
    var offset = req.query.offset || process.env.OFF_SET;
    if (!userID){
        output = {status: 400, isSuccess: false, message: "User ID required"};
        res.json(output);
        return;
    }
    SQL = `SELECT * FROM users WHERE id = ${userID}`;
    helperFile.executeQuery(SQL).then(checkUser => {
        if (!checkUser.isSuccess) {
            output = {status: 400, isSuccess: false, message: checkUser.message};
            res.json(output);
        } else {
            if (checkUser.data.length > 0) {
                exports.getVoucherContent(userID, 'redeemed', limit, offset).then(response => {
                    res.json(response);
                });
            } else {
                output = {status: 400, isSuccess: false, message: "Invalid User"};
                res.json(output);
            }
        }
    });
};

exports.getVoucherContent = function (userID, type, limit, offset) {
    return new Promise((resolve)=>{
        SQL = `SELECT * FROM users WHERE id = ${userID}`;
        helperFile.executeQuery(SQL).then(responseForUserCheck => {
            if (!responseForUserCheck.isSuccess){
                output = {status: 400, isSuccess: false, message: responseForUserCheck.message };
                resolve(output);
            } else{
                if (responseForUserCheck.data.length > 0){
                    if (type === 'available'){
                        SQL = `SELECT v.id as voucher_id, v.dispensary_id, v.expiry, d.name as dispensary_name, d.address as dispensary_address
                            FROM vouchers AS v INNER JOIN dispensaries AS d ON v.dispensary_id = d.id WHERE v.user_id = ${userID} AND 
                            v.status = 'true' AND v.expiry > CURRENT_TIMESTAMP LIMIT ${limit} OFFSET ${offset}`;
                    }else{
                        SQL = `SELECT v.id as voucher_id, v.dispensary_id, v.expiry, d.name as dispensary_name, d.address as dispensary_address
                            FROM vouchers AS v INNER JOIN dispensaries AS d ON v.dispensary_id = d.id WHERE v.user_id = ${userID} AND 
                            v.status = 'false' ORDER BY v.id DESC LIMIT ${limit} OFFSET ${offset}`;
                    }

                    helperFile.executeQuery(SQL).then(responseForVouchers => {
                        if (!responseForVouchers.isSuccess){
                            output = {status: 400, isSuccess: false, message: responseForVouchers.message };
                            resolve(output);
                        } else{
                            helperFile.addThingsToVoucherResponse(responseForVouchers.data, type).then(response => {
                                output = {status: 200, isSuccess: true, message: "Success", vouchers: response};
                                resolve(output);
                            });
                        }
                    });
                }else{
                    output = {status: 400, isSuccess: false, message: "Invalid user" };
                    resolve(output);
                }
            }
        });
    });
};

exports.claimVoucher = function (req, res) {
    const userID = req.body.user_id || '';
    const voucherID = req.body.voucher_id || '';
    const code = req.body.code || '';
    if (!userID){
        output = {status: 400, isSuccess: false, message: "User ID required"};
        res.json(output);
        return;
    }
    if (!voucherID) {
        output = {status: 400, isSuccess: false, message: "Voucher ID required"};
        res.json(output);
        return;
    }
    if (!code) {
        output = {status: 400, isSuccess: false, message: "Code required"};
        res.json(output);
        return;
    }
    SQL = `SELECT * FROM users WHERE id = ${userID}`;
    helperFile.executeQuery(SQL).then(checkUser=>{
       if (!checkUser.isSuccess){
           output = {status: 400, isSuccess: false, message: checkUser.message};
           res.json(output);
       } else{
           if (checkUser.data.length > 0){
               SQL = `SELECT * FROM vouchers WHERE (id = ${voucherID} AND user_id = ${userID} AND status = 'true' AND expiry > CURRENT_TIMESTAMP)`;
               helperFile.executeQuery(SQL).then(checkVoucher=>{
                  if (!checkVoucher.isSuccess){
                      output = {status: 400, isSuccess: false, message: checkVoucher.message};
                      res.json(output);
                  } else{
                      if (checkVoucher.data.length > 0){
                          SQL = `SELECT code FROM dispensary_codes WHERE dispensary_id = '${checkVoucher.data[0].dispensary_id}'`;
                          helperFile.executeQuery(SQL).then(dispensaryCode => {
                             if (!dispensaryCode.isSuccess){
                                 output = {status: 400, isSuccess: false, message: dispensaryCode.message};
                                 res.json(output);
                             } else{
                                 if (dispensaryCode.data.length > 0){
                                     if (code === dispensaryCode.data[0].code){
                                         SQL = `UPDATE vouchers SET status = 'false' WHERE id = ${voucherID}`;
                                         helperFile.executeQuery(SQL).then(responseForUpdate => {
                                            if (!responseForUpdate.isSuccess){
                                                output = {status: 400, isSuccess: false, message: responseForUpdate.message};
                                                res.json(output);
                                            } else{
                                                SQL = `UPDATE coins SET coins = coins - ${process.env.COINS} WHERE user_id = ${userID}`;
                                                helperFile.executeQuery(SQL).then(response => {
                                                   if (!response.isSuccess){
                                                       output = {status: 400, isSuccess: false, message: response.message};
                                                       res.json(output);
                                                   }else{
                                                       SQL = `SELECT v.id as voucher_id, v.dispensary_id, v.expiry, d.name as dispensary_name, d.address as dispensary_address
                                                              FROM vouchers AS v INNER JOIN dispensaries AS d ON v.dispensary_id = d.id WHERE v.id = ${voucherID}`;
                                                       helperFile.executeQuery(SQL).then(responseForGet => {
                                                          if (!responseForGet.isSuccess){
                                                              output = {status: 400, isSuccess: false, message: responseForGet.message};
                                                              res.json(output);
                                                          } else{
                                                              output = {status: 200, isSuccess: true, message: "Voucher claimed successfully", voucher: responseForGet.data};
                                                              res.json(output);
                                                          }
                                                       });
                                                   }
                                                });
                                            }
                                         });
                                     }else{
                                         output = {status: 400, isSuccess: false, message: "Invalid Code"};
                                         res.json(output);
                                     }
                                 }
                             }
                          });
                      }else{
                          output = {status: 400, isSuccess: false, message: "Invalid Voucher"};
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