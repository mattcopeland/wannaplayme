var User = require('mongoose').model('User'),
  encrypt = require('../utilities/encryption'),
  passport = require('passport');

exports.getUsers = function (req, res) {
  User.find({}).exec(function (err, collection) {
    res.send(collection);
  });
};

exports.createUser = function (req, res, next) {
  var userData = req.body.userData;
  userData.username = userData.username.toLowerCase();
  userData.salt = encrypt.createSalt();
  userData.hashedPwd = encrypt.hashPwd(userData.salt, userData.password);
  User.create(userData, function (err, user) {
    if (err) {
      if (err.toString().indexOf('E11000') > -1) {
        err = new Error('Duplicate Username');
      }
      res.status(400);
      return res.send({
        reason: err.toString()
      });
    }
    res.send(user);
  });
};

exports.updateUser = function (req, res) {
  var userUpdates = req.body;

  if ((req.user._id.toString() !== userUpdates._id) && !req.user.hasRole('super-admin')) {
    res.status(403);
    return res.end();
  }

  if (userUpdates.password && userUpdates.password.length > 0) {
    userUpdates.salt = encrypt.createSalt();
    userUpdates.hashedPwd = encrypt.hashPwd(userUpdates.salt, userUpdates.password);
  }

  User.findByIdAndUpdate(userUpdates._id, userUpdates, function (err, user) {
    if (err) {
      res.status(400);
      return res.send({
        reason: err.toString()
      });
    }
    res.send(user);
  });
};