var helperFile = require('../helpers/helperFunctions.js');
var auth = require('./auth');

exports.forgotPassword = function (req, res) {
    res.render('forgetPassword.html');
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