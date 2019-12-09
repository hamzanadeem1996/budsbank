var jwt = require('jwt-simple');
var validateRequest = require('../routes/auth').validateRequest;

module.exports = function(req, res, next) {

    var token = (req.body && req.body.access_token) || (req.query && req.query.access_token) || req.headers['x-access-token'];
    var key = (req.body && req.body.x_key) || (req.query && req.query.x_key) || req.headers['x-key'];

    if (token) {
        try {
             // var decoded = jwt.decode(token, process.env.TOKEN_SECRET);

            validateRequest(token).then(dbUser =>{
                if (dbUser.isSuccess) {
                    if (req.url.indexOf('/api/') >= 0) {
                        next(); // To move to next middleware
                    } else {
                        res.status(403);
                        res.json({
                            "status": 403,
                            "isSuccess" : false,
                            "message": "Not Authorized"
                        });
                        return;
                    }
                } else {
                    // No user with this name exists, respond back with a 401
                    res.status(401);
                    res.json({
                        "status": 401,
                        "isSuccess" : false,
                        "message": "Invalid User"
                    });
                    return;
                }
            }) // The key would be the logged in user's username


        } catch (err) {
            res.status(500);
            res.json({
                "status": 500,
                "isSuccess" : false,
                "message": "Oops something went wrong",
                "error": err.message
            });
        }
    } else {
        res.status(401);
        res.json({
            "status": 401,
            "isSuccess" : false,
            "message": "Invalid Token or Key"
        });
        return;
    }
};
