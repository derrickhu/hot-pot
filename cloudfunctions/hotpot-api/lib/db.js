const tcb = require('@cloudbase/node-sdk');
const { getCollectionName, getLevelPassRateCollectionName } = require('./config');

let app = null;

function getApp() {
  if (app) return app;
  app = tcb.init({
    env: process.env.TCB_ENV || tcb.SYMBOL_CURRENT_ENV,
  });
  return app;
}

function getDb() {
  return getApp().database();
}

function getCollection() {
  return getDb().collection(getCollectionName('playerData'));
}

function getRankingCollection() {
  return getDb().collection(getCollectionName('rankings'));
}

function getLevelPassRateCollection() {
  return getDb().collection(getLevelPassRateCollectionName());
}

module.exports = {
  getApp,
  getDb,
  getCollection,
  getRankingCollection,
  getLevelPassRateCollection,
};
