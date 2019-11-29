const emailConfig = require('./email-config')();
const mailgun = require('mailgun-js')(emailConfig);
const CNST = require('../config/constant');
exports.sendEmail = (recipient, code, requestType) =>
    new Promise((resolve, reject) => {

        var mailData = {};
        if (requestType === "forgotPassword") {
            mailData = {
                from: process.env.SENDER_EMAIL, // sender address (who sends)
                to: recipient, // list of receivers (who receives)
                subject: 'Forgot Password ', // Subject line
                //text: 'Hello world ', // plaintext body
                html: '<html><head></head><body><div style=" text-align: -webkit-center; "><table style="min-width:320px"><tbody><tr><td align="center" bgcolor="#eff3f8"><table border="0" class="m_-7717446627816032464m_-3672694713795667454table_width_100" width="100%" style="max-width:680px;min-width:300px"><tbody><tr><td align="center" bgcolor="#ffffff"><table width="100%" border="0" cellspacing="0" cellpadding="0"><tbody><tr><td align="center" style="border-bottom:1px solid #eee;padding:3%;background:#2abf88"><div style=" font-size: 42px; font-family: sans-serif; color: #fff; ">Buds Bank</div></td><td align="right"><div style="height:25px;line-height:50px;font-size:10px"></div></td></tr></tbody></table></td></tr><tr><td><table width="100%" border="0" cellspacing="0" cellpadding="0"><tbody><tr><td><div style="line-height:24px"><font face="Arial, Helvetica, sans-serif" size="4" color="#57697e" style="font-size:15px"><h3 style="font-size:18px;color:#373737;float:left;margin-left:3%;margin-top:5%">Hello,</h3><span style="width:94%!important;font-family:Arial,Helvetica,sans-serif;font-size:17px;color:#57697e;float:left;margin-left:3%;margin-top:0%;margin-bottom:4%;width:100%">This is your forget password code. Please enter this code to reset your password: ' + code + ' </span></font></div><div style="height:15px;line-height:40px;font-size:10px"></div></td></tr><tr><td><font><span style="font-family:Arial,Helvetica,sans-serif;font-size:17px;color:#57697e;float:left;margin-left:3%;margin-top:3%;margin-bottom:4%">Thanks, <br> Buds Bank Team</span></font></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></div></body></html>'
            };
        } else {
            mailData = {
                from: process.env.SENDER_EMAIL, // sender address (who sends)
                to: recipient, // list of receivers (who receives)
                subject: 'Buds Bank Account Verification Email', // Subject line
                //text: 'Hello world ', // plaintext body
                html: '<html><head></head><body><div style=" text-align: -webkit-center; "><table style="min-width:320px"><tbody><tr><td align="center" bgcolor="#eff3f8"><table border="0" class="m_-7717446627816032464m_-3672694713795667454table_width_100" width="100%" style="max-width:680px;min-width:300px"><tbody><tr><td align="center" bgcolor="#ffffff"><table width="100%" border="0" cellspacing="0" cellpadding="0"><tbody><tr><td align="center" style="border-bottom:1px solid #eee;padding:3%;background:#2abf88"><div style=" font-size: 42px; font-family: sans-serif; color: #fff; ">Buds Bank</div></td><td align="right"><div style="height:25px;line-height:50px;font-size:10px"></div></td></tr></tbody></table></td></tr><tr><td><table width="100%" border="0" cellspacing="0" cellpadding="0"><tbody><tr><td><div style="line-height:24px"><font face="Arial, Helvetica, sans-serif" size="4" color="#57697e" style="font-size:15px"><h3 style="font-size:18px;color:#373737;float:left;margin-left:3%;margin-top:5%">Hello,</h3><span style="width:94%!important;font-family:Arial,Helvetica,sans-serif;font-size:17px;color:#57697e;float:left;margin-left:3%;margin-top:0%;margin-bottom:4%;width:100%">Your verification code is ' + code + ' </span></font></div><div style="height:15px;line-height:40px;font-size:10px"></div></td></tr><tr><td><font><span style="font-family:Arial,Helvetica,sans-serif;font-size:17px;color:#57697e;float:left;margin-left:3%;margin-top:3%;margin-bottom:4%">Thanks, <br> Buds Bank Team</span></font></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></div></body></html>'
            };
        }

        mailgun.messages().send(mailData, (error, result) => {
            if (error) {
                console.log(error);
                return reject({ status: 400, isSuccess: false, message: error.message });
            }
            output = { status: 200, isSuccess: true, message: CNST.EMAIL_SENT_SUCCESS };
            return resolve(output);
        });
    });