var jwt = require('jwt-simple');
var CNST = require('../config/constant');
var Cryptr = require('cryptr');
cryptr = new Cryptr(process.env.PASS_SECRET);
var randomstring = require("randomstring");
var helperFile = require('../helpers/helperFunctions.js');
var passwordValidator = require('password-validator');
const emailUtil = require('../email/email-util');
const { sendEmail } = emailUtil;
var dispensaries = require('./dispansaries');
var voucher = require('./voucher');

// Create a schema
var schema = new passwordValidator();

// Add properties to it
schema
    .is().min(8)                                    // Minimum length 8
    .is().max(100)                                  // Maximum length 100
    .has().uppercase()                              // Must have uppercase letters
    .has().lowercase()                              // Must have lowercase letters
    .has().digits()                                 // Must have digits
    .has().symbols()                                // Must have symbols
    .has().not().spaces()                           // Should not have spaces

var auth = {
    login: function (req, res) {
        helperFile.validateHeader(req).then(responseReqCheck => {
           if (!responseReqCheck.isSuccess){
               res.json(responseReqCheck);
               return;
           }
        });
        var loginValue = req.body.value || '';
        var password = req.body.password || '';
        var longitude = req.body.longitude || '';
        var latitude = req.body.latitude || '';

        var limit = req.query.limit || process.env.LIMIT;
        var offset = req.query.offset || process.env.OFF_SET;

        if (longitude === '' || latitude === ''){
            res.json({
                "status": 401,
                "isSuccess": false,
                "message": "Invalid coordinates"
            });
            return;
        }

        if (loginValue === '' || password === '') {
            res.json({
                "status": 401,
                "isSuccess": false,
                "message": "Invalid credentials"
            });
            return;
        }

        auth.validateLogin(loginValue, password).then(response => {
            if (!response.isSuccess) {
                res.json({
                    "status": 401,
                    "isSuccess": false,
                    "message": response.message
                });
                return;
            }
            if (response.isSuccess) {
                if (isNaN(loginValue)){
                    var SQL = `UPDATE users SET longitude = ${longitude}, latitude = ${latitude} WHERE email = '${loginValue}'`;
                }else{
                    var SQL = `UPDATE users SET longitude = ${longitude}, latitude = ${latitude} WHERE phone = '${loginValue}'`;
                }
                helperFile.executeQuery(SQL).then(responseForLocation => {
                   if (!responseForLocation.isSuccess){
                       res.json({
                           "status": 401,
                           "isSuccess": false,
                           "message": responseForLocation.message
                       });
                       return;
                   }
                });
                dispensaries.getAvailableDispensaries(response.user.id, longitude, latitude, limit, offset).then(responseForDispensaries=>{
                   if (!responseForDispensaries.isSuccess){
                       output = {status: 400, isSuccess: false, message: responseForDispensaries.message};
                       res.json(output);
                   } else{
                        response["dispensaries"] = responseForDispensaries.dispensaries;
                        dispensaries.getCompletedDispensaries(response.user.id, limit, offset).then(responseForCompletedDispensaries => {
                            if (!responseForCompletedDispensaries.isSuccess){
                                res.json(responseForCompletedDispensaries.message)
                            }else{
                                response["completed_dispensaries"] = responseForCompletedDispensaries.completed_dispensaries;
                            }
                            SQL = `SELECT id, name, longitude, latitude, phone, address, image, opening_time, closing_time,
                                    created FROM dispensaries WHERE ( 6371 * acos( cos( radians(${latitude}) ) * cos( radians( latitude ) ) *
                                    cos( radians( longitude ) - radians(${longitude}) ) + sin( radians(${latitude}) ) *
                                    sin( radians( latitude ) ) ) ) < 5 AND featured = 'true' AND id NOT IN (SELECT dispensary_id FROM user_disabled_dispensaries
                                    WHERE user_id = ${response.user.id} AND status = 'true' AND expiry > CURRENT_TIMESTAMP)
                                    ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`;
                            helperFile.executeQuery(SQL).then(responseForFeaturedDispensaries => {
                                if (!responseForFeaturedDispensaries.isSuccess){
                                    output = {status: 400, isSuccess: false, message: responseForFeaturedDispensaries.message};
                                    res.json(output);
                                }else{
                                    response["featured_dispensaries"] = responseForFeaturedDispensaries.data;
                                }
                                voucher.getVoucherContent(response.user.id, 'available', limit, offset).then(responseForAvailableVoucher => {
                                    if (!responseForAvailableVoucher.isSuccess){
                                        output = {status: 400, isSuccess: false, message: responseForAvailableVoucher.message};
                                        res.json(output);
                                    }else{
                                        response["available_vouchers"] = responseForAvailableVoucher.vouchers;
                                    }
                                    voucher.getVoucherContent(response.user.id, 'redeemed', limit, offset).then(responseForRedeemedVoucher => {
                                        if (!responseForRedeemedVoucher.isSuccess){
                                            output = {status: 400, isSuccess: false, message: responseForRedeemedVoucher.message};
                                            res.json(output);
                                        }else{
                                            response["redeemed_vouchers"] = responseForRedeemedVoucher.vouchers;
                                        }
                                        res.json(response);
                                    });
                                });
                            });
                        });
                   }
                });
            }
        });
    },

    updatePassword: function(req, res){
        var password = req.body.password || '';
        var userID = req.body.user_id || '';

        if (password === '' || userID === ''){
            res.json({
                "status": 400,
                "isSuccess": false,
                "message": "Invalid Parameters"
            });
            return;
        }

        if (!schema.validate(password)) {
            output = { status: 400, isSuccess: false, message: CNST.PASSWORD_VALIDATION };
            res.json(output);
            return;
        }

        if (userID){
            newPassword = cryptr.encrypt(password);
            sql = "UPDATE users SET `password` = '"+newPassword+"' WHERE `id` = "+userID+"";
            helperFile.executeQuery(sql).then(response => {
                if (!response.isSuccess){
                    output = { status: 400, isSuccess: false, message: response.message };
                }else{
                    output =  {
                        "status": 200,
                        "isSuccess": true,
                        "message": "Password updated successfully",
                    }
                }
                return res.json(output);
            });
        }
    },

    validateLogin: function (loginValue, password) {
        return new Promise((resolve, reject) => {
            if (isNaN(loginValue)){
                var sql = "SELECT * FROM `users` WHERE email = '" + loginValue + "' ";
            }else{
                var sql = "SELECT * FROM `users` WHERE phone = '" + loginValue + "' ";
            }
            helperFile.executeQuery(sql).then(response => {
                if (!response.isSuccess) {
                    output = { status: 400, isSuccess: false, message: response.message };
                    return resolve(output);
                }
                else {
                    if (response.data.length > 0) {
                        var dbPassword = cryptr.decrypt(response.data[0].password);
                        if (password === dbPassword) {
                            // if (response.data[0].email_verified_at === null){
                                // output = { status: 400, isSuccess: false, message: "User not verified" };
                                // return resolve(output);
                            // }else{
                                var loggedInUserID = response.data[0].id;
                                var token = jwt.encode({
                                    userId: loggedInUserID
                                }, process.env.TOKEN_SECRET);
                                var SQL = `UPDATE user_token SET token = '${token}' WHERE user_id = ${loggedInUserID}`;
                                helperFile.executeQuery(SQL).then(resposneForInsertingToken => {
                                    if (!resposneForInsertingToken.isSuccess){
                                        output = { status: 400, isSuccess: false, message: resposneForInsertingToken.message };
                                    } else{
                                        var SQL = `SELECT t.token as session_token, u.id, u.email, u.phone, u.email_verified_at, u.username, u.first_name, u.last_name, u.image, c.coins as coins_earned FROM users as u INNER JOIN user_token as t ON u.id = t.user_id INNER JOIN coins as c ON c.user_id = u.id WHERE u.id = ${loggedInUserID}`;
                                        helperFile.executeQuery(SQL).then(responseForUserModel => {
                                            if (!responseForUserModel.isSuccess){
                                                output = { status: 400, isSuccess: false, message: responseForUserModel.message };
                                            }else {
                                                output = { status: 200, isSuccess: true, message: "User Logged In Successfully", user: responseForUserModel.data[0] };
                                                resolve(output);
                                            }
                                        });
                                    }
                                });
                            // }
                        }
                        else{
                            output = { status: 400, isSuccess: false, message: CNST.WRONG_PASSWORD };
                            return resolve(output);
                        }
                    }
                    else {
                        output = { status: 400, isSuccess: false, message: "Account does not exists" };
                        return resolve(output);
                    }
                }
            })
        })
    },
    validateRequest: function (token) {
        return new Promise((resolve, reject) => {
            // spoofing the DB response for simplicity
            if (token) {
                var sql = "SELECT user_id FROM user_token WHERE token = '" + token + "' LIMIT 1";
                helperFile.executeQuery(sql).then(response => { console.log(response)
                    if (!response.isSuccess) {
                        output = { status: 400, isSuccess: false, message: response.message };
                    }
                    else {
                        if (response.data.length > 0) {
                            output = { results: response.data[0], status: 200, isSuccess: true, message: 'success' };
                        }
                        else {
                            output = { status: 400, isSuccess: false, message: CNST.INVALID_USER };
                        }
                    }
                    return resolve(output);
                })
            }
            else {
                output = { status: 400, isSuccess: false, message: CNST.INVALID_USER };
                return resolve(output);
            }

        })
    },
    loginUserId: function (req, res) {
        return new Promise((resolve, reject) => {
            var token = (req.body && req.body.access_token) || (req.query && req.query.access_token) || req.headers['x-access-token'];
            var sql = "SELECT user_id FROM `user_token` WHERE token = '" + token + "'";
            helperFile.executeQuery(sql).then(response => {
                if (!response.isSuccess) {
                    output = { status: 400, isSuccess: false, message: response.message };
                }
                else {
                    if (response.data.length > 0) {
                        output = { id: response.data[0].user_id, status: 200, isSuccess: true }
                    }
                    else {
                        output = { status: 400, isSuccess: false };
                    }
                }
                return resolve(output);
            })
        })
    },

    //Register new user
    register: function (req, res) {
        helperFile.validateHeader(req).then(responseReqCheck => {
            if (!responseReqCheck.isSuccess){
                res.json(responseReqCheck);
                return;
            }
        });
        const phone = req.body.phone || '';
        const email = req.body.email || '';
        const userName = req.body.userName || '';
        const firstName = req.body.firstName || '';
        const lastName = req.body.lastName || '';
        const password = req.body.password || '';

        if (!phone){
            output = {status: 400, isSuccess: false, message: "Phone Number Required" };
            res.json(output);
            return;
        }
        var isValidPhone = helperFile.checkValidPhone(phone);
        if (!isValidPhone){
            output = {status: 400, isSuccess: false, message: "Please enter a valid phone number" };
            res.json(output);
            return;
        }

        if (!email){
            output = {status: 400, isSuccess: false, message: "Email Required" };
            res.json(output);
            return;
        }
        var isEmailValid = helperFile.checkIfEmailInString(email);
        if (!isEmailValid){
            output = {status: 400, isSuccess: false, message: "Please enter a valid email address" };
            res.json(output);
            return;
        }

        if (!userName){
            output = {status: 400, isSuccess: false, message: "Username Required" };
            res.json(output);
            return;
        }

        if (!firstName){
            output = {status: 400, isSuccess: false, message: "First Name Required" };
            res.json(output);
            return;
        }

        if (!lastName){
            output = {status: 400, isSuccess: false, message: "Last Name Required" };
            res.json(output);
            return;
        }

        if (!password){
            output = {status: 400, isSuccess: false, message: "Password Required" };
            res.json(output);
            return;
        }

        if (!schema.validate(password)) {
            output = { status: 400, isSuccess: false, message: CNST.PASSWORD_VALIDATION };
            res.json(output);
            return;
        }

        helperFile.checkPhoneExists(phone).then(responseForPhoneCheck =>{
            if (responseForPhoneCheck.isPhoneExists === true){
                output = { status: 400, isSuccess: false, message: "Phone number already exists" };
                res.json(output);
            }else{
                helperFile.checkEmailExists(email).then(responseForEmailCheck =>{
                    if (responseForEmailCheck.isEmailExists === true){
                        output = { status: 400, isSuccess: false, message: "Email already exists" };
                        res.json(output);
                        return;
                    }else{
                        helperFile.checkUserNameExists(userName).then(responseForUserNameCheck => {
                            if (responseForUserNameCheck.isUserNameExists === true){
                                output = { status: 400, isSuccess: false, message: "Username already exists" };
                                res.json(output);
                                return;
                            }else{
                                var encryptedPassword = cryptr.encrypt(password);
                                var userObject = {
                                    "user_name"   : userName,
                                    "email"       : email,
                                    "first_name"  : firstName,
                                    "last_name"   : lastName,
                                    "phone"       : phone,
                                    "password"    : encryptedPassword
                                };


                                helperFile.addUser(userObject).then(response => {
                                    if (!response.isSuccess){
                                        output = { status: 400, isSuccess: false, message: response.message };
                                        res.json(output);
                                        return;
                                    }else{
                                        sendVerificationCodeToEmail(email, "verification", response.user.id).then(verificationResponse => {
                                            res.json(response);
                                        }).catch(err => {
                                            return res.json(err);
                                        })
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    },
    verifyUser: function (req, res) {
        var verificationValue = req.body.email || '';

        if (!verificationValue) {
            output = { status: 400, isSuccess: false, message: "Email Required" };
            res.json(output);
            return;
        }

        var Query = "";
        var isEmail = false;
        if (isNaN(verificationValue)) {
            isEmail = helperFile.checkIfEmailInString(verificationValue);
            if (!isEmail) {
                output = { status: 400, isSuccess: false, message: CNST.EMAIL_NOT_VALID };
                res.json(output);
                return;
            }
            Query = "SELECT id FROM `users` WHERE email = '" + verificationValue + "'";
        }

        auth.loginUserId(req, res).then(response => {
            // console.log(response);
            if (!response.isSuccess) {
                output = { status: 403, isSuccess: false, message: CNST.INVALID_USER };
                res.json(output);
                return;
            }
            var id = response.id;
            helperFile.executeQuery(Query).then(response => {
                if (!response.isSuccess) {
                    output = { status: 400, isSuccess: false, message: response.message };
                    return res.json(output);
                }
                else {
                    if (response.data.length > 0) {
                        if (response.data[0].id === id) {
                            sendVerificationCodeToEmail(verificationValue, "verifyUser", id).then(response => {
                                return res.json(response);
                            }).catch(err => {
                                return res.json(err);
                            })
                        }
                        else {
                            output = { status: 400, isSuccess: false, message: "User Token does not match to provided email" };
                            return res.json(output);
                        }
                    }
                }
            })
        })

    },

    verifyCode: function (req, res) {
        var verificationCode = req.body.verificationCode || '';
        var longitude = req.body.longitude || '';
        var latitude = req.body.latitude || '';
        var limit = req.query.limit || process.env.LIMIT;
        var offset = req.query.offset || process.env.OFF_SET;
        var output = "";
        if (!verificationCode) {
            output = { status: 400, isSuccess: false, message: CNST.VERIFICATION_CODE_REQ }
            res.json(output);
        }

        if (!longitude) {
            output = { status: 400, isSuccess: false, message: "Longitude Required" };
            res.json(output);
        }

        if (!latitude) {
            output = { status: 400, isSuccess: false, message: "Latitude Required" };
            res.json(output);
        }

        auth.loginUserId(req, res).then(userResponse => {
            if (!userResponse.isSuccess) {
                output = { status: 403, isSuccess: false, message: CNST.INVALID_USER };
                res.json(output);
                return;
            }
            var userId = userResponse.id;
            var token = req.headers['x-access-token'] || '';
            var sql = `SELECT code FROM user_verification WHERE user_id = ${userId}`;
            helperFile.executeQuery(sql).then(response => {
                if (!response.isSuccess) {
                    output = { status: 400, isSuccess: false, message: response.message };
                    return res.json(output);
                }
                else {
                    if (response.data.length > 0) {
                        if (response.data[0].code === verificationCode) {
                            var sql = `UPDATE users SET email_verified_at = CURRENT_TIMESTAMP, longitude = ${longitude}, latitude = ${latitude} WHERE id = ${userId}`;
                            helperFile.executeQuery(sql).then(response => {
                                if (!response.isSuccess) {
                                    output = { status: 400, isSuccess: false, message: response.message };
                                }
                                else {
                                    var SQL = `SELECT t.token as session_token, u.id, u.email, u.phone, u.email_verified_at, u.username, u.first_name, u.last_name, u.image, c.coins as coins_earned FROM users as u INNER JOIN user_token as t ON u.id = t.user_id INNER JOIN coins as c ON c.user_id = u.id WHERE u.id = ${userId}`;
                                    helperFile.executeQuery(SQL).then(userData => {
                                        if (!userData.isSuccess) {
                                            output = { status: 400, isSuccess: false, message: userData.message };
                                        }
                                        else {
                                            dispensaries.getAvailableDispensaries(userId, longitude, latitude, limit, offset).then(responseForDispensaries=>{
                                                if (!responseForDispensaries.isSuccess){
                                                    output = {status: 400, isSuccess: false, message: responseForDispensaries.message};
                                                    res.json(output);
                                                } else{
                                                    userResponse["dispensaries"] = responseForDispensaries.dispensaries;
                                                    dispensaries.getCompletedDispensaries(userId, limit, offset).then(responseForCompletedDispensaries => {
                                                        if (!responseForCompletedDispensaries.isSuccess){
                                                            res.json(responseForCompletedDispensaries.message)
                                                        }else{
                                                            userResponse["completed_dispensaries"] = responseForCompletedDispensaries.completed_dispensaries;
                                                        }
                                                        SQL = `SELECT id, name, longitude, latitude, phone, address, image, opening_time, closing_time,
                                                        created FROM dispensaries WHERE ( 6371 * acos( cos( radians(${latitude}) ) * cos( radians( latitude ) ) *
                                                        cos( radians( longitude ) - radians(${longitude}) ) + sin( radians(${latitude}) ) *
                                                        sin( radians( latitude ) ) ) ) < 5 AND featured = 'true' AND id NOT IN (SELECT dispensary_id FROM user_disabled_dispensaries
                                                        WHERE user_id = ${userId} AND status = 'true' AND expiry > CURRENT_TIMESTAMP)
                                                        ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`;
                                                        helperFile.executeQuery(SQL).then(responseForFeaturedDispensaries => {
                                                            if (!responseForFeaturedDispensaries.isSuccess){
                                                                output = {status: 400, isSuccess: false, message: responseForFeaturedDispensaries.message};
                                                                res.json(output);
                                                            }else{
                                                                userResponse["featured_dispensaries"] = responseForFeaturedDispensaries.data;
                                                            }
                                                            voucher.getVoucherContent(userId, 'available', limit, offset).then(responseForAvailableVoucher => {
                                                                if (!responseForAvailableVoucher.isSuccess){
                                                                    output = {status: 400, isSuccess: false, message: responseForAvailableVoucher.message};
                                                                    res.json(output);
                                                                }else{
                                                                    userResponse["available_vouchers"] = responseForAvailableVoucher.vouchers;
                                                                }
                                                                voucher.getVoucherContent(userId, 'redeemed', limit, offset).then(responseForRedeemedVoucher => {
                                                                    if (!responseForRedeemedVoucher.isSuccess){
                                                                        output = {status: 400, isSuccess: false, message: responseForRedeemedVoucher.message};
                                                                        res.json(output);
                                                                    }else{
                                                                        userResponse["redeemed_vouchers"] = responseForRedeemedVoucher.vouchers;
                                                                    }
                                                                    output = {
                                                                        user: userData.data[0],
                                                                        dispensaries:userResponse.dispensaries,
                                                                        completed_dispensaries: userResponse.completed_dispensaries,
                                                                        featured_dispensaries: userResponse.featured_dispensaries,
                                                                        available_vouchers: userResponse.available_vouchers,
                                                                        redeemed_vouchers: userResponse.redeemed_vouchers,
                                                                        status: 200,
                                                                        isSuccess: true,
                                                                        message: CNST.VERIFIED_SUCCESS }
                                                                    return res.json(output);
                                                                });
                                                            });
                                                        });
                                                    });
                                                }
                                            });
                                        }
                                    })
                                }
                            })
                        }
                        else {
                            output = { status: 400, isSuccess: false, message: CNST.WRONG_VERIFICATION_CODE };
                            return res.json(output);
                        }
                    }
                    else {
                        output = { status: 400, isSuccess: false, message: CNST.NOT_AUTHORIZED_USER };
                        return res.json(output);
                    }
                }
            })
        })

    },



    resetPassword: function (req, res) {
        var myobj = req.body,
            newPassword = myobj.newPassword || '',
            id = myobj.userId || '';

        if (!newPassword) {
            output = { status: 400, isSuccess: false, message: CNST.NEW_PASSWORD_REQ }
            res.json(output);
        }
        if (!id) {
            output = { status: 400, isSuccess: false, message: CNST.USER_ID_REQ }
            res.json(output);
        }

        var encryptedPassword = cryptr.encrypt(newPassword);
        let sql = `UPDATE users SET password = '${encryptedPassword}' WHERE id = ${id}`;
        helperFile.executeQuery(sql).then(response => {
            if (!response.isSuccess) {
                output = { status: 400, isSuccess: false, message: response.message };
            }
            else {
                output = { status: 200, isSuccess: true, message: CNST.PASSWORD_CHANGED_SUCCESS }
            }
            return res.json(output);
        })
    },
    //Forgot password
    forgotPassword: function (req, res) {
        var verificationValue = req.body.email || '';
        if (!verificationValue) {
            output = { status: 400, isSuccess: false, message: CNST.VERIFICATION_VALUE_REQ };
            res.json(output);
            return;
        }

        var Query = "";
        var isEmail = false;
        if (isNaN(verificationValue)) {
            isEmail = helperFile.checkIfEmailInString(verificationValue);
            if (!isEmail) {
                output = { status: 400, isSuccess: false, message: CNST.EMAIL_NOT_VALID };
                res.json(output);
                return;
            }
            Query = "SELECT id FROM `users` WHERE email = '" + verificationValue + "'";
        }

        helperFile.executeQuery(Query).then(response => {
            if (!response.isSuccess) {
                output = { status: 400, isSuccess: false, message: response.message };
                return res.json(output);
            }
            else {
                if (response.data.length > 0) {
                    sendVerificationCodeToEmail(verificationValue, "forgotPassword", response.data[0].id).then(verifictionResponse => {
                        verifictionResponse.id = cryptr.encrypt(response.data[0].id);
                        return res.json(verifictionResponse);
                    }).catch(err => {
                        return res.json(err);
                    })
                }
                else {
                    output = { status: 400, isSuccess: false, message: "User account does not exist" };
                    return res.json(output)
                }
            }
        })
    },
    //Logout user
    logout: function (req, res) {
        var token = (req.body && req.body.access_token) || (req.query && req.query.access_token) || req.headers['x-access-token'];
        let sql = `DELETE FROM user_token WHERE token = '${token}'`;
        helperFile.executeQuery(sql).then(response => {
            if (!response.isSuccess) {
                output = { status: 400, isSuccess: false, message: response.message };
            }
            else {
                output = { status: 200, isSuccess: true, message: CNST.LOGOUT_SUCCESS }
            }
            return res.json(output);
        })
    }
}

function sendVerificationCodeToEmail(email, requestType, userID) {
    return new Promise((resolve, reject) => {
        var randomCode = "";
        randomCode = "GH-" + randomstring.generate({ length: 3, charset: 'numeric' }) + "-" + randomstring.generate({ length: 3, charset: 'numeric' });
        var updateCodeQuery = "";
        var link = "";
        var SQL = `SELECT * FROM user_verification WHERE user_id = ${userID}`;
        helperFile.executeQuery(SQL).then(responseForCheckCodeExists => {
           if (!responseForCheckCodeExists.isSuccess){
               output = { status: 400, isSuccess: false, message: responseForCheckCodeExists.message };
               reject(output);
               return;
           } else{
               if (responseForCheckCodeExists.data.length > 0){
                   var insertVerificationCode = `UPDATE user_verification SET code = '${randomCode}' WHERE user_id = ${userID}`;
                   helperFile.executeQuery(insertVerificationCode).then(responseForInsertingCode => {
                       if (!responseForInsertingCode.isSuccess){
                           output = { status: 400, isSuccess: false, message: responseForInsertingCode.message }
                           reject(output);
                           return;
                       }else{
                           var encryptedCode = cryptr.encrypt(randomCode);
                           link = `${process.env.BASE_URL}/forgetPassword/${encryptedCode}`;
                           // console.log(link);
                           sendEmail(email, randomCode, requestType, link).then(response => {
                               resolve(response);
                           }).catch(error => {
                               reject(error);
                           });
                       }
                   })
               }else{
                   var insertVerificationCode = `INSERT INTO user_verification SET user_id = ${userID}, code = '${randomCode}'`;
                   helperFile.executeQuery(insertVerificationCode).then(response =>{
                       if (!response.isSuccess) {
                           output = { status: 400, isSuccess: false, message: response.message }
                           reject(output);
                           return;
                       }
                       sendEmail(email, randomCode, requestType, link).then(response => {
                           resolve(response);
                       }).catch(error => {
                           reject(error);
                       });
                   });
               }
           }
        });
    })
}

auth.getHomeContent = function(req, res){
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

    SQL = `SELECT t.token as session_token, u.id, u.email, u.phone, u.email_verified_at, u.username, u.first_name, u.last_name, u.image, c.coins as coins_earned FROM users as u INNER JOIN user_token as t ON u.id = t.user_id INNER JOIN coins as c ON c.user_id = u.id WHERE u.id = ${userID}`;
    helperFile.executeQuery(SQL).then(checkUser => {
        if (!checkUser.isSuccess) {
            output = {status: 400, isSuccess: false, message: checkUser.message};
            res.json(output);
        } else {
            if (checkUser.data.length > 0) {
                dispensaries.getAvailableDispensaries(userID, longitude, latitude, limit, offset).then(responseForDispensaries=>{
                    if (!responseForDispensaries.isSuccess){
                        output = {status: 400, isSuccess: false, message: responseForDispensaries.message};
                        res.json(output);
                    } else{
                        dispensaries.getCompletedDispensaries(userID,limit, offset).then(responseForCompletedDispensaries => {
                            if (!responseForCompletedDispensaries.isSuccess){
                                res.json(responseForCompletedDispensaries.message)
                            }else{
                                responseForDispensaries["user"] = checkUser.data[0];
                                responseForDispensaries["completed_dispensaries"] = responseForCompletedDispensaries.completed_dispensaries;
                            }
                            SQL = `SELECT id, name, longitude, latitude, phone, address, image, opening_time, closing_time,
                                    created FROM dispensaries WHERE ( 6371 * acos( cos( radians(${latitude}) ) * cos( radians( latitude ) ) *
                                    cos( radians( longitude ) - radians(${longitude}) ) + sin( radians(${latitude}) ) *
                                    sin( radians( latitude ) ) ) ) < 5 AND featured = 'true' AND id NOT IN (SELECT dispensary_id FROM user_disabled_dispensaries
                                    WHERE user_id = ${userID} AND status = 'true' AND expiry > CURRENT_TIMESTAMP)
                                    ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`;
                            helperFile.executeQuery(SQL).then(responseForFeaturedDispensaries => {
                                if (!responseForFeaturedDispensaries.isSuccess) {
                                    output = {status: 400, isSuccess: false, message: responseForFeaturedDispensaries.message};
                                    res.json(output);
                                } else {
                                    responseForDispensaries["featured_dispensaries"] = responseForFeaturedDispensaries.data;
                                }
                                voucher.getVoucherContent(userID, 'available',limit, offset).then(responseForAvailableVoucher => {
                                    if (!responseForAvailableVoucher.isSuccess){
                                        output = {status: 400, isSuccess: false, message: responseForAvailableVoucher.message};
                                        res.json(output);
                                    }else{
                                        responseForDispensaries["available_vouchers"] = responseForAvailableVoucher.vouchers;
                                    }
                                    voucher.getVoucherContent(userID, 'redeemed',limit, offset).then(responseForRedeemedVoucher => {
                                        if (!responseForRedeemedVoucher.isSuccess){
                                            output = {status: 400, isSuccess: false, message: responseForRedeemedVoucher.message};
                                            res.json(output);
                                        }else{
                                            responseForDispensaries["redeemed_vouchers"] = responseForRedeemedVoucher.vouchers;
                                        }
                                        res.json(responseForDispensaries);
                                    });
                                });
                            });
                        });
                    }
                });
            } else {
                output = {status: 400, isSuccess: false, message: "Invalid User"};
                res.json(output);
            }
        }
    });
};

auth.getUserProfile = function(req, res){
  var userID = req.query.user_id || '';
  if (!userID){
      output = {status:400, isSuccess: false, message: "User ID required"};
      res.json(output);
      return;
  }
  SQL = `SELECT * FROM users WHERE id = ${userID}`;
  helperFile.executeQuery(SQL).then(response => {
     if (!response.isSuccess){
         output = {status:400, isSuccess: false, message: response.message};
         res.json(output);
     } else{
         if (response.data.length > 0){
             delete response.data[0]["password"];
             output = {status:200, isSuccess: true, message: "Success", user: response.data};
             res.json(output);
         }else{
             output = {status:400, isSuccess: false, message: "Invalid User"};
             res.json(output);
         }
     }
  });
};

auth.updateUserProfile = function(req, imageName){
    return new Promise((resolve)=>{
        var userID = req.body.user_id || '';
        var userName = req.body.username || '';
        var phone = req.body.phone || '';
        var firstName = req.body.first_name || '';
        var lastName = req.body.last_name || '';

        if (!userID){
            output = {status:400, isSuccess: false, message: "User ID required"};
            resolve(output);
        }
        if (!userName){
            output = {status:400, isSuccess: false, message: "Username required"};
            resolve(output);
        }
        if (!phone){
            output = {status:400, isSuccess: false, message: "Phone required"};
            resolve(output);
        }
        if (!firstName){
            output = {status:400, isSuccess: false, message: "First Name required"};
            resolve(output);
        }
        if (!lastName){
            output = {status:400, isSuccess: false, message: "Last Name required"};
            resolve(output);
        }
        var isValidPhone = helperFile.checkValidPhone(phone);
        if (!isValidPhone){
            output = {status: 400, isSuccess: false, message: "Please enter a valid phone number" };
            resolve(output);
        }
        helperFile.checkPhoneExistsUpdate(phone, userID).then(responseForPhoneCheck =>{
            if (responseForPhoneCheck.isPhoneExists === true){
                output = { status: 400, isSuccess: false, message: "Phone number already exists" };
                resolve(output);
            }else{
                helperFile.checkUserNameExistsUpdate(userName, userID).then(responseForUserNameCheck => {
                    if (responseForUserNameCheck.isUserNameExists === true) {
                        output = {status: 400, isSuccess: false, message: "Username already exists"};
                        resolve(output);
                    }else{
                        if (imageName === ''){
                            SQL = `UPDATE users SET username = '${userName}', first_name = '${firstName}', last_name = '${lastName}',
                                   phone = '${phone}' WHERE id = ${userID}` ;
                        }else{
                            var imagePath = process.env.BASE_URL+'/images/'+imageName;
                            SQL = `UPDATE users SET username = '${userName}', first_name = '${firstName}', last_name = '${lastName}',
                                   phone = '${phone}', image = '${imagePath}' WHERE id = ${userID}` ;
                        }
                        helperFile.executeQuery(SQL).then(response => {
                            if (!response.isSuccess){
                                output = {status: 400, isSuccess: false, message: response.message};
                                resolve(output);
                            }else{
                                SQL = `SELECT * FROM users WHERE id = ${userID}`;
                                helperFile.executeQuery(SQL).then(responseForUser => {
                                   if (!responseForUser.isSuccess){
                                       output = {status: 400, isSuccess: false, message: responseForUser.message};
                                       resolve(output);
                                   } else{
                                       if (responseForUser.data.length > 0){
                                            resolve(responseForUser);
                                       }
                                   }
                                });
                            }
                        })
                    }
                });
            }
        });
    });
};

module.exports = auth;
