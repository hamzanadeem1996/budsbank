var express = require('express');
var router = express.Router();

var auth = require('./auth');
var web = require('./webPreview');

//Authentication Routes
router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/api/user/verify', auth.verifyUser);
router.post('/api/user/verify/code', auth.verifyCode);

router.post('/forgetPassword', auth.forgotPassword);
router.get('/forgetPassword/:code', web.forgotPassword);

router.post('/updatePassword', auth.updatePassword);



module.exports = router;