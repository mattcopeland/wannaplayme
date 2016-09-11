var auth = require('./auth'),
  users = require('../controllers/users'),
  pyramids = require('../controllers/pyramids'),
  mongoose = require('mongoose');

module.exports = function (app) {
  app.get('/api/users', auth.requiresApiLogin, users.getUsers);
  app.post('/api/users', users.createUser);
  app.put('/api/users', auth.requiresApiLogin, users.updateUser);

  app.get('/api/pyramid', pyramids.getPyramid);
  app.get('/api/pyramids', auth.requiresApiLogin, pyramids.getPyramids);
  app.get('/api/pyramids/user', auth.requiresApiLogin, pyramids.getPyramidsForUser);
  app.post('/api/pyramids/create', auth.requiresRole('admin'), pyramids.createPyramid);
  app.post('/api/pyramids/swapPositions', auth.requiresApiLogin, pyramids.swapPositions);
  app.post('/api/pyramids/addPlayer', auth.requiresApiLogin, pyramids.addPlayer);

  app.post('/login', auth.authenticate);

  app.post('/logout', function (req, res) {
    req.logout();
    res.end();
  });

  app.all('/api/*', function (req, res) {
    res.send(404);
  });

  app.get('*', function (req, res) {
    res.render('index', {
      bootstrappedUser: req.user
    });
  });
};