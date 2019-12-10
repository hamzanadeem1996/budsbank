var express = require('express');
var router = express.Router();
var auth = require('./auth');
var web = require('./webPreview');
var dispensaries = require('./dispansaries');
var quiz = require('./quiz');
var voucher = require('./voucher');
var notification = require('./notifications');

router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/api/v1/user/verify', auth.verifyUser);
router.post('/api/v1/user/verify-code', auth.verifyCode);
router.get('/api/v1/user/profile', auth.getUserProfile);

router.post('/forget-password', auth.forgotPassword);
router.get('/forgetPassword/:code', web.forgotPassword);
router.post('/updatePassword', auth.updatePassword);

router.get('/api/v1/home-content', auth.getHomeContent);
router.get('/api/v1/dispensary/completed-dispensaries', dispensaries.getCompletedDispensariesByUserID);
router.get('/api/v1/dispensary/followed-dispensaries', dispensaries.userFollowedDispensaries);

router.get('/api/v1/dispensaries/nearby-dispensaries', dispensaries.getNearbyDispensaries);
router.post('/api/v1/dispensary/follow-dispensary', dispensaries.followDispensary);
router.post('/api/v1/dispensary/unfollow-dispensary', dispensaries.unFollowDispensary);
router.get('/api/v1/dispensary/get-dispensary', dispensaries.getDispensaryByID);
router.get('/api/v1/dispensary/search', dispensaries.searchDispensary);
router.get('/api/v1/dispensary/featured-dispensaries', dispensaries.featuredDispensariesList);

router.get('/api/v1/quiz/get-quiz', quiz.getQuizQuestion);
router.post('/api/v1/quiz/save-quiz', quiz.saveQuizResult);

router.get('/api/v1/voucher/available-vouchers', voucher.getAvailableVouchersList);
router.get('/api/v1/voucher/redeemed-vouchers', voucher.getRedeemedVouchersList);
router.post('/api/v1/voucher/claim-voucher', voucher.claimVoucher);

router.post('/api/v1/notification/enable-disable', notification.enableDisableNotification);
router.get('/api/v1/notification/settings', notification.getAllSettings);

router.get('/api/v1/notification/all', notification.getAllNotifications);
router.get('/api/v1/notification/read-notifications', notification.getReedNotifications);
router.get('/api/v1/notification/unread-notifications', notification.getUnReedNotifications);
router.post('/api/v1/notification/mark-read', notification.markReadNotification);

var multer = require('multer');
var storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/images');
    },
    filename: (req, file, cb) => {
        console.log(file);
        var filetype = '';
        if(file.mimetype === 'image/png') {
            filetype = 'png';
        }
        if(file.mimetype === 'image/jpg') {
            filetype = 'jpg';
        }
        if(file.mimetype === 'image/jpeg') {
            filetype = 'jpeg';
        }

        cb(null, 'file-' + Date.now() + '.' + filetype);
    }
});
var upload = multer({storage: storage});
router.post('/api/v1/user/update-profile', upload.single('image'), function (req, res) {
    if(req.file){
        var imageName = req.file.filename;
    }else{
        var imageName = '';
    }
    auth.updateUserProfile(req, imageName).then(response => {
       if (!response.isSuccess){
           output = {status: 400, isSuccess: false, message: response.message};
           res.json(output);
           return;
       } else{
           delete response.data[0]["password"];
           output = {status: 200, isSuccess: true, message: "User Updated Successfully", user: response.data[0]};
           res.json(output);
       }
    });
});


module.exports = router;