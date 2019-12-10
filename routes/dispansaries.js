var Cryptr = require('cryptr');
cryptr = new Cryptr(process.env.PASS_SECRET);
var helperFile = require('../helpers/helperFunctions.js');
var auth = require('./auth');

exports.getNearbyDispensaries = function (req, res) {
    var userID = req.query.user_id || '';
    var longitude = req.query.longitude || '';
    var latitude = req.query.latitude || '';
    var limit = req.query.limit || process.env.LIMIT;
    var offset = req.query.offset || process.env.OFF_SET;

    if (!userID){
        output = {status: 400, isSuccess: false, message: "User ID required" };
        res.json(output);
        return;
    }
    if (!longitude){
        output = {status: 400, isSuccess: false, message: "longitude required" };
        res.json(output);
        return;
    }
    if (!latitude){
        output = {status: 400, isSuccess: false, message: "latitude required" };
        res.json(output);
        return;
    }
    SQL = `SELECT * FROM users WHERE id = ${userID}`;
    helperFile.executeQuery(SQL).then(checkUser => {
        if (!checkUser.isSuccess){
            output = {status: 400, isSuccess: false, message: checkUser.message };
            res.json(output);
        }else{
            if (checkUser.data.length > 0){
                exports.getAvailableDispensaries(userID, longitude, latitude, limit, offset).then(response =>{
                    if (!response.isSuccess){
                        output = {status: 400, isSuccess: false, message: response.message };
                        res.json(output);
                    } else{
                        output = {status: 200, isSuccess: true, message: "Success", dispensaries: response.dispensaries };
                        res.json(response);
                    }
                });
            }else{
                output = {status: 400, isSuccess: false, message: "Invalid User" };
                res.json(output);
            }
        }
    });
};

exports.getAvailableDispensaries = function(userID, longitude, latitude, limit, offset){
    return new Promise((resolve)=>{
        SQL = `SELECT id, name, longitude, latitude, phone, address, image, opening_time, closing_time,
            created FROM dispensaries WHERE ( 6371 * acos( cos( radians(${latitude}) ) * cos( radians( latitude ) ) *
            cos( radians( longitude ) - radians(${longitude}) ) + sin( radians(${latitude}) ) *
            sin( radians( latitude ) ) ) ) < 5 AND id NOT IN (SELECT dispensary_id FROM user_disabled_dispensaries 
            WHERE user_id = ${userID} AND status = 'true' AND expiry > CURRENT_TIMESTAMP) AND featured = 'false' 
            ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`;

        helperFile.executeQuery(SQL).then(response => {
            if (!response.isSuccess){
                output = {status: 400, isSuccess: false, message: response.message};
                resolve(output);
            }else{
                if (response.data.length > 0){
                    helperFile.checkFollowedDispensaries(response.data, userID).then(responseForCHeck => {
                        output = {status: 200, isSuccess: true, message: "Success", dispensaries: responseForCHeck};
                        resolve(output);
                    });
                }else{
                    output = {status: 200, isSuccess: true, message: "Success", dispensaries: response.data};
                    resolve(output);
                }
            }
        });
    });
};

