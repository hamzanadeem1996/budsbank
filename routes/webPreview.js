var helperFile = require('../helpers/helperFunctions.js');
var auth = require('./auth');
var Cryptr = require('cryptr');
cryptr = new Cryptr(process.env.PASS_SECRET);

exports.forgotPassword = function (req, res) {
    // console.log(req.params.code);
    var code = req.params.code;
    var error = "";
    var userID;
    if (!code){
        error = "Invalid Verification Code";
    }else{
        var decrptCode = cryptr.decrypt(code);
        SQL = `SELECT user_id FROM user_verification WHERE code = '${decrptCode}'`;
        helperFile.executeQuery(SQL).then(response => {
           if (response.data.length > 0){
               userID = response.data[0].user_id;
               res.render('forgetPassword', {user : userID});
           }
        });
    }
};

exports.generateLinkToEmail = function (req, res) {
  var userEmail = req.body.email || '';
  if(!userEmail){
      output = {status: 400, isSuccess: false, message: "Email Required"};
      res.json(output);
      return;
  }
  var isEmail = false;
  isEmail = helperFile.checkIfEmailInString(userEmail);
    if (!isEmail) {
        output = { status: 400, isSuccess: false, message: "Email not valid" };
        res.json(output);
        return;
    }
    Query = "SELECT id FROM `users` WHERE email = '" + userEmail + "'";
    helperFile.executeQuery(Query).then(response => {
       if (!response.isSuccess){
           output = { status: 400, isSuccess: false, message:response.message };
           res.json(output);
           return;
       } else{
           if (response.data.length > 0){

           }
       }
    });

};