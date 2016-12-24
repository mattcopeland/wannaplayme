var Competition = require('mongoose').model('Competition');
var websockets = require('../websockets');
var emails = require('./emails');
var alerts = require('./alerts');
var _ = require('lodash');

exports.getCompetition = function (req, res) {
  Competition.findOne({
    _id: req.query.competitionId
  }).exec(function (err, competition) {
    res.send(competition);
  });
};

exports.getCompetitions = function (req, res) {
  Competition.find({
    private: { $ne: true }
  }).exec(function (err, collection) {
    res.send(collection);
  });
};

exports.getCompetitionsForUser = function (req, res) {
  var userId = req.query.userId;
  Competition.find({
    players: {
      $elemMatch: {
        _id: userId
      }
    }
  }).exec(function (err, collection) {
    res.send(collection);
  });
};

exports.createCompetition = function (req, res) {
  var competitionData = req.body.competition;
  var alertsArray = [];

  Competition.create(competitionData, function (err, competition) {
    if (err) {
      res.status(400);
      return res.send({
        reason: err.toString()
      });
    }
    _.forEach(competitionData.players, function (player) {
      var alertDetails = {
        competitionId: competition._id,
        userId: player._id,
        details: {
          state: 'competitions.view',
          stateParams: {'competitionId': competition._id},
          title: 'New Competition',
          description: 'You have been added to a new competition'
        }
      };
      alertsArray.push(alertDetails);
    });
    alerts.createAlerts(alertsArray);

    res.send(competition);
  });
};

exports.updateCompetition = function (req, res, next) {
  var competitionData = req.body.competition;
  var details = {
    competitionId: competitionData._id,
    description: competitionData.name + ' has been updated by the admin.'
  };
  Competition.findOneAndUpdate(
    {
      _id: competitionData._id
    }, {
      $set: {
        'name': competitionData.name,
        'forfeitDays': competitionData.forfeitDays,
        'restrictJoins': competitionData.restrictJoins,
        'private': competitionData.private,
        'players': competitionData.players,
        'pendingPlayers': competitionData.pendingPlayers,
        'admins': competitionData.admins
      }
    })
    .exec(function (err, competition) {
      if (err) {
        return next(err);
      }
      websockets.broadcast('competition_updated', details);
      res.status(201).json(competition);
    });
};

exports.deleteCompetition = function (req, res) {
  var challengeDetails = {
    competitionId: req.query.competitionId,
    description: 'This competition has been updated by the admin.'
  };
  Competition.findOneAndRemove({
    _id: req.query.competitionId
  }).exec(function () {
    websockets.broadcast('competition_deleted', challengeDetails);
    res.send('deleted');
  });
};


exports.swapPositions = function (req, res, next) {
  Competition.findOneAndUpdate(
    {
      _id: req.body.competitionId,
      'players._id': req.body.challenger._id
    }, {
      $set: {
        'players.$.position': req.body.opponent.position
      }
    })
    .exec(function (err) {
      if (err) {
        return next(err);
      }
    });

  Competition.findOneAndUpdate(
    {
      _id: req.body.competitionId,
      'players._id': req.body.opponent._id
    }, {
      $set: {
        'players.$.position': req.body.challenger.position
      }
    })
    .exec(function (err, competitions) {
      if (err) {
        return next(err);
      }

      res.status(201).json(competitions);
    });
};

exports.addPlayer = function (req, res, next) {
  var player = req.body.player.displayName;
  var details = {
    competitionId: req.body.competitionId,
    description: '<b>' + player + '</b> has joined the competition'
  };
  Competition.findByIdAndUpdate({
    _id: req.body.competitionId
  }, {
    $push: {
      'players': req.body.player
    }
  })
  .exec(function (err, competition) {
    if (err) {
      return next(err);
    }
    websockets.broadcast('competition_updated', details);
    res.status(201).json(competition);
  });
};

exports.addPlayerRequest = function (req, res, next) {
  emails.addPlayerRequest(req.body.competition, req.body.player, req.get('host'));
  var player = req.body.player.displayName;
  var details =  {
    competitionId: req.body.competition._id,
    description: '<b>' + player + '</b> has requested to join the competition'
  };
  
  Competition.findByIdAndUpdate({
    _id: req.body.competition._id
  }, {
    $push: {
      'pendingPlayers': req.body.player
    }
  })
  .exec(function (err, competition) {
    if (err) {
      return next(err);
    }
    websockets.broadcast('competition_updated', details);
    res.status(201).json(competition);
  });
};

exports.removePlayer = function (req, res, next) {
  var removedPlayer = req.body.removedPlayer;
  var details =  {
    competitionId: req.body.competitionId,
    description: '<b>' + removedPlayer.displayName + '</b> has left the competition'
  };
  Competition.findByIdAndUpdate({
    _id: req.body.competitionId
  }, {
    $set: {
      'players': req.body.players
    }
  })
  .exec(function (err, competition) {
    if (err) {
      return next(err);
    }
    websockets.broadcast('competition_updated', details);
    res.status(201).json(competition);
  });
};

exports.approvePlayer = function (req, res, next) {
  var player = req.body.player.displayName;
  var details = {
    competitionId: req.body.competitionId,
    description: '<b>' + player + '</b> has joined the competition'
  };

  var competitionName;
  Competition.findOne({
    _id: req.body.competitionId
  }, 'name', function (err, competition) {
    if (err) {
      return next(err);  
    }
    competitionName = competition.name;
    emails.approveRequest(req.body.competitionId, competitionName, req.body.player, req.get('host'));

    var alertDetails = {
      competitionId: req.body.competitionId,
      userId: req.body.player._id,
      details: {
        state: 'competitions.view',
        stateParams: {'competitionId': competition._id},
        title: 'Join Request Approved',
        description: 'Your join request has been approved in ' + competitionName
      }
    };
    alerts.createAlerts([alertDetails]);
  });

  Competition.findByIdAndUpdate({
    _id: req.body.competitionId
  }, {
    $push: {
      'players': req.body.player
    },
    $pull: {
      'pendingPlayers': {
        '_id': req.body.player._id
      }
    }
  })
  .exec(function (err, competition) {
    if (err) {
      return next(err);
    }
    websockets.broadcast('competition_updated', details);
    res.status(201).json(competition);
  });
};

exports.denyPlayer = function (req, res, next) {
  var player = req.body.player.displayName;
  var details = {
    competitionId: req.body.competitionId,
    description: player + ' has been <b>denied</b> entry to the competition'
  };
  var competitionName;
  Competition.findOne({
    _id: req.body.competitionId
  }, 'name', function (err, competition) {
    if (err) {
      return next(err);  
    }
    competitionName = competition.name;
    emails.denyRequest(req.body.competitionId, competitionName, req.body.player, req.get('host'));

    var alertDetails = {
      competitionId: req.body.competitionId,
      userId: req.body.player._id,
      details: {
        state: 'competitions.view',
        stateParams: {'competitionId': competition._id},
        title: 'Join Request Denied',
        description: 'Your join request has been denied in ' + competitionName
      }
    };
    alerts.createAlerts([alertDetails]);
  });

  Competition.findByIdAndUpdate({
    _id: req.body.competitionId
  }, {
    $pull: {
      'pendingPlayers': {
        '_id': req.body.player._id
      }
    }
  })
  .exec(function (err, competition) {
    if (err) {
      return next(err);
    }
    websockets.broadcast('competition_updated', details);
    res.status(201).json(competition);
  });
};