exports.followDispensary = function (req, res) {
  var userID = req.body.user_id || '';
  var dispensaryID = req.body.dispensary_id || '';
  if (!userID){
      output = {status: 400, isSuccess: false, message: "User ID required" };
      res.json(output);
      return;
  }
    if (!dispensaryID){
        output = {status: 400, isSuccess: false, message: "Dispensary ID required" };
        res.json(output);
        return;
    }

    SQL = `SELECT * FROM users WHERE id = ${userID}`;
    helperFile.executeQuery(SQL).then(userCheckResponse => {
       if (!userCheckResponse.isSuccess){
           output = {status: 400, isSuccess: false, message: userCheckResponse.message};
           res.json(output);
       } else{
           if (userCheckResponse.data.length > 0){
               SQL = `SELECT * FROM dispensaries WHERE id = ${dispensaryID}`;
               helperFile.executeQuery(SQL).then(checkDispensaryResponse => {
                   if (!checkDispensaryResponse.isSuccess) {
                       output = {status: 400, isSuccess: false, message: checkDispensaryResponse.message};
                       res.json(output);
                   }else{
                       if (checkDispensaryResponse.data.length > 0){
                           SQL = `SELECT * FROM user_dispensaries WHERE user_id = ${userID} AND dispensary_id = ${dispensaryID}`;
                           helperFile.executeQuery(SQL).then(checkAlreadyFollowed => {
                               if (!checkAlreadyFollowed.isSuccess){
                                   output = { status: 400, isSuccess: false, message: checkAlreadyFollowed.message};
                                   res.json(output);
                               }else{
                                   if (checkAlreadyFollowed.data.length > 0){
                                       if (checkAlreadyFollowed.data[0].isFollowed === 'false'){
                                           SQL = `UPDATE user_dispensaries SET isFollowed = 'true' WHERE (user_id = ${userID} AND dispensary_id = ${dispensaryID})`;
                                           helperFile.executeQuery(SQL).then(responseForUpdate => {
                                               if (!responseForUpdate.isSuccess){
                                                   output = { status: 400, isSuccess: false, message: responseForUpdate.message };
                                                   res.json(output);
                                               }else{
                                                   helperFile.addNotificationSetting(userID, dispensaryID, 'true').then(responseFinal => {
                                                       if (!responseFinal.isSuccess){
                                                           output = { status: 400, isSuccess: false, message: responseFinal.message };
                                                           res.json(output);
                                                       }else{
                                                           output = { status: 200, isSuccess: true, message: "Dispensary followed successfully" };
                                                           res.json(output);
                                                       }
                                                   });
                                               }
                                           })
                                       }else{
                                           output = { status: 400, isSuccess: false, message: "Dispensary already followed"};
                                           res.json(output);
                                       }
                                   }else{
                                       SQL = `INSERT INTO user_dispensaries SET user_id = ${userID}, dispensary_id = ${dispensaryID}`;
                                       helperFile.executeQuery(SQL).then(response => {
                                           if (!response.isSuccess){
                                               output = { status: 400, isSuccess: false, message: response.message}
                                               res.json(output);
                                           } else{
                                               helperFile.addNotificationSetting(userID, dispensaryID, 'true').then(responseFinal => {
                                                   if (!responseFinal.isSuccess){
                                                       output = { status: 400, isSuccess: false, message: responseFinal.message };
                                                       res.json(output);
                                                   }else{
                                                       output = { status: 200, isSuccess: true, message: "Dispensary followed successfully" };
                                                       res.json(output);
                                                   }
                                               });
                                           }
                                       });
                                   }
                               }
                           })
                       }else{
                           output = { status: 400, isSuccess: false, message: "Dispensary doesn't exists"}
                           res.json(output);
                       }
                   }
               });
           }else{
               output = { status: 400, isSuccess: false, message: "User doesn't exists"}
               res.json(output);
           }
       }
    });
};

exports.unFollowDispensary = function (req, res) {
    var userID = req.body.user_id || '';
    var dispensaryID = req.body.dispensary_id || '';
    if (!userID){
        output = {status: 400, isSuccess: false, message: "User ID required" };
        res.json(output);
        return;
    }
    if (!dispensaryID){
        output = {status: 400, isSuccess: false, message: "Dispensary ID required" };
        res.json(output);
        return;
    }

    SQL = `SELECT * FROM users WHERE id = ${userID}`;
    helperFile.executeQuery(SQL).then(userCheckResponse => {
        if (!userCheckResponse.isSuccess){
            output = {status: 400, isSuccess: false, message: userCheckResponse.message};
            res.json(output);
        } else{
            if (userCheckResponse.data.length > 0){
                SQL = `SELECT * FROM dispensaries WHERE id = ${dispensaryID}`;
                helperFile.executeQuery(SQL).then(checkDispensaryResponse => {
                    if (!checkDispensaryResponse.isSuccess) {
                        output = {status: 400, isSuccess: false, message: checkDispensaryResponse.message};
                        res.json(output);
                    }else{
                        if (checkDispensaryResponse.data.length > 0){
                            SQL = `SELECT * FROM user_dispensaries WHERE (user_id = ${userID} AND dispensary_id = ${dispensaryID})`;
                            helperFile.executeQuery(SQL).then(checkAlreadyFollowed => {
                                if (!checkAlreadyFollowed.isSuccess){
                                    output = { status: 400, isSuccess: false, message: checkAlreadyFollowed.message}
                                    res.json(output);
                                }else{
                                    if (checkAlreadyFollowed.data.length > 0){
                                        SQL = `UPDATE user_dispensaries SET isFollowed = 'false' WHERE (user_id = ${userID} AND dispensary_id = ${dispensaryID})`;
                                        helperFile.executeQuery(SQL).then(response => {
                                            if (!response.isSuccess){
                                                output = { status: 400, isSuccess: false, message: response.message}
                                                res.json(output);
                                            } else{
                                                helperFile.addNotificationSetting(userID, dispensaryID, 'false').then(responseFinal => {
                                                    if (!responseFinal.isSuccess){
                                                        output = { status: 400, isSuccess: false, message: responseFinal.message };
                                                        res.json(output);
                                                    }else{
                                                        output = { status: 200, isSuccess: true, message: "Dispensary un-followed successfully"}
                                                        res.json(output);
                                                    }
                                                });
                                            }
                                        });
                                    }else{
                                        output = { status: 400, isSuccess: false, message: "Current user doesn't follow this dispensary"}
                                        res.json(output);
                                    }
                                }
                            })
                        }else{
                            output = { status: 400, isSuccess: false, message: "Dispensary doesn't exists"}
                            res.json(output);
                        }
                    }
                });
            }else{
                output = { status: 400, isSuccess: false, message: "User doesn't exists"}
                res.json(output);
            }
        }
    });
};

