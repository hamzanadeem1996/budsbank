

module.exports = function (req, res, nexxt) {
    console.log(req.header);
    nexxt();
};