exports.getDispensaryByID = function (req, res) {
    var dispensaryID    = req.query.dispensary_id || '';
    var userID          = req.query.user_id || '';
    if (!dispensaryID){
        output = {status: 400, isSuccess: false, message: "Dispensary ID required "};
        res.json(output);
        return;
    }
    if (!userID){
        output = {status: 400, isSuccess: false, message: "User ID required "};
        res.json(output);
        return;
    }
    SQL = `SELECT * FROM users WHERE id = ${userID}`;
    helperFile.executeQuery(SQL).then(userCheck => {
       if (!userCheck.isSuccess){
           output = {status: 400, isSuccess: false, message: userCheck.message};
           res.json(output);
       } else{
           if (userCheck.data.length > 0){
               SQL = `SELECT id, name, longitude, latitude, phone, address, image, opening_time, closing_time,
            created FROM dispensaries WHERE id = ${dispensaryID}`;
               helperFile.executeQuery(SQL).then(response => {
                   if (!response.isSuccess){
                       output = {status: 400, isSuccess: false, message: response.message};
                       res.json(output);
                   } else{
                       if (response.data.length > 0){
                           helperFile.checkFollowedDispensaries(response.data, userID).then(responseForThis => {
                               output = {status: 200, isSuccess: true, message: "Success", dispensary: responseForThis[0]};
                               res.json(output);
                           });
                       }else{
                           output = {status: 400, isSuccess: false, message: "Invalid dispensary"};
                           res.json(output);
                       }
                   }
               });
           }else{
               output = {status: 400, isSuccess: false, message: "Invalid user"};
               res.json(output);
           }
       }
    });
};

exports.getCompletedDispensaries = function (userID, limit, offset) {

  return new Promise((resolve)=>{
     SQL = `SELECT d.id, d.name, d.longitude, d.latitude, d.phone, d.address, d.image, d.image, d.opening_time, d.closing_time,
            d.created FROM dispensaries AS d INNER JOIN user_disabled_dispensaries as udd ON udd.dispensary_id = d.id
            WHERE udd.user_id = ${userID} AND udd.expiry > CURRENT_TIMESTAMP ORDER BY udd.created DESC LIMIT ${limit} OFFSET ${offset}`;
     helperFile.executeQuery(SQL).then(response=>{ console.log(response)
        if (!response.isSuccess){
            output = {status: 400, isSuccess: false, message: response.message};
            resolve(output);
        }else{
            output = {status: 200, isSuccess: true, message: "Success", completed_dispensaries: response.data};
            resolve(output);
        }
     });
  });
};

exports.getCompletedDispensariesByUserID = function (req, res) {
    var userID = req.query.user_id || '';
    var limit = req.query.limit || process.env.LIMIT;
    var offset = req.query.offset || process.env.OFF_SET;

    if (!userID){
        output = {status: 400, isSuccess: false, message: "User ID required"};
        res.json(output);
        return;
    }
    SQL = `SELECT * FROM users WHERE id = ${userID}`;
    helperFile.executeQuery(SQL).then(userCheck => {
        if (!userCheck.isSuccess){
            output = {status: 400, isSuccess: false, message: userCheck.message};
            res.json(output);
        }else{
            if (userCheck.data.length > 0){
                exports.getCompletedDispensaries(userID, limit, offset).then(response=>{
                    res.json(response);
                });
            }else{
                output = {status: 400, isSuccess: false, message: "Invalid User"};
                res.json(output);
            }
        }
    });
};

exports.searchDispensary = function (req, res) {
  var keyword = req.query.keyword || ''; console.log(req.query)
  var userID = req.query.user_id || '';
  var limit = req.query.limit || process.env.LIMIT;
  var offset = req.query.offset || process.env.OFF_SET;

    if (!userID){
        output = {status: 400, isSuccess: false, message: "User ID required"};
        res.json(output);
        return;
    }
    if (!keyword){
        output = {status: 400, isSuccess: false, message: "keyword required"};
        res.json(output);
        return;
    }
    SQL = `SELECT * FROM users WHERE id = ${userID}`;
    helperFile.executeQuery(SQL).then(userCheck => {
       if (!userCheck.isSuccess){
           output = {status: 400, isSuccess: false, message: userCheck.message};
           res.json(output);
       } else{
           if (userCheck.data.length > 0){
               SQL = `SELECT id, name, longitude, latitude, phone, address, image, opening_time, closing_time,
            created FROM dispensaries WHERE name LIKE '%${keyword}%' AND id NOT IN (SELECT dispensary_id FROM user_disabled_dispensaries 
            WHERE user_id = ${userID} AND status = 'true' AND expiry > CURRENT_TIMESTAMP) AND featured = 'false'
            ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`;

               helperFile.executeQuery(SQL).then(response => {
                   if (!response.isSuccess){
                       output = {status: 400, isSuccess: false, message: response.message};
                       res.json(output);
                   }else{
                       if (response.data.length > 0){
                           helperFile.checkFollowedDispensaries(response.data, userID).then(responseForCHeck => {
                               output = {status: 200, isSuccess: true, message: "Success", dispensaries: responseForCHeck};
                               res.json(output);
                           });
                       }else{
                           output = {status: 200, isSuccess: true, message: "Success", dispensaries: response.data};
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

exports.featuredDispensariesList = function (req, res) {
    var userID = req.query.user_id || '';
    var longitude = req.query.longitude || '';
    var latitude = req.query.latitude || '';
    var limit = req.query.limit || process.env.LIMIT;
    var offset = req.query.offset || process.env.OFF_SET;

    if (!userID){
        output = {status: 400, isSuccess: false, message: "User ID required"};
        res.json(output);
        return;
    }
    if (!longitude){
        output = {status: 400, isSuccess: false, message: "Longitude required"};
        res.json(output);
        return;
    }
    if (!latitude){
        output = {status: 400, isSuccess: false, message: "Latitude required"};
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
               SQL = `SELECT id, name, longitude, latitude, phone, address, image, opening_time, closing_time,
            created FROM dispensaries WHERE ( 6371 * acos( cos( radians(${latitude}) ) * cos( radians( latitude ) ) *
            cos( radians( longitude ) - radians(${longitude}) ) + sin( radians(${latitude}) ) *
            sin( radians( latitude ) ) ) ) < 5 AND featured = 'true' AND id NOT IN (SELECT dispensary_id FROM user_disabled_dispensaries 
            WHERE user_id = ${userID} AND status = 'true' AND expiry > CURRENT_TIMESTAMP) 
            ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`;

               helperFile.executeQuery(SQL).then(response => {
                   if (!response.isSuccess){
                       output = {status: 400, isSuccess: false, message: response.message};
                       res.json(output);
                   }else{
                       if (response.data.length > 0){
                           helperFile.checkFollowedDispensaries(response.data, userID).then(responseForCHeck => {
                               output = {status: 200, isSuccess: true, message: "Success", dispensaries: responseForCHeck};
                               res.json(output);
                           });
                       }else{
                           output = {status: 200, isSuccess: true, message: "Success", dispensaries: response.data};
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
}

exports.userFollowedDispensaries = function (req, res) {
    var userID =  req.query.user_id || '';
    var offset = req.query.offset || process.env.OFF_SET;
    var limit = req.query.limit || process.env.LIMIT;

    if (!userID){
        output = {status: 400, isSuccess: false, message: "User ID required"};
        res.json(output);
    }
    SQL = `SELECT * FROM users WHERE id = ${userID}`;
    helperFile.executeQuery(SQL).then(userCheck => {
       if (!userCheck.isSuccess){
           output = {status: 400, isSuccess: false, message: userCheck.message};
           res.json(output);
       } else{
           if (userCheck.data.length > 0){
               SQL = `SELECT d.id, d.name, d.longitude, d.latitude, d.phone, d.address, d.image, d.opening_time, d.closing_time,
            d.created FROM dispensaries AS d INNER JOIN user_dispensaries AS ufd ON d.id = ufd.dispensary_id
            WHERE ufd.user_id = ${userID} ORDER BY ufd.id DESC LIMIT ${limit} OFFSET ${offset}`;
               helperFile.executeQuery(SQL).then(response => {
                   if (!response.isSuccess){
                       output = {status: 400, isSuccess: false, message: response.message};
                       res.json(output);
                   } else{
                       output = {status: 200, isSuccess: true, message: "Success", dispensaries: response.data};
                       res.json(output);
                   }
               });
           }else{
               output = {status: 400, isSuccess: false, message: "Invalid User"};
               res.json(output);
           }
       }
    });
}